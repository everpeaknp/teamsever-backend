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
        PermissionLevel: {
          type: "string",
          enum: ["FULL", "EDIT", "COMMENT", "VIEW"],
          description: "Allowed levels: FULL, EDIT, COMMENT, VIEW. FULL: complete control, EDIT: can modify content, COMMENT: can only comment, VIEW: read-only access.",
          example: "EDIT"
        },
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
            status: { 
              type: "string", 
              enum: ["active", "inactive"],
              description: "Real-time clock-in status. 'active' means currently clocked into a task, 'inactive' means clocked out."
            },
            customRoleTitle: { type: "string", nullable: true },
            joinedAt: { type: "string", format: "date-time" }
          }
        },
        Announcement: {
          type: "object",
          properties: {
            _id: { type: "string" },
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
            description: { type: "string", nullable: true },
            status: { type: "string" },
            color: { type: "string", nullable: true },
            totalTasks: { type: "number" },
            completedTasks: { type: "number" },
            folders: {
              type: "array",
              items: { $ref: "#/components/schemas/HierarchyFolder" }
            },
            lists: {
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
            icon: { type: "string", nullable: true },
            lists: {
              type: "array",
              items: { $ref: "#/components/schemas/HierarchyList" }
            },
            createdAt: { type: "string", format: "date-time" }
          }
        },
        HierarchyList: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            space: { type: "string" },
            workspace: { type: "string" },
            folderId: { type: "string", nullable: true },
            taskCount: { type: "number" },
            createdAt: { type: "string", format: "date-time" }
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
            },
            folders: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  name: { type: "string" },
                  color: { type: "string" },
                  icon: { type: "string", nullable: true },
                  lists: {
                    type: "array",
                    items: { $ref: "#/components/schemas/List" }
                  }
                }
              }
            },
            lists: {
              type: "array",
              items: { $ref: "#/components/schemas/List" }
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
            data: { 
              type: "object",
              nullable: true,
              description: "Optional payload depending on the request"
            }
          }
        },
        DeviceRegistrationResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Device registered successfully" }
          }
        },
        Device: {
          type: "object",
          properties: {
            token: { type: "string" },
            platform: { type: "string", enum: ["web", "ios", "android"] },
            createdAt: { type: "string", format: "date-time" }
          }
        },
        DeviceListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Registered devices retrieved successfully" },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Device" }
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
        UsageStatus: {
          type: "object",
          properties: {
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
        },
        Invitation: {
          type: "object",
          properties: {
            _id: { type: "string" },
            email: { type: "string", format: "email" },
            workspaceId: { type: "string" },
            role: { type: "string", enum: ["admin", "member"] },
            invitedBy: { type: "string" },
            status: { type: "string", enum: ["pending", "accepted", "expired"] },
            expiresAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" }
          }
        },
        Notification: {
          type: "object",
          properties: {
            _id: { type: "string" },
            recipient: { type: "string" },
            type: { 
              type: "string",
              enum: [
                "TASK_ASSIGNED", "TASK_UPDATE", "TASK_STATUS_CHANGED",
                "TASK_PRIORITY_CHANGED", "COMMENT_ADDED", "COMMENT_UPDATED",
                "COMMENT_DELETED", "COMMENT_MENTION", "DM_NEW",
                "FILE_UPLOAD", "INVITATION", "INVITE_ACCEPTED",
                "SPACE_INVITATION", "SYSTEM"
              ]
            },
            title: { type: "string" },
            body: { type: "string" },
            data: { type: "object", additionalProperties: true },
            read: { type: "boolean" },
            readAt: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" }
          }
        },
        UserPresence: {
          type: "object",
          properties: {
            userId: { type: "string" },
            status: { type: "string", enum: ["online", "offline"] },
            lastSeen: { type: "string", format: "date-time" },
            deviceCount: { type: "number" },
            user: {
              type: "object",
              properties: {
                _id: { type: "string" },
                name: { type: "string" },
                email: { type: "string" }
              }
            }
          }
        },
        WorkspacePresence: {
          type: "object",
          properties: {
            workspaceId: { type: "string" },
            onlineUsers: {
              type: "array",
              items: { $ref: "#/components/schemas/UserPresence" }
            },
            offlineUsers: {
              type: "array",
              items: { $ref: "#/components/schemas/UserPresence" }
            },
            totalMembers: { type: "number" }
          }
        },
        BulkOperationResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                modifiedCount: { type: "number" }
              }
            }
          }
        },
        DMMessageInput: {
          type: "object",
          required: ["content"],
          properties: {
            content: { type: "string", example: "Hey! Did you see the new update?" },
            attachments: { type: "array", items: { type: "string" }, description: "Cloudinary URLs of attachments" }
          }
        },
        GlobalSearchResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                tasks: { type: "array", items: { $ref: "#/components/schemas/Task" } },
                spaces: { type: "array", items: { $ref: "#/components/schemas/Space" } },
                lists: { type: "array", items: { $ref: "#/components/schemas/List" } }
              }
            }
          }
        },
        ChatMessageInput: {
          type: "object",
          required: ["content"],
          properties: {
            channelId: { type: "string" },
            content: { type: "string" },
            mentions: { type: "array", items: { type: "string" } }
          }
        },
        ChatChannelCreateInput: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", description: "Channel name (e.g., Engineering)" },
            description: { type: "string" },
            type: { type: "string", enum: ["public", "private"] },
            members: { type: "array", items: { type: "string" }, description: "Initial members for private channel" }
          }
        },
        ChatChannelUpdateInput: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            type: { type: "string", enum: ["public", "private"] }
          }
        },
        RecurringTaskResponse: {
          allOf: [
            { $ref: "#/components/schemas/Task" },
            {
              type: "object",
              properties: {
                isRecurring: { type: "boolean", example: true },
                frequency: { type: "string", example: "weekly" },
                interval: { type: "number", example: 1 },
                nextOccurrence: { type: "string", format: "date-time" }
              }
            }
          ]
        },
        RecurringTaskListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/RecurringTaskResponse" }
            }
          }
        },
        RecurringTaskProcessResponse: {
          type: "object",
          properties: {
            processed: { type: "number", example: 5 },
            created: { type: "number", example: 5 },
            errors: { type: "number", example: 0 },
            details: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  taskId: { type: "string" },
                  title: { type: "string" },
                  success: { type: "boolean" },
                  error: { type: "string" }
                }
              }
            }
          }
        },
        RegisterInput: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", example: "John Doe" },
            email: { type: "string", format: "email", example: "john@example.com" },
            password: { type: "string", format: "password", example: "securePassword123" }
          }
        },
        AttachmentInitResponse: {
          type: "object",
          properties: {
            uploadUrl: { type: "string" },
            uploadPreset: { type: "string" },
            signature: { type: "string" }
          }
        },
        AttachmentConfirmInput: {
          type: "object",
          required: ["cloudinaryUrl", "cloudinaryPublicId", "fileName", "fileSize", "mimeType"],
          properties: {
            cloudinaryUrl: { type: "string" },
            cloudinaryPublicId: { type: "string" },
            fileName: { type: "string" },
            fileSize: { type: "number" },
            mimeType: { type: "string" },
            thumbnailUrl: { type: "string" }
          }
        },
        LoginInput: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "john@example.com" },
            password: { type: "string", format: "password", example: "securePassword123" }
          }
        },
        PasswordResetRequestInput: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", format: "email", example: "john@example.com" }
          }
        },
        PasswordResetInput: {
          type: "object",
          required: ["token", "password"],
          properties: {
            token: { type: "string" },
            password: { type: "string", format: "password", example: "newSecurePassword123" }
          }
        },
        CommentCreateInput: {
          type: "object",
          required: ["content"],
          properties: {
            content: { type: "string", example: "Great work! Can we also handle the edge case?" },
            mentions: { type: "array", items: { type: "string" }, example: ["69bce50b96fe109fe4e14ff6"] }
          }
        },
        CommentUpdateInput: {
          type: "object",
          required: ["content"],
          properties: {
            content: { type: "string" }
          }
        },
        ReactionInput: {
          type: "object",
          required: ["emoji"],
          properties: {
            emoji: { type: "string", example: "👍" }
          }
        },
        UserProfileUpdateInput: {
          type: "object",
          properties: {
            name: { type: "string", example: "John Updated" },
            jobTitle: { type: "string", example: "Senior Developer" },
            department: { type: "string", example: "Platform Team" },
            bio: { type: "string", example: "Passionate about scalable systems." },
            removeAvatar: {
              type: "string",
              enum: ["true", "false"],
              default: "false",
              description: "Set to 'true' to delete the current profile picture"
            },
            file: {
              type: "string",
              format: "binary",
              description: "New profile picture file"
            }
          }
        },
        SpaceCreateInput: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            color: { type: "string" },
            icon: { type: "string" }
          }
        },
        SpaceUpdateInput: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            color: { type: "string" },
            icon: { type: "string" }
          }
        },
        SpaceMemberInput: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "string" }
          }
        },
        SpaceInviteInput: {
          type: "object",
          required: ["emails"],
          properties: {
            emails: { type: "array", items: { type: "string" } }
          }
        },
        SpaceMetadataResponse: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            workspace: { type: "string" },
            color: { type: "string" },
            icon: { type: "string" },
            membersCount: { type: "number" }
          }
        },
        SpaceListMetadataResponse: {
          type: "array",
          items: {
            type: "object",
            properties: {
              _id: { type: "string" },
              name: { type: "string" },
              space: { type: "string" },
              workspace: { type: "string" },
              folder: { type: "string", nullable: true }
            }
          }
        },
        ListUpdateInput: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            color: { type: "string" }
          }
        },
        ProjectCreateInput: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            description: { type: "string" }
          }
        },
        ProjectUpdateInput: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" }
          }
        },
        TaskCreateInput: {
          type: "object",
          required: ["title"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["todo", "in-progress", "done"] },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
            assignee: { type: "string" },
            dueDate: { type: "string", format: "date-time" },
            startDate: { type: "string", format: "date-time" },
            isMilestone: { type: "boolean" },
            isRecurring: { type: "boolean" },
            frequency: { type: "string", enum: ["daily", "weekly", "monthly", "custom"] },
            interval: { type: "number" },
            nextOccurrence: { type: "string", format: "date-time" },
            recurrenceEnd: { type: "string", format: "date-time" },
            customFieldValues: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  value: { type: "string" }
                }
              }
            }
          }
        },
        TaskUpdateInput: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["todo", "in-progress", "done"] },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
            assignee: { type: "string" },
            dueDate: { type: "string", format: "date-time" },
            startDate: { type: "string", format: "date-time" }
          }
        },
        TimeEntry: {
          type: "object",
          properties: {
            _id: { type: "string" },
            userId: { type: "string" },
            taskId: { type: "string" },
            workspaceId: { type: "string" },
            startTime: { type: "string", format: "date-time" },
            endTime: { type: "string", format: "date-time", nullable: true },
            duration: { type: "number" },
            description: { type: "string" },
            isManual: { type: "boolean" }
          }
        },
        RunningTimerResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              nullable: true,
              properties: {
                _id: { type: "string" },
                task: {
                  type: "object",
                  properties: {
                    _id: { type: "string" },
                    title: { type: "string" }
                  }
                },
                startTime: { type: "string", format: "date-time" },
                elapsedSeconds: { type: "number" },
                workspace: { type: "string" }
              }
            }
          }
        },
        TaskTimeSummaryResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                taskId: { type: "string" },
                totalSeconds: { type: "number" },
                totalFormatted: { type: "string" },
                entries: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      duration: { type: "number" },
                      durationFormatted: { type: "string" },
                      startTime: { type: "string", format: "date-time" },
                      isManual: { type: "boolean" },
                      description: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        },
        CustomTableResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { $ref: "#/components/schemas/CustomTable" }
          }
        },
        CustomTableListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/CustomTable" }
            }
          }
        },
        TableCreateInput: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            columns: {
              type: "array",
              items: { $ref: "#/components/schemas/TableColumnInput" }
            }
          }
        },
        TableColumnInput: {
          type: "object",
          required: ["title", "type"],
          properties: {
            title: { type: "string", maxLength: 100 },
            type: { type: "string", enum: ["text", "link", "number"] }
          }
        },
        TableCellUpdateInput: {
          type: "object",
          required: ["value"],
          properties: {
            value: {
              oneOf: [
                { type: "string" },
                { type: "number" }
              ]
            }
          }
        },
        DocumentResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { $ref: "#/components/schemas/Document" }
          }
        },
        DocumentListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Document" }
            }
          }
        },
        DocumentCreateInput: {
          type: "object",
          required: ["title", "workspaceId"],
          properties: {
            title: { type: "string" },
            workspaceId: { type: "string" },
            content: { type: "string" },
            parentId: { type: "string" }
          }
        },
        DocumentUpdateInput: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" }
          }
        },
        Plan: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            baseCurrency: { type: "string", enum: ["USD", "NPR"] },
            pricePerMemberMonthly: { type: "number" },
            pricePerMemberAnnual: { type: "number" },
            features: {
              type: "object",
              properties: {
                maxMembers: { type: "number" },
                maxWorkspaces: { type: "number" },
                maxSpaces: { type: "number" },
                maxLists: { type: "number" },
                maxTasks: { type: "number" },
                hasAccessControl: { type: "boolean" },
                hasGroupChat: { type: "boolean" },
                canUseCustomRoles: { type: "boolean" },
                canCreateTables: { type: "boolean" }
              }
            },
            isActive: { type: "boolean" }
          }
        },
        PlanListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Plan" }
            }
          }
        },
        Transaction: {
          type: "object",
          properties: {
            _id: { type: "string" },
            userId: { type: "string" },
            planId: { type: "string" },
            amount: { type: "number" },
            status: { type: "string", enum: ["pending", "completed", "failed"] },
            paymentMethod: { type: "string" },
            createdAt: { type: "string", format: "date-time" }
          }
        },
        TransactionListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Transaction" }
            }
          }
        },
        AnalyticsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                workspace: { type: "object" },
                stats: { type: "object" },
                hierarchy: { type: "array" },
                members: { type: "array" },
                tasks: { type: "array" },
                announcements: { type: "array" },
                currentRunningTimer: { type: "object", nullable: true },
                stickyNote: { type: "object", nullable: true }
              }
            }
          }
        },
        StickyNoteResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                userId: { type: "string" },
                workspaceId: { type: "string" },
                content: { type: "string" },
                color: { type: "string" }
              }
            }
          }
        },
        AttendanceRecord: {
          type: "object",
          properties: {
            id: { type: "string" },
            userName: { type: "string" },
            userEmail: { type: "string" },
            date: { type: "string", format: "date" },
            clockIn: { type: "string", format: "date-time" },
            clockOut: { type: "string", format: "date-time", nullable: true },
            durationFormatted: { type: "string" },
            description: { type: "string", nullable: true }
          }
        },
        AttendanceReportResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/AttendanceRecord" }
            }
          }
        },
        CustomField: {
          type: "object",
          properties: {
            _id: { type: "string" },
            workspaceId: { type: "string" },
            name: { type: "string" },
            type: { type: "string", enum: ["text", "number", "date", "dropdown", "checkbox"] },
            options: { type: "array", items: { type: "string" } },
            required: { type: "boolean" }
          }
        },
        CustomFieldResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { $ref: "#/components/schemas/CustomField" }
          }
        },
        CustomFieldListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/CustomField" }
            }
          }
        },
        CustomFieldCreateInput: {
          type: "object",
          required: ["workspaceId", "name", "type"],
          properties: {
            workspaceId: { type: "string" },
            name: { type: "string" },
            type: { type: "string", enum: ["text", "number", "date", "dropdown", "checkbox"] },
            options: { type: "array", items: { type: "string" } },
            required: { type: "boolean" }
          }
        },
        SystemSettings: {
          type: "object",
          properties: {
            whatsappContactNumber: { type: "string" },
            systemName: { type: "string" },
            accentColor: { type: "string" },
            themeMode: { type: "string", enum: ["light", "dark", "auto"] },
            logoUrl: { type: "string" }
          }
        },
        SystemSettingsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { $ref: "#/components/schemas/SystemSettings" }
          }
        },
        FinancialAnalyticsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                totalRevenue: { type: "number" },
                activePaidUsers: { type: "number" },
                conversionRate: { type: "number" },
                signupsLast30Days: { type: "number" }
              }
            }
          }
        },
        AdminUserListResponse: {
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
                  subscription: {
                    type: "object",
                    properties: {
                      plan: { type: "string" },
                      status: { type: "string" },
                      isPaid: { type: "boolean" },
                      expiresAt: { type: "string", format: "date-time" }
                    }
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
      // ─────────────────────────────────────────────────────────────────
      // 0. PRIMARY DASHBOARD
      // ─────────────────────────────────────────────────────────────────
      {
        name: "0. ⭐ Primary Dashboard",
        description: "🚀 ALL-IN-ONE consolidated data endpoint. Use GET /api/workspaces/{id}/analytics for the main Flutter screen — returns workspace stats, hierarchy, members, tasks, announcements, timer, sticky note, and performance in a single call."
      },

      // ─────────────────────────────────────────────────────────────────
      // 1. AUTH & IDENTITY
      // ─────────────────────────────────────────────────────────────────
      {
        name: "1.1 Auth — Login & Registration",
        description: "Register a new account, login, and obtain JWT tokens."
      },
      {
        name: "1.2 Auth — Password & Profile",
        description: "Forgot password, reset password, get & update own user profile."
      },

      // ─────────────────────────────────────────────────────────────────
      // 2. WORKSPACES
      // ─────────────────────────────────────────────────────────────────
      {
        name: "2.1 Workspaces — Core CRUD",
        description: "Create, read, update and delete workspaces. Includes settings and workspace hierarchy."
      },
      {
        name: "2.2 Workspaces — Members",
        description: "List, add, update, and remove members from a workspace."
      },
      {
        name: "2.3 Workspaces — Invitations",
        description: "Send, accept, decline, and revoke workspace invitations. Includes public join links."
      },
      {
        name: "2.4 Workspaces — Custom Roles",
        description: "Assign and update custom role titles for workspace members."
      },
      {
        name: "2.5 Workspaces — Logo",
        description: "Upload and manage the workspace logo via Cloudinary."
      },
      {
        name: "2.6 Workspaces — Announcements",
        description: "Create, list, and delete workspace-wide announcements."
      },

      // ─────────────────────────────────────────────────────────────────
      // 3. PROJECT HIERARCHY
      // ─────────────────────────────────────────────────────────────────
      {
        name: "3.1 Hierarchy — Spaces",
        description: "Create, list, update, delete Spaces inside a workspace. Spaces are the top-level containers in the hierarchy."
      },
      {
        name: "3.2 Hierarchy — Space Members",
        description: "Manage members inside a Space — add, update role, remove."
      },
      {
        name: "3.3 Hierarchy — Space Invitations",
        description: "Invite users to a Space, accept/decline space invitations."
      },
      {
        name: "3.4 Hierarchy — Folders",
        description: "Create, list, update, delete Folders inside a Space."
      },
      {
        name: "3.5 Hierarchy — Folder Members",
        description: "Manage members inside a Folder — add, update role, remove."
      },
      {
        name: "3.6 Hierarchy — Lists",
        description: "Create, list, update, delete Lists inside a Space or Folder."
      },
      {
        name: "3.7 Hierarchy — List Members",
        description: "Manage members inside a List — add, update role, remove."
      },
      {
        name: "3.8 Hierarchy — Projects (Overview)",
        description: "Legacy project-level overview routes that span the full hierarchy."
      },

      // ─────────────────────────────────────────────────────────────────
      // 4. TASK MANAGEMENT
      // ─────────────────────────────────────────────────────────────────
      {
        name: "4.1 Tasks — Core CRUD",
        description: "Create, read, update, delete tasks. Includes assignees, priority, status, due dates, subtasks, and bulk operations."
      },
      {
        name: "4.2 Tasks — Dependencies",
        description: "Gantt-style task dependencies: Finish-to-Start, Start-to-Start, Finish-to-Finish, Start-to-Finish."
      },
      {
        name: "4.3 Tasks — Recurring",
        description: "Set up recurring tasks with daily/weekly/monthly/custom frequency. Manage and preview the recurring schedule."
      },
      {
        name: "4.4 Tasks — Custom Fields",
        description: "Define and manage custom fields (text, number, date, select…) attached to tasks in a list."
      },

      // ─────────────────────────────────────────────────────────────────
      // 5. COLLABORATION & CHAT
      // ─────────────────────────────────────────────────────────────────
      {
        name: "5.1 Collaboration — Activity & Comments",
        description: "Task activity feed: comments, field-change logs, mentions, and emoji reactions."
      },
      {
        name: "5.2 Collaboration — Chat Channels",
        description: "Workspace group chat channels — create, join, post messages, manage members."
      },
      {
        name: "5.3 Collaboration — Direct Messages",
        description: "One-to-one direct messaging between workspace members."
      },
      {
        name: "5.4 Collaboration — Presence",
        description: "Real-time user presence and online status within a workspace."
      },

      // ─────────────────────────────────────────────────────────────────
      // 6. FILES & DOCUMENTS
      // ─────────────────────────────────────────────────────────────────
      {
        name: "6.1 Files — Uploads (Cloudinary)",
        description: "Upload images, videos, and raw files directly to Cloudinary. General-purpose upload endpoints."
      },
      {
        name: "6.2 Files — Task Attachments",
        description: "Attach and manage files on individual tasks."
      },
      {
        name: "6.3 Files — Workspace Files",
        description: "Workspace-level file library — upload, list, download, and delete shared files."
      },
      {
        name: "6.4 Files — Documents",
        description: "Rich-text document management: create, edit, nest, archive workspace documents."
      },

      // ─────────────────────────────────────────────────────────────────
      // 7. TIME & ATTENDANCE
      // ─────────────────────────────────────────────────────────────────
      {
        name: "7.1 Time — Entries (Timesheets)",
        description: "Log, update and delete manual time entries on tasks. View timesheets by user or workspace."
      },
      {
        name: "7.2 Time — Tracking (Live Timer)",
        description: "Start/stop a live running timer on a task. View the currently active timer."
      },
      {
        name: "7.3 Time — Attendance (Clock In/Out)",
        description: "Clock in and out of the workspace. View and export attendance records."
      },
      {
        name: "7.4 Time — Performance Metrics",
        description: "Completion rate, average task time, deadline success rate, and comparative team performance."
      },

      // ─────────────────────────────────────────────────────────────────
      // 8. CUSTOM TABLES
      // ─────────────────────────────────────────────────────────────────
      {
        name: "8.1 Tables — Core CRUD",
        description: "Create and manage Excel-like custom tables inside a Space: columns, rows, cell data, and styling."
      },
      {
        name: "8.2 Tables — Members",
        description: "Control access to individual custom tables — add, update role, and remove table members."
      },

      // ─────────────────────────────────────────────────────────────────
      // 9. SYSTEM & ADMINISTRATION
      // ─────────────────────────────────────────────────────────────────
      {
        name: "9.1 Admin — Plans",
        description: "Manage subscription plans: create, list, update, delete plans and their limits."
      },
      {
        name: "9.2 Admin — Subscriptions",
        description: "User subscription lifecycle: activate, check status, and expire subscriptions."
      },
      {
        name: "9.3 Admin — Payments",
        description: "Payment initiation, verification (eSewa / Khalti), and payment history."
      },
      {
        name: "9.4 Admin — Entitlements",
        description: "Feature-gate checks: verify if a workspace/user is allowed to perform an action based on their plan."
      },
      {
        name: "9.5 Admin — Super Admin",
        description: "Internal super-admin dashboard: platform-wide stats, user management, plan overrides."
      },
      {
        name: "9.6 Admin — Feedback",
        description: "Submit, list, and resolve user feedback and bug reports."
      },
      {
        name: "9.7 Admin — Currency",
        description: "Supported currencies and exchange rates used for plan pricing."
      },

      // ─────────────────────────────────────────────────────────────────
      // 10. UTILITIES & SEARCH
      // ─────────────────────────────────────────────────────────────────
      {
        name: "10.1 Utilities — Global Search",
        description: "Full-text search across tasks, spaces, lists, documents, and members in a workspace."
      },
      {
        name: "10.2 Utilities — Notification Center",
        description: "In-app notification feed: list, mark read, and clear notifications."
      },
      {
        name: "10.3 Utilities — Push Notification Devices",
        description: "Register and manage FCM device tokens for push notifications."
      },

      // ─────────────────────────────────────────────────────────────────
      // 11. PERSONAL TOOLS
      // ─────────────────────────────────────────────────────────────────
      {
        name: "11.1 Personal — Sticky Notes",
        description: "Get and update a personal sticky note scoped to the user's workspace dashboard."
      }
    ]
  },
  apis: [
    "./src/routes/*.ts"
  ]
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
