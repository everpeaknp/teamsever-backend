# BACKEND_SYSTEMS_AND_APIS

## 1. Document Scope
1. This document tracks backend systems and API behavior for the range:
   - Baseline commit: `5c5f61cf733812324f9fa840c243af90a822ec35`
   - Current HEAD: `b5dfe16` (plus current local documentation updates)
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
1. `b5dfe16` fix(dm): relax scoped message validation and align docs
2. `711ee68` fix(chat): align workspace unread state and document realtime flow
3. `aad5f59` docs(dm): document workspace auto-resolution fallback for start/send *(historical, later superseded by strict workspace requirement)*.
4. `e1bfe1a` fix(dm): auto-resolve workspace scope when client omits workspaceId *(historical, later superseded)*.
5. `ce922da` docs(swagger): align DM workspace requirements and notification endpoint docs
6. `02addde` fix(notifications): normalize FCM data payloads and guard missing messaging client
7. `287ec1c` fix(permissions): honor folder FULL for list actions and clean space-removal access
8. `0d230b5` fix(permissions): enforce scoped DM and folder-level access visibility
9. `71f6d61` fix(space-permissions): fully reset override by clearing nested space member permission
10. `86f47c0` fix(space-members): list only users currently in space
11. `99760b8` fix(rbac): allow space FULL to grant actions when list/folder override is weaker
12. `d5cb038` perf(hierarchy): include user space permission in hierarchy payload
13. `0c3c118` fix(comments): enforce COMMENT_TASK permission on task comment route
14. `70bd091` fix(space-members): avoid enum import crash in permission validation
15. `b6cc583` fix(space-members): prevent 500 on permission update for mixed member shapes
16. `c2cc554` fix(access): enforce full-scope permissions and workspace-scoped chat/dm
17. `55b2960` fix(analytics): remove 100-task cap from workspace analytics payload
18. `d829be8` docs(swagger): point production server URL to Render
19. `b7d9bbb` chore(notifications): keep legacy fcm route as deprecated alias with compat payload
20. `f3378fc` docs(swagger): document workspaceId filtering for notification endpoints
21. `5d2b5b8` fix(notifications): add workspace-scoped fetch/unread/read-all filtering
22. `e682aab` fix(notifications): unify pipeline, enforce prefs, and normalize invite alerts
23. `207e400` docs(swagger): add missing route docs and clean duplicate webhook block
24. `53d925e` harden manual notification type handling with safe enum fallback
25. `f8ad84e` add deletable custom chat channels and protect permanent system channels
26. `c252d49` fix folder workspace resolution for ObjectId spaceId in permission middleware
27. `e86004e` fix folder page access for folder-level members without list memberships
28. `48c33ea` fix folder permission 500 from undefined enum and null member refs
29. `0240d6e` fix GitHub auth signup fallback and account matching
30. `8b4b976` folders APIs updates
31. `18067c1` fix DM room ID mismatch and realtime updates for group chat API messages
32. `adf05c1` robust user ID extraction for GitHub commit notifications
33. `689df09` restrict DMs to workspace members in backend
34. `dbd8fcc` allow `GITHUB_COMMIT` and `ANNOUNCEMENT_NEW` notification types in schema
35. `b9c8ba3` support user-based filtering in chat API

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
15. DM workspace scope strictness:
   - DM start/send endpoints now require explicit client `workspaceId`.
   - Workspace fallback/auto-resolution path was removed to prevent cross-workspace ambiguity.
   - Requests fail fast with `400` when workspace scope is missing.
16. DM conversation access strictness:
   - `GET /api/dm/:conversationId`
   - `GET /api/dm/:conversationId/messages`
   - `PATCH /api/dm/:conversationId/read`
   - now require `workspaceId` and verify `conversation.workspace` matches the requested scope.
17. Workspace chat unread/realtime alignment:
   - `GET /api/workspaces/:workspaceId/chat/unread` and `PATCH /api/workspaces/:workspaceId/chat/read` are the authoritative unread/read contract.
   - Workspace chat emission path publishes `chat:new` to both `channel:{channelId}` and `workspace:{workspaceId}` rooms for consistent sidebar + active-view sync.
