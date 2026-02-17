import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseCsvLine(line: string, delimiter = ";"): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Download original profiles CSV from storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("imports")
      .download("profiles-original.csv");

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: `Download failed: ${downloadError?.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const csvText = await fileData.text();
    
    // Parse semicolon-delimited profiles CSV to extract old user_ids and mentor_ids
    const rows: string[] = [];
    let currentRow = "";
    let inQuotes = false;
    for (const char of csvText) {
      if (char === '"') inQuotes = !inQuotes;
      if (char === '\n' && !inQuotes) {
        if (currentRow.trim()) rows.push(currentRow.trim());
        currentRow = "";
      } else {
        currentRow += char;
      }
    }
    if (currentRow.trim()) rows.push(currentRow.trim());

    const headers = parseCsvLine(rows[0]);
    const userIdIdx = headers.indexOf("user_id");
    const mentorIdIdx = headers.indexOf("mentor_id");
    
    // Build mapping: mentor_id -> old_user_id
    const mentorToOldUserId: Record<string, string> = {};
    for (let i = 1; i < rows.length; i++) {
      const values = parseCsvLine(rows[i]);
      const oldUserId = values[userIdIdx]?.trim();
      const mentorId = values[mentorIdIdx]?.trim();
      if (oldUserId && mentorId) {
        mentorToOldUserId[mentorId] = oldUserId;
      }
    }

    console.log(`Found ${Object.keys(mentorToOldUserId).length} mentor->oldUserId mappings`);

    // Get current profiles to find new user_ids by mentor_id
    const { data: currentProfiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, mentor_id");

    if (!currentProfiles) {
      return new Response(JSON.stringify({ error: "Could not fetch profiles" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build mapping: old_user_id -> new_user_id
    const oldToNewUserId: Record<string, string> = {};
    for (const profile of currentProfiles) {
      const oldUserId = mentorToOldUserId[profile.mentor_id];
      if (oldUserId && oldUserId !== profile.user_id) {
        oldToNewUserId[oldUserId] = profile.user_id;
      }
    }

    console.log(`Built ${Object.keys(oldToNewUserId).length} old->new userId mappings`);

    // Update tasks
    let updated = 0;
    const errors: string[] = [];

    for (const [oldId, newId] of Object.entries(oldToNewUserId)) {
      const { data, error } = await supabaseAdmin
        .from("tasks")
        .update({ user_id: newId })
        .eq("user_id", oldId);

      if (error) {
        errors.push(`${oldId}->${newId}: ${error.message}`);
      } else {
        updated++;
      }
    }

    // Also update created_by and assigned_by
    for (const [oldId, newId] of Object.entries(oldToNewUserId)) {
      await supabaseAdmin.from("tasks").update({ created_by: newId }).eq("created_by", oldId);
      await supabaseAdmin.from("tasks").update({ assigned_by: newId }).eq("assigned_by", oldId);
    }

    return new Response(
      JSON.stringify({ success: true, mappings: Object.keys(oldToNewUserId).length, updated, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
