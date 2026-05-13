const asyncHandler = require("../utils/asyncHandler");
const contributionService = require("../services/contributionService");

/**
 * @desc    Get user contribution data and streaks
 * @route   GET /api/performance/contributions/:userId
 * @access  Private
 */
exports.getUserContributions = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const workspaceId = req.query.workspaceId;
  const type = req.query.type || "all";

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "User ID is required"
    });
  }

  const [contributionData, performanceStats] = await Promise.all([
    contributionService.getDailyContributions(userId, workspaceId, type),
    contributionService.getUserPerformanceStats(userId, workspaceId)
  ]);

  res.status(200).json({
    success: true,
    data: {
      ...contributionData,
      performanceStats
    }
  });
});

/**
 * @desc    Get current user's contribution data
 * @route   GET /api/performance/contributions/me
 * @access  Private
 */
exports.getMyContributions = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const workspaceId = req.query.workspaceId;
  const type = req.query.type || "all";

  const [contributionData, performanceStats] = await Promise.all([
    contributionService.getDailyContributions(userId, workspaceId, type),
    contributionService.getUserPerformanceStats(userId, workspaceId)
  ]);

  res.status(200).json({
    success: true,
    data: {
      ...contributionData,
      performanceStats
    }
  });
});
