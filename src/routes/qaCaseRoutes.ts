const express = require("express");
const router = express.Router({ mergeParams: true });
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const cases = require("../controllers/qaCaseController");
const multer = require("multer");
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

router.use(protect);
router.get("/bugs", requirePermission("QA_VIEW"), cases.listBugs);
router.get("/suites", requirePermission("QA_VIEW"), cases.listSuites);
router.post("/suites", requirePermission("QA_MANAGE_CASES"), cases.createSuite);
router.delete("/suites/:suiteId", requirePermission("QA_MANAGE_CASES"), cases.archiveSuite);
router.get("/cases", requirePermission("QA_VIEW"), cases.listCases);
router.get("/cases/export", requirePermission("QA_VIEW"), cases.exportCases);
router.post("/cases/import/preview", requirePermission("QA_MANAGE_CASES"), importUpload.single("file"), cases.previewImport);
router.post("/cases/import/commit", requirePermission("QA_MANAGE_CASES"), cases.commitImport);
router.post("/cases", requirePermission("QA_MANAGE_CASES"), cases.createCase);
router.get("/cases/:caseId", requirePermission("QA_VIEW"), cases.getCase);
router.patch("/cases/:caseId", requirePermission("QA_MANAGE_CASES"), cases.updateCase);
router.get("/cases/:caseId/revisions", requirePermission("QA_VIEW"), cases.listCaseRevisions);
router.get("/cases/:caseId/revisions/:revision", requirePermission("QA_VIEW"), cases.getCaseRevision);

module.exports = router;
export {};
