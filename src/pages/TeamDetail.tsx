import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Target, Search, Eye, Users, GraduationCap } from "lucide-react";
import { getTeamBySlug } from "@/data/tutorRosterHelpers";
import { useInactiveTutorIds } from "@/hooks/useInactiveTutorIds";

export default function TeamDetail() {
  const { id } = useParams();
  const { inactiveIds } = useInactiveTutorIds();
  const team = useMemo(() => (id ? getTeamBySlug(id, inactiveIds) : undefined), [id, inactiveIds]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "Tutor" | "Mentor">("all");

  if (!team) {
    return (
      <AppLayout title="Team not found" allowedRoles={["admin", "team_leader"]}>
        <div className="p-6 max-w-3xl mx-auto">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/teams">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Teams
            </Link>
          </Button>
          <Card className="mt-4">
            <CardContent className="p-8 text-center text-muted-foreground">
              Team not found.
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const members = useMemo(() => {
    const q = query.trim().toLowerCase();
    return team.members.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.mentor.toLowerCase().includes(q)
      );
    });
  }, [team, query, roleFilter]);

  return (
    <AppLayout title={`Team · ${team.team_leader}`} allowedRoles={["admin", "team_leader"]}>
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/teams">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Teams
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/action-plans">
              <Target className="h-4 w-4 mr-1" /> Team Action Plans
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
              {team.team_leader
                .split(/\s+/)
                .slice(0, 2)
                .map((s) => s[0])
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <CardTitle>{team.team_leader}</CardTitle>
              <p className="text-sm text-muted-foreground">Team Leader</p>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Members" value={team.total} />
          <Stat label="Tutors" value={team.tutors} />
          <Stat label="Mentors" value={team.mentors} icon={<GraduationCap className="h-3.5 w-3.5" />} />
          <Stat
            label="Languages"
            value={`${team.arabic} AR · ${team.english} EN`}
          />
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Members
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="pl-8"
                />
              </div>
              <div className="flex items-center bg-muted rounded-md p-1 gap-1">
                {(["all", "Tutor", "Mentor"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      roleFilter === r
                        ? "bg-card shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r === "all" ? "All" : r}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Mentor</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Ranking</TableHead>
                    <TableHead>Employment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No members match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">{m.id}</TableCell>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.mentor || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={m.role === "Mentor" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {m.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {m.language || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{m.ranking || "—"}</TableCell>
                        <TableCell>
                          {m.employment_type ? (
                            <Badge
                              variant={m.employment_type === "Full-time" ? "default" : "outline"}
                              className="text-xs"
                            >
                              {m.employment_type}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" asChild>
                            <Link to={`/tutors/${m.id}`}>
                              <Eye className="h-4 w-4 mr-1" /> View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Showing {members.length} of {team.total}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
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
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {icon}
          {label}
        </div>
        <div className="text-xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
