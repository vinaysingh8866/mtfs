export interface Appeal {
    appealId: string;
    proposalId: string; // Reference to the proposal being appealed
    appealingCountry: string; // Country initiating the appeal
    reason: string; // Detailed explanation of the appeal
    status: "OPEN" | "IN_REVIEW" | "RESOLVED";
    resolution?: string; // Resolution details after reviewing the appeal
    reviewTimestamp?: number; // UNIX timestamp when the appeal was reviewed
  }
  