import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";

const asyncHandler = require("../utils/asyncHandler");
const Workspace = require("../models/Workspace");
const TimeEntry = require("../models/TimeEntry");
const AppError = require("../utils/AppError");

const toggleWorkspaceClock = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id: workspaceId } = req.params;
    const { status } = req.body;
    const currentUserId = req.user!.id;

    const validStatuses = ["active", "inactive"];
    if (!status || !validStatuses.includes(status)) {
      return next(new AppError("Invalid status", 400));
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return next(new AppError("Workspace not found", 404));
    }

    const memberIndex = workspace.members.findIndex(
      (m: any) => m.user.toString() === currentUserId
    );

    if (memberIndex === -1) {
      return next(new AppError("Not a member", 404));
    }

    workspace.members[memberIndex].status = status;
    workspace.markModified('members');
    await workspace.save();

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

      return res.status(200).json({
        success: true,
        message: "Clocked in",
        data: { status, timeEntry: { _id: timeEntry._id, startTime: timeEntry.startTime, isRunning: true } }
      });
    }

    // Clock out - stop running timer
    
    const runningEntry = await TimeEntry.findOne({
      user: currentUserId,
      workspace: workspaceId,
      isRunning: true,
      isDeleted: false
    });

    if (runningEntry) {
      runningEntry.endTime = new Date();
      runningEntry.isRunning = false;
      await runningEntry.save();
      timeEntry = runningEntry;
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
  }
);

module.exports = { toggleWorkspaceClock };
export {};
