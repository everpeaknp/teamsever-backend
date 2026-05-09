# BACKEND_SYSTEMS_AND_APIS

## 1. Document Scope
1. This document tracks backend systems and API behavior for the range:
   - Baseline commit: `5c5f61cf733812324f9fa840c243af90a822ec35`
   - Current HEAD: `1c9b145` (plus current local documentation updates)
2. Audience: Flutter/mobile/web client developers integrating APIs and real-time behaviors.
3. Goal: clearly list:
   - New APIs
   - Existing API behavior changes
   - Schema/model updates
   - Permission and access-control changes
   - Realtime/socket/notification changes
   - Swagger coverage updates

## 2. High-Level Systems (Current)
1. Auth & Identity
   - Email/password auth
   - Google OAuth via Firebase
   - GitHub OAuth via Firebase token verification
2. Workspace Collaboration
   - Spaces, folders, lists, tasks
   - Activity feed (Activity + ActivityLog + synthesized task-creation fallback)
3. Chat
   - Workspace channels (public/private)
   - Permanent system channels (`General`, `Commit Log`)
   - Direct Messages (DM)
4. Notifications
   - In-app notification center
   - FCM push delivery
   - User-level notification preference toggles
5. GitHub Integration
   - Space-level webhook setup
   - Signed webhook ingest
   - Activity timeline logging
   - Commit-to-chat feed posting in `Commit Log`
6. Tables
   - Space-level and folder-scoped custom tables

## 3. Commit-Range Change Summary (Since Baseline)
### 3.0 Canonical Backend Commits Reviewed (May 7–9, 2026)
1. `ce922da` docs(swagger): align DM workspace requirements and notification endpoint docs
1. `02addde` fix(notifications): normalize FCM data payloads and guard missing messaging client
1. `287ec1c` fix(permissions): honor folder FULL for list actions and clean space-removal access
1. `0d230b5` fix(permissions): enforce scoped DM and folder-level access visibility
2. `71f6d61` fix(space-permissions): fully reset override by clearing nested space member permission
3. `86f47c0` fix(space-members): list only users currently in space
4. `99760b8` fix(rbac): allow space FULL to grant actions when list/folder override is weaker
5. `d5cb038` perf(hierarchy): include user space permission in hierarchy payload
6. `0c3c118` fix(comments): enforce COMMENT_TASK permission on task comment route
7. `70bd091` fix(space-members): avoid enum import crash in permission validation
8. `b6cc583` fix(space-members): prevent 500 on permission update for mixed member shapes
9. `c2cc554` fix(access): enforce full-scope permissions and workspace-scoped chat/dm
10. `55b2960` fix(analytics): remove 100-task cap from workspace analytics payload
11. `d829be8` docs(swagger): point production server URL to Render
12. `b7d9bbb` chore(notifications): keep legacy fcm route as deprecated alias with compat payload
13. `f3378fc` docs(swagger): document workspaceId filtering for notification endpoints
14. `5d2b5b8` fix(notifications): add workspace-scoped fetch/unread/read-all filtering
15. `e682aab` fix(notifications): unify pipeline, enforce prefs, and normalize invite alerts
16. `207e400` docs(swagger): add missing route docs and clean duplicate webhook block
17. `53d925e` harden manual notification type handling with safe enum fallback
18. `f8ad84e` add deletable custom chat channels and protect permanent system channels
19. `c252d49` fix folder workspace resolution for ObjectId spaceId in permission middleware
20. `e86004e` fix folder page access for folder-level members without list memberships
21. `48c33ea` fix folder permission 500 from undefined enum and null member refs
22. `0240d6e` fix GitHub auth signup fallback and account matching
23. `8b4b976` folders APIs updates
24. `18067c1` fix DM room ID mismatch and realtime updates for group chat API messages
25. `adf05c1` robust user ID extraction for GitHub commit notifications
26. `689df09` restrict DMs to workspace members in backend
27. `dbd8fcc` allow `GITHUB_COMMIT` and `ANNOUNCEMENT_NEW` notification types in schema
28. `b9c8ba3` support user-based filtering in chat API

### 3.1 Major New Capabilities
1. GitHub OAuth login endpoint added.
2. Space webhook configuration retrieval endpoint added.
3. GitHub push processing significantly expanded:
   - Signature checks + ping handling
   - User attribution logic
   - Workspace activity logging for commits
   - Commit Log channel posting
   - Notification triggering
4. Channel deletion support added with permanent-channel protection.
5. Folder activity endpoint added with list-activity parity behavior.
6. DM conversations are now strictly workspace-scoped (workspaceId required).
7. Custom tables now support folder scoping.
8. User notification preference update endpoint added.

