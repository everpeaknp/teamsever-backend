# Web Attendance Phone Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the clipped phone-width attendance table with precise, readable record cards while preserving the desktop table and record-local location audit details.

**Architecture:** Keep existing report fetching, filters, and export. Render a dedicated record-card list below 1024 CSS px and the current table at/above that breakpoint. Remove the current location-check banner from the timesheet report and keep clock-attempt feedback beside the clock action.

**Tech Stack:** Next.js, React, Tailwind CSS, Vitest/Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-04-attendance-mobile-presence-and-request-state-design.md`

## Global Constraints

- Phone gutters are 16 px; tablet gutters are 20 px; card padding is 14 px on phones and 16 px on tablet.
- Cards have 12 px vertical gaps; touch controls are at least 44 px high.
- The table remains at 1024 CSS px and wider.
- Location verification/details remain associated with their clock record and are not promoted to a general report error.

## Review Focus

- At 320 px, no card field or action is horizontally clipped.
- At 768 px, controls and two-column data remain balanced without compressed labels.
- At 1024 px, the full table is visible and phone cards are absent.
- A location review/low-accuracy state is record-local; a current clock-action failure stays by that action.
- Loading, empty, and retry layouts preserve the same page rhythm.

---

### Task 1: Extract attendance record card and prove its content

**Files:**
- Create: `src/components/analytics/AttendanceRecordCard.tsx`
- Test: `src/components/analytics/AttendanceRecordCard.test.tsx`
- Reference: `src/components/analytics/AttendanceReport.tsx`

**Interfaces:**
- Consumes the existing attendance row shape from `AttendanceReport.tsx`; extract a shared exported row type if needed.
- Produces one card with member/status, date, check-in/out, duration, and collapsed clock-specific location audit details.

- [ ] **Step 1: Write failing tests** for running and completed records, location verification disclosure, missing location, review reason, and accessible status names.
- [ ] **Step 2: Run the focused test** and confirm the missing card component is the failure.
- [ ] **Step 3: Implement the card** using 14 px phone padding, 12 px internal spacing, tabular time numerals, and non-clipping wrapping.
- [ ] **Step 4: Re-run the focused tests** and verify all fields remain present at the component level.
- [ ] **Step 5: Commit** as `feat(attendance): add compact attendance record cards`.

### Task 2: Responsive report, filters, and states

**Files:**
- Modify: `src/components/analytics/AttendanceReport.tsx`
- Modify: `src/app/workspace/[id]/attendance/[section]/page.tsx`
- Modify or create: tests alongside those components.

**Interfaces:**
- Keep existing fetch/filter/export logic unchanged.
- Use Tailwind responsive visibility around 1024 px: cards below, table at `lg` (1024 px) and above.

- [ ] **Step 1: Write failing report tests** for card list below desktop breakpoint, table structure retained, filter wrapping semantics, loading/empty/error states, and record-specific location content.
- [ ] **Step 2: Run tests to verify failure** against the current always-table implementation.
- [ ] **Step 3: Implement responsive rendering** and filter sizing: 16/20 px horizontal gutters, 14/16 px card padding, 12 px card gaps, two date columns only when each remains at least 136 px; otherwise stack; 44 px touch targets.
- [ ] **Step 4: Remove `LocationSessionMonitor` from the Timesheets route** and render its current clock-action feedback only beside the relevant clock action; preserve historical verification on the clock record.
- [ ] **Step 5: Run focused tests**, then frontend lint/typecheck and production build. Verify 320, 360, 390, 430, 768, 1024, and 1440 CSS px in browser responsive mode.
- [ ] **Step 6: Commit** as `feat(attendance): make timesheets readable on phones`.

---

### Task 3: Visual and overflow verification

**Files:**
- Modify only responsive classes/components from Tasks 1–2 if evidence requires.

- [ ] **Step 1:** Capture/inspect phone and desktop render at the seven spec widths.
- [ ] **Step 2:** Fix any text overlap, clipping, imbalanced columns, inconsistent gutters, or unintended page-level horizontal scroll.
- [ ] **Step 3:** Re-run the affected tests and build; commit the visual correction separately if changes were required.
