import { invitationStatusAfterAcceptance } from "../services/invitationLifecycle";

describe("invitationStatusAfterAcceptance", () => {
  it("keeps link invitations pending so one code can be redeemed by multiple people", () => {
    expect(invitationStatusAfterAcceptance("link", true)).toBe("pending");
  });

  it("keeps link invitations pending when the redeemer is already a workspace member", () => {
    expect(invitationStatusAfterAcceptance("link", false)).toBe("pending");
  });

  it("consumes email invitations after the invitee joins", () => {
    expect(invitationStatusAfterAcceptance("email", true)).toBe("accepted");
  });

  it("marks an email invitation as already used when its invitee is already a member", () => {
    expect(invitationStatusAfterAcceptance("email", false)).toBe("already_member");
  });
});
