export type InvitationLifecycleStatus = "pending" | "accepted" | "already_member";

export function invitationStatusAfterAcceptance(
  inviteType: "email" | "link" | undefined,
  actuallyJoined: boolean,
): InvitationLifecycleStatus {
  if (inviteType === "link") return "pending";
  return actuallyJoined ? "accepted" : "already_member";
}
