/**
 * ==============================================================================
 * Smart City Parking & E-Challan System - Vehicles Controller (vehicles.js)
 * ==============================================================================
 * 
 * VIVA EXPLANATION / ARCHITECTURAL ROLE:
 * - What is this file's responsibility?
 *   This is the Page Controller for `vehicles.html` (My Vehicles).
 *   It coordinates:
 *   1. Initial Load:
 *      Fetches all vehicles registered to the currently authenticated citizen
 *      using `api.getVehicles(userId)`.
 *   2. Registration Status Badges:
 *      - Verified     -> Green  (.badge-reg-verified)
 *      - Unclaimed    -> Yellow (.badge-reg-unclaimed)
 *      - Out_of_State -> Grey   (.badge-reg-outofstate)
 *   3. Modal Vehicle Registration ("Add Vehicle"):
 *      - Validates required inputs (plate_no, make, model, color, registration_status).
 *      - Auto-uppercases license plate input (max 15 characters).
 *      - Rejects duplicate license plates before submission by checking local registry cache.
 *      - Calls `api.addVehicle(data)` to persist record.
 *   4. Vehicle Deletion Workflow ("Delete"):
 *      - Opens a Bootstrap confirmation modal before performing destructive operations.
 *      - Calls `api.deleteVehicle(plateNo)`.
 *   5. In-Place DOM Mutation:
 *      - Updates table rows dynamically after Add or Delete WITHOUT reloading the page.
 * 
 * - KEY VIVA RULE: Separation of Concerns (SoC)
 *   Page files must NEVER call `fetch()` directly. All data access goes through `js/api.js`.
 * 
 * - DBMS CONCEPTS DEMONSTRATED:
 *   - Primary Key Uniqueness:
 *     `plate_no` is the candidate/primary key of VEHICLES. No two rows can share the same plate.
 *   - Foreign Key Reference:
 *     `user_id` associates the vehicle with the logged-in citizen in USERS table.
 *   - Enum / Check Constraint:
 *     `registration_status` is restricted strictly to: 'Verified', 'Unclaimed', 'Out_of_State'.
 * ==============================================================================
 */

// -----------------------------------------------------------------------------
// State Management Variables
// -----------------------------------------------------------------------------
let vehiclesCache = [];                 // In-memory array of vehicles currently displayed
let addVehicleModalInstance = null;     // Bootstrap Modal instance for registration dialog
let deleteConfirmModalInstance = null;  // Bootstrap Modal instance for deletion confirmation
let pendingDeletePlate = null;          // License plate currently queued for deletion

// Wait until the HTML document is fully parsed before executing controller
document.addEventListener("DOMContentLoaded", () => {
    initVehiclesPage();
});

/**
 * initVehiclesPage()
 * Orchestrates page initialization, attaches event listeners, and triggers initial load.
 * 
 * Viva Explanation:
 * Wrapping initialization inside an entry function prevents global namespace pollution
 * and provides a single setup function for testability and lifecycle control.
 */
