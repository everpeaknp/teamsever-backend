# Leave and Remote Request Decision State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure web and Flutter leave/remote DM cards refresh and accurately show approved, denied, or expired status after any decision or stale-action conflict.

**Architecture:** Backend remains authoritative and returns conflict for every already-terminal request. Both clients refresh conversation messages after successful actions and stale conflicts; decision controls disappear for terminal status and remain disabled during refresh or a failed refresh.

**Tech Stack:** Node/TypeScript backend, React/Vitest web, Flutter/Dart/Dio/BLoC.

**Spec:** `docs/superpowers/specs/2026-10-04-attendance-mobile-presence-and-request-state-design.md`

## Global Constraints

- Only `pending` requests are actionable.
- Approved, denied, and expired statuses remain visible in authorized DM history.
- A stale request never remains actionable during refresh; refresh failure keeps controls disabled and offers retry.
- Preserve requester/assigned-approver privacy and backend authorization.

## Review Focus

- Concurrent reviewers cannot both win a terminal transition; the second decision refreshes canonical status.
- Expiry at the workspace-local date boundary renders `expired` on both clients.
- A DM refresh failure never restores stale pending controls.
- Remote-work request privacy remains restricted to requester and authorized reviewer.
- Repeated taps while a request is pending are single-flight/idempotent.

---

### Task 1: Backend terminal conflict semantics and tests

**Files:**
- Modify: `src/services/leaveService.ts`
- Test: `src/__tests__/leaveApprovalFlow.test.ts`, plus focused terminal-state tests if required.

**Interfaces:**
- Keep existing response payload shape; use HTTP 409 for all already-terminal statuses, including approved and denied.
- Preserve expiry transition and authorization checks.

- [ ] **Step 1: Add failing tests** for approve-after-approved, deny-after-denied, approve/deny after expired, and ensure authorization remains checked before revealing terminal state.
- [ ] **Step 2: Run focused backend tests** and verify the existing 400 response causes the stale-state test to fail.
- [ ] **Step 3: Update both decision paths** to return conflict for any non-pending terminal status while keeping 404/403 authorization behavior intact.
- [ ] **Step 4: Run leave approval, expiry, and remote authorization tests**; commit as `fix(leave): return conflicts for terminal requests`.

### Task 2: Web DM card reconciliation

**Files:**
- Modify: `src/components/chat/LeaveCard.tsx`
- Modify or create: `src/components/chat/LeaveCard.test.tsx`

**Interfaces:**
- Use existing `onStatusUpdated` callback to refresh the conversation on success and 409.
- Add local `refreshingStatus` state; render disabled action feedback while the callback/refetch is in flight. If refresh fails, retain a disabled card and show retry.

- [ ] **Step 1: Add failing tests** for successful refresh, 409 refresh, actual terminal status after refresh, disabled controls during refresh, and refresh failure with retry.
- [ ] **Step 2: Run the component tests** to verify current 409 handling does not refresh.
- [ ] **Step 3: Implement refresh reconciliation** for approve and deny; ensure server errors unrelated to stale status remain actionable only when state is still confirmed pending.
- [ ] **Step 4: Run LeaveCard and chat window tests**; commit as `fix(chat): refresh stale leave decision cards`.

### Task 3: Flutter DM card reconciliation and terminal rendering

**Files:**
- Modify: `lib/features/chat/presentation/widgets/leave_remote_request_widgets.dart`
- Modify: relevant `MessageEntity` status typing/mapping if terminal enum is incomplete.
- Test: widget tests under `test/features/chat/presentation/widgets/`.

**Interfaces:**
- Flutter success dispatches `LoadMessages`; a stale 409 does the same while suppressing actions. Re-enable controls only after refreshed canonical `MessageEntity.metadata.status` is pending.
- Render terminal status/reason from refreshed DM metadata; offer an explicit retry refresh if the request cannot be reconciled.

- [ ] **Step 1: Write failing widget tests** for approved/denied/expired cards with no decision buttons, stale 409 refresh, busy state, and refresh failure/retry.
- [ ] **Step 2: Run focused widget tests** and confirm the stale pending card remains.
- [ ] **Step 3: Implement refresh-state reconciliation** and action-disable rules for remote and leave types.
- [ ] **Step 4: Run chat tests and Flutter analyzer**; commit as `fix(chat): reconcile mobile request decisions`.

### Task 4: Cross-client verification

**Files:**
- Only tests/docs if earlier tasks reveal compatibility gaps.

- [ ] **Step 1:** Verify a request created on one client, decided on another, and reopened in the first client displays canonical status without actionable buttons.
- [ ] **Step 2:** Verify expired requests remain in history but not pending queues.
- [ ] **Step 3:** Run focused backend, web, and Flutter suites, then broader relevant suites and production builds; record which native device/server integration checks require the user’s live environment.
