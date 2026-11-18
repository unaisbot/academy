import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

const statusEl = document.getElementById("dashboardStatus");
const identityEl = document.getElementById("identity");
const coursesEl = document.getElementById("myCourses");
const signOutButton = document.getElementById("signOut");

signOutButton?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  identityEl.textContent = `${user.displayName || "Participant"} · ${user.email || ""}`;
  statusEl.textContent = "Checking your course access…";

  try {
    const adminSnap = await getDoc(doc(db, "admins", user.uid));
    if (adminSnap.exists()) {
      statusEl.textContent = "Administrator account";
      coursesEl.innerHTML = '<div class="notice"><strong>Administrator access confirmed</strong><p>Your admin tools will be added in the next development stage.</p></div>';
      return;
    }

    const enrollmentsQuery = query(collection(db, "enrollments"), where("uid", "==", user.uid));
    const enrollmentSnap = await getDocs(enrollmentsQuery);
    const now = Date.now();
    const active = enrollmentSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(e => e.status === "approved" && e.accessExpiry?.toMillis && e.accessExpiry.toMillis() > now);

    if (!active.length) {
      statusEl.textContent = "No active course access found";
      coursesEl.innerHTML = '<div class="notice"><strong>Your account is signed in, but no active enrollment is linked to it.</strong><p>Please contact the TBARC Academy administrator if you have registered for a course. Access is granted only after approval.</p></div>';
      return;
    }

    statusEl.textContent = "Your approved courses";
    coursesEl.innerHTML = "";
    for (const enrollment of active) {
      const courseSnap = await getDoc(doc(db, "courses", enrollment.courseId));
      const course = courseSnap.exists() ? courseSnap.data() : null;
      const card = document.createElement("article");
      card.className = "course-card";
      const title = document.createElement("h3");
      title.textContent = course?.title || enrollment.courseId || "Enrolled course";
      const detail = document.createElement("p");
      detail.textContent = `Access expires: ${enrollment.accessExpiry.toDate().toLocaleDateString()}`;
      card.append(title, detail);
      coursesEl.append(card);
    }
  } catch (error) {
    console.error(error);
    statusEl.textContent = "Unable to verify access";
    coursesEl.innerHTML = '<div class="notice"><strong>We could not check your enrollment.</strong><p>Please try again later or contact the administrator.</p></div>';
  }
});
