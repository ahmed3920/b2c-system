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

function parseDate(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const dt = new Date(t);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}

const norm = (s: string) =>
  s.replace(/\uFEFF/g, "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

function findCol(headerNorm: string[], aliases: string[]): number {
  for (const a of aliases) {
    const i = headerNorm.findIndex((h) => h === norm(a));
    if (i >= 0) return i;
  }
  for (const a of aliases) {
    const i = headerNorm.findIndex((h) => h.includes(norm(a)));
    if (i >= 0) return i;
  }
  return -1;
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
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) return json({ error: "Admin only" }, 403);

    const { data: cfg, error: cfgErr } = await admin
      .from("live_issues_sheet_config")
      .select("id, csv_url")
      .limit(1)
      .maybeSingle();
    if (cfgErr) throw cfgErr;
    if (!cfg?.csv_url) {
      return json({ error: "Moderation sheet URL not configured" }, 400);
    }

    const csvUrl = toCsvUrl(cfg.csv_url);
    const resp = await fetch(csvUrl, { redirect: "follow" });
    if (!resp.ok) {
      const hint = (resp.status === 401 || resp.status === 403)
        ? " — make sure the Sheet is shared as 'Anyone with the link (Viewer)' or published to web."
        : "";
      const msg = `Failed to fetch sheet: HTTP ${resp.status}${hint}`;
      await admin.from("live_issues_sheet_config").update({
        last_sync_status: "error",
        last_sync_message: msg,
        last_synced_at: new Date().toISOString(),
      }).eq("id", cfg.id);
      return json({ error: msg }, 502);
    }

    let text = await resp.text();
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const rows = parseCsv(text);
    if (rows.length < 2) return json({ error: "Sheet has no data rows" }, 400);

    const header = rows[0].map((h) => h.trim());
    const headerNorm = header.map(norm);

    const cols = {
      session_id: findCol(headerNorm, ["Session ID"]),
      student_id: findCol(headerNorm, ["Student ID"]),
      session_date: findCol(headerNorm, ["Session Date", "Date"]),
      moderator_name: findCol(headerNorm, ["Moderator name", "Moderator"]),
      group_type: findCol(headerNorm, ["Group Type"]),
      time_slot: findCol(headerNorm, ["time Slot", "Time Slot"]),
      from_tutor_id: findCol(headerNorm, ["From tutor ID"]),
      from_tutor_name: findCol(headerNorm, ["From tutor Name"]),
      to_tutor_id: findCol(headerNorm, ["To  tutor ID", "To tutor ID"]),
      to_tutor_name: findCol(headerNorm, ["To  tutor Name", "To tutor Name"]),
      action_status: findCol(headerNorm, ["Action \"Status\"", "Action Status", "Status"]),
      issue_reason: findCol(headerNorm, ["issue \"Reason\"", "Issue Reason", "Reason"]),
      issue_time: findCol(headerNorm, ["Time of issue"]),
      issue_details: findCol(headerNorm, ["Issue Details"]),
      extra_action: findCol(headerNorm, ["Extra action taken", "Extra Action"]),
      class_type: findCol(headerNorm, ["Class type", "Class Type"]),
      month: findCol(headerNorm, ["Month"]),
      source_of_issue: findCol(headerNorm, ["Source of issue"]),
      from_tutor_type: findCol(headerNorm, ["from Tutor", "From Tutor Type", "from Tutor Type"]),
      to_tutor_type: findCol(headerNorm, ["To Tutor Type", "To  Tutor Type"]),
      language: findCol(headerNorm, ["To Tutor Type Language", "Language", "To Tutor Type\nLanguage"]),
      year: findCol(headerNorm, ["Year"]),
      team_leader: findCol(headerNorm, ["Education Team Leader", "Team Leader"]),
      day_of_week: findCol(headerNorm, ["Day"]),
      severity: findCol(headerNorm, ["Severity"]),
      moderator_decision: findCol(headerNorm, ["Moderator Decision", "Decision"]),
      moderation_deduction: findCol(headerNorm, ["Education Validation", "Deduction"]),
    };

    const get = (row: string[], i: number) => (i >= 0 && i < row.length ? row[i].trim() : "");

    type Rec = Record<string, unknown>;
    const records: Rec[] = [];
    let skipped = 0;
    const warnings: string[] = [];

    for (const row of rows.slice(1)) {
      const sid = get(row, cols.session_id);
      const fromTid = get(row, cols.from_tutor_id);
      if (!sid && !fromTid) { skipped++; continue; }
      const caseId = `${sid || "NO_SESSION"}__${fromTid || "NO_TUTOR"}`;

      const raw: Record<string, string> = {};
      header.forEach((h, i) => { raw[h] = get(row, i); });

      records.push({
        case_id: caseId,
        session_id: sid || null,
        student_id: get(row, cols.student_id) || null,
        session_date: parseDate(get(row, cols.session_date)),
        moderator_name: get(row, cols.moderator_name) || null,
        group_type: get(row, cols.group_type) || null,
        time_slot: get(row, cols.time_slot) || null,
        from_tutor_id: fromTid || null,
        from_tutor_name: get(row, cols.from_tutor_name) || null,
        to_tutor_id: get(row, cols.to_tutor_id) || null,
        to_tutor_name: get(row, cols.to_tutor_name) || null,
        action_status: get(row, cols.action_status) || null,
        issue_reason: get(row, cols.issue_reason) || null,
        issue_time: get(row, cols.issue_time) || null,
        issue_details: get(row, cols.issue_details) || null,
        extra_action: get(row, cols.extra_action) || null,
        class_type: get(row, cols.class_type) || null,
        month: get(row, cols.month) || null,
        source_of_issue: get(row, cols.source_of_issue) || null,
        from_tutor_type: get(row, cols.from_tutor_type) || null,
        to_tutor_type: get(row, cols.to_tutor_type) || null,
        language: get(row, cols.language) || null,
        year: get(row, cols.year) || null,
        team_leader: get(row, cols.team_leader) || null,
        day_of_week: get(row, cols.day_of_week) || null,
        severity: get(row, cols.severity) || null,
        moderator_decision: get(row, cols.moderator_decision) || null,
        moderation_deduction: get(row, cols.moderation_deduction) || null,
        raw,
        last_synced_at: new Date().toISOString(),
      });
    }

    const seen = new Map<string, Rec>();
    for (const r of records) seen.set(r.case_id as string, r);
    const unique = Array.from(seen.values());

    let inserted = 0;
    const batchSize = 500;
    for (let i = 0; i < unique.length; i += batchSize) {
      const batch = unique.slice(i, i + batchSize);
      const { error } = await admin
        .from("live_session_issues")
        .upsert(batch, { onConflict: "case_id", ignoreDuplicates: false });
      if (error) {
        await admin.from("live_issues_sheet_config").update({
          last_sync_status: "error",
          last_sync_message: error.message,
          last_synced_at: new Date().toISOString(),
        }).eq("id", cfg.id);
        throw error;
      }
      inserted += batch.length;
    }

    await admin.from("live_issues_sheet_config").update({
      last_sync_status: "ok",
      last_sync_message: `Synced ${inserted} rows`,
      last_sync_rows: inserted,
      last_synced_at: new Date().toISOString(),
      updated_by: userData.user.id,
    }).eq("id", cfg.id);

    return json({
      success: true,
      rows_parsed: rows.length - 1,
      rows_upserted: inserted,
      rows_skipped: skipped,
      warnings: warnings.slice(0, 10),
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
