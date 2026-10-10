const express = require("express");
const router = express.Router({ mergeParams: true });
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const cases = require("../controllers/qaCaseController");
const multer = require("multer");
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

router.use(protect);
router.get("/bugs", requirePermission("VIEW_QUALITY"), cases.listBugs);
router.get("/suites", requirePermission("VIEW_QUALITY"), cases.listSuites);
router.post("/suites", requirePermission("AUTHOR_CASE"), cases.createSuite);
router.delete("/suites/:suiteId", requirePermission("AUTHOR_CASE"), cases.archiveSuite);
router.get("/cases", requirePermission("VIEW_QUALITY"), cases.listCases);
router.get("/cases/export", requirePermission("VIEW_QUALITY"), cases.exportCases);
router.post("/cases/import/preview", requirePermission("AUTHOR_CASE"), importUpload.single("file"), cases.previewImport);
router.post("/cases/import/commit", requirePermission("AUTHOR_CASE"), cases.commitImport);
router.post("/cases", requirePermission("AUTHOR_CASE"), cases.createCase);
router.get("/cases/:caseId", requirePermission("VIEW_QUALITY"), cases.getCase);
router.patch("/cases/:caseId", requirePermission("AUTHOR_CASE"), cases.updateCase);
router.get("/cases/:caseId/revisions", requirePermission("VIEW_QUALITY"), cases.listCaseRevisions);
router.get("/cases/:caseId/revisions/:revision", requirePermission("VIEW_QUALITY"), cases.getCaseRevision);

module.exports = router;
export {};
