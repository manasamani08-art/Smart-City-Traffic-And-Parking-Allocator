/**
 * ==============================================================================
 * Smart City Parking & E-Challan System - Index / Auth Controller (index.js)
 * ==============================================================================
 * 
 * VIVA EXPLANATION / ARCHITECTURAL ROLE:
 * - What is this file's responsibility?
 *   Controls landing page authentication and registration:
 *   1. Phone-Only Login:
 *      - Matches requirements: The USERS database table does not store passwords.
 *      - Validates 10-digit mobile number format.
 *      - Calls `api.loginUser(phone)` (strictly via API layer).
 *      - On success: saves `user_id`, `first_name`, and `role` to `localStorage`.
 *      - Role-Based Redirection:
 *        - `role === "admin"`   &rarr; redirects to `admin.html`.
 *        - `role === "citizen"` &rarr; redirects to `zones.html`.
 *      - On failure: displays "User not found" Bootstrap alert.
 *   2. Citizen Registration:
 *      - Form fields: `first_name`, `middle_name`, `last_name`, `phone`, `dl_no`, `gmail`.
 *      - Validates each field with native Bootstrap feedback.
 *      - Calls `api.registerUser(data)` and transitions to login tab upon completion.
 * 
 * - KEY VIVA RULE: Separation of Concerns (SoC)
 *   Page files must NEVER call `fetch()` directly. All data access goes through `js/api.js`.
 * ==============================================================================
 */

// Wait until DOM is parsed
document.addEventListener("DOMContentLoaded", () => {
    initIndexPage();
});

/**
 * initIndexPage()
 * Initializes authentication forms and binds event listeners.
 */
function initIndexPage() {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const loginPhoneInput = document.getElementById("loginPhone");

    // Check if user is already logged in; if so, offer quick portal redirect
    checkExistingSession();

    // 1. Login Form Submit Listener
    if (loginForm) {
        loginForm.addEventListener("submit", handleLoginSubmit);
    }

    // 2. Register Form Submit Listener
    if (registerForm) {
        registerForm.addEventListener("submit", handleRegisterSubmit);
    }

    // 3. Quick-Fill Demo Helper Buttons
    document.querySelectorAll(".demo-fill-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const phone = btn.getAttribute("data-phone");
            if (loginPhoneInput) {
                loginPhoneInput.value = phone;
                loginPhoneInput.classList.remove("is-invalid");
                loginPhoneInput.classList.add("is-valid");
            }
            const loginAlert = document.getElementById("loginAlert");
            if (loginAlert) loginAlert.classList.add("d-none");
        });
    });
}

/**
 * checkExistingSession()
 * Checks if a session is currently active in localStorage.
 * If user is already authenticated, redirects them directly to their role portal.
 */
function checkExistingSession() {
    try {
        const userJson = localStorage.getItem("currentUser");
        if (userJson) {
            const user = JSON.parse(userJson);
            if (user && user.role) {
                console.log(`[Auth] Existing session active for ${user.first_name} (${user.role}).`);
                // If query param ?logout=true was passed, don't redirect
                const urlParams = new URLSearchParams(window.location.search);
                if (!urlParams.has("logout")) {
                    window.location.href = user.role === "admin" ? "admin.html" : "zones.html";
                }
            }
        }
    } catch (e) {
        console.error("Session check error:", e);
    }
}

/**
 * handleLoginSubmit(event)
 * Validates 10-digit phone number, calls api.loginUser(phone), saves to localStorage, and redirects.
 * 
 * Viva Explanation / Flow:
 * 1. `event.preventDefault()`: Stops default form navigation.
 * 2. Regex Validation: `/^\d{10}$/` verifies exactly 10 numeric digits.
 * 3. Calls `api.loginUser(phone)`:
 *    - In mock mode: checks `MOCK_USERS`.
 *    - In live mode: sends `POST /users/login`.
 * 4. Stores session in `localStorage`:
 *    `localStorage.setItem('user_id', ...)`
 *    `localStorage.setItem('first_name', ...)`
 *    `localStorage.setItem('role', ...)`
 * 5. Role Redirection:
 *    - Admin: `admin.html`
 *    - Citizen: `zones.html`
 * 
 * @param {Event} event - Submit event
 */
