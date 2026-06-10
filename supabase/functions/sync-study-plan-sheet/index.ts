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

// Minimal RFC4180-ish CSV parser
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
        } else inQuotes = false;
      } else field += c;
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

function normGradeBand(s: string): string {
  const m = s.match(/(\d+)\s*[-–to]+\s*(\d+)/i);
  if (m) return `Grade ${m[1]} - ${m[2]}`;
  return s.trim();
}

// Extract M1/M2/M3/M4 from strings like "M1: 2D Game Design With Game Engine - 1"
function extractModuleCode(s: string): string | null {
  const m = s.match(/\bM\s*([1-4])\b/i);
  return m ? `M${m[1]}` : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.slice("Bearer ".length);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const allowed = new Set(["admin", "team_leader", "super_team_leader"]);
    if (!(roles ?? []).some((r: any) => allowed.has(r.role)))
      return json({ error: "Admin or team leader only" }, 403);


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

    const resp = await fetch(csvUrl, { redirect: "follow" });
    if (!resp.ok) {
      const hint =
        resp.status === 401 || resp.status === 403
          ? " — make sure the Google Sheet is shared as 'Anyone with the link (Viewer)' OR published via File → Share → Publish to web."
          : "";
      return json(
        { error: `Failed to fetch sheet: HTTP ${resp.status}${hint}` },
        502,
      );
    }
    let text = await resp.text();
    // Strip UTF-8 BOM if present (breaks first-column header match)
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const rows = parseCsv(text);
    if (rows.length < 2) return json({ error: "Sheet has no data rows" }, 400);

    // Normalize headers: lowercase, collapse whitespace, unify arrow variants
    const normalize = (s: string) =>
      s
        .replace(/\uFEFF/g, "")
        .replace(/\u00A0/g, " ") // nbsp → space
        .replace(/[→➔➜➝➞➟➠]/g, "→") // any arrow variant → standard
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    const header = rows[0].map((h) => h.trim());
    const headerNorm = header.map(normalize);
    const idx = (logicalKey: string): number => {
      const colName = mapping[logicalKey] ?? logicalKey;
      return headerNorm.findIndex((h) => h === normalize(String(colName)));
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
      // Sessions sheet: 1 row = 1 scheduled session. We aggregate per tutor.
      const iId = idx("tutor_external_id");
      const iName = idx("tutor_name");
      const iTl = idx("team_leader");
      const iEmploy = idx("employ_type"); // optional: 0=full-time, 1=part-time (skipped)
      if (iId < 0 || iName < 0 || iTl < 0) {
        const missing = [
          ["tutor_external_id", iId],
          ["tutor_name", iName],
          ["team_leader", iTl],
        ]
          .filter(([, i]) => (i as number) < 0)
          .map(([k]) => `${k} → "${mapping[k as string] ?? k}"`);
        return json(
          {
            error: `Missing columns in sheet: ${missing.join(", ")}. Sheet headers found: ${header.join(" | ")}`,
          },
          400,
        );
      }

      const isPartTime = (v: string) => {
        const s = v.trim().toLowerCase();
        return s === "1" || s === "part time" || s === "part-time" || s === "parttime" || s === "pt";
      };

      const agg = new Map<
        string,
        { tutor_name: string; team_leader: string; count: number }
      >();
      for (const row of rows.slice(1)) {
        const tid = get(row, iId);
        if (!tid) {
          skipped++;
          continue;
        }
        if (iEmploy >= 0 && isPartTime(get(row, iEmploy))) {
          skipped++;
          continue;
        }
        const cur = agg.get(tid);
        if (cur) cur.count += 1;
        else
          agg.set(tid, {
            tutor_name: get(row, iName) || tid,
            team_leader: get(row, iTl) || "Unknown",
            count: 1,
          });
      }

      const records = Array.from(agg.entries()).map(([tid, v]) => ({
        tutor_external_id: tid,
        tutor_name: v.tutor_name,
        team_leader: v.team_leader,
        week_start: weekStart,
        phase,
        scheduled_sessions: v.count,
        source: "google_sheet",
      }));

      if (records.length) {
        // Wipe this tutor/week/phase set first to avoid stale rows
        const { error: delErr } = await admin
          .from("tutor_weekly_occupation")
          .delete()
          .eq("week_start", weekStart)
          .eq("phase", phase);
        if (delErr) throw delErr;

        const { error } = await admin
          .from("tutor_weekly_occupation")
          .insert(records);
        if (error) throw error;
        inserted = records.length;
      }
    } else {
      // Modules sheet
      const iId = idx("tutor_external_id");
      const iName = idx("tutor_name");
      const iTl = idx("team_leader");
      const iGrade = idx("grade_band"); // requires user-added column
      const iLevelName = idx("level_name"); // "Levels → Name" — used to parse module code
      const iPublished = idx("published_at"); // optional

      if (iId < 0 || iName < 0 || iTl < 0 || iGrade < 0 || iLevelName < 0) {
        const missing = [
          ["tutor_external_id", iId],
          ["tutor_name", iName],
          ["team_leader", iTl],
          ["grade_band", iGrade],
          ["level_name", iLevelName],
        ]
          .filter(([, i]) => (i as number) < 0)
          .map(([k]) => `${k} → "${mapping[k as string] ?? k}"`);
        return json(
          {
            error: `Missing columns in sheet: ${missing.join(", ")}. Sheet headers found: ${header.join(" | ")}`,
          },
          400,
        );
      }

      const { data: modules } = await admin
        .from("study_modules")
        .select("id, grade_band, module_code");
      const modIdx = new Map<string, string>();
      for (const m of modules ?? []) {
        modIdx.set(`${m.grade_band}|${m.module_code}`.toLowerCase(), m.id);
      }

      const records: any[] = [];
      const seen = new Set<string>(); // dedupe (tutor, module) within sheet
      for (const row of rows.slice(1)) {
        const tid = get(row, iId);
        if (!tid) {
          skipped++;
          continue;
        }
        const gb = normGradeBand(get(row, iGrade));
        const mc = extractModuleCode(get(row, iLevelName));
        if (!mc) {
          errors.push(`Cannot parse module code from: "${get(row, iLevelName)}"`);
          skipped++;
          continue;
        }
        const moduleId = modIdx.get(`${gb}|${mc}`.toLowerCase());
        if (!moduleId) {
          errors.push(`Unknown module: ${gb} / ${mc}`);
          skipped++;
          continue;
        }
        const dedupeKey = `${tid}|${moduleId}`;
        if (seen.has(dedupeKey)) {
          skipped++;
          continue;
        }
        seen.add(dedupeKey);

        const publishedRaw = iPublished >= 0 ? get(row, iPublished) : "";
        const isFinished = publishedRaw.length > 0;

        records.push({
          tutor_external_id: tid,
          tutor_name: get(row, iName) || tid,
          team_leader: get(row, iTl) || "Unknown",
          week_start: weekStart,
          phase,
          module_id: moduleId,
          is_assigned: true,
          is_finished: isFinished,
        });
      }
      if (records.length) {
        const { error: delErr } = await admin
          .from("tutor_published_modules")
          .delete()
          .eq("week_start", weekStart)
          .eq("phase", phase);
        if (delErr) throw delErr;

        const { error } = await admin
          .from("tutor_published_modules")
          .insert(records);
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
