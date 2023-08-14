import {
  Context,
  Contract,
  Info,
  Returns,
  Transaction,
} from "fabric-contract-api";

interface Reserve {
  tokenA: number;
  tokenB: number;
}

interface LiquidityProvider {
  user: string;
  amount: number;
  earnedFees: number; // New field to store earned fees
}

interface UserContribution {
  userId: string;
  contributionA: number;
  contributionB: number;
  lpTokens: number;
}

@Info({
  title: "LiquidityPool",
  description: "Smart contract for Uniswap-like liquidity pool management",
})
export class LiquidityPool extends Contract {
  private static readonly RESERVE_WALLET_KEY = "ReserveWallet";
  private static readonly USER_CONTRIBUTION_PREFIX = "UserContribution:";
  private tokenAContract: string;
  private tokenBContract: string;
  private static readonly oracleContractName = "OracleContract"; // Assuming the name of the OracleContract when deployed

  constructor(tokenAContract: string, tokenBContract: string) {
    super();
    this.tokenAContract = tokenAContract;
    this.tokenBContract = tokenBContract;
  }

  @Transaction()
  async Init(ctx: Context): Promise<void> {
    const initialReserve: Reserve = { tokenA: 0, tokenB: 0 };
    await ctx.stub.putState(
      LiquidityPool.RESERVE_WALLET_KEY,
      Buffer.from(JSON.stringify(initialReserve))
    );
  }


  @Transaction()
  async AddLiquidity(
    ctx: Context,
    userId: string,
    amountA: number,
    amountB: number
  ): Promise<boolean> {
    // Fetch prices from the Oracle contract
    const priceA = parseFloat(await this.getPriceFromOracle(ctx, "tokenA"));
    const priceB = parseFloat(await this.getPriceFromOracle(ctx, "tokenB"));

    // Validate if the amounts provided are in the correct ratio
    if (Math.abs(amountA * priceA - amountB * priceB) > 0.01) {
      // 0.01 is a small threshold to account for minor price fluctuations
      throw new Error("Provided amounts don't match the current price ratio.");
    }

    // ... [Rest of the function remains unchanged]

    // Transfer tokens from the user to the contract
    await ctx.stub.invokeChaincode(
      this.tokenAContract,
      [
        "transfer",
        userId,
        LiquidityPool.RESERVE_WALLET_KEY,
        amountA.toString(),
      ],
      "mychannel"
    );
    await ctx.stub.invokeChaincode(
      this.tokenBContract,
      [
        "transfer",
        userId,
        LiquidityPool.RESERVE_WALLET_KEY,
        amountB.toString(),
      ],
      "mychannel"
    );

    // Calculate LP tokens to be minted based on the user's contribution
    const totalReserve: Reserve = JSON.parse(
      (await ctx.stub.getState(LiquidityPool.RESERVE_WALLET_KEY)).toString()
    );

    let lpTokensToMint: number;

    if (totalReserve.tokenA === 0 || totalReserve.tokenB === 0) {
      lpTokensToMint = Math.sqrt(amountA * amountB);
    } else {
      lpTokensToMint = Math.min(
        amountA / totalReserve.tokenA,
        amountB / totalReserve.tokenB
      );
    }

    // Update the total reserves
    totalReserve.tokenA += amountA;
    totalReserve.tokenB += amountB;
    await ctx.stub.putState(
      LiquidityPool.RESERVE_WALLET_KEY,
      Buffer.from(JSON.stringify(totalReserve))
    );

    // Update or create user's contribution
    const userContributionKey = LiquidityPool.USER_CONTRIBUTION_PREFIX + userId;
    let userContribution: UserContribution = JSON.parse(
      (await ctx.stub.getState(userContributionKey)).toString()
    );

    if (!userContribution) {
      userContribution = {
        userId: userId,
        contributionA: amountA,
        contributionB: amountB,
        lpTokens: lpTokensToMint,
      };
    } else {
      userContribution.contributionA += amountA;
      userContribution.contributionB += amountB;
      userContribution.lpTokens += lpTokensToMint;
    }

    await ctx.stub.putState(
      userContributionKey,
      Buffer.from(JSON.stringify(userContribution))
    );

    return true;
  }

  private async distributeFees(ctx: Context, fee: number): Promise<void> {
    // Fetch all liquidity providers and their contributions from the LiquidityProviderContract
    const liquidityProvidersResponse = await ctx.stub.invokeChaincode(
      "LiquidityProviderContract",
      ["GetAllLiquidityProviders"],
      "mychannel"
    );
    if (liquidityProvidersResponse.status !== 200) {
      throw new Error("Failed to fetch liquidity providers.");
    }
    const liquidityProviders: LiquidityProvider[] = JSON.parse(
      liquidityProvidersResponse.payload.toString()
    );

    let totalLiquidity = 0;
    for (const provider of liquidityProviders) {
      totalLiquidity += provider.amount;
    }

    for (const provider of liquidityProviders) {
      const distributionAmount = (provider.amount / totalLiquidity) * fee;
      // Update the earned fees for the liquidity provider
      await ctx.stub.invokeChaincode(
        "LiquidityProviderContract",
        ["UpdateEarnedFees", provider.user, distributionAmount.toString()],
        "mychannel"
      );
    }
  }

