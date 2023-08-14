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
import stringify from "json-stringify-deterministic";
import sortKeysRecursive from "sort-keys-recursive";
import { Order, CustomOrder } from "./order";


// Prefixes for composite keys
const balancePrefix = "balance";
const allowancePrefix = "allowance";
const orderListPrefix = "orderList";
// Keys for the ledger
const nameKey = "name";
const symbolKey = "symbol";
const decimalsKey = "decimals";
const totalSupplyKey = "totalSupply";
const escrowKey = "escrow";
@Info({
  title: "PayCrow",
  description: "Smart contract for Escrow Trades",
})

/**
 * @class
 * @throws {Error} when contract is not initialized
 * */
export class PayCrow extends Contract {

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
    const Orders: Order[] = [
      {
        OrderId: "0000",
        Amount: "100",
        Account: "TEST2",
        Owner: "TEST1",
        Status: "Pending",
      },
    ];

    for (const Order of Orders) {
      Order.docType = "Order";
      await ctx.stub.putState(
        Order.OrderId,
        Buffer.from(stringify(sortKeysRecursive(Order)))
      );
      console.info(`Order ${Order.OrderId} initialized`);
    }
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
    ctx.stub.setEvent("Transfer", Buffer.from(stringify(transferEvent)));

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
    ctx.stub.setEvent("Mint", Buffer.from(stringify(mintEvent)));

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
    ctx.stub.setEvent("Burn", Buffer.from(stringify(burnEvent)));

