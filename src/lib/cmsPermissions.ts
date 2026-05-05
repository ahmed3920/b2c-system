import type { CmsJobTitle } from "@/lib/cmsJobTitles";
import type { CmsAssigneeRole } from "@/hooks/useCmsTaskAssignees";

/**
 * Centralized permission matrix for the CMS workspace.
 *
 * Roles (job titles): admin, team_leader, senior_developer, developer, reviewer.
 * Backend tiers map: admin -> cms_admin, team_leader/senior_developer -> cms_supervisor,
 * developer/reviewer -> cms_member. The DB enforces the floor via RLS; this file
 * encodes the precise UI-level matrix the team agreed on.
 */

export type CmsCapability =
  // Navigation & admin pages
  | "view_users_admin"
  | "view_task_properties_admin"
  | "view_permissions_admin"
  // User management
  | "manage_users"
  // Tasks
  | "view_all_tasks"
  | "create_task"
  | "edit_any_task"
  | "delete_task"
  | "edit_own_task"
  | "change_status_any"
  | "change_status_review_done" // Reviewer-specific status transitions on review tasks
  // Assignees
  | "assign_any_role"
  | "assign_dev_reviewer_only"
  // Comments / properties on accessible tasks
  | "comment_on_accessible_task"
  | "edit_property_values_on_accessible_task"
  // Attendance
  | "view_all_attendance"
  | "manage_attendance"
  | "check_out"
  // Activity
  | "view_all_activity"
  | "view_own_activity";

export type CmsCapabilityMap = Record<CmsCapability, boolean>;

const ALL_FALSE: CmsCapabilityMap = {
  view_users_admin: false,
  view_task_properties_admin: false,
  view_permissions_admin: false,
  manage_users: false,
  view_all_tasks: false,
  create_task: false,
  edit_any_task: false,
  delete_task: false,
  edit_own_task: false,
  change_status_any: false,
  change_status_review_done: false,
  assign_any_role: false,
  assign_dev_reviewer_only: false,
  comment_on_accessible_task: false,
  edit_property_values_on_accessible_task: false,
  view_all_attendance: false,
  manage_attendance: false,
  check_out: false,
  view_all_activity: false,
  view_own_activity: false,
};

export const PERMISSION_MATRIX: Record<CmsJobTitle, CmsCapabilityMap> = {
  admin: {
    ...ALL_FALSE,
    view_users_admin: true,
    view_task_properties_admin: true,
    view_permissions_admin: true,
    manage_users: true,
    view_all_tasks: true,
    create_task: true,
    edit_any_task: true,
    delete_task: true,
    edit_own_task: true,
    change_status_any: true,
    change_status_review_done: true,
    assign_any_role: true,
    comment_on_accessible_task: true,
    edit_property_values_on_accessible_task: true,
    view_all_attendance: true,
    manage_attendance: true,
    check_out: true,
    view_all_activity: true,
    view_own_activity: true,
  },
  team_leader: {
    ...ALL_FALSE,
    view_all_tasks: true,
    create_task: true,
    edit_any_task: true,
    delete_task: true,
    edit_own_task: true,
    change_status_any: true,
    change_status_review_done: true,
    assign_any_role: true,
    comment_on_accessible_task: true,
    edit_property_values_on_accessible_task: true,
    view_all_attendance: true,
    check_out: true,
    view_all_activity: true,
    view_own_activity: true,
  },
  senior_developer: {
    ...ALL_FALSE,
    view_all_tasks: true,
    create_task: true,
    edit_any_task: true,
    delete_task: true,
    edit_own_task: true,
    change_status_any: true,
    change_status_review_done: true,
    assign_dev_reviewer_only: true,
    comment_on_accessible_task: true,
    edit_property_values_on_accessible_task: true,
    view_all_attendance: true,
  },
  developer: {
    ...ALL_FALSE,
    edit_own_task: true,
    comment_on_accessible_task: true,
    edit_property_values_on_accessible_task: true,
  },
  reviewer: {
    ...ALL_FALSE,
    edit_own_task: true,
    change_status_review_done: true,
    comment_on_accessible_task: true,
    edit_property_values_on_accessible_task: true,
  },
};

export const can = (
  title: CmsJobTitle | null | undefined,
  capability: CmsCapability,
): boolean => {
  if (!title) return false;
  return PERMISSION_MATRIX[title]?.[capability] ?? false;
};

/** Which assignee roles a given job title may add/remove on a task. */
export const assignableRolesFor = (
  title: CmsJobTitle | null | undefined,
): CmsAssigneeRole[] => {
  if (!title) return [];
  if (can(title, "assign_any_role")) {
    return ["developer", "senior_developer", "reviewer", "team_leader"];
  }
  if (can(title, "assign_dev_reviewer_only")) {
    return ["developer", "reviewer"];
  }
  return [];
};

/** Human-readable label per capability (used by the matrix page). */
export const CAPABILITY_LABELS: Record<CmsCapability, string> = {
  view_users_admin: "Open Users admin page",
  view_task_properties_admin: "Open Task Properties admin",
  view_permissions_admin: "Open Permissions matrix",
  manage_users: "Create / edit / deactivate users",
  view_all_tasks: "View all tasks (not just own)",
  create_task: "Create new tasks",
  edit_any_task: "Edit any task",
  delete_task: "Delete tasks",
  edit_own_task: "Edit tasks they're assigned to or own",
  change_status_any: "Change status on any task",
  change_status_review_done: "Move tasks to Review / Done",
  assign_any_role: "Assign anyone (Dev / Sr Dev / Reviewer / TL)",
  assign_dev_reviewer_only: "Assign Developers and Reviewers only",
  comment_on_accessible_task: "Comment & upload attachments",
  edit_property_values_on_accessible_task: "Edit custom property values",
  view_all_attendance: "View everyone's attendance",
  manage_attendance: "Edit / manage attendance records",
};
