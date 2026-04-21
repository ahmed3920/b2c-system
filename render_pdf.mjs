// Render a sample mentor PDF using the same code path as the app, then write to disk for QA.
// We stub the DOM Image used to load the logo by directly building the doc with the same helpers.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";

// --- inline a trimmed copy of buildMentorPdf logic by re-importing? The util uses `new Image()` (DOM)
// so easiest path: copy the buildMentorPdf body into this script. To stay faithful, dynamic import via vite-node would work,
// but to keep things light we duplicate the rendering helpers here.

const BLUE = [5, 110, 236];
const BLUE_DEEP = [3, 78, 168];
const BLUE_SOFT = [232, 241, 255];
const BLUE_TINT = [246, 250, 255];
const ORANGE = [254, 127, 27];
const ORANGE_SOFT = [255, 233, 215];
const INK = [28, 39, 64];
const SUBINK = [110, 122, 148];
const GRADE_PALETTE = [
  [232, 241, 255], [255, 233, 215], [226, 245, 234],
  [243, 232, 255], [255, 244, 213], [253, 226, 232], [225, 245, 247],
];
function gradeColor(g) {
  let h = 0;
  const k = String(g ?? "?");
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return GRADE_PALETTE[h % GRADE_PALETTE.length];
}

function drawGradientBar(doc, x, y, w, h, c1, c2) {
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    doc.setFillColor(r, g, b);
    doc.rect(x, y + (h * i) / steps, w, h / steps + 0.6, "F");
  }
}

const HEADER_HEIGHT = 170;
const MARGIN_X = 36;

