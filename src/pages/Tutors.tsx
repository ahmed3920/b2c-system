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
import { Search, Eye, Users, GraduationCap, Globe2, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";
import { tutorRoster } from "@/data/tutorRoster";

const PAGE_SIZE = 25;

export default function Tutors() {
  const [query, setQuery] = useState("");
  const [tlFilter, setTlFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [empFilter, setEmpFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const teamLeaders = useMemo(
    () => Array.from(new Set(tutorRoster.map((t) => t.team_leader))).sort(),
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tutorRoster.filter((t) => {
      if (tlFilter !== "all" && t.team_leader !== tlFilter) return false;
      if (roleFilter !== "all" && t.role !== roleFilter) return false;
      if (langFilter !== "all" && t.language !== langFilter) return false;
      if (empFilter !== "all" && t.employment_type !== empFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.mentor.toLowerCase().includes(q) ||
        t.team_leader.toLowerCase().includes(q)
      );
    });
  }, [query, tlFilter, roleFilter, langFilter, empFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const stats = useMemo(
    () => ({
      total: tutorRoster.length,
      tutors: tutorRoster.filter((t) => t.role === "Tutor").length,
      mentors: tutorRoster.filter((t) => t.role === "Mentor").length,
      arabic: tutorRoster.filter((t) => t.language === "Arabic").length,
      english: tutorRoster.filter((t) => t.language === "English").length,
      fullTime: tutorRoster.filter((t) => t.employment_type === "Full-time").length,
      partTime: tutorRoster.filter((t) => t.employment_type === "Part-time").length,
    }),
    [],
  );

  const resetPage = () => setPage(1);

  return (
    <AppLayout title="Tutors" allowedRoles={["admin", "team_leader"]}>
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard icon={<Users className="h-4 w-4" />} label="Total" value={stats.total} />
          <StatCard icon={<Users className="h-4 w-4" />} label="Tutors" value={stats.tutors} />
          <StatCard
            icon={<GraduationCap className="h-4 w-4" />}
            label="Mentors"
            value={stats.mentors}
          />
          <StatCard icon={<Globe2 className="h-4 w-4" />} label="Arabic" value={stats.arabic} />
          <StatCard icon={<Globe2 className="h-4 w-4" />} label="English" value={stats.english} />
        </div>

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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No tutors match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageItems.map((t) => (
                      <TableRow key={t.id}>
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
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" asChild>
                            <Link to={`/tutors/${t.id}`}>
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
