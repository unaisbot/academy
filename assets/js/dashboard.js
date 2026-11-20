
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
  deleteDoc,
  deleteField,
  serverTimestamp,
  query,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";

const byId = (id) => document.getElementById(id);

const accessMessage = byId("accessMessage");
const adminTools = byId("adminTools");
const courseList = byId("courseList");
const participantList = byId("participantList");
const moduleList = byId("managedModuleList");

let courses = [];
let selectedModuleCourse = "";

function status(id, message) {
  const element = byId(id);
  if (element) element.textContent = message;
}

function showError(error) {
  console.error("TBARC Academy error:", error);
  return error?.message || "An unexpected error occurred.";
}

function makeButton(label, className, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className || "button button-dark";
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
}

function courseName(courseId) {
  return courses.find(course => course.id === courseId)?.title || courseId;
}

// SIGN OUT
byId("signOut")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.replace("login.html?admin=1");
});

// COURSE SELECTS
function populateCourseSelects() {
  for (const selectId of [
    "moduleCourse",
    "enrollmentCourse",
    "manageModuleCourse"
  ]) {
    const select = byId(selectId);
    if (!select) continue;

    const previous = select.value;
    select.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a course";
    select.appendChild(placeholder);

    courses.forEach(course => {
      const option = document.createElement("option");
      option.value = course.id;
      option.textContent =
        `${course.title || "Untitled course"}${course.published ? " · Published" : " · Draft"}`;
      select.appendChild(option);
    });

    if (courses.some(course => course.id === previous)) {
      select.value = previous;
    }
  }

  if (byId("manageModuleCourse")?.value) {
    selectedModuleCourse = byId("manageModuleCourse").value;
  }
}

// ADMIN EDITOR DIALOG
function openDialog(contentBuilder) {
  const dialog = byId("adminEditorDialog");
  const content = byId("adminEditorContent");

  content.replaceChildren();
  contentBuilder(content);

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeDialog() {
  const dialog = byId("adminEditorDialog");

  if (dialog?.open) dialog.close();
  else dialog?.removeAttribute("open");
}

function addDialogHeading(root, heading, description) {
  const title = document.createElement("h2");
  title.textContent = heading;
  root.appendChild(title);

  if (description) {
    const text = document.createElement("p");
    text.className = "panel-help";
    text.textContent = description;
    root.appendChild(text);
  }
}

function addField(root, labelText, id, value, type = "text") {
  const label = document.createElement("label");
  label.textContent = labelText;

  let input;

  if (type === "textarea") {
    input = document.createElement("textarea");
  } else if (type === "select") {
    input = document.createElement("select");

    [["false", "Draft"], ["true", "Published"]].forEach(([v, text]) => {
      const option = document.createElement("option");
      option.value = v;
      option.textContent = text;
      input.appendChild(option);
    });
  } else {
    input = document.createElement("input");
    input.type = type;
  }

  input.id = id;
  input.value = value ?? "";

  label.appendChild(input);
  root.appendChild(label);

  return input;
}

function addDialogActions(root, onSave, saveLabel = "Save changes") {
  const actions = document.createElement("div");
  actions.className = "dialog-actions";

  const save = makeButton(saveLabel, "button button-dark", onSave);
  save.type = "button";

  const cancel = makeButton(
    "Cancel",
    "button button-light",
    closeDialog
  );
  cancel.type = "button";

  actions.append(save, cancel);
  root.appendChild(actions);

  return save;
}

// COURSE LIST
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
    description.textContent =
      course.shortDescription || course.description || "No description";

    info.append(title, description);

    const actions = document.createElement("div");

    const badge = document.createElement("span");
    badge.className = "admin-badge";
    badge.textContent = course.published ? "Published" : "Draft";

    const edit = makeButton(
      "Edit",
      "button button-light",
      () => editCourse(course)
    );

    const preview = makeButton(
      "Preview",
      "button button-light",
      () => previewCourse(course)
    );

    const publish = makeButton(
      course.published ? "Unpublish" : "Publish",
      "button button-dark",
      () => toggleCoursePublication(course)
    );

    const remove = makeButton(
      "Delete",
      "button button-dark danger-button",
      () => deleteCourse(course)
    );

    actions.append(badge, edit, preview, publish, remove);
    item.append(info, actions);
    courseList.appendChild(item);
  });

  populateCourseSelects();

  if (selectedModuleCourse) {
    byId("manageModuleCourse").value = selectedModuleCourse;
    await loadManagedModules(selectedModuleCourse);
  }
}

