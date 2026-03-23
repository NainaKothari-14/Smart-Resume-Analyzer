import { jsPDF } from "jspdf";

const purple = [90, 72, 220];
const green  = [16, 163, 111];
const amber  = [217, 119, 6];
const red    = [220, 38, 38];
const txt    = [15, 20, 40];
const muted  = [100, 110, 140];
const border = [220, 225, 235];
const white  = [255, 255, 255];
const bg     = [248, 249, 252];

const sf = (doc, c) => doc.setFillColor(c[0], c[1], c[2]);
const sd = (doc, c) => doc.setDrawColor(c[0], c[1], c[2]);
const sc = (doc, c) => doc.setTextColor(c[0], c[1], c[2]);

function drawRing(doc, cx, cy, radius, percent, color, label, value) {
  sd(doc, border); doc.setLineWidth(4.5);
  doc.circle(cx, cy, radius, "S");
  sd(doc, color); doc.setLineWidth(4.5);
  const filled = (percent / 100) * 360;
  const steps  = Math.max(2, Math.round(filled / 1.5));
  for (let i = 0; i < steps; i++) {
    const a1 = ((i / steps) * filled - 90) * (Math.PI / 180);
    const a2 = (((i+1)/steps) * filled - 90) * (Math.PI / 180);
    doc.line(cx + radius*Math.cos(a1), cy + radius*Math.sin(a1),
             cx + radius*Math.cos(a2), cy + radius*Math.sin(a2));
  }
  doc.setFont("helvetica","bold"); doc.setFontSize(12); sc(doc, color);
  doc.text(`${value}%`, cx, cy+1.5, { align:"center", baseline:"middle" });
  doc.setFont("helvetica","normal"); doc.setFontSize(7); sc(doc, muted);
  doc.text(label.toUpperCase(), cx, cy+radius+7, { align:"center" });
}

function drawPill(doc, x, y, label, bgC, fgC) {
  doc.setFontSize(7.5);
  const tw = doc.getTextWidth(label);
  const pw = tw + 7; const ph = 6;
  sf(doc, bgC); doc.roundedRect(x, y-4.5, pw, ph, 1.5, 1.5, "F");
  sc(doc, fgC); doc.setFont("helvetica","bold");
  doc.text(label, x+3.5, y-0.3);
  return pw + 2.5;
}

function pillRow(doc, items, x0, y0, bgC, fgC, maxW) {
  let x = x0, y = y0;
  for (const item of items) {
    doc.setFontSize(7.5);
    const needed = doc.getTextWidth(item) + 12;
    if (x + needed > x0 + maxW) { x = x0; y += 9; }
    drawPill(doc, x, y, item, bgC, fgC);
    x += needed;
  }
  return y + 8;
}

function card(doc, x, y, w, h) {
  sf(doc, white); sd(doc, border);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 3, 3, "FD");
}

