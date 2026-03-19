# ClickUp Clone - Backend API

A production-ready multi-tenant task management system with subscription management, custom tables, document collaboration, and real-time features. Built with Node.js, Express, TypeScript, and MongoDB.

## 🔑 Super Admin Credentials

```
Email: ashisacharya@gmail.com
Password: ashisacharya@123
```

**Super Admin Capabilities:**
- Create and manage subscription plans
- View system analytics and financial data
- Manage all users and subscriptions
- Configure system settings
- View and manage user feedback
- Access super admin dashboard

## 🚀 Features

### Core Features
- **Multi-tenant Architecture**: Workspace-based isolation with role-based access control
- **Subscription Management**: 14-day free trial with flexible plan system
- **Custom Tables**: Excel-like tables with drag selection, color customization, and export
- **Document Management**: Hierarchical document structure with rich text editing
- **Direct Messaging**: Private conversations between users with attachment support
- **File Management**: Cloudinary integration for workspace-wide file storage
- **Real-time Collaboration**: WebSocket-powered chat, typing indicators, and presence detection
- **Push Notifications**: Firebase Cloud Messaging with smart presence detection
- **Advanced Analytics**: Performance tracking, time tracking, and activity monitoring
- **Comprehensive API**: 200+ documented endpoints with Swagger UI

### Subscription System
- **14-Day Free Trial**: Automatic trial for new users
- **Global Usage Limits**: Usage calculated across ALL workspaces owned by a user
- **Plan Inheritance**: Super admins can create plans based on existing plans
- **Dynamic Entitlements**: All limits fetched from database, fully configurable
- **Owner-based Enforcement**: Limits based on workspace owner's subscription
- **Feature Flags**: Custom roles, custom tables, access control tiers

### Custom Tables (Pro Feature)
- **Excel-like Interface**: Drag to select multiple cells
- **Cell Customization**: Background and text color for individual cells
- **Bulk Operations**: Apply colors to multiple selected cells at once
- **Type Validation**: Text, link, and number column types
- **Excel Export**: Export tables with color preservation
- **Permission Management**: Table-level member permissions
- **Rate Limiting**: 100 cell updates per minute

### Document Management
- **Hierarchical Structure**: Parent-child document relationships
- **Rich Text Editing**: Full-featured document editor
- **Workspace Organization**: Documents organized by workspace
- **Archive Support**: Soft delete with archive functionality
- **Entitlement Limits**: Configurable document limits per plan

### Direct Messaging
- **Private Conversations**: One-on-one messaging between users
- **Attachment Support**: Share files in direct messages
- **Read Status**: Track message read status
- **Conversation History**: Paginated message history
- **Per-Recipient Limits**: Configurable message limits per recipient

### Advanced Features
- **Custom Fields**: Workspace-specific custom field definitions
- **Time Tracking**: Built-in time tracking with admin controls
- **Recurring Tasks**: Automated task creation with cron scheduling
- **Task Dependencies**: Task relationship management with cascading
- **Search**: Full-text search across workspaces
- **Feedback System**: User feedback collection and management
- **Activity Logs**: Comprehensive activity tracking and audit trails
- **Announcements**: Workspace-wide announcements with cooldown

## 🛠️ Tech Stack

- **Runtime**: Node.js v22
- **Framework**: Express.js v5
- **Language**: TypeScript (CommonJS)
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.io v4
- **Storage**: Cloudinary (images & files)
- **Push**: Firebase Cloud Messaging
- **Email**: Nodemailer + Resend
- **Validation**: Zod v4
- **Auth**: JWT
- **Documentation**: Swagger/OpenAPI 3.0

## 📋 Prerequisites

- Node.js v22+
- MongoDB (local or Atlas)
- Cloudinary account (for file uploads)
- Firebase project (for push notifications and Google OAuth)
- SMTP server or Resend API key (for emails - optional)

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration (see Environment Variables section)

# Build TypeScript
npm run build

# Start server
npm start
```

Server will run on `http://localhost:5000`

