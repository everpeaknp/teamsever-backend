const mongoose = require("mongoose");
const PlanInheritanceService = require("./planInheritanceService").default;
const ChatMessage = require("../models/ChatMessage");
const ChatChannel = require("../models/ChatChannel");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const softDelete = require("../utils/softDelete");
const logger = require("../utils/logger");
const notificationService = require("./enhancedNotificationService");
const entitlementService = require("./entitlementService").default;
const socketService = require("./socketService").default || require("./socketService");
const apiReadCacheService = require("./apiReadCacheService").default;
const TimeEntry = require("../models/TimeEntry");

interface CreateMessageData {
  workspaceId: string;
  channelId: string;
  senderId: string;
  content: string;
  attachments?: string[];
  type?: "text" | "system";
  mentions?: string[];
  replyToMessageId?: string;
}

interface GetMessagesOptions {
  page?: number;
  limit?: number;
  userId?: string;
  folderId?: string;
  spaceName?: string;
}

interface GetChannelsOptions {
  page?: number;
  limit?: number;
  search?: string;
  unreadOnly?: boolean;
  clockedInOnly?: boolean;
}

interface CreateChannelData {
  name: string;
  description?: string;
  type: "public" | "private";
  members?: string[];
}

class ChatService {
  async getChannelMembers(channelId: string, userId: string, workspaceId?: string) {
    if (channelId === 'general') {
      if (!workspaceId) throw new AppError("Workspace ID required to resolve 'general' channel", 400);
      await this.validateWorkspaceMembership(workspaceId, userId);
      const defaultChannel = await this.getOrCreateDefaultChannel(workspaceId, userId);
      channelId = defaultChannel._id.toString();
    }
    const channel = await this.validateChannelAccess(channelId, userId);
    const { workspace } = await this.validateWorkspaceMembership(channel.workspace.toString(), userId);
    const memberships = (workspace.members || []).filter((membership: any) => {
      if (channel.type !== 'private') return true;
      const memberId = membership.user?.toString();
      const role = membership.role;
      return memberId === channel.createdBy?.toString() ||
        channel.members?.some((id: any) => id.toString() === memberId) ||
        ['admin', 'owner', 'operations_manager', 'project_manager'].includes(role);
    });
    const ids = memberships.map((membership: any) => membership.user).filter(Boolean);
    return User.find({ _id: { $in: ids } }).select('name email avatar profilePicture').sort({ name: 1 }).lean();
  }

