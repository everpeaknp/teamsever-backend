const express = require("express");
const router = express.Router({ mergeParams: true });
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const runs = require("../controllers/qaRunController");
const multer = require("multer");
const evidenceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

router.use(protect);
router.get("/plans", requirePermission("QA_VIEW"), runs.listPlans);
router.get("/testers", requirePermission("QA_MANAGE_RELEASES"), runs.listEligibleTesters);
router.post("/plans", requirePermission("QA_MANAGE_RELEASES"), runs.createPlan);
router.get("/plans/:planId", requirePermission("QA_VIEW"), runs.getPlan);
router.post("/plans/:planId/runs", requirePermission("QA_MANAGE_RELEASES"), runs.startRun);
router.get("/runs", requirePermission("QA_VIEW"), runs.listRuns);
router.get("/my-executions", requirePermission("QA_EXECUTE"), runs.listMyExecutions);
router.get("/executions/:executionId", requirePermission("QA_EXECUTE"), runs.getExecution);
router.get("/executions/:executionId/evidence", requirePermission("QA_EXECUTE"), runs.listEvidence);
router.post("/executions/:executionId/evidence", requirePermission("QA_EXECUTE"), evidenceUpload.single("file"), runs.uploadEvidence);
router.get("/runs/:runId/executions", requirePermission("QA_VIEW"), runs.listExecutions);
router.post("/runs/:runId/close", requirePermission("QA_MANAGE_RELEASES"), runs.closeRun);
router.patch("/executions/:executionId", requirePermission("QA_EXECUTE"), runs.recordExecution);
router.post("/executions/:executionId/bugs", requirePermission("QA_EXECUTE"), runs.createOrLinkBug);

module.exports = router;
export {};
