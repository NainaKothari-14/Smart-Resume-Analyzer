import { useState, useRef, useEffect } from "react";
import { generatePDF } from "./Generatepdf";
import { analyzeText, uploadFile, fetchRoles } from "./api";

function Ring({ value, size = 130, stroke = 10, label, color }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute", top: 0, left: 0 }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e2026" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1.1s cubic-bezier(.22,1,.36,1)", filter: `drop-shadow(0 0 6px ${color}88)` }} />
        </svg>
        <div style={{ position: "absolute", top: 0, left: 0, width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: "#e8eaf0", lineHeight: 1, letterSpacing: "-0.02em" }}>{value}%</span>
        </div>
      </div>
      <span style={{ fontSize: 11, color: "#7a7f8e", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function Pill({ label, type }) {
  const styles = {
    found:   { background: "rgba(0,200,150,0.12)",  color: "#00c896", border: "1px solid rgba(0,200,150,0.3)" },
    missing: { background: "rgba(255,80,80,0.1)",   color: "#ff7070", border: "1px solid rgba(255,80,80,0.25)" },
    cat:     { background: "rgba(108,99,255,0.12)", color: "#9d97ff", border: "1px solid rgba(108,99,255,0.3)" },
  };
  return <span style={{ padding: "4px 13px", borderRadius: 999, fontSize: 12, fontWeight: 500, ...styles[type] }}>{label}</span>;
}

function SectionBadge({ label, ok }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "9px 13px", borderRadius: 8, fontSize: 12, fontWeight: 500,
      background: ok ? "rgba(0,200,150,0.08)" : "rgba(255,80,80,0.07)",
      border: `1px solid ${ok ? "rgba(0,200,150,0.3)" : "rgba(255,80,80,0.2)"}`,
      color: ok ? "#00c896" : "#5a5f6e",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: ok ? "#00c896" : "#3a3d45", boxShadow: ok ? "0 0 6px #00c89688" : "none" }} />
      {label}
    </div>
  );
}

