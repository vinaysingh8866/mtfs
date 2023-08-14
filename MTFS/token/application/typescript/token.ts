import { Gateway, Contract } from 'fabric-network';

class TokenService {
    private gateway: Gateway;
    private contract: Contract;

    constructor(gateway: Gateway) {
        this.gateway = gateway;
    }

    async initialize() {
        const network = await this.gateway.getNetwork('mychannel');
        this.contract = network.getContract('Token'); // Assuming 'Token' is the name of the deployed contract
    }

    async initLedger(name: string, symbol: string, decimals: string): Promise<boolean> {
        const result = await this.contract.submitTransaction('InitLedger', name, symbol, decimals);
        return result.toString() === 'true';
    }

    async tokenName(): Promise<string> {
        const result = await this.contract.evaluateTransaction('TokenName');
        return result.toString();
    }

    async tokenSymbol(): Promise<string> {
        const result = await this.contract.evaluateTransaction('TokenSymbol');
        return result.toString();
    }

    async tokenDecimals(): Promise<string> {
        const result = await this.contract.evaluateTransaction('TokenDecimals');
        return result.toString();
    }

    async totalSupply(): Promise<string> {
        const result = await this.contract.evaluateTransaction('TotalSupply');
        return result.toString();
    }

    async balanceOf(account: string): Promise<string> {
        const result = await this.contract.evaluateTransaction('BalanceOf', account);
        return result.toString();
    }

    async allowance(owner: string, spender: string): Promise<string> {
        const result = await this.contract.evaluateTransaction('Allowance', owner, spender);
        return result.toString();
    }

    async transfer(from: string, to: string, amount: string): Promise<boolean> {
        const result = await this.contract.submitTransaction('Transfer', from, to, amount);
        return result.toString() === 'true';
    }

    async transferFrom(from: string, to: string, value: string): Promise<boolean> {
        const result = await this.contract.submitTransaction('TransferFrom', from, to, value);
        return result.toString() === 'true';
    }

    async mint(to: string, amount: string): Promise<boolean> {
        const result = await this.contract.submitTransaction('Mint', to, amount);
        return result.toString() === 'true';
    }

    async burn(from: string, amount: string): Promise<boolean> {
        const result = await this.contract.submitTransaction('Burn', from, amount);
        return result.toString() === 'true';
    }
}

export default TokenService;
