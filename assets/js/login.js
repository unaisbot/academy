
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

const loginTitle = document.getElementById("loginTitle");
const loginDescription = document.getElementById("loginDescription");
const loginLabel = document.getElementById("loginLabel");
const loginSecureNote = document.getElementById("loginSecureNote");

// Identify the requested login mode
const params = new URLSearchParams(window.location.search);

const adminMode = params.get("admin") === "1";
const selectedCourseId = params.get("course");

// Configure the login page
function showMessage(message) {
  loginMessage.textContent = message;
}

if (adminMode && !selectedCourseId) {

  loginLabel.textContent = "ADMINISTRATION";
  loginTitle.textContent = "Admin Login";
  loginDescription.textContent =
    "Sign in using your authorised administrator Google account.";

  loginSecureNote.textContent =
    "Only authorised TBARC Academy administrators can access the dashboard.";

} else if (!adminMode && selectedCourseId) {

  loginLabel.textContent = "PARTICIPANT AREA";
  loginTitle.textContent = "Welcome back";
  loginDescription.textContent =
    "Sign in using the Google account registered for this course.";

  loginSecureNote.textContent =
    "Only approved participants enrolled in this course can access its content.";

} else {

  loginLabel.textContent = "LOGIN REQUIRED";
  loginTitle.textContent = "Invalid login link";
  loginDescription.textContent =
    "Please return to the TBARC Academy homepage and select a valid login option.";

  loginSecureNote.textContent = "";

  googleSignIn.disabled = true;
  showMessage("Please select a course or use the administrator login.");
}


// Google sign-in
googleSignIn.addEventListener("click", async () => {

  if (!adminMode && !selectedCourseId) {
    showMessage("Invalid login request. Please return to the homepage.");
    return;
  }

  googleSignIn.disabled = true;
  showMessage("Signing in with Google…");

  try {

    await setPersistence(auth, browserLocalPersistence);

    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    const signedInEmail = (user.email || "").trim().toLowerCase();

    // Check administrator account
    const adminSnap = await getDoc(
      doc(db, "admins", user.uid)
    );

    const isAdmin =
      adminSnap.exists() &&
      adminSnap.data().role === "admin";


    // ADMIN LOGIN MODE
    if (adminMode) {

      if (!isAdmin) {
        showMessage(
          "Administrator access denied. This Google account is not authorised."
        );

        await signOut(auth);
        return;
      }

      showMessage("Administrator verified. Opening dashboard…");

      window.location.replace("dashboard.html");
      return;
    }


    // PARTICIPANT LOGIN MODE

    // Administrators must use the admin login route
    if (isAdmin) {

      showMessage(
        "This is an administrator account. Please use the Admin Login option."
      );

      await signOut(auth);
      return;
    }


    // Verify that the selected course exists and is published
    const courseSnap = await getDoc(
      doc(db, "courses", selectedCourseId)
    );

    if (!courseSnap.exists() || courseSnap.data().published !== true) {

      showMessage(
        "This course is currently unavailable. Please return to the courses page."
      );

      await signOut(auth);
      return;
    }


    // Verify participant record
    const participantSnap = await getDoc(
      doc(db, "participants", user.uid)
    );

    if (!participantSnap.exists()) {

      showMessage(
        "You are not registered as a participant. Kindly contact the administrator."
      );

      await signOut(auth);
      return;
    }

    const participant = participantSnap.data();


    // Verify registered email
    const registeredEmail =
      (participant.email || "").trim().toLowerCase();

    if (
      !registeredEmail ||
      registeredEmail !== signedInEmail
    ) {

      showMessage(
        "The Google account does not match your registered email address."
      );

      await signOut(auth);
      return;
    }


    // Verify selected course against participant assignment
    const assignedCourseId = participant.courseId;

    if (!assignedCourseId) {

      showMessage(
        "No course has been assigned to your account. Please contact the administrator."
      );

      await signOut(auth);
      return;
    }

    if (assignedCourseId !== selectedCourseId) {

      showMessage(
        "You are not enrolled in this course. Please select the course assigned to your account."
      );

      await signOut(auth);
      return;
    }


    // Verify approved enrollment
    const enrollmentSnap = await getDoc(
      doc(db, "enrollments", `${user.uid}_${selectedCourseId}`)
    );

    if (!enrollmentSnap.exists()) {

      showMessage(
        "Your course enrollment could not be verified. Please contact the administrator."
      );

      await signOut(auth);
      return;
    }

    const enrollment = enrollmentSnap.data();

    const enrollmentEmail =
      (enrollment.email || "").trim().toLowerCase();

    if (
      enrollment.status !== "approved" ||
      enrollmentEmail !== signedInEmail
    ) {

      showMessage(
        "Your enrollment is not approved. Please contact the administrator."
      );

      await signOut(auth);
      return;
    }


    // Successful participant login
    showMessage("Access verified. Opening your course…");

    window.location.replace("my-course.html");

  } catch (error) {

    console.error("Login error:", error);

    if (error.code === "auth/popup-closed-by-user") {
      showMessage("Sign-in was cancelled. Please try again.");
    } else {
      showMessage(
        error.message || "Sign-in failed. Please try again."
      );
    }

  } finally {

    googleSignIn.disabled = false;

  }

});
