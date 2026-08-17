const form = document.getElementById("login-form");
const errorMessage = document.querySelector(".error-message");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const rememberMeCheckbox = document.getElementById("remember-me");
const togglePasswordButton = document.getElementById("toggle-password");

// API_ROOT comes from config.js — make sure it is included on
// login.html BEFORE this script:
//   <script src="config.js"></script>
//   <script src="login.js"></script>

// =========================================================
// SHOW/HIDE PASSWORD
// =========================================================
togglePasswordButton.addEventListener("click", () => {
  const isVisible = passwordInput.type === "text";

  passwordInput.type = isVisible ? "password" : "text";

  togglePasswordButton.setAttribute("aria-pressed", String(!isVisible));
  togglePasswordButton.setAttribute(
    "aria-label",
    isVisible ? "Show password" : "Hide password",
  );
});

// =========================================================
// REMEMBER ME
// =========================================================
// Only the email is persisted, never the password - storing a
// plaintext password in localStorage would be readable by any script
// on the page (or anyone with access to the browser profile).
const REMEMBERED_EMAIL_KEY = "stocklink_remembered_email";

const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
if (rememberedEmail) {
  emailInput.value = rememberedEmail;
  rememberMeCheckbox.checked = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value;
  const password = passwordInput.value;

  errorMessage.textContent = "";

  try {
    const response = await fetch(`${API_ROOT}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      if (rememberMeCheckbox.checked) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }

      console.log("Login successful", data);
      window.location.href = "/admin/index.html";
    } else {
      
      errorMessage.textContent = data.message || "Invalid credentials";
    }
  } catch (error) {
    
    console.error(error);
    errorMessage.textContent = "Server connection failed";
  }
});