
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

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

function showAccessDenied() {
  accessMessage.hidden = false;
  accessMessage.textContent =
    "You have no access to the content. Kindly contact the administrator.";
  courseContent.hidden = true;
}

function getDriveEmbedUrl(url) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname === "drive.google.com") {
      const match = parsed.pathname.match(/\/file\/d\/([^/]+)/);

      if (match) {
        return `https://drive.google.com/file/d/${match[1]}/preview`;
      }

      const id = parsed.searchParams.get("id");

      if (id) {
        return `https://drive.google.com/file/d/${id}/preview`;
      }
    }

    if (parsed.hostname === "docs.google.com") {
      return url;
    }

    return null;
  } catch {
    return null;
  }
}

function createModuleCard(module) {
  const card = document.createElement("article");
  card.className = "module-card";

  const heading = document.createElement("h3");
  heading.textContent = module.title || "Untitled module";
  card.appendChild(heading);

  if (module.description) {
    const description = document.createElement("p");
    description.textContent = module.description;
    card.appendChild(description);
  }

  const embedUrl = getDriveEmbedUrl(module.videoUrl || "");

  if (embedUrl) {
    const frame = document.createElement("iframe");
    frame.src = embedUrl;
    frame.title = module.title || "Course video";
    frame.loading = "lazy";
    frame.allow = "autoplay; encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    card.appendChild(frame);
  } else {
    const message = document.createElement("p");
    message.textContent = "Video is currently unavailable.";
    card.appendChild(message);
  }

  return card;
}

document.getElementById("signOut")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.replace("login.html");
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  try {
    // Verify administrator
    const adminSnap = await getDoc(doc(db, "admins", user.uid));

    if (adminSnap.exists() && adminSnap.data().role === "admin") {
      window.location.replace("dashboard.html");
      return;
    }

    // Verify participant record
    const participantSnap = await getDoc(
      doc(db, "participants", user.uid)
    );

    if (!participantSnap.exists()) {
      showAccessDenied();
      return;
    }

    const participant = participantSnap.data();

    // Verify registered email matches Google sign-in email
    const registeredEmail = (participant.email || "").trim().toLowerCase();
    const signedInEmail = (user.email || "").trim().toLowerCase();

    if (!registeredEmail || registeredEmail !== signedInEmail) {
      showAccessDenied();
      return;
    }

    const courseId = participant.courseId;

    if (!courseId) {
      showAccessDenied();
      return;
    }

    // Verify enrollment
    const enrollmentSnap = await getDoc(
      doc(db, "enrollments", `${user.uid}_${courseId}`)
    );

    if (
      !enrollmentSnap.exists() ||
      enrollmentSnap.data().status !== "approved" ||
      (enrollmentSnap.data().email || "").trim().toLowerCase() !== signedInEmail
    ) {
      showAccessDenied();
      return;
    }

    // Verify course
    const courseSnap = await getDoc(doc(db, "courses", courseId));

    if (!courseSnap.exists() || courseSnap.data().published !== true) {
      showAccessDenied();
      return;
    }

    const course = courseSnap.data();

    document.getElementById("participantIdentity").textContent =
      user.displayName || user.email || "Participant";

    document.getElementById("courseTitle").textContent =
      course.title || "My Course";

    document.getElementById("courseDescription").textContent =
      course.description || "";

    // Load published modules
    const modulesQuery = query(
      collection(db, "modules"),
      where("courseId", "==", courseId),
      where("published", "==", true)
    );

    const modulesSnap = await getDocs(modulesQuery);

    const modules = modulesSnap.docs.map(item => item.data());

    modules.sort((a, b) => (a.order || 0) - (b.order || 0));

    moduleList.replaceChildren();

    if (!modules.length) {
      const empty = document.createElement("p");
      empty.textContent = "Course modules will be available soon.";
      moduleList.appendChild(empty);
    } else {
      modules.forEach(module => {
        moduleList.appendChild(createModuleCard(module));
      });
    }

    accessMessage.hidden = true;
    courseContent.hidden = false;

  } catch (error) {
    console.error("Participant dashboard error:", error);
    showAccessDenied();
  }
});
