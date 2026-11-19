
import {
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import { auth, googleProvider } from "./firebase.js";

const button = document.getElementById("googleSignIn");
const message = document.getElementById("loginMessage");

let redirectCheckFinished = false;
let navigationStarted = false;

function showMessage(text) {
  if (message) message.textContent = text;
}

function openDashboard() {
  if (navigationStarted) return;

  navigationStarted = true;
  showMessage("Login successful. Opening dashboard…");
  window.location.replace("dashboard.html");
}

function showError(error) {
  console.error("TBARC Academy sign-in error:", error);

  const messages = {
    "auth/unauthorized-domain":
      "This domain is not authorized in Firebase Authentication.",
    "auth/operation-not-allowed":
      "Google sign-in is not enabled in Firebase.",
    "auth/network-request-failed":
      "Network connection failed. Please try again.",
    "auth/invalid-api-key":
      "Firebase API key is invalid. Check firebase-config.js.",
    "auth/too-many-requests":
      "Too many attempts. Please wait and try again."
  };

  showMessage(
    messages[error.code] ||
    `${error.code || "Sign-in error"}: ${error.message || "Please try again."}`
  );

  if (button) button.disabled = false;
}

// Detect restored or newly authenticated sessions
onAuthStateChanged(auth, (user) => {
  if (user && redirectCheckFinished) {
    openDashboard();
  }
});

// Check Google redirect result
try {
  showMessage("Checking sign-in…");

  const result = await getRedirectResult(auth);

  redirectCheckFinished = true;

  if (result?.user || auth.currentUser) {
    openDashboard();
  } else {
    showMessage("");
  }
} catch (error) {
  redirectCheckFinished = true;
  showError(error);
}

// Start Google sign-in
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