18. DM list pagination + performance:
   - `GET /api/dm` now supports `page` and `limit`.
   - Response now includes `pagination: { total, page, pages, limit, hasMore }`.
19. Workspace channel list pagination:
   - `GET /api/workspaces/:workspaceId/chat/channels` now supports `page` and `limit`.
   - Response now includes `pagination: { total, page, pages, limit, hasMore }`.
20. DM duplicate conversation hardening:
   - Added deterministic `Conversation.conversationKey = ${workspaceId}:${minUserId}:${maxUserId}`.
   - Added unique sparse index on `conversationKey`.
   - `findOrCreateConversation` now uses key-based lookup and handles concurrent-create race via duplicate-key retry.
   - Conversation list now applies legacy de-dup (same counterpart appearing with old duplicate records) while returning latest record first.
21. DM conversation unread-count query optimization:
   - Replaced per-conversation `countDocuments` N+1 pattern with a single aggregation grouped by `conversation`.
   - Reduces query count and latency for conversation list endpoints.

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

### 4.5.3 Changed: Workspace channel list pagination
- Method: `GET`
- Path: `/api/workspaces/:workspaceId/chat/channels`
- New query support:
  - `page` (optional, default `1`)
  - `limit` (optional, default `30`, controller max capped)
- Response update:
  - now returns `pagination: { total, page, pages, limit, hasMore }`

### 4.5.4 New: Delete channel
- Method: `DELETE`
- Path: `/api/workspaces/:workspaceId/chat/channels/:channelId`
- Authorization:
  - Channel creator OR workspace admin/owner
- Safety rule:
  - Permanent channels cannot be deleted:
    - `General`
    - `Commit Log`

### 4.5.5 Behavior update: default channel provisioning
- Service-level change:
  - System now ensures both default channels are present:
    - `General`
    - `Commit Log`

### 4.5.6 New: Workspace chat unread count
- Method: `GET`
- Path: `/api/workspaces/:workspaceId/chat/unread`
- Purpose: return the current user's unread count for workspace chat.
- Behavior:
  1. Validates the caller is a member of the workspace.
  2. Resolves only channels/messages the caller can actually access.
  3. Excludes the caller's own messages from unread totals.
  4. Uses `Workspace.members[].lastChatReadAt` as the server-side read cursor.
  5. If no read cursor exists yet, unread count is computed against the full visible feed.

### 4.5.7 New: Mark workspace chat as read
- Method: `PATCH`
- Path: `/api/workspaces/:workspaceId/chat/read`
- Purpose: mark workspace chat as read for the current user.
- Behavior:
  1. Validates the caller is a member of the workspace.
  2. Updates `Workspace.members[].lastChatReadAt` to the current server time.
  3. Clears workspace-chat unread state for visible messages up to that mark time.

## 4.6 Direct Message APIs

### 4.6.1 Changed: Conversation list (workspace required)
- Method: `GET`
- Path: `/api/dm`
- Required query:
  - `workspaceId`
- Optional query:
  - `page` (default `1`)
  - `limit` (default `20`, controller max capped)
- Behavior:
  - Returns only conversations inside the provided workspace scope.
  - Requests without `workspaceId` return `400`.
  - Returns `pagination: { total, page, pages, limit, hasMore }`.

### 4.6.2 Changed: Start conversation (strict workspace required)
- Method: `POST`
- Path: `/api/dm/:userId`
- Required request field:
  - `workspaceId`
- Behavior:
  - Creates/finds DM thread only in the provided workspace scope.
  - Both users must belong to that workspace.
  - No fallback workspace resolution is used anymore.
  - Returns `400` when `workspaceId` is missing.

### 4.6.3 Changed: Send message (strict workspace required)
- Method: `POST`
- Path: `/api/dm/:userId/message`
- Required request fields:
  - `content`
- Required scope fields:
  - `workspaceId` in body/query/header
- Behavior:
  - Sends DM message only in the provided workspace scope.
  - No fallback workspace resolution is used anymore.
  - Returns `400` when `workspaceId` is missing.

