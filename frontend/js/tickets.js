/**
 * ==============================================================================
 * Smart City Parking & E-Challan System - Tickets Controller (tickets.js)
 * ==============================================================================
 * 
 * VIVA EXPLANATION / ARCHITECTURAL ROLE:
 * - What is this file's responsibility?
 *   This is the Page Controller for `tickets.html`. It coordinates:
 *   1. Initial Load: Fetches all issued e-challan violations via `api.getTickets()`.
 *   2. Dynamic Status Badges:
 *      - Unpaid   -> Red (`badge-status-unpaid`)
 *      - Paid     -> Green (`badge-status-paid`)
 *      - Appealed -> Yellow (`badge-status-appealed`)
 *      - Flagged  -> Dark (`badge-status-flagged`)
 *   3. Overdue Detection: Checks if an Unpaid ticket's `due_date` is in the past,
 *      highlighting the row and attaching an "OVERDUE" warning badge.
 *   4. Conditional Actions:
 *      - ONLY Unpaid tickets receive "Pay" and "Appeal" action buttons.
 *      - Paid, Appealed, and Flagged tickets receive no action buttons.
 *   5. Dispute Appeal Workflow:
 *      - Opens a Bootstrap Modal with a `reason_text` textarea.
 *      - Enforces client-side validation and a real-time live character counter (max 500).
 *      - Submits dispute via `api.createAppeal(ticketId, reason)`.
 *   6. In-Place DOM Mutation:
 *      - Updates table rows dynamically after Pay or Appeal WITHOUT reloading the page.
 * 
 * - KEY VIVA RULE: Separation of Concerns (SoC)
 *   Page files must NEVER call `fetch()` directly. All data access goes through `js/api.js`.
 * ==============================================================================
 */

// -----------------------------------------------------------------------------
// State Management Variables
// -----------------------------------------------------------------------------
let allTicketsCache = [];             // In-memory cache of all fetched tickets
let appealModalInstance = null;       // Bootstrap Modal reference for appeal dialog

// Wait until the HTML document is fully parsed before executing controller
document.addEventListener("DOMContentLoaded", () => {
    initTicketsPage();
});

/**
 * initTicketsPage()
 * Orchestrates page initialization, attaches event listeners, and triggers initial load.
 * 
 * Viva Explanation:
 * Wrapping initialization inside an entry function prevents global namespace pollution
 * and provides a single setup function for testability and re-rendering.
 */
function initTicketsPage() {
    // 1. Grab DOM element references
    const refreshBtn = document.getElementById("refreshTicketsBtn");
    const tbody = document.getElementById("ticketsTableBody");
    const appealForm = document.getElementById("appealForm");
    const appealReasonText = document.getElementById("appealReasonText");
    const appealModalEl = document.getElementById("appealModal");

    // 2. Initialize Bootstrap Modal instance
    if (appealModalEl) {
        appealModalInstance = bootstrap.Modal.getOrCreateInstance(appealModalEl);
    }

    // 3. Attach click event listener to "Refresh" button
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            loadAndRenderTickets();
        });
    }

    // 4. Event Delegation on <tbody> for "Pay" and "Appeal" buttons
    // Viva Explanation:
    // Event delegation catches click events bubbling from dynamically created rows
    // to the parent `<tbody>`. This avoids attaching listeners to every individual button.
    if (tbody) {
        tbody.addEventListener("click", (event) => {
            // Check if "Pay" button was clicked
            const payBtn = event.target.closest(".pay-ticket-btn");
            if (payBtn) {
                const ticketId = payBtn.getAttribute("data-ticket-id");
                handlePayTicket(ticketId, payBtn);
                return;
            }

            // Check if "Appeal" button was clicked
            const appealBtn = event.target.closest(".appeal-ticket-btn");
            if (appealBtn) {
                const ticketId = appealBtn.getAttribute("data-ticket-id");
                openAppealModal(ticketId);
                return;
            }
        });
    }

    // 5. Live Character Counter on Appeal Textarea
    // Viva Explanation:
    // Listening to the 'input' event fires synchronously on every keystroke,
    // paste, or delete, giving the user immediate visual feedback of remaining space.
    if (appealReasonText) {
        appealReasonText.addEventListener("input", updateAppealCharCounter);
    }

    // 6. Appeal Form Submission Listener
    if (appealForm) {
        appealForm.addEventListener("submit", handleAppealSubmit);
    }

    // 7. Initial data load
    loadAndRenderTickets();
}

