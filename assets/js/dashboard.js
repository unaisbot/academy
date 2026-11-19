
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteField,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";

const byId = (id) => document.getElementById(id);

const accessMessage = byId("accessMessage");
const adminTools = byId("adminTools");
const courseList = byId("courseList");
const participantList = byId("participantList");

let courses = [];

function status(id, message) {
  const element = byId(id);
  if (element) element.textContent = message;
}

function showError(error) {
  console.error("TBARC Academy error:", error);
  return error.message || "An unexpected error occurred.";
}

// SIGN OUT
byId("signOut")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.replace("login.html");
});

// COURSE SELECTS
function populateCourseSelects() {
  for (const selectId of ["moduleCourse", "enrollmentCourse"]) {
    const select = byId(selectId);
    if (!select) continue;

    select.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a course";
    select.appendChild(placeholder);

    courses.forEach(course => {
      const option = document.createElement("option");
      option.value = course.id;
      option.textContent = course.title || "Untitled course";
      select.appendChild(option);
    });
  }
}

// LOAD COURSES
async function loadCourses() {
  const snap = await getDocs(collection(db, "courses"));

  courses = snap.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  courses.sort((a, b) =>
    (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
  );

  courseList.replaceChildren();

  if (!courses.length) {
    const empty = document.createElement("p");
    empty.className = "panel-help";
    empty.textContent = "No courses created yet.";
    courseList.appendChild(empty);
  }

  courses.forEach(course => {
    const item = document.createElement("div");
    item.className = "admin-item";

    const info = document.createElement("div");

    const title = document.createElement("strong");
    title.textContent = course.title || "Untitled course";

    const description = document.createElement("small");
    description.textContent = course.description || "No description";

    info.append(title, description);

    const badge = document.createElement("span");
    badge.className = "admin-badge";
    badge.textContent = course.published ? "Published" : "Draft";

    item.append(info, badge);
    courseList.appendChild(item);
  });

  populateCourseSelects();
}

// LOAD PARTICIPANTS
async function loadParticipants() {
  participantList.replaceChildren();

  const snap = await getDocs(collection(db, "participants"));

  if (snap.empty) {
    const empty = document.createElement("p");
    empty.className = "panel-help";
    empty.textContent = "No participant records found.";
    participantList.appendChild(empty);
    return;
  }

  for (const participantDoc of snap.docs) {
    const participant = participantDoc.data();
    const uid = participantDoc.id;
    const courseId = participant.courseId;

    const item = document.createElement("div");
    item.className = "admin-item";

    const info = document.createElement("div");

    const name = document.createElement("strong");
    name.textContent = participant.name || participant.email || uid;

    const details = document.createElement("small");
    details.textContent = participant.email || uid;

    const courseDetails = document.createElement("small");

    let active = false;

    if (courseId) {
      const enrollmentId = `${uid}_${courseId}`;
      const enrollmentSnap = await getDoc(
        doc(db, "enrollments", enrollmentId)
      );

      if (
        enrollmentSnap.exists() &&
        enrollmentSnap.data().status === "approved"
      ) {
        active = true;
        const course = courses.find(c => c.id === courseId);
        courseDetails.textContent =
          `Assigned course: ${course?.title || courseId}`;
      } else {
        courseDetails.textContent = "No active course approval";
      }
    } else {
      courseDetails.textContent = "No course assigned";
    }

    info.append(name, details, courseDetails);

    const actions = document.createElement("div");

    const badge = document.createElement("span");
    badge.className = "admin-badge";
    badge.textContent = active ? "Approved" : "No active access";

    actions.appendChild(badge);

    if (active) {
      const revokeButton = document.createElement("button");
      revokeButton.type = "button";
      revokeButton.className = "button button-dark";
      revokeButton.textContent = "Revoke access";

      revokeButton.addEventListener("click", async () => {
        const confirmed = window.confirm(
          `Revoke course access for ${participant.name || participant.email || uid}?`
        );

        if (!confirmed) return;

        revokeButton.disabled = true;
        status("participantListStatus", "Revoking access…");

        try {
          await updateDoc(
            doc(db, "enrollments", `${uid}_${courseId}`),
            {
              status: "revoked",
              revokedAt: serverTimestamp()
            }
          );

          await updateDoc(
            doc(db, "participants", uid),
            {
              courseId: deleteField(),
              updatedAt: serverTimestamp()
            }
          );

          status(
            "participantListStatus",
            "Participant access revoked successfully."
          );

          await loadParticipants();

        } catch (error) {
          console.error(error);
          status(
            "participantListStatus",
            `Could not revoke access: ${showError(error)}`
          );
          revokeButton.disabled = false;
        }
      });

      actions.appendChild(revokeButton);
    }

    item.append(info, actions);
    participantList.appendChild(item);
  }
}

// VERIFY ADMIN
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  byId("adminIdentity").textContent =
    `${user.displayName || "Administrator"} · ${user.email || ""}`;

  try {
    const adminRecord = await getDoc(doc(db, "admins", user.uid));

    if (
      !adminRecord.exists() ||
      adminRecord.data().role !== "admin"
    ) {
      accessMessage.hidden = false;
      accessMessage.textContent =
        "This Google account is not registered as a TBARC Academy administrator. Please sign out and use the authorized account.";
      return;
    }

    adminTools.hidden = false;

    await loadCourses();
    await loadParticipants();

  } catch (error) {
    console.error(error);
    accessMessage.hidden = false;
    accessMessage.textContent =
      "Could not verify administrator access. Check Firestore rules and your internet connection.";
  }
});

