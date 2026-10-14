/**
 * ==============================================================================
 * Smart City Parking & E-Challan System - Zones Page Controller (zones.js)
 * ==============================================================================
 * 
 * VIVA EXPLANATION / ARCHITECTURAL ROLE:
 * - What is this file's responsibility?
 *   This is the Page Controller for `zones.html`. It coordinates:
 *   1. Initial Load: Fetches and displays all parking zones via `api.getZones()`.
 *   2. Master-Detail Interaction: When a user clicks "View Slots", queries and renders
 *      all sensor slots for that zone via `api.getSlotsByZone(zoneId)`.
 *   3. Reservation Workflow (Step 3):
 *      - Listens for "Reserve" clicks on Free slots.
 *      - Populates a Bootstrap Modal with registered user vehicles via `api.getVehicles()`.
 *      - Computes real-time live cost preview based on `(hours * base_rate_per_hour)`.
 *      - Validates input: non-empty checks & ensures `end_time > start_time`.
 *      - Submits reservation payload through `api.createReservation(data)`.
 * 
 * - KEY VIVA RULE: Separation of Concerns (SoC)
 *   Page controllers NEVER call `fetch()` directly. All HTTP and mock logic is
 *   abstracted inside `js/api.js`.
 * ==============================================================================
 */

// -----------------------------------------------------------------------------
// State Management Variables
// -----------------------------------------------------------------------------
let allZonesCache = [];       // In-memory cache of all fetched zones
let currentActiveZone = null; // Currently inspected zone { zone_id, location_name, base_rate_per_hour, ... }
let currentActiveSlot = null; // Currently selected slot for reservation { slot_id, sensor_id }
let reservationModalInstance = null; // Bootstrap Modal instance reference

// Wait until the entire HTML document is parsed and loaded before running script
document.addEventListener("DOMContentLoaded", () => {
    initZonesPage();
});

/**
 * initZonesPage()
 * Orchestrates page initialization, attaches event listeners, and triggers initial load.
 * 
 * Viva Explanation:
 * Wrapping setup inside an entry function prevents global namespace pollution
 * and provides a centralized place to bind all UI event listeners.
 */
function initZonesPage() {
    // 1. Grab DOM references
    const refreshBtn = document.getElementById("refreshZonesBtn");
    const closeSlotsBtn = document.getElementById("closeSlotsBtn");
    const tbody = document.getElementById("zonesTableBody");
    const slotsContainer = document.getElementById("slotsContainer");
    const reservationForm = document.getElementById("reservationForm");
    const resStartTime = document.getElementById("resStartTime");
    const resEndTime = document.getElementById("resEndTime");
    const resVehicle = document.getElementById("resVehicle");

    // 2. Attach click event listener to the "Refresh" button
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            loadAndRenderZones();
        });
    }

    // 3. Attach click event listener to "Close" slots detail button
    if (closeSlotsBtn) {
        closeSlotsBtn.addEventListener("click", () => {
            hideSlotsSection();
        });
    }

    // 4. Event Delegation on <tbody> for "View Slots" buttons
    // Viva Explanation:
    // Event delegation listens at the parent level (`<tbody>`), efficiently capturing
    // clicks on dynamically generated row buttons without needing to re-bind on every render.
    if (tbody) {
        tbody.addEventListener("click", (event) => {
            const btn = event.target.closest(".view-slots-btn");
            if (!btn) return;

            const zoneId = btn.getAttribute("data-zone-id");
            const zoneName = btn.getAttribute("data-zone-name");
            const row = btn.closest("tr");

            handleViewSlots(zoneId, zoneName, row);
        });
    }

    // 5. Event Delegation for "Reserve" buttons on Free slots
    if (slotsContainer) {
        slotsContainer.addEventListener("click", (event) => {
            const reserveBtn = event.target.closest(".reserve-slot-btn");
            if (!reserveBtn) return;

            const slotId = reserveBtn.getAttribute("data-slot-id");
            const sensorId = reserveBtn.getAttribute("data-sensor-id");

            // Open the reservation modal dialog
            openReservationModal(slotId, sensorId);
        });
    }

    // 6. Reservation Form Submission Listener
    if (reservationForm) {
        reservationForm.addEventListener("submit", handleReservationSubmit);
    }

    // 7. Live Cost Preview Calculation Listeners (triggers on date/time inputs)
    // Viva Explanation:
    // Both 'input' and 'change' events are attached to ensure live recalculation
    // whether the user picks a date with the picker widget or types with the keyboard.
    if (resStartTime && resEndTime) {
        resStartTime.addEventListener("input", updateLiveCostPreview);
        resStartTime.addEventListener("change", updateLiveCostPreview);
        resEndTime.addEventListener("input", updateLiveCostPreview);
        resEndTime.addEventListener("change", updateLiveCostPreview);
    }

    // 8. Dynamic validation clean-up on vehicle selection
    if (resVehicle) {
        resVehicle.addEventListener("change", () => {
            if (resVehicle.value) {
                resVehicle.classList.remove("is-invalid");
                resVehicle.classList.add("is-valid");
            }
        });
    }

    // 9. Initial data fetch for zones table
    loadAndRenderZones();
}

