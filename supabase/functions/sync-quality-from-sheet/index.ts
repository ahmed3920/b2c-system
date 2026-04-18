// Sync Quality data from a published Google Sheet (CSV) into quality_uploads.
// - Admin-only (verified via JWT)
// - Reads sheet URL from app_settings.key = 'quality_sheet_csv_url'
// - Parses the same columns as manual upload (Tutor ID, Agent Name, Team Leader, Session Date, Score)
// - Replaces all rows synced via this channel (uploaded_by tagged with the calling admin)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const COLUMN_ALIASES: Record<string, string[]> = {
  tutor_id: ["Tutor ID", "Tutor Id", "TutorID", "Mentor ID", "Agent ID"],
  agent_name: ["Agent Name", "Instructor's Name", "Instructor Name", "Mentor", "Tutor Name"],
  team_leader: ["Team Leader"],
  session_date: ["Session Date", "SessionDate", "Date"],
  score: ["Score"],
};

function findColumn(headers: string[], aliases: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const a of aliases) {
    const idx = lower.indexOf(a.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

// Minimal CSV parser supporting quoted fields and commas inside quotes.
function parseCSV(text: string): string[][] {
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
      } else if (c === "\n") {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else if (c === "\r") {
        // ignore
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ""));
}

function dateToISO(value: string): string | null {
  const s = value.trim();
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const dd = new Date(iso);
    if (!isNaN(dd.getTime())) return iso;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify admin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read sheet URL from settings
    const { data: setting, error: setErr } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "quality_sheet_csv_url")
      .maybeSingle();
    if (setErr) throw setErr;
    const csvUrl = setting?.value?.trim();
    if (!csvUrl) {
      return new Response(
        JSON.stringify({ error: "No Google Sheet URL configured." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch the published CSV
    const resp = await fetch(csvUrl, { redirect: "follow" });
    if (!resp.ok) {
      return new Response(
        JSON.stringify({
          error: `Failed to fetch sheet (HTTP ${resp.status}). Make sure the sheet is published as CSV.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const text = await resp.text();
    const matrix = parseCSV(text);
    if (matrix.length < 2) throw new Error("Sheet appears to be empty.");

    const headers = matrix[0].map((h) => h.trim());
    const idx = {
      tutor_id: findColumn(headers, COLUMN_ALIASES.tutor_id),
      agent_name: findColumn(headers, COLUMN_ALIASES.agent_name),
      team_leader: findColumn(headers, COLUMN_ALIASES.team_leader),
      session_date: findColumn(headers, COLUMN_ALIASES.session_date),
      score: findColumn(headers, COLUMN_ALIASES.score),
    };
    const missing = Object.entries(idx)
      .filter(([, v]) => v < 0)
      .map(([k]) => COLUMN_ALIASES[k][0]);
    if (missing.length) {
      return new Response(
        JSON.stringify({
          error: `Sheet is missing required columns: ${missing.join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const records: Array<{
      tutor_id: string;
      agent_name: string;
      team_leader: string;
      session_date: string;
      score: number;
      uploaded_by: string;
      scope: string;
    }> = [];
    let skipped = 0;
    let noDate = 0;
    for (let i = 1; i < matrix.length; i++) {
      const row = matrix[i];
      const tutorId = (row[idx.tutor_id] ?? "").trim();
      const agent = (row[idx.agent_name] ?? "").trim();
      const tl = (row[idx.team_leader] ?? "").trim();
      const dateRaw = (row[idx.session_date] ?? "").trim();
      const scoreRaw = (row[idx.score] ?? "").trim();

      if (!tutorId && !agent && !tl && !scoreRaw) continue;
      const scoreNum = parseFloat(scoreRaw.replace("%", ""));
      if (!tutorId || !tl || isNaN(scoreNum)) {
        skipped++;
        continue;
      }
      const iso = dateToISO(dateRaw);
      if (!iso) {
        noDate++;
        skipped++;
        continue;
      }
      records.push({
        tutor_id: tutorId,
        agent_name: agent || tutorId,
        team_leader: tl,
        session_date: iso,
        score: scoreNum,
        uploaded_by: userId,
        scope: "google_sheet",
      });
    }

    if (records.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid rows found in sheet.", skipped, noDate }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Replace all previously-synced rows (scope = google_sheet)
    const { error: delErr } = await admin
      .from("quality_uploads")
      .delete()
      .eq("scope", "google_sheet");
    if (delErr) throw delErr;

    // Batch insert
    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const { error: insErr } = await admin
        .from("quality_uploads")
        .insert(records.slice(i, i + batchSize));
      if (insErr) throw insErr;
    }

    // Update last sync timestamp
    await admin
      .from("app_settings")
      .upsert({ key: "quality_sheet_last_sync", value: new Date().toISOString(), updated_by: userId });

    return new Response(
      JSON.stringify({
        success: true,
        inserted: records.length,
        skipped,
        noDate,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
