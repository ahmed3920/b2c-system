
## Announcements Feature (UI-only)

Add an Announcements module with role-based visibility on the dashboard and a management page for admins. Data is stored in-memory (mock list inside a shared module) — no backend.

### 1. Shared mock data + types
**New file: `src/data/mockAnnouncements.ts`**
- Type `Announcement { id, title, description, audience: "team_leaders" | "mentors" | "both", date, priority: "important" | "normal", status: "published" | "draft" }`
- Export a seeded array (3-4 sample announcements covering each audience/priority combo)
- Export simple in-memory CRUD helpers (`getAll`, `add`, `update`, `remove`) backed by a module-level array so create/edit/delete persist within the session

### 2. Reusable UI pieces
**New file: `src/components/announcements/AnnouncementCard.tsx`**
- Card with title, short description (line-clamp-2), audience tag (Badge), formatted date, priority badge (red for Important, secondary for Normal), and "View Details" button that opens a details dialog

**New file: `src/components/announcements/AnnouncementsSection.tsx`**
- Section wrapper with heading "📢 Announcements"
- Filters list by current user role (TL → tl + both; mentor → mentor + both; admin → all)
- Renders responsive grid of `AnnouncementCard` (max 3-4 visible)
- Empty state card with icon + "No announcements yet" message
- Includes the "View Details" dialog (shared) showing full description, audience, date, priority

**New file: `src/components/announcements/AnnouncementFormDialog.tsx`**
- Modal with: Title input, Description textarea, Audience Select (Team Leaders / Mentors / Both), Priority Select (Important / Normal), Date picker (shadcn calendar in popover with `pointer-events-auto`)
- Footer buttons: **Save Draft** (status=draft) and **Publish** (status=published)
- Works for both create and edit (accepts optional `announcement` prop)

### 3. Dashboard integration
**Edit `src/pages/Dashboard.tsx`** (admin/TL home)
- Add `<AnnouncementsSection />` directly under the KPI grid

**Edit `src/pages/Home.tsx`** (mentors land here)
- Add `<AnnouncementsSection />` under the profile card so mentors also see announcements

### 4. Admin Announcements Management page
**New file: `src/pages/AnnouncementsAdmin.tsx`**
- Wrapped in `AppLayout` with `allowedRoles={["admin"]}`, title "Announcements Management"
- Top bar: page heading + "Create Announcement" button (opens `AnnouncementFormDialog`)
- Table (shadcn Table): columns Title, Audience, Date, Priority, Status, Actions (Edit / Delete)
- Status badge: green for Published, outline for Draft
- Edit row → opens dialog prefilled; Delete → confirmation then remove from mock store
- Empty state row when no announcements

### 5. Wiring
**Edit `src/App.tsx`**: add route `/admin/announcements` → `AnnouncementsAdmin`

**Edit `src/components/layout/AppSidebar.tsx`**: add admin nav entry "Announcements" (Megaphone icon, role: admin) under the Admin group

### Technical notes
- Audience filter logic lives in `AnnouncementsSection` using `useUserRole()`
- Date picker follows shadcn pattern (Popover + Calendar with `pointer-events-auto`)
- All state is local React state synced with the mock module — refreshing the page resets to seeds (acceptable for UI-only requirement)
- No DB migrations, no edge functions, no Supabase calls
