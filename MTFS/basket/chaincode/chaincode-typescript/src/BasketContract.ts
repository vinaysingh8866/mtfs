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
const oracleContractName = "OracleContract"; // Assuming the name of the OracleContract when deployed
interface LiquidityProvider {
  user: string;
  amount: number;
  earnedFees: number; // New field to store earned fees
}
@Info({
  title: "AssetCross",
  description:
    "Smart contract for managing a basket of stablecoins based on Curve DAO",
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
  public async CBDCToStablecoin(
    ctx: Context,
    amount: number,
    cbdc: string,
    user: string
  ): Promise<string> {
    const basketJSON = await ctx.stub.getState("basket1");
    const basket: Basket = JSON.parse(basketJSON.toString());

    const cbdcIndex = basket.Tokens.indexOf(cbdc);
    if (cbdcIndex === -1) {
      throw new Error("Provided CBDC is not supported in the basket.");
    }

    const stablecoinAmount = amount * basket.Prices[cbdcIndex];

    // TODO: Ensure that the reserves, weights, etc., are updated accordingly.

    const cbdcTransfer = await ctx.stub.invokeChaincode(
      "alpha",
      ["Transfer", user, reserveWallet, amount.toString()],
      "mychannel"
    );
    if (cbdcTransfer.status !== 200) {
      throw new Error("CBDC transfer failed.");
    }

    const stableCoinTransfer = await ctx.stub.invokeChaincode(
      "gama",
      ["Transfer", reserveWallet, user, stablecoinAmount.toString()],
      "mychannel"
    );
    if (stableCoinTransfer.status !== 200) {
      throw new Error("Stablecoin transfer failed.");
    }

    return stableCoinTransfer.payload.toString();
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

    const toAmount =
      amount * (basket.Prices[fromIndex] / basket.Prices[toIndex]);

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

    // Update reserves accordingly
    basket.Reserves[fromIndex] -= amount;
    basket.Reserves[toIndex] += toAmount;
    await ctx.stub.putState("basket1", Buffer.from(JSON.stringify(basket)));

    return `Successfully swapped ${amount} ${fromCBDC} for ${toAmount} ${toCBDC}`;
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

  private async getLiquidityProviders(
    ctx: Context
  ): Promise<{ user: string; amount: number }[]> {
    // This function should fetch all liquidity providers and their contributions.
    // For simplicity, I'm returning an empty array. You need to implement this based on your data structure.
    return [];
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

    // Distribute fees if needed and update the user's liquidity position

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

    for (let i = 0; i < basket.Tokens.length; i++) {
      const removalAmount = (percentage / 100) * basket.Reserves[i];

      const tokenTransfer = await ctx.stub.invokeChaincode(
        basket.Tokens[i],
        ["Transfer", reserveWallet, user, removalAmount.toString()],
        "mychannel"
      );
      if (tokenTransfer.status !== 200) {
        throw new Error(`Transfer for ${basket.Tokens[i]} failed.`);
      }

      basket.Reserves[i] -= removalAmount;
    }

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
}
