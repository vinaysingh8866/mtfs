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

interface LiquidityProvider {
    user: string;
    amount: number;
    earnedFees: number;  // New field to store earned fees
}

@Info({
  title: "LiquidityProviderContract",
  description: "Smart contract for managing liquidity providers",
})
export class LiquidityProviderContract extends Contract {
  @Transaction()
  public async AddLiquidityProvider(
    ctx: Context,
    user: string,
    amount: number
  ): Promise<void> {
    const provider: LiquidityProvider = {
      user,
      amount,
        earnedFees: 0,  // Initialize earned fees to 0
    };

    await ctx.stub.putState(user, Buffer.from(JSON.stringify(provider)));
  }

  @Transaction()
    public async UpdateEarnedFees(ctx: Context, user: string, fee: number): Promise<void> {
        const providerData = await ctx.stub.getState(user);
        if (!providerData || providerData.length === 0) {
            throw new Error(`Liquidity provider ${user} does not exist`);
        }

        const provider: LiquidityProvider = JSON.parse(providerData.toString());
        provider.earnedFees += fee;  // Update the earned fees

        await ctx.stub.putState(user, Buffer.from(JSON.stringify(provider)));
    }

  @Transaction()
  public async UpdateLiquidityProvider(
    ctx: Context,
    user: string,
    newAmount: number
  ): Promise<void> {
    const providerData = await ctx.stub.getState(user);
    if (!providerData || providerData.length === 0) {
      throw new Error(`Liquidity provider ${user} does not exist`);
    }

    const provider: LiquidityProvider = JSON.parse(providerData.toString());
    provider.amount = newAmount;

    await ctx.stub.putState(user, Buffer.from(JSON.stringify(provider)));
  }

  @Transaction(false)
  @Returns("LiquidityProvider")
  public async GetLiquidityProvider(
    ctx: Context,
    user: string
  ): Promise<LiquidityProvider> {
    const providerData = await ctx.stub.getState(user);
    if (!providerData || providerData.length === 0) {
      throw new Error(`Liquidity provider ${user} does not exist`);
    }

    return JSON.parse(providerData.toString());
  }

  @Transaction(false)
  @Returns("LiquidityProvider[]")
  public async GetAllLiquidityProviders(
    ctx: Context
  ): Promise<LiquidityProvider[]> {
    const providers: LiquidityProvider[] = [];

    const iterator = await ctx.stub.getStateByRange("", "");
    let result = await iterator.next();
    while (!result.done) {
      const provider: LiquidityProvider = JSON.parse(
        result.value.value.toString()
      );
      providers.push(provider);
      result = await iterator.next();
    }

    return providers;
  }
}
