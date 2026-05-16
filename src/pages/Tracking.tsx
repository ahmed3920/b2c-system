import { useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Eye, Users, GraduationCap, Globe2, Briefcase } from "lucide-react";
import { getTeamSummaries } from "@/data/tutorRosterHelpers";
import { useMergedRoster } from "@/hooks/useMergedRoster";
import { LiveIssuesTracking } from "@/components/tracking/LiveIssuesTracking";
import { LeavesVerificationTab } from "@/components/tracking/LeavesVerificationTab";
import { TrainingsTab } from "@/components/tracking/trainings/TrainingsTab";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentTeamLeader } from "@/hooks/useCurrentTeamLeader";
import { teamLeaderMatches } from "@/lib/teamLeaderMatch";
import { useInactiveTutorIds } from "@/hooks/useInactiveTutorIds";

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
  const { isTeamLeader, isAdmin } = useUserRole();
  const { teamLeader: myTeamLeader } = useCurrentTeamLeader();
  const { inactiveIds } = useInactiveTutorIds();
  const isTLView = isTeamLeader && !isAdmin && !!myTeamLeader;

  // Admin: one row per team leader. TL: one row per mentor inside their team.
  const teams = useMemo(() => {
    if (!isTLView) return getTeamSummaries(inactiveIds);

    const myMembers = tutorRoster.filter((t) =>
      teamLeaderMatches(t.team_leader, myTeamLeader) && !inactiveIds.has(t.id),
    );
    const byMentor = new Map<string, typeof myMembers>();
    for (const m of myMembers) {
      const hasMentor = !!m.mentor?.trim();
      const key = hasMentor
        ? m.mentor.trim()
        : m.id === "T-7221"
          ? "Unassigned"
          : m.name;
      const arr = byMentor.get(key) ?? [];
      arr.push(m);
      byMentor.set(key, arr);
    }
    return Array.from(byMentor.entries())
      .map(([mentor, members]) => ({
        slug: mentor.toLowerCase().replace(/\s+/g, "-"),
        team_leader: mentor, // displayed in the "Team Leader" column as the mentor name
        total: members.length,
        tutors: members.filter((m) => m.role === "Tutor").length,
        mentors: members.filter((m) => m.role === "Mentor").length,
        arabic: members.filter((m) => m.language === "Arabic").length,
        english: members.filter((m) => m.language === "English").length,
        full_time: members.filter((m) => m.employment_type === "Full-time").length,
        part_time: members.filter((m) => m.employment_type === "Part-time").length,
        members,
      }))
      .sort((a, b) => b.total - a.total);
  }, [isTLView, myTeamLeader, inactiveIds]);

  const totals = useMemo(
    () =>
      teams.reduce(
        (acc, t) => ({
          total: acc.total + t.total,
          tutors: acc.tutors + t.tutors,
          mentors: acc.mentors + t.mentors,
          arabic: acc.arabic + t.arabic,
          english: acc.english + t.english,
          fullTime: acc.fullTime + t.full_time,
          partTime: acc.partTime + t.part_time,
        }),
        {
          total: 0,
          tutors: 0,
          mentors: 0,
          arabic: 0,
          english: 0,
          fullTime: 0,
          partTime: 0,
        },
      ),
    [teams],
  );

  return (
    <AppLayout title="Tracking" allowedRoles={["admin", "team_leader"]}>
      <div className="p-6 max-w-7xl mx-auto">
        <Tabs defaultValue="teams-composition">
          <TabsList className="flex-wrap h-auto justify-start">
            {tabs.map((t) => (
              <TabsTrigger key={t.v} value={t.v}>{t.l}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="teams-composition" className="space-y-4">
            {/* Global totals */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
              <SummaryCard icon={<Users className="h-4 w-4" />} label={isTLView ? "Mentors" : "Teams"} value={teams.length} />
              <SummaryCard icon={<Users className="h-4 w-4" />} label="Members" value={totals.total} />
              <SummaryCard icon={<Users className="h-4 w-4" />} label="Tutors" value={totals.tutors} />
              <SummaryCard
                icon={<GraduationCap className="h-4 w-4" />}
                label="Mentors"
                value={totals.mentors}
              />
              <SummaryCard
                icon={<Globe2 className="h-4 w-4" />}
                label="Arabic"
                value={totals.arabic}
              />
              <SummaryCard
                icon={<Globe2 className="h-4 w-4" />}
                label="English"
                value={totals.english}
              />
              <SummaryCard
                icon={<Briefcase className="h-4 w-4" />}
                label="Full / Part"
                value={`${totals.fullTime} / ${totals.partTime}`}
              />
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> {isTLView ? "Mentors Composition" : "Teams Composition"}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {teams.length} {isTLView ? "mentors" : "teams"} · {totals.total} members
                </p>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isTLView ? "Mentor" : "Team Leader"}</TableHead>
                        <TableHead className="text-right">Members</TableHead>
                        <TableHead className="text-right">Tutors</TableHead>
                        <TableHead className="text-right">Mentors</TableHead>
                        <TableHead className="text-right">Arabic</TableHead>
                        <TableHead className="text-right">English</TableHead>
                        <TableHead className="text-right">Full-time</TableHead>
                        <TableHead className="text-right">Part-time</TableHead>
                        <TableHead>Mix</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teams.map((t) => {
                        const mentorPct = t.total > 0 ? Math.round((t.mentors / t.total) * 100) : 0;
                        const arabicPct = t.total > 0 ? Math.round((t.arabic / t.total) * 100) : 0;
                        return (
                          <TableRow key={t.slug}>
                            <TableCell className="font-medium">{t.team_leader}</TableCell>
                            <TableCell className="text-right font-semibold">{t.total}</TableCell>
                            <TableCell className="text-right">{t.tutors}</TableCell>
                            <TableCell className="text-right">{t.mentors}</TableCell>
                            <TableCell className="text-right">{t.arabic}</TableCell>
                            <TableCell className="text-right">{t.english}</TableCell>
                            <TableCell className="text-right">{t.full_time}</TableCell>
                            <TableCell className="text-right">{t.part_time}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="secondary" className="text-[10px]">
                                  {mentorPct}% M
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">
                                  {arabicPct}% AR
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {isTLView ? (
                                <span className="text-muted-foreground text-xs">—</span>
                              ) : (
                                <Button size="sm" variant="ghost" asChild>
                                  <Link to={`/teams/${t.slug}`}>
                                    <Eye className="h-4 w-4 mr-1" /> View
                                  </Link>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Totals footer */}
                      <TableRow className="bg-muted/40 font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{totals.total}</TableCell>
                        <TableCell className="text-right">{totals.tutors}</TableCell>
                        <TableCell className="text-right">{totals.mentors}</TableCell>
                        <TableCell className="text-right">{totals.arabic}</TableCell>
                        <TableCell className="text-right">{totals.english}</TableCell>
                        <TableCell className="text-right">{totals.fullTime}</TableCell>
                        <TableCell className="text-right">{totals.partTime}</TableCell>
                        <TableCell />
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="live-issues" className="mt-4">
            <LiveIssuesTracking />
          </TabsContent>

          <TabsContent value="leaves" className="mt-4">
            <LeavesVerificationTab />
          </TabsContent>

          <TabsContent value="trainings" className="mt-4">
            <TrainingsTab />
          </TabsContent>

          {tabs
            .filter(
              (t) =>
                t.v !== "teams-composition" &&
                t.v !== "live-issues" &&
                t.v !== "leaves" &&
                t.v !== "trainings",
            )
            .map((t) => (
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

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
