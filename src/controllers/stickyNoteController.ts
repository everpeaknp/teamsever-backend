const stickyNoteService = require("../services/stickyNoteService");

/**
 * Update sticky note for the current user in a workspace
 * PATCH /api/workspaces/:workspaceId/sticky-note
 */
exports.updateStickyNote = async (req: any, res: any, next: any) => {
  try {
    const { id: workspaceId } = req.params;
    const userId = req.user.id;
    const { content } = req.body;

    const note = await stickyNoteService.updateStickyNote(workspaceId, userId, content);

    res.status(200).json({
      success: true,
      data: note
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sticky note for the current user in a workspace
 * GET /api/workspaces/:workspaceId/sticky-note
 */
exports.getStickyNote = async (req: any, res: any, next: any) => {
  try {
    const { id: workspaceId } = req.params;
    const userId = req.user.id;

    const note = await stickyNoteService.getStickyNote(workspaceId, userId);

    res.status(200).json({
      success: true,
      data: note
    });
  } catch (error) {
    next(error);
  }
};

export {};
