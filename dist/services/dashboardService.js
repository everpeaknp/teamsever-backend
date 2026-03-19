"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Task = require("../models/Task");
const Workspace = require("../models/Workspace");
const Space = require("../models/Space");
const List = require("../models/List");
const AppError = require("../utils/AppError");
const mongoose = require("mongoose");
class DashboardService {
    /**
     * Verify user has access to workspace
     */
    async verifyWorkspaceAccess(workspaceId, userId) {
        const workspace = await Workspace.findOne({
            _id: workspaceId,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You do not have access to this workspace", 403);
        }
        return workspace;
    }
    /**
     * Get tasks summary (total, open, completed)
     */
    async getTasksSummary(userId, params) {
        const { workspaceId, spaceId, listId } = params;
        // Build query
        const query = { isDeleted: false };
        if (listId) {
            // Verify list exists and user has access
            const list = await List.findOne({ _id: listId, isDeleted: false });
            if (!list)
                throw new AppError("List not found", 404);
            await this.verifyWorkspaceAccess(list.workspace.toString(), userId);
            query.list = listId;
        }
        else if (spaceId) {
            // Verify space exists and user has access
            const space = await Space.findOne({ _id: spaceId, isDeleted: false });
            if (!space)
                throw new AppError("Space not found", 404);
            await this.verifyWorkspaceAccess(space.workspace.toString(), userId);
            query.space = spaceId;
        }
        else if (workspaceId) {
            // Verify workspace access
            await this.verifyWorkspaceAccess(workspaceId, userId);
            query.workspace = workspaceId;
        }
        else {
            throw new AppError("Please provide workspaceId, spaceId, or listId", 400);
        }
        // Get counts
        const [total, open, completed] = await Promise.all([
            Task.countDocuments(query),
            Task.countDocuments({ ...query, status: { $ne: "done" } }),
            Task.countDocuments({ ...query, status: "done" })
        ]);
        return {
            total,
            open,
            completed,
            completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : "0.0"
        };
    }
    /**
     * Get workload (task count per assignee)
     */
    async getWorkload(userId, params) {
        const { workspaceId, spaceId } = params;
        // Build query
        const query = { isDeleted: false, assignee: { $ne: null } };
        if (spaceId) {
            // Verify space exists and user has access
            const space = await Space.findOne({ _id: spaceId, isDeleted: false });
            if (!space)
                throw new AppError("Space not found", 404);
            await this.verifyWorkspaceAccess(space.workspace.toString(), userId);
            query.space = new mongoose.Types.ObjectId(spaceId);
        }
        else if (workspaceId) {
            // Verify workspace access
            await this.verifyWorkspaceAccess(workspaceId, userId);
            query.workspace = new mongoose.Types.ObjectId(workspaceId);
        }
        else {
            throw new AppError("Please provide workspaceId or spaceId", 400);
        }
        // Aggregate tasks by assignee
        const workload = await Task.aggregate([
            { $match: query },
            {
                $group: {
                    _id: "$assignee",
                    totalTasks: { $sum: 1 },
                    openTasks: {
                        $sum: { $cond: [{ $ne: ["$status", "done"] }, 1, 0] }
                    },
                    completedTasks: {
                        $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] }
                    }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },
            {
                $project: {
                    _id: 1,
                    totalTasks: 1,
                    openTasks: 1,
                    completedTasks: 1,
                    user: {
                        _id: "$user._id",
                        name: "$user.name",
                        email: "$user.email"
                    }
                }
            },
            { $sort: { totalTasks: -1 } }
        ]);
        return workload;
    }
    /**
     * Get status breakdown (count by status)
     */
    async getStatusBreakdown(userId, params) {
        const { workspaceId, spaceId, listId } = params;
        // Build query
        const query = { isDeleted: false };
        if (listId) {
            // Verify list exists and user has access
            const list = await List.findOne({ _id: listId, isDeleted: false });
            if (!list)
                throw new AppError("List not found", 404);
            await this.verifyWorkspaceAccess(list.workspace.toString(), userId);
            query.list = new mongoose.Types.ObjectId(listId);
        }
        else if (spaceId) {
            // Verify space exists and user has access
            const space = await Space.findOne({ _id: spaceId, isDeleted: false });
            if (!space)
                throw new AppError("Space not found", 404);
            await this.verifyWorkspaceAccess(space.workspace.toString(), userId);
            query.space = new mongoose.Types.ObjectId(spaceId);
        }
        else if (workspaceId) {
            // Verify workspace access
            await this.verifyWorkspaceAccess(workspaceId, userId);
            query.workspace = new mongoose.Types.ObjectId(workspaceId);
        }
        else {
            throw new AppError("Please provide workspaceId, spaceId, or listId", 400);
        }
        // Aggregate tasks by status
        const breakdown = await Task.aggregate([
            { $match: query },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    status: "$_id",
                    count: 1,
                    _id: 0
                }
            },
            { $sort: { count: -1 } }
        ]);
        // Calculate total
        const total = breakdown.reduce((sum, item) => sum + item.count, 0);
        // Add percentage
        const breakdownWithPercentage = breakdown.map((item) => ({
            ...item,
            percentage: total > 0 ? ((item.count / total) * 100).toFixed(1) : "0.0"
        }));
        return {
            breakdown: breakdownWithPercentage,
            total
        };
    }
}
module.exports = new DashboardService();