### 3.2 Critical Fixes/Behavioral Fixes
1. Folder permission update 500 errors fixed:
   - Removed broken enum runtime import usage
   - Added safe static permission constants in controller
2. Folder access path fixed for folder-level members.
3. Permission middleware fixed for `folder.spaceId` ObjectId resolution edge case.
4. Notification type hardening:
   - Safe enum fallback when creating manual notifications
5. Chat realtime delivery robustness improved (`emitChatMessage` usage).
6. Webhook route mounting precedence improved (mounted earlier in `server.ts`).
7. Space member/permission APIs hardened (enum/runtime + mixed member shape safety).
8. Space permission reset now clears nested `space.members[].permissionLevel` override state.
9. Task comments now enforce `COMMENT_TASK` permission gate.
10. Workspace analytics totals are uncapped (removed fixed 100-task limit).
11. Folder FULL now correctly applies to list actions inside that folder:
   - Permission middleware now resolves parent folder from both `List.folder` and legacy/current `List.folderId`.
   - This prevents false 403 for actions like `DELETE_LIST` when user has folder override.
12. Space member removal now revokes child-scope access immediately:
   - Removing user from a space also deletes that user’s `FolderMember` and `ListMember` overrides for that space.
   - Prevents stale sidebar visibility and stale access after space removal.
13. Folder members API now includes direct folder-invite users even if not currently in `space.members`:
   - `GET /api/folders/:folderId/folder-members` returns union of:
     - users in parent space
     - users with explicit folder override
   - Fixes missing-user issue in Manage Folder Permissions modal.
14. Push delivery hardening in unified notification pipeline:
   - FCM `data` payload is now normalized to string-only key/value pairs before sending.
   - Prevents Firebase Admin rejection when payload includes object/number/boolean values.
   - Added messaging-client null guard so notification flow degrades safely when Firebase config/app is unavailable.

## 4. API Delta Catalog (New + Changed)

## 4.0 Access-Control Clarification (Important)
1. Effective permission resolution remains:
   - Owner bypass
   - List override (grant)
   - Folder override (grant)
   - Space override (grant)
   - Workspace role fallback
2. Override semantics are grant-based, not hard-deny:
   - A weaker lower-level override does not block a stronger parent grant.
3. Space FULL behavior:
   - User can create/update/delete folders, lists, and tasks inside that space.
   - User still cannot delete the space entity itself unless admin/owner policy allows.
4. Folder FULL behavior:
   - User can create/update/delete lists and tasks inside that folder scope.
   - Access does not grant full space-wide power.

## 4.1 Authentication APIs

### 4.1.1 New: GitHub OAuth Login
- Method: `POST`
- Path: `/api/auth/github`
- Purpose: authenticate/login/signup using Firebase GitHub ID token.
- Request body:
  - `idToken: string` (required)
- Behavior:
  1. Verifies Firebase token.
  2. Resolves existing user by email first, then by `githubUsername`.
  3. Creates user if needed (supports private-email GitHub accounts with generated fallback email).
  4. Updates/links `githubUsername` and profile image where appropriate.
- Response: standard auth response with app JWT and user payload.

### 4.1.2 Changed: User profile update
- Method: `PATCH`
- Path: `/api/users/profile`
- Change:
  - Supports updating `githubUsername`.
  - Response now includes `notificationPreferences` block.

## 4.2 User Notification Preference APIs

### 4.2.1 New: Update Notification Preferences
- Method: `PATCH`
- Path: `/api/users/notification-preferences`
- Purpose: per-user opt-in/out flags for notification categories.
- Supported flags:
  - `githubCommits`
  - `taskAssigned`
  - `taskStatusChange`
  - `taskUpdates`
  - `messages`
  - `mentions`
  - `comments`
  - `notices`
- Behavior:
  - Initializes defaults if absent.
  - Partially updates only provided fields.

## 4.3 GitHub Integration APIs

### 4.3.1 New: Get webhook config for a space
- Method: `GET`
- Path: `/api/spaces/:id/webhook`
- Response:
  - If not configured: `data: null`
  - If configured: `data.webhookUrl`, `data.secret`, `data.githubRepoName`

### 4.3.2 Changed: Generate webhook secret
- Method: `POST`
- Path: `/api/spaces/:id/webhook`
- Behavior updates:
  - Normalizes base backend URL (trailing slash safe).
  - Persists `githubRepoName` and generated `githubWebhookSecret` on space.

