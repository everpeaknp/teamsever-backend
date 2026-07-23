const express = require("express");
const router = express.Router({ mergeParams: true });
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const {
  createAccessRequest,
  listAccessRequests,
  approveAccessRequest,
  denyAccessRequest,
  getMyAccessRequest,
} = require("../controllers/accessRequestController");

// Any authenticated user can submit a request or check their own
router.post("/", protect, createAccessRequest);
router.get("/my", protect, getMyAccessRequest);

// Owner / admin only — list, approve, deny
router.get("/", protect, requirePermission("INVITE_MEMBER"), listAccessRequests);
router.patch("/:requestId/approve", protect, requirePermission("INVITE_MEMBER"), approveAccessRequest);
router.patch("/:requestId/deny", protect, requirePermission("INVITE_MEMBER"), denyAccessRequest);

module.exports = router;
export {};