### 4.6.4 Changed: DM conversation uniqueness and duplicate prevention
- Model/service behavior:
  - Conversation now uses deterministic key:
    - `conversationKey = ${workspaceId}:${sortedUserA}:${sortedUserB}`
  - Unique sparse index on `conversationKey`.
  - Create path now handles duplicate-key race and re-reads existing conversation.
- Result:
  - Prevents duplicate DM threads for same user pair in same workspace under concurrent requests.

### 4.6.5 Changed: DM conversation unread count query efficiency
- `GET /api/dm` conversation listing no longer performs one `countDocuments` per conversation.
- Replaced with one aggregate grouped by `conversation` for the current page.
- Result:
  - lower query count
  - lower p95 latency for large conversation lists

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

## 4.10 Invitations and Bulk Onboarding

### 4.10.1 Invitation types currently supported
1. Workspace invitations
   - Scope: entire workspace membership
   - API: `POST /api/workspaces/:workspaceId/invites`
   - Accept flow: `POST /api/invites/accept/:token`
   - List pending: `GET /api/workspaces/:workspaceId/invites`
   - My pending invites: `GET /api/invites/my-invitations`
   - Cancel: `DELETE /api/workspaces/:workspaceId/invites/:invitationId`
2. Space invitations
   - Scope: one space inside a workspace
   - API: `POST /api/spaces/:spaceId/invitations`
   - Accept flow: `POST /api/space-invitations/accept/:token`
   - Decline flow: `POST /api/space-invitations/decline/:token`
   - List pending: `GET /api/spaces/:spaceId/invitations`
   - My pending invites: `GET /api/space-invitations/my-invitations`
   - Cancel: `DELETE /api/spaces/:spaceId/invitations/:invitationId`
3. Direct member add by email
   - Scope: add an existing user directly into a workspace member list
   - API: `POST /api/workspaces/:workspaceId/members/invite`
   - Note: this is the fast path for existing users already in the system.
4. External user space invite shortcut
   - Scope: invites non-workspace users into a space through the space route
   - API: `POST /api/spaces/:id/invite-external`
   - Used when the target user is not already part of the workspace.

### 4.10.2 Bulk onboarding rule set
1. There is no single built-in bulk-invite endpoint today.
2. Each invitation is still created one scope at a time, but the backend enforces duplicate protection through pending-invite checks and existing-member checks.
3. For 200+ users, the safest operating model is:
   - group inputs by `workspaceId`
   - inside each workspace, group again by `spaceId`
   - send workspace invites first for external users
   - send space invites only after the user is already a workspace member
   - use direct member-add by email when the user already exists and should be added immediately to the workspace
4. Process the workload asynchronously:
   - chunk jobs in small batches
   - queue email/notification delivery
   - retry failed sends independently
   - record invitation status per target user/scope so failed items can be resumed without duplicating successful ones
5. Acceptance behavior:
   - workspace acceptance adds the user to the workspace only
   - space acceptance adds or updates the user’s access inside that space
   - a workspace member still needs a separate space invitation if that space is not automatically assigned
6. Duplicate-safety constraints already in the backend:
   - workspace invitation uniqueness is guarded by `workspaceId + email + status`
   - space invitation uniqueness is guarded by `spaceId + email + status`
   - invitations to users already in the target scope are rejected early

### 4.10.3 Recommended onboarding sequence for large imports
1. Build a source list with columns like:
   - `email`
   - `workspaceId`
   - `spaceId`
   - `targetType` (`workspace` or `space`)
   - `role` or `permissionLevel`
2. For each row:
   - if target is `workspace`, create a workspace invite or direct member add
   - if target is `space`, ensure the workspace membership exists first, then create the space invitation
3. Re-run only failed rows after manual review.
4. Prefer a script or background job for this workload rather than a manual UI session.

## 4.11 Platform/Infra Behavior
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

## 5.7 `Workspace.members[]`
1. Added `lastChatReadAt: Date | null`
2. Purpose:
   - stores per-user workspace chat read cursor
   - acts as the backend source of truth for workspace-group unread calculation
3. Scope note:
   - this is workspace-level read-state, not per-channel read-state
   - it is used for the current `General`/workspace-feed unread model