### 4.3.3 Existing but upgraded: Webhook receiver
- Method: `POST`
- Path: `/api/webhooks/github/:spaceId`
- Behavior changes:
  1. Better diagnostics and failure logging.
  2. Supports GitHub `ping` event (`200` + `PONG`).
  3. Commit events:
     - Validates signature
     - Creates `WorkspaceActivity` type `github_commit`
     - Attempts user attribution by:
       - commit author email
       - verified GitHub username
       - pusher username fallback
     - Triggers enhanced notifications
     - Posts summary message into `Commit Log` channel as `ChatMessage.type = github_commit`

## 4.4 Activity APIs

### 4.4.1 Changed: Generic activity feed
- Method: `GET`
- Path: `/api/activities`
- Change:
  - `performedBy` restriction now only enforced when `workspaceId` is explicitly provided and caller is not admin/owner.
  - List-only queries no longer accidentally over-filter to caller.

### 4.4.2 New: Folder activity feed
- Method: `GET`
- Path: `/api/folders/:folderId/activity`
- Purpose: aggregate activity from all lists under a folder.
- Behavior:
  1. Validates folder -> space -> workspace chain.
  2. Verifies requester is owner/member of workspace.
  3. Collects list IDs under folder.
  4. Reuses list activity service pipeline for parity.
  5. Merges/sorts/slices to unified output.

### 4.4.3 New: Space commits activity endpoint
- Method: `GET`
- Path: `/api/spaces/:spaceId/commits`
- Purpose: query `github_commit` activities for a space.

## 4.5 Chat APIs

### 4.5.1 Changed: Workspace feed query filtering
- Method: `GET`
- Path: `/api/workspaces/:workspaceId/chat`
- New query support:
  - `userId` (optional sender filter)

### 4.5.2 Changed: Channel message list filtering
- Method: `GET`
- Path: `/api/chat/channels/:channelId/messages`
- New query support:
  - `userId` (optional sender filter)

### 4.5.3 New: Delete channel
- Method: `DELETE`
- Path: `/api/workspaces/:workspaceId/chat/channels/:channelId`
- Authorization:
  - Channel creator OR workspace admin/owner
- Safety rule:
  - Permanent channels cannot be deleted:
    - `General`
    - `Commit Log`

### 4.5.4 Behavior update: default channel provisioning
- Service-level change:
  - System now ensures both default channels are present:
    - `General`
    - `Commit Log`

## 4.6 Direct Message APIs

### 4.6.1 Changed: Conversation list (workspace required)
- Method: `GET`
- Path: `/api/dm`
- Required query:
  - `workspaceId`
- Behavior:
  - Returns only conversations inside the provided workspace scope.
  - Requests without `workspaceId` return `400`.

### 4.6.2 Changed: Start conversation (workspace required)
- Method: `POST`
- Path: `/api/dm/:userId`
- Required request field:
  - `workspaceId`
- Behavior:
  - Creates/finds DM thread only in the provided workspace scope.
  - Both users must belong to that workspace.
  - Requests without `workspaceId` return `400`.

### 4.6.3 Changed: Send message (workspace required)
- Method: `POST`
- Path: `/api/dm/:userId/message`
- Required request fields:
  - `workspaceId`
  - `content`
- Behavior:
  - Sends DM message only in the provided workspace scope.
  - Requests without `workspaceId` return `400`.

## 4.7 Space Member / Space Permission APIs

### 4.7.1 Changed: Space member listing scope
- Method: `GET`
- Path: `/api/spaces/:spaceId/space-members`
- Behavior:
  - Returns only users currently inside that space membership set.
  - Prevents showing unrelated workspace-wide users in space permission modal.

### 4.7.2 Changed: Space permission update/reset robustness
- Methods:
  - `POST /api/spaces/:spaceId/space-members`
  - `PATCH /api/spaces/:spaceId/space-members/:userId`
  - `DELETE /api/spaces/:spaceId/space-members/:userId`
- Behavior:
  - Avoids enum import runtime crashes in permission validation path.
  - Handles mixed member shapes safely (string/object user refs).
  - Reset fully clears nested override state in `space.members[].permissionLevel`.

## 4.8 Custom Table APIs

### 4.8.1 Changed: Create table (folder-aware)
- Method: `POST`
- Path: `/api/spaces/:spaceId/tables`
- New request field:
  - `folderId` (optional, nullable)
- Behavior:
  - Table can be attached to a folder or remain space-level (`null`).

### 4.8.2 Changed: Get tables (folder filtering)
- Method: `GET`
- Path: `/api/spaces/:spaceId/tables`
- New query:
  - `folderId` optional
  - `folderId=null` returns space-level tables only