/**
 * loadAndRenderTickets()
 * Asynchronously fetches tickets from api.js and updates the DOM table.
 * 
 * Viva Explanation:
 * - Uses `async/await` syntax for clean asynchronous control flow.
 * - Manages UI states: Loading spinner, Error alert, and Rendered rows.
 * - Strictly calls `api.getTickets()` without using `fetch()` directly.
 */
async function loadAndRenderTickets() {
    const tbody = document.getElementById("ticketsTableBody");
    const loadingSpinner = document.getElementById("ticketsLoadingSpinner");
    const errorMessage = document.getElementById("ticketsErrorMessage");
    const statsBadge = document.getElementById("ticketStatsBadge");

    if (!tbody) {
        console.error("Critical Error: '#ticketsTableBody' not found in DOM.");
        return;
    }

    // Step 1: Set UI to loading state
    if (loadingSpinner) loadingSpinner.classList.remove("d-none");
    if (errorMessage) errorMessage.classList.add("d-none");
    tbody.innerHTML = "";

    try {
        // Step 2: Fetch tickets via central API service
        const tickets = await api.getTickets();
        allTicketsCache = tickets || [];

        // Step 3: Handle empty state
        if (!tickets || tickets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-5 text-muted">
                        <i class="bi bi-shield-check fs-2 text-success d-block mb-2"></i>
                        No traffic violations or e-challans found for this account.
                    </td>
                </tr>
            `;
            if (statsBadge) statsBadge.textContent = "0 Tickets";
            return;
        }

        // Step 4: Update stats header badge
        updateTicketStatsBadge();

        // Step 5: Render table rows
        renderTicketsTable(tickets, tbody);

    } catch (error) {
        console.error("Error loading tickets:", error);
        if (errorMessage) {
            errorMessage.textContent = `Failed to load traffic tickets: ${error.message}`;
            errorMessage.classList.remove("d-none");
        }
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-danger">
                    <i class="bi bi-exclamation-triangle-fill fs-4 d-block mb-2"></i>
                    An error occurred while retrieving e-challan tickets.
                </td>
            </tr>
        `;
    } finally {
        if (loadingSpinner) loadingSpinner.classList.add("d-none");
    }
}

/**
 * renderTicketsTable(tickets, tbody)
 * Maps ticket records into HTML table rows with status badges, overdue flags, and conditional action buttons.
 * 
 * Viva Explanation / Business Logic Rules:
 * 1. Status Colors:
 *    - Unpaid   = Red
 *    - Paid     = Green
 *    - Appealed = Yellow
 *    - Flagged  = Dark
 * 2. Overdue Rule:
 *    - If `ticket_status === 'Unpaid'` AND `due_date < today`: highlight row & show "Overdue" badge.
 * 3. Conditional Actions Rule:
 *    - Unpaid tickets get "Pay" and "Appeal" buttons.
 *    - Paid, Appealed, and Flagged tickets get NO action buttons.
 * 
 * @param {Array<Object>} tickets - Array of ticket records
 * @param {HTMLElement} tbody - The <tbody> element
 */
function renderTicketsTable(tickets, tbody) {
    tbody.innerHTML = "";

    tickets.forEach(ticket => {
        const tr = createTicketRowElement(ticket);
        tbody.appendChild(tr);
    });
}

/**
 * createTicketRowElement(ticket)
 * Creates and configures a single `<tr>` element for a ticket.
 * 
 * @param {Object} ticket - Ticket data object
 * @returns {HTMLTableRowElement} The configured <tr> element
 */
function createTicketRowElement(ticket) {
    const tr = document.createElement("tr");
    tr.setAttribute("id", `ticket-row-${ticket.ticket_id}`);

    // Check overdue condition
    const isOverdue = checkIsOverdue(ticket.due_date, ticket.ticket_status);
    if (isOverdue) {
        tr.classList.add("row-overdue");
    }

    // Get status styling configuration
    const statusConfig = getTicketStatusConfig(ticket.ticket_status);

    // Format currency and dates
    const formattedFine = Number(ticket.fine_amount).toFixed(2);
    const isUnpaid = (ticket.ticket_status || "").trim().toLowerCase() === "unpaid";

    tr.innerHTML = `
        <td class="fw-bold text-secondary">
            <span class="badge bg-light text-dark border">#TCK-${ticket.ticket_id}</span>
        </td>
        <td>
            <span class="badge bg-light text-dark border font-monospace px-2 py-1 fs-6">
                <i class="bi bi-car-front text-secondary me-1"></i>${escapeHtml(ticket.plate_no)}
            </span>
        </td>
        <td>
            <div class="fw-semibold text-dark">${escapeHtml(ticket.rule_broken)}</div>
            <small class="text-muted d-block">Issued: ${escapeHtml(ticket.issue_date)}</small>
        </td>
        <td>
            <div class="small text-muted font-monospace">
                <i class="bi bi-clock-history me-1"></i>${escapeHtml(ticket.violation_time)}
            </div>
        </td>
        <td>
            <div class="${isOverdue ? 'text-danger fw-bold' : 'text-dark'}">
                ${escapeHtml(ticket.due_date)}
            </div>
            ${isOverdue ? `
                <span class="badge badge-status-overdue d-inline-flex align-items-center gap-1 mt-1">
                    <i class="bi bi-exclamation-triangle-fill"></i>
                    <span>Overdue</span>
                </span>
            ` : ""}
        </td>
        <td>
            <span class="fw-bold text-dark fs-6">
                ₹${formattedFine}
            </span>
        </td>
        <td class="status-cell">
            <span class="badge ${statusConfig.badgeClass} px-2 py-1 d-inline-flex align-items-center gap-1">
                <i class="bi ${statusConfig.icon}"></i>
                <span>${statusConfig.label}</span>
            </span>
        </td>
        <td class="actions-cell text-center">
            ${isUnpaid ? `
                <div class="d-flex gap-1 justify-content-center">
                    <button class="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 pay-ticket-btn shadow-sm"
                            data-ticket-id="${ticket.ticket_id}"
                            title="Pay this traffic fine now">
                        <i class="bi bi-credit-card-2-front"></i>
                        <span>Pay</span>
                    </button>
                    <button class="btn btn-sm btn-outline-warning text-dark d-inline-flex align-items-center gap-1 appeal-ticket-btn shadow-sm"
                            data-ticket-id="${ticket.ticket_id}"
                            title="Lodge a dispute appeal for this ticket">
                        <i class="bi bi-shield-exclamation"></i>
                        <span>Appeal</span>
                    </button>
                </div>
            ` : `
                <span class="text-muted small fst-italic">No action needed</span>
            `}
        </td>
    `;

    return tr;
}

/**
 * checkIsOverdue(dueDateStr, statusStr)
 * Determines whether an Unpaid ticket is overdue by comparing due_date against the current local date.
 * 
 * Viva Explanation:
 * Date Arithmetic Concept:
 * Converts `due_date` ("YYYY-MM-DD") to a JavaScript Date at midnight.
 * If current Date is strictly greater than the due date and status is "Unpaid", it is Overdue.
 * 
 * @param {string} dueDateStr - Date string in format "YYYY-MM-DD"
 * @param {string} statusStr - Current status ("Unpaid", "Paid", etc.)
 * @returns {boolean} True if unpaid and overdue
 */
function checkIsOverdue(dueDateStr, statusStr) {
    if (!dueDateStr) return false;
    const isUnpaid = (statusStr || "").trim().toLowerCase() === "unpaid";
    if (!isUnpaid) return false;

    // Compare date parts only (strip time)
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(23, 59, 59, 999); // Due until end of due day

    const today = new Date();
    return today.getTime() > dueDate.getTime();
}

/**
 * getTicketStatusConfig(rawStatus)
 * Returns label, badge CSS class, and icon for ticket status badges.
 * 
 * Requirements Mapping:
 * - Unpaid   = Red
 * - Paid     = Green
 * - Appealed = Yellow
 * - Flagged  = Dark
 * 
 * @param {string} rawStatus - Ticket status string
 * @returns {Object} Configuration with CSS badge classes and icons
 */
function getTicketStatusConfig(rawStatus) {
    const normalized = (rawStatus || "").trim().toLowerCase();

    switch (normalized) {
        case "unpaid":
            return {
                label: "Unpaid",
                badgeClass: "badge-status-unpaid",
                icon: "bi-x-circle-fill text-danger"
            };

        case "paid":
            return {
                label: "Paid",
                badgeClass: "badge-status-paid",
                icon: "bi-check-circle-fill text-success"
            };

        case "appealed":
            return {
                label: "Appealed",
                badgeClass: "badge-status-appealed",
                icon: "bi-clock-history text-warning"
            };

        case "flagged":
        default:
            return {
                label: "Flagged",
                badgeClass: "badge-status-flagged",
                icon: "bi-flag-fill text-light"
            };
    }
}

/**
 * handlePayTicket(ticketId, buttonElement)
 * Handles paying an unpaid ticket fine via api.payTicket(ticketId).
 * Updates the row in place to "Paid" without reloading the page.
 * 
 * Viva Explanation:
 * - In-Place DOM Mutation:
 *   Instead of calling `location.reload()`, which interrupts user workflow and causes
 *   unnecessary network roundtrips, we mutate the specific row's cells (`.status-cell`,
 *   `.actions-cell`) and remove overdue warning classes directly in the DOM.
 * 
 * @param {string|number} ticketId - Primary key of the ticket
 * @param {HTMLElement} buttonElement - The clicked Pay button
 */
async function handlePayTicket(ticketId, buttonElement) {
    // Disable button and show spinner feedback
    buttonElement.disabled = true;
    const originalContent = buttonElement.innerHTML;
    buttonElement.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Paying...`;

    try {
        // STRICT RULE: Never call fetch() directly. Use centralized API layer.
        const response = await api.payTicket(ticketId);

        // Update in-memory cache
        const ticket = allTicketsCache.find(t => Number(t.ticket_id) === Number(ticketId));
        if (ticket) {
            ticket.ticket_status = "Paid";
        }

        // Update the table row in-place WITHOUT page reload
        updateTicketRowInPlace(ticketId, "Paid");

        // Show confirmation alert banner
        showActionAlert(
            "Fine Payment Successful",
            `Ticket <strong>#TCK-${ticketId}</strong> has been marked as <strong>Paid</strong>. Payment reference recorded.`
        );

        // Update stats badge
        updateTicketStatsBadge();

    } catch (error) {
        console.error(`Payment failed for ticket ${ticketId}:`, error);
        alert(`Payment could not be processed: ${error.message}`);
        buttonElement.disabled = false;
        buttonElement.innerHTML = originalContent;
    }
}

