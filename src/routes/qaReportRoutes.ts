const express = require("express");
const router = express.Router({ mergeParams: true });
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const reports = require("../controllers/qaReportController");

router.use(protect);
router.get("/reports/live", requirePermission("VIEW_QA_REPORT"), reports.getLive);
router.get("/reports/snapshots", requirePermission("VIEW_QA_REPORT"), reports.listSnapshots);
router.get("/reports/snapshots/:snapshotId.csv", requirePermission("VIEW_QA_REPORT"), reports.exportSnapshot);
router.get("/reports/snapshots/:snapshotId", requirePermission("VIEW_QA_REPORT"), reports.getSnapshot);
router.post("/plans/:planId/signoff", requirePermission("SIGN_OFF_QA"), reports.signOff);

module.exports = router;
export {};
