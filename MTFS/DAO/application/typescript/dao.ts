import { Gateway, Contract } from "fabric-network";

class DAOService {
  private gateway: Gateway;
  private contract: Contract;

  constructor(gateway: Gateway) {
    this.gateway = gateway;
  }

  async initialize() {
    const network = await this.gateway.getNetwork("mychannel");
    this.contract = network.getContract("DAOContract"); // Assuming 'DAOContract' is the name of the deployed contract
  }

  async registerCountry(countryName: string, details?: string): Promise<void> {
    await this.contract.submitTransaction(
      "RegisterCountry",
      countryName,
      details || ""
    );
  }

  async updateCountry(countryName: string, newDetails: string): Promise<void> {
    await this.contract.submitTransaction(
      "UpdateCountry",
      countryName,
      newDetails
    );
  }

  async propose(
    proposalId: string,
    country: string,
    category: string,
    description: string,
    deadline: number,
    quorumPercentage: number,
    upgradeId?: string,
    proposedVersion?: string,
    changes?: string,
    expectedDowntime?: string
  ): Promise<void> {
    await this.contract.submitTransaction(
      "Propose",
      proposalId,
      country,
      category,
      description,
      deadline.toString(),
      quorumPercentage.toString(),
      upgradeId || "",
      proposedVersion || "",
      changes || "",
      expectedDowntime || ""
    );
  }

  async updateProposal(
    proposalId: string,
    newDescription: string
  ): Promise<void> {
    await this.contract.submitTransaction(
      "UpdateProposal",
      proposalId,
      newDescription
    );
  }

  async vote(
    proposalId: string,
    country: string,
    memberId: string,
    vote: "YES" | "NO"
  ): Promise<void> {
    await this.contract.submitTransaction(
      "Vote",
      proposalId,
      country,
      memberId,
      vote
    );
  }

  async commentOnProposal(proposalId: string, comment: string): Promise<void> {
    await this.contract.submitTransaction(
      "CommentOnProposal",
      proposalId,
      comment
    );
  }

  async getProposal(proposalId: string): Promise<string> {
    const result = await this.contract.evaluateTransaction(
      "GetProposal",
      proposalId
    );
    return result.toString();
  }

  async addCountryMember(
    countryName: string,
    memberId: string,
    memberName: string,
    role: string
  ): Promise<void> {
    await this.contract.submitTransaction(
      "AddCountryMember",
      countryName,
      memberId,
      memberName,
      role
    );
  }

  async removeCountryMember(
    countryName: string,
    memberId: string
  ): Promise<void> {
    await this.contract.submitTransaction(
      "RemoveCountryMember",
      countryName,
      memberId
    );
  }

  async updateCountryMemberRole(
    countryName: string,
    memberId: string,
    newRole: string
  ): Promise<void> {
    await this.contract.submitTransaction(
      "UpdateCountryMemberRole",
      countryName,
      memberId,
      newRole
    );
  }

  async createAppeal(
    appealId: string,
    proposalId: string,
    appealingCountry: string,
    reason: string
  ): Promise<void> {
    await this.contract.submitTransaction(
      "CreateAppeal",
      appealId,
      proposalId,
      appealingCountry,
      reason
    );
  }

  async reviewAppeal(
    appealId: string,
    reviewerCountry: string,
    resolution: string
  ): Promise<void> {
    await this.contract.submitTransaction(
      "ReviewAppeal",
      appealId,
      reviewerCountry,
      resolution
    );
  }

  async resolveAppeal(appealId: string): Promise<void> {
    await this.contract.submitTransaction("ResolveAppeal", appealId);
  }

  async getAppeal(appealId: string): Promise<string> {
    const result = await this.contract.evaluateTransaction(
      "GetAppeal",
      appealId
    );
    return result.toString();
  }
}

export default DAOService;
