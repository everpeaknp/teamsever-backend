"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ActivityLog = require("../models/ActivityLog");
const AuditLog = require("../models/AuditLog");
class Logger {
    async logActivity(params) {
        try {
            await ActivityLog.create({
                userId: params.userId,
                workspaceId: params.workspaceId,
                action: params.action,
                resourceType: params.resourceType,
                resourceId: params.resourceId,
                metadata: params.metadata
            });
        }
        catch (error) {
            console.error("Failed to log activity:", error);
        }
    }
    async logAudit(params) {
        try {
            const changedFields = this.getChangedFields(params.oldValue, params.newValue);
            if (changedFields.length === 0) {
                return;
            }
            await AuditLog.create({
                userId: params.userId,
                workspaceId: params.workspaceId,
                resourceType: params.resourceType,
                resourceId: params.resourceId,
                oldValue: params.oldValue,
                newValue: params.newValue,
                changedFields
            });
        }
        catch (error) {
            console.error("Failed to log audit:", error);
        }
    }
    getChangedFields(oldValue, newValue) {
        const changed = [];
        const allKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
        for (const key of allKeys) {
            if (key === "_id" || key === "__v" || key === "updatedAt")
                continue;
            if (JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key])) {
                changed.push(key);
            }
        }
        return changed;
    }
}
module.exports = new Logger();
