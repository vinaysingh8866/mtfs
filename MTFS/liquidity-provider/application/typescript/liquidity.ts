import { Gateway, Contract } from 'fabric-network';

class LiquidityPoolService {
    private gateway: Gateway;
    private contract: Contract;

    constructor(gateway: Gateway) {
        this.gateway = gateway;
    }

    async initialize() {
        const network = await this.gateway.getNetwork('mychannel');
        this.contract = network.getContract('LiquidityPool'); // Assuming 'LiquidityPool' is the name of the deployed contract
    }

    async init(): Promise<void> {
        await this.contract.submitTransaction('Init');
    }

    async addLiquidity(userId: string, amountA: string, amountB: string): Promise<boolean> {
        const result = await this.contract.submitTransaction('AddLiquidity', userId, amountA, amountB);
        return result.toString() === 'true';
    }

    async swap(userId: string, inputToken: string, amountIn: string): Promise<number> {
        const result = await this.contract.submitTransaction('Swap', userId, inputToken, amountIn);
        return parseFloat(result.toString());
    }

    async removeLiquidity(userId: string, lpAmount: string): Promise<boolean> {
        const result = await this.contract.submitTransaction('RemoveLiquidity', userId, lpAmount);
        return result.toString() === 'true';
    }

    async getReserve(token: string): Promise<number> {
        const result = await this.contract.evaluateTransaction('GetReserve', token);
        return parseFloat(result.toString());
    }
}

export default LiquidityPoolService;
