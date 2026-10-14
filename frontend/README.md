# Smart City Parking & E-Challan Management System

A production-grade, modular Frontend web application for a municipal Smart City Mobility and Traffic Enforcement platform. Built with **HTML5**, **CSS3**, **Vanilla JavaScript (ES6+)**, **Bootstrap 5.3**, and **Chart.js**.

---

## 1. How to Open and Run the Project

You do not need to install complex build tools (no Webpack, Vite, or Node build step required). All scripts run natively in any modern browser.

### Option A: Direct Browser Launch (Quickest)
1. Navigate to the project folder:
   ```text
   c:\Users\manas\OneDrive\Desktop\frontend
   ```
2. Double-click **`index.html`** or right-click `index.html` &rarr; **Open with** &rarr; **Google Chrome**, **Microsoft Edge**, or **Mozilla Firefox**.

### Option B: Local Web Server (Recommended)
Running through a local web server avoids potential CORS or browser file protocol restrictions:
- **VS Code Live Server:** Right-click `index.html` in VS Code and select **"Open with Live Server"**.
- **Python:**
  ```bash
  python -m http.server 3000
  ```
  Then open `http://localhost:3000` in your browser.
- **Node.js (`npx serve`):**
  ```bash
  npx serve .
  ```

---

## 2. Switching Between Mock Data and Real Backend

