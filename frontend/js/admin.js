/**
 * ==============================================================================
 * Smart City Parking & E-Challan System - Admin Console Controller (admin.js)
 * ==============================================================================
 * 
 * VIVA EXPLANATION / ARCHITECTURAL ROLE:
 * - What is this file's responsibility?
 *   This is the Page Controller for `admin.html`. It coordinates:
 *   1. Bootstrap Nav-Tabs:
 *      - Tab 1 ("Violations"): Displays camera-captured traffic violations.
 *      - Tab 2 ("Appeals"): Displays citizen dispute appeals for adjudication.
 *   2. E-Challan Issuance Workflow:
 *      - Violations without tickets (`has_ticket === false`) display an "Issue Ticket" button.
 *      - Opens `#issueTicketModal` validating fine_amount (> 0) and due_date (future date).
 *      - Calls `api.issueTicket(violationId, fineAmount, dueDate)`.
 *      - Idempotency / Single-Ticket Rule: Replaces button with an "Issued" badge.
 *   3. Citizen Appeals Adjudication:
 *      - Pending appeals receive "Approve" (Green) and "Reject" (Red) buttons.
 *      - Calls `api.decideAppeal(appealId, decision)`.
 *      - Mutates the table row in-place WITHOUT page reloads.
 * 
 * - KEY VIVA RULE: Separation of Concerns (SoC)
 *   Page files must NEVER call `fetch()` directly. All data access goes through `js/api.js`.
 * ==============================================================================
 */

// -----------------------------------------------------------------------------
// State Management Variables
// -----------------------------------------------------------------------------
let allViolationsCache = [];          // In-memory cache of fetched violations
let allAppealsCache = [];             // In-memory cache of fetched appeals
let issueTicketModalInstance = null;  // Bootstrap Modal instance for ticket issuance
let dashboardStatsCache = null;       // In-memory cache of dashboard KPI stats
let revenueChartInstance = null;      // Chart.js instance for Revenue Bar Chart
let occupancyChartInstance = null;    // Chart.js instance for Occupancy Stacked Bar Chart
let violationsChartInstance = null;   // Chart.js instance for Violations Pie Chart

// Wait until the HTML document is fully parsed before executing controller
document.addEventListener("DOMContentLoaded", () => {
    initAdminPage();
});

/**
 * initAdminPage()
 * Orchestrates page initialization, attaches event listeners, and triggers initial loads.
 * 
 * Viva Explanation:
 * Centralizing setup inside an entry function prevents global namespace pollution
 * and provides clean attachment of all dynamic button listeners via event delegation.
 */
function initAdminPage() {
    // 1. Grab DOM element references
    const refreshBtn = document.getElementById("refreshAdminBtn");
    const violationsTbody = document.getElementById("violationsTableBody");
    const appealsTbody = document.getElementById("appealsTableBody");
    const issueTicketForm = document.getElementById("issueTicketForm");
    const issueTicketModalEl = document.getElementById("issueTicketModal");
    const appealsTab = document.getElementById("appeals-tab");
    const dashboardTab = document.getElementById("dashboard-tab");

    // 2. Initialize Bootstrap Modal instance
    if (issueTicketModalEl) {
        issueTicketModalInstance = bootstrap.Modal.getOrCreateInstance(issueTicketModalEl);
    }

    // 3. Attach click event listener to "Refresh" button (reloads all 3 tabs)
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            loadViolations();
            loadAppeals();
            loadDashboardStats();
        });
    }

    // 4. Tab Activation Listener for Dashboard Tab
    // Viva Explanation / Hidden Canvas Handling:
    // Chart.js relies on canvas bounding client rect. When a canvas is inside a hidden tab
    // (display: none), its dimensions evaluate to 0x0. Listening to 'shown.bs.tab' guarantees
    // that charts render or resize at full visible pixel width once the tab is displayed.
    if (dashboardTab) {
        dashboardTab.addEventListener("shown.bs.tab", () => {
            if (dashboardStatsCache) {
                renderAllCharts(dashboardStatsCache);
            } else {
                loadDashboardStats();
            }
        });
    }

    // 5. Event Delegation on Violations Table Body
    // Listens for clicks on "Issue Ticket" buttons on unissued violations
    if (violationsTbody) {
        violationsTbody.addEventListener("click", (event) => {
            const issueBtn = event.target.closest(".issue-ticket-btn");
            if (!issueBtn) return;

            const violationId = issueBtn.getAttribute("data-violation-id");
            openIssueTicketModal(violationId);
        });
    }

    // 6. Event Delegation on Appeals Table Body
    // Listens for clicks on "Approve" and "Reject" buttons for Pending appeals
    if (appealsTbody) {
        appealsTbody.addEventListener("click", (event) => {
            const approveBtn = event.target.closest(".approve-appeal-btn");
            if (approveBtn) {
                const appealId = approveBtn.getAttribute("data-appeal-id");
                handleAppealDecision(appealId, "Approved", approveBtn);
                return;
            }

            const rejectBtn = event.target.closest(".reject-appeal-btn");
            if (rejectBtn) {
                const appealId = rejectBtn.getAttribute("data-appeal-id");
                handleAppealDecision(appealId, "Rejected", rejectBtn);
                return;
            }
        });
    }

    // 7. Issue Ticket Form Submission Listener
    if (issueTicketForm) {
        issueTicketForm.addEventListener("submit", handleIssueTicketSubmit);
    }

    // 8. Initial data fetches for all tabs
    loadViolations();
    loadAppeals();
    loadDashboardStats();
}