async function handleLoginSubmit(event) {
    event.preventDefault();

    const phoneInput = document.getElementById("loginPhone");
    const phoneError = document.getElementById("loginPhoneError");
    const loginAlert = document.getElementById("loginAlert");
    const loginAlertMessage = document.getElementById("loginAlertMessage");
    const submitBtn = document.getElementById("loginSubmitBtn");
    const spinner = document.getElementById("loginSpinner");
    const icon = document.getElementById("loginIcon");

    const phoneVal = phoneInput ? phoneInput.value.trim() : "";

    // Validate 10-digit numeric phone number
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phoneVal)) {
        if (phoneInput) {
            phoneInput.classList.add("is-invalid");
            phoneInput.classList.remove("is-valid");
        }
        if (phoneError) {
            phoneError.textContent = "Please enter a valid 10-digit mobile number (digits only).";
        }
        return;
    } else {
        if (phoneInput) {
            phoneInput.classList.remove("is-invalid");
            phoneInput.classList.add("is-valid");
        }
    }

    // Set UI loading state
    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.classList.remove("d-none");
    if (icon) icon.classList.add("d-none");
    if (loginAlert) loginAlert.classList.add("d-none");

    try {
        // STRICT RULE: Never call fetch() directly. Use centralized API service.
        const result = await api.loginUser(phoneVal);

        if (result && result.user) {
            const user = result.user;

            // Save user details to browser localStorage as required by Step 6
            localStorage.setItem("user_id", user.user_id);
            localStorage.setItem("first_name", user.first_name);
            localStorage.setItem("role", user.role);
            localStorage.setItem("currentUser", JSON.stringify(user));

            console.log(`[Auth Success] Logged in as ${user.first_name} (${user.role}). Redirecting...`);

            // Role-Based Redirection:
            // Admin -> admin.html, Citizen -> zones.html
            if (user.role === "admin") {
                window.location.href = "admin.html";
            } else {
                window.location.href = "zones.html";
            }
        } else {
            throw new Error("Invalid response from login service.");
        }

    } catch (error) {
        console.warn("[Auth Failed]", error.message);
        if (loginAlert && loginAlertMessage) {
            loginAlertMessage.textContent = error.message || "User not found with this phone number.";
            loginAlert.classList.remove("d-none");
        }
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (spinner) spinner.classList.add("d-none");
        if (icon) icon.classList.remove("d-none");
    }
}

/**
 * handleRegisterSubmit(event)
 * Validates registration form fields and calls api.registerUser(data).
 * 
 * Fields:
 * - first_name (required)
 * - middle_name (optional)
 * - last_name (required)
 * - phone (required, 10 digits)
 * - dl_no (required)
 * - gmail (required, valid email format)
 * 
 * @param {Event} event - Submit event
 */