/**
 * openAppealModal(ticketId)
 * Prepares and displays the dispute appeal modal dialog for a specific ticket.
 * 
 * @param {string|number} ticketId - The ticket being contested
 */
function openAppealModal(ticketId) {
    const ticket = allTicketsCache.find(t => Number(t.ticket_id) === Number(ticketId));
    if (!ticket) {
        console.error("Ticket not found in cache:", ticketId);
        return;
    }

    // Grab modal DOM elements
    const modalTicketId = document.getElementById("appealModalTicketId");
    const modalPlateNo = document.getElementById("appealModalPlateNo");
    const modalFine = document.getElementById("appealModalFine");
    const modalViolation = document.getElementById("appealModalViolation");
    const ticketIdInput = document.getElementById("appealTicketIdInput");
    const reasonTextarea = document.getElementById("appealReasonText");
    const charCount = document.getElementById("charCount");
    const appealFormError = document.getElementById("appealFormError");

    // Populate modal banner
    if (modalTicketId) modalTicketId.textContent = `Ticket #TCK-${ticket.ticket_id}`;
    if (modalPlateNo) modalPlateNo.textContent = ticket.plate_no;
    if (modalFine) modalFine.textContent = `₹${Number(ticket.fine_amount).toFixed(2)}`;
    if (modalViolation) modalViolation.textContent = ticket.rule_broken;
    if (ticketIdInput) ticketIdInput.value = ticket.ticket_id;

    // Reset textarea, character counter, and validation states
    if (reasonTextarea) {
        reasonTextarea.value = "";
        reasonTextarea.classList.remove("is-invalid", "is-valid");
    }
    if (charCount) charCount.textContent = "0";
    if (appealFormError) appealFormError.classList.add("d-none");

    // Show modal dialog
    if (appealModalInstance) {
        appealModalInstance.show();
    }
}