    return true;
  }


  /**
   * @param ctx the transaction context
   * @param orderId the order id
   * @param amount the amount to be paid
   * @param owner the owner of the order
   * @param seller the seller of the order
   * @returns boolean true if the order was created successfully
   * @event CreateOrder the create order event emitted when an order is created
   * @public @transaction true
   * */
  @Transaction()
  public async CreateOrder(
    ctx: Context,
    orderId: string,
    amount: string,
    owner: string,
    seller: string
  ): Promise<boolean> {
    await this.CheckInitialized(ctx);
    const ownerBalance = await this.BalanceOf(ctx, owner);
    if (parseInt(ownerBalance) < parseInt(amount, 10)) {
      throw new Error(`the balance for ${owner} is not enough`);
    }
    const exists = await this.OrderExists(ctx, orderId);
    if (exists) {
      throw new Error(`The Order ${orderId} already exists`);
    }
    const order: Order = {
      OrderId: orderId,
      Amount: amount,
      Owner: owner,
      Account: seller,
      Status: 'Pending',
    };
    await ctx.stub.putState(
      orderId,
      Buffer.from(stringify(sortKeysRecursive(order)))
    );

    const transferResp = await this._transfer(ctx, owner, escrowKey, amount);
    if (!transferResp) {
      throw new Error('Failed to transfer');
    }

    const sellerOrderListKey = ctx.stub.createCompositeKey(orderListPrefix, [seller]);
    const sellerOrderListBytes = await ctx.stub.getState(sellerOrderListKey);
    let orderList = [];
    if (!sellerOrderListBytes || sellerOrderListBytes.length === 0) {
      orderList = [];
    }
    else {
      orderList = JSON.parse(sellerOrderListBytes.toString());
    }
    orderList.push(orderId);
    await ctx.stub.putState(sellerOrderListKey, Buffer.from(stringify(sortKeysRecursive(orderList))));


    const ownerOrderListKey = ctx.stub.createCompositeKey(orderListPrefix, [owner]);
    const ownerOrderListBytes = await ctx.stub.getState(ownerOrderListKey);
    let ownerOrderList = [];
    if (!ownerOrderListBytes || ownerOrderListBytes.length === 0) {
      ownerOrderList = [];
    }
    else {
      ownerOrderList = JSON.parse(ownerOrderListBytes.toString());
    }
    ownerOrderList.push(orderId);
    await ctx.stub.putState(ownerOrderListKey, Buffer.from(stringify(sortKeysRecursive(ownerOrderList))));
    const createOrderEvent = { orderId, amount, owner, seller };
    ctx.stub.setEvent("CreateOrder", Buffer.from(stringify(createOrderEvent)));
    return true;
  }

  /**
   * @param ctx the transaction context
   * @param account the account to get the order list
   * @returns string the order list
   * @public @transaction false
   * */
  @Transaction(false)
  public async GetOrderList(ctx: Context, account: string): Promise<string> {
    const orderListKey = ctx.stub.createCompositeKey(orderListPrefix, [account]);
    const orderListBytes = await ctx.stub.getState(orderListKey);
    if (!orderListBytes || orderListBytes.length === 0) {
      throw new Error(`the order list for ${account} does not exist`);
    }
    return orderListBytes.toString();
  }


  /**
   * @param ctx the transaction context
   * @param id the order id
   * @returns string the order
   * @public @transaction false
   * */

  @Transaction(false)
  public async ReadOrder(ctx: Context, id: string): Promise<string> {
    const orderJSON = await ctx.stub.getState(id); // get the Order from chaincode state
    if (!orderJSON || orderJSON.length === 0) {
      throw new Error(`The Order ${id} does not exist`);
    }
    return orderJSON.toString();
  }


  /**
   * @param ctx the transaction context
   * @param id the order id
   * @returns boolean true if the order was approved successfully
   * @event ApproveOrder the approve order event emitted when an order is approved
   * @public @transaction true
   * */

  @Transaction()
  public async ApproveOrder(
    ctx: Context,
    id: string,
  ): Promise<boolean> {
    await this.CheckInitialized(ctx);
    const exists = await this.OrderExists(ctx, id);
    if (!exists) {
      throw new Error(`The Order ${id} does not exist`);
    }

    const orderJSON = await ctx.stub.getState(id);
    const order = JSON.parse(orderJSON.toString()) as Order;
    if (order.Status === 'Pending') {
      order.Status = "Approved";
    }
    else {
      throw new Error(`The Order ${id} is not in pending state`);
    }
    ctx.stub.putState(
      id,
      Buffer.from(stringify(sortKeysRecursive(order)))
    );
    const approveOrderEvent = { orderId: id };
    ctx.stub.setEvent("ApproveOrder", Buffer.from(stringify(approveOrderEvent)));
    return true;
  }


  /**
   * @param ctx the transaction context
   * @param id the order id
   * @returns boolean true if the order was accepted successfully
   * @event AcceptOrder the accept order event emitted when an order is accepted
   * @public @transaction true
   * */
  @Transaction()
  public async ProcessOrder(
    ctx: Context,
    id: string,
  ): Promise<boolean> {
    await this.CheckInitialized(ctx);
    const exists = await this.OrderExists(ctx, id);
    if (!exists) {
      throw new Error(`The Order ${id} does not exist`);
    }

    const orderJSON = await ctx.stub.getState(id);
    const order = JSON.parse(orderJSON.toString()) as Order;
    if (order.Status === 'Approved') {
      order.Status = "Processing";
    }
    else {
      throw new Error(`The Order ${id} is not in approved state`);
    }
    ctx.stub.putState(
      id,
      Buffer.from(stringify(sortKeysRecursive(order)))
    );
    const acceptOrderEvent = { orderId: id };
    ctx.stub.setEvent("AcceptOrder", Buffer.from(stringify(acceptOrderEvent)));
    return true;
  }

  /**
   * @param ctx the transaction context
   * @param id the order id
   * @returns boolean true if the order was completed successfully
   * @event CompleteOrder the complete order event emitted when an order is completed
   * @public @transaction true
   * */
  @Transaction()
  public async CompleteOrder(
    ctx: Context,
    id: string,
  ): Promise<boolean> {
    await this.CheckInitialized(ctx);
    const exists = await this.OrderExists(ctx, id);
    if (!exists) {
      throw new Error(`The Order ${id} does not exist`);
    }

    const orderJSON = await ctx.stub.getState(id);
    const order = JSON.parse(orderJSON.toString()) as Order;
    if (order.Status === 'Processing') {
      order.Status = "Completed";
    }
    else {
      throw new Error(`The Order ${id} is not in processing state`);
    }
    ctx.stub.putState(
      id,
      Buffer.from(stringify(sortKeysRecursive(order)))
    );
    const completeOrderEvent = { orderId: id };
    ctx.stub.setEvent("CompleteOrder", Buffer.from(stringify(completeOrderEvent)));
    return true;
  }

  /**
   * @param ctx the transaction context
   * @param id the order id
   * @returns boolean true if the escrow was completed successfully
   * @public @transaction true
   * */
  @Transaction()
  public async CompleteEscrow(
    ctx: Context,
    id: string,
  ): Promise<boolean> {
    await this.CheckInitialized(ctx);
    const exists = await this.OrderExists(ctx, id);
    if (!exists) {
      throw new Error(`The Order ${id} does not exist`);
    }

    const orderJSON = await ctx.stub.getState(id);
    const order = JSON.parse(orderJSON.toString()) as Order;
    if (order.Status !== "Completed") {
      throw new Error(`The Order ${id} is not completed`);
    }
    const seller = order.Account;
    const amount = order.Amount;
    const transferResp = await this.Transfer(ctx, escrowKey, seller, amount);
    if (!transferResp) {
      throw new Error(`Failed to transfer money to seller`);
    }

    order.Status = "EscrowCompleted";
    ctx.stub.putState(
      id,
      Buffer.from(stringify(sortKeysRecursive(order)))
    );

    const completeEscrowEvent = { orderId: id };
    ctx.stub.setEvent("CompleteEscrow", Buffer.from(stringify(completeEscrowEvent)));
    return true;
  }

  /**
   * @param ctx the transaction context
   * @param id the order id
   * @returns boolean true if the order was deleted successfully
   * @event DeleteOrder the delete order event emitted when an order is deleted
   * @public @transaction true
   * */
  @Transaction()
  public async DeleteOrder(ctx: Context, id: string): Promise<void> {
    //check if contract is initialized
    await this.CheckInitialized(ctx);
    const exists = await this.OrderExists(ctx, id);
    if (!exists) {
      throw new Error(`The Order ${id} does not exist`);
    }
    return ctx.stub.deleteState(id);
  }


  /**
   * @param ctx the transaction context
   * @param id the order id
   * @returns boolean true if the order exists
   * @public @transaction false
   * */
  @Transaction(false)
  @Returns("boolean")
  public async OrderExists(ctx: Context, id: string): Promise<boolean> {
    //check if contract is initialized
    await this.CheckInitialized(ctx);
    const orderJSON = await ctx.stub.getState(id);
    return orderJSON && orderJSON.length > 0;
  }

  /**
   * @param ctx the transaction context
   * @returns all orders
   * @public @transaction false
   * */
  @Transaction(false)
  @Returns("string")
  public async GetAllOrders(ctx: Context): Promise<string> {
    await this.CheckInitialized(ctx);
    const allResults = [];
    const iterator = await ctx.stub.getStateByRange("", "");
    let result = await iterator.next();
    while (!result.done) {
      const strValue = Buffer.from(result.value.value.toString()).toString(
        "utf8"
      );
      let record: string;
      try {
        record = JSON.parse(strValue);
      } catch (err) {
        console.log(err);
        record = strValue;
      }
      allResults.push(record);
      result = await iterator.next();
    }
    return JSON.stringify(allResults);
  }

  /**
   * @param ctx the transaction context
   * @param id the order id
   * @param seller the seller account
   * @param amount the amount to be escrowed
   * @param buyers string of comma separated buyer accounts
   * @param shares string of comma separated shares
   * @param customTranfer string of comma separated custom transfer on event
   * @returns boolean true if the order was created successfully
   * @event CreateCustomEscrowOrder the create custom escrow order event emitted when an order is created
   **/
  @Transaction()
  public async CreateCustomEscrowOrder(ctx: Context,
    id: string,
    seller: string,
    amount: string,
    buyers: string,
    shares: string,
    customTranfer: string): Promise<boolean> {
    await this.CheckInitialized(ctx);
    const exists = await this.OrderExists(ctx, id);
    if (exists) {
      throw new Error(`The Order ${id} already exists`);
    }
    const Owners = buyers.split(",");
    const OwnerShares = shares.split(",");
    const CustomTransferOnEvent = customTranfer.split(",");

    const order: CustomOrder = {
      OrderId: id,
      Account: seller,
      Amount: amount,
      Owners: Owners,
      OwnerShares: OwnerShares,
      Status: "Pending",
      CustomTransferOnEvent: CustomTransferOnEvent
    };
    ctx.stub.putState(
      id,
      Buffer.from(stringify(order))
    );

    for (const owner in Owners) {
      const buyerOrderListKey = ctx.stub.createCompositeKey(orderListPrefix, [Owners[owner]]);
      const buyerOrderListBytes = await ctx.stub.getState(buyerOrderListKey);
      let orderList = [];
      if (!buyerOrderListBytes || buyerOrderListBytes.length === 0) {
        orderList = [];
      }
      else {
        orderList = JSON.parse(buyerOrderListBytes.toString());
      }
      orderList.push(id);
      await ctx.stub.putState(buyerOrderListKey, Buffer.from(stringify(orderList)));
    }
    let tot = 0;

    for (const shares in OwnerShares) {
      //transfer money to escrow
      const fromBalanceKey = ctx.stub.createCompositeKey(balancePrefix, [Owners[shares]]);
      const fromCurrentBalanceBytes = await ctx.stub.getState(fromBalanceKey);

      if (!fromCurrentBalanceBytes || fromCurrentBalanceBytes.length === 0) {
        throw new Error(`client account ${[Owners[shares]]} has no balance`);
      }

      const fromCurrentBalance = parseInt(fromCurrentBalanceBytes.toString());

      // Check if the sender has enough tokens to spend.
      if (fromCurrentBalance < parseInt(OwnerShares[shares])) {
        throw new Error(`client account ${Owners[shares]} has insufficient funds.`);
      }

      // Subtract the amount from the sender.
      const fromNewBalance = fromCurrentBalance - parseInt(OwnerShares[shares]);
      await ctx.stub.putState(fromBalanceKey, Buffer.from(fromNewBalance.toString()));

      tot += parseInt(OwnerShares[shares]);
    }

    const toBalanceKey = ctx.stub.createCompositeKey(balancePrefix, [escrowKey]);
    const toCurrentBalanceBytes = await ctx.stub.getState(toBalanceKey);
    let toCurrentBalance = 0;
    if (toCurrentBalanceBytes && toCurrentBalanceBytes.length > 0) {
      toCurrentBalance = parseInt(toCurrentBalanceBytes.toString());
    }
    const toNewBalance = toCurrentBalance + tot;

    await ctx.stub.putState(toBalanceKey, Buffer.from(toNewBalance.toString()));

    const sellerOrderListKey = ctx.stub.createCompositeKey(orderListPrefix, [seller]);
    const sellerOrderListBytes = await ctx.stub.getState(sellerOrderListKey);
    let orderList = [];
    if (!sellerOrderListBytes || sellerOrderListBytes.length === 0) {
      orderList = [];
    }
    else {
      orderList = JSON.parse(sellerOrderListBytes.toString());
    }
    orderList.push(id);
    await ctx.stub.putState(sellerOrderListKey, Buffer.from(stringify(orderList)));
    const createOrderEvent = { id, amount, seller, buyers, shares };
    ctx.stub.setEvent("CreateOrder", Buffer.from(stringify(createOrderEvent)));
    return true;

  }

  /**
   * @param ctx the transaction context
   * @param id the order id
   * @returns boolean true if the order was approved successfully
   * @event ApproveCustomEscrowOrder the approve custom escrow order event emitted when an order is approved
   * @event Transfer the transfer event emitted when an order is approved
   **/
  @Transaction()
  public async ApproveCustomEscrowOrder(ctx: Context, id: string): Promise<boolean> {
    await this.CheckInitialized(ctx);
    const exists = await this.OrderExists(ctx, id);
    if (!exists) {
      throw new Error(`The Order ${id} does not exist`);
    }

    const orderJSON = await ctx.stub.getState(id);
    const order = JSON.parse(orderJSON.toString()) as CustomOrder;
    if (String(order.Status) === String("Pending")) {
      order.Status = "Approved";
    }
    else {
      throw new Error(`The Order ${id} is not pending`);
    }
    const seller = order.Account;
    const amountToTransferOnEvent = order.CustomTransferOnEvent[0];
    if (amountToTransferOnEvent !== "0") {
      const transferResp = await this.Transfer(ctx, escrowKey, seller, amountToTransferOnEvent);
      if (!transferResp) {
        throw new Error(`Failed to transfer money to seller`);
      }
    }

    ctx.stub.putState(
      id,
      Buffer.from(stringify(order))
    );
    const approveOrderEvent = { orderId: id };
    ctx.stub.setEvent("ApproveOrder", Buffer.from(stringify(approveOrderEvent)));
    return true;
  }


  /**
   * @param ctx the transaction context
   * @param id the order id
   * @returns boolean true if the order was processed successfully
   * @event ProcessCustomEscrowOrder the process custom escrow order event emitted when an order is processed
   * @event Transfer the transfer event emitted when an order is processed
   **/
  @Transaction()
  public async ProcessCustomEscrowOrder(ctx: Context, id: string): Promise<boolean> {
    await this.CheckInitialized(ctx);
    const exists = await this.OrderExists(ctx, id);
    if (!exists) {
      throw new Error(`The Order ${id} does not exist`);
    }

    const orderJSON = await ctx.stub.getState(id);
    const order = JSON.parse(orderJSON.toString()) as CustomOrder;
    if (order.Status === "Approved") {
      order.Status = "Processed";
    }
    else {
      throw new Error(`The Order ${id} is not approved`);
    }
    const amountToTransferOnEvent = order.CustomTransferOnEvent[1];
    if (amountToTransferOnEvent !== "0") {
      const transferResp = await this.Transfer(ctx, escrowKey, order.Account, amountToTransferOnEvent);
      if (!transferResp) {
        throw new Error(`Failed to transfer money to seller`);
      }
    }

    ctx.stub.putState(
      id,
      Buffer.from(stringify(order))
    );
    const processOrderEvent = { orderId: id };
    ctx.stub.setEvent("ProcessOrder", Buffer.from(stringify(processOrderEvent)));
    return true;
  }

  /**
   * @param ctx the transaction context
   * @param id the order id
   * @returns boolean true if the order was completed successfully
   * @event CompleteCustomEscrowOrder the complete custom escrow order event emitted when an order is completed
   * @event Transfer the transfer event emitted when an order is completed
   **/
  @Transaction()
  public async CompleteCustomEscrowOrder(ctx: Context, id: string): Promise<boolean> {
    await this.CheckInitialized(ctx);
    const exists = await this.OrderExists(ctx, id);
    if (!exists) {
      throw new Error(`The Order ${id} does not exist`);
    }

    const orderJSON = await ctx.stub.getState(id);
    const order = JSON.parse(orderJSON.toString()) as CustomOrder;
    if (order.Status === "Processed") {
      order.Status = "Completed";
    }
    else {
      throw new Error(`The Order ${id} is not processed`);
    }
    const amountToTransferOnEvent = order.CustomTransferOnEvent[2];
    if (amountToTransferOnEvent !== "0") {
      const transferResp = await this.Transfer(ctx, escrowKey, order.Account, amountToTransferOnEvent);
      if (!transferResp) {
        throw new Error(`Failed to transfer money to seller`);
      }
    }

    ctx.stub.putState(
      id,
      Buffer.from(stringify(order))
    );
    const completeOrderEvent = { orderId: id };
    ctx.stub.setEvent("CompleteOrder", Buffer.from(stringify(completeOrderEvent)));
    return true;
  }

  /**
   * @param ctx the transaction context
   * @param id the order id
   * @returns boolean true if the order was accepted successfully
   * @event AcceptCustomEscrowOrder the accept custom escrow order event emitted when an order is accepted
   * @event Transfer the transfer event emitted when an order is accepted
   **/
  @Transaction()
  public async AcceptOrderDelivery(ctx: Context, id: string): Promise<boolean> {
    await this.CheckInitialized(ctx);
    const exists = await this.OrderExists(ctx, id);
    if (!exists) {
      throw new Error(`The Order ${id} does not exist`);
    }

    const orderJSON = await ctx.stub.getState(id);
    const order = JSON.parse(orderJSON.toString()) as CustomOrder;
    if (order.Status === "Completed") {
      order.Status = "EscrowCompleted";
    }
    else {
      throw new Error(`The Order ${id} is not completed`);
    }

    const amountToTransferOnEvent = order.CustomTransferOnEvent[3];

    if (amountToTransferOnEvent !== "0") {
      const transferResp = await this.Transfer(ctx, escrowKey, order.Account, amountToTransferOnEvent);
      if (!transferResp) {
        throw new Error(`Failed to transfer money to seller`);
      }
    }

    ctx.stub.putState(
      id,
      Buffer.from(stringify(order))
    );
    const acceptOrderEvent = { orderId: id };
    ctx.stub.setEvent("AcceptOrder", Buffer.from(stringify(acceptOrderEvent)));
    return true;
  }

  /**
   * @param ctx the transaction context
   * @returns string the escrow balance
   **/
  @Transaction(false)
  public async EscrowBalance(ctx: Context): Promise<string> {
    const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [escrowKey]);
    const balanceBytes = await ctx.stub.getState(balanceKey);
    if (!balanceBytes || balanceBytes.length === 0) {
      throw new Error(`The escrow account ${escrowKey} has no balance`);
    }
    return balanceBytes.toString();
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
