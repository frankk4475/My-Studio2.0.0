# My-Studio 2.0.0 - Development Notes

## Recent Updates (2026-05-13)

### v2.2.0 - Communication & Calendar Restoration
- **Staff Messaging Hub:** Added a dedicated interface in the Employee module to send broadcast LINE messages to staff using the Admin Bot.
- **Smart Multi-Bot Routing:** Improved `lineService` to automatically route messages to either the Customer or Admin bot based on the recipient's role.
- **Calendar Visibility Fix:** Restored the `/api/bookings/calendar` route and integrated with Socket.io for live calendar updates.
- **Enhanced Registration:** Implemented a modern web-based registration form for customers, accessible via a clickable button in LINE.
- **Security & Stability:** Fixed redirect loops in the login flow and secured all management pages with a centralized auth guard in `layout.js`.

### v2.1.0 - The Smart Overhaul
- **System-Wide UI Modernization:** Implemented a new design system (Indigo/Slate) across all pages with a dynamic `layout.js` for Sidebar/Topbar consistency.
- **AI-Powered Workflows:**
  - Integrated Gemini AI for flexible booking extraction from LINE messages.
  - Added "Smart Quote Assistant" to automatically suggest line items and pricing.
- **Real-Time Synchronization:** Added Socket.io for live updates on the Dashboard and Booking lists (auto-refresh on new bookings).
- **Backend Stability:** Refactored database connection into a robust `config/db.js` with automated retries and pooling.
- **Bug Fixes:**
  - Fixed non-responsive "Send Message" and "Edit" buttons in Customer module using event delegation.
  - Synchronized API field names with database schemas for accurate reporting.

---

## Legacy Notes (2026-05-12)
- **Architecture:** Implemented a "Smart Webhook" that distinguishes between the **Customer Bot** (Studio Admin) and **Office Bot** (Studio Admin office) using signature verification and destination mapping.
- **Office Bot Features:** 
  - Administrative commands: `สรุปงานวันนี้`, `ยอดค้างชำระ`.
  - Dedicated AI Personality: Acts as a Studio Management Assistant (not a booking agent).
- **Configuration:** Added `LINE_ADMIN_ACCESS_TOKEN` and `LINE_ADMIN_SECRET` to `.env` to separate credentials.

### 2. Automated Booking System (Enhanced with AI)
- **Feature:** Combined Regex-based and AI-based (Gemini) parser to detect booking information.
- **Flexibility:** AI can now extract details (Date, Time, Type, Phone) from unstructured messages or messy form submissions.
- **Keywords:** Expanded detection for Thai keywords like `จอง`, `นัด`, `ขอคิว`, `เช็คคิว`.
- **Persistence:** Automatically saves bookings to MongoDB; notifies Office Bot for review.
- **Fallback:** If parsing fails but intent is detected, it still notifies admins with the raw text for manual processing.

### 3. LINE Webhook Body Parser & Security
- **Fix:** Moved `express.json()` before the LINE webhook and added a `verify` function to capture `req.rawBody` for reliable signature verification.
- **Verification:** Improved signature checking to try both Customer and Admin secrets sequentially.

### 4. Code Maintenance
- **Refactoring:** Unified the webhook endpoint `/api/line/webhook` to handle both bots, reducing redundant code.
- **Logging:** Added detailed debug logging for troubleshooting connection issues (now stabilized).

## Testing Strategy
- **Manual Verification:** Both bots confirmed working independently with separate logic.
- **Integration:** Booking submission from LINE successfully creates records in the dashboard.
- **Legacy Tests:** `tests/api.test.js` and `tests/security.test.js` remain valid and passing.

## Security Notes
- **Secret Protection:** Multi-bot secrets are now properly isolated in environment variables.
- **Static Files:** Client-side protection exists; server-side session cookies are recommended for future security hardening.