/**
 * updateAppealCharCounter()
 * Live character counter for the appeal reason textarea.
 * 
 * Viva Explanation:
 * Enforces UX transparency: As the user types in `<textarea maxlength="500">`,
 * this function reads `textarea.value.length` and dynamically updates the counter element.
 */
function updateAppealCharCounter() {
    const textarea = document.getElementById("appealReasonText");
    const charCount = document.getElementById("charCount");
    const counterContainer = document.getElementById("charCounterContainer");

    if (!textarea || !charCount) return;

    const count = textarea.value.length;
    charCount.textContent = count;

    // Optional visual cues as user approaches 500 character limit
    if (count >= 480) {
        charCount.classList.add("text-danger");
    } else if (count >= 400) {
        charCount.classList.add("text-warning");
        charCount.classList.remove("text-danger");
    } else {
        charCount.classList.remove("text-danger", "text-warning");
    }

    // Dynamic validation reset
    if (count > 0 && textarea.classList.contains("is-invalid")) {
        textarea.classList.remove("is-invalid");
    }
}

/**
 * handleAppealSubmit(event)
 * Validates the appeal form and calls api.createAppeal(ticketId, reason).
 * 
 * Viva Explanation:
 * 1. `event.preventDefault()`: Intercepts browser submit to avoid full reload.
 * 2. Validates that `reason_text` is non-empty and within 500 characters.
 * 3. Calls `api.createAppeal(ticketId, reason)`.
 * 4. Updates table row in place to "Appealed", removes action buttons, and closes modal.
 * 
 * @param {Event} event - Submit event
 */
