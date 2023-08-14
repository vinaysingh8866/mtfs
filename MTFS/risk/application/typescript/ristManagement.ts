import { Gateway, Contract } from 'fabric-network';

class RiskManagementService {
    private gateway: Gateway;
    private contract: Contract;

    constructor(gateway: Gateway) {
        this.gateway = gateway;
    }

    async initialize() {
        const network = await this.gateway.getNetwork('mychannel');
        this.contract = network.getContract('RiskManagementContract'); // Assuming 'RiskManagementContract' is the name of the deployed contract
    }

    async checkReserveThreshold(threshold: string = "5000"): Promise<boolean> {
        const result = await this.contract.evaluateTransaction('CheckReserveThreshold', threshold);
        return result.toString() === 'true';
    }

    async checkBasketExposure(exposureLimit: string = "0.5"): Promise<boolean> {
        const result = await this.contract.evaluateTransaction('CheckBasketExposure', exposureLimit);
        return result.toString() === 'true';
    }

    async checkAssetVolatility(): Promise<boolean> {
        const result = await this.contract.evaluateTransaction('CheckAssetVolatility');
        return result.toString() === 'true';
    }
}

export default RiskManagementService;
