const express = require("express");
const router = express.Router({ mergeParams: true });
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const runs = require("../controllers/qaRunController");
const multer = require("multer");
const evidenceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

router.use(protect);
router.get("/plans", requirePermission("VIEW_QUALITY"), runs.listPlans);
router.post("/plans", requirePermission("MANAGE_PLAN"), runs.createPlan);
router.get("/plans/:planId", requirePermission("VIEW_QUALITY"), runs.getPlan);
router.post("/plans/:planId/runs", requirePermission("MANAGE_PLAN"), runs.startRun);
router.get("/runs", requirePermission("VIEW_QUALITY"), runs.listRuns);
router.get("/my-executions", requirePermission("EXECUTE_CASE"), runs.listMyExecutions);
router.get("/executions/:executionId", requirePermission("EXECUTE_CASE"), runs.getExecution);
router.get("/executions/:executionId/evidence", requirePermission("EXECUTE_CASE"), runs.listEvidence);
router.post("/executions/:executionId/evidence", requirePermission("EXECUTE_CASE"), evidenceUpload.single("file"), runs.uploadEvidence);
router.get("/runs/:runId/executions", requirePermission("VIEW_QUALITY"), runs.listExecutions);
router.post("/runs/:runId/close", requirePermission("MANAGE_PLAN"), runs.closeRun);
router.patch("/executions/:executionId", requirePermission("EXECUTE_CASE"), runs.recordExecution);
router.post("/executions/:executionId/bugs", requirePermission("EXECUTE_CASE"), runs.createOrLinkBug);

module.exports = router;
export {};
