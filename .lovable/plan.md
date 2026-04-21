

## Remove "Tracking Numbers" Tab

Remove the "Tracking Numbers" navigation item and its associated route from the application.

### Changes Required

**1. Remove from Sidebar Navigation**
- **File**: `src/components/layout/AppSidebar.tsx`
- **Action**: Remove the line `{ title: "Tracking Numbers", url: "/tracking-numbers", icon: Hash, roles: ["admin"] },` from the `tracking` array (line 51)

**2. Remove Route from App Router**
- **File**: `src/App.tsx`
- **Actions**:
  - Remove import: `import TrackingNumbers from "./pages/TrackingNumbers";` (line 16)
  - Remove route: `<Route path="/tracking-numbers" element={<TrackingNumbers />} />` (line 55)

### Note
The `TrackingNumbers.tsx` page file can be left in place (unused) or deleted as cleanup. The plan above only removes the navigation and routing to make the tab inaccessible.
