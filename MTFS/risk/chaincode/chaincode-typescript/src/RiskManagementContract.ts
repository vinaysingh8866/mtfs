import { Context, Contract, Info, Returns, Transaction } from 'fabric-contract-api';

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

    // This is a placeholder. In reality, you'd compute volatility from historical data
    // or fetch it from some trusted source.
    @Transaction(false)
    @Returns('boolean')
    public async CheckAssetVolatility(ctx: Context): Promise<boolean> {
        // Here, you'd fetch volatility data for each asset and check if it's within acceptable bounds.
        // If any asset has too high volatility, return false.
        
        return true;  // assume all assets have acceptable volatility for now
    }

}
