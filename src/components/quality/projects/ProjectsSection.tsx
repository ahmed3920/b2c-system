import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useProjectAuditAccess } from "@/hooks/useProjectAuditAccess";
import { ProjectAuditTab } from "./ProjectAuditTab";
import { ProjectEngagementTab } from "./ProjectEngagementTab";
import { ProjectStudentsTab } from "./ProjectStudentsTab";
import { ProjectAccessDialog } from "./ProjectAccessDialog";

export function ProjectsSection() {
  const { allowed, isAdmin, loading } = useProjectAuditAccess();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!allowed) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          You don't have access to the projects audit. Ask an admin to add you.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <ProjectAccessDialog />
        </div>
      )}
      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="audit">Projects Audit</TabsTrigger>
          <TabsTrigger value="approval">Approval</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
        </TabsList>
        <TabsContent value="audit" className="mt-0">
          <ProjectAuditTab />
        </TabsContent>
        <TabsContent value="approval" className="mt-0">
          <ProjectAuditTab pendingOnly />
        </TabsContent>
        <TabsContent value="engagement" className="mt-0">
          <ProjectEngagementTab />
        </TabsContent>
        <TabsContent value="students" className="mt-0">
          <ProjectStudentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
