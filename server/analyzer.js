// analyzer.js — Core NLP + Scoring Logic (v2 — improved)
const skillsData = require("./skills.json");

// ─── STEP 1: Normalize text ───────────────────────────────────────────────────
// Converts synonyms → canonical form so matching is consistent
// e.g. "PostgreSQL" → "postgresql" → also marks "sql" as present
// e.g. "Data Structures and Algorithms" → "dsa"
function normalizeText(text) {
  let t = text.toLowerCase();

  // Built-in smart mappings (before skills.json synonyms)
  const smartMappings = [
    // SQL family — if any SQL DB mentioned, treat as sql
    [/\bpostgresql\b|\bpostgres\b|\bpsql\b/g,          "postgresql sql"],
    [/\bmysql\b/g,                                      "mysql sql"],
    [/\bsqlite\b/g,                                     "sqlite sql"],
    [/\boracle\s*db\b|\boracle\b/g,                     "oracle sql"],

    // DSA variants
    [/\bdata\s+structures\s+and\s+algorithms\b/g,       "dsa"],
    [/\bdata\s+structures\b/g,                          "dsa"],
    [/\balgorithms\b/g,                                 "dsa"],
    [/\bdata\s+structure\b/g,                           "dsa"],

    // Node variants
    [/\bnode\.js\b|\bnodejs\b/g,                        "node nodejs"],
    [/\bnext\.js\b|\bnextjs\b/g,                        "next"],
    [/\bvue\.js\b|\bvuejs\b/g,                          "vue"],
    [/\breact\.js\b|\breactjs\b/g,                      "react"],

    // OOP variants
    [/\bobject[- ]oriented\b|\boop\b|\boops\b/g,        "oop"],

    // CI/CD
    [/\bci\s*\/\s*cd\b|\bcicd\b|\bcontinuous\s+integration\b/g, "ci/cd"],

    // Deep learning
    [/\bdeep[- ]learning\b/g,                           "deep learning"],

    // scikit
    [/\bscikit[- ]learn\b|\bsklearn\b/g,                "scikit"],

    // .NET
    [/\basp\.net\b|\b\.net\b/g,                         "dotnet"],

    // C++
    [/\bc\s*\+\+\b|\bcpp\b/g,                           "c++"],
  ];

  for (const [regex, replacement] of smartMappings) {
    t = t.replace(regex, replacement);
  }

  // Apply synonyms from skills.json
  const synonymMap = skillsData.synonyms;
  for (const [canonical, variants] of Object.entries(synonymMap)) {
    for (const variant of variants) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(`\\b${escaped}\\b`, "gi");
      t = t.replace(rx, canonical);
    }
  }

  return t;
}

// ─── STEP 2: Keyword / Skill Extraction ───────────────────────────────────────
function extractSkills(normalizedText) {
  const found    = {};
  const allFound = [];

  for (const [catKey, catData] of Object.entries(skillsData.categories)) {
    const hits = [];
    for (const skill of catData.skills) {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex   = new RegExp(`\\b${escaped}\\b`);
      if (regex.test(normalizedText)) {
        hits.push(skill);
        allFound.push(skill);
      }
    }
    if (hits.length > 0) {
      found[catKey] = { label: catData.label, skills: hits, count: hits.length };
    }
  }

  return { byCategory: found, flat: [...new Set(allFound)] };
}

// ─── STEP 3: Resume Section Completeness Check ───────────────────────────────
function checkSections(normalizedText) {
  const sections = skillsData.resume_sections;
  const result   = {};
  let foundCount = 0;

  for (const [section, keywords] of Object.entries(sections)) {
    const hasSection = keywords.some((kw) => normalizedText.includes(kw));
    result[section] = hasSection;
    if (hasSection) foundCount++;
  }

  const completenessScore = Math.round((foundCount / Object.keys(sections).length) * 100);
  return { sections: result, completenessScore, foundCount, total: Object.keys(sections).length };
}

// ─── STEP 4: Role-Based Keyword Matching ──────────────────────────────────────
function matchRole(normalizedText, roleKey) {
  const roles = skillsData.job_roles;
  const role  = roles[roleKey];
  if (!role) throw new Error(`Unknown role: ${roleKey}`);

  const requiredFound    = role.required.filter((s) => normalizedText.includes(s));
  const requiredMissing  = role.required.filter((s) => !normalizedText.includes(s));
  const preferredFound   = role.preferred.filter((s) => normalizedText.includes(s));
  const preferredMissing = role.preferred.filter((s) => !normalizedText.includes(s));

  // Weighted: required 70% + preferred 30%
  const reqScore  = role.required.length  > 0 ? (requiredFound.length  / role.required.length)  * 70 : 0;
  const prefScore = role.preferred.length > 0 ? (preferredFound.length / role.preferred.length) * 30 : 0;
  const skillMatchScore = Math.round(reqScore + prefScore);

  return { role: role.label, requiredFound, requiredMissing, preferredFound, preferredMissing, skillMatchScore };
}

