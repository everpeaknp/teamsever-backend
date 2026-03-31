"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIMIT_CONFIG = exports.DEFAULT_LIMITS = void 0;
/**
 * Default fallback limits for various resources when no plan or free plan is found.
 */
exports.DEFAULT_LIMITS = {
    workspaces: 1,
    members: 5,
    tasks: 100,
    spaces: 2,
    lists: 4,
    folders: 2,
    tables: 0,
    rows: 0
};
exports.LIMIT_CONFIG = {
    workspaces: {
        planField: 'maxWorkspaces',
        usageField: 'totalWorkspaces',
        defaultLimit: exports.DEFAULT_LIMITS.workspaces,
        errorCode: 'WORKSPACE_LIMIT_REACHED',
        message: (max) => `You've reached your workspace limit (${max}). Upgrade your plan to create more workspaces and expand your team's productivity.`
    },
    members: {
        planField: 'maxMembers',
        usageField: '', // Custom logic handled in middleware
        defaultLimit: exports.DEFAULT_LIMITS.members,
        errorCode: 'MEMBER_LIMIT_REACHED',
        message: (max, current) => `This workspace has reached its member limit (${current}/${max}). Upgrade your plan to add more team members.`
    },
    tasks: {
        planField: 'maxTasks',
        usageField: 'totalTasks',
        defaultLimit: exports.DEFAULT_LIMITS.tasks,
        errorCode: 'TASK_LIMIT_REACHED',
        message: (max) => `You've reached your task limit (${max} tasks). Upgrade your plan to create unlimited tasks and manage larger projects.`
    },
    spaces: {
        planField: 'maxSpaces',
        usageField: 'totalSpaces',
        defaultLimit: exports.DEFAULT_LIMITS.spaces,
        errorCode: 'SPACE_LIMIT_REACHED',
        message: (max) => `You've reached your space limit (${max} spaces). Upgrade your plan to create more spaces and organize your work better.`
    },
    lists: {
        planField: 'maxLists',
        usageField: 'totalLists',
        defaultLimit: exports.DEFAULT_LIMITS.lists,
        errorCode: 'LIST_LIMIT_REACHED',
        message: (max) => `You've reached your list limit (${max} lists). Upgrade your plan to create more lists and manage your tasks better.`
    },
    folders: {
        planField: 'maxFolders',
        usageField: 'totalFolders',
        useInheritance: true,
        defaultLimit: exports.DEFAULT_LIMITS.folders,
        errorCode: 'FOLDER_LIMIT_REACHED',
        message: (max) => `You've reached your folder limit (${max} folders). Upgrade your plan to create more folders and organize your spaces better.`
    },
    tables: {
        planField: 'maxTablesCount',
        featureField: 'canCreateTables',
        usageField: 'totalTables',
        useInheritance: true,
        defaultLimit: exports.DEFAULT_LIMITS.tables,
        errorCode: 'TABLE_LIMIT_REACHED',
        featureErrorCode: 'TABLES_FEATURE_UNAVAILABLE',
        message: (max) => `You've reached your table limit (${max} tables). Upgrade your plan to create more tables and organize your data better.`,
        featureMessage: "Custom tables are not available in your current plan. Upgrade to Pro or Enterprise to unlock this feature."
    },
    rows: {
        planField: 'maxRowsLimit',
        usageField: 'totalRows',
        defaultLimit: exports.DEFAULT_LIMITS.rows,
        errorCode: 'ROW_LIMIT_REACHED',
        message: (max) => `You've reached your row limit (${max} rows). Upgrade your plan to add more rows to your tables.`
    }
};
