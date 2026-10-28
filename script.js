
const STUDENT_KEY = "attendify_students_final";
const ATTENDANCE_KEY = "attendify_attendance_final";
const THRESHOLD_KEY = "attendify_threshold_final";

const DEPARTMENT = "BSc Computer Science";
const STATUSES = ["Present", "Absent", "Late", "Leave", "On Duty"];
const COUNTED_STATUSES = ["Present", "Absent", "Late", "On Duty"];
const ATTENDED_STATUSES = ["Present", "Late", "On Duty"];

const sampleNames = [
  "Aadhira Kumar", "Aarav Raj", "Abinaya Devi", "Adithya Prakash",
  "Akash Kumar", "Ananya Suresh", "Arjun Vel", "Ashwin Raj",
  "Bhavani Priya", "Dharani M", "Divya Lakshmi", "Gokul Krishna",
  "Harini Devi", "Kavin Raj", "Keerthana S", "Lokesh Kumar",
  "Madhumitha R", "Manoj Prabhu", "Monisha Devi", "Naveen Kumar",
  "Nithya Sri", "Praveen Raj", "Sanjana R", "Surya Prakash",
  "Yazhini Devi"
];

const $ = id => document.getElementById(id);

function loadData(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function makeSampleStudents() {
  return sampleNames.map((name, index) => ({
    id: `BCS${String(index + 1).padStart(3, "0")}`,
    name,
    department: DEPARTMENT
  }));
}

let students = loadData(STUDENT_KEY, null);
let attendance = loadData(ATTENDANCE_KEY, {});
let threshold = Number(loadData(THRESHOLD_KEY, 75));
let editingId = null;

if (!Array.isArray(students)) {
  students = makeSampleStudents();
  saveData(STUDENT_KEY, students);
}

if (!attendance || typeof attendance !== "object" ||
    Array.isArray(attendance)) {
  attendance = {};
  saveData(ATTENDANCE_KEY, attendance);
}

if (!Number.isFinite(threshold) || threshold < 1 || threshold > 100) {
  threshold = 75;
}

function todayString() {
  const date = new Date();

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function keyFor(studentId, date) {
  return `${studentId}_${date}`;
}

function getStatus(studentId, date) {
  return attendance[keyFor(studentId, date)] || "Not Marked";
}

// Corrected timezone-safe date validation
function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);

  return parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function statusClass(status) {
  return "status-" + status.replace(/\s+/g, "-");
}

function formatDate(date) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function recordsFor(studentId) {
  const prefix = `${studentId}_`;

  return Object.entries(attendance)
    .filter(([key, status]) =>
      key.startsWith(prefix) && STATUSES.includes(status)
    )
    .map(([key, status]) => ({
      date: key.slice(prefix.length),
      status
    }));
}

// Leave is excluded. Present, Late, and On Duty count as attended.
function getPercentage(studentId) {
  const records = recordsFor(studentId).filter(record =>
    COUNTED_STATUSES.includes(record.status)
  );

  if (records.length === 0) return null;

  const attended = records.filter(record =>
    ATTENDED_STATUSES.includes(record.status)
  ).length;

  return Math.round(attended / records.length * 100);
}

function getDateSummary(date) {
  let present = 0;
  let absent = 0;
  let eligible = 0;
  let marked = 0;

  students.forEach(student => {
    const status = getStatus(student.id, date);

    if (STATUSES.includes(status)) marked++;
    if (status === "Present") present++;
    if (status === "Absent") absent++;

    if (COUNTED_STATUSES.includes(status)) eligible++;
  });

  const attended = students.filter(student =>
    ATTENDED_STATUSES.includes(getStatus(student.id, date))
  ).length;

  return {
    present,
    absent,
    marked,
    percentage: eligible === 0
      ? 0
      : Math.round(attended / eligible * 100)
  };
}

function showMessage(message, type = "success") {
  $("formMessage").textContent = message;
  $("formMessage").className = `message ${type}`;
}

function resetForm() {
  editingId = null;
  $("studentForm").reset();
  $("studentId").disabled = false;
  $("formTitle").textContent = "Add a Student";
  $("saveStudentBtn").textContent = "+ Add Student";
  $("cancelEditBtn").hidden = true;
}

$("studentForm").addEventListener("submit", event => {
  event.preventDefault();

  const id = $("studentId").value.trim().toUpperCase();
  const name = $("studentName").value.trim();
  const department = $("studentDepartment").value;

  if (!id || !name) {
    showMessage("Please enter the student ID and full name.", "error");
    return;
  }

  if (!/^[A-Z0-9-]+$/.test(id)) {
    showMessage("Use only letters, numbers, or hyphens in the student ID.", "error");
    return;
  }

  if (name.length < 2) {
    showMessage("Please enter a valid student name.", "error");
    return;
  }

  const duplicate = students.some(student =>
    student.id.toLowerCase() === id.toLowerCase() &&
    student.id !== editingId
  );

  if (duplicate) {
    showMessage("That student ID already exists. Please use a unique ID.", "error");
    return;
  }

  if (editingId) {
    const oldId = editingId;
    const student = students.find(item => item.id === oldId);

    if (!student) {
      showMessage("Student not found. Please refresh and try again.", "error");
      resetForm();
      return;
    }

    student.id = id;
    student.name = name;
    student.department = department;

    // Preserve attendance history if the student ID changes.
    if (oldId !== id) {
      const movedRecords = {};

      Object.entries(attendance).forEach(([key, status]) => {
        if (key.startsWith(`${oldId}_`)) {
          const date = key.slice(oldId.length + 1);
          movedRecords[keyFor(id, date)] = status;
          delete attendance[key];
        }
      });

      Object.assign(attendance, movedRecords);
      saveData(ATTENDANCE_KEY, attendance);
    }

    saveData(STUDENT_KEY, students);
    resetForm();
    showMessage("Student details updated successfully.");
  } else {
    students.push({ id, name, department });
    saveData(STUDENT_KEY, students);
    resetForm();
    showMessage("Student added successfully.");
  }

  render();
});

$("cancelEditBtn").addEventListener("click", () => {
  resetForm();
  showMessage("Edit cancelled.");
});

function editStudent(studentId) {
  const student = students.find(item => item.id === studentId);
  if (!student) return;

  editingId = student.id;
  $("studentId").value = student.id;
  $("studentName").value = student.name;
  $("studentDepartment").value = student.department;
  $("studentId").disabled = false;
  $("formTitle").textContent = "Edit Student Details";
  $("saveStudentBtn").textContent = "Save Changes";
  $("cancelEditBtn").hidden = false;

  $("studentForm").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function deleteStudent(studentId) {
  const student = students.find(item => item.id === studentId);
  if (!student) return;

  if (!confirm(`Delete ${student.name} (${student.id}) and their attendance history?`)) {
    return;
  }

  students = students.filter(item => item.id !== studentId);

  Object.keys(attendance).forEach(key => {
    if (key.startsWith(`${studentId}_`)) delete attendance[key];
  });

  saveData(STUDENT_KEY, students);
  saveData(ATTENDANCE_KEY, attendance);

  if (editingId === studentId) resetForm();

  $("historyPanel").hidden = true;
  showMessage("Student and their attendance history deleted.");
  render();
}

// A single student/date key prevents duplicate attendance records.
function setAttendance(studentId, date, status) {
  if (!students.some(student => student.id === studentId)) return;

  if (!validDate(date)) {
    alert("Please choose a valid date.");
    return;
  }

  const key = keyFor(studentId, date);

  if (status === "Not Marked") {
    delete attendance[key];
  } else if (STATUSES.includes(status)) {
    attendance[key] = status;
  } else {
    return;
  }

  saveData(ATTENDANCE_KEY, attendance);
  render();
}

function renderStudents() {
  const date = $("attendanceDate").value;
  const query = $("searchInput").value.trim().toLowerCase();
  const department = $("departmentFilter").value;
  const statusFilter = $("statusFilter").value;

  const filtered = students.filter(student => {
    const status = getStatus(student.id, date);

    const matchesQuery =
      student.name.toLowerCase().includes(query) ||
      student.id.toLowerCase().includes(query) ||
      student.department.toLowerCase().includes(query);

    const matchesDepartment =
      department === "all" || student.department === department;

    const matchesStatus =
      statusFilter === "all" || status === statusFilter;

    return matchesQuery && matchesDepartment && matchesStatus;
  });

  $("studentTable").innerHTML = filtered.map((student, index) => {
    const status = getStatus(student.id, date);
    const percentage = getPercentage(student.id);
    const low = percentage !== null && percentage < threshold;
    const percentText = percentage === null ? "No data" : `${percentage}%`;

    return `
      <tr class="${low ? "low-row" : ""}">
        <td>${index + 1}</td>
        <td class="student-id">${escapeHTML(student.id)}</td>
        <td class="student-name">${escapeHTML(student.name)}</td>
        <td class="department">${escapeHTML(student.department)}</td>
        <td class="percent-cell">
          <span class="percent-label">${percentText}</span>
          <div class="progress">
            <div class="progress-fill"
              style="width:${percentage === null ? 0 : percentage}%"></div>
          </div>
        </td>
        <td>
          <select class="status-select ${statusClass(status)}"
            data-status-id="${escapeHTML(student.id)}"
            aria-label="Attendance status for ${escapeHTML(student.name)}">
            <option value="Not Marked" ${status === "Not Marked" ? "selected" : ""}>Not Marked</option>
            ${STATUSES.map(option => `
              <option value="${option}" ${status === option ? "selected" : ""}>${option}</option>
            `).join("")}
          </select>
        </td>
        <td>
          <button class="small-btn" data-history-id="${escapeHTML(student.id)}">History</button>
        </td>
        <td>
          <div class="row-actions">
            <button class="small-btn" data-edit-id="${escapeHTML(student.id)}">Edit</button>
            <button class="small-btn delete-btn" data-delete-id="${escapeHTML(student.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  $("emptyMessage").hidden = filtered.length !== 0;

  $("studentTable").querySelectorAll("[data-status-id]").forEach(select => {
    select.addEventListener("change", event => {
      setAttendance(event.target.dataset.statusId, date, event.target.value);
    });
  });

  $("studentTable").querySelectorAll("[data-history-id]").forEach(button => {
    button.addEventListener("click", () => showHistory(button.dataset.historyId));
  });

  $("studentTable").querySelectorAll("[data-edit-id]").forEach(button => {
    button.addEventListener("click", () => editStudent(button.dataset.editId));
  });

  $("studentTable").querySelectorAll("[data-delete-id]").forEach(button => {
    button.addEventListener("click", () => deleteStudent(button.dataset.deleteId));
  });
}

function renderAlerts() {
  const lowStudents = students
    .map(student => ({
      student,
      percentage: getPercentage(student.id)
    }))
    .filter(item =>
      item.percentage !== null && item.percentage < threshold
    )
    .sort((a, b) => a.percentage - b.percentage);

  $("lowAttendanceList").innerHTML = lowStudents.length
    ? lowStudents.map(({ student, percentage }) => `
        <div class="alert-item">
          <strong>${escapeHTML(student.name)}</strong>
          (${escapeHTML(student.id)}) has ${percentage}% attendance,
          below your ${threshold}% threshold.
        </div>
      `).join("")
    : `<div class="good-message">
        No students with recorded attendance are below ${threshold}%.
      </div>`;
}

function showHistory(studentId) {
  const student = students.find(item => item.id === studentId);
  if (!student) return;

  const records = recordsFor(studentId)
    .sort((a, b) => b.date.localeCompare(a.date));

  const percentage = getPercentage(studentId);

  $("historyTitle").textContent = `${student.name} — Attendance History`;
  $("historySubtitle").textContent =
    `${student.id} · ${student.department}`;

  $("historySummary").textContent = percentage === null
    ? "No eligible attendance records have been marked for this student."
    : `Attendance percentage: ${percentage}% · ${records.length} recorded days. Leave is excluded from the percentage calculation.`;

  $("historyTable").innerHTML = records.length
    ? records.map(record => `
        <tr>
          <td>${formatDate(record.date)}</td>
          <td>
            <span class="status-select ${statusClass(record.status)}"
              style="display:inline-block;width:auto">
              ${escapeHTML(record.status)}
            </span>
          </td>
        </tr>
      `).join("")
    : `<tr><td colspan="2">No attendance history yet.</td></tr>`;

  $("historyPanel").hidden = false;
  $("historyPanel").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function render() {
  const date = $("attendanceDate").value;
  const summary = getDateSummary(date);

  $("totalStudents").textContent = students.length;
  $("presentCount").textContent = summary.present;
  $("absentCount").textContent = summary.absent;
  $("overallPercentage").textContent = `${summary.percentage}%`;
  $("markedLabel").textContent = `${summary.marked} / ${students.length} marked`;

  renderStudents();
  renderAlerts();
}

function markAll(status) {
  const date = $("attendanceDate").value;

  if (!validDate(date)) {
    alert("Please choose a valid attendance date.");
    return;
  }

  const verb = status === "Present" ? "present" : "absent";

  if (!confirm(`Mark all ${students.length} students ${verb} for ${formatDate(date)}?`)) {
    return;
  }

  students.forEach(student => {
    attendance[keyFor(student.id, date)] = status;
  });

  saveData(ATTENDANCE_KEY, attendance);
  render();
}

$("markAllPresent").addEventListener("click", () => markAll("Present"));
$("markAllAbsent").addEventListener("click", () => markAll("Absent"));

$("attendanceDate").value = todayString();

$("attendanceDate").addEventListener("change", render);
$("searchInput").addEventListener("input", render);
$("departmentFilter").addEventListener("change", render);
$("statusFilter").addEventListener("change", render);

$("threshold").value = threshold;

$("threshold").addEventListener("change", event => {
  const value = Number(event.target.value);

  if (!Number.isFinite(value) || value < 1 || value > 100) {
    alert("Please enter a threshold between 1 and 100.");
    event.target.value = threshold;
    return;
  }

  threshold = value;
  saveData(THRESHOLD_KEY, threshold);
  render();
});

$("closeHistory").addEventListener("click", () => {
  $("historyPanel").hidden = true;
});

render();
