jest.mock('../services/socketService', () => ({
  addSocket: jest.fn(),
  removeSocket: jest.fn(),
  isUserOnline: jest.fn(),
  emitToUser: jest.fn(),
}));
jest.mock('../models/Workspace', () => ({
  find: jest.fn(() => ({ select: () => ({ lean: () => Promise.resolve([]) }) })),
}));
jest.mock('../models/Space', () => ({}));
jest.mock('../models/List', () => ({}));
jest.mock('../services/chatService', () => ({}));
jest.mock('../middlewares/messageLimitMiddleware', () => ({ checkMessageLimitForWorkspace: jest.fn() }));
jest.mock('../socket/presence', () => ({
  removeUserFromAll: jest.fn(() => ['workspace-1']),
  emitPresenceUpdate: jest.fn(),
}));
jest.mock('../services/presenceService', () => ({ handleUserDisconnect: jest.fn().mockResolvedValue(undefined) }));

const socketService = require('../services/socketService');
const presenceManager = require('../socket/presence');
const presenceService = require('../services/presenceService');
const registerHandlers = require('../socket/handlers');

describe('socket presence disconnect', () => {
  beforeEach(() => jest.clearAllMocks());

  it('records last-seen and broadcasts offline after the last socket disconnects', () => {
    const handlers: Record<string, (...args: any[]) => void> = {};
    const socket = {
      id: 'socket-1',
      user: { id: 'user-1', name: 'Member' },
      join: jest.fn(),
      on: jest.fn((event: string, handler: (...args: any[]) => void) => { handlers[event] = handler; }),
    };
    const io = {};
    socketService.isUserOnline.mockReturnValue(false);

    registerHandlers(io, socket);
    handlers.disconnect();

    expect(presenceManager.removeUserFromAll).toHaveBeenCalledWith('user-1');
    expect(presenceService.handleUserDisconnect).toHaveBeenCalledWith('user-1', ['workspace-1']);
    expect(presenceManager.emitPresenceUpdate).toHaveBeenCalledWith(io, 'workspace-1');
  });

  it('keeps workspace presence while another device remains connected', () => {
    const handlers: Record<string, (...args: any[]) => void> = {};
    const socket = {
      id: 'socket-1',
      user: { id: 'user-1', name: 'Member' },
      join: jest.fn(),
      on: jest.fn((event: string, handler: (...args: any[]) => void) => { handlers[event] = handler; }),
    };
    socketService.isUserOnline.mockReturnValue(true);

    registerHandlers({}, socket);
    handlers.disconnect();

    expect(presenceManager.removeUserFromAll).not.toHaveBeenCalled();
    expect(presenceService.handleUserDisconnect).not.toHaveBeenCalled();
  });
});
