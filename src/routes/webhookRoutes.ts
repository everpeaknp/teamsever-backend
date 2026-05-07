const express = require("express");
const router = express.Router();
const { handleGithubPush } = require("../controllers/webhookController");

// Use express.json() but we might need raw body for HMAC verification later if this fails
// GitHub sends JSON by default if configured
/**
 * @swagger
 * /api/webhooks/github/{spaceId}:
 *   post:
 *     summary: Handle GitHub push webhooks
 *     description: |
 *       Receiver for GitHub Push events. 
 *       1. Verifies 'x-hub-signature-256' header using the Space's secret.
 *       2. Attributes commits to users by email or verified githubUsername.
 *       3. Logs activity to the space.
 *       4. Posts notification to the #Commit Log channel.
 *     tags: ["12. Webhooks"]
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: The Space ID where the webhook is configured
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Successfully logged 3 commits" }
 *       401:
 *         description: Invalid signature or missing secret
 *       404:
 *         description: Space not found
 */
router.post("/github/:spaceId", handleGithubPush);

module.exports = router;

export {};