// =============================================================================
// TAB 1: VIOLATIONS CONTROLLER LOGIC
// =============================================================================

/**
 * loadViolations()
 * Asynchronously fetches camera violations via api.getViolations() and populates the table.
 * 
 * Viva Explanation:
 * Strictly calls `api.getViolations()` (never fetch directly). Manages loading spinner
 * and updates pending violation badges.
 */
async function loadViolations() {
    const tbody = document.getElementById("violationsTableBody");
    const loadingSpinner = document.getElementById("violationsLoadingSpinner");
    const errorMessage = document.getElementById("adminErrorMessage");
    const countBadge = document.getElementById("violationsCountBadge");

    if (!tbody) return;

    if (loadingSpinner) loadingSpinner.classList.remove("d-none");
    if (errorMessage) errorMessage.classList.add("d-none");
    tbody.innerHTML = "";

    try {
        const violations = await api.getViolations();
        allViolationsCache = violations || [];

        if (!violations || violations.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-5 text-muted">
                        <i class="bi bi-camera-video-off fs-2 d-block mb-2 text-secondary"></i>
                        No camera infractions recorded in surveillance logs.
                    </td>
                </tr>
            `;
            if (countBadge) countBadge.textContent = "0";
            return;
        }

        // Update badge showing unissued violations count
        const unissuedCount = violations.filter(v => !v.has_ticket).length;
        if (countBadge) {
            countBadge.textContent = `${unissuedCount} Pending`;
        }

        renderViolationsTable(violations, tbody);

    } catch (error) {
        console.error("Error loading violations:", error);
        if (errorMessage) {
            errorMessage.textContent = `Failed to load surveillance violations: ${error.message}`;
            errorMessage.classList.remove("d-none");
        }
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-danger">
                    <i class="bi bi-exclamation-triangle-fill fs-4 d-block mb-2"></i>
                    An error occurred while loading camera violations.
                </td>
            </tr>
        `;
    } finally {
        if (loadingSpinner) loadingSpinner.classList.add("d-none");
    }
}

/**
 * renderViolationsTable(violations, tbody)
 * Renders violation records into table rows.
 * 
 * Viva Explanation / Single-Ticket Business Rule:
 * - Violations without a ticket (`has_ticket === false`):
 *   Display an "Issue Ticket" button.
 * - Violations with a ticket (`has_ticket === true`):
 *   Display an "Issued" badge.
 * - A violation can only receive ONE ticket (enforcing data consistency).
 * 
 * @param {Array<Object>} violations - Array of violation objects
 * @param {HTMLElement} tbody - The <tbody> element
 */
function renderViolationsTable(violations, tbody) {
    tbody.innerHTML = "";

    violations.forEach(v => {
        const tr = document.createElement("tr");
        tr.setAttribute("id", `violation-row-${v.violation_id}`);

        tr.innerHTML = `
            <td class="fw-bold text-secondary">
                <span class="badge bg-light text-dark border">#VIO-${v.violation_id}</span>
            </td>
            <td>
                <span class="badge bg-light text-dark border font-monospace px-2 py-1 fs-6">
                    <i class="bi bi-car-front text-secondary me-1"></i>${escapeHtml(v.plate_no)}
                </span>
            </td>
            <td>
                <span class="badge bg-secondary-subtle text-secondary border font-monospace">
                    <i class="bi bi-camera-video me-1"></i>${escapeHtml(v.camera_id)}
                </span>
            </td>
            <td>
                <div class="fw-semibold text-dark">${escapeHtml(v.rule_broken)}</div>
            </td>
            <td>
                <div class="small text-muted font-monospace">
                    <i class="bi bi-clock-history me-1"></i>${escapeHtml(v.violation_time)}
                </div>
            </td>
            <td class="text-center">
                <img src="${escapeHtml(v.image_link)}" 
                     alt="Camera Snapshot" 
                     class="violation-thumb shadow-sm"
                     loading="lazy"
                     title="Surveillance capture from ${escapeHtml(v.camera_id)}">
            </td>
            <td class="text-center status-cell">
                ${v.has_ticket ? `
                    <span class="badge badge-ticket-issued px-2 py-1">
                        <i class="bi bi-check2-circle me-1"></i>Issued
                    </span>
                ` : `
                    <span class="badge badge-ticket-unissued px-2 py-1">
                        <i class="bi bi-hourglass-split me-1"></i>Pending
                    </span>
                `}
            </td>
            <td class="text-center actions-cell">
                ${v.has_ticket ? `
                    <span class="badge badge-ticket-issued px-3 py-2">
                        <i class="bi bi-check-all me-1"></i>Ticket Issued
                    </span>
                ` : `
                    <button class="btn btn-sm btn-primary d-inline-flex align-items-center gap-1 issue-ticket-btn shadow-sm"
                            data-violation-id="${v.violation_id}"
                            title="Issue an official e-challan for this infraction">
                        <i class="bi bi-file-earmark-plus"></i>
                        <span>Issue Ticket</span>
                    </button>
                `}
            </td>
        `;

        tbody.appendChild(tr);
    });
}

/**
 * openIssueTicketModal(violationId)
 * Prepares and displays the ticket issuance modal for a specific violation.
 * 
 * @param {string|number} violationId - Unique violation ID
 */
function openIssueTicketModal(violationId) {
    const violation = allViolationsCache.find(v => Number(v.violation_id) === Number(violationId));
    if (!violation) {
        console.error("Violation not found in cache:", violationId);
        return;
    }

    // Grab modal DOM elements
    const modalViolationId = document.getElementById("modalViolationId");
    const modalViolationPlate = document.getElementById("modalViolationPlate");
    const modalViolationCamera = document.getElementById("modalViolationCamera");
    const modalViolationRule = document.getElementById("modalViolationRule");
    const violationIdInput = document.getElementById("issueViolationIdInput");
    const fineInput = document.getElementById("issueFineAmount");
    const dueDateInput = document.getElementById("issueDueDate");
    const errorAlert = document.getElementById("issueTicketError");

    // Populate modal banner
    if (modalViolationId) modalViolationId.textContent = `Violation #VIO-${violation.violation_id}`;
    if (modalViolationPlate) modalViolationPlate.textContent = violation.plate_no;
    if (modalViolationCamera) modalViolationCamera.textContent = violation.camera_id;
    if (modalViolationRule) modalViolationRule.textContent = violation.rule_broken;
    if (violationIdInput) violationIdInput.value = violation.violation_id;

    // Set intelligent default values:
    // Default Fine: 500
    // Default Due Date: 14 days in the future
    if (fineInput) {
        fineInput.value = "500";
        fineInput.classList.remove("is-invalid", "is-valid");
    }

    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 14);
    const minDueDate = new Date();
    minDueDate.setDate(minDueDate.getDate() + 1); // Tomorrow

    const pad = n => String(n).padStart(2, "0");
    const defaultDateStr = `${defaultDueDate.getFullYear()}-${pad(defaultDueDate.getMonth() + 1)}-${pad(defaultDueDate.getDate())}`;
    const minDateStr = `${minDueDate.getFullYear()}-${pad(minDueDate.getMonth() + 1)}-${pad(minDueDate.getDate())}`;

    if (dueDateInput) {
        dueDateInput.value = defaultDateStr;
        dueDateInput.min = minDateStr; // HTML5 constraint ensuring future date selection
        dueDateInput.classList.remove("is-invalid", "is-valid");
    }

    if (errorAlert) errorAlert.classList.add("d-none");

    // Show modal dialog
    if (issueTicketModalInstance) {
        issueTicketModalInstance.show();
    }
}

