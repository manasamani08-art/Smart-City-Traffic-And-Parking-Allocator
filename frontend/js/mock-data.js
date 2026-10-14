/**
 * ==============================================================================
 * Smart City Parking & E-Challan System - Mock Data Layer (mock-data.js)
 * ==============================================================================
 * 
 * VIVA EXPLANATION / CONCEPT:
 * - What is Mock Data?
 *   Mock data is realistic simulated sample data used during frontend development
 *   while the backend API (FastAPI) is still under construction by teammates.
 *   This prevents frontend development from being blocked by backend timelines.
 * 
 * - DBMS Relational Mapping:
 *   1. `mockZones`: Represents the `ZONES` table in PostgreSQL / MySQL.
 *      Primary Key: `zone_id`
 *      Attributes: `location_name`, `base_rate_per_hour`, `total_capacity`
 * 
 *   2. `mockSlots`: Represents the `PARKING_SLOTS` table.
 *      Primary Key: `slot_id`
 *      Foreign Key: `zone_id` (References `ZONES.zone_id`) - establishes a 1-to-Many
 *      relationship where One Zone has Many Slots.
 *      Attributes: `sensor_id`, `status` ('available', 'occupied', 'maintenance')
 * 
 *   3. `mockVehicles` & `mockTickets`: Provided as foundational schema stubs
 *      for upcoming steps (vehicles and e-challan tickets).
 * ==============================================================================
 */

// -----------------------------------------------------------------------------
// 1. ZONES TABLE (Mock Data: Exactly 3 Zones)
// -----------------------------------------------------------------------------
const mockZones = [
    {
        zone_id: 1,
        location_name: "Central Business District - Sector 1",
        base_rate_per_hour: 40.00,
        total_capacity: 50,
        description: "High-density commercial parking near main shopping complex"
    },
    {
        zone_id: 2,
        location_name: "Tech Hub Cyber Gateway - Sector 4",
        base_rate_per_hour: 30.00,
        total_capacity: 120,
        description: "Corporate IT corridor multi-level automated parking"
    },
    {
        zone_id: 3,
        location_name: "Metro Interchange North Terminal",
        base_rate_per_hour: 20.00,
        total_capacity: 80,
        description: "Transit-oriented park-and-ride facility near metro station"
    }
];

// -----------------------------------------------------------------------------
// 2. SLOTS TABLE (Mock Data: Exactly 6 Slots, 2 per Zone)
// Status values: "Free", "Occupied", "Reserved", "Maintenance"
// -----------------------------------------------------------------------------
const mockSlots = [
    // Zone 1 Slots (1 Occupied, 1 Free)
    {
        slot_id: 101,
        sensor_id: "SNSR-CBD-001",
        status: "Occupied",
        zone_id: 1
    },
    {
        slot_id: 102,
        sensor_id: "SNSR-CBD-002",
        status: "Free",
        zone_id: 1
    },
    // Zone 2 Slots (1 Free, 1 Reserved)
    {
        slot_id: 201,
        sensor_id: "SNSR-TECH-001",
        status: "Free",
        zone_id: 2
    },
    {
        slot_id: 202,
        sensor_id: "SNSR-TECH-002",
        status: "Reserved",
        zone_id: 2
    },
    // Zone 3 Slots (1 Occupied, 1 Maintenance)
    {
        slot_id: 301,
        sensor_id: "SNSR-MTR-001",
        status: "Occupied",
        zone_id: 3
    },
    {
        slot_id: 302,
        sensor_id: "SNSR-MTR-002",
        status: "Maintenance",
        zone_id: 3
    }
];

// -----------------------------------------------------------------------------
// 3. VEHICLES TABLE (MOCK_VEHICLES: Citizen Registered Automobiles)
// Fields: plate_no, make, model, color, registration_status, user_id
// Statuses: Verified, Unclaimed, Out_of_State
// -----------------------------------------------------------------------------
const MOCK_VEHICLES = [
    {
        vehicle_id: 1,
        user_id: 1,
        plate_no: "DL-01-AB-1234",
        make: "Toyota",
        model: "Camry",
        color: "Pearl White",
        registration_status: "Verified"
    },
    {
        vehicle_id: 2,
        user_id: 1,
        plate_no: "MH-02-CD-5678",
        make: "Hyundai",
        model: "Creta",
        color: "Phantom Black",
        registration_status: "Unclaimed"
    },
    {
        vehicle_id: 3,
        user_id: 1,
        plate_no: "KA-03-EF-9012",
        make: "Tata",
        model: "Nexon EV",
        color: "Daytona Grey",
        registration_status: "Out_of_State"
    }
];

