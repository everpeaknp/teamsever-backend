const express = require("express");
const router = express.Router({ mergeParams: true });
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const { getCapabilities, getSettings, updateSettings, listModules, createModule, archiveModule } = require("../controllers/qaModuleController");

router.use(protect);
router.get("/capabilities", getCapabilities);
router.get("/settings", requirePermission("VIEW_QUALITY"), getSettings);
router.patch("/settings", requirePermission("MANAGE_SETTINGS"), updateSettings);
router.get("/modules", requirePermission("VIEW_QUALITY"), listModules);
router.post("/modules", requirePermission("AUTHOR_CASE"), createModule);
router.delete("/modules/:moduleId", requirePermission("AUTHOR_CASE"), archiveModule);
module.exports = router;
export {};
