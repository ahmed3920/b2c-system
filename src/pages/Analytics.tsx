import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamCompositionTab } from "@/components/analytics/TeamCompositionTab";
import { OccupationTab } from "@/components/analytics/OccupationTab";

export default function Analytics() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Team composition and one-to-one session occupation, live from the iSchool system.
          </p>
        </div>
        <Tabs defaultValue="composition" className="space-y-4">
          <TabsList>
            <TabsTrigger value="composition">Team Composition</TabsTrigger>
            <TabsTrigger value="occupation">One to One Occupation Sessions</TabsTrigger>
          </TabsList>
          <TabsContent value="composition"><TeamCompositionTab /></TabsContent>
          <TabsContent value="occupation"><OccupationTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
