/*
  SPDX-License-Identifier: Apache-2.0
*/

import {Object, Property} from 'fabric-contract-api';

@Object()
export class Order {
    @Property()
    public docType?: string;

    @Property()
    public OrderId: string;

    @Property()
    public Amount: string;

    @Property()
    public Account: string;

    @Property()
    public Owner: string;

    @Property()
    public Status: string;
}


@Object()
export class CustomOrder{
    @Property()
    public docType?: string;

    @Property()
    public OrderId: string;

    @Property()
    public Amount: string;

    @Property()
    public Account: string;

    @Property()
    public Owners: string[];

    @Property()
    public OwnerShares: string[];

    @Property()
    public Status: string;

    @Property()
    public CustomTransferOnEvent: string[];
}