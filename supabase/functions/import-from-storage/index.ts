import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseCsvLine(line: string, delimiter = ","): string[] {
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

function parseCsv(csvText: string, delimiter = ","): Record<string, string>[] {
  // Split by lines, handling quoted fields with newlines
  const rows: string[] = [];
  let currentRow = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      // Handle \r\n
      if (char === '\r' && i + 1 < csvText.length && csvText[i + 1] === '\n') {
        i++;
      }
      const trimmed = currentRow.trim();
      if (trimmed) rows.push(trimmed);
      currentRow = "";
    } else if (char !== '\r') {
      currentRow += char;
    }
  }
  if (currentRow.trim()) rows.push(currentRow.trim());

  if (rows.length < 2) return [];

  // Parse header
  const rawHeaders = parseCsvLine(rows[0], delimiter);
  // Filter out empty trailing headers
  const headers = rawHeaders.filter(h => h.trim() !== '');
  const numHeaders = headers.length;
  console.log(`Headers (${numHeaders}):`, headers.join(', '));

  const records: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const values = parseCsvLine(rows[i], delimiter);
    
    // Accept rows with numHeaders or more fields (extra trailing comma adds empty field)
    if (values.length >= numHeaders) {
      const record: Record<string, string> = {};
      for (let j = 0; j < numHeaders; j++) {
        record[headers[j]] = values[j] ?? "";
      }
      records.push(record);
    } else {
      console.warn(`Row ${i} has ${values.length} fields (expected ${numHeaders}), skipping: ${rows[i].substring(0, 80)}...`);
    }
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

    const { bucket, path, table } = await req.json();

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(bucket)
      .download(path);

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ error: `Failed to download: ${downloadError?.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const csvText = await fileData.text();
    console.log(`Downloaded CSV: ${csvText.length} chars`);

    const records = parseCsv(csvText);
    console.log(`Parsed ${records.length} records for table: ${table}`);

    // Clean records
    const cleanedRecords = records.map((r) => {
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(r)) {
        const k = key.trim();
        if (!k) continue;
        if (value === "" || value === undefined) {
          cleaned[k] = null;
        } else if (k === "priority" || k === "duration_minutes") {
          const n = parseInt(value);
          cleaned[k] = isNaN(n) ? null : n;
        } else {
          cleaned[k] = value.trim();
        }
      }
      return cleaned;
    });

    // Validate: filter out records with invalid UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validRecords = cleanedRecords.filter((r, idx) => {
      const id = r.id as string;
      if (!id || !uuidRegex.test(id)) {
        console.warn(`Record ${idx} invalid id: ${String(id).substring(0, 50)}`);
        return false;
      }
      return true;
    });

    console.log(`Valid records: ${validRecords.length}`);

    // Insert in batches, with single-record retry for failed batches
    const batchSize = 25;
    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < validRecords.length; i += batchSize) {
      const batch = validRecords.slice(i, i + batchSize);
      const { error } = await supabaseAdmin
        .from(table)
        .upsert(batch, { onConflict: "id" });

      if (error) {
        console.error(`Batch ${Math.floor(i / batchSize)} error: ${error.message}, retrying individually...`);
        for (const record of batch) {
          const { error: singleError } = await supabaseAdmin
            .from(table)
            .upsert(record, { onConflict: "id" });
          if (singleError) {
            errors.push(`${record.id}: ${singleError.message}`);
          } else {
            inserted++;
          }
        }
      } else {
        inserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({ success: errors.length === 0, table, total_records: validRecords.length, inserted, errors: errors.length > 0 ? errors : undefined }),
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
