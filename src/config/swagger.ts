import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Workspace App API",
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
        name: "Teamsever API Support",
        email: "teamsever@gmail.com"
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT"
      }
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Local Development"
      },
      {
        url: "https://teamsever-backend.vercel.app",
        description: "Production"
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
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", description: "Error message" },
            stack: { type: "string", description: "Stack trace (development only)" }
          }
        },
        ApiResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Operation successful" },
            data: { type: "object", nullable: true }
          }
        },
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
            profilePicture: {
              type: "string",
              description: "URL to profile picture"
            },
            createdAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        AuthResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Login successful" },
            data: {
              type: "object",
              properties: {
                token: { type: "string" },
                user: { $ref: "#/components/schemas/User" }
              }
            }
          }
        },
        UserResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Profile retrieved successfully" },
            data: { $ref: "#/components/schemas/User" }
          }
        },
        WorkspaceResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Workspace operation successful" },
            data: { $ref: "#/components/schemas/Workspace" }
          }
        },
        WorkspaceListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Workspace" }
            }
          }
        },
        MemberListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  name: { type: "string" },
                  email: { type: "string" },
                  role: { type: "string" },
                  status: { type: "string" },
                  isOwner: { type: "boolean" },
                  customRoleTitle: { type: "string", nullable: true },
                  avatar: { type: "string", nullable: true },
                  profilePicture: { type: "string", nullable: true }
                }
              }
            }
          }
        },
        Workspace: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string", description: "Workspace name" },
            logo: { type: "string", nullable: true },
            owner: { type: "string", description: "Owner user ID" },
            members: {
              type: "array",
              items: { $ref: "#/components/schemas/WorkspaceMember" }
            },
            createdAt: { type: "string", format: "date-time" }
          }
        },
        WorkspaceMember: {
          type: "object",
          properties: {
            user: {
              oneOf: [
                { type: "string" },
                { $ref: "#/components/schemas/User" }
              ]
            },
            role: { type: "string", enum: ["owner", "admin", "member"] },
            status: { type: "string", enum: ["active", "inactive"] },
            customRoleTitle: { type: "string", nullable: true },
            joinedAt: { type: "string", format: "date-time" }
          }
        },
        Announcement: {
          type: "object",
          properties: {
            _id: { type: "string" },
            title: { type: "string" },
            content: { type: "string" },
            author: { 
              oneOf: [
                { type: "string" },
                { $ref: "#/components/schemas/User" }
              ]
            },
            workspace: { type: "string" },
            createdAt: { type: "string", format: "date-time" }
          }
        },
        HierarchySpace: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            folders: {
              type: "array",
              items: { $ref: "#/components/schemas/HierarchyFolder" }
            },
            standaloneLists: {
              type: "array",
              items: { $ref: "#/components/schemas/HierarchyList" }
            }
          }
        },
        HierarchyFolder: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            color: { type: "string", nullable: true },
            lists: {
              type: "array",
              items: { $ref: "#/components/schemas/HierarchyList" }
            }
          }
        },
        HierarchyList: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            color: { type: "string", nullable: true }
          }
        },
        SpaceResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Space operation successful" },
            data: { $ref: "#/components/schemas/Space" }
          }
        },
        SpaceListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Space" }
            }
          }
        },
        FolderResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Folder operation successful" },
            data: {
              type: "object",
              properties: {
                _id: { type: "string" },
                name: { type: "string" },
                color: { type: "string" },
                space: { type: "string" }
              }
            }
          }
        },
        FolderListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/FolderResponse" }
            }
          }
        },
        ListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "List operation successful" },
            data: {
              type: "object",
              properties: {
                _id: { type: "string" },
                name: { type: "string" },
                space: { type: "string" },
                folder: { type: "string", nullable: true }
              }
            }
          }
        },
        ListListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/ListResponse" }
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
        TaskResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Task operation successful" },
            data: { $ref: "#/components/schemas/Task" }
          }
        },
        TaskListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Task" }
            }
          }
        },
        DependencyResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                _id: { type: "string" },
                taskId: { type: "string" },
                dependsOnId: { type: "string" },
                type: { type: "string" }
              }
            }
          }
        },
        DependencyListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/DependencyResponse" }
            }
          }
        },
        TimeTrackingResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            data: { type: "object" }
          }
        },
        StickyNoteResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                content: { type: "string" },
                updatedAt: { type: "string", format: "date-time" }
              }
            }
          }
        },
        ActivityResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Activity retrieved successfully" },
            data: { $ref: "#/components/schemas/WorkspaceActivity" }
          }
        },
        ActivityListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/WorkspaceActivity" }
            }
          }
        },
        PerformanceResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Performance data retrieved successfully" },
            data: { $ref: "#/components/schemas/PerformanceMetrics" }
          }
        },
        NotificationResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            data: { type: "object" }
          }
        },
        AnalyticsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Consolidated analytics data retrieved successfully" },
            data: {
              type: "object",
              properties: {
                workspace: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    logo: { type: "string", nullable: true },
                    owner: { $ref: "#/components/schemas/User" }
                  }
                },
                stats: {
                  type: "object",
                  properties: {
                    totalTasks: { type: "number" },
                    completedTasks: { type: "number" },
                    completionRate: { type: "number" },
                    priorityBreakdown: { type: "object", additionalProperties: { type: "number" } },
                    statusBreakdown: { type: "object", additionalProperties: { type: "number" } }
                  }
                },
                hierarchy: {
                  type: "array",
                  items: { $ref: "#/components/schemas/HierarchySpace" }
                },
                members: {
                  type: "array",
                  items: { $ref: "#/components/schemas/WorkspaceMember" }
                },
                tasks: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Task" }
                },
                announcements: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Announcement" }
                },
                currentRunningTimer: {
                  type: "object",
                  nullable: true,
                  properties: {
                    _id: { type: "string" },
                    startTime: { type: "string", format: "date-time" },
                    isRunning: { type: "boolean" },
                    description: { type: "string" },
                    task: {
                      type: "object",
                      properties: {
                        _id: { type: "string" },
                        title: { type: "string" }
                      }
                    }
                  }
                },
                stickyNote: { type: "string", nullable: true },
                recentActivity: {
                  type: "array",
                  items: { $ref: "#/components/schemas/WorkspaceActivity" }
                },
                performance: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/PerformanceMetrics" },
                    team: { $ref: "#/components/schemas/PerformanceMetrics", nullable: true }
                  }
                },
                velocity: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      date: { type: "string", format: "date" },
                      completedCount: { type: "number" }
                    }
                  }
                }
              }
            }
          }
        },
        HierarchyResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Workspace hierarchy retrieved successfully" },
            data: {
              type: "object",
              properties: {
                spaces: {
                  type: "array",
                  items: { $ref: "#/components/schemas/HierarchySpace" }
                }
              }
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
        },
        StickyNote: {
          type: "object",
          properties: {
            _id: { type: "string" },
            content: { type: "string" },
            workspace: { type: "string" },
            user: { type: "string" },
            updatedAt: { type: "string", format: "date-time" }
          }
        },
        PerformanceMetrics: {
          type: "object",
          properties: {
            totalTasksFinished: { type: "number" },
            averageTimePerTask: { type: "number", description: "In seconds" },
            deadlineSuccessRate: { type: "number", description: "Percentage" },
            performanceNote: { type: "string" }
          }
        },
        WorkspaceActivity: {
          type: "object",
          properties: {
            _id: { type: "string" },
            type: { type: "string" },
            description: { type: "string" },
            user: {
              type: "object",
              properties: {
                name: { type: "string" },
                avatar: { type: "string" }
              }
            },
            createdAt: { type: "string", format: "date-time" }
          }
        },
        ClockToggleResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                status: { type: "string", enum: ["active", "inactive"] },
                timeEntry: {
                  type: "object",
                  nullable: true,
                  properties: {
                    _id: { type: "string" },
                    startTime: { type: "string", format: "date-time" },
                    endTime: { type: "string", format: "date-time", nullable: true },
                    duration: { type: "number", nullable: true },
                    isRunning: { type: "boolean" }
                  }
                }
              }
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
        name: "Dashboard & Analytics",
        description: "🚀 PRIMARY DASHBOARD — ALL-IN-ONE data source for Flutter. Use GET /api/workspaces/{id}/analytics for the main screen."
      },
      {
        name: "Auth & User",
        description: "Registration, Login, Password Reset, and User Profile management"
      },
      {
        name: "Workspace Management",
        description: "Core Workspace CRUD, Settings, Logo, and Members"
      },
      {
        name: "Project Hierarchy",
        description: "Organizational structure: Spaces, Folders, and Lists"
      },
      {
        name: "Task Management",
        description: "Tasks, Subtasks, Dependencies (Gantt logic), and Recurring tasks"
      },
      {
        name: "Attendance & Reporting",
        description: "Clock-in/out tracking and detailed attendance reports (CSV/Excel)"
      },
      {
        name: "Attachments & Media",
        description: "Task attachments, Workspace files, and Cloudinary uploads"
      },
      {
        name: "Custom Tables",
        description: "Excel-like custom tables and database management"
      },
      {
        name: "Productivity",
        description: "Sticky Notes, Time Tracking (Task timers), and Performance metrics"
      },
      {
        name: "Collaboration",
        description: "Chat (Group & DM), Comments, Activity Feed, and Presence"
      },
      {
        name: "System & Admin",
        description: "Plans, Subscriptions, Payments, Entitlements, and Super-Admin panel"
      }
    ]
  },
  apis: [
    "./src/routes/*.ts"
  ]
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
