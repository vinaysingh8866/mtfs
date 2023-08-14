/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Context, Contract, Info, Transaction } from "fabric-contract-api";
import { ProposalCategory } from "./ProposalCategory";
import { Country } from "./Country";
import { Proposal, UpgradeStatus } from "./Praposal";
import { Member, MemberRole } from "./Member";
import { Appeal } from "./Appeal";

@Info({
  title: "DAOContract",
  description: "Smart contract for managing DAO proposals and votes",
})
export class DAOContract extends Contract {
  @Transaction()
  public async Init(ctx: Context): Promise<void> {
    // Initialization code if needed.
  }

  @Transaction()
  public async RegisterCountry(
    ctx: Context,
    countryName: string,
    details?: string
  ): Promise<void> {
    const countryData: Country = {
      name: countryName,
      details: details || "",
      hasVoted: {},
      members: [],
    };
    await ctx.stub.putState(
      countryName,
      Buffer.from(JSON.stringify(countryData))
    );
  }

  @Transaction()
  public async UpdateCountry(
    ctx: Context,
    countryName: string,
    newDetails: string
  ): Promise<void> {
    const countryDataBuffer = await ctx.stub.getState(countryName);
    if (!countryDataBuffer || countryDataBuffer.length === 0) {
      throw new Error(`Country ${countryName} does not exist`);
    }

    const countryData: Country = JSON.parse(countryDataBuffer.toString());
    countryData.details = newDetails;
    await ctx.stub.putState(
      countryName,
      Buffer.from(JSON.stringify(countryData))
    );
  }

  @Transaction()
  public async Propose(
    ctx: Context,
    proposalId: string,
    country: string,
    category: ProposalCategory,
    description: string,
    deadline: number,
    quorumPercentage: number,
    upgradeId?: string,
    proposedVersion?: string,
    changes?: string,
    expectedDowntime?: string
  ): Promise<void> {
    if (deadline <= Date.now()) {
      throw new Error("Deadline must be set to a future date and time.");
    }

    if (quorumPercentage <= 0 || quorumPercentage > 100) {
      throw new Error("Quorum percentage should be between 1 and 100.");
    }

    const proposal: Proposal = {
      proposalId,
      country,
      category,
      description,
      status: "OPEN",
      votedCountries: [],
      yesVotes: 0,
      noVotes: 0,
      comments: [],
      deadline,
      quorumPercentage,
      upgradeId, // Optional parameters for chaincode upgrades
      proposedVersion,
      changes,
      expectedDowntime,
      upgradeStatus: UpgradeStatus.PROPOSED,
    };
    await ctx.stub.putState(proposalId, Buffer.from(JSON.stringify(proposal)));
  }

  @Transaction()
  public async UpdateProposal(
    ctx: Context,
    proposalId: string,
    newDescription: string
  ): Promise<void> {
    const proposalData = await ctx.stub.getState(proposalId);
    if (!proposalData || proposalData.length === 0) {
      throw new Error(`Proposal ${proposalId} does not exist`);
    }

    const proposal: Proposal = JSON.parse(proposalData.toString());
    proposal.description = newDescription;
    await ctx.stub.putState(proposalId, Buffer.from(JSON.stringify(proposal)));
  }
  @Transaction()
  @Transaction()
  public async Vote(
    ctx: Context,
    proposalId: string,
    country: string,
    memberId: string, // voting is done by a member
    vote: "YES" | "NO"
  ): Promise<void> {
    const proposalData = await ctx.stub.getState(proposalId);
    if (!proposalData || proposalData.length === 0) {
      throw new Error(`Proposal ${proposalId} does not exist`);
    }

    const proposal: Proposal = JSON.parse(proposalData.toString());

    if (Date.now() > proposal.deadline || proposal.status === "CLOSED") {
      throw new Error(`Voting for Proposal ${proposalId} has ended.`);
    }

    const countryDataBuffer = await ctx.stub.getState(country);
    if (!countryDataBuffer || countryDataBuffer.length === 0) {
      throw new Error(`Country ${country} does not exist`);
    }
    const countryData: Country = JSON.parse(countryDataBuffer.toString());
    const member = countryData.members.find((m) => m.memberId === memberId);

    if (!member) {
      throw new Error(
        `Member ${memberId} is not registered for Country ${country}.`
      );
    }

    if (member.role !== MemberRole.ADMIN && member.role !== MemberRole.VOTER) {
      throw new Error(`Member ${memberId} does not have voting rights`);
    }

    if (proposal.votedCountries.includes(country)) {
      throw new Error(`${country} has already voted on this proposal`);
    }

    proposal.votedCountries.push(country);

    if (vote === "YES") {
      proposal.yesVotes += 1;
    } else {
      proposal.noVotes += 1;
    }

    this.checkForQuorum(proposal); // Check for quorum after every vote

    await ctx.stub.putState(proposalId, Buffer.from(JSON.stringify(proposal)));
  }

  private checkForQuorum(proposal: Proposal): void {
    const totalVotes = proposal.yesVotes + proposal.noVotes;
    const totalEligibleVoters = proposal.votedCountries.length;

    if (totalVotes / totalEligibleVoters >= proposal.quorumPercentage / 100) {
      proposal.status = "CLOSED"; // Close the proposal if the quorum is met
    }
  }

