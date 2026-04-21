import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Target,
  ClipboardList,
  Award,
  Flag,
  GraduationCap,
  Smartphone,
  Ban,
  Phone,
  User,
  Globe2,
  Briefcase,
} from "lucide-react";
import { getTutorById } from "@/data/tutorRosterHelpers";

// keep import order stable

export default function TutorProfile() {
  const { id } = useParams();
  const tutor = id ? getTutorById(id) : undefined;
  const initials = (tutor?.name ?? id ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  return (
    <AppLayout
      title={`${tutor?.role ?? "Tutor"} Profile · ${tutor?.name ?? id}`}
      allowedRoles={["admin", "team_leader"]}
    >
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/tutors">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Tutors
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/action-plans">
                <Target className="h-4 w-4 mr-1" /> View Action Plans
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/tasks">
                <ClipboardList className="h-4 w-4 mr-1" /> Open Tasks
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="truncate">
                {tutor?.name ?? `Tutor ${id}`}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {tutor ? (
                  <>
                    <span className="font-mono">{tutor.id}</span> · {tutor.team_leader} ·{" "}
                    {tutor.language || "—"}
                  </>
                ) : (
                  `ID: ${id}`
                )}
              </p>
              {tutor && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant={tutor.role === "Mentor" ? "default" : "secondary"}>
                    {tutor.role}
                  </Badge>
                  {tutor.ranking && <Badge variant="outline">{tutor.ranking}</Badge>}
                  <Badge variant="outline" className="gap-1">
                    <Globe2 className="h-3 w-3" />
                    {tutor.language || "—"}
                  </Badge>
                </div>
              )}
            </div>
            <Badge className="ml-auto shrink-0">Active</Badge>
          </CardHeader>
        </Card>

        {tutor && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Detail
                icon={<User className="h-4 w-4" />}
                label="Mentor"
                value={tutor.mentor || "—"}
              />
              <Detail
                icon={<GraduationCap className="h-4 w-4" />}
                label="Team Leader"
                value={tutor.team_leader}
              />
              <Detail
                icon={<Phone className="h-4 w-4" />}
                label="Phone"
                value={tutor.phone || "—"}
              />
              <Detail
                icon={<Award className="h-4 w-4" />}
                label="Ranking"
                value={tutor.ranking || "—"}
              />
            </CardContent>
          </Card>
        )}

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
            <TabsTrigger value="kpis">
              <Award className="h-4 w-4 mr-1" /> KPIs
            </TabsTrigger>
            <TabsTrigger value="quality">Quality</TabsTrigger>
            <TabsTrigger value="flags">
              <Flag className="h-4 w-4 mr-1" /> Flags
            </TabsTrigger>
            <TabsTrigger value="trainings">
              <GraduationCap className="h-4 w-4 mr-1" /> Trainings
            </TabsTrigger>
            <TabsTrigger value="action-plans">Action Plans</TabsTrigger>
          </TabsList>

          <TabsContent value="kpis">
            <Card>
              <CardContent className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {["Sessions: 142", "Rating: 4.7", "Attendance: 96%", "Lateness: 2"].map((k) => (
                  <div key={k} className="p-4 rounded-lg bg-muted/50 text-sm font-medium">
                    {k}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="quality">
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Quality scoring history and recent reviews appear here.
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="flags">
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No active flags.
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="trainings">
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Completed and upcoming training sessions.
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="action-plans">
            <Card>
              <CardContent className="p-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Open action plans for this tutor.
                </p>
                <Button asChild>
                  <Link to="/action-plans">Go to Action Plans</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium mt-1 truncate" title={value}>
        {value}
      </div>
    </div>
  );
}
