jest.mock('../models/Workspace', () => ({ findOne: jest.fn() }));
jest.mock('../models/User', () => ({ find: jest.fn(), findById: jest.fn(), updateOne: jest.fn() }));
jest.mock('../services/socketService', () => ({
  isUserOnline: jest.fn(),
  getUserConnectionCount: jest.fn(),
  emitToUser: jest.fn(),
}));

const Workspace = require('../models/Workspace');
const User = require('../models/User');
const socketService = require('../services/socketService');
const presenceService = require('../services/presenceService');

describe('presenceService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the persisted last-seen time for offline workspace members', async () => {
    const lastSeenAt = new Date('2026-10-14T10:00:00.000Z');
    Workspace.findOne.mockReturnValue({
      lean: async () => ({ owner: { toString: () => 'owner-id' }, members: [{ user: { toString: () => 'member-id' } }] }),
    });
    User.find.mockReturnValue({
      select: () => ({ lean: async () => [{ _id: 'member-id', name: 'Member', email: 'member@example.com', lastSeenAt }] }),
    });
    socketService.isUserOnline.mockReturnValue(false);
    socketService.getUserConnectionCount.mockReturnValue(0);

    const result = await presenceService.getWorkspacePresence('workspace-id', 'owner-id');

    expect(result.offlineUsers[0].lastSeen).toEqual(lastSeenAt);
  });

  it('persists the disconnect time instead of keeping it only in process memory', async () => {
    const lastSeenAt = new Date('2026-10-15T12:00:00.000Z');
    User.updateOne.mockResolvedValue({ acknowledged: true });

    await presenceService.updateLastSeen('member-id', lastSeenAt);

    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: 'member-id' },
      { $set: { lastSeenAt } },
    );
  });

  it('persists last-seen even when the disconnecting socket had joined no workspace rooms', async () => {
    socketService.isUserOnline.mockReturnValue(false);
    User.updateOne.mockResolvedValue({ acknowledged: true });

    await presenceService.handleUserDisconnect('member-id', []);

    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: 'member-id' },
      expect.objectContaining({ $set: expect.objectContaining({ lastSeenAt: expect.any(Date) }) }),
    );
  });
});
