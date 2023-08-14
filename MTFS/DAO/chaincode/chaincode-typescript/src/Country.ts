import { Member } from "./Member";

export interface Country {
    name: string;
    details?: string;
    members: Member[];
    hasVoted: { [key: string]: boolean };
  }