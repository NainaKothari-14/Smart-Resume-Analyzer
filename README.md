# Smart Resume Analyzer
NLP-based resume evaluation system using keyword extraction and ATS scoring.

## Project Structure
```
resume-analyzer/
├── client/          ← React + Vite frontend
└── server/          ← Node.js + Express backend
```

## Setup & Run

### 1. Start the Server
```bash
cd server
npm install
npm run dev        # nodemon (auto-restart)
# OR
npm start          # plain node
```
Server runs at → http://localhost:5000

### 2. Start the Client
```bash
cd client
npm install
npm run dev
```
Client runs at → http://localhost:5173

---

## API Endpoints

| Method | Route          | Description                        |
|--------|----------------|------------------------------------|
| GET    | /api/health    | Server health check                |
| GET    | /api/roles     | Get all available job roles        |
| POST   | /api/analyze   | Analyze pasted resume text (JSON)  |
| POST   | /api/upload    | Analyze uploaded PDF or TXT file   |

### POST /api/analyze — Request Body
```json
{
  "text": "paste resume text here...",
  "role": "software_developer"
}
```

### POST /api/upload — Form Data
```
resume: <file>    (.pdf or .txt)
role:   "full_stack"
```

### Available Role Keys
- `software_developer`
- `full_stack`
- `data_analyst`
- `frontend_developer`
- `devops_engineer`

---

## How It Works (ADS Pipeline)

```
Input (resume text)
    ↓
normalizeText()     → synonym mapping (node.js → node)
    ↓
extractSkills()     → keyword matching across 6 categories
    ↓
checkSections()     → detect contact / education / projects etc.
    ↓
matchRole()         → required + preferred keyword gap analysis
    ↓
calcAtsScore()      → weighted: 60% skill match + 40% completeness
    ↓
generateSuggestions() → actionable feedback
    ↓
Output (JSON dashboard)
```

## Viva Line 🎤
> "We built an NLP-based resume evaluation system using keyword extraction
> and a weighted scoring model to simulate ATS systems used in industry.
> The system performs synonym normalization, section detection, and
> role-specific gap analysis to generate actionable feedback."
