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
  where,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";

const accessMessage = document.getElementById("accessMessage");
const courseContent = document.getElementById("courseContent");
const moduleList = document.getElementById("moduleList");

let currentUser = null;
let currentCourseId = null;
let modules = [];
let completedModules = new Set();

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

    if (parsed.hostname === "docs.google.com") return url;

    return null;
  } catch {
    return null;
  }
}

// UPDATE COURSE PROGRESS DISPLAY
function updateProgressDisplay() {
  const total = modules.length;
  const completed = completedModules.size;
  const percent = total
    ? Math.round((completed / total) * 100)
    : 0;

  document.getElementById("progressPercent").textContent =
    `${percent}%`;

  document.getElementById("progressCount").textContent =
    `${completed} of ${total} modules completed`;

  document.getElementById("progressBar").style.width =
    `${percent}%`;

  document.getElementById("progressTrack")
    .setAttribute("aria-valuenow", String(percent));

  modules.forEach(module => {
    const card = document.getElementById(`module-${module.id}`);
    const badge = card?.querySelector(".module-status");

    if (badge) {
      const isComplete = completedModules.has(module.id);

      badge.textContent = isComplete
        ? "Completed"
        : "In progress";

      badge.classList.toggle("is-complete", isComplete);
    }
  });

  // CONTINUE LEARNING
  const nextModule = modules.find(
    module => !completedModules.has(module.id)
  );

  const continueButton =
    document.getElementById("continueLearning");

  if (nextModule) {
    continueButton.hidden = false;

    continueButton.textContent =
      `Continue learning: ${nextModule.title || "Next module"}`;

    continueButton.onclick = () => {
      document.getElementById(`module-${nextModule.id}`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
    };
  } else {
    continueButton.hidden = true;
  }
}

// SAVE MODULE COMPLETION
async function saveModuleProgress(
  module,
  isCompleted,
  checkbox,
  statusText
) {
  checkbox.disabled = true;
  statusText.textContent = "Saving…";

  const progressId = `${currentUser.uid}_${module.id}`;
  const progressRef = doc(db, "progress", progressId);

  try {
    await setDoc(progressRef, {
      uid: currentUser.uid,
      courseId: currentCourseId,
      moduleId: module.id,
      completed: isCompleted,
      updatedAt: serverTimestamp()
    }, { merge: true });

    if (isCompleted) {
      completedModules.add(module.id);
      statusText.textContent = "Completed";
    } else {
      completedModules.delete(module.id);
      statusText.textContent = "Mark as completed";
    }

    updateProgressDisplay();
    checkbox.checked = isCompleted;

  } catch (error) {
    console.error("Could not save module progress:", error);

    checkbox.checked = !isCompleted;
    statusText.textContent = "Could not save. Please try again.";

    alert(
      "Your progress could not be saved. Please check your connection and try again."
    );

  } finally {
    checkbox.disabled = false;
  }
}

// CREATE MODULE CARD
function createModuleCard(module) {
  const card = document.createElement("article");
  card.className = "module-card";
  card.id = `module-${module.id}`;

  const top = document.createElement("div");
  top.className = "module-card-top";

  const heading = document.createElement("h3");
  heading.textContent = module.title || "Untitled module";

  const badge = document.createElement("span");
  badge.className = "module-status";

  badge.textContent = completedModules.has(module.id)
    ? "Completed"
    : "In progress";

  if (completedModules.has(module.id)) {
    badge.classList.add("is-complete");
  }

  top.append(heading, badge);
  card.appendChild(top);

  if (module.description) {
    const description = document.createElement("p");
    description.className = "module-description";
    description.textContent = module.description;
    card.appendChild(description);
  }

  // GOOGLE DRIVE VIDEO
  const embedUrl = getDriveEmbedUrl(module.videoUrl || "");

  if (embedUrl) {
    const frame = document.createElement("iframe");

    frame.src = embedUrl;
    frame.title = module.title || "Course video";
    frame.loading = "lazy";
    frame.allow =
      "autoplay; encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";

    card.appendChild(frame);

  } else {
    const message = document.createElement("p");
    message.textContent = "Video is currently unavailable.";
    card.appendChild(message);
  }

  // COMPLETION CHECKBOX
  const completion = document.createElement("label");
  completion.className = "module-completion";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = completedModules.has(module.id);

  const statusText = document.createElement("span");

  statusText.textContent = checkbox.checked
    ? "Completed"
    : "Mark as completed";

  checkbox.addEventListener("change", () => {
    saveModuleProgress(
      module,
      checkbox.checked,
      checkbox,
      statusText
    );
  });

  completion.append(checkbox, statusText);
  card.appendChild(completion);

  return card;
}

// LOAD SAVED PROGRESS
async function loadProgress() {
  completedModules = new Set();

  const progressQuery = query(
    collection(db, "progress"),
    where("uid", "==", currentUser.uid),
    where("courseId", "==", currentCourseId)
  );

  const progressSnap = await getDocs(progressQuery);

  progressSnap.forEach(progressDoc => {
    const progress = progressDoc.data();

    if (progress.completed === true && progress.moduleId) {
      completedModules.add(progress.moduleId);
    }
  });
}
// SIGN OUT
document.getElementById("signOut")
  ?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("login.html");
  });

