const StickyNote = require("../models/StickyNote");
const AppError = require("../utils/AppError");

class StickyNoteService {
  /**
   * Get or create a sticky note for a user in a workspace
   */
  async getStickyNote(workspaceId: string, userId: string) {
    let note = await StickyNote.findOne({ workspace: workspaceId, user: userId });
    
    if (!note) {
      note = await StickyNote.create({ workspace: workspaceId, user: userId, content: "" });
    }
    
    return note;
  }

  /**
   * Update sticky note content
   */
  async updateStickyNote(workspaceId: string, userId: string, content: string) {
    const note = await StickyNote.findOneAndUpdate(
      { workspace: workspaceId, user: userId },
      { content },
      { new: true, upsert: true }
    );
    
    return note;
  }
}

module.exports = new StickyNoteService();
export {};