  /**
   * Validate if user is a workspace member
   */
  async validateWorkspaceMembership(workspaceId: string, userId: string): Promise<any> {
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false,
    }).lean();

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const membership = workspace.members.find(
      (m: any) => m.user.toString() === userId
    );

    if (!membership) {
      throw new AppError("You must be a workspace member to access chat", 403);
    }

    return { workspace, membership };
  }

  /**
   * Validate channel access
   */
  async validateChannelAccess(channelId: string, userId: string): Promise<any> {
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
    const isPrivileged = membership.role === 'admin' || membership.role === 'owner' || membership.role === 'operations_manager' || membership.role === 'project_manager';
    const isAdmin = isPrivileged;
    const isMember = channel.members && channel.members.some((id: any) => id.toString() === userId);

    if (channel.type === "private" && !isCreator && !isAdmin && !isMember) {
      throw new AppError("You do not have access to this private channel", 403);
    }

    return channel;
  }

  /**
   * Get or create default channels (#general and #commit-log)
   */
  async getOrCreateDefaultChannels(workspaceId: string, creatorId?: string): Promise<any> {
    // 1. General Channel
    let generalChannel = await ChatChannel.findOne({
      workspace: workspaceId,
      name: "General",
      isDeleted: false,
    });

    if (!generalChannel) {
      if (!creatorId) {
        const workspace = await Workspace.findById(workspaceId).select("owner").lean();
        creatorId = workspace?.owner?.toString();
      }

      if (creatorId) {
        generalChannel = await ChatChannel.create({
          workspace: workspaceId,
          name: "General",
          description: "Workspace-wide chat for all members",
          type: "public",
          isDefault: true,
          createdBy: creatorId,
        });
      }
    } else if (!generalChannel.isDefault) {
      // Fix migration issue if name exists but not marked as default
      generalChannel.isDefault = true;
      await generalChannel.save();
    }

    // 2. Commit Log Channel
    let commitLogChannel = await ChatChannel.findOne({
      workspace: workspaceId,
      name: "Commit Log",
      isDeleted: false,
    });

    if (!commitLogChannel) {
      if (!creatorId) {
        const workspace = await Workspace.findById(workspaceId).select("owner").lean();
        creatorId = workspace?.owner?.toString();
      }

      if (creatorId) {
        commitLogChannel = await ChatChannel.create({
          workspace: workspaceId,
          name: "Commit Log",
          description: "Automated logs for all repository commits in this workspace",
          type: "public",
          isDefault: false, // It's a special channel, but only 'General' is the true 'isDefault' for landing
          createdBy: creatorId,
        });
      }
    }

    return { generalChannel, commitLogChannel };
  }

  async getOrCreateDefaultChannel(workspaceId: string, creatorId?: string): Promise<any> {
    const { generalChannel } = await this.getOrCreateDefaultChannels(workspaceId, creatorId);
    return generalChannel;
  }

  async getOrCreateCommitLogChannel(workspaceId: string, creatorId?: string): Promise<any> {
    const { commitLogChannel } = await this.getOrCreateDefaultChannels(workspaceId, creatorId);
    return commitLogChannel;
  }

  /**
   * Create a new chat channel
   */
  async createChannel(workspaceId: string, userId: string, data: CreateChannelData) {
    const { workspace, membership } = await this.validateWorkspaceMembership(workspaceId, userId);

    // Only Privileged roles (Admin, Owner, Operations Manager, Project Manager) can create channels
    const isPrivileged = membership.role === 'admin' || membership.role === 'owner' || membership.role === 'operations_manager' || membership.role === 'project_manager';
    if (!isPrivileged) {
      throw new AppError("Only admins and managers can create chat channels", 403);
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
  async getChannels(workspaceId: string, userId: string, options: GetChannelsOptions = {}) {
    const { membership } = await this.validateWorkspaceMembership(workspaceId, userId);
    if (
      options.clockedInOnly &&
      membership.role !== "admin" &&
      membership.role !== "owner"
    ) {
      throw new AppError("Clocked-in filtering requires workspace management access", 403);
    }
    const isPrivileged = membership.role === 'admin' || membership.role === 'owner' || membership.role === 'operations_manager' || membership.role === 'project_manager';
    const isAdmin = isPrivileged;
    const page = options.page || 1;
    const limit = options.limit || 30;
    const search = options.search?.trim() || "";

    return apiReadCacheService.getOrLoad(
      `workspace:${workspaceId}:user:${userId}:role:${membership.role}:page:${page}:limit:${limit}:search:${search}:unread:${!!options.unreadOnly}:clocked:${!!options.clockedInOnly}`,
      5,
      async () => {
        // Ensure default channels exist when loading a fresh channel list.
        await this.getOrCreateDefaultChannels(workspaceId, userId);

        const query: any = { workspace: workspaceId, isDeleted: false };
        if (!isAdmin) {
          query.$or = [{ type: "public" }, { type: "private", members: userId }];
        }

        if (search) {
          const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const searchClause = { $or: [{ name: { $regex: escaped, $options: "i" } }, { description: { $regex: escaped, $options: "i" } }] };
          if (query.$or) query.$and = [{ $or: query.$or }, searchClause];
          else Object.assign(query, searchClause);
          delete query.$or;
        }
        if (options.unreadOnly) {
          const unreadChannels = await ChatMessage.distinct("channel", {
            workspace: workspaceId,
            sender: { $ne: new mongoose.Types.ObjectId(userId) },
            readBy: { $ne: new mongoose.Types.ObjectId(userId) },
            isDeleted: { $ne: true },
          });
          query._id = { $in: unreadChannels };
        }
        if (options.clockedInOnly) {
          const activeEntries = await TimeEntry.find({ workspace: workspaceId, isRunning: true, isDeleted: false, user: { $ne: userId } }).select("user").lean();
          const activeUserIds = activeEntries.map((entry: any) => entry.user).filter(Boolean);
          if (!activeUserIds.length) {
            return { channels: [], pagination: { total: 0, page, pages: 0, limit, hasMore: false } };
          }
          query.$and = query.$and || [];
          query.$and.push({
            $or: [{ type: "public" }, { members: { $in: activeUserIds } }],
          });
        }

        const skip = (page - 1) * limit;
        const total = await ChatChannel.countDocuments(query);
        const channels = await ChatChannel.find(query)
          .sort({ lastMessageAt: -1, name: 1 })
          .skip(skip)
          .limit(limit)
          .lean();

        const unreadByChannel = channels.length === 0 ? [] : await ChatMessage.aggregate([
          { $match: {
            channel: { $in: channels.map((channel: any) => channel._id) },
            sender: { $ne: new mongoose.Types.ObjectId(userId) },
            readBy: { $ne: new mongoose.Types.ObjectId(userId) },
            isDeleted: { $ne: true },
          } },
          { $group: { _id: "$channel", unreadCount: { $sum: 1 } } },
        ]);
        const unreadCounts = new Map(unreadByChannel.map((item: any) => [item._id.toString(), item.unreadCount]));
        const channelsWithUnread = channels.map((channel: any) => ({
          ...channel,
          unreadCount: unreadCounts.get(channel._id.toString()) || 0,
        }));

        return {
          channels: channelsWithUnread,
          pagination: {
            total,
            page,
            pages: Math.ceil(total / limit),
            limit,
            hasMore: page * limit < total,
          },
        };
      },
      "chat-channels",
    );
  }

  /**
   * Create a new chat message
   */
  async createMessage(data: CreateMessageData) {
    const { workspaceId, channelId, senderId, content, attachments = [], type = "text", mentions = [] } = data;

    let targetChannelId = channelId;

    // Fallback to default channel if no channelId provided (migration support)
    if (!targetChannelId || targetChannelId === 'general') {
      const defaultChannel = await this.getOrCreateDefaultChannel(workspaceId, senderId);
      targetChannelId = defaultChannel._id.toString();
    }

    // Validate channel access
    const channel = await this.validateChannelAccess(targetChannelId, senderId);

    // Commit Log is system-managed only (webhook/automation). Manual chat messages are blocked.
    const isCommitLogChannel = String(channel?.name || "").trim().toLowerCase() === "commit log";
    if (isCommitLogChannel) {
      throw new AppError("Commit Log is read-only. Manual messages are not allowed in this channel.", 403);
    }

    // Enforce workspace/channel consistency to prevent cross-workspace leaks
    if (channel.workspace.toString() !== workspaceId) {
      throw new AppError("Channel does not belong to the provided workspace", 400);
    }

    // Validate content
    if ((!content || content.trim().length === 0) && attachments.length === 0) {
      throw new AppError("Message content or an image is required", 400);
    }

    if (attachments.length > 5) throw new AppError("A message may contain at most 5 images", 400);

    if (content.length > 5000) {
      throw new AppError("Message content too long (max 5000 characters)", 400);
    }

    // Create message
    // A client cannot mention people outside this channel, even by forging IDs.
    const candidateIds = [...new Set((mentions || []).filter((id) => mongoose.Types.ObjectId.isValid(id)))];
    const allowedMembers = candidateIds.length ? await this.getChannelMembers(targetChannelId, senderId) : [];
    const allowedIds = new Set(allowedMembers.map((member: any) => member._id.toString()));
    const safeMentions = candidateIds.filter((id) => allowedIds.has(id) && id !== senderId);

    let replyTo: any = undefined;
    if (data.replyToMessageId) {
      replyTo = await ChatMessage.findOne({
        _id: data.replyToMessageId,
        channel: targetChannelId,
      }).select("_id");
      if (!replyTo) throw new AppError("Reply target is not in this channel", 400);
    }

    const message = await ChatMessage.create({
      workspace: workspaceId,
      channel: targetChannelId,
      sender: senderId,
      content: (content || "").trim(),
      attachments,
      type,
      mentions: safeMentions,
      ...(replyTo ? { replyTo: replyTo._id } : {}),
      readBy: [senderId],
    });

    // Update channel's lastMessageAt
    await ChatChannel.findByIdAndUpdate(targetChannelId, { lastMessageAt: new Date() });

    // Populate sender info
    await message.populate("sender", "name email avatar profilePicture");
    await message.populate({ path: "replyTo", select: "content sender createdAt isDeleted", populate: { path: "sender", select: "name avatar profilePicture" } });

    // Invalidate before broadcasting so clients refreshing from the socket event
    // cannot receive a cached page that predates this message.
    await Promise.all([
      apiReadCacheService.invalidateNamespace("chat-channels"),
      apiReadCacheService.invalidateNamespace("chat-messages"),
    ]);

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
    } catch (error) {
      console.error("Failed to log chat message activity:", error);
    }

    // Send push notifications...
    if (safeMentions.length > 0) {
      try {
        const sender = await User.findById(senderId).select("name").lean();
        const senderName = sender?.name || "Someone";
        const messagePreview = content.trim()
          ? content.length > 100 ? content.substring(0, 100) + "..." : content
          : attachments.length > 0 ? "sent a photo" : "";

        safeMentions.forEach((mentionedUserId) => {
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
          }).catch((error: any) => {
            console.error(`Failed to send mention notification to ${mentionedUserId}:`, error);
          });
        });
      } catch (error) {
        console.error("Failed to send mention notifications:", error);
      }
    }

    // Broadcast to channel room via socket
    const { emitChatMessage } = require("../socket/events");
    emitChatMessage(targetChannelId, {
      _id: message._id,
      workspace: message.workspace,
      channel: targetChannelId,
      channelName: channel.name,
      sender: message.sender,
      content: message.content,
      attachments: message.attachments || [],
      type: message.type,
      mentions: message.mentions,
      replyTo: message.replyTo,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    }, workspaceId);

    if (attachments.length > 0) {
      void this.getChannelMembers(targetChannelId, senderId, workspaceId)
        .then((members: any[]) => notificationService.notifyGroupChatPhoto?.({
          channelId: targetChannelId,
          channelName: channel.name,
          workspaceId,
          senderId,
          messageId: message._id.toString(),
          recipientIds: members.map((member) => member._id.toString()),
        }))
        .catch((error: any) => {
          console.error("Failed to send group photo notifications:", error);
        });
    }

    return message;
  }

  /**
   * Get channel messages with pagination
   */
  async getChannelMessages(
    channelId: string,
    userId: string,
    options: GetMessagesOptions = {}
  ) {
    // Resolve 'general' to default channel if possible
    if (channelId === 'general') {
      const workspaceId = (options as any).workspaceId;
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

    await this.markChannelAsRead(channelId, userId);

    // Build query
    const query: any = {
      channel: channelId,
      // Older soft-deleted rows may still contain original text. Keep those
      // hidden; only the new explicit tombstones are safe to return.
      $or: [
        { isDeleted: { $ne: true } },
        { isDeleted: true, content: "This message was deleted" },
      ],
    };

    // Optional: Filter by specific user (sender)
    if ((options as any).userId) {
      query.sender = (options as any).userId;
    }

    // Optional: Filter by folderId in metadata
    if (options.folderId) {
      query["metadata.folderId"] = options.folderId;
    }

    // Optional: Filter by spaceName in metadata
    if (options.spaceName) {
      query["metadata.spaceName"] = options.spaceName;
    }

    const filterKey = JSON.stringify({ user: options.userId || "", folder: options.folderId || "", space: options.spaceName || "" });
    const cachedPage = await apiReadCacheService.getOrLoad(
      `channel:${channelId}:user:${userId}:page:${page}:limit:${limit}:filters:${filterKey}`,
      10,
      async () => {
        const total = await ChatMessage.countDocuments(query);
        const messages = await ChatMessage.find(query)
          .populate("sender", "name email avatar profilePicture")
          .populate("mentions", "name email avatar profilePicture")
          .populate("readBy", "name avatar profilePicture")
          .populate({ path: "replyTo", select: "content sender createdAt isDeleted", populate: { path: "sender", select: "name avatar profilePicture" } })
          .populate("reactions.users", "name avatar profilePicture")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        messages.reverse();
        return {
          messages,
          pagination: {
            total,
            page,
            pages: Math.ceil(total / limit),
            limit,
            hasMore: page * limit < total,
          },
        };
      },
      "chat-messages",
    );

    return { channel, ...cachedPage };
  }

  /**
   * Delete a chat message (soft delete)
   */
  async deleteMessage(messageId: string, userId: string) {
    const message = await ChatMessage.findOne({
      _id: messageId,
      isDeleted: false,
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    // Validate channel access
    await this.validateChannelAccess(message.channel.toString(), userId);

    if (message.type && message.type !== "text") {
      throw new AppError("Only regular messages can be unsent", 400);
    }
    if (message.sender.toString() !== userId) {
      throw new AppError("You do not have permission to delete this message", 403);
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId as any;
    message.content = "This message was deleted";
    message.reactions = [];
    message.metadata = undefined;
    message.mentions = [];
    await message.save();
    await apiReadCacheService.invalidateNamespace("chat-messages");
    await message.populate("sender", "name email avatar profilePicture");
    const { emitChatMessageUpdated } = require("../socket/events");
    emitChatMessageUpdated(message.channel.toString(), message);
    return { message: "Message unsent", data: message };
  }

  async markChannelAsRead(channelId: string, userId: string) {
    const channel = await this.validateChannelAccess(channelId, userId);
    const unread = await ChatMessage.find({ channel: channelId, sender: { $ne: userId }, readBy: { $ne: userId } })
      .select("_id")
      .lean();
    if (unread.length === 0) return;
    const messageIds = unread.map((message: any) => message._id);
    await ChatMessage.updateMany(
      { _id: { $in: messageIds } },
      { $addToSet: { readBy: userId } },
    );
    await Promise.all([
      apiReadCacheService.invalidateNamespace("chat-channels"),
      apiReadCacheService.invalidateNamespace("chat-messages"),
    ]);
    const User = require("../models/User");
    const reader = await User.findById(userId).select("_id name avatar profilePicture").lean();
    const { emitChatReadReceipt } = require("../socket/events");
    emitChatReadReceipt(channelId, { channelId, channelName: channel.name, messageIds, reader, readAt: new Date() });
  }

  /**
   * Get unread message count for a channel by user
   */
  async getUnreadCount(channelId: string, userId: string) {
    await this.validateChannelAccess(channelId, userId);
    return ChatMessage.countDocuments({
      channel: channelId,
      sender: { $ne: userId },
      readBy: { $ne: userId },
      isDeleted: { $ne: true },
    });
  }

  /**
   * Update channel details
   */
  async updateChannel(
    workspaceId: string, 
    channelId: string, 
    userId: string, 
    updateData: Partial<CreateChannelData>
  ) {
    const channel = await ChatChannel.findOne({ _id: channelId, workspace: workspaceId, isDeleted: false });
    if (!channel) throw new AppError("Channel not found", 404);

    // Only creator or admin can update
    const { membership } = await this.validateWorkspaceMembership(workspaceId.toString(), userId);
    const isPrivileged = membership.role === 'admin' || membership.role === 'owner' || membership.role === 'operations_manager' || membership.role === 'project_manager';
    const isAdmin = isPrivileged;
    const isCreator = channel.createdBy && channel.createdBy.toString() === userId.toString();

    if (!isCreator && !isAdmin) {
      throw new AppError("Not authorized to update this channel settings", 403);
    }

    const isSystemChannel = channel.name === "General" || channel.name === "Commit Log";

    if (updateData.name && updateData.name !== channel.name) {
      if (isSystemChannel) {
        throw new AppError(`The ${channel.name} channel is permanent and cannot be renamed`, 400);
      }
      
      // Ensure name is unique in workspace
      const existing = await ChatChannel.findOne({ 
        workspace: workspaceId, 
        name: { $regex: new RegExp(`^${updateData.name}$`, "i") }, 
        _id: { $ne: channelId },
        isDeleted: false
      });
      if (existing) throw new AppError("Channel name already exists in this workspace", 400);
      channel.name = updateData.name;
    }

    if (updateData.description !== undefined) channel.description = updateData.description;
    
    // Only allow changing type if it's not a system channel
    if (updateData.type && !isSystemChannel) {
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

  /**
   * Delete channel (soft delete)
   * Permanent channels (General, Commit Log) cannot be deleted.
   */
  async deleteChannel(workspaceId: string, channelId: string, userId: string) {
    const channel = await ChatChannel.findOne({
      _id: channelId,
      workspace: workspaceId,
      isDeleted: false,
    });

    if (!channel) {
      throw new AppError("Channel not found", 404);
    }

    const channelName = (channel.name || "").toLowerCase();
    const isPermanentChannel =
      channel.isDefault === true ||
      channelName === "general" ||
      channelName === "commit log";

    if (isPermanentChannel) {
      throw new AppError("General and Commit Log channels are permanent and cannot be deleted", 400);
    }

    // Only creator or admin/owner can delete
    const { membership } = await this.validateWorkspaceMembership(workspaceId.toString(), userId);
    const isPrivileged = membership.role === "admin" || membership.role === "owner" || membership.role === "operations_manager" || membership.role === "project_manager";
    const isAdmin = isPrivileged;
    const isCreator = channel.createdBy && channel.createdBy.toString() === userId.toString();

    if (!isCreator && !isAdmin) {
      throw new AppError("Not authorized to delete this channel", 403);
    }

    await softDelete(ChatChannel, channelId);

    return { message: "Channel deleted successfully" };
  }

  /**
   * Toggle emoji reaction on a chat message
   */
  async toggleReaction(messageId: string, userId: string, emoji: string) {
    if (!emoji || !emoji.trim()) {
      throw new AppError("Emoji is required", 400);
    }

    const message = await ChatMessage.findOne({ _id: messageId, isDeleted: false });
    if (!message) {
      throw new AppError("Message not found", 404);
    }

    // Validate user access to the channel
    const channel = await this.validateChannelAccess(message.channel.toString(), userId);
    const messageAuthorId = (message.sender?._id ?? message.sender)?.toString();

    if (!message.reactions) {
      message.reactions = [];
    }

    const userAlreadyReactedSameEmoji = message.reactions.some(
      (r: any) => r.emoji === emoji && r.users.some((u: any) => u.toString() === userId.toString())
    );

    // Remove user from ALL reactions on this message (one person, one react)
    for (let i = message.reactions.length - 1; i >= 0; i--) {
      const r = message.reactions[i];
      const uIdx = r.users.findIndex((u: any) => u.toString() === userId.toString());
      if (uIdx > -1) {
        r.users.splice(uIdx, 1);
        r.count = r.users.length;
        if (r.count === 0) {
          message.reactions.splice(i, 1);
        }
      }
    }

    // If user wasn't already reacting with this exact emoji, add them to it
    if (!userAlreadyReactedSameEmoji) {
      const existingReaction = message.reactions.find((r: any) => r.emoji === emoji);
      if (existingReaction) {
        existingReaction.users.push(userId as any);
        existingReaction.count = existingReaction.users.length;
      } else {
        message.reactions.push({
          emoji,
          users: [userId as any],
          count: 1,
        });
      }
    }

    await message.save();
    await apiReadCacheService.invalidateNamespace("chat-messages");

    // Populate sender
    await message.populate("sender", "name email avatar profilePicture");
    await message.populate("reactions.users", "name avatar profilePicture");

    // Realtime broadcast via Socket.IO
    try {
      const io = socketService.getIO();
      if (io) {
        io.to(`channel:${message.channel.toString()}`).emit("chat:reaction", {
          messageId: message._id,
          channelId: message.channel,
          reactions: message.reactions,
          userId,
          emoji,
        });
      }
    } catch (err) {
      console.error("[ChatService] Failed to emit reaction socket event:", err);
    }

    if (!userAlreadyReactedSameEmoji && messageAuthorId !== userId.toString()) {
      try {
        await notificationService.notifyMessageReaction({
          type: "GROUP_CHAT_REACTION",
          recipientId: messageAuthorId,
          actorId: userId.toString(),
          messageId: message._id.toString(),
          emoji,
          workspaceId: (channel.workspace ?? message.workspace)?.toString(),
          channelId: message.channel.toString(),
          channelName: channel.name,
        });
      } catch (err) {
        console.error("[ChatService] Failed to notify message reaction:", err);
      }
    }

    return message;
  }
}

module.exports = new ChatService();

export {};
