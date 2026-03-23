// analyzer.js — Core NLP + Scoring Logic (v3)
const skillsData = require("./skills.json");

function normalizeText(text) {
  let t = text.toLowerCase();
  const smartMappings = [
    [/\bpostgresql\b|\bpostgres\b|\bpsql\b/g,                    "postgresql sql"],
    [/\bmysql\b/g,                                                "mysql sql"],
    [/\bsqlite\b/g,                                               "sqlite sql"],
    [/\boracle\s*db\b|\boracle\b/g,                               "oracle sql"],
    [/\bdata\s+structures\s+and\s+algorithms\b/g,                 "dsa"],
    [/\bdata\s+structures\b/g,                                    "dsa"],
    [/\balgorithms\b/g,                                           "dsa"],
    [/\bdata\s+structure\b/g,                                     "dsa"],
    [/\bnode\.js\b|\bnodejs\b/g,                                  "node nodejs"],
    [/\bnext\.js\b|\bnextjs\b/g,                                  "next"],
    [/\bvue\.js\b|\bvuejs\b/g,                                    "vue"],
    [/\breact\.js\b|\breactjs\b/g,                                "react"],
    [/\bobject[- ]oriented\b|\boop\b|\boops\b/g,                  "oop"],
    [/\bci\s*\/\s*cd\b|\bcicd\b|\bcontinuous\s+integration\b/g,  "ci/cd"],
    [/\bdeep[- ]learning\b/g,                                     "deep learning"],
    [/\bscikit[- ]learn\b|\bsklearn\b/g,                          "scikit"],
    [/\basp\.net\b|\b\.net\b/g,                                   "dotnet"],
    [/\bc\s*\+\+\b|\bcpp\b/g,                                     "c++"],
  ];
  for (const [regex, replacement] of smartMappings) t = t.replace(regex, replacement);
  const synonymMap = skillsData.synonyms;
  for (const [canonical, variants] of Object.entries(synonymMap)) {
    for (const variant of variants) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      t = t.replace(new RegExp(`\\b${escaped}\\b`, "gi"), canonical);
    }
  }
  return t;
}