// EDIT COURSE
function editCourse(course) {
  openDialog(root => {
    addDialogHeading(
      root,
      "Edit course",
      "Update course information, learning content and publication status."
    );

    const title = addField(
      root, "Course title", "editCourseTitle",
      course.title || ""
    );

    const shortDescription = addField(
      root, "Short description", "editCourseShortDescription",
      course.shortDescription || "", "textarea"
    );

    const description = addField(
      root, "Full course description", "editCourseDescription",
      course.description || "", "textarea"
    );

    const image = addField(
      root, "Course image path", "editCourseImage",
      course.image || ""
    );

    const duration = addField(
      root, "Duration", "editCourseDuration",
      course.duration || ""
    );

    const mode = addField(
      root, "Mode", "editCourseMode",
      course.mode || ""
    );

    const instructor = addField(
      root, "Instructor", "editCourseInstructor",
      course.instructor || ""
    );

    const fee = addField(
      root, "Course fee", "editCourseFee",
      course.fee || ""
    );

    const objectives = addField(
      root,
      "Learning objectives (one per line)",
      "editCourseObjectives",
      Array.isArray(course.objectives)
        ? course.objectives.join("\n")
        : course.objectives || "",
      "textarea"
    );

    const syllabus = addField(
      root,
      "Syllabus (one topic per line)",
      "editCourseSyllabus",
      Array.isArray(course.syllabus)
        ? course.syllabus.join("\n")
        : course.syllabus || "",
      "textarea"
    );

    const published = addField(
      root, "Publication status", "editCoursePublished",
      String(course.published === true), "select"
    );

    addDialogActions(root, async () => {
      const save = root.querySelector(".dialog-actions button");
      save.disabled = true;

      try {
        const splitLines = value =>
          value.split("\n")
            .map(item => item.trim())
            .filter(Boolean);

        await updateDoc(doc(db, "courses", course.id), {
          title: title.value.trim(),
          shortDescription: shortDescription.value.trim(),
          description: description.value.trim(),
          image: image.value.trim(),
          duration: duration.value.trim(),
          mode: mode.value.trim(),
          instructor: instructor.value.trim(),
          fee: fee.value.trim(),
          objectives: splitLines(objectives.value),
          syllabus: splitLines(syllabus.value),
          published: published.value === "true",
          updatedAt: serverTimestamp()
        });

        closeDialog();
        status("courseStatus", "Course updated successfully.");
        await loadCourses();

      } catch (error) {
        status(
          "courseStatus",
          `Could not update course: ${showError(error)}`
        );
        save.disabled = false;
      }
    });
  });
}

// PUBLISH / UNPUBLISH COURSE
async function toggleCoursePublication(course) {
  const next = !course.published;

  const prompt = next
    ? `Publish "${course.title}"? It will become visible on the public Courses page.`
    : `Unpublish "${course.title}"? It will no longer be publicly listed and participant access to its course page will be blocked.`;

  if (!window.confirm(prompt)) return;

  try {
    await updateDoc(doc(db, "courses", course.id), {
      published: next,
      updatedAt: serverTimestamp()
    });

    status(
      "courseStatus",
      next ? "Course published." : "Course unpublished."
    );

    await loadCourses();

  } catch (error) {
    status(
      "courseStatus",
      `Could not change publication status: ${showError(error)}`
    );
  }
}