async function handleAppealSubmit(event) {
    event.preventDefault();

    const ticketIdInput = document.getElementById("appealTicketIdInput");
    const textarea = document.getElementById("appealReasonText");
    const appealFormError = document.getElementById("appealFormError");
    const submitBtn = document.getElementById("submitAppealBtn");
    const spinner = document.getElementById("appealBtnSpinner");
    const icon = document.getElementById("appealBtnIcon");
    const btnText = document.getElementById("appealBtnText");

    const ticketId = ticketIdInput ? ticketIdInput.value : null;
    const reason = textarea ? textarea.value.trim() : "";

    // Form Validation: Reason cannot be empty
    if (!reason) {
        if (textarea) {
            textarea.classList.add("is-invalid");
            textarea.focus();
        }
        return;
    } else {
        if (textarea) {
            textarea.classList.remove("is-invalid");
            textarea.classList.add("is-valid");
        }
    }

    // Set submit button loading state
    submitBtn.disabled = true;
    if (spinner) spinner.classList.remove("d-none");
    if (icon) icon.classList.add("d-none");
    if (btnText) btnText.textContent = "Submitting...";
    if (appealFormError) appealFormError.classList.add("d-none");

    try {
        // Submit via central API layer (NO direct fetch() call!)
        const response = await api.createAppeal(ticketId, reason);

        // Update in-memory ticket record
        const ticket = allTicketsCache.find(t => Number(t.ticket_id) === Number(ticketId));
        if (ticket) {
            ticket.ticket_status = "Appealed";
            ticket.appeal_reason = reason;
        }

        // Close modal
        if (appealModalInstance) {
            appealModalInstance.hide();
        }

        // Update table row in-place WITHOUT page reload
        updateTicketRowInPlace(ticketId, "Appealed");

        // Present confirmation alert banner
        showActionAlert(
            "Appeal Lodged Successfully",
            `Dispute appeal for Ticket <strong>#TCK-${ticketId}</strong> has been registered. Status updated to <strong>Appealed</strong>.`
        );

        // Update stats badge
        updateTicketStatsBadge();

    } catch (error) {
        console.error("Appeal submission error:", error);
        if (appealFormError) {
            appealFormError.textContent = `Appeal submission failed: ${error.message}`;
            appealFormError.classList.remove("d-none");
        }
    } finally {
        submitBtn.disabled = false;
        if (spinner) spinner.classList.add("d-none");
        if (icon) icon.classList.remove("d-none");
        if (btnText) btnText.textContent = "Submit Appeal";
    }
}

