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

function parseCsv(csvText: string, delimiter = ";"): Record<string, string>[] {
  // Split by lines but handle quoted fields with newlines
  const rows: string[] = [];
  let currentRow = "";
  let inQuotes = false;

  for (const char of csvText) {
    if (char === '"') {
      inQuotes = !inQuotes;
    }
    if (char === '\n' && !inQuotes) {
      if (currentRow.trim()) rows.push(currentRow.trim());
      currentRow = "";
    } else {
      currentRow += char;
    }
  }
  if (currentRow.trim()) rows.push(currentRow.trim());

  if (rows.length < 2) return [];

  const headers = parseCsvLine(rows[0], delimiter);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const values = parseCsvLine(rows[i], delimiter);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j] ?? "";
    }
    records.push(record);
  }

  return records;
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

    const { table, csv_data, delimiter: customDelimiter } = await req.json();
    const delimiter = customDelimiter || ";";

    if (!table || !csv_data) {
      return new Response(
        JSON.stringify({ error: "Missing 'table' or 'csv_data'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const records = parseCsv(csv_data, delimiter);
    console.log(`Parsed ${records.length} records for table: ${table} (delimiter: '${delimiter}')`);

    if (records.length === 0) {
      return new Response(
        JSON.stringify({ error: "No records parsed from CSV" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean up records based on table
    const cleanedRecords = records.map((r) => {
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(r)) {
        if (value === "" || value === undefined) {
          cleaned[key] = null;
        } else if (key === "priority" || key === "login_attempts" || key === "display_order" || key === "duration_minutes") {
          cleaned[key] = value ? parseInt(value) : null;
        } else if (key === "active_status" || key === "read_status" || key === "is_required" || key === "is_system_field" || key === "is_active") {
          cleaned[key] = value === "true" || value === "t";
        } else if (key === "field_options") {
          try {
            cleaned[key] = value ? JSON.parse(value) : null;
          } catch {
            cleaned[key] = value;
          }
        } else {
          // Trim newlines from text fields like mentor_id
          cleaned[key] = value.replace(/\n$/, '').replace(/^\n/, '');
        }
      }
      return cleaned;
    });

    // Insert in batches of 100
    const batchSize = 100;
    let inserted = 0;
    let errors: string[] = [];

    for (let i = 0; i < cleanedRecords.length; i += batchSize) {
      const batch = cleanedRecords.slice(i, i + batchSize);
      const { error } = await supabaseAdmin
        .from(table)
        .upsert(batch, { onConflict: "id" });

      if (error) {
        console.error(`Batch ${i / batchSize} error:`, error.message);
        errors.push(`Batch ${Math.floor(i / batchSize)}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        table,
        total_records: cleanedRecords.length,
        inserted,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Import error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
