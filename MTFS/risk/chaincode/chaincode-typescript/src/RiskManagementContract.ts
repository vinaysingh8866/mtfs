import { Context, Contract, Info, Returns, Transaction } from 'fabric-contract-api';

interface Basket {
    docType?: string;
    ID: string;
    TokenAmount: number;
    Tokens: string[];
    Reserves: number[];
    Buffers: number[];
    Weights: number[];
    Prices: number[];
  }
  
@Info({ title: 'RiskManagement', description: 'Risk management chaincode for the basket contract' })
export class RiskManagementContract extends Contract {

    // Check if any reserve is below the threshold
    @Transaction(false)
    @Returns('boolean')
    public async CheckReserveThreshold(ctx: Context, threshold: number = 5000): Promise<boolean> {
        const basketJSON = await ctx.stub.getState('basket1');
        if (!basketJSON || basketJSON.length === 0) {
            throw new Error('The basket "basket1" does not exist');
        }

        const basket = JSON.parse(basketJSON.toString());
        
        for (const reserve of basket.Reserves) {
            if (reserve < threshold) {
                return false;  // reserve is below threshold
            }
        }

        return true;  // all reserves are above the threshold
    }

    // Check if the basket is overexposed to a single asset
    @Transaction(false)
    @Returns('boolean')
    public async CheckBasketExposure(ctx: Context, exposureLimit: number = 0.5): Promise<boolean> {
        const basketJSON = await ctx.stub.getState('basket1');
        const basket = JSON.parse(basketJSON.toString());

        const totalValue = basket.Reserves.reduce((a, b) => a + b, 0);
        
        for (const reserve of basket.Reserves) {
            if (reserve / totalValue > exposureLimit) {
                return false;  // overexposed to one asset
            }
        }

        return true;  // no overexposure detected
    }

  
    @Transaction(false)
    @Returns('boolean')
    public async CheckAssetVolatility(ctx: Context, volatilityThreshold: number = 0.05, oracleContractName): Promise<boolean> {
        const basketJSON = await ctx.stub.getState('basket1');
        const basket: Basket = JSON.parse(basketJSON.toString());
    
        for (let i = 0; i < basket.Tokens.length; i++) {
            const currentPriceResponse = await ctx.stub.invokeChaincode(
                oracleContractName,
                ["GetCurrencyPrice", basket.Tokens[i]],
                "mychannel"
            );
            const previousPriceResponse = await ctx.stub.invokeChaincode(
                oracleContractName,
                ["GetPreviousCurrencyPrice", basket.Tokens[i]],
                "mychannel"
            );
    
            if (currentPriceResponse.status !== 200 || previousPriceResponse.status !== 200) {
                throw new Error(`Failed to fetch prices for ${basket.Tokens[i]}`);
            }
    
            const currentPrice = parseFloat(currentPriceResponse.payload.toString());
            const previousPrice = parseFloat(previousPriceResponse.payload.toString());
    
            const change = Math.abs((currentPrice - previousPrice) / previousPrice);
            if (change > volatilityThreshold) {
                return false;  // Asset is volatile
            }
        }
    
        return true;  // No assets found to be volatile
    }
    

}