/**
 * loadAndRenderZones()
 * Asynchronously fetches zone data from api.js and updates the DOM table.
 * 
 * Viva Explanation:
 * - Uses `async/await` syntax for clean asynchronous control flow.
 * - Stores fetched zones in `allZonesCache` so rate calculations can access zone details quickly.
 */
async function loadAndRenderZones() {
    const tbody = document.getElementById("zonesTableBody");
    const loadingSpinner = document.getElementById("loadingSpinner");
    const errorMessage = document.getElementById("errorMessage");
    const zoneCountBadge = document.getElementById("zoneCountBadge");

    if (!tbody) {
        console.error("Critical Error: Element '#zonesTableBody' was not found in the DOM.");
        return;
    }

    // Set UI to loading state
    if (loadingSpinner) loadingSpinner.classList.remove("d-none");
    if (errorMessage) errorMessage.classList.add("d-none");
    tbody.innerHTML = "";

    try {
        // Fetch zones via the centralized API layer (RULE: Never call fetch() directly)
        const zones = await api.getZones();
        allZonesCache = zones || [];

        // Handle empty database case
        if (!zones || zones.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">
                        <i class="bi bi-inbox fs-4 d-block mb-2"></i>
                        No parking zones found in the database.
                    </td>
                </tr>
            `;
            if (zoneCountBadge) zoneCountBadge.textContent = "0 Zones";
            return;
        }

        // Update total zone count badge
        if (zoneCountBadge) {
            zoneCountBadge.textContent = `${zones.length} Active Zone${zones.length > 1 ? "s" : ""}`;
        }

        // Render table rows
        renderZonesTable(zones, tbody);

    } catch (error) {
        console.error("Error loading zones:", error);
        if (errorMessage) {
            errorMessage.textContent = `Failed to load parking zones: ${error.message}`;
            errorMessage.classList.remove("d-none");
        }
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-danger">
                    <i class="bi bi-exclamation-triangle-fill fs-4 d-block mb-2"></i>
                    An error occurred while fetching zones. Please check console or try again.
                </td>
            </tr>
        `;
    } finally {
        if (loadingSpinner) loadingSpinner.classList.add("d-none");
    }
}

/**
 * renderZonesTable(zones, tbody)
 * Takes an array of zone objects and appends HTML rows to the table body.
 * 
 * @param {Array<Object>} zones - Array of zone records
 * @param {HTMLElement} tbody - The <tbody> element where rows are appended
 */
function renderZonesTable(zones, tbody) {
    tbody.innerHTML = "";

    zones.forEach((zone) => {
        const tr = document.createElement("tr");
        tr.setAttribute("id", `zone-row-${zone.zone_id}`);

        const formattedRate = Number(zone.base_rate_per_hour).toFixed(2);

        tr.innerHTML = `
            <td class="fw-bold text-secondary">
                <span class="badge bg-light text-dark border">#ZN-${zone.zone_id}</span>
            </td>
            <td>
                <div class="fw-semibold text-dark">${escapeHtml(zone.location_name)}</div>
                ${zone.description ? `<small class="text-muted d-block">${escapeHtml(zone.description)}</small>` : ""}
            </td>
            <td>
                <span class="badge badge-rate">
                    ₹${formattedRate} / hr
                </span>
            </td>
            <td>
                <span class="badge badge-capacity">
                    ${zone.total_capacity} Slots
                </span>
            </td>
            <td>
                <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                    <span class="spinner-grow spinner-grow-sm me-1 text-success align-middle" style="width: 8px; height: 8px;"></span>
                    Active
                </span>
            </td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 view-slots-btn shadow-sm"
                        data-zone-id="${zone.zone_id}"
                        data-zone-name="${escapeHtml(zone.location_name)}"
                        title="View slots in this zone">
                    <i class="bi bi-grid-3x3-gap-fill"></i>
                    <span>View Slots</span>
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

/**
 * handleViewSlots(zoneId, zoneName, trElement)
 * Handles click on a zone's "View Slots" button.
 * Queries child slots linked to foreign key `zone_id`.
 * 
 * @param {string|number} zoneId - Primary key of the selected zone
 * @param {string} zoneName - Name of the selected zone
 * @param {HTMLElement} trElement - The clicked table row
 */
async function handleViewSlots(zoneId, zoneName, trElement) {
    const slotsSection = document.getElementById("slotsSection");
    const selectedZoneTitle = document.getElementById("selectedZoneTitle");
    const selectedZoneSubtitle = document.getElementById("selectedZoneSubtitle");
    const slotsLoadingSpinner = document.getElementById("slotsLoadingSpinner");
    const slotsErrorMessage = document.getElementById("slotsErrorMessage");
    const slotsContainer = document.getElementById("slotsContainer");
    const slotsCountBadge = document.getElementById("slotsCountBadge");

    if (!slotsSection) return;

    // Cache the currently selected zone object for tariff calculation
    currentActiveZone = allZonesCache.find(z => Number(z.zone_id) === Number(zoneId)) || {
        zone_id: Number(zoneId),
        location_name: zoneName,
        base_rate_per_hour: 40.00
    };

    // Highlight the selected table row
    document.querySelectorAll("#zonesTableBody tr").forEach(row => {
        row.classList.remove("table-active-zone");
    });
    if (trElement) {
        trElement.classList.add("table-active-zone");
    }

    // Reveal the slots section
    slotsSection.classList.remove("d-none");

    if (selectedZoneTitle) {
        selectedZoneTitle.textContent = `Parking Slots: ${zoneName}`;
    }
    if (selectedZoneSubtitle) {
        selectedZoneSubtitle.textContent = `Live sensor status for Zone #ZN-${zoneId} (Tariff: ₹${Number(currentActiveZone.base_rate_per_hour).toFixed(2)}/hr)`;
    }

    // Set slots loading state
    if (slotsLoadingSpinner) slotsLoadingSpinner.classList.remove("d-none");
    if (slotsErrorMessage) slotsErrorMessage.classList.add("d-none");
    if (slotsContainer) slotsContainer.innerHTML = "";
    if (slotsCountBadge) slotsCountBadge.textContent = "Loading...";

    try {
        // Fetch slots using centralized API layer (NO direct fetch() call!)
        const slots = await api.getSlotsByZone(zoneId);

        // Render responsive card grid
        renderSlotsGrid(slots, slotsContainer, slotsCountBadge, zoneName);

    } catch (error) {
        console.error(`Error loading slots for zone ${zoneId}:`, error);
        if (slotsErrorMessage) {
            slotsErrorMessage.textContent = `Failed to load slots for this zone: ${error.message}`;
            slotsErrorMessage.classList.remove("d-none");
        }
        if (slotsCountBadge) slotsCountBadge.textContent = "Error";
    } finally {
        if (slotsLoadingSpinner) slotsLoadingSpinner.classList.add("d-none");
    }
}

/**
 * renderSlotsGrid(slots, container, badgeElement, zoneName)
 * Renders slot cards with status-specific colors into a responsive Bootstrap grid.
 * 
 * Color Mapping:
 * - Free        -> Green  (Reserve button enabled)
 * - Occupied    -> Red    (No reserve button)
 * - Reserved    -> Yellow (No reserve button)
 * - Maintenance -> Grey   (No reserve button)
 */
function renderSlotsGrid(slots, container, badgeElement, zoneName) {
    if (!container) return;
    container.innerHTML = "";

    if (!slots || slots.length === 0) {
        if (badgeElement) badgeElement.textContent = "0 Slots";
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="bi bi-info-circle text-muted fs-2 d-block mb-2"></i>
                <h5 class="text-secondary">No Parking Slots Configured</h5>
                <p class="text-muted small">This zone currently has no sensor slots recorded in the database.</p>
            </div>
        `;
        return;
    }

    if (badgeElement) {
        badgeElement.textContent = `${slots.length} Slot${slots.length > 1 ? "s" : ""}`;
    }

    slots.forEach(slot => {
        const col = document.createElement("div");
        col.className = "col-12 col-sm-6 col-lg-4";

        const config = getStatusConfig(slot.status);

        col.innerHTML = `
            <div class="card slot-card ${config.cardClass} shadow-sm h-100">
                <!-- Card Header -->
                <div class="card-header py-2 px-3 d-flex justify-content-between align-items-center">
                    <span class="fw-bold text-dark d-flex align-items-center gap-1">
                        <i class="bi bi-p-circle-fill text-primary"></i>
                        <span>Slot #${slot.slot_id}</span>
                    </span>
                    <span class="badge ${config.badgeClass} px-2 py-1 d-flex align-items-center gap-1">
                        <i class="bi ${config.icon}"></i>
                        <span>${config.label}</span>
                    </span>
                </div>

                <!-- Card Body -->
                <div class="card-body p-3 d-flex flex-column justify-content-between">
                    <div>
                        <div class="mb-2">
                            <span class="text-muted small d-block">IoT Sensor ID</span>
                            <span class="font-monospace fw-semibold text-dark fs-6">
                                <i class="bi bi-broadcast text-secondary me-1"></i>${escapeHtml(slot.sensor_id)}
                            </span>
                        </div>
                        <div class="small text-muted">
                            <i class="bi bi-geo me-1"></i>Zone ID: <strong>#ZN-${slot.zone_id}</strong>
                        </div>
                    </div>

                    <!-- Reserve Button: Only on Free slots -->
                    <div class="mt-3">
                        ${config.isFree ? `
                            <button class="btn btn-sm btn-outline-success w-100 fw-semibold reserve-slot-btn d-flex align-items-center justify-content-center gap-1 shadow-sm"
                                    data-slot-id="${slot.slot_id}"
                                    data-sensor-id="${escapeHtml(slot.sensor_id)}">
                                <i class="bi bi-bookmark-plus-fill"></i>
                                <span>Reserve</span>
                            </button>
                        ` : `
                            <div class="text-center py-1">
                                <small class="text-muted fst-italic">
                                    ${config.label === "Occupied" ? "Slot is currently in use" : 
                                      config.label === "Reserved" ? "Active reservation pending" : 
                                      "Sensor under repair"}
                                </small>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;

        container.appendChild(col);
    });
}

/**
 * getStatusConfig(rawStatus)
 * Maps database status strings to Bootstrap styling and flags.
 */
function getStatusConfig(rawStatus) {
    const normalized = (rawStatus || "").trim().toLowerCase();

    switch (normalized) {
        case "free":
        case "available":
            return {
                label: "Free",
                cardClass: "status-free",
                badgeClass: "badge-status-free",
                icon: "bi-check-circle-fill",
                isFree: true
            };

        case "occupied":
            return {
                label: "Occupied",
                cardClass: "status-occupied",
                badgeClass: "badge-status-occupied",
                icon: "bi-x-circle-fill",
                isFree: false
            };

        case "reserved":
            return {
                label: "Reserved",
                cardClass: "status-reserved",
                badgeClass: "badge-status-reserved",
                icon: "bi-clock-fill",
                isFree: false
            };

        case "maintenance":
        default:
            return {
                label: "Maintenance",
                cardClass: "status-maintenance",
                badgeClass: "badge-status-maintenance",
                icon: "bi-wrench-adjustable",
                isFree: false
            };
    }
}

// =============================================================================
// STEP 3: RESERVATION FLOW & MODAL CONTROLLER FUNCTIONS
// =============================================================================

/**
 * openReservationModal(slotId, sensorId)
 * Prepares and opens the Bootstrap Modal for reserving a Free slot.
 * 
 * Viva Explanation:
 * 1. Caches the active slot in `currentActiveSlot`.
 * 2. Fetches user vehicles via `api.getVehicles()` (strictly through the API layer).
 * 3. Sets default start time (now) and end time (now + 2 hours).
 * 4. Triggers live cost calculation immediately so the user sees a valid preview.
 * 5. Clears previous validation error states and displays the modal.
 * 
 * @param {string|number} slotId - The slot ID to reserve
 * @param {string} sensorId - The sensor ID of the slot
 */
async function openReservationModal(slotId, sensorId) {
    currentActiveSlot = {
        slot_id: slotId,
        sensor_id: sensorId
    };

    // Grab modal DOM elements
    const modalSlotTitle = document.getElementById("modalSlotTitle");
    const modalSensorId = document.getElementById("modalSensorId");
    const modalBaseRate = document.getElementById("modalBaseRate");
    const vehicleSelect = document.getElementById("resVehicle");
    const startTimeInput = document.getElementById("resStartTime");
    const endTimeInput = document.getElementById("resEndTime");
    const modalFormError = document.getElementById("modalFormError");

    // Defensive check: ensure currentActiveZone is set
    const baseRate = currentActiveZone ? Number(currentActiveZone.base_rate_per_hour) : 40.00;

    // Update modal summary info
    if (modalSlotTitle) modalSlotTitle.textContent = `Slot #${slotId}`;
    if (modalSensorId) modalSensorId.textContent = sensorId;
    if (modalBaseRate) modalBaseRate.textContent = `₹${baseRate.toFixed(2)} / hr`;
    if (modalFormError) modalFormError.classList.add("d-none");

    // Reset validation classes on all inputs
    [vehicleSelect, startTimeInput, endTimeInput].forEach(input => {
        if (input) {
            input.classList.remove("is-invalid", "is-valid");
        }
    });

    // Populate Vehicle Dropdown asynchronously via api.js
    try {
        const vehicles = await api.getVehicles();
        if (vehicleSelect) {
            vehicleSelect.innerHTML = `<option value="" disabled selected>-- Choose your registered vehicle --</option>`;
            vehicles.forEach(v => {
                const opt = document.createElement("option");
                opt.value = v.plate_no;
                opt.textContent = `${v.plate_no} — ${v.make} ${v.model} (${v.color})`;
                vehicleSelect.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("Failed to load vehicles for modal:", err);
        if (modalFormError) {
            modalFormError.textContent = "Unable to load vehicle list. Please try again.";
            modalFormError.classList.remove("d-none");
        }
    }

    // Set intelligent default start & end times (start = now, end = start + 2 hrs)
    const now = new Date();
    now.setSeconds(0, 0); // Strip seconds for datetime-local input compatibility
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    if (startTimeInput) startTimeInput.value = formatDateTimeLocal(now);
    if (endTimeInput) endTimeInput.value = formatDateTimeLocal(twoHoursLater);

    // Compute initial live cost preview
    updateLiveCostPreview();

    // Show the Bootstrap modal using standard Bootstrap Modal JavaScript API
    const modalEl = document.getElementById("reservationModal");
    if (modalEl) {
        reservationModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        reservationModalInstance.show();
    }
}

/**
 * updateLiveCostPreview()
 * Calculates and updates the real-time cost preview inside the modal as user changes times.
 * 
 * Viva Explanation:
 * - Mathematical Formula: `Preview Cost = duration_in_hours * base_rate_per_hour`
 * - Why preview only?
 *   In database application security, the client-side cost is only an estimate for UX.
 *   The authoritative `TotalCost` must always be calculated on the backend (FastAPI)
 *   to prevent malicious client tampering with pricing logic!
 * 
 * @returns {number} The calculated estimated cost
 */
function updateLiveCostPreview() {
    const startTimeInput = document.getElementById("resStartTime");
    const endTimeInput = document.getElementById("resEndTime");
    const previewCostAmount = document.getElementById("previewCostAmount");
    const previewDurationText = document.getElementById("previewDurationText");
    const endTimeError = document.getElementById("endTimeError");

    if (!startTimeInput || !endTimeInput) return 0;

    const startTimeVal = startTimeInput.value;
    const endTimeVal = endTimeInput.value;

    const baseRate = currentActiveZone ? Number(currentActiveZone.base_rate_per_hour) : 40.00;

    // Handle incomplete input state
    if (!startTimeVal || !endTimeVal) {
        if (previewCostAmount) previewCostAmount.textContent = "₹0.00";
        if (previewDurationText) previewDurationText.textContent = "Duration: Select both times";
        return 0;
    }

    const startDate = new Date(startTimeVal);
    const endDate = new Date(endTimeVal);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60); // Convert milliseconds to hours

    // Validation check: End time must be strictly after start time
    if (diffHours <= 0) {
        if (previewCostAmount) previewCostAmount.textContent = "₹0.00";
        if (previewDurationText) {
            previewDurationText.innerHTML = `<span class="text-danger fw-semibold">End time must be after start time</span>`;
        }
        endTimeInput.classList.add("is-invalid");
        if (endTimeError) endTimeError.textContent = "End time must be strictly after the start time.";
        return 0;
    } else {
        // Valid date range: remove invalid flag on end time
        endTimeInput.classList.remove("is-invalid");
    }

    // Calculate live cost
    const totalCost = diffHours * baseRate;

    // Render formatted preview
    if (previewCostAmount) {
        previewCostAmount.textContent = `₹${totalCost.toFixed(2)}`;
    }
    if (previewDurationText) {
        previewDurationText.textContent = `Duration: ${diffHours.toFixed(1)} hrs (@ ₹${baseRate.toFixed(2)}/hr)`;
    }

    return totalCost;
}

/**
 * handleReservationSubmit(event)
 * Validates form fields and submits reservation payload to api.createReservation(data).
 * 
 * Viva Explanation:
 * 1. `event.preventDefault()`: Prevents default HTML form submit behavior (which reloads the page).
 * 2. Strict client-side validation rules:
 *    - No empty vehicle selection.
 *    - No empty start time or end time.
 *    - End time must be strictly greater than start time.
 *    - Shows native Bootstrap `.is-invalid` visual feedback classes.
 * 3. Submits payload strictly through `api.createReservation(data)`.
 * 4. Closes modal, refreshes slot state, and presents confirmation notification.
 */
async function handleReservationSubmit(event) {
    event.preventDefault();

    const vehicleSelect = document.getElementById("resVehicle");
    const startTimeInput = document.getElementById("resStartTime");
    const endTimeInput = document.getElementById("resEndTime");
    const vehicleError = document.getElementById("vehicleError");
    const startTimeError = document.getElementById("startTimeError");
    const endTimeError = document.getElementById("endTimeError");
    const modalFormError = document.getElementById("modalFormError");
    const confirmBtn = document.getElementById("confirmReserveBtn");
    const confirmBtnSpinner = document.getElementById("confirmBtnSpinner");
    const confirmBtnIcon = document.getElementById("confirmBtnIcon");
    const confirmBtnText = document.getElementById("confirmBtnText");

    let isValid = true;

    // Rule 1: Vehicle cannot be empty
    if (!vehicleSelect.value) {
        vehicleSelect.classList.add("is-invalid");
        vehicleSelect.classList.remove("is-valid");
        if (vehicleError) vehicleError.textContent = "Please select a registered vehicle.";
        isValid = false;
    } else {
        vehicleSelect.classList.remove("is-invalid");
        vehicleSelect.classList.add("is-valid");
    }

    // Rule 2: Start time cannot be empty
    if (!startTimeInput.value) {
        startTimeInput.classList.add("is-invalid");
        startTimeInput.classList.remove("is-valid");
        if (startTimeError) startTimeError.textContent = "Start time cannot be empty.";
        isValid = false;
    } else {
        startTimeInput.classList.remove("is-invalid");
        startTimeInput.classList.add("is-valid");
    }

    // Rule 3: End time cannot be empty
    if (!endTimeInput.value) {
        endTimeInput.classList.add("is-invalid");
        endTimeInput.classList.remove("is-valid");
        if (endTimeError) endTimeError.textContent = "End time cannot be empty.";
        isValid = false;
    } else if (startTimeInput.value && new Date(endTimeInput.value) <= new Date(startTimeInput.value)) {
        // Rule 4: End time must be after start time
        endTimeInput.classList.add("is-invalid");
        endTimeInput.classList.remove("is-valid");
        if (endTimeError) endTimeError.textContent = "End time must be strictly after the start time.";
        isValid = false;
    } else {
        endTimeInput.classList.remove("is-invalid");
        endTimeInput.classList.add("is-valid");
    }

    // Stop if validation fails
    if (!isValid) {
        return;
    }

    // Calculate final preview tariff
    const estimatedCost = updateLiveCostPreview();

    // Assemble reservation data payload matching DBMS relational attributes
    const reservationPayload = {
        slot_id: Number(currentActiveSlot.slot_id),
        zone_id: Number(currentActiveZone.zone_id),
        plate_no: vehicleSelect.value,
        start_time: startTimeInput.value,
        end_time: endTimeInput.value,
        estimated_cost: Number(estimatedCost.toFixed(2))
    };

    // UI loading state on submit button
    confirmBtn.disabled = true;
    if (confirmBtnSpinner) confirmBtnSpinner.classList.remove("d-none");
    if (confirmBtnIcon) confirmBtnIcon.classList.add("d-none");
    if (confirmBtnText) confirmBtnText.textContent = "Processing...";
    if (modalFormError) modalFormError.classList.add("d-none");

    try {
        // Call central API service (NEVER call fetch directly)
        const response = await api.createReservation(reservationPayload);

        // Close the modal
        if (reservationModalInstance) {
            reservationModalInstance.hide();
        }

        // Show success alert on page
        const successAlert = document.getElementById("reservationSuccessAlert");
        const successMsg = document.getElementById("reservationSuccessMessage");
        if (successAlert && successMsg) {
            successMsg.innerHTML = `
                Successfully reserved <strong>Slot #${currentActiveSlot.slot_id}</strong> 
                (Sensor: <code>${currentActiveSlot.sensor_id}</code>) for vehicle 
                <strong>${reservationPayload.plate_no}</strong>.<br>
                Time: <strong>${formatDisplayDateTime(reservationPayload.start_time)}</strong> &rarr; 
                <strong>${formatDisplayDateTime(reservationPayload.end_time)}</strong> &bull; 
                Estimated Tariff: <strong>₹${reservationPayload.estimated_cost.toFixed(2)}</strong>.
            `;
            successAlert.classList.remove("d-none");
            successAlert.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        // Refresh slots in current zone so slot immediately displays as "Reserved"
        if (currentActiveZone) {
            await handleViewSlots(
                currentActiveZone.zone_id,
                currentActiveZone.location_name,
                document.getElementById(`zone-row-${currentActiveZone.zone_id}`)
            );
        }

    } catch (error) {
        console.error("Reservation submission error:", error);
        if (modalFormError) {
            modalFormError.textContent = `Reservation failed: ${error.message}`;
            modalFormError.classList.remove("d-none");
        }
    } finally {
        confirmBtn.disabled = false;
        if (confirmBtnSpinner) confirmBtnSpinner.classList.add("d-none");
        if (confirmBtnIcon) confirmBtnIcon.classList.remove("d-none");
        if (confirmBtnText) confirmBtnText.textContent = "Confirm Reservation";
    }
}

/**
 * formatDateTimeLocal(date)
 * Converts a JavaScript Date object into the string format required by HTML5 `<input type="datetime-local">` (YYYY-MM-DDTHH:mm).
 * 
 * @param {Date} date - JS Date object
 * @returns {string} Formatted datetime string
 */
function formatDateTimeLocal(date) {
    const pad = n => String(n).padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * formatDisplayDateTime(isoStr)
 * Formats ISO date string into readable user friendly format.
 * 
 * @param {string} isoStr - Date string
 * @returns {string} Human readable date string
 */
function formatDisplayDateTime(isoStr) {
    try {
        const d = new Date(isoStr);
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " +
               d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch {
        return isoStr;
    }
}

/**
 * hideSlotsSection()
 * Closes the slots detail section and unhighlights any selected zone rows.
 */
function hideSlotsSection() {
    const slotsSection = document.getElementById("slotsSection");
    if (slotsSection) {
        slotsSection.classList.add("d-none");
    }
    // Remove highlight from all table rows
    document.querySelectorAll("#zonesTableBody tr").forEach(row => {
        row.classList.remove("table-active-zone");
    });
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
