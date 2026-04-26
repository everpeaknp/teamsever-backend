# Teamsever Backend Bug Fixes (April 26, 2026)

This document summarizes the critical API fixes implemented to support the Flutter mobile app development.

## 1. Folder Member Retrieval (500 Error)
- **Problem**: Fetching folder members triggered an internal server error because the backend tried to populate a non-existent `workspace` field on the `Folder` model.
- **Solution**: 
    - Refactored the controller to populate `spaceId` instead.
    - Added logic to safely derive the `workspaceId` through the space hierarchy.
- **Impact**: The mobile app can now correctly display member permission levels for specific folders.

## 2. Task Update Validation (400 Error)
- **Problem**: Mobile app requests to update tasks were failing due to strict validation rules:
    - Status `"in-progress"` (with hyphen) was not recognized.
    - Setting `assignee` to `null` (unassigning) was rejected.
    - Fields like `startDate` were missing from the validator.
- **Solution**:
    - **Schema Update**: Updated Zod validators to support `in-progress` and `.nullable()` for assignee/dates.
    - **Normalization**: Added a service-level mapper that converts `"in-progress"` to the internal database format `"inprogress"`.
    - **Field Expansion**: Added explicit support for `startDate` updates.
- **Impact**: Full compatibility with the Flutter mobile app's task management flow.

## 3. WebSocket Integration Docs
- **Action**: Created [ws_docs.md](file:///home/ramon/projects/everacy/teamsever-backend/ws_docs.md) with live credentials and Flutter-specific connection examples.

---

### **Note for Developers**
All fixes have been verified against the live development database. When sending status updates from mobile, you can now use either `inprogress` or `in-progress`. To unassign a task, simply pass `"assignee": null` in the patch request.

**Server Status**: Healthy (HTTP 200)
**Last Verified Admin**: R.a.mon
