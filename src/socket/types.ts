// Socket types - exported for TypeScript typing

export interface WorkspaceEventPayload {
  type: "created" | "updated" | "deleted" | "member_added" | "member_removed" | "member_role_changed";
  data: any;
  userId: string;
}

export interface SpaceEventPayload {
  type: "created" | "updated" | "deleted" | "member_added" | "member_removed";
  data: any;
  userId: string;
}

export interface TaskEventPayload {
  type: "created" | "updated" | "deleted" | "status_changed" | "assigned" | "comment_added" | "comment_updated" | "comment_deleted";
  data: any;
  userId: string;
}

export interface PresenceData {
  workspaceId: string;
  onlineUsers: string[];
  userId?: string;
  status?: "online" | "offline" | "away";
  lastSeen?: Date;
}

export {};