/**
 * handleIssueTicketSubmit(event)
 * Validates and submits official ticket creation via api.issueTicket(violationId, fineAmount, dueDate).
 * 
 * Viva Explanation / Validation Rules:
 * 1. fine_amount: required, number, strictly greater than 0.
 * 2. due_date: required, must be set in the future.
 * 3. Idempotency Rule: After issuing, replaces the button in-place with an "Issued" badge.
 * 
 * @param {Event} event - Submit event
 */
async function handleIssueTicketSubmit(event) {
    event.preventDefault();

    const violationIdInput = document.getElementById("issueViolationIdInput");
    const fineInput = document.getElementById("issueFineAmount");
    const dueDateInput = document.getElementById("issueDueDate");
    const fineError = document.getElementById("fineAmountError");
    const dueDateError = document.getElementById("dueDateError");
    const errorAlert = document.getElementById("issueTicketError");
    const submitBtn = document.getElementById("confirmIssueBtn");
    const spinner = document.getElementById("issueBtnSpinner");
    const icon = document.getElementById("issueBtnIcon");
    const btnText = document.getElementById("issueBtnText");

    const violationId = violationIdInput ? violationIdInput.value : null;
    const fineAmount = fineInput ? Number(fineInput.value) : 0;
    const dueDate = dueDateInput ? dueDateInput.value : "";

    let isValid = true;

    // Validation 1: Fine Amount must be greater than 0
    if (!fineAmount || fineAmount <= 0) {
        fineInput.classList.add("is-invalid");
        fineInput.classList.remove("is-valid");
        if (fineError) fineError.textContent = "Fine amount is required and must be greater than 0.";
        isValid = false;
    } else {
        fineInput.classList.remove("is-invalid");
        fineInput.classList.add("is-valid");
    }

    // Validation 2: Due Date must be in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(dueDate);

    if (!dueDate) {
        dueDateInput.classList.add("is-invalid");
        dueDateInput.classList.remove("is-valid");
        if (dueDateError) dueDateError.textContent = "Due date cannot be empty.";
        isValid = false;
    } else if (selectedDate <= today) {
        dueDateInput.classList.add("is-invalid");
        dueDateInput.classList.remove("is-valid");
        if (dueDateError) dueDateError.textContent = "Due date must strictly be in the future.";
        isValid = false;
    } else {
        dueDateInput.classList.remove("is-invalid");
        dueDateInput.classList.add("is-valid");
    }

    if (!isValid) return;

    // Set UI loading state
    submitBtn.disabled = true;
    if (spinner) spinner.classList.remove("d-none");
    if (icon) icon.classList.add("d-none");
    if (btnText) btnText.textContent = "Issuing...";
    if (errorAlert) errorAlert.classList.add("d-none");

    try {
        // STRICT RULE: Call centralized API service (NO direct fetch() call!)
        const response = await api.issueTicket(violationId, fineAmount, dueDate);

        // Update in-memory cache
        const violation = allViolationsCache.find(v => Number(v.violation_id) === Number(violationId));
        if (violation) {
            violation.has_ticket = true;
        }

        // Close modal
        if (issueTicketModalInstance) {
            issueTicketModalInstance.hide();
        }

        // Update row in-place: Replace "Issue Ticket" button with "Issued" badge
        updateViolationRowIssued(violationId);

        // Show confirmation alert banner
        showAdminAlert(
            "Ticket Issued Successfully",
            `Official e-challan has been registered for Violation <strong>#VIO-${violationId}</strong>. Fine: <strong>₹${fineAmount.toFixed(2)}</strong>, Due Date: <strong>${dueDate}</strong>.`
        );

        // Update pending violations badge
        const unissuedCount = allViolationsCache.filter(v => !v.has_ticket).length;
        const countBadge = document.getElementById("violationsCountBadge");
        if (countBadge) countBadge.textContent = `${unissuedCount} Pending`;

    } catch (error) {
        console.error("Ticket issuance failed:", error);
        if (errorAlert) {
            errorAlert.textContent = `Issuance failed: ${error.message}`;
            errorAlert.classList.remove("d-none");
        }
    } finally {
        submitBtn.disabled = false;
        if (spinner) spinner.classList.add("d-none");
        if (icon) icon.classList.remove("d-none");
        if (btnText) btnText.textContent = "Issue Official Ticket";
    }
}

