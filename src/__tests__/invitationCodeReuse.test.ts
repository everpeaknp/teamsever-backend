jest.mock("../models/Invitation", () => ({ findOne: jest.fn() }));
jest.mock("../models/Workspace", () => ({
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findById: jest.fn(),
}));
jest.mock("../models/WorkspaceActivity", () => ({ createActivity: jest.fn() }));
jest.mock("../models/User", () => ({ findById: jest.fn() }));
jest.mock("../models/Space", () => ({ findOne: jest.fn() }));
jest.mock("../models/SpaceMember", () => ({ findOneAndUpdate: jest.fn() }));
jest.mock("../utils/logger", () => ({ logActivity: jest.fn() }));
jest.mock("../services/emailService", () => ({}));
jest.mock("../services/enhancedNotificationService", () => ({
  createNotification: jest.fn(),
}));

const Invitation = require("../models/Invitation");
const Workspace = require("../models/Workspace");
const WorkspaceActivity = require("../models/WorkspaceActivity");
const User = require("../models/User");
const Space = require("../models/Space");
const SpaceMember = require("../models/SpaceMember");
const logger = require("../utils/logger");
const notificationService = require("../services/enhancedNotificationService");
const invitationService = require("../services/invitationService");

describe("reusable link invitations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows different users to redeem the same code until it expires", async () => {
    const workspace: any = {
      _id: "workspace-1",
      name: "Engineering",
      owner: "owner-1",
      members: [],
    };
    const space: any = {
      _id: "space-1",
      name: "Design",
      members: [],
      save: jest.fn(async function (this: any) {
        return this;
      }),
    };
    const invitation: any = {
      _id: "invite-1",
      token: "token-1",
      shortCode: "A1B2C3D4",
      inviteType: "link",
      email: null,
      role: "member",
      workspaceId: "workspace-1",
      spaceId: "space-1",
      spacePermissionLevel: "VIEW",
      invitedBy: "owner-1",
      expiresAt: new Date(Date.now() + 60_000),
      status: "pending",
      populate: jest.fn(function (this: any) {
        return this;
      }),
      save: jest.fn(async function (this: any) {
        return this;
      }),
    };
    const populatedWorkspaceQuery: any = {
      populate: jest.fn(function (this: any) {
        return this;
      }),
      then: (resolve: (value: any) => unknown) => Promise.resolve(workspace).then(resolve),
    };

    Invitation.findOne.mockImplementation(() => {
      const query: any = {
        populate: jest.fn(function (this: any) {
          return this;
        }),
        then: (resolve: (value: any) => unknown) => Promise.resolve(invitation).then(resolve),
      };
      return query;
    });
    Workspace.findOne.mockResolvedValue(workspace);
    Space.findOne.mockResolvedValue(space);
    SpaceMember.findOneAndUpdate.mockResolvedValue({});
    Workspace.findByIdAndUpdate.mockImplementation(async (_id: string, update: any) => {
      workspace.members.push(update.$push.members);
    });
    Workspace.findById.mockReturnValue(populatedWorkspaceQuery);
    User.findById.mockImplementation(async (id: string) => ({
      _id: id,
      name: `User ${id}`,
      email: `${id}@example.com`,
    }));
    WorkspaceActivity.createActivity.mockResolvedValue(undefined);
    logger.logActivity.mockResolvedValue(undefined);
    notificationService.createNotification.mockResolvedValue(undefined);

    const first = await invitationService.redeemByShortCode(" a1b2c3d4 ", "user-1");
    const second = await invitationService.redeemByShortCode("A1B2C3D4", "user-2");

    expect(first.workspace._id).toBe("workspace-1");
    expect(second.workspace._id).toBe("workspace-1");
    expect(workspace.members.map((member: any) => member.user)).toEqual([
      "user-1",
      "user-2",
    ]);
    expect(space.members).toEqual([
      { user: "user-1", role: "member", permissionLevel: "VIEW" },
      { user: "user-2", role: "member", permissionLevel: "VIEW" },
    ]);
    expect(SpaceMember.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(invitation.status).toBe("pending");
    expect(Invitation.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ shortCode: "A1B2C3D4", status: "pending" }),
    );
  });
});
