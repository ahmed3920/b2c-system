// Lightweight CSV builder + browser downloader.
// Wraps values, escapes quotes, prepends UTF-8 BOM so Excel opens unicode correctly.

const escapeCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  let s: string;
  if (v instanceof Date) s = v.toISOString();
  else if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  // Strip newlines/tabs that confuse spreadsheets, then quote-escape.
  s = s.replace(/\r?\n/g, " ").replace(/\t/g, " ");
  if (s.includes(",") || s.includes('"')) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const r of rows) lines.push(r.map(escapeCell).join(","));
  return "\uFEFF" + lines.join("\n");
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = buildCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