/**
 * updateViolationRowIssued(violationId)
 * Replaces the "Issue Ticket" button with an "Issued" badge in the table without reloading the page.
 * 
 * @param {string|number} violationId - Unique violation ID
 */
function updateViolationRowIssued(violationId) {
    const tr = document.getElementById(`violation-row-${violationId}`);
    if (!tr) return;

    // Update status cell
    const statusCell = tr.querySelector(".status-cell");
    if (statusCell) {
        statusCell.innerHTML = `
            <span class="badge badge-ticket-issued px-2 py-1">
                <i class="bi bi-check2-circle me-1"></i>Issued
            </span>
        `;
    }

    // Update actions cell: Replace button with Issued badge
    const actionsCell = tr.querySelector(".actions-cell");
    if (actionsCell) {
        actionsCell.innerHTML = `
            <span class="badge badge-ticket-issued px-3 py-2">
                <i class="bi bi-check-circle-fill me-1"></i>Issued
            </span>
        `;
    }

    // Visual highlight flash
    tr.style.transition = "background-color 0.5s ease";
    tr.style.backgroundColor = "#e0f2fe";
    setTimeout(() => {
        tr.style.backgroundColor = "";
    }, 1500);
}

// =============================================================================
// TAB 2: APPEALS CONTROLLER LOGIC
// =============================================================================

/**
 * loadAppeals()
 * Asynchronously fetches dispute appeals via api.getAppeals() and populates the table.
 */