// AUTHENTICATION AND COURSE ACCESS
onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  currentUser = user;

  try {
    // VERIFY ADMIN
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

    // VERIFY PARTICIPANT
    const participantSnap = await getDoc(
      doc(db, "participants", user.uid)
    );

    if (!participantSnap.exists()) {
      showAccessDenied();
      return;
    }

    const participant = participantSnap.data();

    // VERIFY EMAIL
    const registeredEmail =
      (participant.email || "").trim().toLowerCase();

    const signedInEmail =
      (user.email || "").trim().toLowerCase();

    if (
      !registeredEmail ||
      registeredEmail !== signedInEmail
    ) {
      showAccessDenied();
      return;
    }

    // VERIFY COURSE ASSIGNMENT
    const courseId = participant.courseId;

    if (!courseId) {
      showAccessDenied();
      return;
    }

    currentCourseId = courseId;

    // VERIFY ENROLLMENT
    const enrollmentSnap = await getDoc(
      doc(db, "enrollments", `${user.uid}_${courseId}`)
    );

    if (
      !enrollmentSnap.exists() ||
      enrollmentSnap.data().status !== "approved" ||
      (enrollmentSnap.data().email || "")
        .trim().toLowerCase() !== signedInEmail
    ) {
      showAccessDenied();
      return;
    }

    // VERIFY COURSE PUBLICATION
    const courseSnap = await getDoc(
      doc(db, "courses", courseId)
    );

    if (
      !courseSnap.exists() ||
      courseSnap.data().published !== true
    ) {
      showAccessDenied();
      return;
    }

    const course = courseSnap.data();

    // PARTICIPANT DETAILS
    document.getElementById("participantIdentity").textContent =
      user.displayName || user.email || "Participant";

    document.getElementById("courseTitle").textContent =
      course.title || "My Course";

    document.getElementById("courseDescription").textContent =
      course.description || "";

    // LOAD PUBLISHED MODULES
    const modulesQuery = query(
      collection(db, "modules"),
      where("courseId", "==", courseId),
      where("published", "==", true)
    );

    const modulesSnap = await getDocs(modulesQuery);

    modules = modulesSnap.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    modules.sort(
      (a, b) => (a.order || 0) - (b.order || 0)
    );

    // LOAD COMPLETED MODULES
    await loadProgress();

    moduleList.replaceChildren();

    if (!modules.length) {
      const empty = document.createElement("p");
      empty.className = "empty-modules";
      empty.textContent =
        "Course modules will be available soon.";

      moduleList.appendChild(empty);

    } else {
      modules.forEach(module => {
        moduleList.appendChild(createModuleCard(module));
      });
    }

    // UPDATE PROGRESS
    updateProgressDisplay();

    accessMessage.hidden = true;
    courseContent.hidden = false;

  } catch (error) {
    console.error("Participant dashboard error:", error);
    showAccessDenied();
  }
});