## 5.8 `Conversation`
1. Added `conversationKey` (string, sparse indexed, unique).
2. Purpose:
   - deterministic unique pair key per workspace for DM threads.
   - prevents duplicate DM rows for same user pair + workspace.

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
5. Workspace chat sends now also propagate workspace context into socket emission path so realtime consumers can update:
   - workspace room `workspace:{workspaceId}`
   - channel room `channel:{channelId}`

## 6.3 `directMessageService.getConversations()`
1. Uses strict workspace scoping when `workspaceId` is provided from controller (now required in API contract for list/start/send flows).
2. Now supports `page/limit` pagination contract.
3. Uses single aggregate for unread counts per page (removes N+1 count pattern).
4. Applies legacy duplicate-thread de-dup in list response to avoid duplicate same-user rows from historical data.

## 6.3A `chatController` workspace unread/read behavior
1. `getWorkspaceUnreadCount()` now calculates unread using:
   - accessible channel set
   - `sender != currentUser`
   - `createdAt > members[].lastChatReadAt` when cursor exists
2. `markWorkspaceChatAsRead()` writes the read cursor back into the matching embedded workspace member row.
3. This replaces placeholder-style unread behavior and lets the client reconcile live socket events against a server-backed read state.

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
3. Workspace chat realtime fan-out now has dual scope:
   - channel room emission for room-specific listeners
   - workspace room emission for sidebar/global listeners
4. This is important because sidebar/group unread indicators are fed from workspace-level socket updates, while open-room chat views may still subscribe at channel level.

## 9. Flutter Integration Notes (Actionable)
1. DM APIs are workspace-scoped:
   - `GET /api/dm?workspaceId=<id>` still requires explicit workspace scope.
   - `POST /api/dm/:userId` requires `{ workspaceId }`.
   - `POST /api/dm/:userId/message` requires `{ workspaceId, content }`.
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
10. `POST /api/dm/:userId` now documents required `workspaceId` body (strict scoping).
11. `POST /api/dm/:userId/message` now documents required `workspaceId` in payload schema (`DMMessageInput`).
12. `POST/GET /api/spaces/:spaceId/tables` docs now mention folder scoping (`folderId`).
13. Cleaned duplicated Swagger block for `/api/spaces/{id}/webhook`.
14. Notification schema enum list updated to include `GITHUB_COMMIT`, `ANNOUNCEMENT_NEW`, and `MENTION`.
15. Swagger server production URL points to Render deployment.
16. `GET /api/workspaces/:workspaceId/chat/unread`
17. `PATCH /api/workspaces/:workspaceId/chat/read`

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
   - [ ] `GET /api/workspaces/:workspaceId/chat/unread`
   - [ ] `PATCH /api/workspaces/:workspaceId/chat/read`
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

## 17. Workspace Chat Read-State + Realtime Alignment (May 9, 2026)

### 17.1 Commits/Scope
1. Current local/backend update after `1c9b145`
2. Frontend was aligned in parallel so unread badges, realtime room updates, and active-view read sync now match the backend contract.

### 17.2 Problem observed
1. Group chat unread badge could stay non-zero even after user was already viewing the workspace chat.
2. Sidebar/global listeners were not always updated by channel-only socket emissions.
3. Browser popup behavior could overlap with active realtime handling if frontend/socket state was not aligned.

### 17.3 Backend fix
1. Added `Workspace.members[].lastChatReadAt`.
2. Implemented `GET /api/workspaces/:workspaceId/chat/unread`.
3. Implemented `PATCH /api/workspaces/:workspaceId/chat/read`.
4. Updated workspace chat send/socket path so workspace-level socket rooms also receive `chat:new`.

### 17.4 Practical runtime behavior now
1. When user opens workspace chat:
   - client should call `PATCH /api/workspaces/:workspaceId/chat/read`
2. When new workspace message arrives:
   - backend emits to both workspace room and channel room
3. When client asks for unread:
   - backend returns count based on read cursor + visible messages only
4. Result:
   - active user can clear/stabilize unread correctly
   - sidebar/global indicators can move in realtime without waiting for refresh

### 17.5 Important limitation
1. This is currently a workspace-level group chat read model.
2. It is not a per-channel per-user read cursor system.
3. That is acceptable for the current `General`/workspace chat UX, but future multi-channel unread precision would need a dedicated channel read-state model.