function initVehiclesPage() {
    // 1. Grab DOM element references
    const openAddBtn = document.getElementById("openAddVehicleModalBtn");
    const addVehicleModalEl = document.getElementById("addVehicleModal");
    const deleteModalEl = document.getElementById("deleteConfirmModal");
    const addVehicleForm = document.getElementById("addVehicleForm");
    const vehPlateInput = document.getElementById("vehPlateNo");
    const tbody = document.getElementById("vehiclesTableBody");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    const actionAlert = document.getElementById("vehicleActionAlert");

    // 2. Initialize Bootstrap Modal instances
    if (addVehicleModalEl && window.bootstrap) {
        addVehicleModalInstance = bootstrap.Modal.getOrCreateInstance(addVehicleModalEl);
    }
    if (deleteModalEl && window.bootstrap) {
        deleteConfirmModalInstance = bootstrap.Modal.getOrCreateInstance(deleteModalEl);
    }

    // 3. Handle Alert Dismissal without DOM destruction
    // Viva Explanation:
    // Bootstrap's default data-bs-dismiss="alert" removes elements from the DOM tree.
    // By intercepting the close button, we merely hide it with CSS (.d-none) so it can
    // be safely re-used for subsequent action notifications.
    if (actionAlert) {
        const closeBtn = actionAlert.querySelector(".btn-close");
        if (closeBtn) {
            closeBtn.removeAttribute("data-bs-dismiss");
            closeBtn.addEventListener("click", () => {
                actionAlert.classList.add("d-none");
            });
        }
    }

    // 4. Attach click listener to "Add Vehicle" top button
    if (openAddBtn) {
        openAddBtn.addEventListener("click", () => {
            openAddVehicleModal();
        });
    }

    // 5. Automatic Uppercase & Sanitization for License Plate Input
    // Viva Explanation:
    // Real-time user input normalization ensures license plates adhere to standard
    // DBMS uppercase formatting (e.g., 'dl-01-ab-1234' -> 'DL-01-AB-1234').
    if (vehPlateInput) {
        vehPlateInput.addEventListener("input", () => {
            vehPlateInput.value = vehPlateInput.value.toUpperCase();
            // Clear previous error state on active typing
            vehPlateInput.classList.remove("is-invalid");
            const modalErr = document.getElementById("modalVehicleError");
            if (modalErr) modalErr.classList.add("d-none");
        });
    }

    // 6. Add Vehicle Form Submission Listener
    if (addVehicleForm) {
        addVehicleForm.addEventListener("submit", handleAddVehicleSubmit);
    }

    // 7. Event Delegation on <tbody> for "Delete" buttons
    // Viva Explanation:
    // Event delegation catches click events bubbling from dynamically created rows
    // to the parent `<tbody>`. This avoids attaching listeners to every individual button.
    if (tbody) {
        tbody.addEventListener("click", (event) => {
            const deleteBtn = event.target.closest(".delete-vehicle-btn");
            if (deleteBtn) {
                const plateNo = deleteBtn.getAttribute("data-plate");
                promptDeleteVehicle(plateNo);
            }
        });
    }

    // 8. Confirm Deletion Button Listener (Inside Delete Modal)
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener("click", handleConfirmDelete);
    }

    // 9. Initial Load of Vehicles
    loadAndRenderVehicles();
}

/**
 * loadAndRenderVehicles()
 * Fetches user's vehicles via API layer and updates the table view.
 * 
 * Viva Explanation:
 * 1. Checks current authenticated user from `getAuthUser()` helper in `navbar.js`.
 * 2. Invokes `api.getVehicles(userId)` (Centralized API, never direct `fetch()`).
 * 3. Populates in-memory cache and renders table rows.
 * 4. Updates header stats badge.
 */
async function loadAndRenderVehicles() {
    const spinner = document.getElementById("vehiclesLoadingSpinner");
    const errorAlert = document.getElementById("vehiclesErrorMessage");

    // Show loading indicator
    if (spinner) spinner.classList.remove("d-none");
    if (errorAlert) errorAlert.classList.add("d-none");

    try {
        // Read logged-in user details
        const currentUser = typeof getAuthUser === "function" ? getAuthUser() : null;
        const userId = currentUser ? currentUser.user_id : 1;

        // Fetch vehicles from API layer
        const vehicles = await api.getVehicles(userId);

        // Store into memory cache
        vehiclesCache = Array.isArray(vehicles) ? vehicles : [];

        // Render table
        renderVehiclesTable(vehiclesCache);

        // Update summary counter badge
        updateVehicleStatsBadge();

    } catch (error) {
        console.error("[vehicles.js] Error loading vehicles:", error);
        if (errorAlert) {
            errorAlert.textContent = `Failed to load vehicles: ${error.message || "Network error"}`;
            errorAlert.classList.remove("d-none");
        }
    } finally {
        if (spinner) spinner.classList.add("d-none");
    }
}

/**
 * renderVehiclesTable(vehicles)
 * Renders the table body rows for the given list of vehicles.
 * 
 * @param {Array} vehicles - Array of vehicle records
 */