## 4.9 Folder Permission/Access APIs

### 4.9.1 Changed: Folder details endpoint behavior
- `GET /api/folders/:id` now runs through `folderService.getFolderById(folderId, userId)`.
- Effect: folder-level permission-aware access, not raw `findById` fetch.

### 4.9.2 Changed: Folder member management robustness
- Runtime-safe permission constants used (`FULL|EDIT|COMMENT|VIEW`).
- Correct workspace resolution from `folder.spaceId -> space.workspace`.
- Null-safe member and override mapping.

### 4.9.3 Changed: Folder members list source
- Method: `GET`
- Path: `/api/folders/:folderId/folder-members`
- Behavior:
  - Returns a union of:
    - users currently in the parent space membership
    - users with explicit folder override (`FolderMember`) for this folder
  - Excludes unrelated workspace-wide users.
  - Includes folder override metadata (`folderPermissionLevel`, `hasOverride`, `addedBy`, `addedAt`).

## 4.10 Platform/Infra Behavior
1. General API rate limit increased:
   - From `500` to `5000` requests / 15 minutes / IP.
2. Webhook routes mounted before other routes in `server.ts` route order.

## 5. Data Model Changes

## 5.1 `Space`
1. Added `githubRepoName: string | null`
2. Added `githubWebhookSecret: string | null`

## 5.2 `User`
1. Added `githubUsername`
2. Added `notificationPreferences` object with defaults:
   - `githubCommits`, `taskAssigned`, `taskStatusChange`, `taskUpdates`, `messages`, `mentions`, `comments`, `notices`

## 5.3 `Notification`
1. Extended enum types:
   - `GITHUB_COMMIT`
   - `ANNOUNCEMENT_NEW`

## 5.4 `ChatMessage`
1. `type` enum extended:
   - `github_commit`
2. Added `metadata` for commit payload details.

## 5.5 `WorkspaceActivity`
1. `user` no longer strictly required (supports external/webhook-origin events).
2. Added `github_commit` activity type.

## 5.6 `CustomTable`
1. Added `folderId` (nullable ObjectId, indexed).
2. Added compound index support for folder-scoped queries.

## 6. Service-Layer Behavioral Changes

## 6.1 `activityService.getActivities()`
1. Uses richer merge pipeline:
   - Primary `Activity`
   - Fallback `ActivityLog`
   - Synthesized task creation fallback from `Task`
2. Deduplicates noisy duplicates using `(taskId + action + timestamp bucket)` keying.
3. Produces more complete list/folder activity timeline parity.

## 6.2 `chatService`
1. Ensures permanent channels exist.
2. Adds channel delete enforcement logic.
3. Emits chat events consistently to socket room via `emitChatMessage`.
4. Supports sender-filtered message queries.

## 6.3 `directMessageService.getConversations()`
1. Uses strict workspace scoping when `workspaceId` is provided from controller (now required in API contract for list/start/send flows).

## 6.4 `folderService.getFolderById()`
1. Adds robust folder access checks for owner/member/folder-member paths.

## 6.5 `permissionService.can()` override resolution
1. List/folder overrides are treated as grants, not hard denials.
2. If a lower-level override is weaker, evaluation can still fall through to a stronger higher scope (e.g., space FULL).
3. This fixes cases where users with space FULL were blocked by weaker list/folder roles.

## 6.6 `workspaceService` analytics aggregation
1. Removed fixed 100-task cap; totals/status/priority now reflect full uncapped data.

## 7. Permission and Access-Control Changes
1. Permission middleware now correctly resolves workspace from `folder.spaceId` even when not populated string/object (ObjectId instance edge case).
2. Folder membership API fixes eliminate null conversion failures and enum import crashes.
3. Folder page access works for folder-level permissions without requiring list-level membership.
4. Permission middleware now resolves `folderId` from list create/update payloads:
   - `req.body.folderId`
   - `req.query.folderId`
   This ensures folder-level overrides (e.g., folder FULL) are applied to list creation/deletion checks.
5. Hierarchy space visibility no longer trusts stale `SpaceMember` override docs for sidebar visibility; direct `space.members` + actual child-path visibility is used.
6. Hierarchy payload now includes user space permission value per space for client rendering.

## 8. Realtime / Notifications Flow Updates
1. GitHub push now cascades to:
   - `WorkspaceActivity`
   - In-app/push notifications
   - `Commit Log` channel message creation
2. Notification creation hardened:
   - Unknown `type` no longer breaks creation; falls back to `SYSTEM` and retains source in metadata.