### 17.6 Client integration requirement
1. Web/mobile clients should treat these as the authoritative workspace-group endpoints:
   - `GET /api/workspaces/:workspaceId/chat/unread`
   - `PATCH /api/workspaces/:workspaceId/chat/read`
2. Client should still keep local optimistic/socket state, but server read cursor should be used for final reconciliation.

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
     - requires `workspaceId` query filter.
     - returns only notifications matching `data.workspaceId`.
     - used by workspace notification pages/modals to avoid cross-workspace feed bleed.

3. `GET /api/notifications/unread-count`
   - Status: **CHANGED** (query behavior expanded)
   - Purpose: unread badge count for sidebar/bell.
   - Notes:
     - requires `workspaceId` query filter.
     - returns scoped unread count.

4. `PATCH /api/notifications/:id/read`
   - Status: **EXISTING** (no path change)
   - Purpose: mark single notification read.

5. `PATCH /api/notifications/read-all`
   - Status: **CHANGED/CLARIFIED**
   - Purpose: mark all read.
   - Notes: canonical route file uses `PATCH`.
   - Notes (continued):
     - requires `workspaceId` query filter.
     - marks only notifications under that workspace.

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

## 16. Backend Performance Hardening Checklist (Current Recommendation)
1. Index verification in production:
   - Ensure `Conversation.conversationKey` unique sparse index exists.
   - Ensure `Conversation` query indexes cover workspace participant feed sort:
     - `{ workspace: 1, participants: 1, lastMessageAt: -1 }`
   - Ensure chat channel list path has index support:
     - `{ workspace: 1, isDeleted: 1, lastMessageAt: -1 }`
2. Query patterns already improved in this update:
   - DM conversation list is paginated.
   - Workspace channel list is paginated.
   - DM unread counts are aggregated in one query per page.
3. Recommended next tuning:
   - Add request-level timing logs for top paths:
     - `GET /api/dm`
     - `GET /api/workspaces/:workspaceId/chat/channels`
     - `GET /api/chat/channels/:channelId/messages`
   - Add short TTL cache for workspace hierarchy and badge aggregates.
   - Keep socket invalidation hooks where cache is introduced (DM send, chat send, read-all operations).

## 17. DM Duplicate Cleanup Runbook (One-Time Data Repair)
Use this when legacy DM data created duplicate conversations for the same two users in the same workspace.

### 17.1 Why this exists
1. Older flows could create multiple DM conversations for one user pair.
2. Symptom in clients:
   - same user appears multiple times in DM list
   - unread counts split across duplicate threads
3. Code-level prevention now exists:
   - deterministic `conversationKey`
   - unique sparse index on `conversationKey`
4. This runbook repairs old records.

### 17.2 Script location
1. File: `scripts/dedup-dm-conversations.js`
2. NPM commands:
   - `npm run dm:dedup:dry`
   - `npm run dm:dedup`

### 17.3 What the script does
1. Groups conversations by deterministic key:
   - `${workspaceId}:${sortedUserA}:${sortedUserB}`
2. Keeps the most recent conversation as canonical for each duplicate set.
3. Re-points dependent records from duplicate conversations to canonical:
   - `DirectMessage.conversation`
   - `Attachment.conversation`
   - `Notification.data.conversationId` and `Notification.data.resourceId` (when matching old conversation IDs)
4. Recomputes canonical conversation metadata:
   - `lastMessage`
   - `lastMessageAt`
   - `conversationKey`
5. Deletes duplicate conversation rows (live mode only).
6. Fills missing `conversationKey` for surviving rows (live mode).

### 17.4 Safety behavior
1. `--dry-run` mode:
   - scans and reports duplicate sets
   - runs no destructive conversation deletion
2. Live mode:
   - performs rewrites and deletes duplicates
3. Recommended sequence:
   - run `npm run dm:dedup:dry`
   - verify counts/log output
   - run `npm run dm:dedup`

### 17.5 Expected output summary
Script prints totals for:
1. duplicate sets found
2. duplicate conversation docs
3. messages re-pointed
4. attachments re-pointed
5. notifications updated
6. conversations deleted

