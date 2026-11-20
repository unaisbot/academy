
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import { db } from "./firebase.js";

// Create an individual course card
function createCourseCard(course) {
  const article = document.createElement("article");
  article.className = "course-card";

  // Course visual
  const visual = document.createElement("div");
  visual.className = "course-visual";

  const mark = document.createElement("span");
  mark.className = "course-visual-mark";
  mark.textContent = "TBARC";

  visual.appendChild(mark);

  // Course content
  const content = document.createElement("div");
  content.className = "course-card-content";

  const label = document.createElement("p");
  label.className = "eyebrow";
  label.textContent = "TBARC ACADEMY COURSE";

  const title = document.createElement("h3");
  title.textContent = course.title || "Untitled course";

  const description = document.createElement("p");
  description.className = "course-description";
  description.textContent =
    course.shortDescription ||
    course.description ||
    "Course information will be updated soon.";

  // Course-specific login link
  const accessLink = document.createElement("a");
  accessLink.className = "button button-dark";
  accessLink.href =
    `login.html?course=${encodeURIComponent(course.id)}`;
  accessLink.textContent = "Sign in to access →";

  content.append(
    label,
    title,
    description,
    accessLink
  );

  article.append(visual, content);

  return article;
}

// Load all published courses from Firestore
async function render(targetId, messageId) {
  const target = document.getElementById(targetId);

  if (!target) return;

  try {
    const coursesQuery = query(
      collection(db, "courses"),
      where("published", "==", true)
    );

    const snapshot = await getDocs(coursesQuery);

    const courses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort by newest course first
    courses.sort((a, b) => {
      const dateA = a.createdAt?.seconds || 0;
      const dateB = b.createdAt?.seconds || 0;

      return dateB - dateA;
    });

    target.replaceChildren();

    // No published courses
    if (courses.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";

      const heading = document.createElement("h3");
      heading.textContent = "No courses published yet";

      const message = document.createElement("p");
      message.textContent =
        "New learning opportunities will appear here when announced.";

      empty.append(heading, message);
      target.appendChild(empty);

      return;
    }

    // Display every published course
    courses.forEach(course => {
      const card = createCourseCard(course);
      target.appendChild(card);
    });

    const status = document.getElementById(messageId);

    if (status) {
      status.textContent = "";
    }

  } catch (error) {
    console.error("Course loading error:", error);

    target.replaceChildren();

    const empty = document.createElement("div");
    empty.className = "empty-state";

    const heading = document.createElement("h3");
    heading.textContent = "Courses temporarily unavailable";

    const message = document.createElement("p");
    message.textContent =
      "Please refresh the page or contact TBARC Academy.";

    empty.append(heading, message);
    target.appendChild(empty);

    const status = document.getElementById(messageId);

    if (status) {
      status.textContent =
        "Please check the Firestore public course read permissions.";
    }
  }
}

export { render };
