import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Target, ClipboardList, Award, Flag, GraduationCap, Smartphone, Ban } from "lucide-react";

export default function TutorProfile() {
  const { id } = useParams();

  return (
    <AppLayout title={`Tutor Profile · ${id}`} allowedRoles={["admin", "team_leader"]}>
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/tutors"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Tutors</Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/action-plans"><Target className="h-4 w-4 mr-1" /> View Action Plans</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/tasks"><ClipboardList className="h-4 w-4 mr-1" /> Open Tasks</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
              {id?.charAt(0)}
            </div>
            <div>
              <CardTitle>Tutor {id}</CardTitle>
              <p className="text-sm text-muted-foreground">Team A · English</p>
            </div>
            <Badge className="ml-auto">Active</Badge>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Ban className="h-4 w-4 text-destructive" />
              Learning Constraints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="inline-flex items-center gap-3 rounded-md border px-3 py-2 bg-muted/40">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Device Limitation</div>
                <div className="text-xs text-muted-foreground">
                  Some modules may be skipped due to device requirements
                </div>
              </div>
              <Badge variant="outline" className="border-destructive/50 text-destructive">
                Active
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="kpis">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="kpis"><Award className="h-4 w-4 mr-1" /> KPIs</TabsTrigger>
            <TabsTrigger value="quality">Quality</TabsTrigger>
            <TabsTrigger value="flags"><Flag className="h-4 w-4 mr-1" /> Flags</TabsTrigger>
            <TabsTrigger value="trainings"><GraduationCap className="h-4 w-4 mr-1" /> Trainings</TabsTrigger>
            <TabsTrigger value="action-plans">Action Plans</TabsTrigger>
          </TabsList>

          <TabsContent value="kpis">
            <Card><CardContent className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              {["Sessions: 142", "Rating: 4.7", "Attendance: 96%", "Lateness: 2"].map((k) => (
                <div key={k} className="p-4 rounded-lg bg-muted/50 text-sm font-medium">{k}</div>
              ))}
            </CardContent></Card>
          </TabsContent>
          <TabsContent value="quality">
            <Card><CardContent className="p-6 text-sm text-muted-foreground">Quality scoring history and recent reviews appear here.</CardContent></Card>
          </TabsContent>
          <TabsContent value="flags">
            <Card><CardContent className="p-6 text-sm text-muted-foreground">No active flags.</CardContent></Card>
          </TabsContent>
          <TabsContent value="trainings">
            <Card><CardContent className="p-6 text-sm text-muted-foreground">Completed and upcoming training sessions.</CardContent></Card>
          </TabsContent>
          <TabsContent value="action-plans">
            <Card><CardContent className="p-6 space-y-3">
              <p className="text-sm text-muted-foreground">Open action plans for this tutor.</p>
              <Button asChild><Link to="/action-plans">Go to Action Plans</Link></Button>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