## 18. API Collection Sync Status (`api_teamsever.json`)
1. `api_teamsever.json` has been regenerated from `src/config/swagger.ts` as source of truth.
2. This now includes all currently documented APIs, including:
   - GitHub auth + webhook routes
   - workspace chat + channel endpoints
   - strict workspace-scoped DM endpoints
   - notification preferences and workspace-scoped notification endpoints
   - legacy + canonical FCM token/device endpoints
3. Recommended maintenance:
   - whenever Swagger route docs are updated, regenerate `api_teamsever.json` from Swagger so Postman stays in lock-step.

## 18. API Inventory (Current Route Map)
This section lists the current HTTP endpoints as mounted in the server route map. Use this as the source of truth for Postman and client integration.

### 18.1 Auth & Identity (public)
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/google
- POST /api/auth/github
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

### 18.2 Users (auth)
- GET /api/users/profile
- PATCH /api/users/profile
- PATCH /api/users/notification-preferences

### 18.3 Workspaces (auth)
- GET /api/workspaces
- POST /api/workspaces
- GET /api/workspaces/:id
- PUT /api/workspaces/:id
- DELETE /api/workspaces/:id
- GET /api/workspaces/:id/hierarchy
- GET /api/workspaces/:id/analytics
- GET /api/workspaces/:id/announcements
- POST /api/workspaces/:id/announcements
- DELETE /api/workspaces/:id/announcements/:announcementId
- POST /api/workspaces/:id/clock/toggle
- GET /api/workspaces/:id/sticky-note
- PATCH /api/workspaces/:id/sticky-note
- PATCH /api/workspaces/:id/logo
- PATCH /api/workspaces/:workspaceId/members/:memberId/custom-role

### 18.4 Workspace Members (auth)
- GET /api/workspaces/:workspaceId/members
- POST /api/workspaces/:workspaceId/members/invite
- PATCH /api/workspaces/:workspaceId/members/me/status
- PATCH /api/workspaces/:workspaceId/members/:userId
- DELETE /api/workspaces/:workspaceId/members/:userId

### 18.5 Workspace Invitations (auth unless noted)
- POST /api/workspaces/:workspaceId/invites
- GET /api/workspaces/:workspaceId/invites
- DELETE /api/workspaces/:workspaceId/invites/:invitationId
- POST /api/invites/accept/:token
- GET /api/invites/my-invitations
- GET /api/invites/verify/:token (public)

### 18.6 Spaces (auth)
- GET /api/workspaces/:workspaceId/spaces
- POST /api/workspaces/:workspaceId/spaces
- GET /api/spaces/:id
- PATCH /api/spaces/:id
- DELETE /api/spaces/:id
- POST /api/spaces/:id/members
- DELETE /api/spaces/:id/members/:userId
- GET /api/spaces/:id/metadata
- GET /api/spaces/:id/lists/metadata
- GET /api/spaces/:id/webhook
- POST /api/spaces/:id/webhook
- POST /api/spaces/:id/invite-external

### 18.7 Space Members (auth)
- GET /api/spaces/:spaceId/space-members
- POST /api/spaces/:spaceId/space-members
- PATCH /api/spaces/:spaceId/space-members/:userId
- DELETE /api/spaces/:spaceId/space-members/:userId

### 18.8 Space Invitations (auth unless noted)
- POST /api/spaces/:spaceId/invitations
- GET /api/spaces/:spaceId/invitations
- DELETE /api/spaces/:spaceId/invitations/:invitationId
- POST /api/space-invitations/accept/:token
- POST /api/space-invitations/decline/:token
- GET /api/space-invitations/my-invitations

### 18.9 Folders (auth)
- GET /api/spaces/:spaceId/folders
- POST /api/spaces/:spaceId/folders
- GET /api/folders/:id
- PATCH /api/folders/:id
- DELETE /api/folders/:id
- GET /api/folders/:folderId/folder-members
- POST /api/folders/:folderId/folder-members
- PATCH /api/folders/:folderId/folder-members/:userId
- DELETE /api/folders/:folderId/folder-members/:userId