// DELETE COURSE
async function deleteCourse(course) {
  const confirmed = window.confirm(
    `Delete the course "${course.title}" and all its modules? This cannot be undone.`
  );

  if (!confirmed) return;

  try {
    const participantsSnap = await getDocs(
      collection(db, "participants")
    );

    const assigned = participantsSnap.docs.some(
      p => p.data().courseId === course.id
    );

    if (assigned) {
      throw new Error(
        "This course has participant assignments. Revoke or reassign access before deleting it."
      );
    }

    const modulesSnap = await getDocs(
      query(
        collection(db, "modules"),
        where("courseId", "==", course.id)
      )
    );

    const batch = writeBatch(db);

    modulesSnap.docs.forEach(moduleDoc => {
      batch.delete(moduleDoc.ref);
    });

    batch.delete(doc(db, "courses", course.id));

    await batch.commit();

    status("courseStatus", "Course and its modules deleted.");
    await loadCourses();

  } catch (error) {
    status(
      "courseStatus",
      `Could not delete course: ${showError(error)}`
    );
  }
}

// PREVIEW COURSE
async function previewCourse(course) {
  try {
    const modulesSnap = await getDocs(
      query(
        collection(db, "modules"),
        where("courseId", "==", course.id)
      )
    );

    const modules = modulesSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    openDialog(root => {
      addDialogHeading(
        root,
        `Preview: ${course.title || "Untitled course"}`,
        `${course.published ? "Published course" : "Draft preview"} · ${modules.length} module(s)`
      );

      if (course.image) {
        const image = document.createElement("img");
        image.src = course.image;
        image.alt = course.title || "Course image";
        image.style.width = "100%";
        image.style.maxHeight = "220px";
        image.style.objectFit = "cover";
        image.style.borderRadius = "12px";
        root.appendChild(image);
      }

      const addDetail = (label, value) => {
        if (!value) return;

        const paragraph = document.createElement("p");
        const strong = document.createElement("strong");

        strong.textContent = `${label}: `;
        paragraph.append(
          strong,
          document.createTextNode(value)
        );

        root.appendChild(paragraph);
      };

      addDetail("Short description", course.shortDescription);
      addDetail("Duration", course.duration);
      addDetail("Mode", course.mode);
      addDetail("Instructor", course.instructor);
      addDetail("Fee", course.fee);

      const description = document.createElement("p");
      description.textContent =
        course.description || "No course description added.";

      root.appendChild(description);

      const addList = (heading, values) => {
        if (!values || !values.length) return;

        const title = document.createElement("h3");
        title.textContent = heading;
        root.appendChild(title);

        const list = document.createElement("ul");

        values.forEach(value => {
          const item = document.createElement("li");
          item.textContent = value;
          list.appendChild(item);
        });

        root.appendChild(list);
      };

      const objectives = Array.isArray(course.objectives)
        ? course.objectives
        : (course.objectives || "").split("\n").filter(Boolean);

      const syllabus = Array.isArray(course.syllabus)
        ? course.syllabus
        : (course.syllabus || "").split("\n").filter(Boolean);

      addList("Learning objectives", objectives);
      addList("Syllabus", syllabus);

      const moduleHeading = document.createElement("h3");
      moduleHeading.textContent = "Course modules";
      root.appendChild(moduleHeading);

      if (!modules.length) {
        const empty = document.createElement("p");
        empty.className = "panel-help";
        empty.textContent = "No modules have been added yet.";
        root.appendChild(empty);
      }

      modules.forEach(module => {
        const card = document.createElement("div");
        card.className = "preview-module";

        const heading = document.createElement("h3");
        heading.textContent =
          `${module.order || ""}. ${module.title || "Untitled module"}`;

        const detail = document.createElement("p");
        detail.textContent =
          `${module.description || ""} · ${module.published ? "Published" : "Draft"}`;

        card.append(heading, detail);

        const embed = driveEmbedUrl(module.videoUrl || "");

        if (embed) {
          const frame = document.createElement("iframe");
          frame.src = embed;
          frame.title = module.title || "Course video preview";
          frame.loading = "lazy";
          frame.allow =
            "autoplay; encrypted-media; picture-in-picture";
          frame.allowFullscreen = true;
          card.appendChild(frame);
        }

        root.appendChild(card);
      });

      const actions = document.createElement("div");
      actions.className = "dialog-actions";

      actions.appendChild(
        makeButton("Close preview", "button button-dark", closeDialog)
      );

      root.appendChild(actions);
    });

  } catch (error) {
    status(
      "courseStatus",
      `Could not preview course: ${showError(error)}`
    );
  }
}

