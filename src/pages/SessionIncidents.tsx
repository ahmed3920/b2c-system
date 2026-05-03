import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Link as LinkIcon } from "lucide-react";
import { useSessionIncidents } from "@/hooks/useSessionIncidents";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentTeamLeader } from "@/hooks/useCurrentTeamLeader";
import { IncidentFormDialog } from "@/components/session-incidents/IncidentFormDialog";
import { GenerateTutorLinkDialog } from "@/components/session-incidents/GenerateTutorLinkDialog";
import { IncidentsTable } from "@/components/session-incidents/IncidentsTable";

export default function SessionIncidents() {
  const { role } = useUserRole();
  const { items, loading, refresh } = useSessionIncidents();
  const { mentorName } = useCurrentTeamLeader();
  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const isAdmin = role === "admin";
  const isTL = role === "team_leader" || role === "super_team_leader";
  const isMentor = role === "mentor" || role === "community_moderator";
  const canCreate = isAdmin || isTL || isMentor;
  const canValidate = isAdmin || isTL || isMentor;

  const myPending = useMemo(() => items.filter((i) => i.validation_status === "pending"), [items]);

  return (
    <AppLayout title="Session Incidents" allowedRoles={["admin", "team_leader", "super_team_leader", "mentor", "community_moderator"]}>
      <div className="p-6 max-w-[1600px] mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-semibold">Session Incident Tickets</h2>
            <p className="text-sm text-muted-foreground">Edu-side incidents that may need to be escalated to CS.</p>
          </div>
          <div className="flex gap-2">
            {canCreate && (
              <Button variant="outline" onClick={() => setLinkOpen(true)}>
                <LinkIcon className="h-4 w-4 mr-1" /> Tutor Link
              </Button>
            )}
            {canCreate && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Incident
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({items.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending Validation ({myPending.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4">
            <IncidentsTable items={items} loading={loading} onChanged={refresh} canValidate={canValidate} />
          </TabsContent>
          <TabsContent value="pending" className="mt-4">
            <IncidentsTable items={items} loading={loading} onChanged={refresh} canValidate={canValidate} pendingOnly title="Pending Validation" />
          </TabsContent>
        </Tabs>
      </div>

      <IncidentFormDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
      <GenerateTutorLinkDialog open={linkOpen} onOpenChange={setLinkOpen} />
    </AppLayout>
  );
}
