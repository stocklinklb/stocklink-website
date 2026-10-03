const statusEl = document.getElementById("verification-status");
const messageEl = document.getElementById("verification-message");
const loginLink = document.getElementById("verification-login-link");

async function verifyEmail() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  // Remove the token from the visible URL immediately.
  history.replaceState(null, "", window.location.pathname);

  if (!token) {
    statusEl.textContent = "Verification link is invalid";
    messageEl.textContent =
      "This verification link is missing the required token.";

    loginLink.hidden = false;
    return;
  }

  statusEl.textContent = "Verifying...";
  messageEl.textContent =
    "Please wait while we verify your email address.";

  try {
    const response = await fetch(`${API_ROOT}/auth/verify-email`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      statusEl.textContent = "Email verified!";
      messageEl.textContent =
        "Your email has been successfully verified. You can now log in.";

      loginLink.hidden = false;
      return;
    }

    statusEl.textContent = "Verification failed";
    messageEl.textContent =
      data.message ||
      "This verification link is invalid or has expired.";

    loginLink.hidden = false;
  } catch (error) {
    console.error("Email verification error:", error);

    statusEl.textContent = "Something went wrong";
    messageEl.textContent =
      "We couldn't connect to the server. Please try again later.";

    loginLink.hidden = false;
  }
}

verifyEmail();