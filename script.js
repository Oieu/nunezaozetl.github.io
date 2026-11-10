const programs = {
  BSIT: "Bachelor of Science in Information Technology",
  BSCS: "Bachelor of Science in Computer Science",
  BSIS: "Bachelor of Science in Information Systems"
};

const form = document.getElementById("csvForm");
const message = document.getElementById("message");
const output = document.getElementById("output");

function clean(value) {
  return String(value ?? "").trim();
}

function properCase(value) {
  return clean(value).toLowerCase().replace(/\b\p{L}/gu, letter => letter.toUpperCase());
}

function idOf(value) {
  const text = clean(value);
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) ? number : null;
}

function numberOrNull(value) {
  const text = clean(value).replace(/[₱,\s]/g, "");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function gradeOf(value) {
  const grade = clean(value);
  if (!grade) return null;
  const numeric = Number(grade);
  return Number.isFinite(numeric) ? numeric : grade.toUpperCase();
}

function readCSV(file, requiredFields) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Please select all three CSV files."));
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: header => header.replace(/^\uFEFF/, "").trim(),
      complete(results) {
        const fields = results.meta.fields || [];
        const missing = requiredFields.filter(field => !fields.includes(field));
        if (missing.length) {
          return reject(new Error(`${file.name}: missing columns ${missing.join(", ")}`));
        }
        if (results.errors.length) {
          return reject(new Error(`${file.name}: ${results.errors[0].message}`));
        }
        resolve(results.data);
      },
      error(error) { reject(error); }
    });
  });
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  output.textContent = "";

  try {
    const [sisRows, lmsRows, accountingRows] = await Promise.all([
      readCSV(document.getElementById("sisFile").files[0],
        ["student_id", "student_name", "program_code", "email"]),
      readCSV(document.getElementById("lmsFile").files[0],
        ["student_id", "course_code", "final_grade", "completion_status"]),
      readCSV(document.getElementById("accountingFile").files[0],
        ["student_id", "account_balance", "currency"])
    ]);

    const students = new Map();

    // SIS is the primary system: every valid SIS student is retained.
    sisRows.forEach(row => {
      const studentId = idOf(row.student_id);
      if (studentId === null) {
        return;
      }
      if (students.has(studentId)) {
        return;
      }
      const code = clean(row.program_code).toUpperCase();

      students.set(studentId, {
        studentId,
        studentName: properCase(row.student_name),
        program: programs[code] || code || null,
        emailAddress: clean(row.email).toLowerCase(),
        courses: [],
        outstandingBalance: null,
        currency: null
      });
    });

   
    lmsRows.forEach(row => {
      const studentId = idOf(row.student_id);
      const student = students.get(studentId);
      if (!student) {
        return;
      }
      student.courses.push({
        courseCode: clean(row.course_code).toUpperCase(),
        finalGrade: gradeOf(row.final_grade),
        completionStatus: properCase(row.completion_status) || null
      });
    });

 
    const accountingCounts = new Map();
    accountingRows.forEach(row => {
      const studentId = idOf(row.student_id);
      const student = students.get(studentId);
      if (!student) {
        return;
      }
      accountingCounts.set(studentId, (accountingCounts.get(studentId) || 0) + 1);
      const balance = numberOrNull(row.account_balance);
      if (accountingCounts.get(studentId) === 1) {
        student.outstandingBalance = balance;
        student.currency = clean(row.currency).toUpperCase() || null;
      } else {
        student.outstandingBalance = null;
        student.currency = null;
      }
    });

    const merged = Array.from(students.values());
    output.textContent = JSON.stringify(merged, null, 2);
  } catch (error) {
    message.textContent = `Error: ${error.message}`;
    output.textContent = "No output generated.";
  }
});
