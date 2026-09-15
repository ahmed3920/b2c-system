import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// iSchool brand palette
const BLUE: [number, number, number] = [5, 110, 236];
const ORANGE: [number, number, number] = [254, 127, 27];
const INK: [number, number, number] = [28, 39, 64];
const SUBINK: [number, number, number] = [110, 122, 148];
const SOFT: [number, number, number] = [240, 246, 255];

export interface CsPdfKpi {
  label: string;
  value: string;
  sub?: string;
}

export interface CsPdfTable {
  title: string;
  head: string[];
  body: (string | number)[][];
}

export interface CsPdfOptions {
  filters: { label: string; value: string }[];
  showing: string;
  kpis: CsPdfKpi[];
  tables: CsPdfTable[];
  fileName: string;
}

/** Serialise a live recharts <svg> into a PNG data URL, inlining computed colours. */
async function svgToPng(svg: SVGSVGElement, scale = 2): Promise<{ data: string; w: number; h: number } | null> {
  const rect = svg.getBoundingClientRect();
  const w = Math.ceil(rect.width);
  const h = Math.ceil(rect.height);
  if (!w || !h) return null;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  const originals = svg.querySelectorAll<SVGElement>("*");
  const clones = clone.querySelectorAll<SVGElement>("*");
  const COPY = ["fill", "stroke", "stroke-width", "stroke-dasharray", "font-size", "font-family", "font-weight", "opacity", "fill-opacity", "stroke-opacity", "text-anchor"];
  originals.forEach((el, i) => {
    const target = clones[i];
    if (!target) return;
    const cs = window.getComputedStyle(el);
    for (const prop of COPY) {
      const val = cs.getPropertyValue(prop);
      if (val && val !== "none" ) target.setAttribute(prop, val);
      else if (val === "none") target.setAttribute(prop, "none");
    }
  });
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));

  const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  const img = new Image();
  img.decoding = "sync";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("chart render failed"));
    img.src = src;
  });

  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, w, h);
  return { data: canvas.toDataURL("image/png"), w, h };
}

/** Collect every chart inside the container marked with data-chart="Title". */
async function collectCharts(container: HTMLElement) {
  const out: { title: string; png: string; w: number; h: number; legend: string }[] = [];
  const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-chart]"));
  for (const node of nodes) {
    const svg = node.querySelector("svg");
    if (!svg) continue;
    try {
      const png = await svgToPng(svg as SVGSVGElement);
      const legend = Array.from(node.querySelectorAll(".recharts-legend-item-text"))
        .map((el) => (el.textContent || "").trim())
        .filter(Boolean)
        .join("  •  ");
      if (png) out.push({ title: node.dataset.chart || "", png: png.data, w: png.w, h: png.h, legend });
    } catch {
      /* skip charts that fail to rasterise */
    }
  }
  return out;
}

export async function exportCsTicketsToPdf(container: HTMLElement, opts: CsPdfOptions) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 12;

  // ---- Header band
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setFillColor(...ORANGE);
  doc.rect(0, 22, pageW, 1.6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("CS Tickets Analysis", M, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Generated ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`,
    pageW - M,
    13,
    { align: "right" },
  );

  let y = 32;

  // ---- Filters summary
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Filters applied", M, y);
  y += 2;
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2, textColor: INK, lineColor: [225, 232, 245] },
    headStyles: { fillColor: SOFT, textColor: INK, fontStyle: "bold" },
    head: [opts.filters.map((f) => f.label)],
    body: [opts.filters.map((f) => f.value)],
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SUBINK);
  doc.text(opts.showing, M, y);
  y += 6;

  // ---- KPI cards
  const perRow = Math.min(opts.kpis.length, 7) || 1;
  const gap = 3;
  const cardW = (pageW - M * 2 - gap * (perRow - 1)) / perRow;
  const cardH = 20;
  opts.kpis.forEach((k, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const x = M + col * (cardW + gap);
    const cy = y + row * (cardH + gap);
    doc.setFillColor(...SOFT);
    doc.setDrawColor(225, 232, 245);
    doc.roundedRect(x, cy, cardW, cardH, 2, 2, "FD");
    doc.setFontSize(7.5);
    doc.setTextColor(...SUBINK);
    doc.text(k.label, x + 3, cy + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...BLUE);
    doc.text(String(k.value), x + 3, cy + 13.5);
    doc.setFont("helvetica", "normal");
    if (k.sub) {
      doc.setFontSize(7);
      doc.setTextColor(...SUBINK);
      doc.text(k.sub, x + 3, cy + 18);
    }
  });
  y += Math.ceil(opts.kpis.length / perRow) * (cardH + gap) + 4;

  // ---- Charts
  const charts = await collectCharts(container);
  const MAX_CHART_H = 78; // two charts per page
  for (const c of charts) {
    const maxW = pageW - M * 2;
    const aspect = c.h / c.w;
    let drawH = Math.min(aspect * maxW, MAX_CHART_H);
    let drawW = drawH / aspect;
    if (drawW > maxW) {
      drawW = maxW;
      drawH = aspect * drawW;
    }
    const blockH = drawH + (c.legend ? 5 : 0) + 11;
    if (y + blockH > pageH - 12) {
      doc.addPage();
      y = M + 6;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(c.title, M, y);
    y += 3;
    doc.addImage(c.png, "PNG", M, y, drawW, drawH, undefined, "FAST");
    y += drawH;
    if (c.legend) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...SUBINK);
      doc.text(c.legend, M, y + 4);
      y += 5;
    }
    y += 8;
  }

  // ---- Tables
  for (const t of opts.tables) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(t.title, M, M + 6);
    autoTable(doc, {
      startY: M + 10,
      margin: { left: M, right: M },
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 1.8, textColor: INK },
      headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 251, 255] },
      head: [t.head],
      body: t.body.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c)))),
    });
  }

  // ---- Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SUBINK);
    doc.text("© 2026 iSchool – All rights reserved", M, pageH - 6);
    doc.text(`Page ${p} of ${pages}`, pageW - M, pageH - 6, { align: "right" });
  }

  doc.save(opts.fileName);
}
