import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
  { v: "teams-composition", l: "Teams Composition" },
  { v: "ranking-upgrades", l: "Ranking Upgrades" },
  { v: "quality-scores", l: "Quality Scores" },
  { v: "leaves", l: "Leaves Verification" },
  { v: "community-flags", l: "Community Flags" },
  { v: "quality-flags", l: "Quality Flags" },
  { v: "cs-tickets", l: "CS Tickets" },
  { v: "live-issues", l: "Live Issues" },
  { v: "lateness", l: "Lateness" },
  { v: "culture-fit", l: "Culture Fit" },
  { v: "kpis", l: "Tutors KPIs" },
  { v: "trainings", l: "Trainings" },
  { v: "satisfaction", l: "Satisfaction" },
];

export default function Tracking() {
  return (
    <AppLayout title="Tracking" allowedRoles={["admin", "team_leader"]}>
      <div className="p-6 max-w-7xl mx-auto">
        <Tabs defaultValue="teams-composition">
          <TabsList className="flex-wrap h-auto justify-start">
            {tabs.map((t) => (
              <TabsTrigger key={t.v} value={t.v}>{t.l}</TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.v} value={t.v}>
              <Card>
                <CardHeader><CardTitle>{t.l}</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Placeholder content for <span className="font-medium text-foreground">{t.l}</span>. Tables and charts will be wired here later.
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}
