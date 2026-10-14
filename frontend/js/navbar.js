/**
 * ==============================================================================
 * Smart City Parking & E-Challan System - Shared Navbar & Auth Guard (navbar.js)
 * ==============================================================================
 * 
 * VIVA EXPLANATION / ARCHITECTURAL ROLE:
 * - What is this file's responsibility?
 *   1. Shared UI Component:
 *      Dynamically generates and injects the Bootstrap navbar across all pages
 *      so navigation markup is never duplicated.
 *   2. Role-Based Navigation (RBAC):
 *      - Citizens see ONLY citizen routes: "Parking Zones" (zones.html) and "E-Challans" (tickets.html).
 *      - Admins see ONLY admin routes: "Admin Console" (admin.html).
 *      - Shows the logged-in user's `first_name` and role badge.
 *   3. Route Protection Guard (Auth Guard):
 *      - If an unauthenticated user opens any protected page (zones, tickets, admin),
 *        they are instantly redirected to `index.html`.
 *      - If a citizen attempts to visit `admin.html`, access is denied and redirected.
 *   4. Logout Handler:
 *      - Clears user credentials from browser `localStorage` and returns to `index.html`.
 * ==============================================================================
 */

// -----------------------------------------------------------------------------
// 1. AUTHENTICATION & ROUTE GUARD (Runs Immediately on Script Evaluation)
// -----------------------------------------------------------------------------
(function runAuthGuard() {
    const user = getAuthUser();
    const currentPage = getCurrentPageName();

    // Landing page (index.html) is publicly accessible
    if (currentPage === "index.html" || currentPage === "") {
        return;
    }

    // Rule: If someone opens a page without being logged in, redirect to index.html
    if (!user) {
        console.warn("[Auth Guard] Unauthenticated access detected. Redirecting to index.html");
        window.location.href = "index.html";
        return;
    }

    // Role-based privilege guard: Only admins can view admin.html
    if (currentPage === "admin.html" && user.role !== "admin") {
        console.warn("[Auth Guard] Non-admin access attempt on admin.html. Redirecting to zones.html");
        alert("Access Restricted: Administrator privileges required.");
        window.location.href = "zones.html";
        return;
    }
})();

// Initialize dynamic navbar once DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    renderSharedNavbar();
});

/**
 * getAuthUser()
 * Retrieves the currently authenticated user from browser localStorage.
 * 
 * @returns {Object|null} User object { user_id, first_name, role } or null
 */
function getAuthUser() {
    try {
        const userJson = localStorage.getItem("currentUser");
        if (userJson) {
            return JSON.parse(userJson);
        }
        // Fallback to separate keys
        const role = localStorage.getItem("role");
        const first_name = localStorage.getItem("first_name");
        const user_id = localStorage.getItem("user_id");
        if (role && first_name) {
            return { user_id, first_name, role };
        }
    } catch (e) {
        console.error("Error reading currentUser from localStorage:", e);
    }
    return null;
}

/**
 * getCurrentPageName()
 * Extracts the current page filename from window.location.pathname.
 * 
 * @returns {string} E.g., "index.html", "zones.html", "tickets.html", "admin.html"
 */
function getCurrentPageName() {
    const path = window.location.pathname;
    const page = path.substring(path.lastIndexOf("/") + 1).toLowerCase();
    return page || "index.html";
}

/**
 * renderSharedNavbar()
 * Dynamically builds and injects the Bootstrap navbar based on auth state and role.
 * 
 * Viva Explanation:
 * Dynamic Component Injection Pattern:
 * Evaluates `user.role` from `localStorage` and generates role-tailored navigation:
 * - Admin Role: Renders Admin Console link only.
 * - Citizen Role: Renders Parking Zones and E-Challans links only.
 * - Unauthenticated (Landing page): Renders brand and mode banner.
 */
