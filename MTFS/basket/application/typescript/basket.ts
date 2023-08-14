import { Gateway, Contract } from 'fabric-network';

export class BasketService {
    private gateway: Gateway;
    private contract: Contract;

    constructor(gateway: Gateway) {
        this.gateway = gateway;
    }

    async initialize() {
        const network = await this.gateway.getNetwork('mychannel');
        this.contract = network.getContract('BasketContract'); // Assuming 'BasketContract' is the name of the deployed contract
    }

    async initBasket(): Promise<void> {
        await this.contract.submitTransaction('InitBasket');
    }

    async readBasket(): Promise<string> {
        const result = await this.contract.evaluateTransaction('ReadBasket');
        return result.toString();
    }

    async updateBasketPrices(): Promise<void> {
        await this.contract.submitTransaction('UpdateBasketPrices');
    }

    async cbdcToStablecoin(amount: string, cbdc: string, user: string): Promise<string> {
        const result = await this.contract.submitTransaction('CBDCToStablecoin', amount, cbdc, user);
        return result.toString();
    }

    async updateReserves(updatedReserves: string[]): Promise<void> {
        await this.contract.submitTransaction('UpdateReserves', ...updatedReserves);
    }

    async swapCBDCs(amount: number, fromCBDC: string, toCBDC: string, user: string): Promise<string> {
        const result = await this.contract.submitTransaction('SwapCBDCs', amount.toString(), fromCBDC, toCBDC, user);
        return result.toString();
    }

    async addLiquidity(amounts: number[], user: string): Promise<void> {
        const stringAmounts = amounts.map(amount => amount.toString());
        await this.contract.submitTransaction('AddLiquidity', ...stringAmounts, user);
    }

    async removeLiquidity(percentage: number, user: string): Promise<void> {
        await this.contract.submitTransaction('RemoveLiquidity', percentage.toString(), user);
    }
}
