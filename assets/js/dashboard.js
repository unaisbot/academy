import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, Timestamp, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

const byId = (id) => document.getElementById(id);
const accessMessage = byId("accessMessage");
const adminTools = byId("adminTools");
const courseList = byId("courseList");
let courses = [];

byId("signOut")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

function status(id, message) { byId(id).textContent = message; }

function populateCourseSelects() {
  for (const selectId of ["lessonCourse", "enrollmentCourse"]) {
    const select = byId(selectId);
    select.innerHTML = '<option value="">Select a course</option>';
    for (const course of courses) {
      const option = document.createElement("option");
      option.value = course.id;
      option.textContent = course.title;
      select.appendChild(option);
    }
  }
}

async function loadCourses() {
  const snap = await getDocs(collection(db, "courses"));
  courses = snap.docs.map(item => ({ id: item.id, ...item.data() }));
  courses.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  courseList.replaceChildren();
  if (!courses.length) {
    const empty = document.createElement("p");
    empty.className = "panel-help";
    empty.textContent = "No courses created yet.";
    courseList.appendChild(empty);
  }
  for (const course of courses) {
    const item = document.createElement("div");
    item.className = "admin-item";
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = course.title || "Untitled course";
    const desc = document.createElement("small");
    desc.textContent = course.description || "No description";
    info.append(title, desc);
    const badge = document.createElement("span");
    badge.className = "admin-badge";
    badge.textContent = course.published ? "Published" : "Draft";
    item.append(info, badge);
    courseList.appendChild(item);
  }
  populateCourseSelects();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  byId("adminIdentity").textContent = `${user.displayName || "Administrator"} · ${user.email || ""}`;
  try {
    const adminRecord = await getDoc(doc(db, "admins", user.uid));
    if (!adminRecord.exists() || adminRecord.data().role !== "admin") {
      accessMessage.hidden = false;
      accessMessage.textContent = "This Google account is not registered as a TBARC Academy administrator. Please sign out and use the authorized administrator account.";
      return;
    }
    adminTools.hidden = false;
    await loadCourses();
  } catch (error) {
    console.error(error);
    accessMessage.hidden = false;
    accessMessage.textContent = "Could not verify administrator access. Check Firestore rules and your internet connection, then reload.";
  }
});

byId("courseForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  status("courseStatus", "Saving course…");
  try {
    const title = byId("courseTitle").value.trim();
    const description = byId("courseDescription").value.trim();
    await addDoc(collection(db, "courses"), {
      title, description, published: true, createdAt: serverTimestamp()
    });
    byId("courseForm").reset();
    status("courseStatus", "Course created successfully.");
    await loadCourses();
  } catch (error) {
    console.error(error);
    status("courseStatus", `Could not create course: ${error.message}`);
  } finally { button.disabled = false; }
});

byId("lessonForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  status("lessonStatus", "Saving lesson…");
  try {
    const courseId = byId("lessonCourse").value;
    const title = byId("lessonTitle").value.trim();
    const videoUrl = byId("videoUrl").value.trim();
    const parsed = new URL(videoUrl);
    if (!["drive.google.com", "docs.google.com"].includes(parsed.hostname)) {
      throw new Error("Please enter a Google Drive URL.");
    }
    await addDoc(collection(db, "lessons"), {
      courseId, title, videoUrl, published: true, createdAt: serverTimestamp()
    });
    byId("lessonForm").reset();
    populateCourseSelects();
    status("lessonStatus", "Lesson details saved. Drive sharing still needs backend setup.");
  } catch (error) {
    console.error(error);
    status("lessonStatus", `Could not save lesson: ${error.message}`);
  } finally { button.disabled = false; }
});

byId("enrollmentForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  status("enrollmentStatus", "Granting access…");
  try {
    const uid = byId("participantUid").value.trim();
    const email = byId("participantEmail").value.trim().toLowerCase();
    const name = byId("participantName").value.trim();
    const courseId = byId("enrollmentCourse").value;
    if (!uid || !courseId) throw new Error("Enter a UID and select a course.");
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 3);
    await setDoc(doc(db, "participants", uid), {
      uid, email, name, updatedAt: serverTimestamp()
    }, { merge: true });
    await setDoc(doc(db, "enrollments", `${uid}_${courseId}`), {
      uid, email, courseId, status: "approved",
      accessExpiry: Timestamp.fromDate(expiry),
      createdAt: serverTimestamp()
    });
    byId("enrollmentForm").reset();
    status("enrollmentStatus", `Approved. Access expiry: ${expiry.toLocaleDateString()}. Drive permissions are not automated yet.`);
  } catch (error) {
    console.error(error);
    status("enrollmentStatus", `Could not grant access: ${error.message}`);
  } finally { button.disabled = false; }
});
