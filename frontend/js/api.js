/**
 * ==============================================================================
 * Smart City Parking & E-Challan System - Central API Client Layer (api.js)
 * ==============================================================================
 * 
 * VIVA EXPLANATION / DESIGN PATTERN:
 * - What is this file for?
 *   This is the "Data Access Layer" (or API Client). In professional web development,
 *   we NEVER allow UI pages (like zones.html) to directly make HTTP `fetch()` calls.
 *   Instead, all network requests are centralized in this single file.
 * 
 * - Why use USE_MOCK = true?
 *   The backend team is building FastAPI endpoints (`http://localhost:8000`).
 *   Until their backend is ready, this flag allows the frontend to run smoothly
 *   using realistic mock data from `mock-data.js`.
 *   When the FastAPI backend is ready, you only need to change:
 *       const USE_MOCK = false;
 *   None of your HTML or page-specific JavaScript code will need to change!
 * 
 * - Why async / await?
 *   Network requests take time. JavaScript is single-threaded and non-blocking.
 *   Using `async/await` allows the code to wait for data asynchronously without
 *   freezing the browser user interface (UI).
 * ==============================================================================
 */

// Configuration constants
const BASE_URL = "http://localhost:8000";
const USE_MOCK = true;

/**
 * Helper function to simulate realistic network latency (delay) when using mock data.
 * Viva Explanation:
 * In a real network, an API takes 100-300ms to respond. This helper mimics that
 * delay using a JavaScript Promise and setTimeout, ensuring the UI properly tests
 * loading spinners and asynchronous behavior.
 * 
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Resolves after the delay
 */
