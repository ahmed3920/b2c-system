import jsPDF from "jspdf";
import autoTable, { type RowInput, type CellDef } from "jspdf-autotable";
import JSZip from "jszip";
import logoUrl from "@/assets/ischool-icon.png";
import type { WeeklyPlan } from "@/hooks/useWeeklyStudyPlans";
import { getMentorForTutor } from "@/lib/tutorMentorLookup";

// ===== iSchool brand palette (soft pastel variants) =====
const BLUE: [number, number, number] = [5, 110, 236]; // #056eec — primary
const BLUE_DEEP: [number, number, number] = [3, 78, 168]; // gradient end
const BLUE_SOFT: [number, number, number] = [232, 241, 255]; // pastel blue surface
const BLUE_TINT: [number, number, number] = [246, 250, 255]; // very pale row bg
const ORANGE: [number, number, number] = [254, 127, 27]; // #fe7f1b — accent
const ORANGE_SOFT: [number, number, number] = [255, 233, 215]; // pastel orange chip
const INK: [number, number, number] = [28, 39, 64];
const SUBINK: [number, number, number] = [110, 122, 148];

// Pastel tints for grade bands (color-coded chips)
const GRADE_PALETTE: Array<[number, number, number]> = [
  [232, 241, 255], // blue
  [255, 233, 215], // orange
  [226, 245, 234], // mint
  [243, 232, 255], // lavender
  [255, 244, 213], // butter
  [253, 226, 232], // rose
  [225, 245, 247], // cyan
];
function gradeColor(grade: string): [number, number, number] {
  const key = String(grade ?? "?");
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return GRADE_PALETTE[h % GRADE_PALETTE.length];
}

