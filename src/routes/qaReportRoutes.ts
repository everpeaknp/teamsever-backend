const express = require("express");
const router = express.Router({ mergeParams: true });
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const reports = require("../controllers/qaReportController");

router.use(protect);
router.get("/reports/live", requirePermission("QA_MANAGE_RELEASES"), reports.getLive);
router.get("/reports/snapshots", requirePermission("QA_MANAGE_RELEASES"), reports.listSnapshots);
router.get("/reports/snapshots/:snapshotId.csv", requirePermission("QA_MANAGE_RELEASES"), reports.exportSnapshot);
router.get("/reports/snapshots/:snapshotId", requirePermission("QA_MANAGE_RELEASES"), reports.getSnapshot);
router.post("/plans/:planId/signoff", requirePermission("QA_SIGN_OFF"), reports.signOff);

module.exports = router;
export {};
