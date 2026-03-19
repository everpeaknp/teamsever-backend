"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asyncHandler = require("../utils/asyncHandler");
const Workspace = require("../models/Workspace");
const TimeEntry = require("../models/TimeEntry");
const AppError = require("../utils/AppError");
const toggleWorkspaceClock = asyncHandler(async (req, res, next) => {
    const { workspaceId } = req.params;
    const { status } = req.body;
    const currentUserId = req.user.id;
    console.log('[toggleWorkspaceClock] Request:', { workspaceId, status, currentUserId });
    const validStatuses = ["active", "inactive"];
    if (!status || !validStatuses.includes(status)) {
        return next(new AppError("Invalid status", 400));
    }
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
        return next(new AppError("Workspace not found", 404));
    }
    const memberIndex = workspace.members.findIndex((m) => m.user.toString() === currentUserId);
    if (memberIndex === -1) {
        return next(new AppError("Not a member", 404));
    }
    workspace.members[memberIndex].status = status;
    workspace.markModified('members');
    await workspace.save();
    console.log('[toggleWorkspaceClock] Updated workspace member status to:', status);
    let timeEntry = null;
    if (status === "active") {
        // Clock in - create new time entry
        timeEntry = await TimeEntry.create({
            user: currentUserId,
            workspace: workspaceId,
            startTime: new Date(),
            isRunning: true,
            description: "Workspace clock in"
        });
        console.log('[toggleWorkspaceClock] Created time entry:', timeEntry._id);
        return res.status(200).json({
            success: true,
            message: "Clocked in",
            data: { status, timeEntry: { _id: timeEntry._id, startTime: timeEntry.startTime, isRunning: true } }
        });
    }
    // Clock out - stop running timer
    console.log('[toggleWorkspaceClock] Looking for running timer...');
    const runningEntry = await TimeEntry.findOne({
        user: currentUserId,
        workspace: workspaceId,
        isRunning: true,
        isDeleted: false
    });
    console.log('[toggleWorkspaceClock] Found running entry:', runningEntry ? runningEntry._id : 'none');
    if (runningEntry) {
        runningEntry.endTime = new Date();
        runningEntry.isRunning = false;
        await runningEntry.save();
        timeEntry = runningEntry;
        console.log('[toggleWorkspaceClock] Stopped timer:', {
            id: timeEntry._id,
            duration: timeEntry.duration,
            startTime: timeEntry.startTime,
            endTime: timeEntry.endTime
        });
    }
    else {
        console.log('[toggleWorkspaceClock] No running timer found to stop');
    }
    res.status(200).json({
        success: true,
        message: "Clocked out",
        data: {
            status,
            timeEntry: timeEntry ? {
                _id: timeEntry._id,
                startTime: timeEntry.startTime,
                endTime: timeEntry.endTime,
                duration: timeEntry.duration,
                isRunning: false
            } : null
        }
    });
});
module.exports = { toggleWorkspaceClock };