/**
 * updateTicketRowInPlace(ticketId, newStatus)
 * Mutates the specific row in the DOM table directly without reloading the entire page.
 * 
 * Viva Explanation:
 * Requirement: "After Pay or Appeal succeeds, update the status in the table without reloading the page."
 * We find `#ticket-row-${ticketId}`:
 * 1. Remove the `.row-overdue` highlight.
 * 2. Replace the status badge with the new status (Paid: Green, Appealed: Yellow).
 * 3. Replace the actions column with "No action needed", since paid/appealed tickets get no buttons.
 * 
 * @param {string|number} ticketId - Ticket ID
 * @param {string} newStatus - "Paid" or "Appealed"
 */
function updateTicketRowInPlace(ticketId, newStatus) {
    const tr = document.getElementById(`ticket-row-${ticketId}`);
    if (!tr) return;

    // 1. Remove overdue styling from row
    tr.classList.remove("row-overdue");

    // Remove any overdue badge in the Due Date column
    const overdueBadge = tr.querySelector(".badge-status-overdue");
    if (overdueBadge) {
        overdueBadge.remove();
    }

    // 2. Update status badge cell
    const statusCell = tr.querySelector(".status-cell");
    if (statusCell) {
        const config = getTicketStatusConfig(newStatus);
        statusCell.innerHTML = `
            <span class="badge ${config.badgeClass} px-2 py-1 d-inline-flex align-items-center gap-1">
                <i class="bi ${config.icon}"></i>
                <span>${config.label}</span>
            </span>
        `;
    }

    // 3. Update actions cell: Remove Pay and Appeal buttons
    const actionsCell = tr.querySelector(".actions-cell");
    if (actionsCell) {
        actionsCell.innerHTML = `
            <span class="text-muted small fst-italic">
                ${newStatus === "Paid" ? "Payment Confirmed" : "Under Dispute Review"}
            </span>
        `;
    }

    // Add a brief subtle flash animation to emphasize the updated row
    tr.style.transition = "background-color 0.5s ease";
    tr.style.backgroundColor = newStatus === "Paid" ? "#ecfdf5" : "#fffbeb";
    setTimeout(() => {
        tr.style.backgroundColor = "";
    }, 1500);
}

/**
 * showActionAlert(title, message)
 * Displays a dismissible success banner at the top of the page.
 * 
 * @param {string} title - Heading text
 * @param {string} message - Description message
 */
function showActionAlert(title, message) {
    const alertBox = document.getElementById("ticketActionAlert");
    const alertTitle = document.getElementById("ticketActionAlertTitle");
    const alertMsg = document.getElementById("ticketActionAlertMessage");

    if (!alertBox) return;

    if (alertTitle) alertTitle.textContent = title;
    if (alertMsg) alertMsg.innerHTML = message;

    alertBox.classList.remove("d-none");
    alertBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * updateTicketStatsBadge()
 * Computes live summary metrics (Total, Unpaid, Overdue) and updates header badge.
 */
function updateTicketStatsBadge() {
    const statsBadge = document.getElementById("ticketStatsBadge");
    if (!statsBadge) return;

    const total = allTicketsCache.length;
    const unpaidCount = allTicketsCache.filter(t => (t.ticket_status || "").toLowerCase() === "unpaid").length;
    const overdueCount = allTicketsCache.filter(t => checkIsOverdue(t.due_date, t.ticket_status)).length;

    let badgeText = `${total} Ticket${total !== 1 ? 's' : ''}`;
    if (unpaidCount > 0) {
        badgeText += ` &bull; ${unpaidCount} Unpaid`;
    }
    if (overdueCount > 0) {
        badgeText += ` (${overdueCount} Overdue)`;
    }

    statsBadge.innerHTML = badgeText;
}

/**
 * escapeHtml(str)
 * Sanitizes strings before injecting them into HTML to prevent XSS (Cross-Site Scripting) attacks.
 * 
 * @param {string} str - Raw text string
 * @returns {string} Sanitized string safe for HTML rendering
 */
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
