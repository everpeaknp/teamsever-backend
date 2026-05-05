const { Space } = require("../models/Space");
const { WorkspaceActivity } = require("../models/WorkspaceActivity");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const cryptoNode = require("crypto");

/**
 * @desc    Handle GitHub push webhooks
 * @route   POST /api/webhooks/github/:spaceId
 * @access  Public (Secured by HMAC)
 */
const handleGithubPush = asyncHandler(async (req: any, res: any, next: any) => {
  const { spaceId } = req.params;
  const signature = req.headers["x-hub-signature-256"];

  console.log(`[Webhook] Received push for space: ${spaceId}`);

  const space = await Space.findById(spaceId);
  if (!space) {
    console.error(`[Webhook] Space not found: ${spaceId}`);
    return next(new AppError("Space not found", 404));
  }

  if (!space.githubWebhookSecret) {
    console.error(`[Webhook] No secret configured for space: ${spaceId}`);
    return next(new AppError("Webhook secret not found", 404));
  }

  // 1. Verify GitHub Signature (HMAC SHA-256)
  if (!signature) {
    console.error(`[Webhook] Missing GitHub signature`);
    return next(new AppError("No signature provided", 401));
  }

  const hmac = cryptoNode.createHmac("sha256", space.githubWebhookSecret);
  const digest = "sha256=" + hmac.update(JSON.stringify(req.body)).digest("hex");

  if (signature !== digest) {
    return next(new AppError("Invalid signature", 401));
  }

  // 2. Extract commit info
  const { ref, commits, repository, pusher } = req.body;
  
  if (!commits || commits.length === 0) {
    return res.status(200).json({ success: true, message: "No commits found" });
  }

  // 3. Log each commit as a WorkspaceActivity
  const activities = await Promise.all(
    commits.map((commit) => {
      return WorkspaceActivity.create({
        workspace: space.workspace,
        space: spaceId,
        user: null, // External event
        type: "github_commit",
        description: `Pushed to ${repository.name}: "${commit.message}"`,
        metadata: {
          repoName: repository.name,
          commitMessage: commit.message,
          author: commit.author.name,
          url: commit.url,
          branch: ref.replace("refs/heads/", ""),
          pusher: pusher.name
        }
      });
    })
  );

  res.status(200).json({
    success: true,
    count: activities.length
  });
});

module.exports = {
  handleGithubPush
};

export {};
