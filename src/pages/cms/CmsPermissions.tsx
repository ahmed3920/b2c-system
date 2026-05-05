import { useEffect, useState } from "react";
import { CmsLayout } from "@/components/cms/CmsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  Check,
  Minus,
  RotateCcw,
  ShieldAlert,
  TestTube2,
} from "lucide-react";
import { JOB_TITLES, jobTitleLabel, type CmsJobTitle } from "@/lib/cmsJobTitles";
import {
  CAPABILITY_LABELS,
  PERMISSION_MATRIX,
  type CmsCapability,
} from "@/lib/cmsPermissions";
import {
  getEffectiveMatrix,
  hasOverride,
  resetOverrides,
  setOverride,
  subscribePermissionOverrides,
} from "@/lib/cmsPermissionOverrides";
import { toast } from "sonner";
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

const ALL_CAPABILITIES: CmsCapability[] = SECTIONS.flatMap((s) => s.capabilities);

export default function CmsPermissions() {
  const [matrix, setMatrix] = useState(() => getEffectiveMatrix());
  const [testRole, setTestRole] = useState<CmsJobTitle>("developer");

  useEffect(() => {
    return subscribePermissionOverrides(() => setMatrix(getEffectiveMatrix()));
  }, []);

  const toggle = (title: CmsJobTitle, cap: CmsCapability, value: boolean) => {
    setOverride(title, cap, value);
  };

  const overriddenCount = (Object.keys(PERMISSION_MATRIX) as CmsJobTitle[]).reduce(
    (sum, t) => sum + ALL_CAPABILITIES.filter((c) => hasOverride(t, c)).length,
    0,
  );

  return (
    <CmsLayout title="Permissions" allowedRoles={["cms_admin"]}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-primary" />
                  Role permissions
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  View, edit, and test what each role can do. Changes take effect
                  immediately for everyone using this browser. Reset to restore the
                  defaults defined in code.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {overriddenCount > 0 && (
                  <Badge variant="secondary">{overriddenCount} override{overriddenCount === 1 ? "" : "s"}</Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetOverrides();
                    toast.success("All permissions reset to defaults");
                  }}
                  disabled={overriddenCount === 0}
                >
                  <RotateCcw className="w-4 h-4 mr-1" /> Reset all
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="edit">
              <TabsList>
                <TabsTrigger value="edit">Edit matrix</TabsTrigger>
                <TabsTrigger value="test">
                  <TestTube2 className="w-4 h-4 mr-1" /> Test as role
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="space-y-8 mt-6">
                {overriddenCount > 0 && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600" />
                    <span>
                      You have {overriddenCount} override{overriddenCount === 1 ? "" : "s"} active.
                      Overridden cells are highlighted. These are stored in this browser only — to
                      promote them globally, update <code className="text-xs">cmsPermissions.ts</code>.
                    </span>
                  </div>
                )}

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
                            {JOB_TITLES.map((c) => (
                              <TableHead key={c.value} className="text-center min-w-[120px]">
                                {c.label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {section.capabilities.map((cap) => (
                            <TableRow key={cap}>
                              <TableCell className="font-medium align-middle">
                                {CAPABILITY_LABELS[cap]}
                              </TableCell>
                              {JOB_TITLES.map((c) => {
                                const allowed = matrix[c.value][cap];
                                const overridden = hasOverride(c.value, cap);
                                return (
                                  <TableCell
                                    key={c.value}
                                    className={cn(
                                      "text-center align-middle",
                                      overridden && "bg-amber-500/10",
                                    )}
                                  >
                                    <div className="flex justify-center">
                                      <Switch
                                        checked={allowed}
                                        onCheckedChange={(v) => toggle(c.value, cap, v)}
                                        aria-label={`${c.label} – ${CAPABILITY_LABELS[cap]}`}
                                      />
                                    </div>
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
              </TabsContent>

              <TabsContent value="test" className="space-y-4 mt-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium">Pretend I am a:</span>
                  <Select value={testRole} onValueChange={(v) => setTestRole(v as CmsJobTitle)}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_TITLES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">
                    Showing what {jobTitleLabel(testRole)} can and cannot do with current settings.
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {SECTIONS.map((section) => (
                    <Card key={section.title}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{section.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1.5">
                        {section.capabilities.map((cap) => {
                          const allowed = matrix[testRole][cap];
                          return (
                            <div
                              key={cap}
                              className="flex items-center justify-between text-sm gap-3"
                            >
                              <span className="text-foreground/90">
                                {CAPABILITY_LABELS[cap]}
                              </span>
                              {allowed ? (
                                <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                                  <Check className="w-3.5 h-3.5" /> Allowed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                                  <Minus className="w-3.5 h-3.5" /> Denied
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </CmsLayout>
  );
}
