
import {
  signInWithPopup,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import { auth, googleProvider } from "./firebase.js";

const button = document.getElementById("googleSignIn");
const message = document.getElementById("loginMessage");

function showMessage(text) {
  if (message) message.textContent = text;
}

function showError(error) {
  console.error("TBARC Academy login error:", error);

  const messages = {
    "auth/popup-blocked":
      "Google login popup was blocked. Allow popups for this website.",
    "auth/popup-closed-by-user":
      "Google login popup was closed before completing sign-in.",
    "auth/unauthorized-domain":
      "This domain is not authorized in Firebase Authentication.",
    "auth/operation-not-allowed":
      "Google sign-in is not enabled in Firebase.",
    "auth/network-request-failed":
      "Network connection failed. Please try again.",
    "auth/too-many-requests":
      "Too many attempts. Please wait and try again."
  };

  showMessage(
    messages[error.code] ||
    `${error.code || "Login error"}: ${error.message || "Please try again."}`
  );

  if (button) button.disabled = false;
}

if (button) {
  button.addEventListener("click", async () => {
    button.disabled = true;
    showMessage("Connecting to Google…");

    try {
      await setPersistence(auth, browserLocalPersistence);

      const result = await signInWithPopup(auth, googleProvider);

      if (result.user) {
        showMessage("Login successful. Opening dashboard…");
        window.location.replace("dashboard.html");
      }
    } catch (error) {
      showError(error);
    }
  });
}
