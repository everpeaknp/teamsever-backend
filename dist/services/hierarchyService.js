"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
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
    static async getWorkspaceHierarchy(workspaceId) {
        console.log('[HierarchyService] Fetching hierarchy for workspace:', workspaceId);
        // Validate ObjectId
        if (!mongoose_1.default.Types.ObjectId.isValid(workspaceId)) {
            throw new AppError('Invalid workspace ID', 400);
        }
        const workspaceObjectId = new mongoose_1.default.Types.ObjectId(workspaceId);
        // Single aggregation pipeline to fetch entire hierarchy
        const result = await Workspace.aggregate([
            // Stage 1: Match the workspace
            {
                $match: {
                    _id: workspaceObjectId,
                    isDeleted: false
                }
            },
            // Stage 2: Lookup Spaces
            {
                $lookup: {
                    from: 'spaces',
                    let: { workspaceId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$workspace', '$$workspaceId'] },
                                        { $eq: ['$isDeleted', false] }
                                    ]
                                }
                            }
                        },
                        {
                            $sort: { createdAt: 1 }
                        },
                        // Lookup Folders for each Space
                        {
                            $lookup: {
                                from: 'folders',
                                let: { spaceId: '$_id' },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: {
                                                $and: [
                                                    { $eq: ['$spaceId', '$$spaceId'] },
                                                    { $eq: ['$isDeleted', false] }
                                                ]
                                            }
                                        }
                                    },
                                    {
                                        $sort: { createdAt: 1 }
                                    },
                                    // Lookup Lists for each Folder
                                    {
                                        $lookup: {
                                            from: 'lists',
                                            let: { folderId: '$_id' },
                                            pipeline: [
                                                {
                                                    $match: {
                                                        $expr: {
                                                            $and: [
                                                                { $eq: ['$folderId', '$$folderId'] },
                                                                { $eq: ['$isDeleted', false] }
                                                            ]
                                                        }
                                                    }
                                                },
                                                {
                                                    $sort: { createdAt: 1 }
                                                },
                                                // Lookup Task Count for each List
                                                {
                                                    $lookup: {
                                                        from: 'tasks',
                                                        let: { listId: '$_id' },
                                                        pipeline: [
                                                            {
                                                                $match: {
                                                                    $expr: {
                                                                        $and: [
                                                                            { $eq: ['$list', '$$listId'] },
                                                                            { $eq: ['$isDeleted', false] }
                                                                        ]
                                                                    }
                                                                }
                                                            },
                                                            {
                                                                $count: 'count'
                                                            }
                                                        ],
                                                        as: 'taskCountResult'
                                                    }
                                                },
                                                // Add taskCount field
                                                {
                                                    $addFields: {
                                                        taskCount: {
                                                            $ifNull: [
                                                                { $arrayElemAt: ['$taskCountResult.count', 0] },
                                                                0
                                                            ]
                                                        }
                                                    }
                                                },
                                                // Project only needed fields
                                                {
                                                    $project: {
                                                        _id: 1,
                                                        name: 1,
                                                        taskCount: 1,
                                                        createdAt: 1
                                                    }
                                                }
                                            ],
                                            as: 'lists'
                                        }
                                    },
                                    // Project folder fields
                                    {
                                        $project: {
                                            _id: 1,
                                            name: 1,
                                            color: 1,
                                            icon: 1,
                                            lists: 1,
                                            createdAt: 1
                                        }
                                    }
                                ],
                                as: 'folders'
                            }
                        },
                        // Lookup Lists directly under Space (not in folders)
                        {
                            $lookup: {
                                from: 'lists',
                                let: { spaceId: '$_id' },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: {
                                                $and: [
                                                    { $eq: ['$space', '$$spaceId'] },
                                                    { $eq: ['$isDeleted', false] },
                                                    {
                                                        $or: [
                                                            { $eq: ['$folderId', null] },
                                                            { $not: { $ifNull: ['$folderId', false] } }
                                                        ]
                                                    }
                                                ]
                                            }
                                        }
                                    },
                                    {
                                        $sort: { createdAt: 1 }
                                    },
                                    // Lookup Task Count for each List
                                    {
                                        $lookup: {
                                            from: 'tasks',
                                            let: { listId: '$_id' },
                                            pipeline: [
                                                {
                                                    $match: {
                                                        $expr: {
                                                            $and: [
                                                                { $eq: ['$list', '$$listId'] },
                                                                { $eq: ['$isDeleted', false] }
                                                            ]
                                                        }
                                                    }
                                                },
                                                {
                                                    $count: 'count'
                                                }
                                            ],
                                            as: 'taskCountResult'
                                        }
                                    },
                                    // Add taskCount field
                                    {
                                        $addFields: {
                                            taskCount: {
                                                $ifNull: [
                                                    { $arrayElemAt: ['$taskCountResult.count', 0] },
                                                    0
                                                ]
                                            }
                                        }
                                    },
                                    // Project only needed fields
                                    {
                                        $project: {
                                            _id: 1,
                                            name: 1,
                                            taskCount: 1,
                                            createdAt: 1
                                        }
                                    }
                                ],
                                as: 'lists'
                            }
                        },
                        // Project space fields
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                description: 1,
                                status: 1,
                                folders: 1,
                                lists: 1,
                                createdAt: 1
                            }
                        }
                    ],
                    as: 'spaces'
                }
            },
            // Stage 3: Project final structure
            {
                $project: {
                    _id: 1,
                    name: 1,
                    spaces: 1
                }
            }
        ]);
        // Handle empty result
        if (!result || result.length === 0) {
            throw new AppError('Workspace not found', 404);
        }
        const hierarchy = result[0];
        console.log('[HierarchyService] Hierarchy fetched successfully', {
            workspaceId,
            spacesCount: hierarchy.spaces?.length || 0
        });
        return {
            workspaceId: hierarchy._id,
            workspaceName: hierarchy.name,
            spaces: hierarchy.spaces || []
        };
    }
}
exports.default = HierarchyService;