### 18.10 Lists (auth)
- GET /api/spaces/:spaceId/lists
- POST /api/spaces/:spaceId/lists
- GET /api/lists/:id
- PATCH /api/lists/:id
- DELETE /api/lists/:id
- GET /api/lists/:listId/list-members
- POST /api/lists/:listId/list-members
- PATCH /api/lists/:listId/list-members/:userId
- DELETE /api/lists/:listId/list-members/:userId

### 18.11 Tasks (auth)
- GET /api/lists/:listId/tasks
- POST /api/lists/:listId/tasks
- GET /api/tasks/:id
- PATCH /api/tasks/:id
- DELETE /api/tasks/:id
- GET /api/tasks/:taskId/subtasks
- POST /api/tasks/:taskId/subtasks
- GET /api/tasks/:taskId/dependencies
- POST /api/tasks/:taskId/dependencies
- DELETE /api/tasks/:taskId/dependencies/:depId
- GET /api/tasks/:taskId/dependents

### 18.12 Task Dependencies (auth)
- POST /api/task-dependencies
- DELETE /api/task-dependencies/:id
- GET /api/task-dependencies/task/:taskId
- GET /api/task-dependencies/task/:taskId/blocking

### 18.13 Custom Fields (auth)
- POST /api/custom-fields
- PUT /api/custom-fields/:id
- DELETE /api/custom-fields/:id
- GET /api/custom-fields/workspace/:workspaceId
- GET /api/custom-fields/project/:projectId

### 18.14 Recurring Tasks (auth)
- GET /api/recurring/workspace/:workspaceId
- GET /api/recurring/:taskId/instances
- POST /api/recurring/:taskId/stop
- POST /api/recurring/process

### 18.15 Activity, Comments, Reactions (auth)
- GET /api/activities
- GET /api/workspaces/:workspaceId/activity
- GET /api/tasks/:taskId/activity
- POST /api/tasks/:taskId/comments
- PUT /api/activities/:activityId
- DELETE /api/activities/:activityId
- POST /api/activities/:activityId/reactions
- DELETE /api/activities/:activityId/reactions
- GET /api/folders/:folderId/activity
- GET /api/spaces/:spaceId/commits

### 18.16 Chat and Direct Messages (auth)
- GET /api/workspaces/:workspaceId/chat
- POST /api/workspaces/:workspaceId/chat
- GET /api/workspaces/:workspaceId/chat/channels
- POST /api/workspaces/:workspaceId/chat/channels
- PATCH /api/workspaces/:workspaceId/chat/channels/:channelId
- DELETE /api/workspaces/:workspaceId/chat/channels/:channelId
- GET /api/workspaces/:workspaceId/chat/unread
- PATCH /api/workspaces/:workspaceId/chat/read
- GET /api/chat/channels/:channelId/messages
- GET /api/chat/channels/:channelId/unread
- DELETE /api/chat/:id
- GET /api/dm
- POST /api/dm/:userId
- GET /api/dm/:conversationId
- POST /api/dm/:userId/message
- GET /api/dm/:conversationId/messages
- PATCH /api/dm/:conversationId/read

### 18.17 Notifications (auth unless noted)
- GET /api/notifications
- POST /api/notifications
- GET /api/notifications/unread-count
- PATCH /api/notifications/read-all
- PATCH /api/notifications/:id/read
- POST /api/notifications/fcm-token (legacy alias)
- POST /api/notifications/devices/fcm-token
- POST /api/notifications/devices/register
- DELETE /api/notifications/devices/unregister
- GET /api/notifications/devices

### 18.18 Presence (auth)
- GET /api/presence/:workspaceId
- GET /api/presence/:workspaceId/online
- GET /api/presence/user/:userId

### 18.19 Files and Uploads (auth)
- POST /api/upload/tasks/:taskId/attachments
- GET /api/upload/tasks/:taskId/attachments
- POST /api/upload/comments/:commentId/attachments
- POST /api/tasks/:taskId/attachments/init-upload
- POST /api/tasks/:taskId/attachments/confirm
- GET /api/tasks/:taskId/attachments
- DELETE /api/attachments/:attachmentId
- POST /api/workspaces/:workspaceId/files/init-upload
- POST /api/workspaces/:workspaceId/files/confirm
- GET /api/workspaces/:workspaceId/files
- GET /api/workspace-files/:id
- DELETE /api/workspace-files/:id

