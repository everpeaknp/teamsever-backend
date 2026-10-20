jest.mock('../models/User', () => ({
  findById: jest.fn(),
}));

jest.mock('../models/Plan', () => ({
  findOne: jest.fn(),
}));

jest.mock('../services/entitlementService', () => ({
  __esModule: true,
  default: {
    getTotalUsage: jest.fn(),
  },
}));

jest.mock('../services/planInheritanceService', () => ({
  __esModule: true,
  default: {
    resolveFeatures: jest.fn(),
  },
}));

const User = require('../models/User');
const Plan = require('../models/Plan');
const PlanInheritanceService = require('../services/planInheritanceService').default;
const { getSubscriptionInfo } = require('../middlewares/subscriptionMiddleware');

describe('GET /subscription/info plan selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the signed-in user planId even when isPaid is false', async () => {
    const assignedPlan = {
      _id: 'plan-pro',
      name: 'Pro',
      parentPlanId: null,
      features: { maxWorkspaces: 20, maxSpaces: 100 },
    };
    const user = {
      _id: 'user-1',
      subscription: {
        planId: assignedPlan,
        isPaid: false,
        status: 'free',
      },
    };
    User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(user) });
    PlanInheritanceService.resolveFeatures.mockResolvedValue(assignedPlan.features);

    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await getSubscriptionInfo({ user: { id: 'user-1' } }, response);

    expect(User.findById).toHaveBeenCalledWith('user-1');
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        isPaid: false,
        plan: {
          _id: 'plan-pro',
          name: 'Pro',
          features: assignedPlan.features,
        },
      }),
    }));
    expect(Plan.findOne).not.toHaveBeenCalled();
  });
});