  @Transaction()
  public async CommentOnProposal(
    ctx: Context,
    proposalId: string,
    comment: string
  ): Promise<void> {
    const proposalData = await ctx.stub.getState(proposalId);
    if (!proposalData || proposalData.length === 0) {
      throw new Error(`Proposal ${proposalId} does not exist`);
    }

    const proposal: Proposal = JSON.parse(proposalData.toString());
    proposal.comments!.push(comment);
    await ctx.stub.putState(proposalId, Buffer.from(JSON.stringify(proposal)));
  }

  @Transaction(false)
  public async GetProposal(ctx: Context, proposalId: string): Promise<string> {
    const proposalData = await ctx.stub.getState(proposalId);
    if (!proposalData || proposalData.length === 0) {
      throw new Error(`Proposal ${proposalId} does not exist`);
    }
    return proposalData.toString();
  }

  @Transaction()
  public async AddCountryMember(
    ctx: Context,
    countryName: string,
    memberId: string,
    memberName: string,
    role: MemberRole
  ): Promise<void> {
    const countryDataBuffer = await ctx.stub.getState(countryName);
    if (!countryDataBuffer || countryDataBuffer.length === 0) {
      throw new Error(`Country ${countryName} does not exist`);
    }
    const countryData: Country = JSON.parse(countryDataBuffer.toString());
    const member: Member = { memberId, name: memberName, role };
    countryData.members.push(member);
    await ctx.stub.putState(
      countryName,
      Buffer.from(JSON.stringify(countryData))
    );
  }

  @Transaction()
  public async RemoveCountryMember(
    ctx: Context,
    countryName: string,
    memberId: string
  ): Promise<void> {
    const countryDataBuffer = await ctx.stub.getState(countryName);
    if (!countryDataBuffer || countryDataBuffer.length === 0) {
      throw new Error(`Country ${countryName} does not exist`);
    }
    const countryData: Country = JSON.parse(countryDataBuffer.toString());
    countryData.members = countryData.members.filter(
      (member) => member.memberId !== memberId
    );
    await ctx.stub.putState(
      countryName,
      Buffer.from(JSON.stringify(countryData))
    );
  }

  @Transaction()
  public async UpdateCountryMemberRole(
    ctx: Context,
    countryName: string,
    memberId: string,
    newRole: MemberRole
  ): Promise<void> {
    const countryDataBuffer = await ctx.stub.getState(countryName);
    if (!countryDataBuffer || countryDataBuffer.length === 0) {
      throw new Error(`Country ${countryName} does not exist`);
    }
    const countryData: Country = JSON.parse(countryDataBuffer.toString());
    const member = countryData.members.find((m) => m.memberId === memberId);
    if (!member) {
      throw new Error(`Member ${memberId} does not exist in ${countryName}`);
    }
    member.role = newRole;
    await ctx.stub.putState(
      countryName,
      Buffer.from(JSON.stringify(countryData))
    );
  }
  @Transaction()
  public async CreateAppeal(
    ctx: Context,
    appealId: string,
    proposalId: string,
    appealingCountry: string,
    reason: string
  ): Promise<void> {
    // Check if the proposal exists
    const proposalData = await ctx.stub.getState(proposalId);
    if (!proposalData || proposalData.length === 0) {
      throw new Error(`Proposal ${proposalId} does not exist`);
    }

    const appeal: Appeal = {
      appealId,
      proposalId,
      appealingCountry,
      reason,
      status: "OPEN",
    };
    await ctx.stub.putState(appealId, Buffer.from(JSON.stringify(appeal)));
  }

  @Transaction()
  public async ReviewAppeal(
    ctx: Context,
    appealId: string,
    reviewerCountry: string,
    resolution: string
  ): Promise<void> {
    const appealData = await ctx.stub.getState(appealId);
    if (!appealData || appealData.length === 0) {
      throw new Error(`Appeal ${appealId} does not exist`);
    }

    const appeal: Appeal = JSON.parse(appealData.toString());
    if (appeal.status !== "OPEN") {
      throw new Error(`Appeal ${appealId} is not in OPEN state.`);
    }

    appeal.status = "IN_REVIEW";
    appeal.resolution = resolution;
    appeal.reviewTimestamp = Date.now();

    await ctx.stub.putState(appealId, Buffer.from(JSON.stringify(appeal)));
  }

  @Transaction()
  public async ResolveAppeal(ctx: Context, appealId: string): Promise<void> {
    const appealData = await ctx.stub.getState(appealId);
    if (!appealData || appealData.length === 0) {
      throw new Error(`Appeal ${appealId} does not exist`);
    }

    const appeal: Appeal = JSON.parse(appealData.toString());
    if (appeal.status !== "IN_REVIEW") {
      throw new Error(`Appeal ${appealId} is not in IN_REVIEW state.`);
    }

    appeal.status = "RESOLVED";
    await ctx.stub.putState(appealId, Buffer.from(JSON.stringify(appeal)));
  }

  @Transaction(false)
  public async GetAppeal(ctx: Context, appealId: string): Promise<string> {
    const appealData = await ctx.stub.getState(appealId);
    if (!appealData || appealData.length === 0) {
      throw new Error(`Appeal ${appealId} does not exist`);
    }
    return appealData.toString();
  }
}