// Secure read-only gateway to the iSchool production replica.
// - Caller must be signed in and hold admin / team_leader / super_team_leader
// - Only named, pre-approved queries from queries.ts can run (no raw SQL from the browser)
// - Connection is SSL, single-socket, with a statement timeout and a row cap
import postgres from "npm:postgres@3.4.5";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { QUERIES } from "./queries.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const APP_DB_URL = Deno.env.get("SUPABASE_DB_URL")?.trim();

const REPLICA_HOST = Deno.env.get("ISCHOOL_REPLICA_HOST")?.trim();
const REPLICA_USER = Deno.env.get("ISCHOOL_REPLICA_USER")?.trim();
const REPLICA_PASSWORD = Deno.env.get("ISCHOOL_REPLICA_PASSWORD") ?? "";
const REPLICA_DB = Deno.env.get("ISCHOOL_REPLICA_DB")?.trim();
const REPLICA_PORT = Number(Deno.env.get("ISCHOOL_REPLICA_PORT") ?? "5432");

const ALLOWED_ROLES = new Set(["admin", "team_leader", "super_team_leader"]);
const MAX_ROWS = 5000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function authorize(req: Request): Promise<{ error: Response | null; userId?: string }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return { error: json({ error: "Unauthorized" }, 401) };

  let userId: string;
  try {
    const jwks = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
    const { payload } = await jwtVerify(authHeader.slice(7), jwks, { clockTolerance: 600 });
    if (!payload.sub) throw new Error("no sub");
    userId = payload.sub;
  } catch (_e) {
    return { error: json({ error: "Unauthorized" }, 401) };
  }

  if (!APP_DB_URL) return { error: json({ error: "App database not configured" }, 500) };
  const app = postgres(APP_DB_URL, { prepare: false, max: 1, idle_timeout: 5 });
  try {
    const roles = await app<{ role: string }[]>`
      select role::text as role from public.user_roles where user_id = ${userId}
    `;
    if (!roles.some((r) => ALLOWED_ROLES.has(r.role))) {
      return { error: json({ error: "Admin or team leader access required" }, 403) };
    }
  } finally {
    await app.end({ timeout: 5 });
  }

  return { error: null, userId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { error } = await authorize(req);
    if (error) return error;

    if (!REPLICA_HOST || !REPLICA_USER || !REPLICA_DB) {
      return json({ error: "Replica connection is not configured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const key = String(body?.query ?? "");

    if (key === "__keys") return json({ keys: Object.keys(QUERIES) });

    const entry = QUERIES[key];
    if (!entry) {
      return json({ error: `Unknown query "${key}"`, available: Object.keys(QUERIES) }, 400);
    }

    const params = (body?.params ?? {}) as Record<string, unknown>;
    const values = entry.params.map((name) => {
      const v = params[name];
      return v === undefined || v === "" ? null : v;
    });

    const cap = Math.min(entry.limit ?? 1000, MAX_ROWS);
    const statement = /\blimit\b/i.test(entry.sql) ? entry.sql : `${entry.sql}\nlimit ${cap}`;

    const sql = postgres({
      host: REPLICA_HOST,
      port: REPLICA_PORT,
      database: REPLICA_DB,
      username: REPLICA_USER,
      password: REPLICA_PASSWORD,
      // AWS RDS uses its own CA, which Deno's trust store doesn't include.
      // Encryption stays on; we skip issuer verification for this host.
      ssl: { rejectUnauthorized: false },
      max: 1,
      idle_timeout: 5,
      connect_timeout: 15,
      prepare: false,
      connection: { statement_timeout: "20s" },
    });

    try {
      const started = Date.now();
      const rows = await sql.unsafe(statement, values as never[]);
      return json({
        query: key,
        rows: Array.from(rows).slice(0, cap),
        row_count: rows.length,
        truncated: rows.length >= cap,
        duration_ms: Date.now() - started,
      });
    } finally {
      await sql.end({ timeout: 5 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Replica query failed";
    console.error("ischool-replica-query error:", msg);
    return json({ error: msg }, 500);
  }
});
