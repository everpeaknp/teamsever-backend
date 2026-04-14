import mongoose from 'mongoose';

const Workspace = require('../models/Workspace');
const AppError = require('../utils/AppError');

/**
 * HierarchyService - Optimized service for fetching workspace hierarchy
 * Fetches entire workspace structure (Spaces -> Folders -> Lists) with task counts
 * in a single aggregation query for maximum performance
 */
class HierarchyService {
  /**
   * Get complete workspace hierarchy with task counts
   * @param workspaceId - Workspace ID
   * @returns Hierarchical structure with spaces, folders, lists, and task counts
   */
  static async getWorkspaceHierarchy(workspaceId: string, userId: string, userRole?: string) {
    console.log('[HierarchyService] Starting Split Query Hierarchy for workspace:', workspaceId, 'user:', userId);

    const Space = require('../models/Space');
    const Folder = require('../models/Folder');
    const List = require('../models/List');
    const SpaceMember = require('../models/SpaceMember');
    const FolderMember = require('../models/FolderMember');
    const ListMember = require('../models/ListMember').ListMember;
    const Task = require('../models/Task');

    // 1. Fetch Basic Data
    const workspace = await Workspace.findById(workspaceId).select('name logo owner members').lean();
    if (!workspace) throw new AppError('Workspace not found', 404);

    const isAdmin = userRole === 'admin' || userRole === 'owner';

    // Fetch all resources in this workspace
    const allSpaces = await Space.find({ workspace: workspaceId, isDeleted: false }).lean();
    const spaceIds = allSpaces.map((s: any) => s._id);

    const [allFolders, allLists, spaceMemberships, folderMemberships, listMemberships] = await Promise.all([
      Folder.find({ spaceId: { $in: spaceIds }, isDeleted: false }).lean(),
      List.find({ workspace: workspaceId, isDeleted: false }).lean(),
      SpaceMember.find({ workspace: workspaceId, user: userId }).lean(),
      FolderMember.find({ workspace: workspaceId, user: userId }).lean(),
      ListMember.find({ workspace: workspaceId, user: userId }).lean()
    ]);

    const spaceMemberIds = new Set(spaceMemberships.map((m: any) => m.space.toString()));
    const folderMemberIds = new Set(folderMemberships.map((m: any) => m.folder.toString()));
    const listMemberIds = new Set(listMemberships.map((m: any) => m.list.toString()));

    // 2. Resolve Visibility (Bottom-Up for Pathway)
    const visibleListIds = new Set<string>();
    const visibleFolderIds = new Set<string>();
    const visibleSpaceIds = new Set<string>();

    // Step A: Determine direct List visibility
    for (const list of allLists) {
      const isDirectListMember = list.members?.some((m: any) => m.user.toString() === userId) || 
                                 listMemberIds.has(list._id.toString());
      const parentFolderId = list.folderId?.toString();
      const parentSpaceId = list.space?.toString();

      const hasAccess = isAdmin || 
                        (parentSpaceId && spaceMemberIds.has(parentSpaceId)) ||
                        (parentFolderId && folderMemberIds.has(parentFolderId)) ||
                        isDirectListMember;

      if (hasAccess) {
        visibleListIds.add(list._id.toString());
        if (parentFolderId) visibleFolderIds.add(parentFolderId.toString());
        if (parentSpaceId) visibleSpaceIds.add(parentSpaceId.toString());
      }
    }

    // Step B: Determine Folder visibility (direct or via nested lists)
    for (const folder of allFolders) {
      const folderId = folder._id.toString();
      const parentSpaceId = folder.spaceId?.toString();
      
      const hasAccess = isAdmin || 
                        (parentSpaceId && spaceMemberIds.has(parentSpaceId)) ||
                        folderMemberIds.has(folderId) ||
                        visibleFolderIds.has(folderId);

      if (hasAccess) {
        visibleFolderIds.add(folderId);
        if (parentSpaceId) visibleSpaceIds.add(parentSpaceId.toString());
      }
    }

    // Step C: Determine Space visibility (direct or via nested folders/lists)
    for (const space of allSpaces) {
      const spaceId = space._id.toString();
      const isSpaceOwner = space.owner?.toString() === userId;
      const isDirectSpaceMember = space.members?.some((m: any) => m.user.toString() === userId);

      const hasAccess = isAdmin || 
                        isSpaceOwner || 
                        isDirectSpaceMember || 
                        spaceMemberIds.has(spaceId) || 
                        visibleSpaceIds.has(spaceId);

      if (hasAccess) {
        visibleSpaceIds.add(spaceId);
      }
    }

    // 3. Fetch Task Counts for visible lists
    const visibleListArray = Array.from(visibleListIds);
    const taskCounts = await Task.aggregate([
      { $match: { list: { $in: visibleListArray.map(id => new mongoose.Types.ObjectId(id)) }, isDeleted: false } },
      { $group: { _id: '$list', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } } } }
    ]);

    interface TaskCount {
      _id: any;
      total: number;
      completed: number;
    }

    const taskCountMap = new Map<string, TaskCount>(taskCounts.map((c: any) => [c._id.toString(), c]));

    // 4. Assemble the Tree
    const tree = allSpaces
      .filter((s: any) => visibleSpaceIds.has(s._id.toString()))
      .map((space: any) => {
        const spaceId = space._id.toString();
        
        // Find folders for this space
        const folders = allFolders
          .filter((f: any) => f.spaceId?.toString() === spaceId && visibleFolderIds.has(f._id.toString()))
          .map((folder: any) => {
            const folderId = folder._id.toString();
            
            // Find lists for this folder
            const lists = allLists
              .filter((l: any) => l.folderId?.toString() === folderId && visibleListIds.has(l._id.toString()))
              .map((list: any) => ({
                _id: list._id,
                name: list.name,
                space: list.space,
                workspace: list.workspace,
                folderId: list.folderId,
                taskCount: taskCountMap.get(list._id.toString())?.total || 0,
                createdAt: list.createdAt
              }));

            return {
              _id: folder._id,
              name: folder.name,
              color: folder.color,
              icon: folder.icon,
              lists,
              createdAt: folder.createdAt
            };
          });

        // Find standalone lists for this space
        const standaloneLists = allLists
          .filter((l: any) => l.space?.toString() === spaceId && !l.folderId && visibleListIds.has(l._id.toString()))
          .map((list: any) => ({
            _id: list._id,
            name: list.name,
            space: list.space,
            workspace: list.workspace,
            folderId: null,
            taskCount: taskCountMap.get(list._id.toString())?.total || 0,
            createdAt: list.createdAt
          }));

        // Calculate total/completed tasks for space
        let totalTasks = 0;
        let completedTasks = 0;
        
        // Sum from standalone lists
        standaloneLists.forEach(l => {
          totalTasks += l.taskCount;
          completedTasks += taskCountMap.get(l._id.toString())?.completed || 0;
        });
        
        // Sum from folders
        folders.forEach(f => {
          f.lists.forEach((l: any) => {
            totalTasks += l.taskCount;
            completedTasks += taskCountMap.get(l._id.toString())?.completed || 0;
          });
        });

        return {
          _id: space._id,
          name: space.name,
          description: space.description,
          status: space.status,
          color: space.color,
          folders,
          lists: standaloneLists, // Renamed to match frontend interface
          totalTasks,
          completedTasks,
          createdAt: space.createdAt
        };
      });

    console.log('[HierarchyService] Split Query Finished. Returning spaces:', tree.length);

    return {
      workspaceId: workspace._id,
      workspaceName: workspace.name,
      logo: workspace.logo,
      spaces: tree
    };
  }
}

export default HierarchyService;

