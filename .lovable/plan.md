# Change Credentials for Ghada Mohamed

## Current Account

- **Email**: [ghada.mohamed@ischooltech.com](mailto:ghada.mohamed@ischooltech.com)
- **User ID (DB)**: 1cdfb097-6ed6-4f83-98a4-5b95ad63e4d2
- **Mentor ID**: U-ML4CBTEI
- **Role**: team_leader

## Plan

Use the existing `admin-update-user` edge function to reset Ghada's password to a new value. No data will be deleted — only the authentication password is changed.

### New Credentials

- **Email**: [ghada.mohamed@ischooltech.com](mailto:ghada.mohamed@ischooltech.com) (unchanged)
- **Password**: `Ghada@2026!`

### Implementation

1. Invoke the `admin-update-user` edge function with `userId` and `newPassword` to update the password via the Supabase Auth Admin API.
2. This only changes the auth password — profile data, tasks, and role remain untouched.

### Technical Detail

- Single call to the existing edge function; no code changes, no migrations needed.