describe('TimeEntryService.getTeamTimesheets project summaries', () => {
  afterEach(() => jest.resetModules());

  test('preserves project IDs when the project lookup has no matching document', async () => {
    const aggregate = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    jest.doMock('../models/TimeEntry', () => ({ aggregate }));
    jest.doMock('../models/Workspace', () => ({
      findOne: jest.fn().mockResolvedValue({
        _id: 'workspace-1',
        owner: 'admin-1',
        members: [],
        name: 'Workspace'
      })
    }));
    jest.doMock('../models/Task', () => ({}));
    jest.doMock('../socket/events', () => ({}));
    jest.doMock('../services/analyticsV2CacheService', () => ({}));
    jest.doMock('../utils/logger', () => ({}));

    const timeEntryService = require('../services/timeEntryService');
    await timeEntryService.getTeamTimesheets('workspace-1', 'admin-1', {});

    const projectPipeline = aggregate.mock.calls[1][0];
    const projectProjection = projectPipeline.find((stage: any) => stage.$project)?.$project;

    expect(projectProjection.project._id).toBe('$_id');
  });
});

describe('TimeEntryService.getWorkspaceClockStatus', () => {
  afterEach(() => jest.resetModules());

  const loadService = (memberRole: string, viewerId = 'member-1', status = 'active') => {
    const lean = jest.fn().mockResolvedValue([
      { _id: 'entry-1', user: { _id: 'member-1', name: 'Member' }, startTime: new Date(Date.now() - 60_000) },
    ]);
    const query: any = { select: () => query, populate: () => query, sort: () => query, lean };
    const find = jest.fn().mockReturnValue(query);
    jest.doMock('../models/TimeEntry', () => ({ find }));
    jest.doMock('../models/Workspace', () => ({
      findOne: jest.fn().mockResolvedValue({
        _id: 'workspace-1', owner: 'owner-1', name: 'Workspace',
        members: [{ user: viewerId, role: memberRole, status }, { user: 'member-2', role: 'member', status: 'active' }],
      }),
    }));
    jest.doMock('../models/Task', () => ({}));
    jest.doMock('../socket/events', () => ({}));
    jest.doMock('../services/analyticsV2CacheService', () => ({}));
    jest.doMock('../utils/logger', () => ({}));
    return { service: require('../services/timeEntryService'), find };
  };

  test('limits a regular member to their own authoritative running entry', async () => {
    const { service, find } = loadService('member', 'member-1');
    const result = await service.getWorkspaceClockStatus('workspace-1', 'member-1');
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ workspace: 'workspace-1', isRunning: true, user: 'member-1' }));
    expect(result).toMatchObject({ scope: 'self', canManageTeam: false, activeTimerCount: 1 });
  });

  test('allows admins to see the same running-entry roster used by the dashboard', async () => {
    const { service, find } = loadService('admin', 'admin-1');
    const result = await service.getWorkspaceClockStatus('workspace-1', 'admin-1');
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ workspace: 'workspace-1', isRunning: true }));
    expect(find.mock.calls[0][0]).not.toHaveProperty('user');
    expect(result).toMatchObject({ scope: 'workspace', canManageTeam: true });
  });

  test('does not expose clock status to inactive workspace members', async () => {
    const { service, find } = loadService('admin', 'admin-1', 'inactive');
    await expect(service.getWorkspaceClockStatus('workspace-1', 'admin-1')).rejects.toMatchObject({ statusCode: 403 });
    expect(find).not.toHaveBeenCalled();
  });
});