async function loadAppeals() {
    const tbody = document.getElementById("appealsTableBody");
    const loadingSpinner = document.getElementById("appealsLoadingSpinner");
    const countBadge = document.getElementById("appealsCountBadge");

    if (!tbody) return;

    if (loadingSpinner) loadingSpinner.classList.remove("d-none");
    tbody.innerHTML = "";

    try {
        const appeals = await api.getAppeals();
        allAppealsCache = appeals || [];

        if (!appeals || appeals.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5 text-muted">
                        <i class="bi bi-check2-circle fs-2 d-block mb-2 text-success"></i>
                        No dispute appeals currently pending review.
                    </td>
                </tr>
            `;
            if (countBadge) countBadge.textContent = "0";
            return;
        }

        const pendingCount = appeals.filter(a => (a.admin_decision || "").toLowerCase() === "pending").length;
        if (countBadge) {
            countBadge.textContent = `${pendingCount} Pending`;
        }

        renderAppealsTable(appeals, tbody);

    } catch (error) {
        console.error("Error loading appeals:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-danger">
                    <i class="bi bi-exclamation-triangle-fill fs-4 d-block mb-2"></i>
                    An error occurred while loading dispute appeals.
                </td>
            </tr>
        `;
    } finally {
        if (loadingSpinner) loadingSpinner.classList.add("d-none");
    }
}

/**
 * renderAppealsTable(appeals, tbody)
 * Renders appeals with coloured decision badges and conditional adjudication buttons.
 * 
 * Decision Badge Mapping:
 * - Pending  = Yellow badge (`badge-decision-pending`) & gets "Approve" / "Reject" buttons.
 * - Approved = Green badge (`badge-decision-approved`) & no action buttons.
 * - Rejected = Red badge (`badge-decision-rejected`) & no action buttons.
 * 
 * @param {Array<Object>} appeals - Array of appeal records
 * @param {HTMLElement} tbody - The <tbody> element
 */
function renderAppealsTable(appeals, tbody) {
    tbody.innerHTML = "";

    appeals.forEach(appeal => {
        const tr = document.createElement("tr");
        tr.setAttribute("id", `appeal-row-${appeal.appeal_id}`);

        const config = getDecisionConfig(appeal.admin_decision);
        const isPending = (appeal.admin_decision || "").toLowerCase() === "pending";

        tr.innerHTML = `
            <td class="fw-bold text-secondary">
                <span class="badge bg-light text-dark border">#APL-${appeal.appeal_id}</span>
            </td>
            <td>
                <span class="badge bg-light text-dark border font-monospace">
                    #TCK-${appeal.ticket_id}
                </span>
            </td>
            <td>
                <span class="badge bg-light text-dark border font-monospace px-2 py-1 fs-6">
                    <i class="bi bi-car-front text-secondary me-1"></i>${escapeHtml(appeal.plate_no)}
                </span>
            </td>
            <td>
                <div class="small text-dark fst-italic p-2 bg-light rounded border">
                    "${escapeHtml(appeal.reason_text)}"
                </div>
            </td>
            <td>
                <div class="small text-muted font-monospace">
                    <i class="bi bi-calendar-event me-1"></i>${escapeHtml(appeal.appeal_date)}
                </div>
            </td>
            <td class="text-center decision-cell">
                <span class="badge ${config.badgeClass} px-2 py-1 d-inline-flex align-items-center gap-1">
                    <i class="bi ${config.icon}"></i>
                    <span>${config.label}</span>
                </span>
            </td>
            <td class="text-center adjudication-cell">
                ${isPending ? `
                    <div class="d-flex gap-1 justify-content-center">
                        <button class="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 approve-appeal-btn shadow-sm"
                                data-appeal-id="${appeal.appeal_id}"
                                title="Approve appeal (dismiss penalty)">
                            <i class="bi bi-check-circle-fill"></i>
                            <span>Approve</span>
                        </button>
                        <button class="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1 reject-appeal-btn shadow-sm"
                                data-appeal-id="${appeal.appeal_id}"
                                title="Reject appeal (maintain penalty)">
                            <i class="bi bi-x-circle-fill"></i>
                            <span>Reject</span>
                        </button>
                    </div>
                ` : `
                    <span class="small fw-semibold ${appeal.admin_decision === 'Approved' ? 'text-success' : 'text-danger'}">
                        <i class="bi ${appeal.admin_decision === 'Approved' ? 'bi-check2-circle' : 'bi-x-circle'} me-1"></i>
                        ${escapeHtml(appeal.admin_decision)}
                    </span>
                `}
            </td>
        `;

        tbody.appendChild(tr);
    });
}

/**
 * getDecisionConfig(decision)
 * Returns badge styling and icon for admin decisions.
 */
function getDecisionConfig(decision) {
    const normalized = (decision || "").trim().toLowerCase();

    switch (normalized) {
        case "approved":
            return {
                label: "Approved",
                badgeClass: "badge-decision-approved",
                icon: "bi-check-circle-fill text-success"
            };

        case "rejected":
            return {
                label: "Rejected",
                badgeClass: "badge-decision-rejected",
                icon: "bi-x-circle-fill text-danger"
            };

        case "pending":
        default:
            return {
                label: "Pending",
                badgeClass: "badge-decision-pending",
                icon: "bi-clock-history text-warning"
            };
    }
}

/**
 * handleAppealDecision(appealId, decision, buttonElement)
 * Handles an admin deciding an appeal ("Approved" or "Rejected").
 * Updates the row directly in the DOM without reloading the page.
 * 
 * @param {string|number} appealId - Unique appeal ID
 * @param {string} decision - "Approved" or "Rejected"
 * @param {HTMLElement} buttonElement - The button clicked
 */
async function handleAppealDecision(appealId, decision, buttonElement) {
    // Disable both action buttons in the cell while processing
    const parentCell = buttonElement.closest(".adjudication-cell");
    if (parentCell) {
        parentCell.querySelectorAll("button").forEach(b => b.disabled = true);
    }

    try {
        // STRICT RULE: Centralized API call (NO direct fetch() call!)
        const response = await api.decideAppeal(appealId, decision);

        // Update in-memory cache
        const appeal = allAppealsCache.find(a => Number(a.appeal_id) === Number(appealId));
        if (appeal) {
            appeal.admin_decision = decision;
        }

        // Update the table row in-place WITHOUT page reload
        updateAppealRowInPlace(appealId, decision);

        // Show confirmation alert banner
        showAdminAlert(
            `Appeal Decision Recorded`,
            `Dispute Appeal <strong>#APL-${appealId}</strong> has been <strong>${decision}</strong>.`
        );

        // Update appeals pending badge count
        const pendingCount = allAppealsCache.filter(a => (a.admin_decision || "").toLowerCase() === "pending").length;
        const countBadge = document.getElementById("appealsCountBadge");
        if (countBadge) countBadge.textContent = `${pendingCount} Pending`;

    } catch (error) {
        console.error(`Failed to decide appeal ${appealId}:`, error);
        alert(`Adjudication failed: ${error.message}`);
        if (parentCell) {
            parentCell.querySelectorAll("button").forEach(b => b.disabled = false);
        }
    }
}

/**
 * updateAppealRowInPlace(appealId, decision)
 * Mutates an appeal's table row directly in the DOM without reloading the page.
 * 
 * @param {string|number} appealId - Appeal ID
 * @param {string} decision - "Approved" or "Rejected"
 */
function updateAppealRowInPlace(appealId, decision) {
    const tr = document.getElementById(`appeal-row-${appealId}`);
    if (!tr) return;

    // Update Decision badge cell
    const decisionCell = tr.querySelector(".decision-cell");
    if (decisionCell) {
        const config = getDecisionConfig(decision);
        decisionCell.innerHTML = `
            <span class="badge ${config.badgeClass} px-2 py-1 d-inline-flex align-items-center gap-1">
                <i class="bi ${config.icon}"></i>
                <span>${config.label}</span>
            </span>
        `;
    }

    // Update Adjudication action cell: Replace buttons with decision confirmation label
    const adjudicationCell = tr.querySelector(".adjudication-cell");
    if (adjudicationCell) {
        adjudicationCell.innerHTML = `
            <span class="small fw-semibold ${decision === 'Approved' ? 'text-success' : 'text-danger'}">
                <i class="bi ${decision === 'Approved' ? 'bi-check2-circle' : 'bi-x-circle'} me-1"></i>
                Appeal ${decision}
            </span>
        `;
    }

    // Visual highlight flash
    tr.style.transition = "background-color 0.5s ease";
    tr.style.backgroundColor = decision === "Approved" ? "#ecfdf5" : "#fee2e2";
    setTimeout(() => {
        tr.style.backgroundColor = "";
    }, 1500);
}

// =============================================================================
// TAB 3: DASHBOARD CONTROLLER LOGIC (Step 8)
// =============================================================================

/**
 * loadDashboardStats()
 * Fetches dashboard analytics from api.js and updates KPI cards and Chart.js visualizations.
 * 
 * Viva Explanation / Separation of Concerns (SoC):
 * - Page files must NEVER call fetch() directly.
 * - This function calls `api.getDashboardStats()`, which either returns mock analytics
 *   from `mock-data.js` or queries FastAPI (`/admin/dashboard-stats`).
 * - Updates the 4 KPI summary cards immediately.
 * - If the dashboard tab is active/visible, renders the 3 charts.
 */
async function loadDashboardStats() {
    const spinner = document.getElementById("dashboardLoadingSpinner");
    const errorAlert = document.getElementById("dashboardErrorMessage");

    if (spinner) spinner.classList.remove("d-none");
    if (errorAlert) errorAlert.classList.add("d-none");

    try {
        // Fetch aggregated analytics strictly through centralized API client
        const stats = await api.getDashboardStats();
        dashboardStatsCache = stats;

        // 1. Populate the 4 Top Bootstrap Summary Cards
        renderSummaryCards(stats.ticket_summary);

        // 2. Render 3 Chart.js Visualizations (only if dashboard tab is currently visible,
        // or defer to shown.bs.tab to guarantee correct canvas layout dimensions)
        const dashboardPane = document.getElementById("dashboardPane");
        const isTabVisible = dashboardPane && dashboardPane.classList.contains("active");

        if (isTabVisible) {
            renderAllCharts(stats);
        }

    } catch (error) {
        console.error("[admin.js] Error loading dashboard statistics:", error);
        if (errorAlert) {
            errorAlert.textContent = `Failed to load dashboard metrics: ${error.message || "Network error"}`;
            errorAlert.classList.remove("d-none");
        }
    } finally {
        if (spinner) spinner.classList.add("d-none");
    }
}

/**
 * renderSummaryCards(summary)
 * Updates the 4 KPI metric cards at the top of the dashboard.
 * 
 * Viva Explanation:
 * Displays operational figures representing financial receivables and compliance:
 * - Unpaid Tickets count
 * - Unpaid Amount total formatted in Indian Rupees (₹)
 * - Paid Tickets count
 * - Pending Appeals awaiting administrative adjudication
 * 
 * @param {Object} summary - { unpaid_count, unpaid_total, paid_count, appealed_count }
 */
function renderSummaryCards(summary) {
    if (!summary) return;

    const statUnpaidCount = document.getElementById("statUnpaidTickets");
    const statUnpaidTotal = document.getElementById("statUnpaidTotal");
    const statPaidCount = document.getElementById("statPaidTickets");
    const statPendingAppeals = document.getElementById("statPendingAppeals");

    if (statUnpaidCount) {
        statUnpaidCount.textContent = summary.unpaid_count ?? 0;
    }

    if (statUnpaidTotal) {
        const amount = Number(summary.unpaid_total || 0);
        statUnpaidTotal.textContent = `₹${amount.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    if (statPaidCount) {
        statPaidCount.textContent = summary.paid_count ?? 0;
    }

    if (statPendingAppeals) {
        statPendingAppeals.textContent = summary.appealed_count ?? 0;
    }
}

/**
 * renderAllCharts(stats)
 * Orchestrates creation of all 3 Chart.js charts.
 * 
 * @param {Object} stats - Dashboard statistics payload
 */
function renderAllCharts(stats) {
    if (!stats || !window.Chart) {
        console.warn("[admin.js] Chart.js or statistics payload not available yet.");
        return;
    }

    renderRevenueBarChart(stats.revenue_per_zone || []);
    renderOccupancyStackedBarChart(stats.occupancy_per_zone || []);
    renderViolationsPieChart(stats.violations_by_rule || []);
}

/**
 * renderRevenueBarChart(zoneData)
 * Chart 1: Bar chart displaying revenue per parking zone.
 * 
 * Viva Explanation / Chart.js Lifecycle:
 * - Always call `existingChartInstance.destroy()` before re-creating a chart on a canvas.
 *   This clears internal event listeners and prevents duplicate renders.
 * 
 * @param {Array<Object>} zoneData - [{ location_name, total_revenue }, ...]
 */
function renderRevenueBarChart(zoneData) {
    const canvas = document.getElementById("revenueZoneChart");
    if (!canvas) return;

    // Destroy existing instance to prevent overlapping canvas renders
    if (revenueChartInstance) {
        revenueChartInstance.destroy();
        revenueChartInstance = null;
    }

    // Extract labels and metric values
    const labels = zoneData.map(z => z.location_name);
    const data = zoneData.map(z => Number(z.total_revenue || 0));

    const ctx = canvas.getContext("2d");
    revenueChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Total Revenue (₹)",
                data: data,
                backgroundColor: "rgba(2, 132, 199, 0.8)",
                borderColor: "#0284c7",
                borderWidth: 1.5,
                borderRadius: 6,
                maxBarThickness: 55
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Title is already displayed in Bootstrap card header
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed.y || 0;
                            return ` Revenue: ₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return `₹${value.toLocaleString("en-IN")}`;
                        }
                    },
                    title: {
                        display: true,
                        text: "Total Revenue (₹)"
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * renderOccupancyStackedBarChart(occupancyData)
 * Chart 2: Stacked bar chart displaying slot statuses per zone.
 * 
 * Requirement / Color Palette:
 * Uses identical color scheme as the Parking Slot view in Step 2:
 * - Free        -> Emerald Green (#10b981)
 * - Occupied    -> Crimson Red   (#ef4444)
 * - Reserved    -> Amber Yellow  (#f59e0b)
 * - Maintenance -> Slate Grey    (#6b7280)
 * 
 * @param {Array<Object>} occupancyData - [{ location_name, free, occupied, reserved, maintenance }, ...]
 */
function renderOccupancyStackedBarChart(occupancyData) {
    const canvas = document.getElementById("occupancyZoneChart");
    if (!canvas) return;

    // Destroy existing instance
    if (occupancyChartInstance) {
        occupancyChartInstance.destroy();
        occupancyChartInstance = null;
    }

    const labels = occupancyData.map(o => o.location_name);
    const freeData = occupancyData.map(o => Number(o.free || 0));
    const occupiedData = occupancyData.map(o => Number(o.occupied || 0));
    const reservedData = occupancyData.map(o => Number(o.reserved || 0));
    const maintenanceData = occupancyData.map(o => Number(o.maintenance || 0));

    const ctx = canvas.getContext("2d");
    occupancyChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Free",
                    data: freeData,
                    backgroundColor: "#10b981", // Matching .badge-status-free / status-free
                    borderColor: "#059669",
                    borderWidth: 1,
                    stack: "slotsStack"
                },
                {
                    label: "Occupied",
                    data: occupiedData,
                    backgroundColor: "#ef4444", // Matching .badge-status-occupied / status-occupied
                    borderColor: "#dc2626",
                    borderWidth: 1,
                    stack: "slotsStack"
                },
                {
                    label: "Reserved",
                    data: reservedData,
                    backgroundColor: "#f59e0b", // Matching .badge-status-reserved / status-reserved
                    borderColor: "#d97706",
                    borderWidth: 1,
                    stack: "slotsStack"
                },
                {
                    label: "Maintenance",
                    data: maintenanceData,
                    backgroundColor: "#6b7280", // Matching .badge-status-maintenance / status-maintenance
                    borderColor: "#4b5563",
                    borderWidth: 1,
                    stack: "slotsStack"
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "top",
                    labels: {
                        boxWidth: 14,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    mode: "index",
                    intersect: false
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Total Parking Slots"
                    }
                }
            }
        }
    });
}

/**
 * renderViolationsPieChart(violationsData)
 * Chart 3: Pie chart visualizing camera-captured infractions broken down by rule.
 * Also renders an accompanying breakdown list for high clarity and accessibility.
 * 
 * @param {Array<Object>} violationsData - [{ rule_broken, count }, ...]
 */
function renderViolationsPieChart(violationsData) {
    const canvas = document.getElementById("violationsRuleChart");
    const legendList = document.getElementById("violationsRuleList");
    if (!canvas) return;

    // Destroy existing instance
    if (violationsChartInstance) {
        violationsChartInstance.destroy();
        violationsChartInstance = null;
    }

    const labels = violationsData.map(v => v.rule_broken);
    const counts = violationsData.map(v => Number(v.count || 0));
    const totalCount = counts.reduce((acc, c) => acc + c, 0);

    // Harmonious color palette for 4 rules
    const colors = [
        "#ef4444", // Red (Expired meter)
        "#f59e0b", // Amber (Unauthorized no-parking)
        "#0284c7", // Bright Blue (Blocking EV bay)
        "#8b5cf6"  // Purple (Double parking)
    ];

    const ctx = canvas.getContext("2d");
    violationsChartInstance = new Chart(ctx, {
        type: "pie",
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors,
                borderColor: "#ffffff",
                borderWidth: 2,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Customized HTML breakdown list rendered on the right
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed || 0;
                            const pct = totalCount > 0 ? ((val / totalCount) * 100).toFixed(1) : 0;
                            return ` ${context.label}: ${val} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    // Populate adjacent breakdown list
    if (legendList) {
        legendList.innerHTML = "";
        violationsData.forEach((item, index) => {
            const color = colors[index % colors.length];
            const pct = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(0) : 0;
            const li = document.createElement("li");
            li.className = "list-group-item d-flex justify-content-between align-items-center px-0 py-2 border-0";
            li.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <span class="d-inline-block rounded-circle" style="width: 10px; height: 10px; background-color: ${color};"></span>
                    <span class="text-dark small">${escapeHtml(item.rule_broken)}</span>
                </div>
                <div class="text-end">
                    <span class="badge bg-light text-dark border px-2 py-1">${item.count}</span>
                    <span class="text-muted small ms-1">(${pct}%)</span>
                </div>
            `;
            legendList.appendChild(li);
        });
    }
}

// =============================================================================
// SHARED UTILITIES
// =============================================================================

/**
 * showAdminAlert(title, message)
 * Displays a dismissible success banner at the top of the admin page.
 * 
 * @param {string} title - Heading text
 * @param {string} message - Description message
 */
function showAdminAlert(title, message) {
    const alertBox = document.getElementById("adminActionAlert");
    const alertTitle = document.getElementById("adminActionAlertTitle");
    const alertMsg = document.getElementById("adminActionAlertMessage");

    if (!alertBox) return;

    if (alertTitle) alertTitle.textContent = title;
    if (alertMsg) alertMsg.innerHTML = message;

    alertBox.classList.remove("d-none");
    alertBox.scrollIntoView({ behavior: "smooth", block: "center" });
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