  private async getPriceFromOracle(
    ctx: Context,
    token: string
  ): Promise<string> {
    const priceResponse = await ctx.stub.invokeChaincode(
      LiquidityPool.oracleContractName,
      ["GetCurrencyPrice", token],
      "mychannel"
    );
    if (priceResponse.status !== 200) {
      throw new Error(`Failed to fetch price for ${token}`);
    }
    return priceResponse.payload.toString();
  }

  private static readonly FEE_RATE = 0.003; // 0.3% fee

  @Transaction()
  async Swap(
    ctx: Context,
    userId: string,
    inputToken: string,
    amountIn: number
  ): Promise<number> {
    const reserve: Reserve = JSON.parse(
      (await ctx.stub.getState(LiquidityPool.RESERVE_WALLET_KEY)).toString()
    );
    let amountOut: number;

    if (inputToken === "tokenA") {
      const invariant = reserve.tokenA * reserve.tokenB;
      reserve.tokenA += amountIn;
      amountOut = reserve.tokenB - invariant / reserve.tokenA;
      reserve.tokenB -= amountOut;
    } else {
      const invariant = reserve.tokenA * reserve.tokenB;
      reserve.tokenB += amountIn;
      amountOut = reserve.tokenA - invariant / reserve.tokenB;
      reserve.tokenA -= amountOut;
    }

    // Calculate and deduct the fee
    const fee = amountOut * LiquidityPool.FEE_RATE;
    amountOut -= fee;

    // Distribute the fee to liquidity providers
    await this.distributeFees(ctx, fee);

    // Transfer tokens
    if (inputToken === "tokenA") {
      await ctx.stub.invokeChaincode(
        this.tokenAContract,
        [
          "transfer",
          userId,
          LiquidityPool.RESERVE_WALLET_KEY,
          amountIn.toString(),
        ],
        "mychannel"
      );
      await ctx.stub.invokeChaincode(
        this.tokenBContract,
        [
          "transfer",
          LiquidityPool.RESERVE_WALLET_KEY,
          userId,
          amountOut.toString(),
        ],
        "mychannel"
      );
    } else {
      await ctx.stub.invokeChaincode(
        this.tokenBContract,
        [
          "transfer",
          userId,
          LiquidityPool.RESERVE_WALLET_KEY,
          amountIn.toString(),
        ],
        "mychannel"
      );
      await ctx.stub.invokeChaincode(
        this.tokenAContract,
        [
          "transfer",
          LiquidityPool.RESERVE_WALLET_KEY,
          userId,
          amountOut.toString(),
        ],
        "mychannel"
      );
    }

    // Update reserve
    await ctx.stub.putState(
      LiquidityPool.RESERVE_WALLET_KEY,
      Buffer.from(JSON.stringify(reserve))
    );

    return amountOut;
  }

  @Transaction()
  async RemoveLiquidity(
    ctx: Context,
    userId: string,
    lpAmount: number
  ): Promise<boolean> {
    const totalReserve: Reserve = JSON.parse(
      (await ctx.stub.getState(LiquidityPool.RESERVE_WALLET_KEY)).toString()
    );
    const userContributionKey = LiquidityPool.USER_CONTRIBUTION_PREFIX + userId;
    let userContribution: UserContribution = JSON.parse(
      (await ctx.stub.getState(userContributionKey)).toString()
    );

    if (!userContribution || userContribution.lpTokens < lpAmount) {
      throw new Error("Insufficient LP tokens.");
    }

    const proportion = lpAmount / userContribution.lpTokens;

    const amountA = userContribution.contributionA * proportion;
    const amountB = userContribution.contributionB * proportion;

    const feeA = amountA * 0.003; // 0.3% fee for example
    const feeB = amountB * 0.003;

    // Transfer tokens back to the user
    await ctx.stub.invokeChaincode(
      this.tokenAContract,
      [
        "transfer",
        LiquidityPool.RESERVE_WALLET_KEY,
        userId,
        (amountA - feeA).toString(),
      ],
      "mychannel"
    );
    await ctx.stub.invokeChaincode(
      this.tokenBContract,
      [
        "transfer",
        LiquidityPool.RESERVE_WALLET_KEY,
        userId,
        (amountB - feeB).toString(),
      ],
      "mychannel"
    );

    // Update reserves
    totalReserve.tokenA -= amountA;
    totalReserve.tokenB -= amountB;
    await ctx.stub.putState(
      LiquidityPool.RESERVE_WALLET_KEY,
      Buffer.from(JSON.stringify(totalReserve))
    );

    // Update user's LP token amount
    userContribution.lpTokens -= lpAmount;
    userContribution.contributionA -= amountA;
    userContribution.contributionB -= amountB;
    await ctx.stub.putState(
      userContributionKey,
      Buffer.from(JSON.stringify(userContribution))
    );

    return true;
  }

  async GetReserve(ctx: Context, token: string): Promise<number> {
    const reserve: Reserve = JSON.parse(
      (await ctx.stub.getState(LiquidityPool.RESERVE_WALLET_KEY)).toString()
    );
    if (token === "tokenA") {
      return reserve.tokenA;
    } else if (token === "tokenB") {
      return reserve.tokenB;
    } else {
      throw new Error("Invalid token identifier");
    }
  }
}
