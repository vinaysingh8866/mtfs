import { Gateway, Contract } from 'fabric-network';

class OracleService {
    private gateway: Gateway;
    private contract: Contract;

    constructor(gateway: Gateway) {
        this.gateway = gateway;
    }

    async initialize() {
        const network = await this.gateway.getNetwork('mychannel');
        this.contract = network.getContract('OracleContract'); // Assuming 'OracleContract' is the name of the deployed contract
    }

    async addCurrency(currency: string, price: string): Promise<void> {
        await this.contract.submitTransaction('AddCurrency', currency, price);
    }

    async setCurrencyPrice(currency: string, price: string): Promise<void> {
        await this.contract.submitTransaction('SetCurrencyPrice', currency, price);
    }

    async getCurrencyPrice(currency: string): Promise<string> {
        const result = await this.contract.evaluateTransaction('GetCurrencyPrice', currency);
        return result.toString();
    }
}

export default OracleService;