### Create Super Admin

```bash
node create-super-admin.js
```

Or use the existing super admin credentials provided above.

## 🔧 Environment Variables

Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# Authentication
JWT_SECRET=your-secret-key-min-32-chars

# Email (Nodemailer - Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
APP_NAME=ClickUp Clone

# Email (Resend - Optional Alternative)
RESEND_API_KEY=re_your_api_key

# Cloudinary (File Storage - Required)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Firebase (Push Notifications & Google OAuth - Required)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
FIREBASE_VAPID_KEY=your-vapid-key

# Optional Configuration
MAX_FILE_SIZE=10485760
```

## 📚 API Documentation

### Swagger UI

Access interactive API documentation with 200+ documented endpoints:

```
http://localhost:5000/api-docs
```

### Key API Endpoints

#### Authentication
```
POST   /api/auth/register              - Register new user
POST   /api/auth/login                 - Login with email/password
POST   /api/auth/google                - Login with Google OAuth
```

#### Subscription & Plans
```
GET    /api/subscription/info          - Get user's subscription info
GET    /api/plans                      - List all active plans
POST   /api/plans                      - Create plan (Super Admin)
PUT    /api/plans/:id                  - Update plan (Super Admin)
```

#### Entitlements
```
GET    /api/entitlements/check         - Check if action is allowed
GET    /api/entitlements/usage         - Get usage and limits
```

#### Custom Tables
```
POST   /api/spaces/:spaceId/tables                          - Create table
GET    /api/spaces/:spaceId/tables                          - List tables
GET    /api/tables/:tableId                                 - Get table
PATCH  /api/tables/:tableId                                 - Update table
DELETE /api/tables/:tableId                                 - Delete table
POST   /api/tables/:tableId/columns                         - Add column
POST   /api/tables/:tableId/rows                            - Add row
PATCH  /api/tables/:tableId/rows/:rowId/cells/:columnId     - Update cell
PATCH  /api/tables/:tableId/rows/:rowId/colors/:columnId    - Update cell color
PATCH  /api/tables/:tableId/rows/:rowId/text-colors/:columnId - Update text color
GET    /api/tables/:tableId/export                          - Export to Excel
```

#### Documents
```
POST   /api/documents                           - Create document
GET    /api/documents/workspace/:workspaceId    - Get workspace documents
GET    /api/documents/:id                       - Get document
PATCH  /api/documents/:id                       - Update document
DELETE /api/documents/:id                       - Delete document
```

#### Direct Messages
```
GET    /api/dm                                  - Get all conversations
POST   /api/dm/:userId                          - Start conversation
POST   /api/dm/:userId/message                  - Send message
GET    /api/dm/:conversationId/messages         - Get messages
PATCH  /api/dm/:conversationId/read             - Mark as read
```

#### Workspace Files
```
POST   /api/workspaces/:workspaceId/files/init-upload  - Initialize upload
POST   /api/workspaces/:workspaceId/files/confirm      - Confirm upload
GET    /api/workspaces/:workspaceId/files              - List files
DELETE /api/workspace-files/:id                        - Delete file
```

#### Super Admin
```
GET    /api/super-admin/users          - List all users
PATCH  /api/super-admin/users/:userId/subscription - Update subscription
GET    /api/super-admin/analytics      - System analytics
GET    /api/super-admin/settings       - Get system settings
PUT    /api/super-admin/settings       - Update system settings
```

For complete API documentation, visit: http://localhost:5000/api-docs

## 🏗️ Architecture

### Data Hierarchy

```
User (with Subscription)
  └── Workspace (owner/admin/member)
       ├── Spaces
       │    ├── Custom Tables
       │    ├── Folders
       │    └── Lists
       │         └── Tasks
       ├── Documents
       ├── Files
       ├── Chat Messages
       ├── Direct Messages
       ├── Custom Fields
       └── Invitations
