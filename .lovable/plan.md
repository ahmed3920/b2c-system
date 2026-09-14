# Searchable person picker in the Projects access list

## What changes

In Quality > Projects, the admin-only "Manage access" popup currently has a plain dropdown listing every person in the system, which is slow to scroll. Replace it with a dropdown you can type in to filter people by name or email.

Everything else in the popup stays the same: admins always have access, adding a person grants them the Projects area, and the trash icon revokes it.

## Details

- Reuse the existing `SearchableSelect` used across the Quality filters, so the look and behaviour match the rest of the Quality screens.
- Keep the current filtering that hides people who already have access.
- Keep the "Add" button and the toast confirmations.

## Technical notes

- `src/components/quality/projects/ProjectAccessDialog.tsx`: swap the shadcn `Select` for `SearchableSelect` (exported from `src/components/tracking/quality/QualityFilterBar.tsx`), mapping people to `{ value: user_id, label: full_name || email || user_id }`, with a "Choose a person" placeholder and no "all" option.
- No database, edge function, or access-rule changes.
