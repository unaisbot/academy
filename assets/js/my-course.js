
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";

const accessMessage = document.getElementById("accessMessage");
const courseContent = document.getElementById("courseContent");
const moduleList = document.getElementById("moduleList");

function showAccessMessage(message) {
  accessMessage.hidden = false;
  accessMessage.textContent = message;
  courseContent.hidden = true;
}

function showError(message) {
  showAccessMessage(message);
}

document.getElementById("signOut")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.replace("login.html");
});

async function loadParticipantCourse(user) {
  try {
    document.getElementById("participantIdentity").textContent =
      user.displayName || user.email || "Participant";

    // Read participant record
    const participantRef = doc(db, "participants", user.uid);
    const participantSnap = await getDoc(participantRef);

    if (!participantSnap.exists()) {
      showError("You have no access to the content. Kindly contact the administrator.");
      return;
    }

    const participant = participantSnap.data();
    const courseId = participant.courseId;

    if (!courseId) {
      showError("You have no access to the content. Kindly contact the administrator.");
      return;
    }

    // Verify enrollment
    const enrollmentId = `${user.uid}_${courseId}`;
    const enrollmentRef = doc(db, "enrollments", enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentRef);

    if (!enrollmentSnap.exists() ||
        enrollmentSnap.data().status !== "approved") {
      showError("You have no access to the content. Kindly contact the administrator.");
      return;
    }

    // Load assigned course
    const courseRef = doc(db, "courses", courseId);
    const courseSnap = await getDoc(courseRef);

    if (!courseSnap.exists() || courseSnap.data().published !== true) {
      showError("Your assigned course is currently unavailable.");
      return;
    }

    const course = courseSnap.data();

    document.getElementById("courseTitle").textContent =
      course.title || "Untitled course";

    document.getElementById("courseDescription").textContent =
      course.description || "";

    // Load published modules
    const modulesQuery = query(
      collection(db, "modules"),
      where("courseId", "==", courseId),
      where("published", "==", true)
    );

    const modulesSnap = await getDocs(modulesQuery);

    moduleList.replaceChildren();

    if (modulesSnap.empty) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No learning modules are available yet.";
      moduleList.appendChild(empty);
    } else {
      const modules = modulesSnap.docs.map(item => ({
        id: item.id,
        ...item.data()
      }));

      modules.sort((a, b) => (a.order || 0) - (b.order || 0));

      for (const module of modules) {
        const item = document.createElement("article");
        item.className = "module-item";

        const title = document.createElement("h3");
        title.textContent = module.title || "Untitled module";

        const description = document.createElement("p");
        description.textContent = module.description || "";

        item.append(title, description);

        if (module.videoUrl) {
          const link = document.createElement("a");
          link.href = module.videoUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.className = "button button-dark";
          link.textContent = "Open learning video";
          item.appendChild(link);
        }

        moduleList.appendChild(item);
      }
    }

    accessMessage.hidden = true;
    courseContent.hidden = false;

  } catch (error) {
    console.error("Participant access error:", error);

    showError(
      "Unable to verify your course access. Please try again or contact the administrator."
    );
  }
}

// Authentication check
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  // Administrators should use the admin dashboard
  try {
    const adminRef = doc(db, "admins", user.uid);
    const adminSnap = await getDoc(adminRef);

    if (adminSnap.exists() && adminSnap.data().role === "admin") {
      window.location.replace("dashboard.html");
      return;
    }

    await loadParticipantCourse(user);

  } catch (error) {
    console.error(error);
    showError("Unable to verify your account. Please try again.");
  }
});
