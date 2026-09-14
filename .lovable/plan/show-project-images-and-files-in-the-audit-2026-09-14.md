# Show project images and files in the audit

## What we found

Project files are not public. Each project's cover image, code file and extra images are stored as
records in the iSchool database (`active_storage_attachments` + `active_storage_blobs`), which give us
the file name, type, size and a storage key. The files themselves live in a private Amazon bucket
(`ischool-prod`, eu-central-1), so a plain link returns "access denied" — the iSchool dashboard only
works because it creates a temporary signed link each time an image is shown.

Sample of what the database gives us for a recent project:
`cover` → Screenshot 2026-09-14.png (image/png, 254 KB), `file` → Screenshot.jpg, `images` → 3 files.

## What we'll build

1. **Fetch the file records** alongside each project: cover, code file, presentation and extra images,
   with file name, type and size.
2. **A secure link service**: a small backend function that, for someone with Projects audit access,
   creates a temporary (5 minute) signed link for a specific file. Only file keys that actually belong
   to the project being viewed can be signed, so nobody can fish for other files.
3. **Detail dialog upgrade**: the project detail view shows the real cover image preview (like your
   screenshot), a gallery of the extra images, and working "Watch Code File" / download buttons for the
   uploaded file and presentation. Thumbnails also appear in the audit list rows.
4. **Fallbacks**: if a project has no cover, we show a neutral placeholder; if signing fails we show the
   file name with a clear message instead of a broken image.

## What you need to provide

Read-only Amazon access for the `ischool-prod` bucket — an access key ID and secret with permission to
read objects only. I'll store them securely as backend secrets; they are never sent to the browser.
Signed links are produced on the server and expire after a few minutes.

## Technical notes

- New named queries in `ischool-replica-query/queries.ts`: `project_attachments` (by project id) and
  cover keys joined into `project_audit_list` so list thumbnails need no extra round trip.
  Join `active_storage_attachments` (record_type = 'Project') to `active_storage_blobs`.
- New edge function `project-file-url`: validates the caller's JWT and Projects-audit access
  (admin or `project_audit_access` row), confirms the requested blob key belongs to the requested
  project via the replica, then returns an AWS SigV4 presigned GET URL
  (`ischool-prod`, `eu-central-1`, 300s, with `response-content-type`/`response-content-disposition`
  taken from the blob), signed with `aws4fetch`.
- Secrets: `ISCHOOL_S3_ACCESS_KEY_ID`, `ISCHOOL_S3_SECRET_ACCESS_KEY`
  (bucket/region hardcoded as `ischool-prod` / `eu-central-1`).
- Frontend: `useProjectFiles(projectId)` hook in `src/hooks/useProjectAudit.ts`; `ProjectDetailDialog`
  renders cover + image gallery and wires the action buttons to signed URLs; `ProjectAuditTab` adds a
  small cover thumbnail column.
