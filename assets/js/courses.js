
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import { db } from "./firebase.js";

function createCourseCard(course) {
  const article = document.createElement("article");
  article.className = "course-card";

  const visual = document.createElement("div");
  visual.className = "course-visual";

  if (course.image) {
    const image = document.createElement("img");
    image.src = course.image;
    image.alt = course.title || "Course image";
    image.className = "course-card-image";
    visual.appendChild(image);
  } else {
    const mark = document.createElement("span");
    mark.className = "course-visual-mark";
    mark.textContent = "TBARC";
    visual.appendChild(mark);
  }

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

  const details = document.createElement("a");
  details.className = "button button-dark";
  details.href = `course.html?id=${encodeURIComponent(course.id)}`;
  details.textContent = "View course details →";

  content.append(label, title, description, details);
  article.append(visual, content);

  return article;
}

async function render(targetId, messageId, limit = 0) {
  const target = document.getElementById(targetId);
  if (!target) return;

  try {
    const snap = await getDocs(
      query(
        collection(db, "courses"),
        where("published", "==", true)
      )
    );

    const courses = snap.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    courses.sort(
      (a, b) =>
        (b.createdAt?.seconds || 0) -
        (a.createdAt?.seconds || 0)
    );

    target.replaceChildren();

    const displayed = limit
      ? courses.slice(0, limit)
      : courses;

    if (!displayed.length) {
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

    displayed.forEach(course => {
      target.appendChild(createCourseCard(course));
    });

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
