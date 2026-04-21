import jsPDF from "jspdf";
import autoTable, { type RowInput, type CellDef } from "jspdf-autotable";
import JSZip from "jszip";
import logoUrl from "@/assets/ischool-icon.png";
import type { WeeklyPlan } from "@/hooks/useWeeklyStudyPlans";
import { getMentorForTutor } from "@/lib/tutorMentorLookup";

// Brand
const BLUE: [number, number, number] = [5, 110, 236]; // #056eec
const ORANGE: [number, number, number] = [254, 127, 27]; // #fe7f1b
const ROW_BG: [number, number, number] = [240, 244, 255];
const ROW_ALT: [number, number, number] = [255, 255, 255];
const TIME_BG: [number, number, number] = [255, 240, 220];

// Compute Friday→Tuesday display range for the title (5 working days).
function formatRange(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 4); // Fri + 4 = Tue
  const f = (d: Date) =>
    `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
  return `${f(start)} to ${f(end)}`;
}

// "Week N" label by counting whole weeks from start of year.
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
    if (!p.items || p.items.length === 0) continue; // exclude tutors w/ no modules
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

const HEADER_HEIGHT = 220; // reserved space for the title block

function buildMentorPdf({
  weekStart,
  mentor,
  plans,
  logoDataUrl,
}: BuildOptions): jsPDF {
  // Landscape A4 to match the sample (842 x 595 pt)
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;

  // Totals across all tutor items, used in the subtitle.
  const totalTutors = plans.length;
  const totalItems = plans.reduce((s, p) => s + (p.items?.length ?? 0), 0);
  const totalPlanned = plans.reduce(
    (s, p) =>
      s +
      (p.items?.reduce((a, it) => a + Number(it.planned_hours ?? 0), 0) ?? 0),
    0,
  );

  const drawHeader = () => {
    // Decorative chevrons top-right (non-overlapping with the title)
    doc.setFillColor(...ORANGE);
    doc.triangle(pageW - 170, 18, pageW - 60, 18, pageW - 115, 110, "F");
    doc.setFillColor(...BLUE);
    doc.triangle(pageW - 130, 18, pageW - 20, 18, pageW - 75, 110, "F");

    // Logo
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, "PNG", marginX, 28, 70, 38);
      } catch {
        /* ignore */
      }
    }

    // Title
    doc.setTextColor(...BLUE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(30);
    doc.text(`Study Plan Week ${weekNumber(weekStart)}`, marginX, 110);

    // Subtitle (date range)
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`Start from ${formatRange(weekStart)}`, marginX, 138);

    // Mentor + summary line
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.text(
      `Mentor: ${mentor}   ·   ${totalTutors} tutor${totalTutors === 1 ? "" : "s"}   ·   ${totalItems} module${totalItems === 1 ? "" : "s"}   ·   ${totalPlanned} planned hour${totalPlanned === 1 ? "" : "s"}`,
      marginX,
      160,
    );

    // Divider
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(1.5);
    doc.line(marginX, 178, pageW - marginX, 178);
  };

  drawHeader();

  // Build rows with proper rowSpan grouping per tutor so the tutor name and
  // the "free time" cell visually merge across all of that tutor's modules.
  const body: RowInput[] = [];
  for (const p of plans) {
    const items = p.items ?? [];
    if (items.length === 0) continue;
    const planned = items.reduce(
      (s, it) => s + Number(it.planned_hours ?? 0),
      0,
    );
    items.forEach((it, idx) => {
      const grade = it.module?.grade_band ?? "?";
      const code = it.module?.module_code ?? "?";
      const required = Number(it.module?.hours_required ?? 0);
      const itemPlanned = Number(it.planned_hours ?? 0);
      const partial = it.is_partial ? "Half" : "Full";
      const moduleText = `Grade ${grade} — ${code}  (${partial})`;
      const timeText = required
        ? `${itemPlanned} of ${required} h`
        : `${itemPlanned} h`;

      const row: CellDef[] = [];

      // Tutor column — rowSpan on the first item, skip the others
      if (idx === 0) {
        row.push({
          content: p.tutor_name,
          rowSpan: items.length,
          styles: {
            fontStyle: "bold",
            valign: "middle",
            halign: "center",
            fillColor: ROW_BG,
            textColor: [25, 25, 25],
          },
        });
      }

      row.push({ content: moduleText });
      row.push({
        content: timeText,
        styles: { fillColor: TIME_BG, fontStyle: "bold" },
      });

      // Free-time column — rowSpan on the first item, skip the others
      if (idx === 0) {
        row.push({
          content: `${p.free_hours} h available\n(planned ${planned} h)`,
          rowSpan: items.length,
          styles: {
            valign: "middle",
            halign: "center",
            fontStyle: "bold",
            textColor: [...BLUE] as [number, number, number],
            fillColor: [255, 255, 255],
          },
        });
      }

      body.push(row);
    });
  }

  if (body.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(12);
    doc.text(
      "No modules planned for this mentor's team.",
      marginX,
      HEADER_HEIGHT + 20,
    );
    return doc;
  }

  // Pin column widths so the inner page width is fully used.
  const innerW = pageW - marginX * 2;
  const colTutor = 170;
  const colTime = 110;
  const colFree = 130;
  const colModules = innerW - (colTutor + colTime + colFree);

  autoTable(doc, {
    startY: HEADER_HEIGHT,
    margin: { left: marginX, right: marginX, top: HEADER_HEIGHT },
    head: [["Tutor Name", "Modules Name", "Time For It", "Your Free Time"]],
    body,
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 11,
      cellPadding: { top: 8, bottom: 8, left: 10, right: 10 },
      lineColor: [220, 226, 240],
      lineWidth: 0.5,
      valign: "middle",
      halign: "center",
      overflow: "linebreak",
      minCellHeight: 26,
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
    alternateRowStyles: { fillColor: ROW_ALT },
    bodyStyles: { fillColor: ROW_BG },
    didDrawPage: (data) => {
      // Re-draw header on continuation pages
      if (data.pageNumber > 1) {
        drawHeader();
      }
      // Footer
      doc.setFontSize(9);
      doc.setTextColor(140, 140, 140);
      doc.text(
        `\u00A9 2026 iSchool \u2013 All rights reserved`,
        pageW / 2,
        pageH - 18,
        { align: "center" },
      );
      doc.text(
        `Page ${data.pageNumber}`,
        pageW - marginX,
        pageH - 18,
        { align: "right" },
      );
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
  url: string; // object URL — caller MUST URL.revokeObjectURL when done
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
    // Yield to let the UI repaint between heavy renders
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
  url: string; // object URL for individual download
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