function extractSkills(normalizedText) {
  const found = {}, allFound = [];
  for (const [catKey, catData] of Object.entries(skillsData.categories)) {
    const hits = [];
    for (const skill of catData.skills) {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`).test(normalizedText)) {
        hits.push(skill); allFound.push(skill);
      }
    }
    if (hits.length > 0) found[catKey] = { label: catData.label, skills: hits, count: hits.length };
  }
  return { byCategory: found, flat: [...new Set(allFound)] };
}

function checkSections(normalizedText) {
  const sections = skillsData.resume_sections, result = {};
  let foundCount = 0;
  for (const [section, keywords] of Object.entries(sections)) {
    const hasSection = keywords.some((kw) => normalizedText.includes(kw));
    result[section] = hasSection;
    if (hasSection) foundCount++;
  }
  const completenessScore = Math.round((foundCount / Object.keys(sections).length) * 100);
  return { sections: result, completenessScore, foundCount, total: Object.keys(sections).length };
}

function matchRole(normalizedText, roleKey) {
  const roles = skillsData.job_roles, role = roles[roleKey];
  if (!role) throw new Error(`Unknown role: ${roleKey}`);
  const requiredFound    = role.required.filter((s) => normalizedText.includes(s));
  const requiredMissing  = role.required.filter((s) => !normalizedText.includes(s));
  const preferredFound   = role.preferred.filter((s) => normalizedText.includes(s));
  const preferredMissing = role.preferred.filter((s) => !normalizedText.includes(s));
  const reqScore  = role.required.length  > 0 ? (requiredFound.length  / role.required.length)  * 70 : 0;
  const prefScore = role.preferred.length > 0 ? (preferredFound.length / role.preferred.length) * 30 : 0;
  const skillMatchScore = Math.round(reqScore + prefScore);
  return { role: role.label, requiredFound, requiredMissing, preferredFound, preferredMissing, skillMatchScore };
}

function calcAtsScore(skillMatchScore, sectionResult) {
  const { sections, completenessScore } = sectionResult;
  const raw = skillMatchScore * 0.50 + (sections.projects ? 100 : 0) * 0.20 +
              (sections.experience ? 100 : 0) * 0.20 + completenessScore * 0.10;
  return Math.min(98, Math.max(15, Math.round(raw)));
}

// ─── NEW: Best Suited Role ────────────────────────────────────────────────────
function findBestRole(normalizedText) {
  const roles = skillsData.job_roles;
  let bestRole = null, bestScore = -1;
  for (const [key, role] of Object.entries(roles)) {
    const found = role.required.filter((s) => normalizedText.includes(s));
    const score = found.length / role.required.length;
    if (score > bestScore) { bestScore = score; bestRole = { key, label: role.label, score: Math.round(score * 100) }; }
  }
  return bestRole;
}

// ─── NEW: Strength Line ───────────────────────────────────────────────────────
function generateStrengthLine(atsScore, skillResult, roleMatch, sectionResult) {
  const { byCategory } = skillResult;
  const cats = Object.entries(byCategory).sort((a, b) => b[1].count - a[1].count);
  const topCat = cats[0]?.[1]?.label || "technical";
  const missingCount = roleMatch.requiredMissing.length;

  if (atsScore >= 80) {
    return `Your resume is strong overall — especially in ${topCat} skills. Minor gaps can be filled quickly.`;
  } else if (atsScore >= 60) {
    if (missingCount > 0) {
      return `Your resume is good in ${topCat} but needs improvement in ${roleMatch.requiredMissing.slice(0,2).join(", ")} to be competitive.`;
    }
    return `Decent profile — strengthen your ${topCat} projects and add more keywords to boost your score.`;
  } else {
    return `Resume needs work — focus on adding missing skills and expanding your projects section to pass ATS filters.`;
  }
}

// ─── NEW: JD Match ───────────────────────────────────────────────────────────
function matchJD(resumeText, jdText) {
  if (!jdText || jdText.trim().length < 20) return null;

  const normResume = normalizeText(resumeText);
  const normJD     = normalizeText(jdText);

  // Extract all meaningful words from JD (4+ chars, not common words)
  const stopWords = new Set(["with","that","this","have","from","they","will","been","your","more","also","into","than","then","when","where","what","which","there","their","these","those","about","would","could","should","must","need","make","each","like","over","such","only","both","after","before","other","while","through","during","within","without","between","under","above","below","around","along","across","behind","against","toward","upon","inside","outside","using","used","able","want","well","good","best","high","low","key","new","way","our","can","may","will","shall","has","had","its","for","are","was","were","the","and","but","not","all","any","some","most","many","much","few","just","even","very","here","now","how","who","why"]);

  const jdWords = [...new Set(
    normJD.match(/\b[a-z][a-z0-9+#.]{2,}\b/g)?.filter(w => !stopWords.has(w)) || []
  )];

  // Check which JD keywords appear in resume
  const matched = jdWords.filter(w => normResume.includes(w));
  const missing = jdWords.filter(w => !normResume.includes(w)).slice(0, 12);
  const jdScore = jdWords.length > 0 ? Math.min(98, Math.round((matched.length / jdWords.length) * 100)) : 0;

  return { jdScore, matched: matched.slice(0, 15), missing, totalJDKeywords: jdWords.length };
}

function generateSuggestions(sectionResult, roleMatch, skillsFlat, textLength) {
  const suggestions = [];
  const { sections } = sectionResult;
  const hasGithub = skillsFlat.includes("github") || skillsFlat.includes("portfolio");
  if (!sections.contact)      suggestions.push("Add your email, phone number, and LinkedIn URL — recruiters check these first.");
  if (!sections.education)    suggestions.push("Add an Education section with your degree, institution, and CGPA.");
  if (!sections.experience)   suggestions.push("Add internship or work experience using action verbs: built, led, optimized, deployed.");
  if (!sections.projects)     suggestions.push("Add a Projects section — describe what you built, what tech you used, and the impact.");
  if (!sections.skills)       suggestions.push("Add a dedicated Skills section so ATS parsers can find your keywords instantly.");
  if (!sections.achievements) suggestions.push("Add achievements, certifications, or hackathon wins to differentiate yourself.");
  const skillMessages = {
    dsa:"Add DSA (Data Structures and Algorithms) — mention problem-solving on LeetCode/HackerRank.",
    sql:"Add SQL experience — even basic queries from your projects count.",
    oop:"Mention OOP concepts (classes, inheritance) — very common in Software Developer JDs.",
    rest:"Mention REST APIs — if you built any backend routes, that qualifies.",
    api:"Use the word 'API' when describing integrations or backend work.",
    linux:"Add Linux/terminal experience if you use it for development.",
    docker:"Add Docker if you've containerized any project — even locally.",
    aws:"Add AWS/cloud experience — even free-tier projects count.",
  };
  for (const missing of roleMatch.requiredMissing.slice(0, 3)) {
    suggestions.push(skillMessages[missing] || `Add missing core skill: ${missing} — required for this role.`);
  }
  if (roleMatch.preferredMissing.length > 2)
    suggestions.push(`Bonus keywords to strengthen your profile: ${roleMatch.preferredMissing.slice(0,3).join(", ")}.`);
  if (textLength < 300) suggestions.push("Resume is too short — add more detail about your projects and responsibilities.");
  if (!hasGithub) suggestions.push("Include your GitHub profile link — it lets recruiters verify your actual work.");
  return suggestions;
}

function analyze(rawText, roleKey = "software_developer", jdText = "") {
  if (!rawText || rawText.trim().length < 50)
    throw new Error("Resume text is too short. Please paste a complete resume.");

  const normalizedText = normalizeText(rawText);
  const skillResult    = extractSkills(normalizedText);
  const sectionResult  = checkSections(normalizedText);
  const roleMatch      = matchRole(normalizedText, roleKey);
  const atsScore       = calcAtsScore(roleMatch.skillMatchScore, sectionResult);
  const suggestions    = generateSuggestions(sectionResult, roleMatch, skillResult.flat, rawText.length);
  const bestRole       = findBestRole(normalizedText);
  const strengthLine   = generateStrengthLine(atsScore, skillResult, roleMatch, sectionResult);
  const jdMatch        = matchJD(rawText, jdText);

  return {
    atsScore,
    skillMatchScore:   roleMatch.skillMatchScore,
    completenessScore: sectionResult.completenessScore,
    strengthLine,
    bestRole,
    jdMatch,
    skills: { byCategory: skillResult.byCategory, flat: skillResult.flat, totalFound: skillResult.flat.length },
    roleAnalysis: {
      role: roleMatch.role, requiredFound: roleMatch.requiredFound,
      requiredMissing: roleMatch.requiredMissing, preferredFound: roleMatch.preferredFound,
      preferredMissing: roleMatch.preferredMissing,
    },
    sections:    sectionResult.sections,
    suggestions,
    meta: { wordCount: rawText.trim().split(/\s+/).length, charCount: rawText.length, analyzedAt: new Date().toISOString() },
  };
}

module.exports = { analyze, normalizeText, extractSkills };