## 9. Flutter Integration Notes (Actionable)
1. DM APIs are workspace-required:
   - `GET /api/dm?workspaceId=<id>`
   - `POST /api/dm/:userId` with `{ workspaceId }`
   - `POST /api/dm/:userId/message` with `{ workspaceId, content }`
2. Use folder-aware table patterns:
   - Create: include optional `folderId`
   - List: include optional `folderId` or `folderId=null`
3. For chat moderation UI:
   - Support delete channel action.
   - Block delete affordance in client for permanent channels (`General`, `Commit Log`) to match server behavior.
4. For activity screens:
   - Folder activity should call `/api/folders/:folderId/activity`.
   - Space commit timeline can use `/api/spaces/:spaceId/commits`.
5. Profile settings can now include:
   - `githubUsername`
   - notification preference toggles endpoint.

## 10. Swagger Sync Status (This Update)

### 10.1 Added/Improved Swagger Coverage
1. `POST /api/auth/github`
2. `PATCH /api/users/notification-preferences`
3. `GET /api/spaces/:id/webhook`
4. `POST /api/webhooks/github/:spaceId`
5. `GET /api/folders/:folderId/activity`
6. `GET /api/workspaces/:workspaceId/chat` now documents `userId` query filter.
7. `GET /api/chat/channels/:channelId/messages` now documents `userId` query filter.
8. `DELETE /api/workspaces/:workspaceId/chat/channels/:channelId` documented.
9. `GET /api/dm` now documents required `workspaceId` query.
10. `POST /api/dm/:userId` now documents required `workspaceId` body.
11. `POST /api/dm/:userId/message` now documents required `workspaceId` in payload schema (`DMMessageInput`).
12. `POST/GET /api/spaces/:spaceId/tables` docs now mention folder scoping (`folderId`).
13. Cleaned duplicated Swagger block for `/api/spaces/{id}/webhook`.
14. Notification schema enum list updated to include `GITHUB_COMMIT`, `ANNOUNCEMENT_NEW`, and `MENTION`.
15. Swagger server production URL points to Render deployment.

### 10.2 Remaining Recommendation
1. Consider adding dedicated response component schemas for:
   - Webhook config (`SpaceWebhookConfigResponse`)
   - Folder activity feed (`FolderActivityResponse`)
   - Channel delete response (`ChannelDeleteResponse`)
2. This is optional; current route-level docs are sufficient for integration.

## 11. Changed File Groups (Since Baseline)
1. Core API docs/config:
   - `src/config/swagger.ts`
2. Routes/controllers/services touched:
   - auth, user, webhook, space, chat, DM, activity, folder, folder-member, custom-table
3. Models touched:
   - `User`, `Space`, `Notification`, `ChatMessage`, `WorkspaceActivity`, `CustomTable`
4. Infra/runtime:
   - `src/server.ts`, `src/socket/events.ts`, permission middleware

## 12. Quick Endpoint Checklist (for QA)
1. Auth
   - [ ] `POST /api/auth/github`
2. Users
   - [ ] `PATCH /api/users/profile` with `githubUsername`
   - [ ] `PATCH /api/users/notification-preferences`
3. Space + Webhook
   - [ ] `GET /api/spaces/:id/webhook`
   - [ ] `POST /api/spaces/:id/webhook`
   - [ ] `POST /api/webhooks/github/:spaceId`
4. Activity
   - [ ] `GET /api/folders/:folderId/activity`
   - [ ] `GET /api/spaces/:spaceId/commits`
5. Chat
   - [ ] `GET /api/workspaces/:workspaceId/chat?userId=...`
   - [ ] `GET /api/chat/channels/:channelId/messages?userId=...`
   - [ ] `DELETE /api/workspaces/:workspaceId/chat/channels/:channelId`
6. DM
   - [ ] `GET /api/dm?workspaceId=...` (required)
   - [ ] `POST /api/dm/:userId` with `workspaceId`
   - [ ] `POST /api/dm/:userId/message` with `workspaceId`
7. Tables
   - [ ] `POST /api/spaces/:spaceId/tables` with/without `folderId`
   - [ ] `GET /api/spaces/:spaceId/tables?folderId=...`
   - [ ] `GET /api/spaces/:spaceId/tables?folderId=null`

## 13. Latest Notification Unification Update (May 8, 2026)

### 13.1 Summary
1. Notification delivery logic is now unified through `enhancedNotificationService` across backend event producers.
2. Notification preference enforcement is now centralized at notification creation time (single gate).
3. Invite-related notification paths were normalized to reduce inconsistent behavior between invite flows.

