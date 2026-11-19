
import {
  signInWithPopup,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import { auth, googleProvider, db } from "./firebase.js";

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

async function checkUserAccess(user) {
  showMessage("Checking your account and course access…");

  // 1. Check administrator access
  const adminRef = doc(db, "admins", user.uid);
  const adminSnap = await getDoc(adminRef);

  if (adminSnap.exists() && adminSnap.data().role === "admin") {
    showMessage("Administrator verified. Opening dashboard…");
    window.location.replace("dashboard.html");
    return;
  }

  // 2. Check participant record
  const participantRef = doc(db, "participants", user.uid);
  const participantSnap = await getDoc(participantRef);

  if (!participantSnap.exists()) {
    showMessage(
      "You have no access to the content. Kindly contact the administrator."
    );
    button.disabled = false;
    return;
  }

  const participant = participantSnap.data();
  const courseId = participant.courseId;

  if (!courseId) {
    showMessage(
      "You have no access to the content. Kindly contact the administrator."
    );
    button.disabled = false;
    return;
  }

  // 3. Check approved enrollment
  const enrollmentId = `${user.uid}_${courseId}`;
  const enrollmentRef = doc(db, "enrollments", enrollmentId);
  const enrollmentSnap = await getDoc(enrollmentRef);

  if (
    !enrollmentSnap.exists() ||
    enrollmentSnap.data().status !== "approved"
  ) {
    showMessage(
      "You have no access to the content. Kindly contact the administrator."
    );
    button.disabled = false;
    return;
  }

  // 4. Participant access confirmed
  showMessage("Access approved. Opening your course…");
  window.location.replace("my-course.html");
}

if (button) {
  button.addEventListener("click", async () => {
    button.disabled = true;
    showMessage("Connecting to Google…");

    try {
      await setPersistence(auth, browserLocalPersistence);

      const result = await signInWithPopup(auth, googleProvider);

      if (result.user) {
        await checkUserAccess(result.user);
      }

    } catch (error) {
      showError(error);
    }
  });
}
