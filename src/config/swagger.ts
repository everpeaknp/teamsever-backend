import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "ClickUp Clone API",
      version: "1.0.0",
      description: `
        A comprehensive project management API with features including:
        - Workspace and team management with subscription plans
        - Hierarchical task organization (Workspaces → Spaces → Lists → Tasks)
        - Real-time collaboration via WebSockets
        - Recurring tasks with cron-based automation
        - Task dependencies with cascading logic
        - Advanced analytics and reporting
        - File attachments via Cloudinary
        - Activity tracking and commenting
        - Custom fields and time tracking
        - Custom tables with Excel-like features
        - Document management and collaboration
        - Direct messaging between users
        - Push notifications (FCM)
        - Entitlement and subscription management
        - Super admin dashboard
      `,
      contact: {
        name: "API Support",
        email: "support@clickupclone.com"
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT"
      }
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Development server"
      },
      {
        url: "https://api.clickupclone.com",
        description: "Production server"
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token in the format: Bearer <token>"
        }
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Error message"
            },
            stack: {
              type: "string",
              description: "Stack trace (development only)"
            }
          }
        },
        User: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "User ID"
            },
            name: {
              type: "string",
              description: "User's full name"
            },
            email: {
              type: "string",
              format: "email",
              description: "User's email address"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        Workspace: {
          type: "object",
          properties: {
            _id: {
              type: "string"
            },
            name: {
              type: "string",
              description: "Workspace name"
            },
            owner: {
              type: "string",
              description: "Owner user ID"
            },
            members: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  user: {
                    type: "string",
                    description: "User ID"
                  },
                  role: {
                    type: "string",
                    enum: ["owner", "admin", "member"],
                    description: "User role in workspace"
                  },
                  joinedAt: {
                    type: "string",
                    format: "date-time"
                  }
                }
              }
            },
            createdAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        Space: {
          type: "object",
          properties: {
            _id: {
              type: "string"
            },
            name: {
              type: "string",
              description: "Space/Project name"
            },
            workspace: {
              type: "string",
              description: "Parent workspace ID"
            },
            owner: {
              type: "string",
              description: "Owner user ID"
            },
            members: {
              type: "array",
              items: {
                type: "object"
              }
            },
            createdAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        List: {
          type: "object",
          properties: {
            _id: {
              type: "string"
            },
            name: {
              type: "string",
              description: "List name"
            },
            space: {
              type: "string",
              description: "Parent space ID"
            },
            workspace: {
              type: "string",
              description: "Parent workspace ID"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        Task: {
          type: "object",
          properties: {
            _id: {
              type: "string"
            },
            title: {
              type: "string",
              description: "Task title"
            },
            description: {
              type: "string",
              description: "Task description"
            },
            status: {
              type: "string",
              enum: ["todo", "in-progress", "done"],
              description: "Task status"
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "urgent"],
              description: "Task priority"
            },
            list: {
              type: "string",
              description: "Parent list ID"
            },
            space: {
              type: "string",
              description: "Parent space ID"
            },
            workspace: {
              type: "string",
              description: "Parent workspace ID"
            },
            assignee: {
              type: "string",
              description: "Assigned user ID"
            },
            createdBy: {
              type: "string",
              description: "Creator user ID"
            },
            dueDate: {
              type: "string",
              format: "date-time",
              description: "Task due date"
            },
            startDate: {
              type: "string",
              format: "date-time",
              description: "Task start date (for Gantt)"
            },
            completedAt: {
              type: "string",
              format: "date-time",
              description: "Task completion timestamp"
            },
            isRecurring: {
              type: "boolean",
              description: "Whether task is recurring"
            },
            frequency: {
              type: "string",
              enum: ["daily", "weekly", "monthly", "custom"],
              description: "Recurrence frequency"
            },
            interval: {
              type: "number",
              description: "Recurrence interval (e.g., every 2 weeks)"
            },
            nextOccurrence: {
              type: "string",
              format: "date-time",
              description: "Next scheduled occurrence"
            },
            recurrenceEnd: {
              type: "string",
              format: "date-time",
              description: "When recurrence should stop"
            },
            isMilestone: {
              type: "boolean",
              description: "Whether task is a milestone (startDate === dueDate)"
            },
            customFieldValues: {
              type: "array",
              items: {
                type: "object"
              },
              description: "Custom field values"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            },
            updatedAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        TaskDependency: {
          type: "object",
          properties: {
            _id: {
              type: "string"
            },
            dependencySource: {
              type: "string",
              description: "Source task ID (the task that must be completed first)"
            },
            dependencyTarget: {
              type: "string",
              description: "Target task ID (the task that depends on the source)"
            },
            type: {
              type: "string",
              enum: ["FS", "SS", "FF", "SF"],
              description: "Dependency type: FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish)"
            },
            workspace: {
              type: "string",
              description: "Parent workspace ID"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        Activity: {
          type: "object",
          properties: {
            _id: {
              type: "string"
            },
            task: {
              type: "string",
              description: "Task ID"
            },
            user: {
              type: "string",
              description: "User who performed the action"
            },
            type: {
              type: "string",
              enum: ["comment", "update"],
              description: "Activity type"
            },
            content: {
              type: "string",
              description: "Comment content or update description"
            },
            fieldChanged: {
              type: "string",
              description: "Field that was changed (for updates)"
            },
            oldValue: {
              type: "string",
              description: "Previous value (for updates)"
            },
            newValue: {
              type: "string",
              description: "New value (for updates)"
            },
            isSystemGenerated: {
              type: "boolean",
              description: "Whether this was auto-generated"
            },
            mentions: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Mentioned user IDs"
            },
            reactions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  user: {
                    type: "string"
                  },
                  emoji: {
                    type: "string"
                  }
                }
              }
            },
            createdAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        Attachment: {
          type: "object",
          properties: {
            _id: {
              type: "string"
            },
            task: {
              type: "string",
              description: "Task ID"
            },
            uploadedBy: {
              type: "string",
              description: "User who uploaded the file"
            },
            fileName: {
              type: "string",
              description: "Original file name"
            },
            fileSize: {
              type: "number",
              description: "File size in bytes"
            },
            mimeType: {
              type: "string",
              description: "File MIME type"
            },
            cloudinaryUrl: {
              type: "string",
              description: "Cloudinary URL"
            },
            cloudinaryPublicId: {
              type: "string",
              description: "Cloudinary public ID"
            },
            thumbnailUrl: {
              type: "string",
              description: "Thumbnail URL (for images)"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        WorkspaceFile: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "File ID"
            },
            workspace: {
              type: "string",
              description: "Workspace ID"
            },
            uploadedBy: {
              type: "object",
              properties: {
                _id: {
                  type: "string"
                },
                name: {
                  type: "string"
                },
                email: {
                  type: "string"
                },
                avatar: {
                  type: "string"
                }
              },
              description: "User who uploaded the file"
            },
            fileName: {
              type: "string",
              description: "File name"
            },
            originalName: {
              type: "string",
              description: "Original file name"
            },
            fileType: {
              type: "string",
              description: "MIME type"
            },
            fileSize: {
              type: "number",
              description: "File size in bytes"
            },
            cloudinaryUrl: {
              type: "string",
              description: "Cloudinary URL"
            },
            cloudinaryPublicId: {
              type: "string",
              description: "Cloudinary public ID"
            },
            resourceType: {
              type: "string",
              enum: ["image", "video", "raw", "auto"],
              description: "Resource type"
            },
            format: {
              type: "string",
              description: "File format"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            },
            updatedAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        AnalyticsSummary: {
          type: "object",
          properties: {
            totalTasks: {
              type: "number",
              description: "Total number of tasks"
            },
            completedTasks: {
              type: "number",
              description: "Number of completed tasks"
            },
            completionRate: {
              type: "number",
              description: "Completion rate percentage"
            },
            priorityDistribution: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: {
                    type: "string"
                  },
                  value: {
                    type: "number"
                  }
                }
              },
              description: "Tasks grouped by priority"
            },
            statusDistribution: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: {
                    type: "string"
                  },
                  value: {
                    type: "number"
                  }
                }
              },
              description: "Tasks grouped by status"
            },
            velocity: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: {
                    type: "string"
                  },
                  completed: {
                    type: "number"
                  }
                }
              },
              description: "Tasks completed per day (last 14 days)"
            },
            leadTime: {
              type: "number",
              description: "Average days from creation to completion"
            }
          }
        },
        Plan: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Plan ID"
            },
            name: {
              type: "string",
              description: "Plan name"
            },
            price: {
              type: "number",
              description: "Plan price (kept for backward compatibility, same as basePrice)"
            },
            baseCurrency: {
              type: "string",
              enum: ["USD", "NPR"],
              description: "Base currency for the plan price",
              example: "NPR"
            },
            basePrice: {
              type: "number",
              description: "Plan price in base currency",
              example: 1000
            },
            description: {
              type: "string",
              description: "Plan description"
            },
            maxWorkspaces: {
              type: "number",
              description: "Maximum number of workspaces (-1 for unlimited)"
            },
            maxSpaces: {
              type: "number",
              description: "Maximum number of spaces per workspace (-1 for unlimited)"
            },
            maxLists: {
              type: "number",
              description: "Maximum number of lists per workspace (-1 for unlimited)"
            },
            maxFolders: {
              type: "number",
              description: "Maximum number of folders per workspace (-1 for unlimited)"
            },
            maxTasks: {
              type: "number",
              description: "Maximum number of tasks per workspace (-1 for unlimited)"
            },
            maxMembers: {
              type: "number",
              description: "Maximum number of members per workspace (-1 for unlimited)"
            },
            maxFiles: {
              type: "number",
              description: "Maximum number of files per workspace (-1 for unlimited)"
            },
            maxDocuments: {
              type: "number",
              description: "Maximum number of documents per workspace (-1 for unlimited)"
            },
            maxDirectMessagesPerUser: {
              type: "number",
              description: "Maximum direct messages per recipient (-1 for unlimited)"
            },
            hasAccessControl: {
              type: "boolean",
              description: "Whether advanced access control is enabled"
            },
            messageLimit: {
              type: "number",
              description: "Maximum number of workspace messages (-1 for unlimited)"
            },
            canUseCustomRoles: {
              type: "boolean",
              description: "Whether custom roles feature is available"
            },
            canCreateTables: {
              type: "boolean",
              description: "Whether custom tables feature is available"
            },
            maxTablesCount: {
              type: "number",
              description: "Maximum number of custom tables (-1 for unlimited)"
            },
            maxRowsLimit: {
              type: "number",
              description: "Maximum rows per table (-1 for unlimited)"
            },
            maxColumnsLimit: {
              type: "number",
              description: "Maximum columns per table (-1 for unlimited)"
            },
            isActive: {
              type: "boolean",
              description: "Whether the plan is active"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            },
            updatedAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        CustomTable: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Table ID"
            },
            name: {
              type: "string",
              description: "Table name"
            },
            space: {
              type: "string",
              description: "Parent space ID"
            },
            workspace: {
              type: "string",
              description: "Parent workspace ID"
            },
            columns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  _id: {
                    type: "string"
                  },
                  title: {
                    type: "string"
                  },
                  type: {
                    type: "string",
                    enum: ["text", "link", "number"]
                  }
                }
              },
              description: "Table columns"
            },
            rows: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  _id: {
                    type: "string"
                  },
                  data: {
                    type: "object",
                    description: "Cell data (columnId -> value)"
                  },
                  colors: {
                    type: "object",
                    description: "Cell background colors (columnId -> hex color)"
                  },
                  textColors: {
                    type: "object",
                    description: "Cell text colors (columnId -> hex color)"
                  }
                }
              },
              description: "Table rows"
            },
            createdBy: {
              type: "string",
              description: "Creator user ID"
            },
            isDeleted: {
              type: "boolean",
              description: "Soft delete flag"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            },
            updatedAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        Document: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Document ID"
            },
            title: {
              type: "string",
              description: "Document title"
            },
            content: {
              type: "string",
              description: "Document content (rich text/markdown)"
            },
            workspace: {
              type: "string",
              description: "Parent workspace ID"
            },
            createdBy: {
              type: "string",
              description: "Creator user ID"
            },
            parentId: {
              type: "string",
              description: "Parent document ID (for nested documents)"
            },
            isArchived: {
              type: "boolean",
              description: "Archive status"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            },
            updatedAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        DirectMessage: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Message ID"
            },
            conversation: {
              type: "string",
              description: "Conversation ID"
            },
            sender: {
              type: "string",
              description: "Sender user ID"
            },
            content: {
              type: "string",
              description: "Message content"
            },
            attachments: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Attachment URLs"
            },
            isRead: {
              type: "boolean",
              description: "Read status"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        Subscription: {
          type: "object",
          properties: {
            plan: {
              type: "string",
              description: "Plan ID"
            },
            status: {
              type: "string",
              enum: ["trial", "active", "expired"],
              description: "Subscription status"
            },
            isPaid: {
              type: "boolean",
              description: "Whether subscription is paid"
            },
            trialStartDate: {
              type: "string",
              format: "date-time",
              description: "Trial start date"
            },
            trialEndDate: {
              type: "string",
              format: "date-time",
              description: "Trial end date"
            },
            startDate: {
              type: "string",
              format: "date-time",
              description: "Subscription start date"
            },
            endDate: {
              type: "string",
              format: "date-time",
              description: "Subscription end date"
            }
          }
        },
        Entitlement: {
          type: "object",
          properties: {
            allowed: {
              type: "boolean",
              description: "Whether action is allowed"
            },
            reason: {
              type: "string",
              description: "Reason if not allowed"
            },
            currentUsage: {
              type: "number",
              description: "Current usage count"
            },
            limit: {
              type: "number",
              description: "Maximum allowed (-1 for unlimited)"
            }
          }
        },
        Feedback: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Feedback ID"
            },
            workspace: {
              type: "string",
              description: "Workspace ID"
            },
            user: {
              type: "string",
              description: "User ID"
            },
            category: {
              type: "string",
              enum: ["bug", "feature", "improvement", "other"],
              description: "Feedback category"
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "Feedback priority"
            },
            message: {
              type: "string",
              description: "Feedback message"
            },
            status: {
              type: "string",
              enum: ["pending", "in-progress", "resolved", "rejected"],
              description: "Feedback status"
            },
            attachments: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Attachment URLs"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: "Auth",
        description: "Authentication and user management"
      },
      {
        name: "Workspaces",
        description: "Workspace management and member operations"
      },
      {
        name: "Invitations",
        description: "Workspace invitation system"
      },
      {
        name: "Spaces",
        description: "Space/Project management within workspaces"
      },
      {
        name: "Space Invitations",
        description: "Space-level invitation management"
      },
      {
        name: "Space Members",
        description: "Space-level member permission management"
      },
      {
        name: "Lists",
        description: "List management within spaces"
      },
      {
        name: "List Members",
        description: "List-level member permission management"
      },
      {
        name: "Folders",
        description: "Folder management within spaces"
      },
      {
        name: "Folder Members",
        description: "Folder-level member permission management"
      },
      {
        name: "Tasks",
        description: "Task CRUD operations and management"
      },
      {
        name: "Task Dependencies",
        description: "Task dependencies with cascading logic"
      },
      {
        name: "Recurring Tasks",
        description: "Recurring task automation with cron"
      },
      {
        name: "Activities",
        description: "Task comments and activity tracking"
      },
      {
        name: "Activity",
        description: "Activity tracking and comments management"
      },
      {
        name: "Comments",
        description: "Task comments management"
      },
      {
        name: "Attachments",
        description: "File uploads via Cloudinary"
      },
      {
        name: "Upload",
        description: "File upload management"
      },
      {
        name: "Workspace Files",
        description: "Workspace-wide file management"
      },
      {
        name: "Analytics",
        description: "Workspace analytics and reporting"
      },
      {
        name: "Dashboard",
        description: "Dashboard statistics and summaries"
      },
      {
        name: "Custom Fields",
        description: "Custom field definitions and values"
      },
      {
        name: "Custom Tables",
        description: "Custom table management within spaces"
      },
      {
        name: "Time Tracking",
        description: "Time entry management"
      },
      {
        name: "Time Entries",
        description: "Time tracking and time entry management"
      },
      {
        name: "Notifications",
        description: "Push notifications and notification center"
      },
      {
        name: "Notification Center",
        description: "User notification center management"
      },
      {
        name: "Chat",
        description: "Real-time workspace chat"
      },
      {
        name: "Direct Messages",
        description: "Private messaging between users"
      },
      {
        name: "Documents",
        description: "Document management and collaboration"
      },
      {
        name: "Plans",
        description: "Subscription plan management"
      },
      {
        name: "Subscription",
        description: "User subscription information and management"
      },
      {
        name: "Entitlements",
        description: "Feature entitlement checking and usage tracking"
      },
      {
        name: "Super Admin",
        description: "Super admin dashboard and system management"
      },
      {
        name: "Members",
        description: "Workspace member management"
      },
      {
        name: "Feedback",
        description: "User feedback submission and management"
      },
      {
        name: "Performance",
        description: "User and team performance metrics"
      },
      {
        name: "Presence",
        description: "User presence and online status"
      },
      {
        name: "Search",
        description: "Global search across tasks, spaces, and lists"
      }
    ]
  },
  apis: [
    "./src/routes/*.ts",
    "./src/routes/*.js",
    "./dist/routes/*.js"
  ]
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
