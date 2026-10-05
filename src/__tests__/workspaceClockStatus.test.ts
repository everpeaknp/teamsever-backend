describe('TimeEntryService.getWorkspaceClockStatus', () => {
  afterEach(() => jest.resetModules());

  test('returns an empty self-scoped status when a member is not clocked in', async () => {
    const lean = jest.fn().mockResolvedValue([]);
    const sort = jest.fn().mockReturnValue({ lean });
    const populateProject = jest.fn().mockReturnValue({ sort });
    const populateTask = jest.fn().mockReturnValue({ populate: populateProject });
    const populateUser = jest.fn().mockReturnValue({ populate: populateTask });
    const select = jest.fn().mockReturnValue({ populate: populateUser });
    const find = jest.fn().mockReturnValue({ select });

    jest.doMock('../models/TimeEntry', () => ({ find }));
    jest.doMock('../models/Workspace', () => ({
      findOne: jest.fn().mockResolvedValue({
        _id: 'workspace-1',
        name: 'Workspace',
        owner: 'owner-1',
        members: [{ user: 'member-1', role: 'member', status: 'active' }],
      }),
    }));
    jest.doMock('../models/Task', () => ({}));
    jest.doMock('../socket/events', () => ({}));
    jest.doMock('../services/analyticsV2CacheService', () => ({}));
    jest.doMock('../utils/logger', () => ({}));

    const service = require('../services/timeEntryService');
    const result = await service.getWorkspaceClockStatus('workspace-1', 'member-1');

    expect(find).toHaveBeenCalledWith({
      workspace: 'workspace-1',
      isRunning: true,
      isDeleted: false,
      user: 'member-1',
    });
    expect(result).toMatchObject({
      scope: 'self',
      canManageTeam: false,
      activeTimerCount: 0,
      activeTimers: [],
    });
  });
});