function Card({ title, children, style = {} }) {
  return (
    <div style={{ background: "linear-gradient(145deg, #17191e, #13151a)", border: "1px solid #252830", borderRadius: 14, padding: "1.3rem", marginBottom: 14, ...style }}>
      {title && <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4a4f60", marginBottom: 14, fontWeight: 600 }}>{title}</div>}
      {children}
    </div>
  );
}

const RINGS = [
  { key: "atsScore",          label: "ATS Score",    color: "#6c63ff" },
  { key: "skillMatchScore",   label: "Skill Match",  color: "#00c896" },
  { key: "completenessScore", label: "Completeness", color: "#f5a623" },
];

const sectionLabels = {
  contact: "Contact Info", education: "Education", experience: "Experience",
  projects: "Projects", skills: "Skills", achievements: "Achievements",
};

export default function App() {
  const [roles, setRoles]     = useState([]);
  const [role, setRole]       = useState("software_developer");
  const [resumeText, setText] = useState("");
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [drag, setDrag]       = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileRef   = useRef();
  const rightRef  = useRef();
  const reportRef = useRef();

  useEffect(() => {
    fetchRoles().then(setRoles).catch(() => setRoles([
      { key: "software_developer", label: "Software Developer" },
      { key: "full_stack",         label: "Full Stack" },
      { key: "data_analyst",       label: "Data Analyst" },
      { key: "frontend_developer", label: "Frontend Developer" },
      { key: "devops_engineer",    label: "DevOps Engineer" },
    ]));
  }, []);

  useEffect(() => {
    if (result) rightRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  async function handleAnalyze() {
    if (!resumeText.trim()) { setError("Please paste your resume text first."); return; }
    setLoading(true); setError(""); setResult(null);
    try { setResult(await analyzeText(resumeText, role)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleFile(file) {
    if (!file) return;
    setLoading(true); setError(""); setResult(null);
    try { setResult(await uploadFile(file, role)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function downloadPDF() {
    if (!result) return;
    setDownloading(true);
    try {
      await generatePDF(result);
    } catch (e) {
      console.error("PDF error:", e);
      alert("PDF generation failed: " + e.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b0c0f", color: "#e8eaf0", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ position: "fixed", top: -200, left: "50%", transform: "translateX(-50%)", width: 600, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(108,99,255,0.08) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", padding: "2.5rem 1rem 1.8rem" }}>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 700, letterSpacing: "-0.04em", margin: 0, lineHeight: 1 }}>
            Resume <span style={{ color: "#6c63ff", textShadow: "0 0 30px rgba(108,99,255,0.5)" }}>Analyzer</span>
          </h1>
          <p style={{ color: "#4a4f60", fontSize: "0.9rem", marginTop: 10, letterSpacing: "0.02em" }}>
            ATS score · skill detection · keyword gap · improvement tips
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: result ? "380px 1fr" : "1fr",
          maxWidth: result ? 1060 : 560,
          margin: "0 auto", padding: "0 1.5rem 5rem", gap: 18, alignItems: "start",
        }}>
          {/* LEFT */}
          <div style={{ position: "sticky", top: 20 }}>
            <Card title="Target Role">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {roles.map(r => (
                  <button key={r.key} onClick={() => setRole(r.key)} style={{
                    padding: "6px 15px", borderRadius: 999, fontSize: 12, fontFamily: "'DM Sans',sans-serif",
                    cursor: "pointer", border: "1px solid", transition: "all 0.15s",
                    background: role === r.key ? "#6c63ff" : "transparent",
                    borderColor: role === r.key ? "#6c63ff" : "#252830",
                    color: role === r.key ? "#fff" : "#5a5f6e",
                    fontWeight: role === r.key ? 600 : 400,
                    boxShadow: role === r.key ? "0 0 14px rgba(108,99,255,0.35)" : "none",
                  }}>{r.label}</button>
                ))}
              </div>
            </Card>

            <Card>
              <div onClick={() => fileRef.current.click()}
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
                style={{ border: `1.5px dashed ${drag ? "#6c63ff" : "#252830"}`, borderRadius: 10, padding: "1.6rem", textAlign: "center", cursor: "pointer", background: drag ? "rgba(108,99,255,0.07)" : "rgba(255,255,255,0.01)", marginBottom: 14, transition: "all 0.2s" }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, color: "#c8cad4" }}>Drop PDF or TXT here</div>
                <div style={{ fontSize: 11, color: "#4a4f60" }}>or click to browse · max 5 MB</div>
                <input ref={fileRef} type="file" accept=".pdf,.txt" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
              </div>

              <textarea value={resumeText} onChange={e => setText(e.target.value)}
                placeholder={"Or paste resume text here...\n\nExample:\nJane Doe | jane@email.com\nSkills: React, Node.js, Python\nProjects: Built a web app..."}
                style={{ width: "100%", minHeight: 165, background: "#0e0f12", border: "1px solid #252830", borderRadius: 8, padding: 13, fontSize: 12.5, fontFamily: "'DM Mono', monospace", color: "#c8cad4", resize: "vertical", marginBottom: 14, boxSizing: "border-box", outline: "none", lineHeight: 1.7 }} />

              <button onClick={handleAnalyze} disabled={loading} style={{
                width: "100%", padding: 14,
                background: loading ? "#3a3860" : "linear-gradient(135deg, #6c63ff, #5048d4)",
                color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 700,
                fontFamily: "'DM Sans',sans-serif", cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 20px rgba(108,99,255,0.4)", transition: "all 0.2s",
              }}>
                {loading ? <><span className="spinner" /> Analyzing...</> : "Analyze Resume →"}
              </button>

              {error && <div style={{ marginTop: 12, background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: 8, padding: "11px 14px", fontSize: 13, color: "#ff7070" }}>⚠ {error}</div>}
            </Card>
          </div>

          {/* RIGHT */}
          {result && (
            <div ref={rightRef} style={{ animation: "fadeUp 0.45s ease both" }}>

              {/* Download button */}
              <button onClick={downloadPDF} disabled={downloading} style={{
                width: "100%", padding: "11px 0", marginBottom: 14,
                background: downloading ? "#1a1c22" : "linear-gradient(135deg, #1a1c22, #16181e)",
                border: "1px solid #6c63ff", borderRadius: 10, color: "#9d97ff",
                fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
                cursor: downloading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.2s", boxShadow: "0 0 12px rgba(108,99,255,0.15)",
              }}>
                {downloading ? <><span className="spinner" style={{ borderColor: "rgba(157,151,255,0.3)", borderTopColor: "#9d97ff" }} /> Generating PDF...</> : <> ⬇ Download ATS Report</>}
              </button>

              {/* Reportable area */}
              <div ref={reportRef}>
                <Card title="Score Overview">
                  <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 20, padding: "0.5rem 0" }}>
                    {RINGS.map(({ key, label, color }) => <Ring key={key} value={result[key]} label={label} color={color} />)}
                  </div>
                </Card>

                <Card title={`Detected Skills — ${result.skills.totalFound} found`}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {result.skills.flat.length > 0
                      ? result.skills.flat.map(s => <Pill key={s} label={s} type="found" />)
                      : <span style={{ fontSize: 13, color: "#4a4f60" }}>No recognized skills found</span>}
                  </div>
                </Card>

                {Object.keys(result.skills.byCategory).length > 0 && (
                  <Card title="Skill Categories">
                    {Object.entries(result.skills.byCategory).map(([key, cat], i, arr) => (
                      <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < arr.length - 1 ? "1px solid #1a1c22" : "none" }}>
                        <span style={{ fontSize: 13, color: "#7a7f8e" }}>{cat.label}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 90, height: 4, background: "#1e2026", borderRadius: 999, overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #6c63ff, #00c896)", width: `${Math.min(100, cat.count * 13)}%`, transition: "width 0.8s ease" }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#6c63ff", minWidth: 18, textAlign: "right" }}>{cat.count}</span>
                        </div>
                      </div>
                    ))}
                  </Card>
                )}

                <Card title={`Role Analysis — ${result.roleAnalysis.role}`}>
                  {result.roleAnalysis.requiredFound.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, color: "#4a4f60", marginBottom: 9, textTransform: "uppercase", letterSpacing: "0.07em" }}>Required — found</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{result.roleAnalysis.requiredFound.map(s => <Pill key={s} label={s} type="found" />)}</div>
                    </div>
                  )}
                  {result.roleAnalysis.requiredMissing.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, color: "#4a4f60", marginBottom: 9, textTransform: "uppercase", letterSpacing: "0.07em" }}>Required — missing</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{result.roleAnalysis.requiredMissing.map(s => <Pill key={s} label={s} type="missing" />)}</div>
                    </div>
                  )}
                  {result.roleAnalysis.preferredMissing.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: "#4a4f60", marginBottom: 9, textTransform: "uppercase", letterSpacing: "0.07em" }}>Preferred — add these</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{result.roleAnalysis.preferredMissing.map(s => <Pill key={s} label={s} type="cat" />)}</div>
                    </div>
                  )}
                </Card>

                <Card title="Resume Sections">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                    {Object.entries(result.sections).map(([key, ok]) => <SectionBadge key={key} label={sectionLabels[key]} ok={ok} />)}
                  </div>
                </Card>

                {result.suggestions.length > 0 && (
                  <Card title="Suggestions to Improve">
                    {result.suggestions.map((s, i) => (
                      <div key={i} style={{ display: "flex", gap: 12, padding: "9px 0", borderBottom: i < result.suggestions.length - 1 ? "1px solid #1a1c22" : "none", fontSize: 13, color: "#7a7f8e", lineHeight: 1.6 }}>
                        <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#f5a623", fontWeight: 700, marginTop: 1 }}>{i + 1}</span>
                        {s}
                      </div>
                    ))}
                  </Card>
                )}

                <div style={{ textAlign: "center", fontSize: 11, color: "#2a2d35", marginTop: 6, paddingBottom: 8 }}>
                  {result.meta.wordCount} words · {result.meta.charCount} chars · {new Date(result.meta.analyzedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .spinner { display: inline-block; width: 15px; height: 15px; margin-right: 8px; border: 2px solid rgba(255,255,255,0.25); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea:focus { border-color: #6c63ff !important; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #0b0c0f; }
        ::-webkit-scrollbar-thumb { background: #252830; border-radius: 3px; }
        @media (max-width: 720px) {
          div[style*="gridTemplateColumns: 380px"] { grid-template-columns: 1fr !important; }
          div[style*="position: sticky"] { position: relative !important; top: 0 !important; }
        }
      `}</style>
    </div>
  );
}