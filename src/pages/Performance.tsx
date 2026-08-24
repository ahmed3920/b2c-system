import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiveIssuesTable } from "@/components/live-issues/LiveIssuesTable";
import { CSTicketsTable } from "@/components/cs-tickets/CSTicketsTable";
import { QualityTab } from "@/components/tracking/QualityTab";

import { AssignedCSEvaluations } from "@/components/cs-tickets/AssignedCSEvaluations";
import { useUserRole } from "@/hooks/useUserRole";
import { useCsFullAccess } from "@/hooks/useCsFullAccess";


const sections = [
  { v: "quality", l: "Quality", desc: "Quality scoring breakdown by team and tutor." },
  { v: "live-issues", l: "Live Issues" },
  { v: "lateness", l: "Lateness", desc: "Late starts and end-of-shift overruns." },
  { v: "cs-tickets", l: "CS Tickets" },
];

export default function Performance() {
  const { isMentor, isAdmin, isTeamLeader } = useUserRole();
  const { hasAccess: csFullAccess } = useCsFullAccess();
  const mentorOnly = isMentor && !isAdmin && !isTeamLeader && !csFullAccess;
  const csOnly = isMentor && !isAdmin && !isTeamLeader && csFullAccess;

  if (mentorOnly) {
    return (
      <AppLayout title="Performance" allowedRoles={["admin", "team_leader", "mentor", "community_moderator"]}>
        <div className="p-6 max-w-[1600px] mx-auto">
          <AssignedCSEvaluations />
        </div>
      </AppLayout>
    );
  }

  if (csOnly) {
    return (
      <AppLayout title="Performance" allowedRoles={["admin", "team_leader", "mentor", "community_moderator"]}>
        <div className="p-6 max-w-[1600px] mx-auto">
          <CSTicketsTable />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Performance" allowedRoles={["admin", "team_leader", "mentor", "community_moderator"]}>
      <div className="p-6 max-w-[1600px] mx-auto">
        <Tabs defaultValue="live-issues">
          <TabsList className="flex-wrap h-auto">
            {sections.map((s) => (
              <TabsTrigger key={s.v} value={s.v}>{s.l}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="quality" className="mt-4">
            <QualityTab />
          </TabsContent>

          <TabsContent value="live-issues" className="mt-4">
            <LiveIssuesTable />
          </TabsContent>

          <TabsContent value="cs-tickets" className="mt-4">
            <CSTicketsTable />
          </TabsContent>

          {sections.filter((s) => !["live-issues", "cs-tickets", "quality"].includes(s.v)).map((s) => (
            <TabsContent key={s.v} value={s.v}>
              <Card>
                <CardHeader><CardTitle>{s.l}</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">{s.desc}</CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}