async function handleRegisterSubmit(event) {
    event.preventDefault();

    const firstNameInput = document.getElementById("regFirstName");
    const middleNameInput = document.getElementById("regMiddleName");
    const lastNameInput = document.getElementById("regLastName");
    const phoneInput = document.getElementById("regPhone");
    const dlNoInput = document.getElementById("regDlNo");
    const gmailInput = document.getElementById("regGmail");

    const registerAlert = document.getElementById("registerAlert");
    const registerAlertMsg = document.getElementById("registerAlertMsg");
    const registerSuccessAlert = document.getElementById("registerSuccessAlert");
    const registerSuccessMsg = document.getElementById("registerSuccessMsg");
    const submitBtn = document.getElementById("registerSubmitBtn");
    const spinner = document.getElementById("registerSpinner");
    const icon = document.getElementById("registerIcon");

    let isValid = true;

    // 1. First Name (Required)
    if (!firstNameInput.value.trim()) {
        firstNameInput.classList.add("is-invalid");
        firstNameInput.classList.remove("is-valid");
        isValid = false;
    } else {
        firstNameInput.classList.remove("is-invalid");
        firstNameInput.classList.add("is-valid");
    }

    // 2. Middle Name (Optional - no validation needed)

    // 3. Last Name (Required)
    if (!lastNameInput.value.trim()) {
        lastNameInput.classList.add("is-invalid");
        lastNameInput.classList.remove("is-valid");
        isValid = false;
    } else {
        lastNameInput.classList.remove("is-invalid");
        lastNameInput.classList.add("is-valid");
    }

    // 4. Phone (Required, exactly 10 digits)
    const phoneVal = phoneInput.value.trim();
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phoneVal)) {
        phoneInput.classList.add("is-invalid");
        phoneInput.classList.remove("is-valid");
        isValid = false;
    } else {
        phoneInput.classList.remove("is-invalid");
        phoneInput.classList.add("is-valid");
    }

    // 5. DL Number (Required)
    if (!dlNoInput.value.trim()) {
        dlNoInput.classList.add("is-invalid");
        dlNoInput.classList.remove("is-valid");
        isValid = false;
    } else {
        dlNoInput.classList.remove("is-invalid");
        dlNoInput.classList.add("is-valid");
    }

    // 6. Gmail / Email (Required, valid email format)
    const gmailVal = gmailInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(gmailVal)) {
        gmailInput.classList.add("is-invalid");
        gmailInput.classList.remove("is-valid");
        isValid = false;
    } else {
        gmailInput.classList.remove("is-invalid");
        gmailInput.classList.add("is-valid");
    }

    if (!isValid) {
        if (registerAlert) {
            registerAlertMsg.textContent = "Please fill in all required fields with valid values.";
            registerAlert.classList.remove("d-none");
        }
        return;
    }

    // Prepare payload matching DBMS relational attributes
    const registrationData = {
        first_name: firstNameInput.value.trim(),
        middle_name: middleNameInput.value.trim(),
        last_name: lastNameInput.value.trim(),
        phone: phoneVal,
        dl_no: dlNoInput.value.trim(),
        gmail: gmailVal
    };

    // Set UI loading state
    submitBtn.disabled = true;
    if (spinner) spinner.classList.remove("d-none");
    if (icon) icon.classList.add("d-none");
    if (registerAlert) registerAlert.classList.add("d-none");
    if (registerSuccessAlert) registerSuccessAlert.classList.add("d-none");

    try {
        // STRICT RULE: Call centralized API service (NO direct fetch() call!)
        const result = await api.registerUser(registrationData);

        // Show registration success banner
        if (registerSuccessAlert && registerSuccessMsg) {
            registerSuccessMsg.textContent = `Account created successfully for ${registrationData.first_name}! You can now sign in with your phone number (${registrationData.phone}).`;
            registerSuccessAlert.classList.remove("d-none");
        }

        // Pre-fill login phone input and switch tabs
        const loginPhoneInput = document.getElementById("loginPhone");
        if (loginPhoneInput) {
            loginPhoneInput.value = registrationData.phone;
        }

        // Switch automatically to Login tab using Bootstrap Tab API
        const loginTabBtn = document.getElementById("login-tab");
        if (loginTabBtn) {
            const tabInstance = bootstrap.Tab.getOrCreateInstance(loginTabBtn);
            tabInstance.show();
        }

        // Reset registration form
        document.getElementById("registerForm").reset();
        [firstNameInput, lastNameInput, phoneInput, dlNoInput, gmailInput].forEach(inp => {
            inp.classList.remove("is-valid", "is-invalid");
        });

    } catch (error) {
        console.error("Registration failed:", error);
        if (registerAlert && registerAlertMsg) {
            registerAlertMsg.textContent = error.message || "Registration could not be completed.";
            registerAlert.classList.remove("d-none");
        }
    } finally {
        submitBtn.disabled = false;
        if (spinner) spinner.classList.add("d-none");
        if (icon) icon.classList.remove("d-none");
    }
}
