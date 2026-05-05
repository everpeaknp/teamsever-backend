const express = require("express");
const router = express.Router();
const { handleGithubPush } = require("../controllers/webhookController");

// Use express.json() but we might need raw body for HMAC verification later if this fails
// GitHub sends JSON by default if configured
router.post("/github/:spaceId", handleGithubPush);

module.exports = router;

export {};
