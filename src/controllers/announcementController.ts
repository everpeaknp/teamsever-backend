const Announcement = require('../models/Announcement');
const Workspace = require('../models/Workspace');

// @desc    Get all announcements for a workspace
// @route   GET /api/workspaces/:id/announcements
// @access  Private (Workspace members)
exports.getAnnouncements = async (req, res) => {
  try {
    const { id: workspaceId } = req.params;

    const announcements = await Announcement.find({ workspace: workspaceId })
      .populate('author', 'name email avatar')
      .sort({ createdAt: -1 }) // Newest first
      .lean();

    res.status(200).json({
      success: true,
      data: announcements,
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements',
      error: error.message,
    });
  }
};

// @desc    Create a new announcement
// @route   POST /api/workspaces/:id/announcements
// @access  Private (Workspace owners and admins only)
exports.createAnnouncement = async (req, res) => {
  try {
    const { id: workspaceId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Announcement content is required',
      });
    }

    // Check if user is workspace owner or admin
    const workspace = await Workspace.findById(workspaceId).populate({
      path: 'owner',
      populate: {
        path: 'subscription.planId'
      }
    });
    
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found',
      });
    }

    const isOwner = workspace.owner._id.toString() === userId;
    const member = workspace.members.find(
      (m) => m.user.toString() === userId
    );
    const isAdmin = member && (member.role === 'admin' || member.role === 'owner');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only workspace owners and admins can post announcements',
      });
    }

    // Check announcement cooldown based on workspace owner's plan
    const ownerSubscription = workspace.owner.subscription;
    const plan = ownerSubscription?.planId;
    const announcementCooldown = plan?.features?.announcementCooldown ?? 24; // Default 24 hours

    console.log('[Announcement] Cooldown check:', {
      workspaceId,
      ownerSubscription,
      plan: plan ? { name: plan.name, features: plan.features } : null,
      announcementCooldown,
      lastAnnouncementTime: workspace.lastAnnouncementTime
    });

    if (workspace.lastAnnouncementTime) {
      const currentTime = new Date();
      const timeSinceLastAnnouncement = (currentTime.getTime() - workspace.lastAnnouncementTime.getTime()) / (1000 * 60 * 60); // Convert to hours

      console.log('[Announcement] Time since last announcement:', timeSinceLastAnnouncement, 'hours');

      if (timeSinceLastAnnouncement < announcementCooldown) {
        const hoursRemaining = Math.ceil(announcementCooldown - timeSinceLastAnnouncement);
        
        console.log('[Announcement] Cooldown active, hours remaining:', hoursRemaining);
        
        // Dynamic message based on cooldown period
        let cooldownMessage;
        if (announcementCooldown === 1) {
          cooldownMessage = `Announcement cooldown active. You can post one announcement per hour on your current plan. Please wait ${hoursRemaining} more hour(s) or upgrade your plan for more frequent announcements.`;
        } else if (announcementCooldown < 24) {
          cooldownMessage = `Announcement cooldown active. You can post one announcement every ${announcementCooldown} hours on your current plan. Please wait ${hoursRemaining} more hour(s) or upgrade your plan for more frequent announcements.`;
        } else {
          cooldownMessage = `Announcement cooldown active. You can post one announcement every ${announcementCooldown} hours (${Math.floor(announcementCooldown / 24)} day(s)) on your current plan. Please wait ${hoursRemaining} more hour(s) or upgrade your plan for more frequent announcements.`;
        }
        
        return res.status(429).json({
          success: false,
          message: cooldownMessage,
          code: 'ANNOUNCEMENT_COOLDOWN',
          cooldownHours: announcementCooldown,
          hoursRemaining: hoursRemaining,
          lastAnnouncementTime: workspace.lastAnnouncementTime,
          nextAllowedTime: new Date(workspace.lastAnnouncementTime.getTime() + (announcementCooldown * 60 * 60 * 1000)),
          action: 'upgrade',
          feature: 'announcements'
        });
      }
    }

    console.log('[Announcement] Cooldown check passed, creating announcement');

    const announcement = await Announcement.create({
      content: content.trim(),
      workspace: workspaceId,
      author: userId,
    });

    // Update workspace lastAnnouncementTime
    workspace.lastAnnouncementTime = new Date();
    await workspace.save();

    console.log('[Announcement] Created successfully:', {
      announcementId: announcement._id,
      workspaceId,
      lastAnnouncementTime: workspace.lastAnnouncementTime
    });

    const populatedAnnouncement = await Announcement.findById(announcement._id)
      .populate('author', 'name email avatar')
      .lean();

    res.status(201).json({
      success: true,
      data: populatedAnnouncement,
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create announcement',
      error: error.message,
    });
  }
};

// @desc    Delete an announcement
// @route   DELETE /api/workspaces/:id/announcements/:announcementId
// @access  Private (Workspace owners and admins only)
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id: workspaceId, announcementId } = req.params;
    const userId = req.user.id;

    // Check if user is workspace owner or admin
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found',
      });
    }

    const isOwner = workspace.owner.toString() === userId;
    const member = workspace.members.find(
      (m) => m.user.toString() === userId
    );
    const isAdmin = member && (member.role === 'admin' || member.role === 'owner');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only workspace owners and admins can delete announcements',
      });
    }

    const announcement = await Announcement.findOneAndDelete({
      _id: announcementId,
      workspace: workspaceId,
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete announcement',
      error: error.message,
    });
  }
};
