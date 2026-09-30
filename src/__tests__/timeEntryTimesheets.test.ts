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
