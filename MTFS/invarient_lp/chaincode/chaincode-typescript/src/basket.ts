/*
  SPDX-License-Identifier: Apache-2.0
*/

import { Object, Property } from "fabric-contract-api";


@Object()
export class Basket {
  @Property()
  public docType?: string;

  @Property()
  public ID: string;

  @Property()
  public TokenAmount: number;

  @Property()
  public Tokens: string[];

  @Property()
  public Reserves: number[];

  @Property()
  public Buffers: number[];

  @Property()
  public Weights: number[];

  @Property()
  public Prices: number[];
}