// MODULE MANAGEMENT
byId("manageModuleCourse")?.addEventListener("change", async event => {
  selectedModuleCourse = event.target.value;
  await loadManagedModules(selectedModuleCourse);
});

async function loadManagedModules(courseId) {
  if (!moduleList) return;

  moduleList.replaceChildren();

  if (!courseId) {
    const note = document.createElement("p");
    note.className = "panel-help";
    note.textContent = "Select a course to manage its modules.";
    moduleList.appendChild(note);
    return;
  }

  try {
    const snap = await getDocs(
      query(
        collection(db, "modules"),
        where("courseId", "==", courseId)
      )
    );

    const modules = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (!modules.length) {
      const empty = document.createElement("p");
      empty.className = "panel-help";
      empty.textContent = "No modules have been added to this course.";
      moduleList.appendChild(empty);
      return;
    }

    modules.forEach(module => {
      const item = document.createElement("div");
      item.className = "admin-item";

      const info = document.createElement("div");

      const title = document.createElement("strong");
      title.textContent =
        `${module.order || ""}. ${module.title || "Untitled module"}`;

      const desc = document.createElement("small");
      desc.textContent = module.description || "No description";

      info.append(title, desc);

      const actions = document.createElement("div");

      const badge = document.createElement("span");
      badge.className = "admin-badge";
      badge.textContent = module.published ? "Published" : "Draft";

      actions.append(
        badge,
        makeButton(
          "Edit",
          "button button-light",
          () => editModule(module)
        ),
        makeButton(
          "Preview",
          "button button-light",
          () => previewModule(module)
        ),
        makeButton(
          module.published ? "Unpublish" : "Publish",
          "button button-dark",
          () => toggleModulePublication(module)
        ),
        makeButton(
          "Delete",
          "button button-dark danger-button",
          () => deleteModule(module)
        )
      );

      item.append(info, actions);
      moduleList.appendChild(item);
    });

  } catch (error) {
    status(
      "managedModuleStatus",
      `Could not load modules: ${showError(error)}`
    );
  }
}

// EDIT MODULE
function editModule(module) {
  openDialog(root => {
    addDialogHeading(
      root,
      "Edit module",
      `Course: ${courseName(module.courseId)}`
    );

    const title = addField(
      root, "Module title", "editModuleTitle",
      module.title || ""
    );

    const description = addField(
      root, "Description", "editModuleDescription",
      module.description || "", "textarea"
    );

    const video = addField(
      root, "Google Drive video URL", "editModuleVideo",
      module.videoUrl || "", "url"
    );

    const order = addField(
      root, "Display order", "editModuleOrder",
      String(module.order || 1), "number"
    );

    order.min = "1";

    const published = addField(
      root, "Publication status", "editModulePublished",
      String(module.published === true), "select"
    );

    addDialogActions(root, async () => {
      const save = root.querySelector(".dialog-actions button");
      save.disabled = true;

      try {
        const parsed = new URL(video.value.trim());

        if (!["drive.google.com", "docs.google.com"].includes(parsed.hostname)) {
          throw new Error("Enter a valid Google Drive video URL.");
        }

        if (
          !Number.isInteger(Number(order.value)) ||
          Number(order.value) < 1
        ) {
          throw new Error("Display order must be a positive whole number.");
        }

        await updateDoc(doc(db, "modules", module.id), {
          title: title.value.trim(),
          description: description.value.trim(),
          videoUrl: video.value.trim(),
          order: Number(order.value),
          published: published.value === "true",
          updatedAt: serverTimestamp()
        });

        closeDialog();

        status("managedModuleStatus", "Module updated successfully.");

        await loadManagedModules(module.courseId);

      } catch (error) {
        status(
          "managedModuleStatus",
          `Could not update module: ${showError(error)}`
        );

        save.disabled = false;
      }
    });
  });
}

