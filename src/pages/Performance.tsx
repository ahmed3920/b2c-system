import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const sections = [
  { v: "quality", l: "Quality", desc: "Quality scoring breakdown by team and tutor." },
  { v: "live-issues", l: "Live Issues", desc: "Live session issues raised in real time." },
  { v: "lateness", l: "Lateness", desc: "Late starts and end-of-shift overruns." },
  { v: "cs-tickets", l: "CS Tickets", desc: "Customer-support tickets linked to tutors." },
];

export default function Performance() {
  return (
    <AppLayout title="Performance" allowedRoles={["admin", "team_leader"]}>
      <div className="p-6 max-w-7xl mx-auto">
        <Tabs defaultValue="quality">
          <TabsList className="flex-wrap h-auto">
            {sections.map((s) => (
              <TabsTrigger key={s.v} value={s.v}>{s.l}</TabsTrigger>
            ))}
          </TabsList>
          {sections.map((s) => (
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