function renderSharedNavbar() {
    const user = getAuthUser();
    const currentPage = getCurrentPageName();

    // Check if a dedicated container exists, otherwise look for an existing <nav> or prepend to <body>
    let navContainer = document.getElementById("navbarContainer");
    let existingNav = document.querySelector("nav.navbar-custom");

    // Build brand home link
    const homeHref = !user ? "index.html" : (user.role === "admin" ? "admin.html" : "zones.html");

    // Build role-specific navigation menu items
    let navLinksHtml = "";

    if (user && user.role === "admin") {
        // Admin-only navigation links
        navLinksHtml = `
            <li class="nav-item">
                <a class="nav-link ${currentPage === 'admin.html' ? 'active' : ''}" 
                   href="admin.html">
                    <i class="bi bi-shield-lock me-1"></i> Admin Console
                </a>
            </li>
        `;
    } else if (user && user.role === "citizen") {
        // Citizen-only navigation links
        navLinksHtml = `
            <li class="nav-item">
                <a class="nav-link ${currentPage === 'zones.html' ? 'active' : ''}" 
                   href="zones.html">
                    <i class="bi bi-geo-alt-fill me-1"></i> Parking Zones
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link ${currentPage === 'tickets.html' ? 'active' : ''}" 
                   href="tickets.html">
                    <i class="bi bi-receipt me-1"></i> E-Challans
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link ${currentPage === 'vehicles.html' ? 'active' : ''}" 
                   href="vehicles.html">
                    <i class="bi bi-car-front-fill me-1"></i> My Vehicles
                </a>
            </li>
        `;
    }

    // Build user profile & logout action section
    let userSectionHtml = "";

    if (user) {
        userSectionHtml = `
            <div class="d-flex flex-column flex-lg-row align-items-lg-center gap-2 ms-lg-3 mt-3 mt-lg-0">
                <!-- User Profile Badge -->
                <div class="d-flex align-items-center gap-1">
                    <span class="badge bg-light text-dark border px-2 py-1 shadow-sm font-monospace">
                        <i class="bi ${user.role === 'admin' ? 'bi-shield-shaded text-danger' : 'bi-person-circle text-primary'} me-1"></i>
                        <span>${escapeHtml(user.first_name)}</span>
                    </span>
                    <span class="badge ${user.role === 'admin' ? 'bg-danger text-white' : 'bg-info-subtle text-info border'} px-2 py-1">
                        ${user.role === 'admin' ? 'Admin' : 'Citizen'}
                    </span>
                </div>

                <!-- Logout Button -->
                <button class="btn btn-outline-light btn-sm d-flex align-items-center gap-1 shadow-sm" id="logoutBtn" title="Log out and return to landing page">
                    <i class="bi bi-box-arrow-right"></i>
                    <span>Logout</span>
                </button>
            </div>
        `;
    } else {
        // Public indicator on landing page
        userSectionHtml = `
            <div class="d-flex align-items-center ms-lg-3 mt-2 mt-lg-0">
                <span class="badge bg-warning text-dark border border-warning-subtle mock-indicator px-2 py-1 shadow-sm">
                    <i class="bi bi-cpu-fill me-1"></i> USE_MOCK Active
                </span>
            </div>
        `;
    }

    // Assemble complete Bootstrap Navbar HTML
    const navbarMarkup = `
        <nav class="navbar navbar-expand-lg navbar-dark navbar-custom sticky-top" id="mainSharedNav">
            <div class="container">
                <a class="navbar-brand d-flex align-items-center gap-2" href="${homeHref}">
                    <i class="bi bi-p-square-fill text-info fs-4"></i>
                    <span>SmartCity Mobility</span>
                </a>
                
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#sharedNavbarCollapse" aria-controls="sharedNavbarCollapse" aria-expanded="false" aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>

                <div class="collapse navbar-collapse" id="sharedNavbarCollapse">
                    <ul class="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center">
                        ${navLinksHtml}
                    </ul>
                    ${userSectionHtml}
                </div>
            </div>
        </nav>
    `;

    // Inject navbar into DOM
    if (navContainer) {
        navContainer.innerHTML = navbarMarkup;
    } else if (existingNav) {
        existingNav.outerHTML = navbarMarkup;
    } else {
        document.body.insertAdjacentHTML("afterbegin", navbarMarkup);
    }

    // Attach click listener to Logout button
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", handleLogout);
    }
}

/**
 * handleLogout()
 * Clears user session credentials from browser localStorage and redirects to landing page.
 * 
 * Viva Explanation:
 * State Termination:
 * Removes keys `currentUser`, `user_id`, `first_name`, and `role`, completely terminating
 * the active session, then sends the user back to `index.html`.
 */
function handleLogout() {
    console.log("[Auth] User logged out. Clearing localStorage.");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("user_id");
    localStorage.removeItem("first_name");
    localStorage.removeItem("role");
    window.location.href = "index.html";
}

/**
 * escapeHtml(str)
 * Sanitizes strings before injecting them into HTML to prevent XSS (Cross-Site Scripting) attacks.
 * 
 * @param {string} str - Raw text string
 * @returns {string} Sanitized string
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