### 13.2 Why this was needed
1. The codebase previously had two active notification pipelines:
   - `notificationService` (legacy behavior)
   - `enhancedNotificationService` (newer behavior)
2. Those services had different delivery semantics:
   - legacy path could send push even for online users
   - enhanced path used online/offline split
3. Resulting symptoms:
   - duplicate/mismatched notification behavior
   - inconsistent preference application
   - invite notifications not consistently generated in all invite paths

### 13.3 Backend files updated in this change
1. `src/services/enhancedNotificationService.ts`
   - Added central preference gate helper:
     - `isNotificationEnabledForUser(recipientId, type)`
   - Extended supported types for compatibility:
     - `INVITATION`
     - `SPACE_INVITATION`
     - `MENTION` (legacy-compatible alias)
2. `src/services/notificationService.ts`
   - `createNotification()` now delegates to `enhancedNotificationService.createNotification()`.
   - Effect: callers still using `notificationService` now inherit unified behavior.
3. `src/services/invitationService.ts`
   - Switched import from legacy service to enhanced service.
4. `src/controllers/spaceInvitationController.ts`
   - Switched import from legacy service to enhanced service.
5. `src/services/chatService.ts`
   - Switched import from legacy service to enhanced service for mention notifications.
6. `src/services/fileUploadService.ts`
   - Switched import from legacy service to enhanced service.
7. `src/controllers/memberController.ts`
   - Added in-app invite notification creation for workspace member invite/resend flows.

### 13.4 Effective delivery behavior after unification
1. Create DB notification first.
2. Apply preference gate before emitting/sending.
3. If recipient is online:
   - emit socket event `notification:new` to user devices.
4. If recipient is offline:
   - send FCM push.
5. This now applies consistently to task/comment/message/mention/invite-related notification producers listed above.

### 13.5 Preference mapping (single source of truth)
1. `githubCommits`
   - `GITHUB_COMMIT`
2. `taskAssigned`
   - `TASK_ASSIGNED`
3. `taskStatusChange`
   - `TASK_STATUS_CHANGED`
4. `taskUpdates`
   - `TASK_UPDATE`, `TASK_PRIORITY_CHANGED`, `SUBTASK_CREATED`, `DEPENDENCY_ADDED`, `DEPENDENCY_STATUS_CHANGED`, `FILE_UPLOAD`
5. `messages`
   - `DM_NEW`
6. `mentions`
   - `COMMENT_MENTION`, `MENTION`
7. `comments`
   - `COMMENT_ADDED`, `COMMENT_UPDATED`, `COMMENT_DELETED`
8. `notices`
   - `INVITATION`, `SPACE_INVITATION`, `INVITE_ACCEPTED`, `ANNOUNCEMENT_NEW`, `SYSTEM`

### 13.6 API contract impact
1. No endpoint path/method changed in this update.
2. Behavior changed at service layer:
   - more consistent preference filtering
   - normalized delivery mode selection
3. Clients should expect:
   - fewer duplicates
   - more consistent invite notification visibility
   - stable unread count progression when paired with frontend dedupe.

### 13.7 QA scenarios to re-run after this update
1. Workspace invite existing user:
   - verify in-app notification appears
   - verify email still sends
2. Space invitation:
   - verify in-app notification and acceptance flow
3. Mention in chat:
   - verify mention notification honors `mentions` preference
4. DM notification:
   - verify `messages` preference gates delivery
5. Commit webhook notification:
   - verify `githubCommits` preference gates delivery
6. User with `notices=false`:
   - verify invite/system-style notifications are not delivered

## 14. Notification System (Current Runtime Behavior)

### 14.1 End-to-end flow (what happens now)
1. Event occurs (task update, DM, mention, invite, comment, commit webhook, announcement, file upload).
2. Producer service/controller calls notification creation (directly or via wrapper).
3. Effective creation pipeline is `enhancedNotificationService.createNotification(...)`:
   - `notificationService.createNotification(...)` now delegates here.
4. Preference gate is evaluated before persistence (`notificationPreferences`).
5. If allowed:
   - Notification is saved in `Notification` collection.
   - Optional activity log entry is created if `workspaceId` present.
6. Delivery split:

## 15. Latest Access Cleanup + Ownership Transfer (May 9, 2026)

### 15.1 Commit Covered
1. `5caddb6` — `fix(access-cleanup): revoke list visibility and transfer list ownership on scope removal`
2. `1c9b145` — `fix(rbac): resolve task folder/space/workspace via list fallback for folder FULL access`