function renderVehiclesTable(vehicles) {
    const tbody = document.getElementById("vehiclesTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    // Empty state handling
    if (!vehicles || vehicles.length === 0) {
        tbody.innerHTML = `
            <tr id="emptyVehiclesRow">
                <td colspan="6" class="text-center py-5 text-muted">
                    <i class="bi bi-car-front display-6 d-block mb-2 text-secondary opacity-50"></i>
                    <h6 class="fw-bold mb-1">No Vehicles Registered</h6>
                    <p class="small mb-3">You do not have any motor vehicles registered to your profile yet.</p>
                    <button class="btn btn-outline-primary btn-sm" onclick="openAddVehicleModal()">
                        <i class="bi bi-plus-circle me-1"></i>Add Your First Vehicle
                    </button>
                </td>
            </tr>
        `;
        return;
    }

    // Render individual vehicle rows
    vehicles.forEach(vehicle => {
        const row = createVehicleRowElement(vehicle);
        tbody.appendChild(row);
    });
}

/**
 * createVehicleRowElement(vehicle)
 * Generates and returns a single `<tr>` element representing a vehicle.
 * 
 * Viva Explanation:
 * Pure DOM generation helper that maps DBMS columns to table cells:
 * - plate_no            -> Formatted font-monospace badge
 * - make                -> Manufacturer brand
 * - model               -> Model designation
 * - color               -> Color name with visual accent indicator
 * - registration_status -> Coloured status badge (Verified=Green, Unclaimed=Yellow, Out_of_State=Grey)
 * - Action              -> Delete button triggering confirmation prompt
 * 
 * @param {Object} vehicle - Vehicle data record
 * @returns {HTMLTableRowElement} Configured row element
 */
function createVehicleRowElement(vehicle) {
    const tr = document.createElement("tr");
    const cleanPlate = (vehicle.plate_no || "").trim().toUpperCase();
    
    // Set identifiable attribute for in-place DOM removal
    tr.setAttribute("data-plate-no", cleanPlate);
    tr.id = `veh-row-${cleanPlate.replace(/[^a-zA-Z0-9]/g, "-")}`;

    // Get Registration Status Badge Configuration
    const statusConfig = getRegistrationStatusConfig(vehicle.registration_status);

    tr.innerHTML = `
        <td>
            <span class="badge bg-light text-dark border font-monospace px-2 py-1 fs-6">
                <i class="bi bi-car-front text-secondary me-1"></i>${escapeHtml(cleanPlate)}
            </span>
        </td>
        <td class="fw-semibold text-dark">
            ${escapeHtml(vehicle.make || "N/A")}
        </td>
        <td>
            ${escapeHtml(vehicle.model || "N/A")}
        </td>
        <td>
            <span class="d-inline-flex align-items-center gap-1">
                <i class="bi bi-palette text-muted small"></i>
                <span>${escapeHtml(vehicle.color || "N/A")}</span>
            </span>
        </td>
        <td>
            <span class="badge ${statusConfig.badgeClass} d-inline-flex align-items-center gap-1">
                <i class="bi ${statusConfig.icon}"></i>
                <span>${escapeHtml(statusConfig.label)}</span>
            </span>
        </td>
        <td class="text-center">
            <button class="btn btn-outline-danger btn-sm delete-vehicle-btn d-inline-flex align-items-center gap-1"
                    data-plate="${escapeHtml(cleanPlate)}"
                    title="Remove vehicle registration">
                <i class="bi bi-trash3-fill"></i>
                <span>Delete</span>
            </button>
        </td>
    `;

    return tr;
}

/**
 * getRegistrationStatusConfig(status)
 * Returns CSS class, label, and icon corresponding to the registration status.
 * 
 * Viva Explanation / Status Coloring Rule:
 * - Verified     -> Green (.badge-reg-verified)
 * - Unclaimed    -> Yellow (.badge-reg-unclaimed)
 * - Out_of_State -> Grey (.badge-reg-outofstate)
 * 
 * @param {string} status - Raw status string
 * @returns {Object} { badgeClass, label, icon }
 */
function getRegistrationStatusConfig(status) {
    const cleanStatus = (status || "").trim();
    const lower = cleanStatus.toLowerCase();

    // Map allowed registration statuses to designated badge colors:
    // Verified = Green, Unclaimed = Yellow, Out_of_State = Grey
    if (lower === "verified") {
        return {
            badgeClass: "badge-reg-verified",
            label: "Verified",
            icon: "bi-shield-check"
        };
    } else if (lower === "unclaimed") {
        return {
            badgeClass: "badge-reg-unclaimed",
            label: "Unclaimed",
            icon: "bi-clock-history"
        };
    } else if (lower === "out_of_state" || lower === "out of state") {
        return {
            badgeClass: "badge-reg-outofstate",
            label: "Out_of_State",
            icon: "bi-geo-alt"
        };
    } else {
        return {
            badgeClass: "bg-secondary text-white",
            label: cleanStatus || "Unknown",
            icon: "bi-question-circle"
        };
    }
}

/**
 * openAddVehicleModal()
 * Cleans previous form inputs/errors and opens the "Add Vehicle" Bootstrap modal.
 */
function openAddVehicleModal() {
    const form = document.getElementById("addVehicleForm");
    const modalError = document.getElementById("modalVehicleError");
    const plateInput = document.getElementById("vehPlateNo");

    if (form) {
        form.reset();
        // Remove validation classes
        const inputs = form.querySelectorAll(".form-control, .form-select");
        inputs.forEach(input => {
            input.classList.remove("is-invalid");
            input.classList.remove("is-valid");
        });
    }

    if (modalError) {
        modalError.classList.add("d-none");
        modalError.textContent = "";
    }

    if (addVehicleModalInstance) {
        addVehicleModalInstance.show();
        // Auto-focus first input field for better UX
        setTimeout(() => {
            if (plateInput) plateInput.focus();
        }, 300);
    }
}

/**
 * handleAddVehicleSubmit(event)
 * Form submission handler for registering a new vehicle.
 * 
 * Viva Explanation:
 * 1. `event.preventDefault()`: Prevents standard browser submission and page refresh.
 * 2. Client-side Form Validation:
 *    - All fields (plate_no, make, model, color, registration_status) are required.
 *    - plate_no must be non-empty and max 15 characters.
 * 3. Primary Key Uniqueness Check:
 *    - Checks `vehiclesCache` to verify whether `plate_no` already exists in user's records.
 *    - If duplicate, displays error and halts submission immediately.
 * 4. API Invocation:
 *    - Dispatches payload to `api.addVehicle(data)`.
 * 5. In-Place DOM Mutation:
 *    - Appends the newly registered vehicle directly into the table without page reload.
 * 
 * @param {Event} event - Form submit event
 */
async function handleAddVehicleSubmit(event) {
    event.preventDefault();

    const form = document.getElementById("addVehicleForm");
    const plateInput = document.getElementById("vehPlateNo");
    const makeInput = document.getElementById("vehMake");
    const modelInput = document.getElementById("vehModel");
    const colorInput = document.getElementById("vehColor");
    const statusSelect = document.getElementById("vehRegStatus");
    const modalError = document.getElementById("modalVehicleError");

    const submitBtn = document.getElementById("saveVehicleBtn");
    const spinner = document.getElementById("saveVehSpinner");
    const icon = document.getElementById("saveVehIcon");
    const btnText = document.getElementById("saveVehText");

    // 1. Extract values
    const plateNo = (plateInput ? plateInput.value : "").trim().toUpperCase();
    const make = (makeInput ? makeInput.value : "").trim();
    const model = (modelInput ? modelInput.value : "").trim();
    const color = (colorInput ? colorInput.value : "").trim();
    const regStatus = (statusSelect ? statusSelect.value : "Verified").trim();

    // 2. Validate Required Fields
    let isValid = true;

    if (!plateNo || plateNo.length > 15) {
        if (plateInput) {
            plateInput.classList.add("is-invalid");
            document.getElementById("vehPlateError").textContent = 
                !plateNo ? "License plate number is required." : "License plate cannot exceed 15 characters.";
        }
        isValid = false;
    } else {
        if (plateInput) plateInput.classList.remove("is-invalid");
    }

    if (!make) {
        if (makeInput) makeInput.classList.add("is-invalid");
        isValid = false;
    } else {
        if (makeInput) makeInput.classList.remove("is-invalid");
    }

    if (!model) {
        if (modelInput) modelInput.classList.add("is-invalid");
        isValid = false;
    } else {
        if (modelInput) modelInput.classList.remove("is-invalid");
    }

    if (!color) {
        if (colorInput) colorInput.classList.add("is-invalid");
        isValid = false;
    } else {
        if (colorInput) colorInput.classList.remove("is-invalid");
    }

    // Validate registration_status against allowed 3 values
    const allowedStatuses = ["Verified", "Unclaimed", "Out_of_State"];
    if (!allowedStatuses.includes(regStatus)) {
        if (statusSelect) statusSelect.classList.add("is-invalid");
        isValid = false;
    } else {
        if (statusSelect) statusSelect.classList.remove("is-invalid");
    }

    if (!isValid) {
        return;
    }

    // 3. Duplicate License Plate Rejection (Client-Side Check)
    // Viva Explanation:
    // In DBMS, license plate is a candidate/primary key. We inspect our local cache
    // first to provide instant feedback before triggering a network roundtrip.
    const isDuplicate = vehiclesCache.some(v => (v.plate_no || "").trim().toUpperCase() === plateNo);
    if (isDuplicate) {
        if (plateInput) {
            plateInput.classList.add("is-invalid");
            document.getElementById("vehPlateError").textContent = 
                `License plate "${plateNo}" is already registered. Duplicate plates are prohibited.`;
        }
        if (modalError) {
            modalError.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1"></i> Duplicate Error: License plate <strong>${escapeHtml(plateNo)}</strong> already exists in your vehicle registry.`;
            modalError.classList.remove("d-none");
        }
        return;
    }

    // 4. UI Loading State
    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.classList.remove("d-none");
    if (icon) icon.classList.add("d-none");
    if (btnText) btnText.textContent = "Registering...";
    if (modalError) modalError.classList.add("d-none");

    try {
        const currentUser = typeof getAuthUser === "function" ? getAuthUser() : null;
        const userId = currentUser ? currentUser.user_id : 1;

        // Build Payload
        const payload = {
            plate_no: plateNo,
            make: make,
            model: model,
            color: color,
            registration_status: regStatus,
            user_id: userId
        };

        // Call Centralized API Layer (NO direct fetch()!)
        const result = await api.addVehicle(payload);
        const newVehicleRecord = result && result.vehicle ? result.vehicle : payload;

        // Add to In-Memory Cache
        vehiclesCache.push(newVehicleRecord);

        // In-Place DOM Mutation: Append row to table WITHOUT page reload
        addVehicleRowInPlace(newVehicleRecord);

        // Update Summary Counter
        updateVehicleStatsBadge();

        // Close Modal Dialog
        if (addVehicleModalInstance) {
            addVehicleModalInstance.hide();
        }

        // Show Success Action Alert
        showActionAlert(
            "Vehicle Registered Successfully",
            `Vehicle <strong>${escapeHtml(plateNo)}</strong> (${escapeHtml(make)} ${escapeHtml(model)}) has been added to your profile.`
        );

        // Reset form
        form.reset();

    } catch (error) {
        console.error("[vehicles.js] Failed to add vehicle:", error);
        if (modalError) {
            modalError.innerHTML = `<i class="bi bi-x-circle-fill me-1"></i> Registration failed: ${escapeHtml(error.message || "Unknown error")}`;
            modalError.classList.remove("d-none");
        }
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (spinner) spinner.classList.add("d-none");
        if (icon) icon.classList.remove("d-none");
        if (btnText) btnText.textContent = "Add Vehicle";
    }
}

/**
 * addVehicleRowInPlace(vehicle)
 * Appends a new vehicle row directly into the DOM table without full reload.
 * 
 * @param {Object} vehicle - Newly created vehicle record
 */
function addVehicleRowInPlace(vehicle) {
    const tbody = document.getElementById("vehiclesTableBody");
    if (!tbody) return;

    // Remove empty-state placeholder row if present
    const emptyRow = document.getElementById("emptyVehiclesRow");
    if (emptyRow) {
        emptyRow.remove();
    }

    // Create and append the new <tr>
    const tr = createVehicleRowElement(vehicle);
    
    // Add visual flash animation or highlight class
    tr.classList.add("table-success");
    tbody.appendChild(tr);

    // Fade out highlight after 1.5 seconds
    setTimeout(() => {
        tr.classList.remove("table-success");
    }, 1500);
}

/**
 * promptDeleteVehicle(plateNo)
 * Opens the delete confirmation modal for the selected license plate.
 * 
 * Viva Explanation:
 * Requirement: "Add a 'Delete' button on each row with a confirmation prompt
 * before it removes the vehicle."
 * A Bootstrap modal prevents accidental deletions of registered primary keys.
 * 
 * @param {string} plateNo - License plate to delete
 */
function promptDeleteVehicle(plateNo) {
    if (!plateNo) return;

    pendingDeletePlate = plateNo;

    const displayPlateEl = document.getElementById("deleteTargetPlate");
    if (displayPlateEl) {
        displayPlateEl.textContent = plateNo;
    }

    if (deleteConfirmModalInstance) {
        deleteConfirmModalInstance.show();
    }
}

/**
 * handleConfirmDelete()
 * Executes the vehicle deletion after user confirmation.
 * 
 * Viva Explanation:
 * 1. Invokes `api.deleteVehicle(pendingDeletePlate)`.
 * 2. On success:
 *    - Removes vehicle from `vehiclesCache`.
 *    - Removes corresponding `<tr>` from DOM directly via `element.remove()`.
 *    - Updates summary counter badge.
 *    - Displays success feedback banner.
 *    - All without page reload.
 */
async function handleConfirmDelete() {
    if (!pendingDeletePlate) return;

    const confirmBtn = document.getElementById("confirmDeleteBtn");
    const spinner = document.getElementById("deleteSpinner");
    const plateToDelete = pendingDeletePlate;

    // Loading state in modal
    if (confirmBtn) confirmBtn.disabled = true;
    if (spinner) spinner.classList.remove("d-none");

    try {
        // Centralized API call (NO direct fetch()!)
        await api.deleteVehicle(plateToDelete);

        // Update in-memory cache
        vehiclesCache = vehiclesCache.filter(
            v => (v.plate_no || "").trim().toUpperCase() !== plateToDelete.trim().toUpperCase()
        );

        // In-Place DOM Mutation: Remove <tr> from table
        removeVehicleRowInPlace(plateToDelete);

        // Update Summary Counter
        updateVehicleStatsBadge();

        // Close Delete Modal
        if (deleteConfirmModalInstance) {
            deleteConfirmModalInstance.hide();
        }

        // Show Success Action Alert
        showActionAlert(
            "Vehicle Deleted",
            `Vehicle with license plate <strong>${escapeHtml(plateToDelete)}</strong> has been removed from your account.`
        );

    } catch (error) {
        console.error("[vehicles.js] Failed to delete vehicle:", error);
        alert(`Deletion failed: ${error.message || "An error occurred"}`);
    } finally {
        if (confirmBtn) confirmBtn.disabled = false;
        if (spinner) spinner.classList.add("d-none");
        pendingDeletePlate = null;
    }
}

/**
 * removeVehicleRowInPlace(plateNo)
 * Locates and removes the specific table row from the DOM.
 * 
 * @param {string} plateNo - License plate number
 */
function removeVehicleRowInPlace(plateNo) {
    const cleanPlate = plateNo.trim().toUpperCase();
    const tbody = document.getElementById("vehiclesTableBody");
    if (!tbody) return;

    // Search by data attribute or sanitized ID
    const row = tbody.querySelector(`tr[data-plate-no="${cleanPlate}"]`) ||
                document.getElementById(`veh-row-${cleanPlate.replace(/[^a-zA-Z0-9]/g, "-")}`);

    if (row) {
        // Smooth fade out before removal
        row.style.transition = "opacity 0.25s ease, transform 0.25s ease";
        row.style.opacity = "0";
        row.style.transform = "translateX(20px)";
        setTimeout(() => {
            row.remove();
            // If all vehicles were removed, show empty placeholder row
            if (vehiclesCache.length === 0) {
                renderVehiclesTable([]);
            }
        }, 250);
    }
}

/**
 * updateVehicleStatsBadge()
 * Computes live summary metrics (Total, Verified, Unclaimed, Out_of_State)
 * and updates header badge.
 */
function updateVehicleStatsBadge() {
    const statsBadge = document.getElementById("vehicleStatsBadge");
    if (!statsBadge) return;

    const total = vehiclesCache.length;
    const verified = vehiclesCache.filter(v => (v.registration_status || "").trim() === "Verified").length;

    let text = `${total} Vehicle${total !== 1 ? 's' : ''} Registered`;
    if (total > 0) {
        text += ` &bull; ${verified} Verified`;
    }

    statsBadge.innerHTML = text;
}

/**
 * showActionAlert(title, message)
 * Displays top alert feedback banner with message.
 * 
 * @param {string} title - Heading title
 * @param {string} message - HTML message content
 */
function showActionAlert(title, message) {
    const alertBox = document.getElementById("vehicleActionAlert");
    const alertTitle = document.getElementById("vehicleActionAlertTitle");
    const alertMsg = document.getElementById("vehicleActionAlertMessage");

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

// Expose modal helpers globally so HTML inline buttons (e.g., empty state) can call them
window.openAddVehicleModal = openAddVehicleModal;
window.promptDeleteVehicle = promptDeleteVehicle;
