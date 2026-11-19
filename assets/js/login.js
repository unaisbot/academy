
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

    // Administrator verification
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

    // Participant verification
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

    // Registered email verification
    const registeredEmail =
      (participant.email || "").trim().toLowerCase();

    const signedInEmail =
      (user.email || "").trim().toLowerCase();

    if (
      !registeredEmail ||
      registeredEmail !== signedInEmail
    ) {
      showMessage(
        "You have no access to the content. Kindly contact the administrator."
      );
      await signOut(auth);
      return;
    }

    const courseId = participant.courseId;

    if (!courseId) {
      showMessage(
        "You have no access to the content. Kindly contact the administrator."
      );
      await signOut(auth);
      return;
    }

    // Enrollment verification
    const enrollmentSnap = await getDoc(
      doc(db, "enrollments", `${user.uid}_${courseId}`)
    );

    if (!enrollmentSnap.exists()) {
      showMessage(
        "You have no access to the content. Kindly contact the administrator."
      );
      await signOut(auth);
      return;
    }

    const enrollment = enrollmentSnap.data();

    if (
      enrollment.status !== "approved" ||
      (enrollment.email || "").trim().toLowerCase() !== signedInEmail
    ) {
      showMessage(
        "You have no access to the content. Kindly contact the administrator."
      );
      await signOut(auth);
      return;
    }

    // Successful participant login
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
