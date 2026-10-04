# Flutter Desktop Presence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the signed-in member’s server-reported paired-desktop app/AFK timeline in the Flutter Attendance destination.

**Architecture:** Reuse the existing authenticated workspace desktop-activity endpoint and Flutter attendance data/repository conventions. Add a distinct Presence section, typed timeline event/gap models, and a small focused presentation state; never sample apps on the phone.

**Tech Stack:** Flutter/Dart, Dio, flutter_bloc, existing AttendanceTheme and widget-test tooling.

**Spec:** `docs/superpowers/specs/2026-10-04-attendance-mobile-presence-and-request-state-design.md`

## Global Constraints

- Personal timeline only by default; do not request or expose team history from this screen.
- Active, AFK, unavailable, and tracking gap are distinct; a gap is unknown activity, never AFK.
- A phone displays only server reports and never claims to detect laptop activity.
- Use 16 px page gutters, existing Attendance theme, touch controls ≥44 px, and the selected range from Attendance UI.

## Review Focus

- Empty data distinguishes “no reports yet / pair a desktop” from loading or network error.
- Invalid or partial response fields fall back safely rather than breaking the whole timeline.
- Timeline ordering handles equal/overlapping timestamps deterministically and excludes gaps from app duration.
- An expired pairing code is never shown again and is not logged.
- Workspace switching cannot display the prior workspace/member timeline.

---

### Task 1: Timeline models and data boundary

**Files:**
- Create: `lib/features/attendance/data/models/desktop_presence_timeline_model.dart`
- Create: `lib/features/attendance/domain/entities/desktop_presence_timeline_entity.dart`
- Modify: `lib/features/attendance/data/datasources/attendance_remote_data_source.dart`
- Modify: `lib/features/attendance/data/repositories/attendance_repository_impl.dart`
- Modify: `lib/features/attendance/domain/repositories/attendance_repository.dart`
- Modify: attendance injection registration only if a new dependency is needed.
- Test: `test/features/attendance/data/datasources/attendance_remote_data_source_test.dart` and model/repository tests.

**Interfaces:**
- Add `getDesktopPresence({required String workspaceId, required DateTime startDate, required DateTime endDate})` returning typed event/gap timeline data.
- Query `/api/attendance/workspace/:workspaceId/desktop-activity` without `userId`, relying on backend's authenticated-self default; verify controller behavior before implementation. If self-default is not safe, add/use a server-enforced self-only selector.

- [ ] **Step 1: Write failing datasource/model tests** for populated events, gaps, optional app IDs/status/capabilities, empty response, malformed response, and HTTP error mapping.
- [ ] **Step 2: Run focused tests** to confirm the new API/model behavior is absent.
- [ ] **Step 3: Implement parsing and repository result handling** with nullable-safe fields and inclusive date query formatting.
- [ ] **Step 4: Run datasource/model/repository tests** and confirm red-to-green behavior.
- [ ] **Step 5: Commit** as `feat(attendance): add desktop presence timeline data`.

### Task 2: Presence section and timeline states

**Files:**
- Modify: `lib/features/attendance/presentation/pages/attendance_screen.dart`
- Create: focused presence section widget and cubit/bloc under `lib/features/attendance/presentation/`
- Create: app icon resolver/widget under `lib/features/attendance/presentation/widgets/`
- Test: widget and state tests under `test/features/attendance/presentation/`

**Interfaces:**
- State: loading, loaded(events, gaps), empty, and error(message).
- Load uses current workspace and selected start/end date; refresh on pull-to-refresh and app resume. No short-interval polling.
- App icon resolver maps recognized app IDs to local icons and uses a generic app-window fallback.

- [ ] **Step 1: Write failing state/widget tests** for loading, empty/unpaired instructions, permission denied, network error/retry, event+gap ordering, app icon fallback, and active/AFK labels.
- [ ] **Step 2: Run targeted Flutter tests** and confirm failures are due to the missing section/state.
- [ ] **Step 3: Add an Attendance section switch** that keeps Overview/Timesheets and Presence separate; preserve existing clock controls and bottom navigation.
- [ ] **Step 4: Implement day-grouped timeline cards** with 16 px gutters, 14–16 px card insets, app icon/name, state, local interval, gaps, and interval-derived usage totals/session counts when data supports them.
- [ ] **Step 5: Verify range/workspace updates**, pull-to-refresh, foreground resume, and selected member privacy; do not calculate attendance/payable hours from AFK.
- [ ] **Step 6: Run Flutter tests and analyzer**; commit as `feat(attendance): display desktop presence in Flutter`.

### Task 3: Flutter visual verification

**Files:**
- Modify only Presence widgets/styles from Task 2 if visual review requires.

- [ ] **Step 1:** Render/test at 320, 360, 390, and 430 logical px; inspect card proportions, text wrapping, touch targets, and safe areas.
- [ ] **Step 2:** Fix overflow and spacing inconsistencies with existing attendance tokens.
- [ ] **Step 3:** Run affected widget tests and analyzer; commit any follow-up separately.
