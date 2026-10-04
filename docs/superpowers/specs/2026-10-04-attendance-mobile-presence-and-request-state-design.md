# Attendance Mobile, Desktop Presence, and Request State Design

## Goal

Make attendance records easy to read and audit on phones, let Flutter show desktop-reported presence for the signed-in member, and ensure leave/remote request cards always reflect the backend's final decision. Preserve the existing clock-in/out, location, permissions, consent, pairing, and attendance-duration rules.

## Confirmed current behavior

- Web Attendance renders the seven-column timesheet as a table at every width. At phone widths the location columns consume the layout and make records hard to scan.
- Clock-in location verification is record-level audit data. A stale or low-accuracy location message must not be presented as a general timesheets failure.
- Flutter's Attendance view has summaries, charts, and a day-by-day log pager, but it does not yet request or display the backend desktop activity timeline.
- Web's `DesktopPresenceTimeline` already reads `/api/attendance/workspace/:workspaceId/desktop-activity`, receives app intervals and tracking gaps, and has app-name/icon presentation that should inform Flutter's visual language.
- The backend pairs only an active mobile shift belonging to the authenticated user. The mobile clock request leaves a short-lived hash of the public-network fingerprint. A trusted desktop, authenticated as the same user, discovers a same-network candidate and asks once; choosing “always” stores auto-sync on that specific trusted desktop. If IP discovery is unavailable, Flutter can display a five-minute, six-digit code that the user enters on the signed-in desktop. Pairing links presence reporting only; the originating mobile app remains the attendance/location source. Desktop monitoring must be enabled. Same IP alone never identifies a user or authorizes cross-account pairing.
- Web and Flutter DM request cards can become stale if another reviewer decides/expires the request. Successful actions refresh messages, but an already-completed conflict can leave stale pending actions visible.

## Web Attendance report

Keep the desktop table at widths of 1024 CSS px and above. At widths below 1024 CSS px, hide the wide table and render one record card per time entry. Do not solve this with horizontal scrolling or smaller-than-readable text.

Phone layout requirements:

- Verify at 320, 360, 390, and 430 CSS px; verify tablet at 768 px and desktop at 1024 px and 1440 px.
- Page content uses 16 px horizontal gutters at 320–767 px, increasing to 20 px at 768–1023 px. Cards have 14 px inner padding on phones and 16 px at tablet width; adjacent cards have 12 px vertical separation.
- Filters wrap into full-width controls on phones with 12 px vertical gaps; from/to dates form a two-column row only when each input retains at least 136 px, otherwise stack. Refresh and export controls remain reachable, with 44 px minimum touch height.
- Each record card begins with a compact member avatar/name and status row. The next area presents check-in, check-out, and duration in a balanced two-column arrangement (duration spans full width when necessary); values may wrap gracefully but never clip. Use tabular numerals for times/durations.
- Location verification, clock source, coordinates, distance, and review reason stay grouped under the matching clock event in a collapsed “Location details” disclosure. The verified state uses a quiet success label. An old location warning is never lifted to a global report alert. An actual current clock-action location error may appear next to that clock action only.
- Provide clear loading skeletons, no-results state, and error/retry state using the same card geometry so the page does not jump. Preserve record ordering, filters, export, and authorization.
- At desktop widths retain the full seven-column table and its existing interactions.

## Flutter Attendance presence view

Add a distinct “Presence” section/tab within the existing Attendance destination; do not lengthen the overview into an endless scroll and do not duplicate clock controls. Use the existing mobile navigation, Attendance theme, card radius, and typography tokens.

- Query only the signed-in member's presence in the selected workspace and date range from the existing desktop activity endpoint. Do not default to team-wide history. Backend authorization remains authoritative.
- Render a summary state that identifies the source as the paired/trusted desktop and tells users the phone itself does not detect laptop apps.
- Render a chronological day-grouped timeline containing foreground app label and icon (known app icon mapping with a generic app-window fallback), Active/AFK/Unavailable state, local start/end times, and tracking gaps. A gap means unknown activity, never AFK.
- Include app totals/session counts only if supported by the returned event interval data. Compute durations from those intervals and exclude gaps; don't invent or infer activity.
- Cover loading, empty/unpaired, permission-denied, offline/error, and populated states. Offer retry for errors. Empty state explains how to pair: same-user signed-in desktop on the same public network may prompt automatically; otherwise create a short-lived six-digit code in Flutter and enter it on the desktop. Never show the code after expiry or store it in logs.
- Refresh on pull-to-refresh and when returning to the foreground; avoid aggressive polling on a phone. Keep the selected date range stable while navigating within Attendance.
- The phone displays server reports only; it must never claim to sample foreground apps or AFK locally.

