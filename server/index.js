// index.js — Express Server
const express = require("express");
const cors    = require("cors");
const multer  = require("multer");
const path    = require("path");

const { analyze } = require("./analyzer");
const skillsData   = require("./skills.json");

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Only .pdf and .txt files are allowed"));
  },
});

function extractPdfText(buffer) {
  return new Promise((resolve, reject) => {
    const PDFParser = require("pdf2json");
    const parser = new PDFParser(null, 1);
    parser.on("pdfParser_dataReady", () => resolve(parser.getRawTextContent()));
    parser.on("pdfParser_dataError", (e) => reject(new Error(e.parserError || "PDF parse failed")));
    parser.parseBuffer(buffer);
  });
}

app.get("/api/roles", (req, res) => {
  const roles = Object.entries(skillsData.job_roles).map(([key, val]) => ({ key, label: val.label }));
  res.json({ roles });
});

app.post("/api/analyze", (req, res) => {
  try {
    const { text, role } = req.body;
    if (!text || typeof text !== "string") return res.status(400).json({ error: "Missing or invalid resume text." });
    const validRoles = Object.keys(skillsData.job_roles);
    const selectedRole = validRoles.includes(role) ? role : "software_developer";
    const result = analyze(text, selectedRole);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("[/api/analyze]", err.message);
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/upload", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    let text = "";
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === ".txt") {
      text = req.file.buffer.toString("utf-8");
    } else if (ext === ".pdf") {
      try {
        text = await extractPdfText(req.file.buffer);
      } catch (pdfErr) {
        console.error("[pdf error]", pdfErr.message);
        return res.status(400).json({ error: "Could not read this PDF. Make sure it is not password-protected, or paste your resume text directly." });
      }
    }

    if (!text || text.trim().length < 50) return res.status(400).json({ error: "Could not extract enough text from the file." });

    const validRoles = Object.keys(skillsData.job_roles);
    const role = validRoles.includes(req.body.role) ? req.body.role : "software_developer";
    const result = analyze(text, role);
    res.json({ success: true, data: result, extractedText: text.slice(0, 300) + "..." });

  } catch (err) {
    console.error("[/api/upload]", err.message);
    res.status(500).json({ error: "File processing failed: " + err.message });
  }
});

app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`\nResume Analyzer Server running on port ${PORT}`);
});