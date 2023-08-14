export interface Member {
    memberId: string;
    name: string;
    role: MemberRole;
  }


export enum MemberRole {
    ADMIN = "ADMIN", // Can manage other members and has voting rights
    VOTER = "VOTER", // Has voting rights
    OBSERVER = "OBSERVER", // Can view but not vote
  }