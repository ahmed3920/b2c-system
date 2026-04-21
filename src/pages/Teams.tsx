import { useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Eye, Users, GraduationCap, Globe2, Briefcase } from "lucide-react";
import { getTeamSummaries } from "@/data/tutorRosterHelpers";

export default function Teams() {
  const teams = useMemo(() => getTeamSummaries(), []);
  const totals = useMemo(
    () =>
      teams.reduce(
        (acc, t) => ({
          tutors: acc.tutors + t.tutors,
          mentors: acc.mentors + t.mentors,
          total: acc.total + t.total,
          fullTime: acc.fullTime + t.full_time,
          partTime: acc.partTime + t.part_time,
        }),
        { tutors: 0, mentors: 0, total: 0, fullTime: 0, partTime: 0 },
      ),
    [teams],
  );

  return (
    <AppLayout title="Teams" allowedRoles={["admin", "team_leader"]}>
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard label="Teams" value={teams.length} />
          <SummaryCard label="Total Members" value={totals.total} />
          <SummaryCard label="Tutors" value={totals.tutors} />
          <SummaryCard label="Mentors" value={totals.mentors} />
          <SummaryCard label="Full-time" value={totals.fullTime} />
          <SummaryCard label="Part-time" value={totals.partTime} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((t) => {
            const initials = t.team_leader
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((s) => s[0])
              .join("")
              .toUpperCase();
            return (
              <Card key={t.slug} className="card-hover">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                      {initials}
                    </div>
                    <div>
                      <CardTitle className="text-base leading-tight">
                        {t.team_leader}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">Team Leader</p>
                    </div>
                  </div>
                  <Users className="h-5 w-5 text-muted-foreground shrink-0" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Members" value={t.total} />
                    <Stat label="Tutors" value={t.tutors} />
                    <Stat
                      label="Mentors"
                      value={t.mentors}
                      icon={<GraduationCap className="h-3 w-3" />}
                    />
                    <Stat
                      label={t.arabic >= t.english ? "Arabic" : "English"}
                      value={t.arabic >= t.english ? t.arabic : t.english}
                      icon={<Globe2 className="h-3 w-3" />}
                    />
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {t.arabic > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Arabic · {t.arabic}
                      </Badge>
                    )}
                    {t.english > 0 && (
                      <Badge variant="outline" className="text-xs">
                        English · {t.english}
                      </Badge>
                    )}
                    {t.full_time > 0 && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Briefcase className="h-3 w-3" />
                        FT · {t.full_time}
                      </Badge>
                    )}
                    {t.part_time > 0 && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Briefcase className="h-3 w-3" />
                        PT · {t.part_time}
                      </Badge>
                    )}
                  </div>

                  <Button size="sm" variant="outline" className="w-full" asChild>
                    <Link to={`/teams/${t.slug}`}>
                      <Eye className="h-4 w-4 mr-1" /> View Team
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