// CREATE COURSE
byId("courseForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = event.submitter;
  button.disabled = true;

  status("courseStatus", "Saving course…");

  try {
    const title = byId("courseTitle").value.trim();
    const description = byId("courseDescription").value.trim();

    await addDoc(collection(db, "courses"), {
      title,
      description,
      published: true,
      createdAt: serverTimestamp()
    });

    byId("courseForm").reset();

    status("courseStatus", "Course created successfully.");

    await loadCourses();

  } catch (error) {
    status("courseStatus", `Could not create course: ${showError(error)}`);
  } finally {
    button.disabled = false;
  }
});

// CREATE MODULE
byId("moduleForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = event.submitter;
  button.disabled = true;

  status("moduleStatus", "Saving module…");

  try {
    const courseId = byId("moduleCourse").value;
    const title = byId("moduleTitle").value.trim();
    const description = byId("moduleDescription").value.trim();
    const videoUrl = byId("moduleVideoUrl").value.trim();
    const order = Number(byId("moduleOrder").value);
    const published = byId("modulePublished").value === "true";

    if (!courseId) {
      throw new Error("Please select a course.");
    }

    if (!Number.isInteger(order) || order < 1) {
      throw new Error("Enter a valid module order.");
    }

    const parsed = new URL(videoUrl);

    if (!["drive.google.com", "docs.google.com"].includes(parsed.hostname)) {
      throw new Error("Please enter a Google Drive video URL.");
    }

    await addDoc(collection(db, "modules"), {
      courseId,
      title,
      description,
      videoUrl,
      order,
      published,
      createdAt: serverTimestamp()
    });

    byId("moduleForm").reset();
    byId("moduleOrder").value = 1;

    status("moduleStatus", "Module saved successfully.");

  } catch (error) {
    status("moduleStatus", `Could not save module: ${showError(error)}`);
  } finally {
    button.disabled = false;
  }
});

// APPROVE PARTICIPANT
byId("enrollmentForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = event.submitter;
  button.disabled = true;

  status("enrollmentStatus", "Granting permanent access…");

  try {
    const uid = byId("participantUid").value.trim();
    const email = byId("participantEmail").value.trim().toLowerCase();
    const name = byId("participantName").value.trim();
    const courseId = byId("enrollmentCourse").value;

    if (!uid || !courseId || !email || !name) {
      throw new Error("Complete all participant details.");
    }

    const course = courses.find(c => c.id === courseId);

    if (!course) {
      throw new Error("Selected course could not be found.");
    }

    // Check whether the participant already has another assigned course
    const participantRef = doc(db, "participants", uid);
    const participantSnap = await getDoc(participantRef);

    if (
      participantSnap.exists() &&
      participantSnap.data().courseId &&
      participantSnap.data().courseId !== courseId
    ) {
      throw new Error(
        "This participant already has another assigned course. Revoke the existing access before assigning a different course."
      );
    }

    // Save participant and assigned course
    await setDoc(participantRef, {
      uid,
      email,
      name,
      courseId,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Create or reactivate enrollment without expiry
    await setDoc(
      doc(db, "enrollments", `${uid}_${courseId}`),
      {
        uid,
        email,
        courseId,
        status: "approved",
        createdAt: serverTimestamp()
      },
      { merge: true }
    );

    byId("enrollmentForm").reset();

    status(
      "enrollmentStatus",
      `Permanent access approved for ${name} – ${course.title}.`
    );

    await loadParticipants();

  } catch (error) {
    console.error(error);
    status("enrollmentStatus", `Could not approve participant: ${showError(error)}`);
  } finally {
    button.disabled = false;
  }
});
