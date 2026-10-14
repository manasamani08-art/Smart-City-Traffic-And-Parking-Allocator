# Smart City Mobility — Frontend & Backend API Contract

This document specifies the complete REST API specification implemented by [`js/api.js`](file:///c:/Users/manas/OneDrive/Desktop/frontend/js/api.js) and expected by all frontend pages in the Smart City Parking & E-Challan System.

When backend engineers build the live FastAPI endpoints, they must conform to these routes, request payloads, and response structures.

---

## 1. Global Configuration

| Constant | Value | Description |
| :--- | :--- | :--- |
| `BASE_URL` | `http://localhost:8000` | Target FastAPI server URL |
| `USE_MOCK` | `true` (default) / `false` | When `true`, returns mock data from `mock-data.js`. When `false`, executes live HTTP `fetch()`. |

---

## 2. API Endpoints Summary

| # | Function in `api.js` | HTTP Method | Endpoint URL | Description |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `getZones()` | `GET` | `/zones` | Fetch all parking zones |
| 2 | `getZoneById(zoneId)` | `GET` | `/zones/{zoneId}` | Fetch details of a single zone |
| 3 | `getSlotsByZone(zoneId)` | `GET` | `/zones/{zoneId}/slots` | Fetch all parking slots in a zone |
| 4 | `getSlots(zoneId)` | `GET` | `/slots` or `/zones/{zoneId}/slots` | General slot retrieval |
| 5 | `getVehicles(userId)` | `GET` | `/vehicles` or `/vehicles?user_id={userId}` | Fetch citizen's registered vehicles |
| 6 | `addVehicle(data)` | `POST` | `/vehicles` | Register a new vehicle |
| 7 | `deleteVehicle(plateNo)` | `DELETE` | `/vehicles/{plateNo}` | Remove a vehicle registration |
| 8 | `createReservation(data)` | `POST` | `/reservations` | Reserve a parking slot |
| 9 | `getTickets()` | `GET` | `/tickets` | Fetch e-challan traffic tickets |
| 10 | `payTicket(ticketId)` | `POST` | `/tickets/{ticketId}/pay` | Pay fine for an unpaid ticket |
| 11 | `createAppeal(ticketId, reason)` | `POST` | `/tickets/{ticketId}/appeal` | Lodge a dispute appeal |
| 12 | `getViolations()` | `GET` | `/admin/violations` | Fetch camera-detected infractions |
| 13 | `issueTicket(violationId, fineAmount, dueDate)` | `POST` | `/admin/violations/{violationId}/issue-ticket` | Issue ticket from a violation |
| 14 | `getAppeals()` | `GET` | `/admin/appeals` | Fetch appeals for adjudication |
| 15 | `decideAppeal(appealId, decision)` | `POST` | `/admin/appeals/{appealId}/decide` | Approve or reject a dispute appeal |
| 16 | `getDashboardStats()` | `GET` | `/admin/dashboard-stats` | Fetch aggregated dashboard analytics |
| 17 | `loginUser(phone)` | `POST` | `/users/login` | Phone-only login authentication |
| 18 | `registerUser(data)` | `POST` | `/users` | Register a new citizen account |

---

## 3. Detailed Endpoint Contracts

### 3.1 `getZones()`
- **HTTP Method:** `GET`
- **URL:** `http://localhost:8000/zones`
- **Request Body:** None
- **Expected Response Shape:**
```json
[
  {
    "zone_id": 1,
    "location_name": "Central Business District - Sector 1",
    "base_rate_per_hour": 40.0,
    "total_capacity": 50,
    "description": "High-density commercial parking near main shopping complex"
  }
]
```

---

### 3.2 `getZoneById(zoneId)`
- **HTTP Method:** `GET`
- **URL:** `http://localhost:8000/zones/{zoneId}`
- **Path Parameters:**
  - `zoneId` (integer | string, required): Unique primary key ID of the parking zone.
- **Request Body:** None
- **Expected Response Shape:**
```json
{
  "zone_id": 1,
  "location_name": "Central Business District - Sector 1",
  "base_rate_per_hour": 40.0,
  "total_capacity": 50,
  "description": "High-density commercial parking near main shopping complex"
}
```

---

### 3.3 `getSlotsByZone(zoneId)`
- **HTTP Method:** `GET`
- **URL:** `http://localhost:8000/zones/{zoneId}/slots`
- **Path Parameters:**
  - `zoneId` (integer | string, required): Foreign key reference to zone.
- **Request Body:** None
- **Expected Response Shape:**
```json
[
  {
    "slot_id": 101,
    "sensor_id": "SNSR-CBD-001",
    "status": "Occupied",
    "zone_id": 1
  },
  {
    "slot_id": 102,
    "sensor_id": "SNSR-CBD-002",
    "status": "Free",
    "zone_id": 1
  }
]
```
*Allowed `status` values:* `"Free"`, `"Occupied"`, `"Reserved"`, `"Maintenance"`.

---

### 3.4 `getSlots(zoneId = null)`
- **HTTP Method:** `GET`
- **URL:**
  - If `zoneId` is provided: `http://localhost:8000/zones/{zoneId}/slots`
  - If `zoneId` is `null`: `http://localhost:8000/slots`
- **Request Body:** None
- **Expected Response Shape:** Array of slot objects as described in Section 3.3.

---

### 3.5 `getVehicles(userId = null)`
- **HTTP Method:** `GET`
- **URL:**
  - If `userId` is provided: `http://localhost:8000/vehicles?user_id={userId}`
  - If `userId` is `null`: `http://localhost:8000/vehicles`
- **Query Parameters:** `user_id` (integer | string, optional)
- **Request Body:** None
- **Expected Response Shape:**
```json
[
  {
    "vehicle_id": 1,
    "user_id": 1,
    "plate_no": "DL-01-AB-1234",
    "make": "Toyota",
    "model": "Camry",
    "color": "Pearl White",
    "registration_status": "Verified"
  }
]
```
*Allowed `registration_status` values:* `"Verified"`, `"Unclaimed"`, `"Out_of_State"`.

---

### 3.6 `addVehicle(data)`
- **HTTP Method:** `POST`
- **URL:** `http://localhost:8000/vehicles`
- **Request Headers:** `Content-Type: application/json`
- **Request Body Fields:**
```json
{
  "plate_no": "KA-05-XY-9999",
  "make": "Mahindra",
  "model": "Thar",
  "color": "Rocky Black",
  "registration_status": "Verified",
  "user_id": 1
}
```
*Validation constraints:*
- `plate_no`: Required, uppercase, max 15 characters, must be unique across the system.
- `make`, `model`, `color`: Required non-empty strings.
- `registration_status`: Restricted to `"Verified"`, `"Unclaimed"`, or `"Out_of_State"`.
- **Expected Response Shape:**
```json
{
  "success": true,
  "message": "Vehicle KA-05-XY-9999 registered successfully!",
  "vehicle": {
    "vehicle_id": 14,
    "user_id": 1,
    "plate_no": "KA-05-XY-9999",
    "make": "Mahindra",
    "model": "Thar",
    "color": "Rocky Black",
    "registration_status": "Verified"
  }
}
```

---

### 3.7 `deleteVehicle(plateNo)`
- **HTTP Method:** `DELETE`
- **URL:** `http://localhost:8000/vehicles/{plateNo}`
- **Path Parameters:**
  - `plateNo` (string, required): License plate of vehicle to remove.
- **Request Body:** None
- **Expected Response Shape:**
```json
{
  "success": true,
  "message": "Vehicle \"KA-05-XY-9999\" was successfully removed from your account.",
  "plate_no": "KA-05-XY-9999"
}
```

---

### 3.8 `createReservation(data)`
- **HTTP Method:** `POST`
- **URL:** `http://localhost:8000/reservations`
- **Request Headers:** `Content-Type: application/json`
- **Request Body Fields:**
```json
{
  "slot_id": 102,
  "zone_id": 1,
  "plate_no": "DL-01-AB-1234",
  "start_time": "2026-10-14T12:00",
  "end_time": "2026-10-14T14:00",
  "estimated_cost": 80.0
}
```
*Constraints:* `end_time` must be strictly after `start_time`.
- **Expected Response Shape:**
```json
{
  "success": true,
  "message": "Reservation confirmed successfully!",
  "data": {
    "reservation_id": 5001,
    "slot_id": 102,
    "zone_id": 1,
    "plate_no": "DL-01-AB-1234",
    "start_time": "2026-10-14T12:00",
    "end_time": "2026-10-14T14:00",
    "estimated_cost": 80.0,
    "status": "confirmed",
    "created_at": "2026-10-14T11:24:45.000Z"
  }
}
```

---

### 3.9 `getTickets()`
- **HTTP Method:** `GET`
- **URL:** `http://localhost:8000/tickets`
- **Request Body:** None
- **Expected Response Shape:**
```json
[
  {
    "ticket_id": 1001,
    "plate_no": "DL-01-AB-1234",
    "rule_broken": "Expired Parking Meter Session",
    "violation_time": "14:30:00",
    "fine_amount": 500.0,
    "issue_date": "2026-09-25",
    "due_date": "2026-10-05",
    "ticket_status": "Unpaid"
  }
]
```
*Allowed `ticket_status` values:* `"Unpaid"`, `"Paid"`, `"Appealed"`, `"Flagged"`, `"Dismissed"`.

---

### 3.10 `payTicket(ticketId)`
- **HTTP Method:** `POST`
- **URL:** `http://localhost:8000/tickets/{ticketId}/pay`
- **Path Parameters:**
  - `ticketId` (integer | string, required): Unique primary key ID of the ticket.
- **Request Body:** None
- **Expected Response Shape:**
```json
{
  "success": true,
  "message": "Payment successful for Ticket #1001. Status updated to Paid.",
  "ticket_id": 1001,
  "ticket_status": "Paid"
}
```

---

### 3.11 `createAppeal(ticketId, reason)`
- **HTTP Method:** `POST`
- **URL:** `http://localhost:8000/tickets/{ticketId}/appeal`
- **Path Parameters:**
  - `ticketId` (integer | string, required): Unique ticket ID.
- **Request Headers:** `Content-Type: application/json`
- **Request Body Fields:**
```json
{
  "reason_text": "Sensor malfunction reported incorrect stay duration."
}
```
*Constraints:* `reason_text` is required, maximum 500 characters.
- **Expected Response Shape:**
```json
{
  "success": true,
  "message": "Appeal successfully registered for Ticket #1001. Status changed to Appealed.",
  "ticket_id": 1001,
  "ticket_status": "Appealed",
  "reason_text": "Sensor malfunction reported incorrect stay duration."
}
```

---

### 3.12 `getViolations()`
- **HTTP Method:** `GET`
- **URL:** `http://localhost:8000/admin/violations`
- **Request Body:** None
- **Expected Response Shape:**
```json
[
  {
    "violation_id": 201,
    "plate_no": "DL-01-AB-1234",
    "camera_id": "CAM-CBD-04",
    "rule_broken": "Overstaying Reserved Slot Limit",
    "violation_time": "2026-10-13 14:45:00",
    "image_link": "https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=300&q=80",
    "has_ticket": false
  }
]
```

---

### 3.13 `issueTicket(violationId, fineAmount, dueDate)`
- **HTTP Method:** `POST`
- **URL:** `http://localhost:8000/admin/violations/{violationId}/issue-ticket`
- **Path Parameters:**
  - `violationId` (integer | string, required): Camera violation ID.
- **Request Headers:** `Content-Type: application/json`
- **Request Body Fields:**
```json
{
  "fine_amount": 500,
  "due_date": "2026-10-30"
}
```
*Constraints:*
- `fine_amount`: Required numeric value strictly greater than 0.
- `due_date`: Required date string (`YYYY-MM-DD`) strictly in the future.
- **Expected Response Shape:**
```json
{
  "success": true,
  "message": "Ticket #1006 successfully issued for Violation #201!",
  "violation_id": 201,
  "ticket": {
    "ticket_id": 1006,
    "plate_no": "DL-01-AB-1234",
    "rule_broken": "Overstaying Reserved Slot Limit",
    "violation_time": "14:45:00",
    "fine_amount": 500.0,
    "issue_date": "2026-10-14",
    "due_date": "2026-10-30",
    "ticket_status": "Unpaid"
  }
}
```

---

### 3.14 `getAppeals()`
- **HTTP Method:** `GET`
- **URL:** `http://localhost:8000/admin/appeals`
- **Request Body:** None
- **Expected Response Shape:**
```json
[
  {
    "appeal_id": 301,
    "ticket_id": 1004,
    "plate_no": "KA-03-EF-9012",
    "reason_text": "Vehicle suffered unexpected tire failure while entering lane.",
    "appeal_date": "2026-10-09",
    "admin_decision": "Pending"
  }
]
```
*Allowed `admin_decision` values:* `"Pending"`, `"Approved"`, `"Rejected"`.

---

### 3.15 `decideAppeal(appealId, decision)`
- **HTTP Method:** `POST`
- **URL:** `http://localhost:8000/admin/appeals/{appealId}/decide`
- **Path Parameters:**
  - `appealId` (integer | string, required): Unique appeal ID.
- **Request Headers:** `Content-Type: application/json`
- **Request Body Fields:**
```json
{
  "admin_decision": "Approved"
}
```
*Constraints:* `admin_decision` must be strictly `"Approved"` or `"Rejected"`.
- **Expected Response Shape:**
```json
{
  "success": true,
  "message": "Appeal #301 has been Approved.",
  "appeal_id": 301,
  "admin_decision": "Approved"
}
```

---

### 3.16 `getDashboardStats()`
- **HTTP Method:** `GET`
- **URL:** `http://localhost:8000/admin/dashboard-stats`
- **Request Body:** None
- **Expected Response Shape:**
```json
{
  "revenue_per_zone": [
    {
      "location_name": "Central Business District - Sector 1",
      "total_revenue": 28400.0
    },
    {
      "location_name": "Tech Hub Cyber Gateway - Sector 4",
      "total_revenue": 42150.0
    },
    {
      "location_name": "Metro Interchange North Terminal",
      "total_revenue": 19600.0
    }
  ],
  "occupancy_per_zone": [
    {
      "location_name": "Central Business District - Sector 1",
      "free": 18,
      "occupied": 24,
      "reserved": 6,
      "maintenance": 2
    },
    {
      "location_name": "Tech Hub Cyber Gateway - Sector 4",
      "free": 45,
      "occupied": 52,
      "reserved": 18,
      "maintenance": 5
    },
    {
      "location_name": "Metro Interchange North Terminal",
      "free": 34,
      "occupied": 32,
      "reserved": 10,
      "maintenance": 4
    }
  ],
  "violations_by_rule": [
    {
      "rule_broken": "Expired Parking Meter Session",
      "count": 24
    },
    {
      "rule_broken": "Unauthorized No-Parking Zone",
      "count": 18
    },
    {
      "rule_broken": "Blocking Emergency EV Charging Bay",
      "count": 11
    },
    {
      "rule_broken": "Double Parking in Rapid Transit Lane",
      "count": 7
    }
  ],
  "ticket_summary": {
    "unpaid_count": 2,
    "unpaid_total": 1500.0,
    "paid_count": 1,
    "appealed_count": 2
  }
}
```

---

### 3.17 `loginUser(phone)`
- **HTTP Method:** `POST`
- **URL:** `http://localhost:8000/users/login`
- **Request Headers:** `Content-Type: application/json`
- **Request Body Fields:**
```json
{
  "phone": "9876543210"
}
```
*Constraints:* Exactly 10 numeric digits. (Passwordless verification).
- **Expected Response Shape:**
```json
{
  "success": true,
  "user": {
    "user_id": 1,
    "first_name": "Aarav",
    "last_name": "Sharma",
    "role": "citizen",
    "phone": "9876543210",
    "dl_no": "DL-1420110012345",
    "gmail": "aarav.sharma@gmail.com"
  }
}
```
*Error Response (404/400):* `{ "detail": "User not found with this phone number." }`

---

### 3.18 `registerUser(data)`
- **HTTP Method:** `POST`
- **URL:** `http://localhost:8000/users`
- **Request Headers:** `Content-Type: application/json`
- **Request Body Fields:**
```json
{
  "first_name": "Rohan",
  "middle_name": "S.",
  "last_name": "Mehta",
  "phone": "9876543299",
  "dl_no": "DL-0420220099887",
  "gmail": "rohan.mehta@gmail.com"
}
```
- **Expected Response Shape:**
```json
{
  "success": true,
  "message": "Registration successful! You may now log in.",
  "user": {
    "user_id": 11,
    "first_name": "Rohan",
    "middle_name": "S.",
    "last_name": "Mehta",
    "phone": "9876543299",
    "dl_no": "DL-0420220099887",
    "gmail": "rohan.mehta@gmail.com",
    "role": "citizen"
  }
}
```