// -----------------------------------------------------------------------------
// 4. TICKETS TABLE (MOCK_TICKETS: 5 E-Challan Records)
// Fields: ticket_id, plate_no, rule_broken, violation_time, fine_amount,
//         issue_date, due_date, ticket_status
// Mix of statuses: Unpaid (with one overdue), Paid, Appealed, Flagged
// -----------------------------------------------------------------------------
const MOCK_TICKETS = [
    {
        ticket_id: 1001,
        plate_no: "DL-01-AB-1234",
        rule_broken: "Expired Parking Meter Session",
        violation_time: "14:30:00",
        fine_amount: 500.00,
        issue_date: "2026-09-25",
        due_date: "2026-10-05", // In the past (Overdue!)
        ticket_status: "Unpaid"
    },
    {
        ticket_id: 1002,
        plate_no: "DL-01-AB-1234",
        rule_broken: "Unauthorized No-Parking Zone",
        violation_time: "09:15:00",
        fine_amount: 1000.00,
        issue_date: "2026-10-11",
        due_date: "2026-10-25", // Future due date
        ticket_status: "Unpaid"
    },
    {
        ticket_id: 1003,
        plate_no: "MH-02-CD-5678",
        rule_broken: "Blocking Emergency EV Charging Bay",
        violation_time: "17:45:00",
        fine_amount: 1500.00,
        issue_date: "2026-09-28",
        due_date: "2026-10-15",
        ticket_status: "Paid"
    },
    {
        ticket_id: 1004,
        plate_no: "KA-03-EF-9012",
        rule_broken: "Double Parking in Rapid Transit Lane",
        violation_time: "11:20:00",
        fine_amount: 800.00,
        issue_date: "2026-10-08",
        due_date: "2026-10-22",
        ticket_status: "Appealed"
    },
    {
        ticket_id: 1005,
        plate_no: "MH-02-CD-5678",
        rule_broken: "Sensor Tampering / False Occupancy",
        violation_time: "08:10:00",
        fine_amount: 2500.00,
        issue_date: "2026-10-02",
        due_date: "2026-10-09",
        ticket_status: "Flagged"
    }
];

// -----------------------------------------------------------------------------
// 5. RESERVATIONS TABLE (In-memory storage for created reservations)
// -----------------------------------------------------------------------------
const mockReservations = [];

// -----------------------------------------------------------------------------
// 6. VIOLATIONS TABLE (MOCK_VIOLATIONS: 6 Camera Captured Incidents)
// Fields: violation_id, plate_no, camera_id, rule_broken, violation_time,
//         image_link, has_ticket (true/false)
// -----------------------------------------------------------------------------
const MOCK_VIOLATIONS = [
    {
        violation_id: 201,
        plate_no: "DL-01-AB-1234",
        camera_id: "CAM-CBD-04",
        rule_broken: "Overstaying Reserved Slot Limit",
        violation_time: "2026-10-13 14:45:00",
        image_link: "https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=300&q=80",
        has_ticket: false
    },
    {
        violation_id: 202,
        plate_no: "MH-02-CD-5678",
        camera_id: "CAM-TP-02",
        rule_broken: "No Parking Zone Encroachment",
        violation_time: "2026-10-13 11:20:00",
        image_link: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=300&q=80",
        has_ticket: false
    },
    {
        violation_id: 203,
        plate_no: "KA-03-EF-9012",
        camera_id: "CAM-MTR-01",
        rule_broken: "Blocking Bus Terminal Entry",
        violation_time: "2026-10-12 18:30:00",
        image_link: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=300&q=80",
        has_ticket: false
    },
    {
        violation_id: 204,
        plate_no: "DL-01-AB-1234",
        camera_id: "CAM-CBD-01",
        rule_broken: "Expired Parking Meter Session",
        violation_time: "2026-09-25 14:30:00",
        image_link: "https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=300&q=80",
        has_ticket: true
    },
    {
        violation_id: 205,
        plate_no: "MH-02-CD-5678",
        camera_id: "CAM-CBD-03",
        rule_broken: "Blocking Emergency EV Charging Bay",
        violation_time: "2026-09-28 17:45:00",
        image_link: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=300&q=80",
        has_ticket: true
    },
    {
        violation_id: 206,
        plate_no: "KA-03-EF-9012",
        camera_id: "CAM-TP-05",
        rule_broken: "Double Parking in Transit Lane",
        violation_time: "2026-10-08 11:20:00",
        image_link: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=300&q=80",
        has_ticket: true
    }
];