```

### Subscription System

```
Plan (created by Super Admin)
  ├── Resource Limits
  │    ├── maxWorkspaces
  │    ├── maxSpaces
  │    ├── maxLists
  │    ├── maxFolders
  │    ├── maxTasks
  │    ├── maxMembers
  │    ├── maxFiles
  │    ├── maxDocuments
  │    └── maxDirectMessagesPerUser
  ├── Feature Flags
  │    ├── canUseCustomRoles
  │    ├── canCreateTables
  │    ├── hasAccessControl
  │    └── hasGroupChat
  └── Custom Table Limits
       ├── maxTablesCount
       ├── maxRowsLimit
       └── maxColumnsLimit

User Subscription
  ├── isPaid: boolean
  ├── status: trial | active | expired
  ├── planId: reference to Plan
  ├── trialStartDate: Date (14-day trial)
  └── Global Usage (across ALL owned workspaces)
```

### RBAC System

**Workspace-level roles:**
- **owner**: Full control, subscription management, custom role assignment
- **admin**: Manage spaces, lists, tasks, members
- **member**: Create and manage assigned tasks

**Custom Roles** (Pro Feature):
- Workspace owners can create custom roles
- Assign custom roles to members
- Configurable permissions per role

**Access Control Tiers:**
- **none**: No custom permissions
- **basic**: Basic permission management
- **pro**: Advanced permission management
- **advanced**: Full granular control

## 🔄 Real-time Features

### Socket.io Events

**Client → Server:**
- `join_workspace` - Join workspace room
- `leave_workspace` - Leave workspace room
- `chat:send` - Send chat message
- `chat:typing` - Typing indicator
- `presence:online` - User online
- `presence:offline` - User offline

**Server → Client:**
- `chat:new` - New message broadcast
- `chat:user_typing` - User typing
- `notification:new` - New notification
- `task:updated` - Task updated
- `presence:user_online` - User came online
- `presence:user_offline` - User went offline

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── db.ts        # MongoDB connection
│   │   ├── cloudinary.ts # Cloudinary setup
│   │   ├── firebase.ts   # Firebase Admin SDK
│   │   └── swagger.ts    # Swagger/OpenAPI config
│   ├── controllers/     # HTTP request handlers
│   ├── middlewares/     # Auth, RBAC, validation
│   │   ├── authMiddleware.ts
│   │   ├── subscriptionMiddleware.ts
│   │   └── ...
│   ├── models/          # Mongoose schemas
│   │   ├── User.ts
│   │   ├── Workspace.ts
│   │   ├── CustomTable.ts
│   │   ├── Document.ts
│   │   └── ...
│   ├── routes/          # API routes with Swagger
│   ├── services/        # Business logic
│   │   ├── entitlementService.ts
│   │   ├── customTableService.ts
│   │   └── ...
│   ├── socket/          # Socket.io handlers
│   ├── utils/           # Helper functions
│   ├── validators/      # Zod schemas
│   ├── permissions/     # RBAC definitions
│   └── server.ts        # Entry point
├── dist/                # Compiled JavaScript
├── .env                 # Environment variables
├── create-super-admin.js # Super admin script
└── package.json
```

## 🔒 Security Features

- JWT authentication on all protected routes
- Workspace-based RBAC with subscription limits
- Rate limiting (100 req/15min per IP, 100 cell updates/min)
- Input validation with Zod
- Cloudinary signed uploads
- Soft deletes for audit compliance
- Super admin privilege checks
- Firebase Admin SDK for secure OAuth
- CORS configuration
- Environment variable protection

## 📊 Subscription Limits

### Global Enforcement
- All limits calculated across ALL workspaces owned by a user
- Limits enforced based on workspace OWNER's subscription
- Premium user in Free workspace = restricted by Free limits
- Free user in Premium workspace = allowed by Premium limits

### Entitlement Checks
- Workspace creation: Before creating new workspace
- Space creation: Before creating new space
- List creation: Before creating new list
- Folder creation: Before creating new folder
- Task creation: Before creating new task
- Member invitation: Before inviting new member
- Table creation: Before creating custom table
- Row addition: Before adding table row
- File upload: Before uploading file
- Document creation: Before creating document
- Direct message: Before sending message (per recipient)

