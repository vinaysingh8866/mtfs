import { ProposalCategory } from "./ProposalCategory";

export interface Proposal {
    proposalId: string;
    country: string;
    category: ProposalCategory;
    description: string;
    status: "OPEN" | "CLOSED";
    votedCountries: string[];
    yesVotes: number;
    noVotes: number;
    comments?: string[];
    deadline: number; // UNIX timestamp representing the deadline
    quorumPercentage: number; // Dynamic quorum percentage for each proposal
  
    // Fields for chaincode upgrades (optional and only used when category = CHAINCODE_UPGRADE)
    upgradeId?: string;
    proposedVersion?: string;
    changes?: string;
    expectedDowntime?: string;
    upgradeStatus?: UpgradeStatus;
  }

  export enum UpgradeStatus {
    PROPOSED = "PROPOSED",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    ENACTED = "ENACTED",
  }