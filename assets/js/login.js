
import {
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
  auth,
  db,
  googleProvider
} from "./firebase.js";

const googleSignIn = document.getElementById("googleSignIn");
const loginMessage = document.getElementById("loginMessage");

function showMessage(message) {
  loginMessage.textContent = message;
}

googleSignIn.addEventListener("click", async () => {
  googleSignIn.disabled = true;
  showMessage("Signing in with Google…");

  try {
    await setPersistence(auth, browserLocalPersistence);

    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Check administrator access
    const adminSnap = await getDoc(
      doc(db, "admins", user.uid)
    );

    if (
      adminSnap.exists() &&
      adminSnap.data().role === "admin"
    ) {
      window.location.replace("dashboard.html");
      return;
    }

    // Check participant record
    const participantSnap = await getDoc(
      doc(db, "participants", user.uid)
    );

    if (!participantSnap.exists()) {
      showMessage(
        "You have no access to the content. Kindly contact the administrator."
      );
      await signOut(auth);
      return;
    }

    const participant = participantSnap.data();
    const courseId = participant.courseId;

    if (!courseId) {
      showMessage(
        "You have no access to the content. Kindly contact the administrator."
      );
      await signOut(auth);
      return;
    }

    // Check enrollment approval
    const enrollmentSnap = await getDoc(
      doc(db, "enrollments", `${user.uid}_${courseId}`)
    );

    if (
      !enrollmentSnap.exists() ||
      enrollmentSnap.data().status !== "approved"
    ) {
      showMessage(
        "You have no access to the content. Kindly contact the administrator."
      );
      await signOut(auth);
      return;
    }

    // Approved participant
    window.location.replace("my-course.html");

  } catch (error) {
    console.error("Login error:", error);

    showMessage(
      error.message || "Sign-in failed. Please try again."
    );

  } finally {
    googleSignIn.disabled = false;
  }
});
