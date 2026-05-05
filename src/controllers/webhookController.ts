const Space = require("../models/Space");
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
  // Note: For perfect verification, raw body should be used. 
  // If this fails with 401, we will need to capture raw body in server.ts
  const digest = "sha256=" + hmac.update(JSON.stringify(req.body)).digest("hex");

  if (signature !== digest) {
    console.error(`[Webhook] Signature mismatch for space: ${spaceId}`);
    // Log a small part of the digest/signature for debugging (don't log the whole thing for security)
    console.error(`[Webhook] Expected prefix: ${digest.substring(0, 15)}...`);
    return next(new AppError("Invalid signature", 401));
  }

  // Handle GitHub Ping event
  const githubEvent = req.headers["x-github-event"];
  if (githubEvent === "ping") {
    console.log(`[Webhook] Ping received for space: ${spaceId}. hook_id: ${req.body.hook_id}`);
    return res.status(200).json({ success: true, message: "PONG" });
  }

  // 2. Extract commit info with safety checks
  const { ref = "", commits = [], repository = {}, pusher = {} } = req.body;
  
  if (commits.length === 0) {
    console.log(`[Webhook] No commits in this event (${githubEvent})`);
    return res.status(200).json({ success: true, message: "No commits found" });
  }

  const repoName = repository.name || "Unknown Repo";
  const branchName = ref ? ref.replace("refs/heads/", "") : "unknown";
  const pusherName = pusher.name || "Unknown User";

  console.log(`[Webhook] Processing ${commits.length} commits from ${repoName} (${branchName}) by ${pusherName}`);

  try {
    // 3. Log each commit as a WorkspaceActivity
    const activities = await Promise.all(
      commits.map((commit: any) => {
        return WorkspaceActivity.create({
          workspace: space.workspace,
          space: spaceId,
          user: null, // External event
          type: "github_commit",
          description: `Pushed to ${repoName}: "${commit.message || 'No message'}"`,
          metadata: {
            repoName: repoName,
            commitMessage: commit.message || "",
            author: commit.author?.name || pusherName,
            url: commit.url || "",
            branch: branchName,
            pusher: pusherName
          }
        });
      })
    );

    console.log(`[Webhook] Successfully logged ${activities.length} commits`);

    res.status(200).json({
      success: true,
      count: activities.length
    });
  } catch (err: any) {
    console.error(`[Webhook] Error saving activities: ${err.message}`);
    return next(new AppError("Error processing webhook data", 500));
  }
});

module.exports = {
  handleGithubPush
};

export {};
