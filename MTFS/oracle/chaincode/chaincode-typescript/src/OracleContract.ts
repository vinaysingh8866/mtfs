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

@Info({
  title: "OracleContract",
  description: "Oracle Smart contract for managing currency prices",
})
export class OracleContract extends Contract {
  private static readonly AUTHORIZED_MSP = "TrustedOrgMSP"; // Replace with your authorized MSP ID

  @Transaction()
  public async Init(ctx: Context): Promise<void> {
    
  }

  @Transaction()
  public async AddCurrency(
    ctx: Context,
    currency: string,
    price: string
  ): Promise<void> {
    const mspid = ctx.clientIdentity.getMSPID();
    if (mspid !== OracleContract.AUTHORIZED_MSP) {
      throw new Error("You are not authorized to add a currency");
    }

    const existingPrice = await ctx.stub.getState(currency);
    if (existingPrice && existingPrice.length > 0) {
      throw new Error(`Currency ${currency} already exists`);
    }

    await ctx.stub.putState(currency, Buffer.from(price));
  }

  @Transaction()
  public async SetCurrencyPrice(
    ctx: Context,
    currency: string,
    price: string
  ): Promise<void> {
    const mspid = ctx.clientIdentity.getMSPID();
    if (mspid !== OracleContract.AUTHORIZED_MSP) {
      throw new Error("You are not authorized to set the price");
    }

    const existingPrice = await ctx.stub.getState(currency);
    if (!existingPrice || existingPrice.length === 0) {
      throw new Error(`Currency ${currency} does not exist`);
    }

    await ctx.stub.putState(currency, Buffer.from(price));
  }

  @Transaction(false)
  @Returns("string")
  public async GetCurrencyPrice(
    ctx: Context,
    currency: string
  ): Promise<string> {
    const price = await ctx.stub.getState(currency);
    if (!price || price.length === 0) {
      throw new Error(`No price set for currency: ${currency}`);
    }
    return price.toString();
  }
}
