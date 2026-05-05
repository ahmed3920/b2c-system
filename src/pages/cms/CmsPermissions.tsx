import { CmsLayout } from "@/components/cms/CmsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Minus, ShieldAlert } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { JOB_TITLES, type CmsJobTitle } from "@/lib/cmsJobTitles";
import {
  CAPABILITY_LABELS,
  PERMISSION_MATRIX,
  type CmsCapability,
} from "@/lib/cmsPermissions";
import { cn } from "@/lib/utils";

const SECTIONS: { title: string; capabilities: CmsCapability[] }[] = [
  {
    title: "Admin pages & user management",
    capabilities: [
      "view_users_admin",
      "view_task_properties_admin",
      "view_permissions_admin",
      "manage_users",
    ],
  },
  {
    title: "Tasks",
    capabilities: [
      "view_all_tasks",
      "create_task",
      "edit_any_task",
      "edit_own_task",
      "delete_task",
      "change_status_any",
      "change_status_review_done",
    ],
  },
  {
    title: "Assignees",
    capabilities: ["assign_any_role", "assign_dev_reviewer_only"],
  },
  {
    title: "Comments & properties",
    capabilities: [
      "comment_on_accessible_task",
      "edit_property_values_on_accessible_task",
    ],
  },
  {
    title: "Attendance",
    capabilities: ["view_all_attendance", "manage_attendance"],
  },
];

const titleColumns: { value: CmsJobTitle; label: string }[] = JOB_TITLES.map(
  (t) => ({ value: t.value, label: t.label }),
);

export default function CmsPermissions() {
  return (
    <CmsLayout title="Permissions" allowedRoles={["cms_admin"]}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" />
              Role permission matrix
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Read-only reference of what each job title can do across the CMS workspace.
              Database row-level security enforces the floor; this UI matches the policies in code.
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            {SECTIONS.map((section) => (
              <section key={section.title}>
                <h3 className="text-sm font-semibold mb-2 text-foreground/80">
                  {section.title}
                </h3>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[280px]">Capability</TableHead>
                        {titleColumns.map((c) => (
                          <TableHead key={c.value} className="text-center">
                            {c.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {section.capabilities.map((cap) => (
                        <TableRow key={cap}>
                          <TableCell className="font-medium">
                            {CAPABILITY_LABELS[cap]}
                          </TableCell>
                          {titleColumns.map((c) => {
                            const allowed = PERMISSION_MATRIX[c.value][cap];
                            return (
                              <TableCell key={c.value} className="text-center">
                                {allowed ? (
                                  <Check className="w-4 h-4 inline text-green-600" />
                                ) : (
                                  <Minus className="w-4 h-4 inline text-muted-foreground/50" />
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            ))}

            <div className="rounded-md border bg-muted/40 p-4 text-sm space-y-2">
              <p className="font-semibold">Role summary</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>
                  <Badge variant="outline" className="mr-2">Admin</Badge>
                  Full access to everything (users, properties, all tasks & attendance).
                </li>
                <li>
                  <Badge variant="outline" className="mr-2">Team Leader</Badge>
                  Create / edit / delete any task, assign any role, view all attendance.
                </li>
                <li>
                  <Badge variant="outline" className="mr-2">Senior Developer</Badge>
                  Create / edit / delete any task, but can only assign Developers & Reviewers.
                </li>
                <li>
                  <Badge variant="outline" className="mr-2">Developer</Badge>
                  Edit only tasks they're on. Comment + edit custom properties. No status approvals.
                </li>
                <li>
                  <Badge variant="outline" className="mr-2">Reviewer</Badge>
                  Same as Developer, plus can move review tasks to <span className={cn("font-medium")}>In Progress</span> / <span className="font-medium">Done</span>.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </CmsLayout>
  );
}
