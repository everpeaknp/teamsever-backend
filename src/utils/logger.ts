const ActivityLog = require("../models/ActivityLog");
const AuditLog = require("../models/AuditLog");

interface LogActivityParams {
  userId: string;
  workspaceId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE" | "CHAT_MESSAGE_CREATED";
  resourceType: "Workspace" | "Space" | "List" | "Task" | "ChatMessage";
  resourceId: string;
  metadata?: any;
}

interface LogAuditParams {
  userId: string;
  workspaceId: string;
  resourceType: "Workspace" | "Space" | "List" | "Task" | "ChatMessage";
  resourceId: string;
  oldValue: any;
  newValue: any;
}

class Logger {
  async logActivity(params: LogActivityParams): Promise<void> {
    try {
      await ActivityLog.create({
        userId: params.userId,
        workspaceId: params.workspaceId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        metadata: params.metadata
      });
    } catch (error) {
      console.error("Failed to log activity:", error);
    }
  }

  async logAudit(params: LogAuditParams): Promise<void> {
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
    } catch (error) {
      console.error("Failed to log audit:", error);
    }
  }

  private getChangedFields(oldValue: any, newValue: any): string[] {
    const changed: string[] = [];
    const allKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);

    for (const key of allKeys) {
      if (key === "_id" || key === "__v" || key === "updatedAt") continue;
      
      if (JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key])) {
        changed.push(key);
      }
    }

    return changed;
  }
}

module.exports = new Logger();

export {};
