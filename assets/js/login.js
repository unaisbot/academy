import {
  signInWithRedirect,
  getRedirectResult
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import { auth, googleProvider } from "./firebase.js";

const button = document.getElementById("googleSignIn");
const message = document.getElementById("loginMessage");

function showMessage(text) {
  if (message) message.textContent = text;
}

function showError(error) {
  console.error("TBARC Academy Google sign-in error:", error);
  const messages = {
    "auth/unauthorized-domain": "This website domain is not authorized in Firebase Authentication. Add unaisbot.github.io under Authentication → Settings → Authorized domains.",
    "auth/operation-not-allowed": "Google sign-in is not enabled in Firebase Authentication.",
    "auth/network-request-failed": "Network connection failed. Check your internet connection and try again.",
    "auth/invalid-api-key": "Firebase API key is invalid. Check assets/js/firebase-config.js.",
    "auth/too-many-requests": "Too many sign-in attempts. Please wait and try again."
  };
  showMessage(messages[error.code] || `${error.code || "Sign-in error"}: ${error.message || "Please try again."}`);
  if (button) button.disabled = false;
}

if (button) {
  button.addEventListener("click", async () => {
    button.disabled = true;
    showMessage("Redirecting to Google sign-in…");
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      showError(error);
    }
  });
}

try {
  showMessage("Checking sign-in…");
  const result = await getRedirectResult(auth);
  if (result?.user) {
    showMessage("Sign-in successful. Opening your dashboard…");
    window.location.replace("dashboard.html");
  } else {
    showMessage("");
  }
} catch (error) {
  showError(error);
}