// ===== Date helpers =====
function formatRange(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 4);
  const f = (d: Date) =>
    `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
  return `${f(start)} to ${f(end)}`;
}

function weekNumber(weekStart: string): number {
  const d = new Date(weekStart + "T00:00:00Z");
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const diffDays = Math.floor((d.getTime() - yearStart.getTime()) / 86400000);
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

function loadImage(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
}

interface MentorGroup {
  mentor: string;
  plans: WeeklyPlan[];
}

export function groupPlansByMentor(plans: WeeklyPlan[]): MentorGroup[] {
  const map = new Map<string, WeeklyPlan[]>();
  for (const p of plans) {
    if (!p.items || p.items.length === 0) continue;
    const mentor = getMentorForTutor(p.tutor_external_id) || "—";
    if (!map.has(mentor)) map.set(mentor, []);
    map.get(mentor)!.push(p);
  }
  return Array.from(map.entries())
    .map(([mentor, plans]) => ({
      mentor,
      plans: plans.sort((a, b) => a.tutor_name.localeCompare(b.tutor_name)),
    }))
    .sort((a, b) => a.mentor.localeCompare(b.mentor));
}

interface BuildOptions {
  weekStart: string;
  mentor: string;
  plans: WeeklyPlan[];
  logoDataUrl?: string;
}

const HEADER_HEIGHT = 170; // hero banner height on table pages
const MARGIN_X = 36;

// Approximate gradient by stacking thin horizontal bars (jsPDF lacks gradients)
function drawGradientBar(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  c1: [number, number, number],
  c2: [number, number, number],
) {
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

// Hero banner used on table pages (compact version of the cover header)
function drawHeroBanner(
  doc: jsPDF,
  weekStart: string,
  mentor: string,
  totals: { tutors: number; modules: number; planned: number; free: number },
  logoDataUrl?: string,
) {
  const pageW = doc.internal.pageSize.getWidth();

  // Gradient banner background
  drawGradientBar(doc, 0, 0, pageW, HEADER_HEIGHT - 24, BLUE, BLUE_DEEP);

  // Decorative orange chevrons (top-right)
  doc.setFillColor(...ORANGE);
  doc.triangle(pageW - 150, 0, pageW - 40, 0, pageW - 95, 90, "F");
  doc.setFillColor(255, 168, 90);
  doc.triangle(pageW - 110, 0, pageW, 0, pageW - 55, 70, "F");

  // Logo badge
  if (logoDataUrl) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(MARGIN_X, 22, 56, 56, 10, 10, "F");
    try {
      doc.addImage(logoDataUrl, "PNG", MARGIN_X + 6, 28, 44, 44);
    } catch {
      /* ignore */
    }
  }

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(`Study Plan · Week ${weekNumber(weekStart)}`, MARGIN_X + 70, 50);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(225, 235, 255);
  doc.text(
    `${formatRange(weekStart)}   ·   Mentor: ${mentor}`,
    MARGIN_X + 70,
    70,
  );

  // KPI ribbon (white pastel pills under the banner)
  const ribbonY = HEADER_HEIGHT - 40;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MARGIN_X, ribbonY, pageW - MARGIN_X * 2, 32, 6, 6, "F");
  doc.setDrawColor(...BLUE_SOFT);
  doc.setLineWidth(0.6);
  doc.roundedRect(MARGIN_X, ribbonY, pageW - MARGIN_X * 2, 32, 6, 6, "S");

  const kpis: Array<[string, string, [number, number, number]]> = [
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

// Watermark on every body page (very subtle)
function drawWatermark(doc: jsPDF, logoDataUrl?: string) {
  if (!logoDataUrl) return;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  try {
    // jsPDF 2.x supports alpha via GState (loosely typed in jspdf)
    const anyDoc = doc as unknown as {
      GState?: new (opts: { opacity: number }) => unknown;
      setGState?: (gs: unknown) => void;
    };
    const gs = anyDoc.GState ? new anyDoc.GState({ opacity: 0.05 }) : null;
    if (gs && anyDoc.setGState) anyDoc.setGState(gs);
    const size = 320;
    doc.addImage(
      logoDataUrl,
      "PNG",
      pageW / 2 - size / 2,
      pageH / 2 - size / 2,
      size,
      size,
    );
    if (gs && anyDoc.setGState && anyDoc.GState) {
      anyDoc.setGState(new anyDoc.GState({ opacity: 1 }));
    }
  } catch {
    /* ignore */
  }
}

// Footer with mini logo + brand line + page number
function drawFooter(doc: jsPDF, pageNum: number, logoDataUrl?: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  // Accent bottom line
  drawGradientBar(doc, 0, pageH - 22, pageW, 4, BLUE, ORANGE);

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", MARGIN_X, pageH - 16, 12, 12);
    } catch {
      /* ignore */
    }
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUBINK);
  doc.text("iSchool · Study Plan", MARGIN_X + 16, pageH - 7);
  doc.text(
    "\u00A9 2026 iSchool \u2013 All rights reserved",
    pageW / 2,
    pageH - 7,
    { align: "center" },
  );
  doc.text(`Page ${pageNum}`, pageW - MARGIN_X, pageH - 7, { align: "right" });
}

// ===== Cover page =====
function drawCoverPage(
  doc: jsPDF,
  weekStart: string,
  mentor: string,
  totals: { tutors: number; modules: number; planned: number; free: number },
  logoDataUrl?: string,
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Soft full-page background
  doc.setFillColor(...BLUE_TINT);
  doc.rect(0, 0, pageW, pageH, "F");

  // Hero gradient block — compact (top ~38% of page)
  const heroH = pageH * 0.38;
  drawGradientBar(doc, 0, 0, pageW, heroH, BLUE, BLUE_DEEP);

  // Soft pastel chevrons (smaller, subtler than before)
  doc.setFillColor(...ORANGE);
  doc.triangle(pageW - 150, 0, pageW - 50, 0, pageW - 100, 80, "F");
  doc.setFillColor(255, 188, 130);
  doc.triangle(pageW - 100, 0, pageW - 10, 0, pageW - 55, 60, "F");

  // Logo badge (top-left)
  if (logoDataUrl) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(MARGIN_X + 6, 38, 80, 80, 14, 14, "F");
    try {
      doc.addImage(logoDataUrl, "PNG", MARGIN_X + 14, 46, 64, 64);
    } catch {
      /* ignore */
    }
  }

  // Eyebrow + title
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

  // Mentor card sits across the hero edge
  const cardY = heroH - 36;
  const cardW = pageW - MARGIN_X * 2;
  const cardH = 110;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MARGIN_X, cardY, cardW, cardH, 14, 14, "F");
  doc.setDrawColor(...BLUE_SOFT);
  doc.setLineWidth(0.8);
  doc.roundedRect(MARGIN_X, cardY, cardW, cardH, 14, 14, "S");

  // Orange accent bar inside card
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
  doc.text(
    `Prepared for the week of ${formatRange(weekStart)}`,
    MARGIN_X + 30,
    cardY + 78,
  );

  // KPI tiles below the mentor card
  const tilesY = cardY + cardH + 24;
  const gap = 16;
  const tileW = (cardW - gap * 3) / 4;
  const tileH = 110;
  const tiles: Array<{ label: string; value: string; color: [number, number, number]; bg: [number, number, number] }> = [
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

  // Tagline strip
  const tagY = tilesY + tileH + 30;
  if (tagY < pageH - 50) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...BLUE_DEEP);
    doc.text("Empowering tutors. Inspiring learners.", pageW / 2, tagY, {
      align: "center",
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...SUBINK);
    doc.text(
      "Planned study modules, allocated hours, and free-time distribution for the team.",
      pageW / 2,
      tagY + 18,
      { align: "center" },
    );
  }

  // Footer brand line on cover
  drawGradientBar(doc, 0, pageH - 18, pageW, 4, BLUE, ORANGE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SUBINK);
  doc.text(
    "iSchool · Mentor Study Plan · \u00A9 2026 iSchool \u2013 All rights reserved",
    pageW / 2,
    pageH - 5,
    { align: "center" },
  );
}

function buildMentorPdf({
  weekStart,
  mentor,
  plans,
  logoDataUrl,
}: BuildOptions): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Aggregate totals (used in cover + banner)
  const totalTutors = plans.length;
  const totalItems = plans.reduce((s, p) => s + (p.items?.length ?? 0), 0);
  const totalPlanned = plans.reduce(
    (s, p) =>
      s +
      (p.items?.reduce((a, it) => a + Number(it.planned_hours ?? 0), 0) ?? 0),
    0,
  );
  const totalFree = plans.reduce((s, p) => s + Number(p.free_hours ?? 0), 0);
  const totals = {
    tutors: totalTutors,
    modules: totalItems,
    planned: Math.round(totalPlanned),
    free: Math.round(totalFree),
  };

  // ----- Cover page -----
  drawCoverPage(doc, weekStart, mentor, totals, logoDataUrl);

  // ----- Table page(s) -----
  doc.addPage();

  // Build rows with rowSpan grouping per tutor
  const body: RowInput[] = [];
  for (const p of plans) {
    const items = p.items ?? [];
    if (items.length === 0) continue;
    const planned = items.reduce(
      (s, it) => s + Number(it.planned_hours ?? 0),
      0,
    );
    const free = Number(p.free_hours ?? 0);
    const utilPct =
      free > 0 ? Math.min(100, Math.round((planned / free) * 100)) : 0;

    items.forEach((it, idx) => {
      const grade = it.module?.grade_band ?? "?";
      const code = it.module?.module_code ?? "?";
      const required = Number(it.module?.hours_required ?? 0);
      const itemPlanned = Number(it.planned_hours ?? 0);
      const pct =
        required > 0
          ? Math.min(100, Math.round((itemPlanned / required) * 100))
          : 0;
      const moduleText = `Grade ${grade} — ${code}  (${pct}%)`;
      const timeText = required
        ? `${itemPlanned} of ${required} h`
        : `${itemPlanned} h`;

      const row: CellDef[] = [];

      if (idx === 0) {
        row.push({
          content: p.tutor_name,
          rowSpan: items.length,
          styles: {
            fontStyle: "bold",
            valign: "middle",
            halign: "center",
            fillColor: BLUE_SOFT,
            textColor: INK,
          },
        });
      }

      row.push({
        content: moduleText,
        styles: { fillColor: gradeColor(grade), textColor: INK },
      });
      row.push({
        content: timeText,
        styles: { fillColor: ORANGE_SOFT, fontStyle: "bold", textColor: INK },
      });

      if (idx === 0) {
        row.push({
          content: `${free} h available\n${planned} h planned · ${utilPct}%`,
          rowSpan: items.length,
          styles: {
            valign: "middle",
            halign: "center",
            fontStyle: "bold",
            textColor: BLUE_DEEP,
            fillColor: [255, 255, 255],
            // leave room for the mini progress bar drawn in didDrawCell
            cellPadding: { top: 8, bottom: 24, left: 8, right: 8 },
          },
        });
      }

      body.push(row);
    });
  }

  if (body.length === 0) {
    drawHeroBanner(doc, weekStart, mentor, totals, logoDataUrl);
    doc.setTextColor(...SUBINK);
    doc.setFontSize(13);
    doc.text(
      "No modules planned for this mentor's team.",
      MARGIN_X,
      HEADER_HEIGHT + 30,
    );
    drawFooter(doc, 2, logoDataUrl);
    return doc;
  }

  const innerW = pageW - MARGIN_X * 2;
  const colTutor = 160;
  const colTime = 100;
  const colFree = 140;
  const colModules = innerW - (colTutor + colTime + colFree);

  // Track which tutor a body row belongs to so we can render the progress bar
  // under the merged "Free Time" cell.
  let rowCursor = 0;
  const tutorAtRow: Array<{ planned: number; free: number; utilPct: number; firstRow: boolean; rowSpan: number }> = [];
  for (const p of plans) {
    const items = p.items ?? [];
    if (!items.length) continue;
    const planned = items.reduce((s, it) => s + Number(it.planned_hours ?? 0), 0);
    const free = Number(p.free_hours ?? 0);
    const utilPct = free > 0 ? Math.min(100, Math.round((planned / free) * 100)) : 0;
    items.forEach((_it, idx) => {
      tutorAtRow[rowCursor++] = {
        planned,
        free,
        utilPct,
        firstRow: idx === 0,
        rowSpan: items.length,
      };
    });
  }

  autoTable(doc, {
    startY: HEADER_HEIGHT + 6,
    margin: { left: MARGIN_X, right: MARGIN_X, top: HEADER_HEIGHT + 6 },
    head: [["Tutor Name", "Modules Name", "Time For It", "Your Free Time"]],
    body,
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 10.5,
      cellPadding: { top: 7, bottom: 7, left: 9, right: 9 },
      lineColor: [220, 226, 240],
      lineWidth: 0.5,
      valign: "middle",
      halign: "center",
      overflow: "linebreak",
      minCellHeight: 26,
      textColor: INK,
    },
    headStyles: {
      fillColor: BLUE,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 12,
      halign: "center",
      cellPadding: { top: 9, bottom: 9, left: 8, right: 8 },
    },
    columnStyles: {
      0: { cellWidth: colTutor, fontStyle: "bold" },
      1: { cellWidth: colModules, fontStyle: "bold", halign: "left" },
      2: { cellWidth: colTime, fontStyle: "bold" },
      3: { cellWidth: colFree, fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: BLUE_TINT },
    bodyStyles: { fillColor: [255, 255, 255] },
    willDrawPage: () => {
      drawWatermark(doc, logoDataUrl);
      drawHeroBanner(doc, weekStart, mentor, totals, logoDataUrl);
    },
    didDrawCell: (data) => {
      // Mini progress bar under the merged "Free Time" cell (column 3, first row of group)
      if (
        data.section === "body" &&
        data.column.index === 3 &&
        data.cell.raw &&
        // Only the row that actually rendered the merged cell will have it
        typeof data.row.index === "number"
      ) {
        const info = tutorAtRow[data.row.index];
        if (!info || !info.firstRow) return;
        const x = data.cell.x + 10;
        const w = data.cell.width - 20;
        const y = data.cell.y + data.cell.height - 14;
        // Track
        doc.setFillColor(230, 236, 248);
        doc.roundedRect(x, y, w, 6, 3, 3, "F");
        // Fill (blue→orange depending on saturation)
        const pct = Math.max(0, Math.min(100, info.utilPct));
        const fillW = (w * pct) / 100;
        const c = pct >= 95 ? ORANGE : BLUE;
        doc.setFillColor(...c);
        if (fillW > 0) doc.roundedRect(x, y, fillW, 6, 3, 3, "F");
      }
    },
    didDrawPage: (data) => {
      drawFooter(doc, data.pageNumber + 1, logoDataUrl); // +1 because cover is page 1
    },
  });

  return doc;
}

function safeFile(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 80);
}

// ---------- Single PDF (download) ----------
export async function generateMentorStudyPlanPdf(
  weekStart: string,
  mentor: string,
  plans: WeeklyPlan[],
): Promise<void> {
  const logoDataUrl = await loadImage(logoUrl).catch(() => undefined);
  const doc = buildMentorPdf({ weekStart, mentor, plans, logoDataUrl });
  doc.save(`study-plan-${safeFile(mentor)}-${weekStart}.pdf`);
}

// ---------- Preview (returns blob URL) ----------
export interface MentorPdfPreview {
  mentor: string;
  fileName: string;
  url: string;
  blob: Blob;
  tutors: number;
}

export async function generateMentorStudyPlanPreview(
  weekStart: string,
  mentor: string,
  plans: WeeklyPlan[],
): Promise<MentorPdfPreview> {
  const logoDataUrl = await loadImage(logoUrl).catch(() => undefined);
  const doc = buildMentorPdf({ weekStart, mentor, plans, logoDataUrl });
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  return {
    mentor,
    fileName: `study-plan-${safeFile(mentor)}-${weekStart}.pdf`,
    url,
    blob,
    tutors: plans.length,
  };
}

export async function generateAllMentorPreviews(
  weekStart: string,
  plans: WeeklyPlan[],
  onEach?: (preview: MentorPdfPreview, index: number, total: number) => void,
): Promise<MentorPdfPreview[]> {
  const groups = groupPlansByMentor(plans);
  if (groups.length === 0) return [];
  const logoDataUrl = await loadImage(logoUrl).catch(() => undefined);
  const previews: MentorPdfPreview[] = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    await new Promise((r) => setTimeout(r, 0));
    const doc = buildMentorPdf({
      weekStart,
      mentor: g.mentor,
      plans: g.plans,
      logoDataUrl,
    });
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const item: MentorPdfPreview = {
      mentor: g.mentor,
      fileName: `study-plan-${safeFile(g.mentor)}-${weekStart}.pdf`,
      url,
      blob,
      tutors: g.plans.length,
    };
    previews.push(item);
    onEach?.(item, i, groups.length);
  }
  return previews;
}

// ---------- Bulk ZIP (download) ----------
export interface MentorPdfReady {
  mentor: string;
  fileName: string;
  url: string;
  blob: Blob;
  tutors: number;
}

export interface BulkProgressEvents {
  onStart?: (mentor: string, index: number, total: number) => void;
  onReady?: (info: MentorPdfReady, index: number, total: number) => void;
  onError?: (mentor: string, error: Error, index: number, total: number) => void;
  onZipReady?: (zipFileName: string, zipUrl: string) => void;
}

export async function generateBulkMentorStudyPlansZip(
  weekStart: string,
  plans: WeeklyPlan[],
  events: BulkProgressEvents = {},
): Promise<{ mentors: number; fileName: string; zipUrl: string } | null> {
  const groups = groupPlansByMentor(plans);
  if (groups.length === 0) return null;

  const logoDataUrl = await loadImage(logoUrl).catch(() => undefined);
  const zip = new JSZip();
  const total = groups.length;

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    events.onStart?.(g.mentor, i, total);
    try {
      await new Promise((r) => setTimeout(r, 0));
      const doc = buildMentorPdf({
        weekStart,
        mentor: g.mentor,
        plans: g.plans,
        logoDataUrl,
      });
      const blob = doc.output("blob");
      const fileName = `study-plan-${safeFile(g.mentor)}-${weekStart}.pdf`;
      zip.file(fileName, blob);
      const url = URL.createObjectURL(blob);
      events.onReady?.(
        { mentor: g.mentor, fileName, url, blob, tutors: g.plans.length },
        i,
        total,
      );
    } catch (e: any) {
      events.onError?.(
        g.mentor,
        e instanceof Error ? e : new Error(String(e)),
        i,
        total,
      );
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const zipUrl = URL.createObjectURL(zipBlob);
  const fileName = `study-plans-${weekStart}.zip`;
  const a = document.createElement("a");
  a.href = zipUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  events.onZipReady?.(fileName, zipUrl);

  return { mentors: groups.length, fileName, zipUrl };
}
