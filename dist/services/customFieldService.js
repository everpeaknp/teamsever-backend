"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CustomField = require("../models/CustomField");
const Workspace = require("../models/Workspace");
const Space = require("../models/Space");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { emitWorkspaceEvent } = require("../socket/events");
class CustomFieldService {
    /**
     * Check if user is admin or project owner
     */
    async checkAdminOrOwner(workspaceId, projectId, userId) {
        const workspace = await Workspace.findOne({
            _id: workspaceId,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        // Check if user is workspace owner or admin
        const member = workspace.members.find((m) => m.user.toString() === userId);
        if (!member) {
            throw new AppError("You are not a member of this workspace", 403);
        }
        const isWorkspaceAdmin = member.role === "owner" || member.role === "admin";
        // If project specified, check if user is project owner
        if (projectId) {
            const project = await Space.findOne({
                _id: projectId,
                workspace: workspaceId,
                isDeleted: false
            });
            if (!project) {
                throw new AppError("Project not found", 404);
            }
            const isProjectOwner = project.owner.toString() === userId;
            if (!isWorkspaceAdmin && !isProjectOwner) {
                throw new AppError("Only workspace admins or project owners can manage custom fields", 403);
            }
        }
        else {
            // Workspace-level custom field - must be admin
            if (!isWorkspaceAdmin) {
                throw new AppError("Only workspace admins can manage workspace-level custom fields", 403);
            }
        }
        return { workspace, isAdmin: isWorkspaceAdmin };
    }
    /**
     * Create a custom field
     */
    async createCustomField(data) {
        const { name, type, options, workspaceId, projectId, userId } = data;
        // Verify permissions
        await this.checkAdminOrOwner(workspaceId, projectId, userId);
        // Validate dropdown has options
        if (type === "dropdown" && (!options || options.length === 0)) {
            throw new AppError("Dropdown fields must have at least one option", 400);
        }
        // Create custom field
        const customField = await CustomField.create({
            name,
            type,
            options: type === "dropdown" ? options : undefined,
            workspace: workspaceId,
            project: projectId,
            createdBy: userId
        });
        // Log activity
        try {
            await logger.logActivity({
                userId,
                workspaceId,
                action: "CREATE",
                resourceType: "CustomField",
                resourceId: customField._id.toString(),
                metadata: { name, type, project: projectId }
            });
        }
        catch (error) {
            // Silent fail - activity logging is non-critical
        }
        // Emit real-time event
        try {
            emitWorkspaceEvent(workspaceId, "custom_field_created", {
                customField: {
                    _id: customField._id,
                    name: customField.name,
                    type: customField.type,
                    options: customField.options,
                    project: customField.project
                }
            }, userId);
        }
        catch (error) {
            // Silent fail - real-time events are non-critical in test environment
        }
        return customField;
    }
    /**
     * Get custom fields by workspace
     */
    async getFieldsByWorkspace(workspaceId, userId) {
        // Verify workspace exists and user is a member
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
        // Get all custom fields for workspace (including project-specific ones)
        const customFields = await CustomField.find({
            workspace: workspaceId,
            isDeleted: false
        })
            .populate("project", "name")
            .populate("createdBy", "name email")
            .sort("createdAt")
            .lean();
        return customFields;
    }
    /**
     * Get custom fields by project
     */
    async getFieldsByProject(projectId, userId) {
        // Verify project exists
        const project = await Space.findOne({
            _id: projectId,
            isDeleted: false
        });
        if (!project) {
            throw new AppError("Project not found", 404);
        }
        // Verify user is workspace member
        const workspace = await Workspace.findOne({
            _id: project.workspace,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You do not have access to this project", 403);
        }
        // Get project-specific fields + workspace-level fields
        const customFields = await CustomField.find({
            workspace: project.workspace,
            $or: [
                { project: projectId },
                { project: null }
            ],
            isDeleted: false
        })
            .populate("project", "name")
            .populate("createdBy", "name email")
            .sort("createdAt")
            .lean();
        return customFields;
    }
    /**
     * Update a custom field
     */
    async updateCustomField(customFieldId, userId, updateData) {
        const customField = await CustomField.findOne({
            _id: customFieldId,
            isDeleted: false
        });
        if (!customField) {
            throw new AppError("Custom field not found", 404);
        }
        // Verify permissions
        await this.checkAdminOrOwner(customField.workspace.toString(), customField.project?.toString(), userId);
        // Update fields
        if (updateData.name)
            customField.name = updateData.name;
        if (updateData.options && customField.type === "dropdown") {
            if (updateData.options.length === 0) {
                throw new AppError("Dropdown fields must have at least one option", 400);
            }
            customField.options = updateData.options;
        }
        await customField.save();
        // Log activity
        try {
            await logger.logActivity({
                userId,
                workspaceId: customField.workspace.toString(),
                action: "UPDATE",
                resourceType: "CustomField",
                resourceId: customField._id.toString()
            });
        }
        catch (error) {
            // Silent fail - activity logging is non-critical
        }
        // Emit real-time event
        try {
            emitWorkspaceEvent(customField.workspace.toString(), "custom_field_updated", {
                customField: {
                    _id: customField._id,
                    name: customField.name,
                    type: customField.type,
                    options: customField.options
                }
            }, userId);
        }
        catch (error) {
            // Silent fail - real-time events are non-critical in test environment
        }
        return customField;
    }
    /**
     * Delete a custom field (soft delete)
     */
    async deleteCustomField(customFieldId, userId) {
        const customField = await CustomField.findOne({
            _id: customFieldId,
            isDeleted: false
        });
        if (!customField) {
            throw new AppError("Custom field not found", 404);
        }
        // Verify permissions
        await this.checkAdminOrOwner(customField.workspace.toString(), customField.project?.toString(), userId);
        // Soft delete
        customField.isDeleted = true;
        customField.deletedAt = new Date();
        await customField.save();
        // Log activity
        try {
            await logger.logActivity({
                userId,
                workspaceId: customField.workspace.toString(),
                action: "DELETE",
                resourceType: "CustomField",
                resourceId: customField._id.toString()
            });
        }
        catch (error) {
            // Silent fail - activity logging is non-critical
        }
        // Emit real-time event
        try {
            emitWorkspaceEvent(customField.workspace.toString(), "custom_field_deleted", {
                customFieldId: customField._id.toString()
            }, userId);
        }
        catch (error) {
            // Silent fail - real-time events are non-critical in test environment
        }
        return { message: "Custom field deleted successfully" };
    }
    /**
     * Validate custom field value
     */
    validateFieldValue(type, value, options) {
        switch (type) {
            case "text":
                if (typeof value !== "string") {
                    throw new AppError("Text field value must be a string", 400);
                }
                return value;
            case "number":
                const num = Number(value);
                if (isNaN(num)) {
                    throw new AppError("Number field value must be a valid number", 400);
                }
                return num;
            case "date":
                const date = new Date(value);
                if (isNaN(date.getTime())) {
                    throw new AppError("Date field value must be a valid date", 400);
                }
                return date;
            case "dropdown":
                if (!options || !options.includes(value)) {
                    throw new AppError("Dropdown value must be one of the defined options", 400);
                }
                return value;
            case "checkbox":
                if (typeof value !== "boolean") {
                    throw new AppError("Checkbox field value must be true or false", 400);
                }
                return value;
            case "user":
                // Validate it's a valid ObjectId string
                if (typeof value !== "string" || !value.match(/^[0-9a-fA-F]{24}$/)) {
                    throw new AppError("User field value must be a valid user ID", 400);
                }
                return value;
            default:
                throw new AppError("Invalid custom field type", 400);
        }
    }
    /**
     * Validate custom field values for a task
     * This is called from taskService when creating/updating tasks
     */
    async validateCustomFieldValues(customFieldValues, workspaceId, projectId) {
        if (!customFieldValues || customFieldValues.length === 0) {
            return [];
        }
        const validatedValues = [];
        for (const fieldValue of customFieldValues) {
            // Verify field exists
            const customField = await CustomField.findOne({
                _id: fieldValue.field,
                isDeleted: false
            });
            if (!customField) {
                throw new AppError(`Custom field ${fieldValue.field} not found`, 404);
            }
            // Verify field belongs to same workspace
            if (customField.workspace.toString() !== workspaceId) {
                throw new AppError("Custom field does not belong to task's workspace", 400);
            }
            // Verify field belongs to same project (if project-specific)
            if (customField.project) {
                if (!projectId || customField.project.toString() !== projectId) {
                    throw new AppError("Custom field does not belong to task's project", 400);
                }
            }
            // Validate value based on field type
            const validatedValue = this.validateFieldValue(customField.type, fieldValue.value, customField.options);
            validatedValues.push({
                field: fieldValue.field,
                value: validatedValue
            });
        }
        return validatedValues;
    }
}
module.exports = new CustomFieldService();
