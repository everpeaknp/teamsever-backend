"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Workspace = require("../models/Workspace");
/**
 * Middleware to ensure only workspace owners can perform certain actions
 * Expects workspaceId in req.params
 */
const requireWorkspaceOwner = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const workspaceId = req.params.workspaceId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }
        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: "Workspace ID is required"
            });
        }
        // Fetch workspace and check ownership
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({
                success: false,
                message: "Workspace not found"
            });
        }
        // Check if user is the workspace owner
        const ownerId = workspace.owner.toString();
        if (userId !== ownerId) {
            return res.status(403).json({
                success: false,
                message: "Only workspace owners can perform this action"
            });
        }
        // Attach workspace to request for use in controllers
        req.workspace = workspace;
        next();
    }
    catch (error) {
        console.error("[Require Workspace Owner Middleware] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error checking workspace ownership"
        });
    }
};
module.exports = requireWorkspaceOwner;
exports.default = requireWorkspaceOwner;