// GOOGLE DRIVE VIDEO URL
function driveEmbedUrl(url) {
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

  } catch {}

  return null;
}

// PREVIEW MODULE
function previewModule(module) {
  openDialog(root => {
    addDialogHeading(
      root,
      module.title || "Module preview",
      courseName(module.courseId)
    );

    const description = document.createElement("p");
    description.textContent = module.description || "";
    root.appendChild(description);

    const embed = driveEmbedUrl(module.videoUrl || "");

    if (embed) {
      const frame = document.createElement("iframe");
      frame.src = embed;
      frame.title = module.title || "Module video preview";
      frame.allow =
        "autoplay; encrypted-media; picture-in-picture";
      frame.allowFullscreen = true;
      root.appendChild(frame);

    } else {
      const note = document.createElement("p");
      note.textContent = "No valid Drive video link is available.";
      root.appendChild(note);
    }

    const actions = document.createElement("div");
    actions.className = "dialog-actions";

    actions.appendChild(
      makeButton("Close preview", "button button-dark", closeDialog)
    );

    root.appendChild(actions);
  });
}

// PUBLISH / UNPUBLISH MODULE
async function toggleModulePublication(module) {
  const next = !module.published;

  if (
    !window.confirm(
      `${next ? "Publish" : "Unpublish"} module "${module.title}"?`
    )
  ) return;

  try {
    await updateDoc(doc(db, "modules", module.id), {
      published: next,
      updatedAt: serverTimestamp()
    });

    status(
      "managedModuleStatus",
      next ? "Module published." : "Module unpublished."
    );

    await loadManagedModules(module.courseId);

  } catch (error) {
    status(
      "managedModuleStatus",
      `Could not change module status: ${showError(error)}`
    );
  }
}

// DELETE MODULE
async function deleteModule(module) {
  if (
    !window.confirm(
      `Delete module "${module.title}"? This cannot be undone.`
    )
  ) return;

  try {
    await deleteDoc(doc(db, "modules", module.id));

    status("managedModuleStatus", "Module deleted.");

    await loadManagedModules(module.courseId);

  } catch (error) {
    status(
      "managedModuleStatus",
      `Could not delete module: ${showError(error)}`
    );
  }
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
    name.textContent =
      participant.name || participant.email || uid;

    const details = document.createElement("small");
    details.textContent = participant.email || uid;

    const courseDetails = document.createElement("small");
    let active = false;

    if (courseId) {
      const enrollmentSnap = await getDoc(
        doc(db, "enrollments", `${uid}_${courseId}`)
      );

      if (
        enrollmentSnap.exists() &&
        enrollmentSnap.data().status === "approved"
      ) {
        active = true;
        courseDetails.textContent =
          `Assigned course: ${courseName(courseId)}`;
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
      actions.appendChild(
        makeButton(
          "Revoke access",
          "button button-dark",
          async () => {
            const confirmed = window.confirm(
              `Revoke course access for ${participant.name || participant.email || uid}?`
            );

            if (!confirmed) return;

            try {
              await updateDoc(
                doc(db, "enrollments", `${uid}_${courseId}`),
                {
                  status: "revoked",
                  revokedAt: serverTimestamp()
                }
              );

              await updateDoc(doc(db, "participants", uid), {
                courseId: deleteField(),
                updatedAt: serverTimestamp()
              });

              status(
                "participantListStatus",
                "Participant access revoked successfully."
              );

              await loadParticipants();

            } catch (error) {
              status(
                "participantListStatus",
                `Could not revoke access: ${showError(error)}`
              );
            }
          }
        )
      );
    }

    item.append(info, actions);
    participantList.appendChild(item);
  }
}

