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
//   import stringify from "json-stringify-deterministic";
  
  
  // Prefixes for composite keys
  const balancePrefix = "balance";
  const allowancePrefix = "allowance";
  // Keys for the ledger
  const nameKey = "name";
  const symbolKey = "symbol";
  const decimalsKey = "decimals";
  const totalSupplyKey = "totalSupply";
  @Info({
    title: "Token",
    description: "Smart contract for token management",
  })
  
  /**
   * @class
   * @throws {Error} when contract is not initialized
   * */
  export class Token extends Contract {
  
    /**
     * @param ctx the transaction context
     * @param name the name of the token
     * @param symbol the symbol of the token
     * @param decimals the number of decimals of the token
     * @public @transaction true
     */
    @Transaction()
    public async InitLedger(ctx: Context, name: String, symbol: String, decimals: String): Promise<boolean> {
      const nameBytes = await ctx.stub.getState(nameKey);
  
      if (nameBytes && nameBytes.length > 0) {
        throw new Error("Contract is already initialized");
      }
  
      await ctx.stub.putState(nameKey, Buffer.from(name));
      await ctx.stub.putState(symbolKey, Buffer.from(symbol));
      await ctx.stub.putState(decimalsKey, Buffer.from(decimals));
      return true;
    }
  
    /**
     * @param ctx the transaction context
     * @returns string the name of the token
     * @public @transaction false
     **/
    @Transaction(false)
    async TokenName(ctx: Context): Promise<string> {
      await this.CheckInitialized(ctx);
      const nameBytes = await ctx.stub.getState(nameKey);
      return nameBytes.toString();
    }
  
    /**
     * @param ctx the transaction context
     * @returns string the symbol of the token
     * @public @transaction false
     * */
    @Transaction(false)
    async TokenSymbol(ctx: Context): Promise<string> {
      await this.CheckInitialized(ctx);
      const symbolBytes = await ctx.stub.getState(symbolKey);
      return symbolBytes.toString();
    }
  
    /**
     * @param ctx the transaction context
     * @returns string the number of decimals of the token
     * @public @transaction false
     * */
    @Transaction(false)
    async TokenDecimals(ctx: Context): Promise<string> {
      await this.CheckInitialized(ctx);
      const decimalsBytes = await ctx.stub.getState(decimalsKey);
      return decimalsBytes.toString();
    }
    /**
     * @param ctx the transaction context
     * @returns string the total supply of the token
     * @public @transaction false
     * */
    @Transaction(false)
    async TotalSupply(ctx: Context): Promise<string> {
      await this.CheckInitialized(ctx);
      const totalSupplyBytes = await ctx.stub.getState(totalSupplyKey);
      return totalSupplyBytes.toString();
    }
  
    /**
     * @param ctx the transaction context
     * @param account the account to get the balance of
     * @returns string the balance of the account
     * @public @transaction false
     * */
    @Transaction(false)
    async BalanceOf(ctx: Context, account: string): Promise<string> {
      await this.CheckInitialized(ctx);
      const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [account]);
      const balanceBytes = await ctx.stub.getState(balanceKey);
      if (!balanceBytes || balanceBytes.length === 0) {
        throw new Error(`the account ${account} does not exist`);
      }
      return balanceBytes.toString();
    }
  
    /**
     * @param ctx the transaction context
     * @param owner the owner of the tokens
     * @param spender the spender of the tokens
     * @returns string the allowance of the spender for the owner
     * @public @transaction false
     * */
    @Transaction(false)
    async Allowance(
      ctx: Context,
      owner: string,
      spender: string
    ): Promise<string> {
      await this.CheckInitialized(ctx);
      const allowanceKey = ctx.stub.createCompositeKey(allowancePrefix, [
        owner,
        spender,
      ]);
      const allowanceBytes = await ctx.stub.getState(allowanceKey);
      if (!allowanceBytes || allowanceBytes.length === 0) {
        throw new Error(
          `the allowance for ${spender} from ${owner} does not exist`
        );
      }
      return allowanceBytes.toString();
    }
  
    /**
     * @param ctx the transaction context
     * @param to the account to transfer to
     * @param amount the amount to transfer
     * @param from the account to transfer from
     * @returns boolean true if the transfer was successful
     * @public @transaction true
     * */
    @Transaction(true)
    async Transfer(ctx: Context, from: string, to: string, amount: string): Promise<boolean> {
      await this.CheckInitialized(ctx);
      const transferResp = await this._transfer(ctx, from, to, amount);
      if (!transferResp) {
        throw new Error(`the transfer failed`);
      }
  
      const transferEvent = { from, to, amount };
      ctx.stub.setEvent("Transfer", Buffer.from(JSON.stringify(transferEvent)));
  
      return true;
  
    }
  
  
    /**
     * @param ctx the transaction context
     * @parm from the account to transfer from
     * @param to the account to transfer to
     * @param value the amount to transfer
     * @returns boolean true if the transfer was successful
     * @public @transaction true
     * */
    @Transaction(true)
    async TransferFrom(ctx: Context, from: string, to: string, value: string): Promise<boolean> {
      await this.CheckInitialized(ctx);
      const spender = ctx.clientIdentity.getID();
      const allowanceKey = ctx.stub.createCompositeKey(allowancePrefix, [from, spender]);
      const currentAllowanceBytes = await ctx.stub.getState(allowanceKey);
  
      if (!currentAllowanceBytes || currentAllowanceBytes.length === 0) {
        throw new Error(`spender ${spender} has no allowance from ${from}`);
      }
  
      const currentAllowance = parseInt(currentAllowanceBytes.toString());
      const valueInt = parseInt(value);
      if (currentAllowance < valueInt) {
        throw new Error('The spender does not have enough allowance to spend.');
      }
  
      const transferResp = await this._transfer(ctx, from, to, value);
      if (!transferResp) {
        throw new Error('Failed to transfer');
      }
  
      const updatedAllowance = this.sub(currentAllowance, valueInt);
      await ctx.stub.putState(allowanceKey, Buffer.from(updatedAllowance.toString()));
      console.log(`spender ${spender} allowance updated from ${currentAllowance} to ${updatedAllowance}`);
  
      const transferEvent = { from, to, value: valueInt };
      ctx.stub.setEvent('Transfer', Buffer.from(JSON.stringify(transferEvent)));
      console.log('transferFrom ended successfully');
      return true;
    }
  
    /**
     * @param ctx the transaction context
     * @param to the account to mint to
     * @param amount the amount to mint
     * @returns boolean true if the mint was successful
     * @event Mint the mint event emitted when a mint is successful
     * @public @transaction true
     * */
    @Transaction(true)
    async Mint(ctx: Context, to: string, amount: string): Promise<boolean> {
      await this.CheckInitialized(ctx);
      const minter = ctx.clientIdentity.getID();
  
      // Get the state from the ledger
      const totalSupplyBytes = await ctx.stub.getState(totalSupplyKey);
      const totalSupply = parseInt(totalSupplyBytes.toString(), 10);
      //check if total supply exists
      let tSupply = 0;
      if (!totalSupplyBytes || totalSupplyBytes.length === 0) {
        tSupply = 0;
      }
      else {
        tSupply = totalSupply;
      }
  
      const toBalanceKey = ctx.stub.createCompositeKey(balancePrefix, [to]);
      const toBalanceBytes = await ctx.stub.getState(toBalanceKey);
  
      const toBalance = parseInt(toBalanceBytes.toString(), 10);
      let balance = 0;
      if (!toBalanceBytes || toBalanceBytes.length === 0) {
        balance = 0;
      }
      else {
        balance = toBalance;
      }
  
  
      // Calculate the new balance
      const newTotalSupply = tSupply + parseInt(amount, 10);
      const newToBalance = balance + parseInt(amount, 10);
  
      // Write the states back to the ledger
      await ctx.stub.putState(totalSupplyKey, Buffer.from(newTotalSupply.toString()));
      await ctx.stub.putState(toBalanceKey, Buffer.from(newToBalance.toString()));
  
      const mintEvent = { to, amount };
      ctx.stub.setEvent("Mint", Buffer.from(JSON.stringify(mintEvent)));
  
      return true;
    }
  
    /**
     * @param ctx the transaction context
     * @param from the account to burn from
     * @param amount the amount to burn
     * @returns boolean true if the burn was successful
     * @event Burn the burn event emitted when a burn is successful
     * @public @transaction true
     * */
    @Transaction(true)
    async Burn(ctx: Context, from: string, amount: string): Promise<boolean> {
      await this.CheckInitialized(ctx);
  
      const totalSupplyBytes = await ctx.stub.getState(totalSupplyKey);
      const totalSupply = parseInt(totalSupplyBytes.toString(), 10);
      const fromBalanceKey = ctx.stub.createCompositeKey(balancePrefix, [from]);
      const fromBalanceBytes = await ctx.stub.getState(fromBalanceKey);
      const fromBalance = parseInt(fromBalanceBytes.toString(), 10);
      const newTotalSupply = totalSupply - parseInt(amount, 10);
      const newFromBalance = fromBalance - parseInt(amount, 10);
  
      await ctx.stub.putState(totalSupplyKey, Buffer.from(newTotalSupply.toString()));
      await ctx.stub.putState(fromBalanceKey, Buffer.from(newFromBalance.toString()));
  
      const burnEvent = { from, amount };
      ctx.stub.setEvent("Burn", Buffer.from(JSON.stringify(burnEvent)));
  
      return true;
    }
  
    /**
     * @param ctx the transaction context
     * @param from the from account
     * @param to the to account
     * @param value the value to transfer
     * @returns boolean true if the transfer was successful
     * */
    async _transfer(ctx: Context, from: string, to: string, value: string): Promise<boolean> {
  
      if (from === to) {
        throw new Error('cannot transfer to and from same client account');
      }
  
      // Convert value from string to int
      const valueInt = parseInt(value);
  
      if (valueInt < 0) { // transfer of 0 is allowed in ERC20, so just validate against negative amounts
        throw new Error('transfer amount cannot be negative');
      }
  
      // Retrieve the current balance of the sender
      const fromBalanceKey = ctx.stub.createCompositeKey(balancePrefix, [from]);
      const fromCurrentBalanceBytes = await ctx.stub.getState(fromBalanceKey);
  
      if (!fromCurrentBalanceBytes || fromCurrentBalanceBytes.length === 0) {
        throw new Error(`client account ${from} has no balance`);
      }
  
      const fromCurrentBalance = parseInt(fromCurrentBalanceBytes.toString());
  
      // Check if the sender has enough tokens to spend.
      if (fromCurrentBalance < valueInt) {
        throw new Error(`client account ${from} has insufficient funds.`);
      }
  
      // Retrieve the current balance of the recepient
      const toBalanceKey = ctx.stub.createCompositeKey(balancePrefix, [to]);
      const toCurrentBalanceBytes = await ctx.stub.getState(toBalanceKey);
  
      let toCurrentBalance: number;
      // If recipient current balance doesn't yet exist, we'll create it with a current balance of 0
      if (!toCurrentBalanceBytes || toCurrentBalanceBytes.length === 0) {
        toCurrentBalance = 0;
      } else {
        toCurrentBalance = parseInt(toCurrentBalanceBytes.toString());
      }
  
      // Update the balance
      const fromUpdatedBalance = this.sub(fromCurrentBalance, valueInt);
  
      const toUpdatedBalance = this.add(toCurrentBalance, valueInt);
  
      await ctx.stub.putState(fromBalanceKey, Buffer.from(fromUpdatedBalance.toString()));
      console.log(`client ${from} balance updated from ${fromCurrentBalance} to ${fromUpdatedBalance}`);
      await ctx.stub.putState(toBalanceKey, Buffer.from(toUpdatedBalance.toString()));
      console.log(`recipient ${to} balance updated from ${toCurrentBalance} to ${toUpdatedBalance}`);
  
  
      return true;
    }
  
    // add two number checking for overflow
    add(a: number, b: number) {
      let c = a + b;
      if (a !== c - b || b !== c - a) {
        throw new Error(`Math: addition overflow occurred ${a} + ${b}`);
      }
      return c;
    }
  
    // subtract two number checking for overflow
    sub(a: number, b: number) {
      let c = a - b;
      if (a !== c + b || b !== a - c) {
        throw new Error(`Math: subtraction overflow occurred ${a} - ${b}`);
      }
      return c;
    }
  
  
    /**
     * @param ctx the transaction context
     * @returns boolean true if the contract is initialized
     **/
    @Transaction(false)
    async CheckInitialized(ctx: Context): Promise<boolean> {
      const nameBytes = await ctx.stub.getState(nameKey);
      if (!nameBytes || nameBytes.length === 0) {
        throw new Error('contract options need to be set before calling any function, call Initialize() to initialize contract');
      }
      return true;
    }
  }

  