### 15.2 What changed
1. Space-level member removal now performs full child-scope cleanup inside that space:
   - Deletes `SpaceMember` record for the removed user+space.
   - Deletes all `FolderMember` records for that user in folders of that space.
   - Deletes all `ListMember` records for that user in lists of that space.
   - Removes stale embedded entries from `List.members[]` for lists under that space.
2. Folder-level member removal now performs folder child cleanup:
   - Deletes `FolderMember` record for removed user+folder.
   - Deletes all `ListMember` records for that user in lists of that folder.
   - Removes stale embedded entries from `List.members[]` for lists under that folder.
3. Ownership transfer safety on scope removal:
   - For affected lists, if `List.createdBy` is the removed user, ownership is reassigned to the parent `Space.owner`.
   - Applies during both space-member removal and folder-member removal flows.

### 15.3 Why this matters
1. Prevents stale list visibility after removing user access at space/folder scope.
2. Prevents orphaned ownership when creator is removed from permission scope.
3. Keeps sidebar/hierarchy behavior aligned with effective access.

### 15.4 Affected backend files
1. `src/services/spaceService.ts`
2. `src/controllers/folderMemberController.ts`

### 15.5 API behavior impact
1. No endpoint path/method changes.
2. Behavior changes on existing routes:
   - `DELETE /api/spaces/:spaceId/space-members/:userId`
   - `DELETE /api/folders/:folderId/folder-members/:userId`
3. Both now trigger deeper cleanup + ownership transfer logic as described above.

### 15.6 QA checklist for this change
1. User has FULL in a space, creates lists, then is removed from space:
   - space/folder/list access should disappear immediately.
   - created lists should remain, with `createdBy` effectively transferred to space owner.
2. User has FULL in a folder, creates lists, then is removed from folder:
   - folder/list visibility should disappear immediately.
   - created lists in that folder should remain under owner ownership.
3. Removed user should not retain stale list rows in sidebar/hierarchy due to embedded `List.members[]`.

## 16. Folder FULL Task Access Fix (May 9, 2026)

### 16.1 Problem observed
1. User invited with `FULL` at folder scope (without space-level permission) could create lists in that folder.
2. But once inside a list/task, update/delete/status actions were denied with permission errors.

### 16.2 Root cause
1. Permission middleware relied on denormalized task fields (`task.folder`, `task.space`, `task.workspace`) for context.
2. Some task rows only had `task.list` linkage, so folder context was missing during permission evaluation.
3. Missing folder context caused checks to fall back to workspace-role-only behavior, which blocked member actions.

### 16.3 Fix implemented
1. In permission middleware, task-context derivation now includes list-based fallbacks:
   - `spaceId`: if `task.space` missing, resolve via `task.list -> list.space`
   - `folderId`: if `task.folder` missing, resolve via `task.list -> list.folder || list.folderId`
   - `workspaceId`: if `task.workspace` missing, resolve via `task.list -> list.workspace`
2. This ensures folder override (`FolderMember.permissionLevel = FULL`) is correctly applied for task/list actions.

### 16.4 Affected file
1. `src/permissions/permission.middleware.ts`

### 16.5 API contract impact
1. No endpoint path or payload changes.
2. Behavior-only change for existing routes guarded by permission middleware, including:
   - task update/delete/status routes
   - list/task operations where task-based context resolution is used

### 16.6 Expected behavior after fix
1. Folder FULL user (without space-level grant) can:
   - create/update/delete lists inside that folder
   - create/update/delete tasks inside lists of that folder
   - change status/assign/comment per FULL matrix
2. Access outside that folder remains restricted.
   - If recipient is online (socket connected): emit `notification:new` over socket.
   - If recipient is offline: send FCM push to registered device tokens.
7. Client UI then:
   - Updates in-app unread lists/badges from socket/notification fetch.
   - Uses browser/service-worker notifications from FCM path.

### 14.2 Current service ownership
1. Canonical delivery logic:
   - `src/services/enhancedNotificationService.ts`
2. Legacy compatibility wrapper:
   - `src/services/notificationService.ts`
   - Note: `createNotification()` delegates to enhanced pipeline.
3. Token registration/read endpoints still use `notificationService` methods:
   - `registerDeviceToken`, `unregisterDeviceToken`, `getUserDevices`, `getUserNotifications`, `mark/read`, `unread-count`.

### 14.3 Notification category preference mapping
1. `githubCommits`:
   - `GITHUB_COMMIT`
2. `taskAssigned`:
   - `TASK_ASSIGNED`