// VERIFY ADMIN
onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace("login.html?admin=1");
    return;
  }

  byId("adminIdentity").textContent =
    `${user.displayName || "Administrator"} · ${user.email || ""}`;

  try {
    const adminRecord = await getDoc(
      doc(db, "admins", user.uid)
    );

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
    await loadManagedModules("");
    await loadParticipants();

  } catch (error) {
    console.error(error);

    accessMessage.hidden = false;

    accessMessage.textContent =
      "Could not verify administrator access. Check Firestore rules and your internet connection.";
  }
});

// CREATE COURSE — NEW COURSES DEFAULT TO DRAFT
byId("courseForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const button = event.submitter;
  button.disabled = true;

  status("courseStatus", "Saving course…");

  try {
    const title = byId("courseTitle").value.trim();
    const shortDescription =
      byId("courseShortDescription").value.trim();
    const description =
      byId("courseDescription").value.trim();
    const image = byId("courseImage").value.trim();
    const duration = byId("courseDuration").value.trim();
    const mode = byId("courseMode").value.trim();
    const instructor = byId("courseInstructor").value.trim();
    const fee = byId("courseFee").value.trim();

    const objectives = byId("courseObjectives").value
      .split("\n")
      .map(item => item.trim())
      .filter(Boolean);

    const syllabus = byId("courseSyllabus").value
      .split("\n")
      .map(item => item.trim())
      .filter(Boolean);

    const published =
      byId("coursePublished").value === "true";

    if (!title) {
      throw new Error("Please enter a course title.");
    }

    await addDoc(collection(db, "courses"), {
      title,
      shortDescription,
      description,
      image,
      duration,
      mode,
      instructor,
      fee,
      objectives,
      syllabus,
      published,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    byId("courseForm").reset();
    byId("coursePublished").value = "false";

    status(
      "courseStatus",
      published
        ? "Course created and published."
        : "Draft course created successfully."
    );

    await loadCourses();

  } catch (error) {
    status(
      "courseStatus",
      `Could not create course: ${showError(error)}`
    );

  } finally {
    button.disabled = false;
  }
});

// CREATE MODULE — NEW MODULES DEFAULT TO DRAFT
byId("moduleForm")?.addEventListener("submit", async event => {
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
    const published =
      byId("modulePublished").value === "true";

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
    byId("modulePublished").value = "false";

    status("moduleStatus", "Module saved successfully.");

    selectedModuleCourse = courseId;
    byId("manageModuleCourse").value = courseId;

    await loadManagedModules(courseId);

  } catch (error) {
    status(
      "moduleStatus",
      `Could not save module: ${showError(error)}`
    );

  } finally {
    button.disabled = false;
  }
});

// APPROVE PARTICIPANT
byId("enrollmentForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const button = event.submitter;
  button.disabled = true;

  status("enrollmentStatus", "Granting permanent access…");

  try {
    const uid = byId("participantUid").value.trim();
    const email =
      byId("participantEmail").value.trim().toLowerCase();
    const name = byId("participantName").value.trim();
    const courseId = byId("enrollmentCourse").value;

    if (!uid || !courseId || !email || !name) {
      throw new Error("Complete all participant details.");
    }

    const course = courses.find(c => c.id === courseId);

    if (!course) {
      throw new Error("Selected course could not be found.");
    }

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

    await setDoc(
      participantRef,
      {
        uid,
        email,
        name,
        courseId,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

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
    status(
      "enrollmentStatus",
      `Could not approve participant: ${showError(error)}`
    );

  } finally {
    button.disabled = false;
  }
});
