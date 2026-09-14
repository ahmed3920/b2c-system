// Returns a short-lived signed link for one file attached to an iSchool project.
// Access is limited to admins and people on the projects-audit allow-list, and a
// file key is only signed when it really belongs to the requested project.
import postgres from "npm:postgres@3.4.5";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";
import { AwsClient } from "npm:aws4fetch@1.0.20";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { RDS_CA } from "../_shared/rdsCa.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const APP_DB_URL = Deno.env.get("SUPABASE_DB_URL")?.trim();

const REPLICA_HOST = Deno.env.get("ISCHOOL_REPLICA_HOST")?.trim();
const REPLICA_USER = Deno.env.get("ISCHOOL_REPLICA_USER")?.trim();
const REPLICA_PASSWORD = Deno.env.get("ISCHOOL_REPLICA_PASSWORD") ?? "";
const REPLICA_DB = Deno.env.get("ISCHOOL_REPLICA_DB")?.trim();
const REPLICA_PORT = Number(Deno.env.get("ISCHOOL_REPLICA_PORT") ?? "5432");

const S3_KEY_ID = Deno.env.get("ISCHOOL_S3_ACCESS_KEY_ID")?.trim();
const S3_SECRET = Deno.env.get("ISCHOOL_S3_SECRET_ACCESS_KEY")?.trim();
const S3_BUCKET = Deno.env.get("ISCHOOL_S3_BUCKET")?.trim() || "ischool-prod";
const S3_REGION = Deno.env.get("ISCHOOL_S3_REGION")?.trim() || "eu-central-1";

const EXPIRES = 300;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function callerId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  try {
    const jwks = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
    const { payload } = await jwtVerify(authHeader.slice(7), jwks, { clockTolerance: 600 });
    if (payload.sub) return payload.sub;
  } catch (_e) {
    // Legacy HS256 tokens aren't in the JWKS — ask Auth directly.
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id ?? null;
  } catch (_e) {
    return null;
  }
}

async function hasAuditAccess(userId: string): Promise<boolean> {
  if (!APP_DB_URL) return false;
  const app = postgres(APP_DB_URL, { prepare: false, max: 1, idle_timeout: 5 });
  try {
    const admin = await app<{ role: string }[]>`
      select role::text as role from public.user_roles
       where user_id = ${userId} and role = 'admin' limit 1
    `;
    if (admin.length > 0) return true;
    const grants = await app<{ id: string }[]>`
      select id::text as id from public.project_audit_access where user_id = ${userId} limit 1
    `;
    return grants.length > 0;
  } finally {
    await app.end({ timeout: 5 });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await callerId(req);
    if (!userId) return json({ error: "Unauthorized" }, 401);
    if (!(await hasAuditAccess(userId))) return json({ error: "Projects audit access required" }, 403);

    if (!S3_KEY_ID || !S3_SECRET) {
      return json({ error: "File storage credentials are not configured" }, 500);
    }
    if (!REPLICA_HOST || !REPLICA_USER || !REPLICA_DB) {
      return json({ error: "Replica connection is not configured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const download = body?.download === true;
    const rawItems = Array.isArray(body?.items)
      ? body.items
      : [{ project_id: body?.project_id, key: body?.key }];
    if (rawItems.length === 0 || rawItems.length > 80) return json({ error: "Invalid request" }, 400);

    const items: { projectId: number; key: string }[] = [];
    for (const it of rawItems) {
      const projectId = Number(it?.project_id);
      const fileKey = String(it?.key ?? "");
      if (!Number.isFinite(projectId) || projectId <= 0 || !/^[A-Za-z0-9._-]{8,128}$/.test(fileKey)) {
        return json({ error: "Invalid request" }, 400);
      }
      items.push({ projectId, key: fileKey });
    }

    // Every key must really belong to the project it is requested for.
    const replica = postgres({
      host: REPLICA_HOST,
      port: REPLICA_PORT,
      user: REPLICA_USER,
      password: REPLICA_PASSWORD,
      database: REPLICA_DB,
      max: 1,
      idle_timeout: 5,
      prepare: false,
      ssl: { ca: RDS_CA, rejectUnauthorized: false },
      connection: { statement_timeout: 15000 },
    });

    let blobs: { key: string; record_id: string; filename: string; content_type: string | null }[] = [];
    try {
      blobs = await replica<{ key: string; record_id: string; filename: string; content_type: string | null }[]>`
        select b.key, att.record_id::text as record_id, b.filename, b.content_type
          from public.active_storage_attachments att
          join public.active_storage_blobs b on b.id = att.blob_id
         where att.record_type = 'Project'
           and att.record_id in ${replica(items.map((i) => i.projectId))}
           and b.key in ${replica(items.map((i) => i.key))}
      `;
    } finally {
      await replica.end({ timeout: 5 });
    }

    const aws = new AwsClient({
      accessKeyId: S3_KEY_ID,
      secretAccessKey: S3_SECRET,
      service: "s3",
      region: S3_REGION,
    });

    const files: Record<string, { url: string; filename: string; content_type: string | null }> = {};
    for (const item of items) {
      const blob = blobs.find((b) => b.key === item.key && Number(b.record_id) === item.projectId);
      if (!blob) continue;
      const target = new URL(`https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${item.key}`);
      target.searchParams.set("X-Amz-Expires", String(EXPIRES));
      if (blob.content_type) target.searchParams.set("response-content-type", blob.content_type);
      target.searchParams.set(
        "response-content-disposition",
        `${download ? "attachment" : "inline"}; filename="${blob.filename.replace(/"/g, "")}"`,
      );
      const signed = await aws.sign(target.toString(), { method: "GET", aws: { signQuery: true } });
      files[item.key] = { url: signed.url, filename: blob.filename, content_type: blob.content_type };
    }

    if (Object.keys(files).length === 0) return json({ error: "File not found for this project" }, 404);

    const single = files[items[0].key];
    return json({ files, expires_in: EXPIRES, ...(single ? single : {}) });
  } catch (e) {
    console.error("project-file-url failed", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