// ─── STEP 5: ATS Score — improved weighted formula ───────────────────────────
// Old: skills 60% + completeness 40%  ← too generous
// New: skills 50% + projects 20% + experience 20% + sections 10%
function calcAtsScore(skillMatchScore, sectionResult) {
  const { sections, completenessScore } = sectionResult;

  const projectScore    = sections.projects    ? 100 : 0;
  const experienceScore = sections.experience  ? 100 : 0;

  const raw =
    skillMatchScore  * 0.50 +
    projectScore     * 0.20 +
    experienceScore  * 0.20 +
    completenessScore * 0.10;

  return Math.min(98, Math.max(15, Math.round(raw)));
}

// ─── STEP 6: Smart Suggestions ────────────────────────────────────────────────
// Context-aware: suggestions reference actual detected skills/sections
function generateSuggestions(sectionResult, roleMatch, skillsFlat, textLength) {
  const suggestions = [];
  const { sections } = sectionResult;
  const hasGithub = skillsFlat.includes("github") || skillsFlat.includes("portfolio");

  // Section-based
  if (!sections.contact)
    suggestions.push("Add your email, phone number, and LinkedIn URL — recruiters check these first.");
  if (!sections.education)
    suggestions.push("Add an Education section with your degree, institution, and CGPA.");
  if (!sections.experience)
    suggestions.push("Add internship or work experience using action verbs: built, led, optimized, deployed.");
  if (!sections.projects)
    suggestions.push("Add a Projects section — describe what you built, what tech you used, and the impact.");
  if (!sections.skills)
    suggestions.push("Add a dedicated Skills section so ATS parsers can find your keywords instantly.");
  if (!sections.achievements)
    suggestions.push("Add achievements, certifications, or hackathon wins to differentiate yourself.");

  // Skill gap — smarter messages per missing skill
  const skillMessages = {
    dsa:    "Add DSA (Data Structures and Algorithms) — mention problem-solving on LeetCode/HackerRank.",
    sql:    "Add SQL experience — even basic queries from your projects count.",
    oop:    "Mention OOP concepts (classes, inheritance) — very common in Software Developer JDs.",
    rest:   "Mention REST APIs — if you built any backend routes, that qualifies.",
    api:    "Use the word 'API' when describing integrations or backend work.",
    linux:  "Add Linux/terminal experience if you use it for development.",
    docker: "Add Docker if you've containerized any project — even locally.",
    aws:    "Add AWS/cloud experience — even free-tier projects count.",
  };

  for (const missing of roleMatch.requiredMissing.slice(0, 3)) {
    const msg = skillMessages[missing]
      || `Add missing core skill: ${missing} — required for this role.`;
    suggestions.push(msg);
  }

  // Preferred gaps
  if (roleMatch.preferredMissing.length > 2) {
    const top = roleMatch.preferredMissing.slice(0, 3).join(", ");
    suggestions.push(`Bonus keywords to strengthen your profile: ${top}.`);
  }

  // Length
  if (textLength < 300)
    suggestions.push("Resume is too short — add more detail about your projects and responsibilities.");

  // GitHub
  if (!hasGithub)
    suggestions.push("Include your GitHub profile link — it lets recruiters verify your actual work.");

  return suggestions;
}

// ─── MAIN EXPORT: analyze() ────────────────────────────────────────────────────
function analyze(rawText, roleKey = "software_developer") {
  if (!rawText || rawText.trim().length < 50) {
    throw new Error("Resume text is too short. Please paste a complete resume.");
  }

  const normalizedText = normalizeText(rawText);

  const skillResult   = extractSkills(normalizedText);
  const sectionResult = checkSections(normalizedText);
  const roleMatch     = matchRole(normalizedText, roleKey);
  const atsScore      = calcAtsScore(roleMatch.skillMatchScore, sectionResult);
  const suggestions   = generateSuggestions(sectionResult, roleMatch, skillResult.flat, rawText.length);

  return {
    atsScore,
    skillMatchScore:   roleMatch.skillMatchScore,
    completenessScore: sectionResult.completenessScore,

    skills: {
      byCategory: skillResult.byCategory,
      flat:       skillResult.flat,
      totalFound: skillResult.flat.length,
    },

    roleAnalysis: {
      role:             roleMatch.role,
      requiredFound:    roleMatch.requiredFound,
      requiredMissing:  roleMatch.requiredMissing,
      preferredFound:   roleMatch.preferredFound,
      preferredMissing: roleMatch.preferredMissing,
    },

    sections:    sectionResult.sections,
    suggestions,

    meta: {
      wordCount:  rawText.trim().split(/\s+/).length,
      charCount:  rawText.length,
      analyzedAt: new Date().toISOString(),
    },
  };
}

module.exports = { analyze, normalizeText, extractSkills };