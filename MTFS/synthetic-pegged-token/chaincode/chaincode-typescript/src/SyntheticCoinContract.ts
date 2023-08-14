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

const oracleContractName = "OracleContract"; // Assuming the name of the OracleContract when deployed

interface SyntheticCoin {
  user: string;
  amount: number;
}

@Info({
  title: "SyntheticCoinContract",
  description: "Smart contract for managing synthetic coins pegged to real-world assets",
})
export class SyntheticCoinContract extends Contract {

  @Transaction()
  public async MintSyntheticCoin(ctx: Context, user: string, asset: string, amount: number): Promise<void> {
    const priceResponse = await ctx.stub.invokeChaincode(
      oracleContractName,
      ["GetAssetPrice", asset],
      "mychannel"
    );
    if (priceResponse.status !== 200) {
      throw new Error(`Failed to fetch price for ${asset}`);
    }
    const assetPrice = parseFloat(priceResponse.payload.toString());

    const requiredCollateral = assetPrice * amount;

    // TODO: Check if the user has enough collateral to mint the synthetic coin.
    // Transfer the collateral from the user to the contract.

    const syntheticCoin: SyntheticCoin = {
      user: user,
      amount: amount,
    };

    await ctx.stub.putState(user, Buffer.from(JSON.stringify(syntheticCoin)));
  }

  @Transaction()
  public async BurnSyntheticCoin(ctx: Context, user: string, amount: number): Promise<void> {
    const syntheticCoinJSON = await ctx.stub.getState(user);
    if (!syntheticCoinJSON || syntheticCoinJSON.length === 0) {
      throw new Error(`No synthetic coins found for user ${user}`);
    }

    const syntheticCoin: SyntheticCoin = JSON.parse(syntheticCoinJSON.toString());

    if (syntheticCoin.amount < amount) {
      throw new Error("Not enough synthetic coins to burn.");
    }

    syntheticCoin.amount -= amount;

    // TODO: Return the collateral to the user based on the current asset price.

    await ctx.stub.putState(user, Buffer.from(JSON.stringify(syntheticCoin)));
  }

  @Transaction(false)
  @Returns("string")
  public async GetUserSyntheticCoins(ctx: Context, user: string): Promise<string> {
    const syntheticCoinJSON = await ctx.stub.getState(user);
    if (!syntheticCoinJSON || syntheticCoinJSON.length === 0) {
      return `No synthetic coins found for user ${user}`;
    }
    return syntheticCoinJSON.toString();
  }
}
