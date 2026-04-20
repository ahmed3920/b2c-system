import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function toCsvUrl(input: string): string {
  const url = input.trim();
  if (!url) return url;
  if (url.includes("output=csv") || url.endsWith(".csv")) return url;
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (idMatch) {
    const id = idMatch[1];
    const gidMatch = url.match(/[#&?]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : "0";
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  }
  return url;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field); rows.push(cur); cur = []; field = "";
      } else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// Parse dates like 24/4/2026, 24-04-2026, 2026-04-24, 4/24/2026 (US fallback)
function parseDate(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  // ISO yyyy-mm-dd
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // d/m/yyyy or d-m-yyyy (assume day-first since user wrote 24/4)
  m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [_, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    // If first part > 12, definitely day-first. Otherwise default day-first.
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // fallback Date.parse
  const dt = new Date(t);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}

function* dateRange(start: string, end: string) {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    if (!(roles ?? []).some((r: any) => r.role === "admin"))
      return json({ error: "Admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const replaceFrom: string | undefined = body.replace_from; // optional yyyy-mm-dd
    const replaceTo: string | undefined = body.replace_to;

    const { data: cfg, error: cfgErr } = await admin
      .from("study_plan_sheet_configs")
      .select("csv_url, column_mapping")
      .eq("sheet_kind", "leaves")
      .maybeSingle();
    if (cfgErr) throw cfgErr;
    if (!cfg?.csv_url) return json({ error: "Leaves sheet URL not configured" }, 400);

    const mapping = (cfg.column_mapping ?? {}) as Record<string, string>;
    const csvUrl = toCsvUrl(cfg.csv_url);

    const resp = await fetch(csvUrl, { redirect: "follow" });
    if (!resp.ok) {
      const hint = (resp.status === 401 || resp.status === 403)
        ? " — make sure the Google Sheet is shared as 'Anyone with the link (Viewer)' or published."
        : "";
      return json({ error: `Failed to fetch sheet: HTTP ${resp.status}${hint}` }, 502);
    }
    let text = await resp.text();
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const rows = parseCsv(text);
    if (rows.length < 2) return json({ error: "Sheet has no data rows" }, 400);

    const normalize = (s: string) =>
      s.replace(/\uFEFF/g, "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    const header = rows[0].map((h) => h.trim());
    const headerNorm = header.map(normalize);
    const idx = (logicalKey: string): number => {
      const colName = mapping[logicalKey] ?? logicalKey;
      return headerNorm.findIndex((h) => h === normalize(String(colName)));
    };
    const get = (row: string[], i: number) => (i >= 0 && i < row.length ? row[i].trim() : "");

    const iId = idx("tutor_external_id");
    const iName = idx("tutor_name");
    const iTl = idx("team_leader"); // optional
    const iFrom = idx("leave_start");
    const iTo = idx("leave_end");

    if (iId < 0 || iFrom < 0 || iTo < 0) {
      const missing: string[] = [];
      if (iId < 0) missing.push(`tutor_external_id → "${mapping.tutor_external_id ?? "T ID"}"`);
      if (iFrom < 0) missing.push(`leave_start → "${mapping.leave_start ?? "From"}"`);
      if (iTo < 0) missing.push(`leave_end → "${mapping.leave_end ?? "To"}"`);
      return json({
        error: `Missing columns: ${missing.join(", ")}. Headers found: ${header.join(" | ")}`,
      }, 400);
    }

    const records: Array<{
      tutor_external_id: string;
      tutor_name: string | null;
      team_leader: string | null;
      leave_date: string;
      source: string;
    }> = [];
    const warnings: string[] = [];
    let skipped = 0;

    for (const row of rows.slice(1)) {
      const tid = get(row, iId);
      if (!tid) { skipped++; continue; }
      const fromS = parseDate(get(row, iFrom));
      const toS = parseDate(get(row, iTo)) ?? fromS;
      if (!fromS || !toS) {
        warnings.push(`Bad dates for ${tid}: "${get(row, iFrom)}" → "${get(row, iTo)}"`);
        skipped++;
        continue;
      }
      const tname = iName >= 0 ? get(row, iName) || tid : tid;
      const tl = iTl >= 0 ? get(row, iTl) || null : null;
      for (const d of dateRange(fromS, toS)) {
        records.push({
          tutor_external_id: tid,
          tutor_name: tname,
          team_leader: tl,
          leave_date: d,
          source: "google_sheet",
        });
      }
    }

    // Replace strategy: clear leaves overlapping the replace window (or all sheet-source leaves if not specified)
    let delQ = admin.from("tutor_leaves").delete().eq("source", "google_sheet");
    if (replaceFrom) delQ = delQ.gte("leave_date", replaceFrom);
    if (replaceTo) delQ = delQ.lte("leave_date", replaceTo);
    const { error: delErr } = await delQ;
    if (delErr) throw delErr;

    let inserted = 0;
    if (records.length) {
      // Dedupe to avoid unique constraint conflicts
      const seen = new Set<string>();
      const unique = records.filter((r) => {
        const k = `${r.tutor_external_id}|${r.leave_date}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const { error } = await admin.from("tutor_leaves").upsert(unique, {
        onConflict: "tutor_external_id,leave_date",
      });
      if (error) throw error;
      inserted = unique.length;
    }

    return json({
      success: true,
      rows_parsed: rows.length - 1,
      leave_days_inserted: inserted,
      rows_skipped: skipped,
      warnings: warnings.slice(0, 10),
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