function weekNumber(s) {
  const d = new Date(s + "T00:00:00Z");
  const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.max(1, Math.floor((d - ys) / 86400000 / 7) + 1);
}
function formatRange(s) {
  const start = new Date(s + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 4);
  const f = d => `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
  return `${f(start)} to ${f(end)}`;
}

function drawHeroBanner(doc, weekStart, mentor, totals) {
  const pageW = doc.internal.pageSize.getWidth();
  drawGradientBar(doc, 0, 0, pageW, HEADER_HEIGHT - 24, BLUE, BLUE_DEEP);
  doc.setFillColor(...ORANGE);
  doc.triangle(pageW - 150, 0, pageW - 40, 0, pageW - 95, 90, "F");
  doc.setFillColor(255, 168, 90);
  doc.triangle(pageW - 110, 0, pageW, 0, pageW - 55, 70, "F");
  // logo placeholder
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MARGIN_X, 22, 56, 56, 10, 10, "F");
  doc.setFillColor(...BLUE);
  doc.circle(MARGIN_X + 28, 50, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(`Study Plan · Week ${weekNumber(weekStart)}`, MARGIN_X + 70, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(225, 235, 255);
  doc.text(`${formatRange(weekStart)}   ·   Mentor: ${mentor}`, MARGIN_X + 70, 70);

  const ribbonY = HEADER_HEIGHT - 40;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MARGIN_X, ribbonY, pageW - MARGIN_X * 2, 32, 6, 6, "F");
  doc.setDrawColor(...BLUE_SOFT);
  doc.setLineWidth(0.6);
  doc.roundedRect(MARGIN_X, ribbonY, pageW - MARGIN_X * 2, 32, 6, 6, "S");

  const kpis = [
    [`${totals.tutors}`, "Tutors", BLUE],
    [`${totals.modules}`, "Modules", ORANGE],
    [`${totals.planned} h`, "Planned", BLUE_DEEP],
    [`${totals.free} h`, "Free", [110, 80, 200]],
  ];
  const segW = (pageW - MARGIN_X * 2) / kpis.length;
  kpis.forEach((k, i) => {
    const cx = MARGIN_X + segW * i + segW / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...k[2]);
    doc.text(k[0], cx, ribbonY + 14, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SUBINK);
    doc.text(k[1].toUpperCase(), cx, ribbonY + 26, { align: "center" });
    if (i < kpis.length - 1) {
      doc.setDrawColor(...BLUE_SOFT);
      doc.setLineWidth(0.5);
      doc.line(MARGIN_X + segW * (i + 1), ribbonY + 6, MARGIN_X + segW * (i + 1), ribbonY + 26);
    }
  });
}

function drawFooter(doc, n) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  drawGradientBar(doc, 0, pageH - 22, pageW, 4, BLUE, ORANGE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUBINK);
  doc.text("iSchool · Study Plan", MARGIN_X + 16, pageH - 7);
  doc.text("© 2026 iSchool – All rights reserved", pageW / 2, pageH - 7, { align: "center" });
  doc.text(`Page ${n}`, pageW - MARGIN_X, pageH - 7, { align: "right" });
}

function drawCoverPage(doc, weekStart, mentor, totals) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...BLUE_TINT);
  doc.rect(0, 0, pageW, pageH, "F");
  const heroH = pageH * 0.38;
  drawGradientBar(doc, 0, 0, pageW, heroH, BLUE, BLUE_DEEP);

  doc.setFillColor(...ORANGE);
  doc.triangle(pageW - 150, 0, pageW - 50, 0, pageW - 100, 80, "F");
  doc.setFillColor(255, 188, 130);
  doc.triangle(pageW - 100, 0, pageW - 10, 0, pageW - 55, 60, "F");

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MARGIN_X + 6, 38, 80, 80, 14, 14, "F");
  doc.setFillColor(...BLUE);
  doc.circle(MARGIN_X + 46, 78, 28, "F");

  doc.setTextColor(255, 220, 180);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("ISCHOOL · WEEKLY STUDY PLAN", MARGIN_X + 100, 64);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(36);
  doc.text(`Week ${weekNumber(weekStart)}`, MARGIN_X + 100, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(225, 235, 255);
  doc.text(formatRange(weekStart), MARGIN_X + 100, 122);

  const cardY = heroH - 36;
  const cardW = pageW - MARGIN_X * 2;
  const cardH = 110;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MARGIN_X, cardY, cardW, cardH, 14, 14, "F");
  doc.setDrawColor(...BLUE_SOFT);
  doc.setLineWidth(0.8);
  doc.roundedRect(MARGIN_X, cardY, cardW, cardH, 14, 14, "S");
  doc.setFillColor(...ORANGE);
  doc.roundedRect(MARGIN_X + 14, cardY + 14, 4, cardH - 28, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUBINK);
  doc.text("MENTOR", MARGIN_X + 30, cardY + 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(mentor, MARGIN_X + 30, cardY + 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SUBINK);
  doc.text(`Prepared for the week of ${formatRange(weekStart)}`, MARGIN_X + 30, cardY + 78);

  const tilesY = cardY + cardH + 24;
  const gap = 16;
  const tileW = (cardW - gap * 3) / 4;
  const tileH = 110;
  const tiles = [
    { label: "Tutors", value: `${totals.tutors}`, color: BLUE, bg: BLUE_SOFT },
    { label: "Modules", value: `${totals.modules}`, color: ORANGE, bg: ORANGE_SOFT },
    { label: "Planned hours", value: `${totals.planned}`, color: BLUE_DEEP, bg: [232, 245, 235] },
    { label: "Free hours", value: `${totals.free}`, color: [110, 80, 200], bg: [243, 232, 255] },
  ];
  tiles.forEach((t, i) => {
    const x = MARGIN_X + (tileW + gap) * i;
    doc.setFillColor(...t.bg);
    doc.roundedRect(x, tilesY, tileW, tileH, 12, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(34);
    doc.setTextColor(...t.color);
    doc.text(t.value, x + 22, tilesY + 56);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...SUBINK);
    doc.text(t.label.toUpperCase(), x + 22, tilesY + 82);
  });

  const tagY = tilesY + tileH + 30;
  if (tagY < pageH - 50) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...BLUE_DEEP);
    doc.text("Empowering tutors. Inspiring learners.", pageW / 2, tagY, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...SUBINK);
    doc.text("Planned study modules, allocated hours, and free-time distribution for the team.", pageW / 2, tagY + 18, { align: "center" });
  }

  drawGradientBar(doc, 0, pageH - 18, pageW, 4, BLUE, ORANGE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SUBINK);
  doc.text("iSchool · Mentor Study Plan · © 2026 iSchool – All rights reserved", pageW / 2, pageH - 5, { align: "center" });
}

// ---- Mock data: 12 tutors with varying module counts ----
const tutors = [];
const grades = ["G1-3", "G4-6", "G7-9", "G10-12"];
const codes = ["MATH-A", "MATH-B-LONG-CODE", "SCI-X", "ENG-Y", "PHY-Z"];
for (let t = 1; t <= 12; t++) {
  const itemCount = 1 + (t % 4);
  const items = [];
  for (let i = 0; i < itemCount; i++) {
    const required = 1 + ((t + i) % 5);
    const planned = Math.max(1, required - (i % 2));
    items.push({
      module: { grade_band: grades[(t + i) % grades.length], module_code: codes[(t + i) % codes.length], hours_required: required },
      planned_hours: planned,
    });
  }
  const free = items.reduce((s, x) => s + x.planned_hours, 0) + (t % 3);
  tutors.push({
    tutor_name: `Tutor Number ${t} With A Reasonably Long Name`,
    free_hours: free,
    items,
  });
}

const weekStart = "2026-04-17";
const mentor = "Mariam Ahmed Sample-Mentor";
const totals = {
  tutors: tutors.length,
  modules: tutors.reduce((s, t) => s + t.items.length, 0),
  planned: tutors.reduce((s, t) => s + t.items.reduce((a, i) => a + i.planned_hours, 0), 0),
  free: tutors.reduce((s, t) => s + t.free_hours, 0),
};

const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
drawCoverPage(doc, weekStart, mentor, totals);
doc.addPage();

const body = [];
const tutorAtRow = [];
for (const p of tutors) {
  const items = p.items;
  const planned = items.reduce((s, it) => s + it.planned_hours, 0);
  const free = p.free_hours;
  const utilPct = free > 0 ? Math.min(100, Math.round((planned / free) * 100)) : 0;
  items.forEach((it, idx) => {
    const grade = it.module.grade_band;
    const code = it.module.module_code;
    const required = it.module.hours_required;
    const ip = it.planned_hours;
    const pct = required > 0 ? Math.min(100, Math.round((ip / required) * 100)) : 0;
    const moduleText = `Grade ${grade} — ${code}  (${pct}%)`;
    const timeText = `${ip} of ${required} h`;
    const row = [];
    if (idx === 0) row.push({ content: p.tutor_name, rowSpan: items.length, styles: { fontStyle: "bold", valign: "middle", halign: "center", fillColor: BLUE_SOFT, textColor: INK } });
    row.push({ content: moduleText, styles: { fillColor: gradeColor(grade), textColor: INK } });
    row.push({ content: timeText, styles: { fillColor: ORANGE_SOFT, fontStyle: "bold", textColor: INK } });
    if (idx === 0) row.push({
      content: `${free} h available\n${planned} h planned · ${utilPct}%`,
      rowSpan: items.length,
      styles: { valign: "middle", halign: "center", fontStyle: "bold", textColor: BLUE_DEEP, fillColor: [255,255,255], cellPadding: { top:8, bottom:24, left:8, right:8 } },
    });
    body.push(row);
    tutorAtRow.push({ planned, free, utilPct, firstRow: idx === 0, rowSpan: items.length });
  });
}

const pageW = doc.internal.pageSize.getWidth();
const innerW = pageW - MARGIN_X * 2;
const colTutor = 160, colTime = 100, colFree = 140;
const colModules = innerW - (colTutor + colTime + colFree);

autoTable(doc, {
  startY: HEADER_HEIGHT + 6,
  margin: { left: MARGIN_X, right: MARGIN_X, top: HEADER_HEIGHT + 6 },
  head: [["Tutor Name", "Modules Name", "Time For It", "Your Free Time"]],
  body,
  theme: "grid",
  showHead: "everyPage",
  styles: { font: "helvetica", fontSize: 10.5, cellPadding: { top:7, bottom:7, left:9, right:9 }, lineColor: [220,226,240], lineWidth: 0.5, valign: "middle", halign: "center", overflow: "linebreak", minCellHeight: 26, textColor: INK },
  headStyles: { fillColor: BLUE, textColor: [255,255,255], fontStyle: "bold", fontSize: 12, halign: "center", cellPadding: { top:9, bottom:9, left:8, right:8 } },
  columnStyles: { 0:{cellWidth:colTutor,fontStyle:"bold"}, 1:{cellWidth:colModules,fontStyle:"bold",halign:"left"}, 2:{cellWidth:colTime,fontStyle:"bold"}, 3:{cellWidth:colFree,fontStyle:"bold"} },
  alternateRowStyles: { fillColor: BLUE_TINT },
  bodyStyles: { fillColor: [255,255,255] },
  willDrawPage: () => drawHeroBanner(doc, weekStart, mentor, totals),
  didDrawCell: (data) => {
    if (data.section === "body" && data.column.index === 3 && data.cell.raw && typeof data.row.index === "number") {
      const info = tutorAtRow[data.row.index];
      if (!info || !info.firstRow) return;
      const x = data.cell.x + 10;
      const w = data.cell.width - 20;
      const y = data.cell.y + data.cell.height - 14;
      doc.setFillColor(230, 236, 248);
      doc.roundedRect(x, y, w, 6, 3, 3, "F");
      const pct = Math.max(0, Math.min(100, info.utilPct));
      const fillW = (w * pct) / 100;
      const c = pct >= 95 ? ORANGE : BLUE;
      doc.setFillColor(...c);
      if (fillW > 0) doc.roundedRect(x, y, fillW, 6, 3, 3, "F");
    }
  },
  didDrawPage: (data) => drawFooter(doc, data.pageNumber + 1),
});

const out = doc.output("arraybuffer");
fs.writeFileSync("/tmp/sample.pdf", Buffer.from(out));
console.log("wrote /tmp/sample.pdf", fs.statSync("/tmp/sample.pdf").size);