// -----------------------------------------------------------------------------
// 7. APPEALS TABLE (MOCK_APPEALS: 4 Dispute Cases)
// Fields: appeal_id, ticket_id, plate_no, reason_text, appeal_date,
//         admin_decision (Pending / Approved / Rejected)
// -----------------------------------------------------------------------------
const MOCK_APPEALS = [
    {
        appeal_id: 301,
        ticket_id: 1004,
        plate_no: "KA-03-EF-9012",
        reason_text: "Vehicle suffered unexpected tire failure while entering lane. Emergency assistance dispatch receipt provided.",
        appeal_date: "2026-10-09",
        admin_decision: "Pending"
    },
    {
        appeal_id: 302,
        ticket_id: 1002,
        plate_no: "DL-01-AB-1234",
        reason_text: "Smart meter station #04 experienced local server downtime; transaction failed and sensor reported false overstay.",
        appeal_date: "2026-10-12",
        admin_decision: "Pending"
    },
    {
        appeal_id: 303,
        ticket_id: 998,
        plate_no: "MH-02-CD-5678",
        reason_text: "Medical emergency hospital intake at Sector 4 clinic. Valid emergency room admission slip verified.",
        appeal_date: "2026-10-01",
        admin_decision: "Approved"
    },
    {
        appeal_id: 304,
        ticket_id: 999,
        plate_no: "DL-01-AB-1234",
        reason_text: "Was temporarily idling in yellow hatched box for less than three minutes to unload shopping items.",
        appeal_date: "2026-10-03",
        admin_decision: "Rejected"
    }
];

// -----------------------------------------------------------------------------
// 8. USERS TABLE (MOCK_USERS: 3 Accounts - 2 Citizens, 1 Municipal Admin)
// Fields: user_id, first_name, middle_name, last_name, phone, dl_no, gmail, role
// Note: USERS table has no password column; authentication uses phone verification.
// -----------------------------------------------------------------------------
const MOCK_USERS = [
    {
        user_id: 1,
        first_name: "Aarav",
        middle_name: "K.",
        last_name: "Sharma",
        phone: "9876543210",
        dl_no: "DL-1420110012345",
        gmail: "aarav.sharma@gmail.com",
        role: "citizen"
    },
    {
        user_id: 2,
        first_name: "Priya",
        middle_name: "",
        last_name: "Patel",
        phone: "9876543211",
        dl_no: "MH-0220150067890",
        gmail: "priya.patel@gmail.com",
        role: "citizen"
    },
    {
        user_id: 3,
        first_name: "Vikram",
        middle_name: "R.",
        last_name: "Verma",
        phone: "9123456780",
        dl_no: "KA-0520080098765",
        gmail: "admin.vikram@smartcity.gov.in",
        role: "admin"
    }
];

// -----------------------------------------------------------------------------
// 9. DASHBOARD STATS (MOCK_STATS: Municipal Aggregations for Admin Dashboard)
// Fields:
//   revenue_per_zone: [{location_name, total_revenue}] for 3 zones
//   occupancy_per_zone: [{location_name, free, occupied, reserved, maintenance}]
//   violations_by_rule: [{rule_broken, count}] for 4 rules
//   ticket_summary: {unpaid_count, unpaid_total, paid_count, appealed_count}
// -----------------------------------------------------------------------------
const MOCK_STATS = {
    revenue_per_zone: [
        {
            location_name: "Central Business District - Sector 1",
            total_revenue: 28400.00
        },
        {
            location_name: "Tech Hub Cyber Gateway - Sector 4",
            total_revenue: 42150.00
        },
        {
            location_name: "Metro Interchange North Terminal",
            total_revenue: 19600.00
        }
    ],
    occupancy_per_zone: [
        {
            location_name: "Central Business District - Sector 1",
            free: 18,
            occupied: 24,
            reserved: 6,
            maintenance: 2
        },
        {
            location_name: "Tech Hub Cyber Gateway - Sector 4",
            free: 45,
            occupied: 52,
            reserved: 18,
            maintenance: 5
        },
        {
            location_name: "Metro Interchange North Terminal",
            free: 34,
            occupied: 32,
            reserved: 10,
            maintenance: 4
        }
    ],
    violations_by_rule: [
        {
            rule_broken: "Expired Parking Meter Session",
            count: 24
        },
        {
            rule_broken: "Unauthorized No-Parking Zone",
            count: 18
        },
        {
            rule_broken: "Blocking Emergency EV Charging Bay",
            count: 11
        },
        {
            rule_broken: "Double Parking in Rapid Transit Lane",
            count: 7
        }
    ],
    ticket_summary: {
        unpaid_count: 2,
        unpaid_total: 1500.00,
        paid_count: 1,
        appealed_count: 2
    }
};

// Make MOCK data accessible globally on window object
window.MOCK_VEHICLES = MOCK_VEHICLES;
window.MOCK_TICKETS = MOCK_TICKETS;
window.MOCK_VIOLATIONS = MOCK_VIOLATIONS;
window.MOCK_APPEALS = MOCK_APPEALS;
window.MOCK_USERS = MOCK_USERS;
window.MOCK_STATS = MOCK_STATS;

window.mockData = {
    zones: mockZones,
    slots: mockSlots,
    vehicles: MOCK_VEHICLES,
    tickets: MOCK_TICKETS,
    reservations: mockReservations,
    violations: MOCK_VIOLATIONS,
    appeals: MOCK_APPEALS,
    users: MOCK_USERS,
    stats: MOCK_STATS
};