### User-Friendly Errors
All limit errors include:
- Clear message explaining the limit
- Current usage count
- Maximum allowed count
- Upgrade action prompt
- Specific error codes

## 📦 Scripts

```bash
npm run dev              # Development with hot reload
npm run build            # Compile TypeScript
npm start                # Run production build
npm run dev:compiled     # Build and run once
npm run dev:watch        # Watch mode compilation
```

## 🗄️ Database

### Collections (35 total)

**Core Collections:**
- users, workspaces, spaces, folders, lists, tasks

**Feature Collections:**
- customtables, documents, directmessageconversations, directmessages
- workspacefiles, plans, customfields

**Activity Collections:**
- activities, activitylogs, auditlogs, comments, attachments, chatmessages

**System Collections:**
- invitations, spaceinvitations, notifications, feedbacks, timeentries

**Permission Collections:**
- spacemembers, listmembers, foldermembers, tablemembers

### Database Backup

Export database:
```bash
mongodump --uri="YOUR_MONGODB_URI" --out=./mongodb_dump
```

Restore database:
```bash
mongorestore --uri="YOUR_MONGODB_URI" ./mongodb_dump
```

## 🧪 Testing

```bash
npm test
```

The system includes comprehensive testing for:
- Authentication flows
- Subscription limit enforcement
- RBAC permissions
- Real-time features
- File uploads
- Push notifications
- Custom tables
- Document management
- Direct messaging

## 📖 Documentation Files

- `API_DOCUMENTATION.md` - Complete API reference
- `SWAGGER_API_DOCUMENTATION_UPDATE.md` - API docs update summary
- `ARCHITECTURE.md` - Detailed architecture guide
- `SUBSCRIPTION_LIMITS_IMPLEMENTATION.md` - Subscription system details
- `ACCESS_CONTROL_TIERS_IMPLEMENTATION.md` - RBAC implementation
- `CHAT_SYSTEM.md` - Real-time chat implementation
- `CLOUDINARY_MIGRATION_COMPLETE.md` - File upload system
- `ANALYTICS_DASHBOARD.md` - Analytics implementation
- `ACTIVITY_SYSTEM_COMPLETE.md` - Activity logging

## 🚀 Deployment

### Recommended Platforms
- **Backend**: Railway, Render, or Heroku
- **Database**: MongoDB Atlas

### Deployment Steps

1. Set environment variables in hosting platform
2. Connect MongoDB Atlas
3. Configure Cloudinary
4. Set up Firebase
5. Deploy from Git repository

### Environment Variables for Production

Ensure all environment variables are set in your hosting platform:
- `MONGODB_URI`
- `JWT_SECRET`
- `CLOUDINARY_*` credentials
- `FIREBASE_*` credentials
- `FRONTEND_URL` (production URL)

## 🐛 Troubleshooting

### Server won't start
- Check MongoDB connection string
- Verify all environment variables are set
- Ensure port 5000 is not in use

### File uploads failing
- Verify Cloudinary credentials
- Check file size limits
- Ensure proper MIME types

### Push notifications not working
- Verify Firebase configuration
- Check VAPID key
- Ensure service worker is registered

## 📝 API Versioning

Current version: v1 (implicit)
All routes are prefixed with `/api/`

## 🔄 Rate Limiting

- Default: 100 requests per 15 minutes per IP
- Cell updates: 100 updates per minute
- Configurable per route
- Bypass for authenticated super admins

## ❌ Error Handling

Standardized error responses:
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "action": "upgrade",
  "feature": "workspaces"
}
```

## 📞 Support

For issues and questions:
1. Check the documentation files
2. Review Swagger API docs at `/api-docs`
3. Create an issue in the repository
4. Contact the development team

## 📄 License

ISC

---

**Version**: 1.0.0  
**Last Updated**: March 2026  
**Maintained by**: Development Team
