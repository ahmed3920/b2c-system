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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, Eye, Users, GraduationCap, Globe2, Briefcase, UserX, Pencil, Upload, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentTeamLeader } from "@/hooks/useCurrentTeamLeader";
import { teamLeaderMatches } from "@/lib/teamLeaderMatch";
import { useTutorStatus, type TutorStatusValue } from "@/hooks/useTutorStatus";
import { TutorStatusDialog } from "@/components/tutors/TutorStatusDialog";
import { useTutorRoster, type MergedTutor } from "@/hooks/useTutorRoster";
import { TutorAssignmentDialog } from "@/components/tutors/TutorAssignmentDialog";
import { UploadRosterDialog } from "@/components/tutors/UploadRosterDialog";
import { format } from "date-fns";

const PAGE_SIZE = 25;

const statusBadgeClass: Record<TutorStatusValue, string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  resigned: "bg-amber-100 text-amber-700 border-amber-200",
  terminated: "bg-red-100 text-red-700 border-red-200",
};

export default function Tutors() {
  const { isTeamLeader, isAdmin, isSuperTeamLeader } = useUserRole();
  const { teamLeader: myTeamLeader } = useCurrentTeamLeader();
  const { byTutorId, upsertStatus } = useTutorStatus();
  const { merged: roster, upsertOverride } = useTutorRoster();

  const canEditStatus = isAdmin || isTeamLeader || isSuperTeamLeader;
  const canEditAssign = isAdmin || isTeamLeader || isSuperTeamLeader;
  const canUpload = isAdmin;

  const [query, setQuery] = useState("");
  const [tlFilter, setTlFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [empFilter, setEmpFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [statusTarget, setStatusTarget] = useState<MergedTutor | null>(null);
  const [assignTarget, setAssignTarget] = useState<MergedTutor | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Restrict roster to TL's own team when not admin
  const scopedRoster = useMemo(() => {
    if (isTeamLeader && !isAdmin && myTeamLeader) {
      return roster.filter((t) => teamLeaderMatches(t.team_leader, myTeamLeader));
    }
    return roster;
  }, [isTeamLeader, isAdmin, myTeamLeader, roster]);

  const teamLeaders = useMemo(
    () => Array.from(new Set(scopedRoster.map((t) => t.team_leader).filter(Boolean))).sort() as string[],
    [scopedRoster],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scopedRoster.filter((t) => {
      if (tlFilter !== "all" && t.team_leader !== tlFilter) return false;
      if (roleFilter !== "all" && t.role !== roleFilter) return false;
      if (langFilter !== "all" && t.language !== langFilter) return false;
      if (empFilter !== "all" && t.employment_type !== empFilter) return false;
      if (statusFilter !== "all") {
        const s = byTutorId.get(t.id)?.status ?? "active";
        if (s !== statusFilter) return false;
      }
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.mentor.toLowerCase().includes(q) ||
        t.team_leader.toLowerCase().includes(q)
      );
    });
  }, [query, tlFilter, roleFilter, langFilter, empFilter, statusFilter, scopedRoster, byTutorId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const stats = useMemo(
    () => ({
      total: scopedRoster.length,
      tutors: scopedRoster.filter((t) => t.role === "Tutor").length,
      mentors: scopedRoster.filter((t) => t.role === "Mentor").length,
      arabic: scopedRoster.filter((t) => t.language === "Arabic").length,
      english: scopedRoster.filter((t) => t.language === "English").length,
      fullTime: scopedRoster.filter((t) => t.employment_type === "Full-time").length,
      partTime: scopedRoster.filter((t) => t.employment_type === "Part-time").length,
      contract: scopedRoster.filter((t) => t.employment_type === "Contract").length,
    }),
    [scopedRoster],
  );

  const resetPage = () => setPage(1);

  return (
    <AppLayout title="Tutors" allowedRoles={["admin", "team_leader", "super_team_leader"]}>
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-3">
          <StatCard icon={<Users className="h-4 w-4" />} label="Total" value={stats.total} />
          <StatCard icon={<Users className="h-4 w-4" />} label="Tutors" value={stats.tutors} />
          <StatCard
            icon={<GraduationCap className="h-4 w-4" />}
            label="Mentors"
            value={stats.mentors}
          />
          <StatCard icon={<Globe2 className="h-4 w-4" />} label="Arabic" value={stats.arabic} />
          <StatCard icon={<Globe2 className="h-4 w-4" />} label="English" value={stats.english} />
          <StatCard
            icon={<Briefcase className="h-4 w-4" />}
            label="Full-time"
            value={stats.fullTime}
          />
          <StatCard
            icon={<Briefcase className="h-4 w-4" />}
            label="Part-time"
            value={stats.partTime}
          />
          <StatCard
            icon={<Briefcase className="h-4 w-4" />}
            label="Contract"
            value={stats.contract}
          />
        </div>

        {canUpload && (
          <div className="flex justify-end gap-2">
            <ResyncHistoricalButton />
            <Button onClick={() => setUploadOpen(true)} variant="outline">
              <Upload className="h-4 w-4 mr-2" /> Upload Roster Sheet
            </Button>
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>All Tutors & Mentors</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    resetPage();
                  }}
                  placeholder="Search name, ID, mentor…"
                  className="pl-8"
                />
              </div>
              <Select
                value={tlFilter}
                onValueChange={(v) => {
                  setTlFilter(v);
                  resetPage();
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Team Leader" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Leaders</SelectItem>
                  {teamLeaders.map((tl) => (
                    <SelectItem key={tl} value={tl}>
                      {tl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={roleFilter}
                onValueChange={(v) => {
                  setRoleFilter(v);
                  resetPage();
                }}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="Tutor">Tutor</SelectItem>
                  <SelectItem value="Mentor">Mentor</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={langFilter}
                onValueChange={(v) => {
                  setLangFilter(v);
                  resetPage();
                }}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  <SelectItem value="Arabic">Arabic</SelectItem>
                  <SelectItem value="English">English</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={empFilter}
                onValueChange={(v) => {
                  setEmpFilter(v);
                  resetPage();
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Employment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employment</SelectItem>
                  <SelectItem value="Full-time">Full-time</SelectItem>
                  <SelectItem value="Part-time">Part-time</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  resetPage();
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resigned">Resigned</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Team Leader</TableHead>
                    <TableHead>Mentor</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Ranking</TableHead>
                    <TableHead>Employment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No tutors match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageItems.map((t) => {
                      const statusRec = byTutorId.get(t.id);
                      const status = statusRec?.status ?? "active";
                      const isMentor = t.role === "Mentor";
                      return (
                      <TableRow key={t.id} className={status !== "active" ? "bg-muted/30" : undefined}>
                        <TableCell className="font-mono text-xs">{t.id}</TableCell>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-sm">{t.team_leader}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {t.mentor || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={t.role === "Mentor" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {t.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {t.language || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{t.ranking || "—"}</TableCell>
                        <TableCell>
                          {t.employment_type ? (
                            <Badge
                              variant={t.employment_type === "Full-time" ? "default" : "outline"}
                              className="text-xs"
                            >
                              {t.employment_type}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={`inline-flex items-center w-fit rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass[status]}`}
                            >
                              {status}
                            </span>
                            {status !== "active" && statusRec?.effective_date && (
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(statusRec.effective_date), "MMM d, yyyy")}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canEditAssign && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setAssignTarget(t)}
                                title="Edit assignment"
                              >
                                <Pencil className="h-4 w-4 mr-1" /> Edit
                              </Button>
                            )}
                            {canEditStatus && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setStatusTarget(t)}
                                title="Set status"
                              >
                                <UserX className="h-4 w-4 mr-1" /> Status
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" asChild>
                              <Link to={`/tutors/${t.id}`}>
                                <Eye className="h-4 w-4 mr-1" /> View
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
              <p className="text-xs text-muted-foreground">
                Showing {pageItems.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
                {(safePage - 1) * PAGE_SIZE + pageItems.length} of {filtered.length}
              </p>
              {totalPages > 1 && (
                <Pagination className="mx-0 w-auto justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className={safePage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink isActive>
                        {safePage} / {totalPages}
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className={
                          safePage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <TutorStatusDialog
        open={!!statusTarget}
        onOpenChange={(o) => !o && setStatusTarget(null)}
        tutor={
          statusTarget
            ? {
                id: statusTarget.id,
                name: statusTarget.name,
                team_leader: statusTarget.team_leader,
                is_mentor: statusTarget.role === "Mentor",
              }
            : null
        }
        current={statusTarget ? byTutorId.get(statusTarget.id) ?? null : null}
        onSubmit={upsertStatus}
      />

      <TutorAssignmentDialog
        open={!!assignTarget}
        onOpenChange={(o) => !o && setAssignTarget(null)}
        tutor={assignTarget}
        onSubmit={async ({ team_leader, mentor }) => {
          if (!assignTarget) return { success: false };
          return upsertOverride({
            tutor_external_id: assignTarget.id,
            name: assignTarget.name,
            team_leader,
            mentor,
            ranking: assignTarget.ranking,
            phone: assignTarget.phone,
            role: assignTarget.role,
            language: assignTarget.language,
            employment_type: assignTarget.employment_type,
            is_new: assignTarget._isNew ?? false,
          });
        }}
      />

      <UploadRosterDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onDone={() => {}}
      />
    </AppLayout>
  );
}

function StatCard({
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

function ResyncHistoricalButton() {
  const [loading, setLoading] = useState(false);
  const onClick = async () => {
    if (!confirm("Re-sync tutor name, mentor and team leader from the roster into all historical records (incidents, CS tickets, action plans, status, emails, leaves, modules, study plans, etc.)? This can take a few seconds.")) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("backfill_tutor_assignments_from_overrides" as any);
    setLoading(false);
    if (error) {
      toast.error(error.message || "Backfill failed");
      return;
    }
    const updated = (data as any)?.updated ?? {};
    const total = Object.values(updated).reduce((a: number, b: any) => a + Number(b || 0), 0);
    toast.success(`Re-synced ${total} historical rows across ${Object.keys(updated).length} tables`);
  };
  return (
    <Button onClick={onClick} variant="outline" disabled={loading}>
      <RefreshCw className={"h-4 w-4 mr-2 " + (loading ? "animate-spin" : "")} />
      {loading ? "Re-syncing…" : "Re-sync Historical Data"}
    </Button>
  );
}