## Pairing contract and user flow

Keep the existing backend and Electron pairing mechanism unless implementation tests reveal a defect:

1. User clocks in through Flutter. Backend records `clockInSource=mobile` and a short-lived hashed network fingerprint.
2. Electron must be signed in as the same user, have a valid trusted-device credential, and have activity monitoring enabled. It polls status and compares a fresh fingerprint for same-network discovery.
3. If a matching active mobile shift is found, Electron asks whether to sync once, always sync future mobile shifts on this desktop, or not now. “Always” is device-specific; it does not apply to another laptop.
4. If auto-sync was selected earlier on this desktop, the same-user/same-network candidate may link without asking again. Otherwise, the six-digit code from Flutter is the fallback.
5. After atomic linking, Electron reports presence; Flutter remains authoritative for clock duration and location. Revoked devices, other users, expired fingerprints/codes, and already-linked shifts cannot pair.

The Flutter presence view describes this as “desktop paired/reporter connected” based on server timeline data, not as a guarantee that a current heartbeat exists.

## Leave and remote request cards in web and Flutter

Treat backend status as canonical: `pending`, `approved`, `denied`, or `expired`.

- Only a truly pending request displays decision buttons. Approved, denied, and expired requests show a terminal status and a concise explanation; retain requester, date span, reason, and decision metadata where authorized.
- After approve/deny succeeds, refresh/reload the conversation so DM metadata and request card agree.
- On a conflict or already-decided response, immediately reload messages/request state. Do not leave the card actionable while the refresh is in flight; use a disabled “Refreshing status…” state.
- After refresh, show the actual state (“Approved”, “Denied”, or “Expired”) and a brief explanation when it changed elsewhere or expired. If refresh fails, disable actions and show a retry affordance instead of reverting to a misleading pending action.
- Apply identical semantics to leave and remote-work cards on web and Flutter. Preserve private A→B request visibility and backend approver authorization.
- Add idempotency protection for repeat taps and concurrent requests; server remains authoritative. Return conflict semantics consistently for already-terminal requests so clients can identify stale state, without exposing a request to unauthorized users.

## Location audit presentation

Keep location verification attached to each relevant clock-in/out record in both clients. “Location verified” is a neutral success indicator; GPS precision and registered-network corroboration are audit details revealed in the record disclosure. A previous low-accuracy reading must not show as a current/global Timesheets error. Keep current failed clock-attempt feedback next to the clock action that failed.

## Attendance calculation policy

Desktop AFK intervals and missing heartbeats remain presence/activity information. They do not silently change clock attendance duration or payable hours. Any future deduction policy requires an explicit workspace rule and user-facing policy, outside this implementation.

## Data/API compatibility

- Reuse the existing desktop activity event/gap response and current authenticated-user/workspace checks; add a narrowly scoped member timeline API only if the existing endpoint cannot safely serve the signed-in member.
- Do not change the clock source, clock duration, geofence, IP verification, trusted-device credentials, or consent behavior.
- Include expired state everywhere it is currently absent from shared client status types.
- Keep old web and Flutter versions safe: terminal status remains represented in DM metadata, and backend rejects decisions for all terminal requests.

## Validation

- Web component tests cover 320/360/390/430 phone and desktop breakpoints, complete card field visibility, location detail association, and filters/actions without overflow. Run relevant lint/typecheck/build.
- Flutter repository/data-source tests cover endpoint parsing, user-scoped query, app icon fallback, active/AFK/gap ordering, durations, and errors. Widget tests cover populated, unpaired, loading, error, and narrow-device layouts; use Flutter analyzer and test suite.
- Web and Flutter chat tests cover success refresh and stale conflict refresh for approved, denied, and expired outcomes; buttons remain disabled/absent once terminal. Backend tests verify current status conflict response and that unauthorized users cannot resolve or read private request details.
- Verify pairing using backend tests for matching user/device/network, auto-sync device scope, code expiry, and cross-account rejection. No assertion of actual production pairing until a real two-device test is performed.

## Out of scope

- Publishing or pushing releases.
- Changing macOS signing/release setup.
- Adding foreground tracking to the phone itself.
- Changing payroll/attendance duration based on AFK.
- Redesigning unrelated dashboard/chat pages.
