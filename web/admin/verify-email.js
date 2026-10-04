const cardEl = document.querySelector(".verification-card");
const eyebrowEl = document.getElementById("verification-eyebrow");
const statusEl = document.getElementById("verification-status");
const messageEl = document.getElementById("verification-message");
const loginLink = document.getElementById("verification-login-link");
const retryButton = document.getElementById("verification-retry");

// Kept in memory so "Try again" still works after the URL is cleaned.
let verificationToken = null;

/**
 * Switches the whole page between its three looks.
 * The colours/icon come from CSS via body[data-state]:
 *   verifying (blue) | verified (green) | failed (red)
 */
function setState(state, { eyebrow, title, message, docTitle, showLogin = false, showRetry = false }) {
  document.body.dataset.state = state;
  cardEl.setAttribute("aria-busy", String(state === "verifying"));

  eyebrowEl.textContent = eyebrow;
  statusEl.textContent = title;
  messageEl.textContent = message;
  document.title = docTitle;

  loginLink.hidden = !showLogin;
  retryButton.hidden = !showRetry;
  retryButton.disabled = false;
}

function showVerifying() {
  setState("verifying", {
    eyebrow: "StockLink",
    title: "Verifying your email...",
    message: "Please wait while we verify your email address.",
    docTitle: "Verifying your email — StockLink",
  });
}

function showVerified() {
  setState("verified", {
    eyebrow: "Verified",
    title: "Email verified! Taking you to set up your store...",
    message: "Your email has been successfully verified. You're signed in.",
    docTitle: "Email verified — StockLink",
    showLogin: true,
  });
}

function showVerifiedFailedRedirect() {
  setState("verified", {
    eyebrow: "Verified",
    title: "Email verified! Click the login button to continue setting up your store.",
    message: "Your email has been successfully verified. You can now log in.",
    docTitle: "Email verified — StockLink",
    showLogin: true,
  });
}

function showFailed({ title, message, canRetry = false }) {
  setState("failed", {
    eyebrow: "Verification failed",
    title,
    message,
    docTitle: "Verification failed — StockLink",
    showLogin: true,
    showRetry: canRetry,
  });
}

async function submitToken(token) {
  showVerifying();

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
      if (data.loggedIn) {
        showVerified();
        setTimeout(() => { window.location.replace("/admin/onboarding.html") }, 1500);
        return
      } else {
        showVerifiedFailedRedirect();
        return;
      }
    }

    showFailed({
      title: "Verification failed",
      message:
        data.message || "This verification link is invalid or has expired.",
    });
  } catch (error) {
    console.error("Email verification error:", error);

    showFailed({
      title: "Something went wrong",
      message: "We couldn't connect to the server. Please try again.",
      canRetry: true,
    });
  }
}

function verifyEmail() {
  const params = new URLSearchParams(window.location.search);
  verificationToken = params.get("token");

  // Remove the token from the visible URL immediately.
  history.replaceState(null, "", window.location.pathname);

  if (!verificationToken) {
    showFailed({
      title: "Verification link is invalid",
      message: "This verification link is missing the required token.",
    });
    return;
  }

  submitToken(verificationToken);
}

retryButton.addEventListener("click", () => {
  if (!verificationToken) return;

  retryButton.disabled = true;
  submitToken(verificationToken);
});

verifyEmail();