import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";
import logoUrl from "@/assets/ischool-icon.png";
import type { WeeklyPlan } from "@/hooks/useWeeklyStudyPlans";
import { getMentorForTutor } from "@/lib/tutorMentorLookup";

// Brand
const BLUE: [number, number, number] = [5, 110, 236]; // #056eec
const ORANGE: [number, number, number] = [254, 127, 27]; // #fe7f1b
const ROW_BG: [number, number, number] = [240, 244, 255];

// Compute Friday→Tuesday display range for the title (5 working days).
function formatRange(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 4); // Fri + 4 = Tue
  const f = (d: Date) =>
    `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
  return `${f(start)} to ${f(end)}`;
}

// Compute "Week N" label by counting Fridays from a fixed epoch (the year start).
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

function buildMentorPdf({ weekStart, mentor, plans, logoDataUrl }: BuildOptions): jsPDF {
  // Landscape A4 to match the sample
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;

  const drawHeader = () => {
    // Decorative chevrons top-right
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
    doc.setFontSize(36);
    doc.text(`Study Plan Week ${weekNumber(weekStart)}`, marginX, 150);

    // Subtitle
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Start from ${formatRange(weekStart)}`, marginX, 178);

    // Mentor label
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Mentor: ${mentor}`, marginX, 198);
  };

  drawHeader();

  // Build rows: one row per plan item. Use rowSpan-like grouping by repeating
  // the tutor name on the first item only and leaving the rest blank for visual grouping.
  const body: any[] = [];
  for (const p of plans) {
    const items = p.items ?? [];
    items.forEach((it, idx) => {
      const grade = it.module?.grade_band ?? "?";
      const code = it.module?.module_code ?? "?";
      const required = it.module?.hours_required ?? 0;
      const planned = Number(it.planned_hours);
      const partial = it.is_partial ? " (half)" : " (full)";
      const moduleText = `Grade ${grade} - ${code}${partial}`;
      const timeText = `${planned} ${planned === 1 ? "Hour" : "Hours"}${required ? ` of ${required}` : ""}`;
      const freeText = idx === 0 ? `${p.free_hours} h available` : "";

      body.push([
        idx === 0 ? p.tutor_name : "",
        moduleText,
        timeText,
        freeText,
      ]);
    });
  }

  if (body.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(12);
    doc.text("No modules planned for this mentor's team.", marginX, 240);
    return doc;
  }

  autoTable(doc, {
    startY: 215,
    margin: { left: marginX, right: marginX },
    head: [["Tutor Name", "Modules Name", "Time For it", "Your Free Time"]],
    body,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 12,
      cellPadding: 10,
      lineColor: [220, 226, 240],
      lineWidth: 0.5,
      valign: "middle",
      halign: "center",
    },
    headStyles: {
      fillColor: BLUE,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 13,
      halign: "center",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 180 },
      1: { fontStyle: "bold" },
      2: { fillColor: [255, 245, 230], fontStyle: "bold" },
      3: { fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: ROW_BG },
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
    },
  });

  return doc;
}

function safeFile(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 80);
}

export async function generateMentorStudyPlanPdf(
  weekStart: string,
  mentor: string,
  plans: WeeklyPlan[],
): Promise<void> {
  const logoDataUrl = await loadImage(logoUrl).catch(() => undefined);
  const doc = buildMentorPdf({ weekStart, mentor, plans, logoDataUrl });
  doc.save(`study-plan-${safeFile(mentor)}-${weekStart}.pdf`);
}

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
      // Yield to the event loop so the UI can paint the "in-progress" state
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
      events.onError?.(g.mentor, e instanceof Error ? e : new Error(String(e)), i, total);
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