3. `taskStatusChange`:
   - `TASK_STATUS_CHANGED`
4. `taskUpdates`:
   - `TASK_UPDATE`, `TASK_PRIORITY_CHANGED`, `SUBTASK_CREATED`, `DEPENDENCY_ADDED`, `DEPENDENCY_STATUS_CHANGED`, `FILE_UPLOAD`
5. `messages`:
   - `DM_NEW`
6. `mentions`:
   - `COMMENT_MENTION`, `MENTION`
7. `comments`:
   - `COMMENT_ADDED`, `COMMENT_UPDATED`, `COMMENT_DELETED`
8. `notices`:
   - `INVITATION`, `SPACE_INVITATION`, `INVITE_ACCEPTED`, `ANNOUNCEMENT_NEW`, `SYSTEM`

### 14.4 Notification APIs status (new/changed/existing)

1. `PATCH /api/users/notification-preferences`
   - Status: **NEW** (in tracked range)
   - Purpose: user-level preference toggles.
   - Notes: partially updates provided flags only.

2. `GET /api/notifications`
   - Status: **CHANGED** (query behavior expanded)
   - Purpose: paginated user notification feed.
   - Notes:
     - supports optional `workspaceId` query filter.
     - when provided, only notifications matching `data.workspaceId` are returned.
     - used by workspace notification pages/modals to avoid cross-workspace feed bleed.

3. `GET /api/notifications/unread-count`
   - Status: **CHANGED** (query behavior expanded)
   - Purpose: unread badge count for sidebar/bell.
   - Notes:
     - supports optional `workspaceId` query filter.
     - returns scoped unread count when filter is present.

4. `PATCH /api/notifications/:id/read`
   - Status: **EXISTING** (no path change)
   - Purpose: mark single notification read.

5. `PATCH /api/notifications/read-all`
   - Status: **CHANGED/CLARIFIED**
   - Purpose: mark all read.
   - Notes: canonical route file uses `PATCH`.
   - Notes (continued):
     - supports optional `workspaceId` query filter.
     - marks only notifications under that workspace when provided.

6. `POST /api/notifications`
   - Status: **EXISTING** (behavior hardened)
   - Purpose: manual/system-triggered notification creation.
   - Notes: creation now goes through unified pipeline.

7. `POST /api/notifications/fcm-token`
   - Status: **EXISTING (LEGACY ALIAS)**
   - Purpose: backward-compatible web FCM token registration shortcut.
   - Notes:
     - kept to avoid breaking existing mobile/web clients.
     - Swagger marked as deprecated alias.
     - accepts both `fcmToken` (preferred) and `token` (legacy payload key).

8. `POST /api/notifications/devices/fcm-token`
   - Status: **EXISTING (CANONICAL)**
   - Purpose: canonical device-scoped token registration route.
   - Notes:
     - accepts both `fcmToken` (preferred) and `token` (legacy payload key).

9. `POST /api/notifications/devices/register`
   - Status: **EXISTING**
   - Purpose: register full device details + token.

10. `DELETE /api/notifications/devices/unregister`
    - Status: **EXISTING**
    - Purpose: unregister token/device.

11. `GET /api/notifications/devices`
    - Status: **EXISTING**
    - Purpose: list active registered devices for current user.

### 14.5 Invite-related notification behavior (current)
1. Workspace invitation service (`invitationService`) uses unified pipeline.
2. Space invitation controller uses unified pipeline.
3. Workspace member invite endpoint now creates in-app invite notification in addition to email.
4. Invitation-accepted notification uses unified pipeline.

### 14.6 Related APIs that influence notification behavior
1. `POST /api/webhooks/github/:spaceId`
   - Generates commit notifications (`GITHUB_COMMIT`) + commit-log chat entry.
2. `GET /api/dm` and DM message send flows
   - DM notifications respect `messages` preference.
3. Task/comment/upload mutation APIs
   - Trigger notification types mapped above and gated by preferences.

### 14.7 Implementation notes for Flutter/Web clients
1. Treat `/api/notifications/unread-count` as server authority for badge reconciliation.
2. Keep local dedupe keyed by `notification._id` (or `notificationId` in FCM payload).
3. Use `PATCH /api/notifications/read-all` for bulk read.
4. Ensure FCM token registration happens after auth token is present.
5. For workspace-scoped screens/badges, always pass `workspaceId`:
   - `GET /api/notifications?workspaceId=<workspaceId>`
   - `GET /api/notifications/unread-count?workspaceId=<workspaceId>`
   - `PATCH /api/notifications/read-all?workspaceId=<workspaceId>`