function sectionHead(doc, label, y, pageW, margin) {
  sf(doc, purple); doc.rect(margin, y, 2.5, 5.5, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(9.5); sc(doc, txt);
  doc.text(label, margin+5.5, y+4.5);
  sd(doc, border); doc.setLineWidth(0.25);
  doc.line(margin+5.5+doc.getTextWidth(label)+3, y+3, pageW-margin, y+3);
  return y + 13;
}

function labelRow(doc, label, color, x, y) {
  // simple ASCII alternatives — no unicode
  doc.setFont("helvetica","bold"); doc.setFontSize(7.5); sc(doc, color);
  doc.text(label, x, y);
}

export async function generatePDF(result) {
  const doc   = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const cw     = pageW - margin*2;
  let y        = 0;

  const sectionLabels = {
    contact:"Contact Info", education:"Education", experience:"Experience",
    projects:"Projects", skills:"Skills", achievements:"Achievements",
  };

  // ── HEADER ────────────────────────────────────────────────────────────────
  sf(doc, purple); doc.rect(0, 0, pageW, 30, "F");
  doc.setFillColor(100,85,235);
  doc.triangle(pageW-35, 0, pageW, 0, pageW, 30, "F");

  doc.setFont("helvetica","bold"); doc.setFontSize(18); sc(doc, white);
  doc.text("ATS Resume Report", margin, 17);
  doc.setFont("helvetica","normal"); doc.setFontSize(8);
  doc.setTextColor(200,195,255);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}`, margin, 24);

  const roleLabel = `Role: ${result.roleAnalysis.role}`;
  doc.setFontSize(8);
  const rbW = doc.getTextWidth(roleLabel)+10;
  doc.setFillColor(110,95,245);
  doc.roundedRect(pageW-margin-rbW, 11, rbW, 8, 2, 2, "F");
  doc.setFont("helvetica","bold"); sc(doc, white);
  doc.text(roleLabel, pageW-margin-rbW+5, 16.5);
  y = 38;

  // ── SCORE RINGS ───────────────────────────────────────────────────────────
  y = sectionHead(doc, "Score Overview", y, pageW, margin);
  card(doc, margin, y, cw, 44);
  const rings = [
    { label:"ATS Score",    value:result.atsScore,          color:purple },
    { label:"Skill Match",  value:result.skillMatchScore,   color:green  },
    { label:"Completeness", value:result.completenessScore, color:amber  },
  ];
  const slot = cw/3;
  rings.forEach((r,i) => drawRing(doc, margin+slot*i+slot/2, y+22, 13, r.value, r.color, r.label, r.value));
  y += 52;

  // ── DETECTED SKILLS ───────────────────────────────────────────────────────
  y = sectionHead(doc, `Detected Skills (${result.skills.totalFound} found)`, y, pageW, margin);
  // measure height first, then draw card, then draw pills (no double draw)
  let tempY = y + 5;
  let tempX = margin + 4;
  for (const item of result.skills.flat) {
    doc.setFontSize(7.5);
    const needed = doc.getTextWidth(item) + 12;
    if (tempX + needed > margin + 4 + cw - 8) { tempX = margin+4; tempY += 9; }
    tempX += needed;
  }
  const skillsH = (tempY + 6) - y;
  card(doc, margin, y-2, cw, skillsH+4);
  pillRow(doc, result.skills.flat, margin+4, y+5, [220,252,231], [22,101,52], cw-8);
  y += skillsH + 6;

  // ── SKILL CATEGORIES ──────────────────────────────────────────────────────
  const cats = Object.entries(result.skills.byCategory);
  if (cats.length > 0) {
    y = sectionHead(doc, "Skill Categories", y, pageW, margin);
    const catH = cats.length*9+8;
    card(doc, margin, y-2, cw, catH);
    let cy2 = y+4;
    cats.forEach(([, cat]) => {
      doc.setFont("helvetica","normal"); doc.setFontSize(8.5); sc(doc, txt);
      doc.text(cat.label, margin+5, cy2+0.5);
      const bx = margin+55, bw = cw-68;
      sf(doc, border); doc.roundedRect(bx, cy2-3, bw, 3.5, 1, 1, "F");
      sf(doc, purple); doc.roundedRect(bx, cy2-3, Math.min(bw, cat.count*(bw/10)), 3.5, 1, 1, "F");
      doc.setFont("helvetica","bold"); sc(doc, purple);
      doc.text(`${cat.count}`, pageW-margin-4, cy2+0.5, { align:"right" });
      cy2 += 9;
    });
    y += catH+5;
  }

  // ── ROLE ANALYSIS ─────────────────────────────────────────────────────────
  y = sectionHead(doc, `Role Analysis — ${result.roleAnalysis.role}`, y, pageW, margin);

  if (result.roleAnalysis.requiredFound.length > 0) {
    labelRow(doc, "Required skills found:", green, margin+2, y);
    y = pillRow(doc, result.roleAnalysis.requiredFound, margin+2, y+7, [220,252,231], [22,101,52], cw-4)+3;
  }
  if (result.roleAnalysis.requiredMissing.length > 0) {
    labelRow(doc, "Required skills missing:", red, margin+2, y);
    y = pillRow(doc, result.roleAnalysis.requiredMissing, margin+2, y+7, [254,226,226], [153,27,27], cw-4)+3;
  }
  if (result.roleAnalysis.preferredMissing.length > 0) {
    labelRow(doc, "Preferred — add these:", purple, margin+2, y);
    y = pillRow(doc, result.roleAnalysis.preferredMissing, margin+2, y+7, [237,233,254], [76,29,149], cw-4)+3;
  }
  y += 5;

  // ── RESUME SECTIONS ───────────────────────────────────────────────────────
  if (y > pageH-70) { doc.addPage(); y=16; }
  y = sectionHead(doc, "Resume Sections", y, pageW, margin);
  const entries = Object.entries(result.sections);
  const cols = 3, colW2 = cw/cols;
  const secH = Math.ceil(entries.length/cols)*10+8;
  card(doc, margin, y-2, cw, secH);
  entries.forEach(([key, ok], i) => {
    const col = i%cols, row = Math.floor(i/cols);
    const bx = margin+col*colW2+5, by = y+row*10+4;
    doc.setFillColor(ok?16:200, ok?163:200, ok?111:200);
    doc.circle(bx+2, by+1, 2.2, "F");
    doc.setFont("helvetica", ok?"bold":"normal");
    doc.setFontSize(8.5);
    sc(doc, ok?txt:muted);
    doc.text(sectionLabels[key]||key, bx+7, by+2.5);
  });
  y += secH+6;

  // ── SUGGESTIONS ───────────────────────────────────────────────────────────
  if (result.suggestions.length > 0) {
    if (y > pageH-50) { doc.addPage(); y=16; }
    y = sectionHead(doc, "Suggestions to Improve", y, pageW, margin);
    const sugH = result.suggestions.length*13+8;
    card(doc, margin, y-2, cw, sugH);
    result.suggestions.forEach((s, i) => {
      const sx = margin+5, sy = y+i*13+5;
      doc.setFillColor(255,237,213);
      doc.roundedRect(sx, sy-4.5, 7, 7, 1.5, 1.5, "F");
      doc.setFont("helvetica","bold"); doc.setFontSize(7);
      doc.setTextColor(180,60,10);
      doc.text(`${i+1}`, sx+3.5, sy, { align:"center" });
      doc.setFont("helvetica","normal"); doc.setFontSize(8); sc(doc, txt);
      const lines = doc.splitTextToSize(s, cw-18);
      doc.text(lines[0], sx+10, sy);
    });
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let p=1; p<=totalPages; p++) {
    doc.setPage(p);
    sf(doc, bg); doc.rect(0, pageH-10, pageW, 10, "F");
    sd(doc, border); doc.setLineWidth(0.3);
    doc.line(margin, pageH-10, pageW-margin, pageH-10);
    doc.setFont("helvetica","normal"); doc.setFontSize(7); sc(doc, muted);
    doc.text("Smart Resume Analyzer", margin, pageH-4);
    doc.text(`Page ${p} of ${totalPages}`, pageW-margin, pageH-4, { align:"right" });
  }

  doc.save(`ATS-Report-${Date.now()}.pdf`);
}