function delay(ms = 250) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// -----------------------------------------------------------------------------
// Central API Service Object
// -----------------------------------------------------------------------------
const api = {
    // Expose config flags so the UI can optionally display current mode
    BASE_URL: BASE_URL,
    USE_MOCK: USE_MOCK,

    /**
     * getZones()
     * Fetches the complete list of all parking zones.
     * 
     * Viva Explanation:
     * - If USE_MOCK is true: Retrieves `mockData.zones` from mock-data.js.
     *   We return a deep copy (structuredClone or JSON parse) so any accidental mutations
     *   don't corrupt the source mock data in memory.
     * - If USE_MOCK is false: Executes an HTTP GET request to `BASE_URL/zones` (FastAPI).
     *   It checks `response.ok` (HTTP status 200-299) and throws an error if the server fails.
     * 
     * @returns {Promise<Array>} Resolves to an array of zone objects:
     *                           [{ zone_id, location_name, base_rate_per_hour, total_capacity }, ...]
     */
    async getZones() {
        if (USE_MOCK) {
            // Simulated network delay for realistic frontend loading states
            await delay(200);
            
            // Check if mockData exists on window
            if (window.mockData && window.mockData.zones) {
                // Return a fresh copy of the mock zones array
                return JSON.parse(JSON.stringify(window.mockData.zones));
            } else {
                throw new Error("Mock data not found. Ensure mock-data.js is loaded before api.js.");
            }
        } else {
            // Real FastAPI backend integration: GET http://localhost:8000/zones
            const response = await fetch(`${BASE_URL}/zones`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch zones: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        }
    },

    /**
     * getZoneById(zoneId)
     * Fetches details of a single parking zone by its unique primary key ID.
     * 
     * Viva Explanation:
     * - Demonstrates parameterized querying.
     * - In SQL: `SELECT * FROM zones WHERE zone_id = ?;`
     * 
     * @param {number|string} zoneId - The unique ID of the zone
     * @returns {Promise<Object>} The zone object
     */
    async getZoneById(zoneId) {
        if (USE_MOCK) {
            await delay(150);
            const zones = window.mockData.zones;
            const zone = zones.find(z => z.zone_id === Number(zoneId));
            if (!zone) {
                throw new Error(`Zone with ID ${zoneId} not found.`);
            }
            return JSON.parse(JSON.stringify(zone));
        } else {
            const response = await fetch(`${BASE_URL}/zones/${zoneId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch zone ${zoneId}: ${response.status}`);
            }
            return await response.json();
        }
    },

    /**
     * getSlotsByZone(zoneId)
     * Fetches all parking slot sensors belonging to a specific parking zone.
     * 
     * Viva Explanation / DBMS Concept:
     * - Relational Foreign Key Filtering:
     *   In a relational database, parking slots have a foreign key `zone_id` referencing `zones.zone_id`.
     *   In SQL, this is equivalent to:
     *       SELECT * FROM parking_slots WHERE zone_id = :zoneId;
     * 
     * - How Mock Mode Works (USE_MOCK = true):
     *   We simulate network latency with delay(), access `window.mockData.slots`, and filter
     *   the array in memory using `s.zone_id === Number(zoneId)`.
     *   We return a deep clone so caller operations cannot mutate the source mock records.
     * 
     * - How Real Backend Mode Works (USE_MOCK = false):
     *   Performs an HTTP GET request to FastAPI: `GET http://localhost:8000/zones/{zoneId}/slots`.
     *   When your teammates finish the backend, toggling USE_MOCK to false automatically
     *   starts calling their live FastAPI route without changing any UI code!
     * 
     * @param {number|string} zoneId - The unique ID of the zone to retrieve slots for
     * @returns {Promise<Array>} Resolves to an array of slot objects:
     *                           [{ slot_id, sensor_id, status, zone_id }, ...]
     */
    async getSlotsByZone(zoneId) {
        if (!zoneId && zoneId !== 0) {
            throw new Error("getSlotsByZone requires a valid zoneId parameter.");
        }

        if (USE_MOCK) {
            // Simulate realistic 200ms network response time
            await delay(200);

            // Defensive check: ensure mock data was loaded
            if (!window.mockData || !window.mockData.slots) {
                throw new Error("Mock slots data not found. Ensure mock-data.js is loaded.");
            }

            // Relational filtering: find all slots whose foreign key matches this zone_id
            const matchedSlots = window.mockData.slots.filter(
                slot => Number(slot.zone_id) === Number(zoneId)
            );

            // Return deep copy to prevent in-memory mutation
            return JSON.parse(JSON.stringify(matchedSlots));
        } else {
            // Live FastAPI backend integration
            const response = await fetch(`${BASE_URL}/zones/${zoneId}/slots`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch slots for zone ${zoneId}: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        }
    },

    /**
     * getSlots(zoneId)
     * General slots fetcher, optionally delegating to getSlotsByZone if zoneId is provided.
     * 
     * @param {number|null} zoneId - Optional zone ID filter
     * @returns {Promise<Array>} Array of parking slot objects
     */
    async getSlots(zoneId = null) {
        if (zoneId !== null && zoneId !== undefined) {
            return this.getSlotsByZone(zoneId);
        }

        if (USE_MOCK) {
            await delay(200);
            return JSON.parse(JSON.stringify(window.mockData.slots || []));
        } else {
            const response = await fetch(`${BASE_URL}/slots`);
            if (!response.ok) {
                throw new Error(`Failed to fetch slots: ${response.status}`);
            }
            return await response.json();
        }
    },

    /**
     * getVehicles(userId)
     * Fetches registered vehicles belonging to the specified user (or all user vehicles).
     * 
     * Viva Explanation:
     * - Relational Foreign Key Query:
     *   In SQL: `SELECT plate_no, make, model, color, registration_status FROM vehicles WHERE user_id = :userId;`
     * - When USE_MOCK is true:
     *   Filters in-memory `window.MOCK_VEHICLES` by `user_id` (or returns all mock vehicles if userId matches demo set).
     * 
     * @param {number|string|null} userId - Optional user ID filter
     * @returns {Promise<Array>} Array of vehicle records: [{ plate_no, make, model, color, registration_status }, ...]
     */
    async getVehicles(userId = null) {
        if (USE_MOCK) {
            await delay(150);
            const vehicles = window.MOCK_VEHICLES || (window.mockData && window.mockData.vehicles) || [];
            if (userId !== null && userId !== undefined) {
                const userVehicles = vehicles.filter(v => !v.user_id || Number(v.user_id) === Number(userId));
                return JSON.parse(JSON.stringify(userVehicles));
            }
            return JSON.parse(JSON.stringify(vehicles));
        } else {
            const url = userId ? `${BASE_URL}/vehicles?user_id=${userId}` : `${BASE_URL}/vehicles`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch vehicles");
            return await response.json();
        }
    },

    /**
     * addVehicle(data)
     * Registers a new vehicle under the citizen's account.
     * 
     * Viva Explanation / DBMS Constraint Checking:
     * - Primary Key / Unique Constraint Enforcement:
     *   `plate_no` must be unique across the VEHICLES table.
     *   The function verifies that `plate_no` does not already exist in memory before inserting.
     * - Validates registration_status within the allowed enum values: Verified, Unclaimed, Out_of_State.
     * 
     * @param {Object} data - { plate_no, make, model, color, registration_status, user_id }
     * @returns {Promise<Object>} Created vehicle record
     */
    async addVehicle(data) {
        if (!data || !data.plate_no) {
            throw new Error("Vehicle license plate number is required.");
        }

        const cleanPlate = String(data.plate_no).trim().toUpperCase();

        if (USE_MOCK) {
            console.log("[api.js - Mock] addVehicle called with data:", data);
            await delay(250);

            const vehicles = window.MOCK_VEHICLES || (window.mockData && window.mockData.vehicles) || [];

            // Duplicate License Plate Validation Check
            const duplicate = vehicles.some(v => v.plate_no.trim().toUpperCase() === cleanPlate);
            if (duplicate) {
                throw new Error(`Vehicle with license plate "${cleanPlate}" already exists in the system.`);
            }

            const newVehicle = {
                vehicle_id: 10 + vehicles.length + 1,
                user_id: data.user_id ? Number(data.user_id) : 1,
                plate_no: cleanPlate,
                make: (data.make || "").trim(),
                model: (data.model || "").trim(),
                color: (data.color || "").trim(),
                registration_status: data.registration_status || "Verified"
            };

            vehicles.push(newVehicle);

            return {
                success: true,
                message: `Vehicle ${cleanPlate} registered successfully!`,
                vehicle: newVehicle
            };
        } else {
            const response = await fetch(`${BASE_URL}/vehicles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    ...data,
                    plate_no: cleanPlate
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Failed to add vehicle (${response.status}): ${errText || response.statusText}`);
            }

            return await response.json();
        }
    },

    /**
     * deleteVehicle(plateNo)
     * Removes a vehicle registration from the user's account.
     * 
     * Viva Explanation / REST Concept:
     * - HTTP DELETE request: `DELETE http://localhost:8000/vehicles/{plateNo}`
     * - In SQL: `DELETE FROM vehicles WHERE plate_no = :plateNo;`
     * 
     * @param {string} plateNo - License plate number of the vehicle to delete
     * @returns {Promise<Object>} Deletion result confirmation
     */
    async deleteVehicle(plateNo) {
        if (!plateNo) {
            throw new Error("License plate number is required for deletion.");
        }

        const cleanPlate = String(plateNo).trim().toUpperCase();

        if (USE_MOCK) {
            console.log(`[api.js - Mock] deleteVehicle called for plate: ${cleanPlate}`);
            await delay(200);

            const vehicles = window.MOCK_VEHICLES || (window.mockData && window.mockData.vehicles) || [];
            const index = vehicles.findIndex(v => v.plate_no.trim().toUpperCase() === cleanPlate);

            if (index === -1) {
                throw new Error(`Vehicle with license plate "${cleanPlate}" was not found.`);
            }

            const removed = vehicles.splice(index, 1)[0];

            return {
                success: true,
                message: `Vehicle "${cleanPlate}" was successfully removed from your account.`,
                plate_no: cleanPlate
            };
        } else {
            const response = await fetch(`${BASE_URL}/vehicles/${cleanPlate}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Failed to delete vehicle (${response.status}): ${errText || response.statusText}`);
            }

            return await response.json();
        }
    },

    /**
     * createReservation(data)
     * Creates a new parking slot reservation.
     * 
     * Viva Explanation / REST API Concepts:
     * - HTTP POST Request:
     *   Unlike GET requests (which only read data), POST is used to submit new records
     *   to the server to be created in the database.
     * 
     * - When USE_MOCK is true:
     *   Logs the payload to the browser console (`console.log`), simulates network delay,
     *   updates the slot's status in `mockData.slots` to "Reserved", and returns a success response.
     * 
     * - When USE_MOCK is false:
     *   Executes `fetch(`${BASE_URL}/reservations`, { method: "POST", ... })` with the JSON payload.
     *   FastAPI will insert into DBMS table `RESERVATIONS` and calculate the authoritative TotalCost.
     * 
     * @param {Object} data - Reservation payload:
     *                        { slot_id, zone_id, plate_no, start_time, end_time, estimated_cost }
     * @returns {Promise<Object>} Success status and created reservation details
     */
    async createReservation(data) {
        if (!data) {
            throw new Error("createReservation: Payload data is required.");
        }

        if (USE_MOCK) {
            // Log payload as required by Step 3 rules
            console.log("[api.js - Mock] createReservation called with payload:", data);

            // Simulate realistic 300ms server processing time
            await delay(300);

            // In-memory update: Change slot status to 'Reserved' so UI updates interactively
            if (window.mockData && window.mockData.slots) {
                const targetSlot = window.mockData.slots.find(
                    s => Number(s.slot_id) === Number(data.slot_id)
                );
                if (targetSlot) {
                    targetSlot.status = "Reserved";
                }
            }

            // Create mock record with simulated auto-generated ID
            const newReservationRecord = {
                reservation_id: 5001 + (window.mockData.reservations ? window.mockData.reservations.length : 0),
                ...data,
                status: "confirmed",
                created_at: new Date().toISOString()
            };

            // Store in mock reservations array
            if (window.mockData.reservations) {
                window.mockData.reservations.push(newReservationRecord);
            }

            // Return simulated success object
            return {
                success: true,
                message: "Reservation confirmed successfully!",
                data: newReservationRecord
            };
        } else {
            // Live FastAPI POST request
            const response = await fetch(`${BASE_URL}/reservations`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Failed to create reservation (${response.status}): ${errorBody || response.statusText}`);
            }

            return await response.json();
        }
    },

    /**
     * getTickets()
     * Fetches all municipal traffic violation e-challan tickets.
     * 
     * Viva Explanation:
     * - In SQL: `SELECT ticket_id, plate_no, rule_broken, violation_time, fine_amount, issue_date, due_date, ticket_status FROM tickets;`
     * - Returns array of ticket records used by tickets.html.
     * 
     * @returns {Promise<Array>} List of tickets
     */
    async getTickets() {
        if (USE_MOCK) {
            await delay(200);
            const tickets = window.MOCK_TICKETS || (window.mockData && window.mockData.tickets) || [];
            return JSON.parse(JSON.stringify(tickets));
        } else {
            const response = await fetch(`${BASE_URL}/tickets`);
            if (!response.ok) {
                throw new Error(`Failed to fetch tickets: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        }
    },

    /**
     * payTicket(ticketId)
     * Submits payment for an unpaid traffic fine.
     * 
     * Viva Explanation / REST Concept:
     * - Represents an action on a specific resource: POST /tickets/{id}/pay
     * - When USE_MOCK is true:
     *   Logs to console, updates ticket status in-memory to "Paid", and returns success.
     * - When USE_MOCK is false:
     *   Calls FastAPI POST endpoint: `http://localhost:8000/tickets/{id}/pay`.
     * 
     * @param {number|string} ticketId - Unique primary key of the ticket
     * @returns {Promise<Object>} Confirmation response
     */
    async payTicket(ticketId) {
        if (!ticketId) {
            throw new Error("payTicket requires a valid ticketId parameter.");
        }

        if (USE_MOCK) {
            console.log(`[api.js - Mock] payTicket called for Ticket ID #${ticketId}`);
            await delay(300);

            // In-memory status update
            const tickets = window.MOCK_TICKETS || (window.mockData && window.mockData.tickets) || [];
            const target = tickets.find(t => Number(t.ticket_id) === Number(ticketId));
            if (target) {
                target.ticket_status = "Paid";
            }

            return {
                success: true,
                message: `Payment successful for Ticket #${ticketId}. Status updated to Paid.`,
                ticket_id: Number(ticketId),
                ticket_status: "Paid"
            };
        } else {
            const response = await fetch(`${BASE_URL}/tickets/${ticketId}/pay`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Failed to process payment (${response.status}): ${errText || response.statusText}`);
            }

            return await response.json();
        }
    },

    /**
     * createAppeal(ticketId, reason)
     * Submits a formal dispute appeal against an issued e-challan ticket.
     * 
     * Viva Explanation / REST Concept:
     * - Represents creating a sub-resource / updating dispute status: POST /tickets/{id}/appeal
     * - When USE_MOCK is true:
     *   Logs to console, updates ticket status to "Appealed", attaches reason, and returns success.
     * - When USE_MOCK is false:
     *   Sends HTTP POST with JSON body containing `{ reason_text: reason }` to FastAPI.
     * 
     * @param {number|string} ticketId - Unique ticket identifier
     * @param {string} reason - Detailed justification text (max 500 characters)
     * @returns {Promise<Object>} Confirmation response
     */
    async createAppeal(ticketId, reason) {
        if (!ticketId) {
            throw new Error("createAppeal requires a valid ticketId parameter.");
        }
        if (!reason || !reason.trim()) {
            throw new Error("createAppeal requires an appeal reason.");
        }

        if (USE_MOCK) {
            console.log(`[api.js - Mock] createAppeal called for Ticket #${ticketId}. Reason:`, reason);
            await delay(350);

            // In-memory status update
            const tickets = window.MOCK_TICKETS || (window.mockData && window.mockData.tickets) || [];
            const target = tickets.find(t => Number(t.ticket_id) === Number(ticketId));
            if (target) {
                target.ticket_status = "Appealed";
                target.appeal_reason = reason.trim();
            }

            return {
                success: true,
                message: `Appeal successfully registered for Ticket #${ticketId}. Status changed to Appealed.`,
                ticket_id: Number(ticketId),
                ticket_status: "Appealed",
                reason_text: reason.trim()
            };
        } else {
            const response = await fetch(`${BASE_URL}/tickets/${ticketId}/appeal`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ reason_text: reason })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Failed to submit appeal (${response.status}): ${errText || response.statusText}`);
            }

            return await response.json();
        }
    },

    /**
     * getViolations()
     * Fetches all automated camera-captured traffic violations for the Admin Console.
     * 
     * Viva Explanation:
     * - In SQL: `SELECT violation_id, plate_no, camera_id, rule_broken, violation_time, image_link, has_ticket FROM violations;`
     * 
     * @returns {Promise<Array>} List of violations
     */
    async getViolations() {
        if (USE_MOCK) {
            await delay(200);
            const violations = window.MOCK_VIOLATIONS || (window.mockData && window.mockData.violations) || [];
            return JSON.parse(JSON.stringify(violations));
        } else {
            const response = await fetch(`${BASE_URL}/admin/violations`);
            if (!response.ok) {
                throw new Error(`Failed to fetch violations: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        }
    },

    /**
     * issueTicket(violationId, fineAmount, dueDate)
     * Issues an official e-challan ticket against a detected violation.
     * 
     * Viva Explanation / DBMS Transaction Concept:
     * - Relational Update + Insert:
     *   1. Updates `violations.has_ticket = TRUE` for this violation.
     *   2. Inserts a new record into `tickets(ticket_id, plate_no, rule_broken, fine_amount, due_date, ticket_status)`.
     * - Business Rule: A violation can only receive ONE ticket (enforces idempotency).
     * 
     * @param {number|string} violationId - Unique violation ID
     * @param {number|string} fineAmount - Fine amount in currency (> 0)
     * @param {string} dueDate - Deadline date in future (YYYY-MM-DD)
     * @returns {Promise<Object>} Creation result
     */
    async issueTicket(violationId, fineAmount, dueDate) {
        if (!violationId) throw new Error("issueTicket requires a valid violationId.");
        if (!fineAmount || Number(fineAmount) <= 0) throw new Error("Fine amount must be greater than 0.");
        if (!dueDate) throw new Error("Due date is required.");

        if (USE_MOCK) {
            console.log(`[api.js - Mock] issueTicket called for Violation #${violationId}:`, { fineAmount, dueDate });
            await delay(350);

            // In-memory update
            const violations = window.MOCK_VIOLATIONS || (window.mockData && window.mockData.violations) || [];
            const violation = violations.find(v => Number(v.violation_id) === Number(violationId));
            if (!violation) throw new Error(`Violation #${violationId} not found.`);

            violation.has_ticket = true;

            // Generate corresponding ticket in tickets table
            const tickets = window.MOCK_TICKETS || (window.mockData && window.mockData.tickets) || [];
            const newTicket = {
                ticket_id: 1000 + tickets.length + 1,
                plate_no: violation.plate_no,
                rule_broken: violation.rule_broken,
                violation_time: violation.violation_time ? violation.violation_time.split(" ")[1] || "12:00:00" : "12:00:00",
                fine_amount: Number(fineAmount),
                issue_date: new Date().toISOString().split("T")[0],
                due_date: dueDate,
                ticket_status: "Unpaid"
            };
            tickets.push(newTicket);

            return {
                success: true,
                message: `Ticket #${newTicket.ticket_id} successfully issued for Violation #${violationId}!`,
                ticket: newTicket,
                violation_id: Number(violationId)
            };
        } else {
            const response = await fetch(`${BASE_URL}/admin/violations/${violationId}/issue-ticket`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    fine_amount: Number(fineAmount),
                    due_date: dueDate
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Failed to issue ticket (${response.status}): ${errText || response.statusText}`);
            }

            return await response.json();
        }
    },

    /**
     * getAppeals()
     * Fetches all lodged dispute appeals for admin adjudication.
     * 
     * Viva Explanation:
     * - In SQL: `SELECT appeal_id, ticket_id, plate_no, reason_text, appeal_date, admin_decision FROM appeals;`
     * 
     * @returns {Promise<Array>} List of appeals
     */
    async getAppeals() {
        if (USE_MOCK) {
            await delay(200);
            const appeals = window.MOCK_APPEALS || (window.mockData && window.mockData.appeals) || [];
            return JSON.parse(JSON.stringify(appeals));
        } else {
            const response = await fetch(`${BASE_URL}/admin/appeals`);
            if (!response.ok) {
                throw new Error(`Failed to fetch appeals: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        }
    },

    /**
     * decideAppeal(appealId, decision)
     * Records administrative adjudication decision ('Approved' or 'Rejected').
     * 
     * Viva Explanation / REST Concept:
     * - Updates decision status: POST /admin/appeals/{id}/decide
     * - When Approved: System can dismiss the fine in the tickets table.
     * - When Rejected: Fine remains due and payable.
     * 
     * @param {number|string} appealId - Unique appeal ID
     * @param {string} decision - 'Approved' or 'Rejected'
     * @returns {Promise<Object>} Adjudication result
     */
    async decideAppeal(appealId, decision) {
        if (!appealId) throw new Error("decideAppeal requires appealId.");
        if (decision !== "Approved" && decision !== "Rejected") {
            throw new Error("Decision must be either 'Approved' or 'Rejected'.");
        }

        if (USE_MOCK) {
            console.log(`[api.js - Mock] decideAppeal called for Appeal #${appealId}: Decision = ${decision}`);
            await delay(300);

            // In-memory update
            const appeals = window.MOCK_APPEALS || (window.mockData && window.mockData.appeals) || [];
            const target = appeals.find(a => Number(a.appeal_id) === Number(appealId));
            if (!target) throw new Error(`Appeal #${appealId} not found.`);

            target.admin_decision = decision;

            // Optional relational effect on ticket
            if (decision === "Approved" && window.MOCK_TICKETS) {
                const contestedTicket = window.MOCK_TICKETS.find(t => Number(t.ticket_id) === Number(target.ticket_id));
                if (contestedTicket) {
                    contestedTicket.ticket_status = "Dismissed";
                }
            }

            return {
                success: true,
                message: `Appeal #${appealId} has been ${decision}.`,
                appeal_id: Number(appealId),
                admin_decision: decision
            };
        } else {
            const response = await fetch(`${BASE_URL}/admin/appeals/${appealId}/decide`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ admin_decision: decision })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Failed to submit decision (${response.status}): ${errText || response.statusText}`);
            }

            return await response.json();
        }
    },

    /**
     * getDashboardStats()
     * Fetches municipal operational analytics and KPI metrics for the Admin Dashboard.
     * 
     * Viva Explanation / DBMS Analytical Aggregations:
     * - What is this function for?
     *   Powers the visual charts and summary KPI cards in the Admin Console.
     * 
     * - SQL Equivalence (Relational Aggregations):
     *   1. Revenue Per Zone:
     *      SELECT z.location_name, SUM(r.estimated_cost) AS total_revenue
     *      FROM zones z JOIN reservations r ON z.zone_id = r.zone_id
     *      GROUP BY z.location_name;
     * 
     *   2. Slot Status Occupancy:
     *      SELECT z.location_name,
     *             COUNT(CASE WHEN s.status = 'Free' THEN 1 END) AS free,
     *             COUNT(CASE WHEN s.status = 'Occupied' THEN 1 END) AS occupied,
     *             COUNT(CASE WHEN s.status = 'Reserved' THEN 1 END) AS reserved,
     *             COUNT(CASE WHEN s.status = 'Maintenance' THEN 1 END) AS maintenance
     *      FROM zones z JOIN parking_slots s ON z.zone_id = s.zone_id
     *      GROUP BY z.location_name;
     * 
     *   3. Violations by Rule:
     *      SELECT rule_broken, COUNT(*) AS count
     *      FROM violations
     *      GROUP BY rule_broken;
     * 
     *   4. Ticket Summary:
     *      SELECT
     *         COUNT(CASE WHEN ticket_status = 'Unpaid' THEN 1 END) AS unpaid_count,
     *         SUM(CASE WHEN ticket_status = 'Unpaid' THEN fine_amount ELSE 0 END) AS unpaid_total,
     *         COUNT(CASE WHEN ticket_status = 'Paid' THEN 1 END) AS paid_count,
     *         COUNT(CASE WHEN ticket_status = 'Appealed' THEN 1 END) AS appealed_count
     *      FROM tickets;
     * 
     * - Mock Mode (USE_MOCK = true):
     *   Returns simulated aggregated data from mock-data.js (window.MOCK_STATS).
     * - Real Backend Mode (USE_MOCK = false):
     *   Performs an HTTP GET request to FastAPI: GET http://localhost:8000/admin/dashboard-stats.
     * 
     * @returns {Promise<Object>} Aggregated dashboard statistics object
     */
    async getDashboardStats() {
        if (USE_MOCK) {
            console.log("[api.js - Mock] getDashboardStats called");
            await delay(200);

            // Defensive retrieval from window.MOCK_STATS or window.mockData.stats
            const stats = window.MOCK_STATS || (window.mockData && window.mockData.stats);
            if (!stats) {
                throw new Error("Dashboard mock statistics not found. Ensure mock-data.js is loaded.");
            }

            // Return a deep copy so caller modifications cannot mutate the source data
            return JSON.parse(JSON.stringify(stats));
        } else {
            // Live FastAPI backend integration
            const response = await fetch(`${BASE_URL}/admin/dashboard-stats`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Failed to fetch dashboard stats (${response.status}): ${errText || response.statusText}`);
            }

            return await response.json();
        }
    },

    /**
     * loginUser(phone)
     * Authenticates a user using their 10-digit phone number.
     * 
     * Viva Explanation / Schema Note:
     * - In this Smart City DBMS project, the USERS table has NO password column.
     *   Authentication is phone-based (OTP/phone verification pattern).
     * - When USE_MOCK is true:
     *   Searches `window.MOCK_USERS` for a user matching the provided phone number.
     *   If found, returns user details (user_id, first_name, role).
     *   If not found, throws an informative error triggering the "User not found" alert.
     * - When USE_MOCK is false:
     *   Calls FastAPI route: `POST http://localhost:8000/users/login`.
     * 
     * @param {string} phone - 10-digit mobile number
     * @returns {Promise<Object>} User details on success
     */
    async loginUser(phone) {
        if (!phone) {
            throw new Error("Phone number is required for login.");
        }

        const cleanPhone = String(phone).trim();

        if (USE_MOCK) {
            console.log(`[api.js - Mock] loginUser called with phone: ${cleanPhone}`);
            await delay(250);

            const users = window.MOCK_USERS || (window.mockData && window.mockData.users) || [];
            const user = users.find(u => String(u.phone).trim() === cleanPhone);

            if (!user) {
                throw new Error("User not found with this phone number. Please check the number or register.");
            }

            return {
                success: true,
                user: {
                    user_id: user.user_id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    role: user.role, // 'citizen' or 'admin'
                    phone: user.phone,
                    dl_no: user.dl_no,
                    gmail: user.gmail
                }
            };
        } else {
            const response = await fetch(`${BASE_URL}/users/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ phone: cleanPhone })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Login failed (${response.status}): ${errText || "User not found"}`);
            }

            return await response.json();
        }
    },

    /**
     * registerUser(data)
     * Registers a new citizen user in the database.
     * 
     * Viva Explanation:
     * - In SQL: `INSERT INTO users(first_name, middle_name, last_name, phone, dl_no, gmail, role) VALUES (...);`
     * - When USE_MOCK is true:
     *   Logs registration data, simulates network latency, appends new citizen to `MOCK_USERS`,
     *   allowing immediate login with the newly created phone number!
     * - When USE_MOCK is false:
     *   Executes HTTP POST to FastAPI: `POST http://localhost:8000/users`.
     * 
     * @param {Object} data - { first_name, middle_name, last_name, phone, dl_no, gmail }
     * @returns {Promise<Object>} Success response with created user record
     */
    async registerUser(data) {
        if (!data) throw new Error("Registration data payload is required.");

        if (USE_MOCK) {
            console.log("[api.js - Mock] registerUser called with data:", data);
            await delay(300);

            const users = window.MOCK_USERS || (window.mockData && window.mockData.users) || [];
            const cleanPhone = String(data.phone).trim();

            // Check if phone already registered
            const existing = users.find(u => String(u.phone).trim() === cleanPhone);
            if (existing) {
                throw new Error("An account is already registered with this phone number. Please log in.");
            }

            // Create new citizen record
            const newUser = {
                user_id: 10 + users.length + 1,
                first_name: data.first_name.trim(),
                middle_name: (data.middle_name || "").trim(),
                last_name: data.last_name.trim(),
                phone: cleanPhone,
                dl_no: data.dl_no.trim(),
                gmail: data.gmail.trim(),
                role: "citizen" // Newly registered users default to citizen role
            };

            users.push(newUser);

            return {
                success: true,
                message: "Registration successful! You may now log in.",
                user: newUser
            };
        } else {
            const response = await fetch(`${BASE_URL}/users`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Registration failed (${response.status}): ${errText || response.statusText}`);
            }

            return await response.json();
        }
    }
};

// Expose the API client globally on the window object
window.api = api;
