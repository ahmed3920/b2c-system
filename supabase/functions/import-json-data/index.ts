import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { table, records } = await req.json();

    if (!table || !records || !Array.isArray(records)) {
      return new Response(
        JSON.stringify({ error: "Missing 'table' or 'records' array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean records
    const cleanedRecords = records.map((r: Record<string, unknown>) => {
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(r)) {
        if (value === "" || value === undefined || value === null) {
          cleaned[key] = null;
        } else if (key === "priority" || key === "duration_minutes") {
          cleaned[key] = value ? parseInt(String(value)) : null;
        } else {
          cleaned[key] = value;
        }
      }
      return cleaned;
    });

    const batchSize = 100;
    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < cleanedRecords.length; i += batchSize) {
      const batch = cleanedRecords.slice(i, i + batchSize);
      const { error } = await supabaseAdmin
        .from(table)
        .upsert(batch, { onConflict: "id" });

      if (error) {
        errors.push(`Batch ${Math.floor(i / batchSize)}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({ success: errors.length === 0, table, total_records: cleanedRecords.length, inserted, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
