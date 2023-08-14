/*
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Context,
  Contract,
  Info,
  Returns,
  Transaction,
} from "fabric-contract-api";
import { Basket } from "./basket";

const reserveWallet = "reserveWallet";
const oracleContractName = "OracleContract";
interface LiquidityProvider {
  user: string;
  amount: number;
  earnedFees: number; 
}
@Info({
  title: "AssetCross",
  description:
    "Smart contract for managing a basket of CBDCs based on Curve DAO",
})
export class BasketContract extends Contract {
  @Transaction()
  public async InitBasket(ctx: Context, initBasket:string): Promise<void> {
    const basket: Basket = JSON.parse(initBasket);
    await ctx.stub.putState(basket.ID, Buffer.from(JSON.stringify(basket)));
  }

  @Transaction(false)
  @Returns("string")
  public async ReadBasket(ctx: Context): Promise<string> {
    const basketJSON = await ctx.stub.getState("basket1");
    if (!basketJSON || basketJSON.length === 0) {
      throw new Error('The basket "basket1" does not exist');
    }
    return basketJSON.toString();
  }

  @Transaction()
  public async UpdateBasketPrices(ctx: Context): Promise<void> {
    const basketJSON = await ctx.stub.getState("basket1");
    if (!basketJSON || basketJSON.length === 0) {
      throw new Error('The basket "basket1" does not exist');
    }

    const basket: Basket = JSON.parse(basketJSON.toString());
    for (let i = 0; i < basket.Tokens.length; i++) {
      const priceResponse = await ctx.stub.invokeChaincode(
        oracleContractName,
        ["GetCurrencyPrice", basket.Tokens[i]],
        "mychannel"
      );
      if (priceResponse.status !== 200) {
        throw new Error(`Failed to fetch price for ${basket.Tokens[i]}`);
      }
      basket.Prices[i] = parseFloat(priceResponse.payload.toString());
    }
    await ctx.stub.putState("basket1", Buffer.from(JSON.stringify(basket)));
  }

  @Transaction()
  public async SwapCBDCs(
    ctx: Context,
    amount: number,
    fromCBDC: string,
    toCBDC: string,
    user: string
  ): Promise<string> {
    const basketJSON = await ctx.stub.getState("basket1");
    const basket: Basket = JSON.parse(basketJSON.toString());
  
    const fromIndex = basket.Tokens.indexOf(fromCBDC);
    const toIndex = basket.Tokens.indexOf(toCBDC);
  
    if (fromIndex === -1 || toIndex === -1) {
      throw new Error(
        "One or both provided CBDCs are not supported in the basket."
      );
    }
  
    // Calculate the invariant before the swap
    let D_before = 0;
    for (let i = 0; i < basket.Reserves.length; i++) {
      D_before += basket.Reserves[i];
      for (let j = 0; j < basket.Reserves.length; j++) {
        if (i !== j) {
          D_before *= (1 + basket.Reserves[i] / basket.Reserves[j]);
        }
      }
    }
  
    // Update the reserves for the 'from' CBDC
    basket.Reserves[fromIndex] -= amount;
  
    // Calculate the invariant after removing the 'from' CBDC
    let D_after = 0;
    for (let i = 0; i < basket.Reserves.length; i++) {
      D_after += basket.Reserves[i];
      for (let j = 0; j < basket.Reserves.length; j++) {
        if (i !== j) {
          D_after *= (1 + basket.Reserves[i] / basket.Reserves[j]);
        }
      }
    }
  
    // Calculate the amount of 'to' CBDC to be added to maintain the invariant
    const toAmount = D_before - D_after;
  
    // Update the reserves for the 'to' CBDC
    basket.Reserves[toIndex] += toAmount;
  
    const fromCBDCDecrease = await ctx.stub.invokeChaincode(
      "alpha",
      ["Transfer", user, reserveWallet, amount.toString()],
      "mychannel"
    );
    if (fromCBDCDecrease.status !== 200) {
      throw new Error("CBDC transfer from user failed.");
    }
  
    const toCBDCIncrease = await ctx.stub.invokeChaincode(
      "alpha",
      ["Transfer", reserveWallet, user, toAmount.toString()],
      "mychannel"
    );
    if (toCBDCIncrease.status !== 200) {
      throw new Error("CBDC transfer to user failed.");
    }
  
    await ctx.stub.putState("basket1", Buffer.from(JSON.stringify(basket)));
  
    return `Successfully swapped ${amount} ${fromCBDC} for ${toAmount} ${toCBDC}`;
  }
  

  @Transaction()
  public async UpdateReserves(
    ctx: Context,
    updatedReserves: number[]
  ): Promise<void> {
    const basketJSON = await ctx.stub.getState("basket1");
    if (!basketJSON || basketJSON.length === 0) {
      throw new Error('The basket "basket1" does not exist');
    }

    const basket: Basket = JSON.parse(basketJSON.toString());
    basket.Reserves = updatedReserves;
    await ctx.stub.putState("basket1", Buffer.from(JSON.stringify(basket)));
  }

  @Transaction()
  public async AddLiquidity(
    ctx: Context,
    amounts: number[],
    user: string
  ): Promise<void> {
    const basketJSON = await ctx.stub.getState("basket1");
    const basket: Basket = JSON.parse(basketJSON.toString());

    if (amounts.length !== basket.Tokens.length) {
      throw new Error(
        "Mismatch in the number of provided amounts and supported tokens."
      );
    }

    for (let i = 0; i < basket.Tokens.length; i++) {
      const tokenTransfer = await ctx.stub.invokeChaincode(
        basket.Tokens[i],
        ["Transfer", user, reserveWallet, amounts[i].toString()],
        "mychannel"
      );
      if (tokenTransfer.status !== 200) {
        throw new Error(`Transfer for ${basket.Tokens[i]} failed.`);
      }

      basket.Reserves[i] += amounts[i];
    }

    await ctx.stub.putState("basket1", Buffer.from(JSON.stringify(basket)));
  }

  
  @Transaction()
  public async RemoveLiquidity(
    ctx: Context,
    percentage: number,
    user: string
  ): Promise<void> {
    if (percentage <= 0 || percentage > 100) {
      throw new Error("Invalid percentage. Must be between 0 and 100.");
    }

    const basketJSON = await ctx.stub.getState("basket1");
    const basket: Basket = JSON.parse(basketJSON.toString());


    // Distribute fees if needed and update the user's liquidity position
    const providerData = await ctx.stub.invokeChaincode(
      "LiquidityProviderContract",
      ["GetLiquidityProvider", user],
      "mychannel"
    );
    const provider: LiquidityProvider = JSON.parse(
      providerData.payload.toString()
    );
    await ctx.stub.invokeChaincode(
      "alpha",
      ["Transfer", reserveWallet, user, provider.earnedFees.toString()],
      "mychannel"
    );

    // Reset the earned fees for the liquidity provider
    await ctx.stub.invokeChaincode(
      "LiquidityProviderContract",
      ["UpdateEarnedFees", user, (-provider.earnedFees).toString()],
      "mychannel"
    );

    await ctx.stub.putState("basket1", Buffer.from(JSON.stringify(basket)));
  }

  // Assuming a fee distribution mechanism
  private async distributeFees(ctx: Context, fee: number): Promise<void> {
    // Fetch all liquidity providers and their contributions
    // For this example, I'm assuming a function that gets all liquidity providers. You might need to adjust this based on your actual data structure.
    const liquidityProviders = await this.getLiquidityProviders(ctx);

    let totalLiquidity = 0;
    for (const provider of liquidityProviders) {
      totalLiquidity += provider.amount;
    }

    for (const provider of liquidityProviders) {
      const distributionAmount = (provider.amount / totalLiquidity) * fee;
      // Update the earned fees for the liquidity provider
      // Again, you might need to adjust this based on your actual data structure and logic.
      await ctx.stub.invokeChaincode(
        "LiquidityProviderContract",
        ["UpdateEarnedFees", provider.user, distributionAmount.toString()],
        "mychannel"
      );
    }
  }
  
  private async getLiquidityProviders(
    ctx: Context
  ): Promise<{ user: string; amount: number }[]> {
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

    return liquidityProviders.map((provider) => {
      return { user: provider.user, amount: provider.amount };
    });
  }

  
}