The frontend is architected with strict **Separation of Concerns (SoC)**. Page files and UI controllers **never call `fetch()` directly**. All network interactions are centralized in [`js/api.js`](file:///c:/Users/manas/OneDrive/Desktop/frontend/js/api.js).

To switch from the simulated mock data layer to the live FastAPI backend:

1. Open [`js/api.js`](file:///c:/Users/manas/OneDrive/Desktop/frontend/js/api.js).
2. Locate line 29:
   ```javascript
   // Change this flag:
   const USE_MOCK = true;  // <--- Set to false for live backend
   ```
   to:
   ```javascript
   const USE_MOCK = false; // <--- Connects to live FastAPI endpoints
   ```
3. Verify that `BASE_URL` points to your backend server:
   ```javascript
   const BASE_URL = "http://localhost:8000";
   ```
4. Save the file and refresh your browser. All page files ([`zones.html`](file:///c:/Users/manas/OneDrive/Desktop/frontend/zones.html), [`tickets.html`](file:///c:/Users/manas/OneDrive/Desktop/frontend/tickets.html), [`vehicles.html`](file:///c:/Users/manas/OneDrive/Desktop/frontend/vehicles.html), [`admin.html`](file:///c:/Users/manas/OneDrive/Desktop/frontend/admin.html)) will seamlessly make HTTP requests to the live API without changing a single line of UI code!

---

## 3. What Each Page Does

### 1. `index.html` — Landing Page & Authentication
- **Purpose:** Entry point for citizens and municipal administrators.
- **Features:**
  - **Phone-Based Authentication:** Follows the relational DBMS schema where the `USERS` table has no password column. Users authenticate using their registered 10-digit phone number.
  - **Citizen Registration Tab:** Allows new citizens to register with full field validation (`first_name`, `middle_name`, `last_name`, `phone`, `dl_no`, `gmail`).
  - **Quick-Fill Demo Helper:** One-click demo login buttons:
    - **Citizen:** Aarav Sharma (`9876543210`) &rarr; Redirects to `zones.html`.
    - **Municipal Admin:** Vikram Verma (`9123456780`) &rarr; Redirects to `admin.html`.
  - **Session Persistence:** Saves user identity to browser `localStorage` (`currentUser`, `user_id`, `role`, `first_name`).

### 2. `zones.html` — Parking Zones & Slot Reservations
- **Purpose:** Public parking directory and IoT sensor slot booking.
- **Features:**
  - **Zones Directory Table:** Displays zone ID, location name, hourly base rate (₹), and vehicle capacities.
  - **Master-Detail Slot Grid:** Clicking **"View Slots"** dynamically loads sensor slots belonging to that zone.
  - **Visual Status Badges:**
    - Free = Green (`#10b981`)
    - Occupied = Red (`#ef4444`)
    - Reserved = Yellow (`#f59e0b`)
    - Maintenance = Grey (`#6b7280`)
  - **Slot Reservation Modal:** Citizens choose their vehicle, start time, and end time. The modal calculates the estimated cost in real-time (`duration_in_hours * base_rate_per_hour`).
  - **In-Place Updates:** Slot status immediately updates to "Reserved" upon submission without reloading.

### 3. `tickets.html` — Traffic E-Challans (My Tickets)
- **Purpose:** Portal for citizens to view and resolve traffic violation penalties.
- **Features:**
  - **Issued Violations Table:** Displays Challan ID, vehicle plate, violation rule broken, timestamp, due date, and fine amount.
  - **Color-Coded Status Badges:**
    - Unpaid = Red
    - Paid = Green
    - Appealed = Yellow
    - Flagged = Dark slate
  - **Automatic Overdue Calculation:** Flags unpaid tickets whose `due_date` is earlier than today with a red highlight and "Overdue" badge.
  - **Instant Payment:** "Pay" button settles the fine, transitions status to "Paid", and removes action buttons in-place.
  - **Dispute Appeal Modal:** "Appeal" button opens a dispute form (maximum 500 characters) and updates the ticket status to "Appealed".

### 4. `vehicles.html` — Registered Automobiles (My Vehicles)
- **Purpose:** Citizen vehicle registry management for automated parking and tolling.
- **Features:**
  - **Vehicles Registry Table:** Displays `plate_no`, `make`, `model`, `color`, and `registration_status`.
  - **Colored Status Badges:**
    - Verified = Green (`.badge-reg-verified`)
    - Unclaimed = Yellow (`.badge-reg-unclaimed`)
    - Out_of_State = Grey (`.badge-reg-outofstate`)
  - **"Add Vehicle" Modal:**
    - Fields: `plate_no` (uppercase, max 15 chars), `make`, `model`, `color`, and `registration_status` dropdown.
    - Rejects duplicate license plates before submission with explicit error messages.
  - **Delete Confirmation Modal:** Protects against accidental deletions with a confirmation dialog showing the target plate number.
  - **In-Place DOM Mutation:** Rows are appended or removed dynamically without full page reload.

### 5. `admin.html` — Municipal Traffic Control Console
- **Purpose:** Centralized administrative operations console restricted to administrators.
- **Three Core Tabs:**
  - **Tab 1: Detected Violations:**
    - IoT surveillance camera log feed with infraction snapshots.
    - "Issue Ticket" modal with fine amount (> 0) and due date (future date) validation.
    - Idempotency: Once issued, the button is replaced by an "Issued" badge.
  - **Tab 2: Dispute Appeals:**
    - Displays citizen dispute appeals with contested justifications.
    - "Approve" (dismisses ticket fine) and "Reject" adjudication action buttons with in-place row mutation.
  - **Tab 3: Dashboard (Analytics & KPIs):**
    - **4 Top Summary Cards:** Unpaid tickets (count), Unpaid total amount (₹), Paid tickets, and Pending appeals.
    - **3 Visualizations Powered by Chart.js:**
      1. **Bar Chart:** Total revenue per parking zone (₹).
      2. **Stacked Bar Chart:** Slot occupancy per zone (Free, Occupied, Reserved, Maintenance) using identical slot colors.
      3. **Pie Chart:** Infractions breakdown by rule with interactive percentage legend.

---

## 4. Project File Structure

```text
frontend/
├── API_CONTRACT.md        # Complete REST API specification for backend team
├── README.md              # Project documentation, setup guide, and page descriptions
├── index.html             # Landing page & phone-only authentication portal
├── zones.html             # Parking zones directory & reservation booking
├── tickets.html           # Citizen e-challan tickets, fine payment & appeals
├── vehicles.html          # Citizen registered vehicles management
├── admin.html             # Municipal admin console (Violations, Appeals, Dashboard)
│
├── css/
│   └── style.css          # Theme styles, custom badges, animations & utilities
│
└── js/
    ├── mock-data.js       # In-memory relational mock DBMS datasets
    ├── api.js             # Central Data Access Layer (handles USE_MOCK flag)
    ├── navbar.js          # Shared navbar injection, RBAC & route protection guard
    ├── index.js           # Auth controller for index.html
    ├── zones.js           # Zones & slot booking controller
    ├── tickets.js         # Tickets payment & dispute controller
    ├── vehicles.js        # Vehicles registry controller
    └── admin.js           # Admin console & Chart.js dashboard controller
```

---

## 5. Architectural Highlights for Viva & Evaluation

1. **Separation of Concerns (SoC):**
   - HTML handles structure.
   - CSS handles styling.
   - JavaScript controllers handle UI events.
   - `js/api.js` is the sole module permitted to perform network requests.
2. **Role-Based Access Control (RBAC):**
   - Implemented in [`js/navbar.js`](file:///c:/Users/manas/OneDrive/Desktop/frontend/js/navbar.js).
   - Citizens cannot access `admin.html` (auto-redirected to `zones.html`).
   - Unauthenticated visitors cannot access protected pages (auto-redirected to `index.html`).
3. **Chart.js Lifecycle Management:**
   - Visual charts inside hidden Bootstrap tabs are initialized on `shown.bs.tab` to guarantee accurate pixel canvas rendering.
   - Existing instances are cleanly destroyed (`chart.destroy()`) before re-rendering upon page refresh.
4. **Relational Database Concepts Reflected in Code:**
   - Primary Keys: `zone_id`, `slot_id`, `plate_no`, `ticket_id`, `violation_id`, `appeal_id`, `user_id`.
   - Foreign Keys: `slots.zone_id` &rarr; `zones.zone_id`, `vehicles.user_id` &rarr; `users.user_id`.
   - Aggregations: `SUM(total_revenue)`, `COUNT(status)`, `GROUP BY rule_broken`.
