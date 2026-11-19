
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import { db } from "./firebase.js";

const params = new URLSearchParams(window.location.search);
const courseId = params.get("id");

const byId = id => document.getElementById(id);

function showError(message) {
  byId("courseTitle").textContent = "Course unavailable";
  byId("coursePageMessage").textContent = message;
  byId("courseLoginButton").hidden = true;
}

function addListItems(container, values) {
  const items = Array.isArray(values)
    ? values
    : String(values || "")
        .split("\n")
        .map(item => item.trim())
        .filter(Boolean);

  container.replaceChildren();

  items.forEach(value => {
    const li = document.createElement("li");
    li.textContent = value;
    container.appendChild(li);
  });
}

async function loadCourse() {
  if (!courseId) {
    showError("No course was selected. Please return to the course catalogue.");
    return;
  }

  try {
    const courseSnap = await getDoc(doc(db, "courses", courseId));

    if (!courseSnap.exists() || courseSnap.data().published !== true) {
      showError("This course is not currently available.");
      return;
    }

    const course = courseSnap.data();

    document.title = `${course.title || "Course"} | TBARC Academy`;

    byId("courseTitle").textContent = course.title || "Untitled course";
    byId("courseShortDescription").textContent =
      course.shortDescription || course.description || "";

    byId("courseDescription").textContent =
      course.description || "Course details will be updated soon.";

    byId("courseDuration").textContent =
      course.duration || "To be announced";

    byId("courseMode").textContent =
      course.mode || "To be announced";

    byId("courseInstructor").textContent =
      course.instructor || "To be announced";

    byId("courseFee").textContent =
      course.fee || "To be announced";

    if (course.image) {
      byId("courseImage").src = course.image;
      byId("courseImage").alt = course.title || "Course image";
      byId("courseImageContainer").hidden = false;
    }

    if (course.objectives) {
      addListItems(byId("courseObjectives"), course.objectives);
      byId("objectivesSection").hidden = false;
    }

    if (course.syllabus) {
      const syllabus = byId("courseSyllabus");

      if (Array.isArray(course.syllabus)) {
        addListItems(syllabus, course.syllabus);
      } else {
        syllabus.textContent = course.syllabus;
      }

      byId("syllabusSection").hidden = false;
    }

    byId("courseLoginButton").href =
      `login.html?course=${encodeURIComponent(courseId)}`;

  } catch (error) {
    console.error("Course details error:", error);
    showError("Could not load course details. Please try again later.");
  }
}

loadCourse();
