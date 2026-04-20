import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type SheetKind =
  | "upcoming_sessions"
  | "pre_modules"
  | "ended_sessions"
  | "post_modules";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Convert any Google Sheets URL into a published CSV export URL.
function toCsvUrl(input: string): string {
  const url = input.trim();
  if (!url) return url;
  // Already CSV
  if (url.includes("output=csv") || url.endsWith(".csv")) return url;

  // /spreadsheets/d/<ID>/...  → /export?format=csv&gid=<gid>
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (idMatch) {
    const id = idMatch[1];
    const gidMatch = url.match(/[#&?]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : "0";
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  }
  return url;
}

// Minimal RFC4180-ish CSV parser (handles quotes + embedded commas/newlines).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        cur.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function toBool(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return ["true", "1", "yes", "y", "done", "finished", "complete"].includes(s);
}

function normGradeBand(s: string): string {
  // Accept "Grade 1-2", "Grade 1 - 2", "grade 1 to 2" → "Grade 1 - 2"
  const m = s.match(/(\d+)\s*[-–to]+\s*(\d+)/i);
  if (m) return `Grade ${m[1]} - ${m[2]}`;
  return s.trim();
}

function normModuleCode(s: string): string {
  const m = s.match(/M\s*([1-4])/i);
  return m ? `M${m[1]}` : s.trim().toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

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

    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    if (!(roles ?? []).some((r: any) => r.role === "admin"))
      return json({ error: "Admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const sheetKind: SheetKind = body.sheet_kind;
    const weekStart: string = body.week_start;

    const validKinds: SheetKind[] = [
      "upcoming_sessions",
      "pre_modules",
      "ended_sessions",
      "post_modules",
    ];
    if (!validKinds.includes(sheetKind))
      return json({ error: "Invalid sheet_kind" }, 400);
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart))
      return json({ error: "week_start (YYYY-MM-DD) required" }, 400);

    // Load config
    const { data: cfg, error: cfgErr } = await admin
      .from("study_plan_sheet_configs")
      .select("csv_url, column_mapping")
      .eq("sheet_kind", sheetKind)
      .maybeSingle();
    if (cfgErr) throw cfgErr;
    if (!cfg?.csv_url)
      return json({ error: "Sheet URL not configured for this kind" }, 400);

    const mapping = (cfg.column_mapping ?? {}) as Record<string, string>;
    const csvUrl = toCsvUrl(cfg.csv_url);

    // Fetch CSV
    const resp = await fetch(csvUrl, { redirect: "follow" });
    if (!resp.ok)
      return json(
        { error: `Failed to fetch sheet: HTTP ${resp.status}` },
        502,
      );
    const text = await resp.text();
    const rows = parseCsv(text);
    if (rows.length < 2) return json({ error: "Sheet has no data rows" }, 400);

    const header = rows[0].map((h) => h.trim());
    const idx = (logicalKey: string): number => {
      const colName = mapping[logicalKey] ?? logicalKey;
      return header.findIndex(
        (h) => h.toLowerCase() === String(colName).toLowerCase(),
      );
    };

    const get = (row: string[], i: number) =>
      i >= 0 && i < row.length ? row[i].trim() : "";

    const isPre =
      sheetKind === "upcoming_sessions" || sheetKind === "pre_modules";
    const phase = isPre ? "pre" : "post";
    const isSessions =
      sheetKind === "upcoming_sessions" || sheetKind === "ended_sessions";

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    if (isSessions) {
      const iId = idx("tutor_external_id");
      const iName = idx("tutor_name");
      const iTl = idx("team_leader");
      const iSess = idx("scheduled_sessions");
      if (iId < 0 || iName < 0 || iTl < 0 || iSess < 0)
        return json(
          {
            error:
              "Missing required columns. Need: tutor_external_id, tutor_name, team_leader, scheduled_sessions",
          },
          400,
        );

      const records: any[] = [];
      for (const row of rows.slice(1)) {
        const tid = get(row, iId);
        if (!tid) {
          skipped++;
          continue;
        }
        const sessionsRaw = get(row, iSess).replace(/[^\d.-]/g, "");
        const sessions = parseInt(sessionsRaw || "0", 10);
        records.push({
          tutor_external_id: tid,
          tutor_name: get(row, iName) || tid,
          team_leader: get(row, iTl) || "Unknown",
          week_start: weekStart,
          phase,
          scheduled_sessions: Number.isFinite(sessions) ? sessions : 0,
          source: "google_sheet",
        });
      }
      if (records.length) {
        const { error } = await admin
          .from("tutor_weekly_occupation")
          .upsert(records, {
            onConflict: "tutor_external_id,week_start,phase",
          });
        if (error) throw error;
        inserted = records.length;
      }
    } else {
      // Modules sheet
      const iId = idx("tutor_external_id");
      const iName = idx("tutor_name");
      const iTl = idx("team_leader");
      const iGrade = idx("grade_band");
      const iMod = idx("module_code");
      const iFin = idx("is_finished");
      if (iId < 0 || iName < 0 || iTl < 0 || iGrade < 0 || iMod < 0)
        return json(
          {
            error:
              "Missing required columns. Need: tutor_external_id, tutor_name, team_leader, grade_band, module_code, is_finished (optional)",
          },
          400,
        );

      // Load module catalog → key by "grade_band|module_code"
      const { data: modules } = await admin
        .from("study_modules")
        .select("id, grade_band, module_code");
      const modIdx = new Map<string, string>();
      for (const m of modules ?? []) {
        modIdx.set(`${m.grade_band}|${m.module_code}`.toLowerCase(), m.id);
      }

      const records: any[] = [];
      for (const row of rows.slice(1)) {
        const tid = get(row, iId);
        if (!tid) {
          skipped++;
          continue;
        }
        const gb = normGradeBand(get(row, iGrade));
        const mc = normModuleCode(get(row, iMod));
        const moduleId = modIdx.get(`${gb}|${mc}`.toLowerCase());
        if (!moduleId) {
          errors.push(`Unknown module: ${gb} / ${mc}`);
          skipped++;
          continue;
        }
        records.push({
          tutor_external_id: tid,
          tutor_name: get(row, iName) || tid,
          team_leader: get(row, iTl) || "Unknown",
          week_start: weekStart,
          phase,
          module_id: moduleId,
          is_assigned: true,
          is_finished: iFin >= 0 ? toBool(get(row, iFin)) : false,
        });
      }
      if (records.length) {
        const { error } = await admin
          .from("tutor_published_modules")
          .upsert(records, {
            onConflict: "tutor_external_id,week_start,phase,module_id",
          });
        if (error) throw error;
        inserted = records.length;
      }
    }

    return json({
      success: true,
      sheet_kind: sheetKind,
      week_start: weekStart,
      rows_parsed: rows.length - 1,
      rows_inserted: inserted,
      rows_skipped: skipped,
      warnings: errors.slice(0, 10),
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
