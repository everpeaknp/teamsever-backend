"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const PlanInheritanceService = require("./planInheritanceService").default;
const ChatMessage = require("../models/ChatMessage");
const ChatChannel = require("../models/ChatChannel");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const softDelete = require("../utils/softDelete");
const logger = require("../utils/logger");
const notificationService = require("./notificationService");
const entitlementService = require("./entitlementService");
class ChatService {
    /**
     * Validate if user is a workspace member
     */
    async validateWorkspaceMembership(workspaceId, userId) {
        const workspace = await Workspace.findOne({
            _id: workspaceId,
            isDeleted: false,
        }).lean();
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const membership = workspace.members.find((m) => m.user.toString() === userId);
        if (!membership) {
            throw new AppError("You must be a workspace member to access chat", 403);
        }
        return { workspace, membership };
    }
    /**
     * Validate channel access
     */
    async validateChannelAccess(channelId, userId) {
        let channel;
        if (channelId === 'general') {
            // Special case: resolve 'general' to the default channel
            // This requires the workspace ID which we don't have here.
            // However, we can find a default channel for ANY workspace the user is in.
            // But it's better to handle this in callers who have workspaceId.
            throw new AppError("Channel ID 'general' must be resolved via workspace context", 400);
        }
        channel = await ChatChannel.findOne({
            _id: channelId,
            isDeleted: false,
        });
        if (!channel) {
            throw new AppError("Channel not found", 404);
        }
        // Always check workspace membership first
        const { membership } = await this.validateWorkspaceMembership(channel.workspace.toString(), userId);
        // Access control logic:
        // 1. Creator always has access
        // 2. Admins/Owners always have access
        // 3. Members in the 'members' array have access
        // 4. Public channels are accessible to all workspace members
        const isCreator = channel.createdBy && channel.createdBy.toString() === userId;
        const isAdmin = membership.role === 'admin' || membership.role === 'owner';
        const isMember = channel.members && channel.members.some((id) => id.toString() === userId);
        if (channel.type === "private" && !isCreator && !isAdmin && !isMember) {
            throw new AppError("You do not have access to this private channel", 403);
        }
        return channel;
    }
    /**
     * Get or create default channel (#general)
     */
    async getOrCreateDefaultChannel(workspaceId, creatorId) {
        let channel = await ChatChannel.findOne({
            workspace: workspaceId,
            isDefault: true,
            isDeleted: false,
        });
        if (!channel) {
            // If no creatorId provided, use the workspace owner
            if (!creatorId) {
                const workspace = await Workspace.findById(workspaceId).select("owner").lean();
                creatorId = workspace?.owner?.toString();
            }
            if (!creatorId) {
                throw new AppError("Cannot determine creator for default channel", 500);
            }
            channel = await ChatChannel.create({
                workspace: workspaceId,
                name: "General",
                description: "Workspace-wide chat for all members",
                type: "public",
                isDefault: true,
                createdBy: creatorId,
            });
        }
        return channel;
    }
    /**
     * Create a new chat channel
     */
    async createChannel(workspaceId, userId, data) {
        const { workspace, membership } = await this.validateWorkspaceMembership(workspaceId, userId);
        // Only Admin or Owner can create channels
        if (membership.role !== "admin" && membership.role !== "owner") {
            throw new AppError("Only admins can create chat channels", 403);
        }
        const { name, description, type, members = [] } = data;
        // Check if channel with same name exists in workspace
        const existing = await ChatChannel.findOne({
            workspace: workspaceId,
            name: { $regex: new RegExp(`^${name}$`, "i") },
            isDeleted: false,
        });
        if (existing) {
            throw new AppError("A channel with this name already exists", 400);
        }
        // Add creator to members if private
        const finalMembers = [...new Set([...members, userId])];
        // Entitlement check for private channels
        if (type === "private") {
            const { allowed, reason } = await entitlementService.canCreatePrivateChannel(workspace.owner.toString());
            if (!allowed) {
                throw new AppError(reason, 403);
            }
            // Check initial member count
            const plan = await entitlementService.getUserPlan(workspace.owner.toString());
            const resolvedFeatures = await PlanInheritanceService.resolveFeatures(plan);
            const maxMembers = resolvedFeatures.maxMembersPerPrivateChannel;
            if (maxMembers !== -1 && finalMembers.length > maxMembers) {
                throw new AppError(`Initial member count exceed limit for this private group (${finalMembers.length}/${maxMembers}).`, 403);
            }
        }
        const channel = await ChatChannel.create({
            workspace: workspaceId,
            name,
            description,
            type,
            members: type === "private" ? finalMembers : [],
            createdBy: userId,
        });
        return channel;
    }
    /**
     * Get all accessible channels for a workspace
     */
    async getChannels(workspaceId, userId) {
        const { membership } = await this.validateWorkspaceMembership(workspaceId, userId);
        const isAdmin = membership.role === 'admin' || membership.role === 'owner';
        // Ensure default channel exists
        await this.getOrCreateDefaultChannel(workspaceId, userId);
        // Find all public channels OR private channels where user is a member
        // Admins/Owners can see ALL channels
        const query = {
            workspace: workspaceId,
            isDeleted: false,
        };
        if (!isAdmin) {
            query.$or = [
                { type: "public" },
                { type: "private", members: userId }
            ];
        }
        const channels = await ChatChannel.find(query)
            .sort({ lastMessageAt: -1, name: 1 })
            .lean();
        return channels;
    }
    /**
     * Create a new chat message
     */
    async createMessage(data) {
        const { workspaceId, channelId, senderId, content, type = "text", mentions = [] } = data;
        let targetChannelId = channelId;
        // Fallback to default channel if no channelId provided (migration support)
        if (!targetChannelId) {
            const defaultChannel = await this.getOrCreateDefaultChannel(workspaceId, senderId);
            targetChannelId = defaultChannel._id.toString();
        }
        // Validate channel access
        await this.validateChannelAccess(targetChannelId, senderId);
        // Validate content
        if (!content || content.trim().length === 0) {
            throw new AppError("Message content cannot be empty", 400);
        }
        if (content.length > 5000) {
            throw new AppError("Message content too long (max 5000 characters)", 400);
        }
        // Create message
        const message = await ChatMessage.create({
            workspace: workspaceId,
            channel: targetChannelId,
            sender: senderId,
            content: content.trim(),
            type,
            mentions,
        });
        // Update channel's lastMessageAt
        await ChatChannel.findByIdAndUpdate(targetChannelId, { lastMessageAt: new Date() });
        // Populate sender info
        await message.populate("sender", "name email avatar profilePicture");
        // Log activity (non-blocking)
        try {
            await logger.logActivity({
                userId: senderId,
                workspaceId,
                action: "CHAT_MESSAGE_CREATED",
                resourceType: "ChatMessage",
                resourceId: message._id.toString(),
                metadata: { channelId: targetChannelId, contentLength: content.length },
            });
        }
        catch (error) {
            console.error("Failed to log chat message activity:", error);
        }
        // Send push notifications...
        if (mentions && mentions.length > 0) {
            try {
                const sender = await User.findById(senderId).select("name").lean();
                const senderName = sender?.name || "Someone";
                const messagePreview = content.length > 100 ? content.substring(0, 100) + "..." : content;
                mentions.forEach((mentionedUserId) => {
                    notificationService.createNotification({
                        recipientId: mentionedUserId,
                        type: "MENTION",
                        title: "You were mentioned",
                        body: `${senderName}: ${messagePreview}`,
                        data: {
                            resourceId: message._id.toString(),
                            resourceType: "ChatMessage",
                            workspaceId,
                            channelId: targetChannelId,
                            messageId: message._id.toString(),
                        },
                    }).catch((error) => {
                        console.error(`Failed to send mention notification to ${mentionedUserId}:`, error);
                    });
                });
            }
            catch (error) {
                console.error("Failed to send mention notifications:", error);
            }
        }
        return message;
    }
    /**
     * Get channel messages with pagination
     */
    async getChannelMessages(channelId, userId, options = {}) {
        // Resolve 'general' to default channel if possible
        if (channelId === 'general') {
            const workspaceId = options.workspaceId;
            if (!workspaceId) {
                throw new AppError("Workspace ID required to resolve 'general' channel", 400);
            }
            const defaultChannel = await this.getOrCreateDefaultChannel(workspaceId, userId);
            channelId = defaultChannel._id.toString();
        }
        // Validate channel access
        const channel = await this.validateChannelAccess(channelId, userId);
        const page = options.page || 1;
        const limit = options.limit || 50;
        const skip = (page - 1) * limit;
        // Build query
        const query = {
            channel: channelId,
            isDeleted: false,
        };
        // Get total count
        const total = await ChatMessage.countDocuments(query);
        // Get messages sorted by newest first (then reverse for ASC display)
        const messages = await ChatMessage.find(query)
            .populate("sender", "name email avatar profilePicture")
            .populate("mentions", "name email avatar profilePicture")
            .sort({ createdAt: -1 }) // Newest first
            .skip(skip)
            .limit(limit)
            .lean();
        messages.reverse();
        return {
            channel,
            messages,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit,
                hasMore: page * limit < total,
            },
        };
    }
    /**
     * Delete a chat message (soft delete)
     */
    async deleteMessage(messageId, userId) {
        const message = await ChatMessage.findOne({
            _id: messageId,
            isDeleted: false,
        });
        if (!message) {
            throw new AppError("Message not found", 404);
        }
        // Validate channel access
        await this.validateChannelAccess(message.channel.toString(), userId);
        // Only sender or Admin/Owner can delete message
        const { membership } = await this.validateWorkspaceMembership(message.workspace.toString(), userId);
        if (message.sender.toString() !== userId && membership.role !== "admin" && membership.role !== "owner") {
            throw new AppError("You do not have permission to delete this message", 403);
        }
        // Soft delete
        await softDelete(ChatMessage, messageId);
        return { message: "Message deleted successfully" };
    }
    /**
     * Get unread message count for a channel by user
     */
    async getUnreadCount(channelId, userId) {
        // This part requires a tracking mechanism (per-user-per-channel read state)
        // For now, returning 0 or simplified logic
        return 0;
    }
    /**
     * Update channel details
     */
    async updateChannel(workspaceId, channelId, userId, updateData) {
        const channel = await ChatChannel.findOne({ _id: channelId, workspace: workspaceId, isDeleted: false });
        if (!channel)
            throw new AppError("Channel not found", 404);
        // Only creator or admin can update
        const { membership } = await this.validateWorkspaceMembership(workspaceId.toString(), userId);
        const isAdmin = membership.role === 'admin' || membership.role === 'owner';
        const isCreator = channel.createdBy && channel.createdBy.toString() === userId.toString();
        if (!isCreator && !isAdmin) {
            throw new AppError("Not authorized to update this channel settings", 403);
        }
        if (updateData.name) {
            // Ensure name is unique in workspace
            const existing = await ChatChannel.findOne({
                workspace: workspaceId,
                name: { $regex: new RegExp(`^${updateData.name}$`, "i") },
                _id: { $ne: channelId },
                isDeleted: false
            });
            if (existing)
                throw new AppError("Channel name already exists in this workspace", 400);
            channel.name = updateData.name;
        }
        if (updateData.description !== undefined)
            channel.description = updateData.description;
        // Only allow changing type if it's not the default channel
        if (updateData.type && !channel.isDefault) {
            channel.type = updateData.type;
        }
        if (updateData.members) {
            // Ensure members is an array and creator is always included if private
            let finalMembers = updateData.members;
            if (channel.type === 'private' || updateData.type === 'private') {
                finalMembers = [...new Set([...finalMembers, channel.createdBy.toString()])];
                // Entitlement check for member limit
                const { allowed, reason } = await entitlementService.canAddMemberToPrivateChannel(workspaceId.toString(), channelId);
                // Wait, the above check uses the current channel members. 
                // We should check against the NEW members list.
                const plan = await entitlementService.getUserPlan(membership.user.toString()); // Wait, this should be workspace owner
                const workspace = await Workspace.findById(workspaceId).select('owner').lean();
                const ownerId = workspace.owner.toString();
                const resolvedPlan = await entitlementService.getUserPlan(ownerId);
                const resolvedFeatures = await PlanInheritanceService.resolveFeatures(resolvedPlan);
                const maxMembers = resolvedFeatures.maxMembersPerPrivateChannel;
                if (maxMembers !== -1 && finalMembers.length > maxMembers) {
                    throw new AppError(`Member count exceeds limit for this private group (${finalMembers.length}/${maxMembers}).`, 403);
                }
            }
            channel.members = finalMembers;
        }
        await channel.save();
        return channel;
    }
}
module.exports = new ChatService();