### 18.20 Documents (auth)
Note: document routes are mounted at /api/docs in the server route map even though swagger annotations mention /api/documents.
- POST /api/docs
- GET /api/docs/me
- GET /api/docs/workspace/:workspaceId
- GET /api/docs/workspace/:workspaceId/hierarchy
- GET /api/docs/:id
- PATCH /api/docs/:id
- DELETE /api/docs/:id

### 18.21 Tables (auth)
- POST /api/spaces/:spaceId/tables
- GET /api/spaces/:spaceId/tables
- GET /api/tables/:tableId
- PATCH /api/tables/:tableId
- DELETE /api/tables/:tableId
- POST /api/tables/:tableId/columns
- PATCH /api/tables/:tableId/columns/:columnId
- DELETE /api/tables/:tableId/columns/:columnId
- POST /api/tables/:tableId/rows
- DELETE /api/tables/:tableId/rows/:rowId
- PATCH /api/tables/:tableId/rows/:rowId/cells/:columnId
- PATCH /api/tables/:tableId/rows/:rowId/colors/:columnId
- PATCH /api/tables/:tableId/rows/:rowId/text-colors/:columnId
- GET /api/tables/:tableId/export
- GET /api/tables/:tableId/table-members
- POST /api/tables/:tableId/table-members
- PATCH /api/tables/:tableId/table-members/:userId
- DELETE /api/tables/:tableId/table-members/:userId

### 18.22 Time Tracking and Attendance (auth)
- GET /api/tasks/time/active
- POST /api/tasks/:id/time/start
- POST /api/tasks/:id/time/stop
- POST /api/tasks/:id/time/manual
- GET /api/tasks/:id/time/logs
- DELETE /api/tasks/:id/time/logs/:logId
- GET /api/time/admin/workspace/:workspaceId/active
- GET /api/time/admin/workspace/:workspaceId/timesheets
- GET /api/time/admin/workspace/:workspaceId/stats
- POST /api/time/admin/stop/:entryId
- POST /api/time/admin/workspace/:workspaceId/cleanup-orphaned
- POST /api/time/admin/workspace/:workspaceId/stop-user-timers/:userId
- POST /api/time/start/:taskId
- POST /api/time/stop/:entryId
- POST /api/time/manual
- GET /api/time/running
- GET /api/time/task/:taskId
- GET /api/time/project/:projectId
- DELETE /api/time/:entryId
- POST /api/workspaces/:id/clock/toggle
- GET /api/attendance/workspace/:workspaceId/report
- GET /api/attendance/workspace/:workspaceId/export
- GET /api/attendance/workspace/:workspaceId/export-excel

### 18.23 Performance (auth)
- GET /api/performance/me/workspace/:workspaceId
- GET /api/performance/user/:userId/workspace/:workspaceId
- GET /api/performance/team/workspace/:workspaceId
- GET /api/performance/workspace/:workspaceId/summary

### 18.24 Search (auth)
- GET /api/search

### 18.25 Subscription, Plans, Payments, Entitlements (auth)
- GET /api/subscription/info
- GET /api/subscription/next-plan
- POST /api/plans
- GET /api/plans
- GET /api/plans/:id
- PATCH /api/plans/:id
- DELETE /api/plans/:id
- GET /api/entitlements/check
- GET /api/entitlements/usage
- POST /api/payment/initiate
- POST /api/payment/verify
- GET /api/payment/transactions
- GET /api/payment/transactions/:transactionId

### 18.26 Super Admin (auth)
- GET /api/super-admin/users
- PATCH /api/super-admin/users/:userId/subscription
- GET /api/super-admin/analytics
- GET /api/super-admin/settings
- PUT /api/super-admin/settings

### 18.27 Feedback (auth)
- POST /api/feedback
- GET /api/feedback
- PATCH /api/feedback/:feedbackId/resolve

### 18.28 Currency (public unless noted)
- GET /api/currency/rate
- POST /api/currency/convert
- POST /api/currency/refresh (auth)

### 18.29 Webhooks (public)
- POST /api/webhooks/github/:spaceId

### 18.30 Misc (public)
- GET /health
- GET /
