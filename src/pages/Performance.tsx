import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiveIssuesTable } from "@/components/live-issues/LiveIssuesTable";

const sections = [
  { v: "quality", l: "Quality", desc: "Quality scoring breakdown by team and tutor." },
  { v: "live-issues", l: "Live Issues" },
  { v: "lateness", l: "Lateness", desc: "Late starts and end-of-shift overruns." },
  { v: "cs-tickets", l: "CS Tickets", desc: "Customer-support tickets linked to tutors." },
];

export default function Performance() {
  return (
    <AppLayout title="Performance" allowedRoles={["admin", "team_leader"]}>
      <div className="p-6 max-w-[1600px] mx-auto">
        <Tabs defaultValue="live-issues">
          <TabsList className="flex-wrap h-auto">
            {sections.map((s) => (
              <TabsTrigger key={s.v} value={s.v}>{s.l}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="live-issues" className="mt-4">
            <LiveIssuesTable />
          </TabsContent>

          {sections.filter((s) => s.v !== "live-issues").map((s) => (
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
