import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, Star, TrendingUp, TrendingDown, Minus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar,
} from "recharts";
import * as XLSX from "xlsx";
import { format, parseISO } from "date-fns";

interface EngagementRow {
  id: string;
  tutor_external_id: string | null;
  tutor_name: string;
  is_mentor: boolean | null;
  tutor_language: string | null;
  availability_type: string | null;
  team_leader: string;
  month: string;
  total_sessions: number | null;
  sessions_with_feedback: number | null;
  rating: number | null;
}

const monthLabel = (iso: string) => format(parseISO(iso), "MMM yyyy");

export function EngagementTab() {
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<EngagementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMonth, setUploadMonth] = useState<string>(
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"),
  );
  const [search, setSearch] = useState("");
  const [tlFilter, setTlFilter] = useState<string>("all");

  const fetchData = async () => {
    setLoading(true);
    const pageSize = 1000;
    let from = 0;
    const allRows: EngagementRow[] = [];

    try {
      while (true) {
        const { data, error } = await supabase
          .from("engagement_uploads")
          .select("*")
          .order("month", { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        const batch = (data ?? []) as EngagementRow[];
        allRows.push(...batch);

        if (batch.length < pageSize) break;
        from += pageSize;
      }

      setRows(allRows);
    } catch (error: any) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const months = useMemo(
    () => Array.from(new Set(rows.map(r => r.month))).sort(),
    [rows],
  );
  const teamLeaders = useMemo(
    () => Array.from(new Set(rows.map(r => r.team_leader))).sort(),
    [rows],
  );

  // ----- TL summary per month -----
  // tutors    = total tutors assigned to TL in that month (matches source file)
  // ratedCount = tutors who actually have a rating (used for the average)
  const tlSummary = useMemo(() => {
    const map = new Map<string, Map<string, { sum: number; ratedCount: number; tutors: number; sessions: number; ratedSessions: number }>>();
    rows.forEach(r => {
      if (!map.has(r.team_leader)) map.set(r.team_leader, new Map());
      const m = map.get(r.team_leader)!;
      const k = r.month;
      const cur = m.get(k) ?? { sum: 0, ratedCount: 0, tutors: 0, sessions: 0, ratedSessions: 0 };
      cur.tutors += 1;
      if (r.rating != null) { cur.sum += Number(r.rating); cur.ratedCount += 1; }
      cur.sessions += r.total_sessions ?? 0;
      cur.ratedSessions += r.sessions_with_feedback ?? 0;
      m.set(k, cur);
    });
    return Array.from(map.entries()).map(([tl, monthMap]) => {
      const perMonth: Record<string, { avg: number | null; sessions: number; count: number; rated: number; ratedSessions: number }> = {};
      months.forEach(mo => {
        const c = monthMap.get(mo);
        perMonth[mo] = c
          ? { avg: c.ratedCount ? c.sum / c.ratedCount : null, sessions: c.sessions, count: c.tutors, rated: c.ratedCount, ratedSessions: c.ratedSessions }
          : { avg: null, sessions: 0, count: 0, rated: 0, ratedSessions: 0 };
      });
      return { teamLeader: tl, perMonth };
    });
  }, [rows, months]);

  // ----- Tutor per-month rating -----
  const tutorSummary = useMemo(() => {
    const map = new Map<string, { name: string; tl: string; perMonth: Record<string, { rating: number | null; sessions: number }> }>();
    rows.forEach(r => {
      const key = r.tutor_external_id || r.tutor_name;
      if (!map.has(key)) {
        map.set(key, { name: r.tutor_name, tl: r.team_leader, perMonth: {} });
      }
      const cur = map.get(key)!;
      cur.perMonth[r.month] = { rating: r.rating != null ? Number(r.rating) : null, sessions: r.total_sessions ?? 0 };
      cur.tl = r.team_leader;
    });
    let arr = Array.from(map.values());
    if (tlFilter !== "all") arr = arr.filter(t => t.tl === tlFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter(t => t.name.toLowerCase().includes(s) || t.tl.toLowerCase().includes(s));
    }
    return arr.sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, tlFilter, search]);

  // ----- Trend chart (avg rating per TL across months) -----
  const trendData = useMemo(() => {
    return months.map(mo => {
      const point: Record<string, any> = { month: monthLabel(mo) };
      tlSummary.forEach(t => {
        const v = t.perMonth[mo].avg;
        point[t.teamLeader] = v != null ? Number(v.toFixed(2)) : null;
      });
      return point;
    });
  }, [months, tlSummary]);

  // ----- Distribution bar (rating buckets across all rows) -----
  const distData = useMemo(() => {
    const buckets = [
      { label: "< 3", min: 0, max: 3, count: 0 },
      { label: "3 – 3.5", min: 3, max: 3.5, count: 0 },
      { label: "3.5 – 4", min: 3.5, max: 4, count: 0 },
      { label: "4 – 4.5", min: 4, max: 4.5, count: 0 },
      { label: "4.5 – 5", min: 4.5, max: 5.0001, count: 0 },
    ];
    rows.forEach(r => {
      if (r.rating == null) return;
      const v = Number(r.rating);
      const b = buckets.find(b => v >= b.min && v < b.max);
      if (b) b.count += 1;
    });
    return buckets;
  }, [rows]);

  const colors = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(217 91% 60%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)", "hsl(280 70% 55%)", "hsl(0 72% 51%)", "hsl(180 65% 40%)"];

  // ----- Upload handler -----
  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: null });

      const records = json
        .filter(r => r.Name)
        .map(r => ({
          tutor_external_id: r["T ID"] ? String(r["T ID"]) : null,
          tutor_name: String(r["Name"]).trim(),
          is_mentor: String(r["IsMentor"] ?? "").toLowerCase() === "mentor",
          tutor_language: r["Tutor Language"] ?? null,
          availability_type: r["Availability Type"] ?? null,
          team_leader: r["Admins - Team Lead → Name"]
            ? String(r["Admins - Team Lead → Name"]).trim()
            : "Unassigned",
          month: uploadMonth,
          total_sessions: Number(r["Total Sessions"] ?? 0),
          sessions_with_feedback: Number(r["Sessions With Feedback"] ?? 0),
          rating: r["Rating"] != null ? Number(r["Rating"]) : null,
        }));

      if (records.length === 0) {
        toast({ title: "No rows found", description: "Check the file format.", variant: "destructive" });
        return;
      }

      // Delete existing rows for that month, then insert
      const { error: delErr } = await supabase
        .from("engagement_uploads")
        .delete()
        .eq("month", uploadMonth);
      if (delErr) throw delErr;

      // Insert in chunks of 500
      for (let i = 0; i < records.length; i += 500) {
        const chunk = records.slice(i, i + 500);
        const { error } = await supabase.from("engagement_uploads").insert(chunk);
        if (error) throw error;
      }

      toast({ title: "Uploaded", description: `${records.length} tutor records imported for ${monthLabel(uploadMonth)}.` });
      await fetchData();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload (admins only) */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4" /> Upload Monthly Engagement Data
            </CardTitle>
            <CardDescription>
              Pick the month, then upload the exported xlsx (T ID, Name, IsMentor, Tutor Language,
              Availability Type, Total Sessions, Sessions With Feedback, Rating, Team Lead).
              Re-uploading the same month replaces existing data.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Month</label>
              <Input
                type="month"
                value={uploadMonth.slice(0, 7)}
                onChange={(e) => setUploadMonth(`${e.target.value}-01`)}
              />
            </div>
            <div className="flex-[2]">
              <label className="text-xs text-muted-foreground mb-1 block">File</label>
              <Input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
            {uploading && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing…
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No engagement data yet. {isAdmin && "Upload your first monthly file above."}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Avg Rating Trend by Team Leader
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis domain={[3.5, 5]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {tlSummary.map((t, i) => (
                      <Line
                        key={t.teamLeader}
                        type="monotone"
                        dataKey={t.teamLeader}
                        stroke={colors[i % colors.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="w-4 h-4" /> Rating Distribution (all months)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={distData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Sub-tabs */}
          <Tabs defaultValue="by-tl">
            <TabsList>
              <TabsTrigger value="by-tl">By Team Leader</TabsTrigger>
              <TabsTrigger value="by-tutor">By Tutor</TabsTrigger>
            </TabsList>

            <TabsContent value="by-tl" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Team Leader Engagement Summary</CardTitle>
                  <CardDescription>
                    Average tutor rating and total sessions per month for each team leader.
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team Leader</TableHead>
                        {months.map(m => (
                          <TableHead key={m} className="text-center">
                            {monthLabel(m)}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tlSummary.map(t => (
                        <TableRow key={t.teamLeader}>
                          <TableCell className="font-medium">{t.teamLeader}</TableCell>
                          {months.map((m, i) => {
                            const cell = t.perMonth[m];
                            const prev = i > 0 ? t.perMonth[months[i - 1]].avg : null;
                            const delta = cell.avg != null && prev != null ? cell.avg - prev : null;
                            return (
                              <TableCell key={m} className="text-center">
                                {cell.avg != null ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <div className="flex items-center gap-1">
                                      <span className="font-semibold">{cell.avg.toFixed(2)}</span>
                                      {delta != null && Math.abs(delta) >= 0.01 && (
                                        delta > 0 ? (
                                          <TrendingUp className="w-3 h-3 text-green-600" />
                                        ) : (
                                          <TrendingDown className="w-3 h-3 text-red-600" />
                                        )
                                      )}
                                      {delta != null && Math.abs(delta) < 0.01 && (
                                        <Minus className="w-3 h-3 text-muted-foreground" />
                                      )}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                      {cell.ratedSessions}/{cell.sessions} sessions · {cell.count} tutors
                                      {cell.rated < cell.count && ` (${cell.rated} rated)`}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                      {/* Overall totals row */}
                      <TableRow className="bg-muted/40 font-semibold border-t-2">
                        <TableCell>Overall</TableCell>
                        {months.map((m, i) => {
                          let sum = 0, rated = 0, sessions = 0, ratedSessions = 0, tutors = 0;
                          tlSummary.forEach(t => {
                            const c = t.perMonth[m];
                            if (c.avg != null) { sum += c.avg * c.rated; }
                            rated += c.rated;
                            sessions += c.sessions;
                            ratedSessions += c.ratedSessions;
                            tutors += c.count;
                          });
                          const avg = rated ? sum / rated : null;
                          const prevAvg = (() => {
                            if (i === 0) return null;
                            let ps = 0, pr = 0;
                            tlSummary.forEach(t => {
                              const pc = t.perMonth[months[i - 1]];
                              if (pc.avg != null) { ps += pc.avg * pc.rated; pr += pc.rated; }
                            });
                            return pr ? ps / pr : null;
                          })();
                          const delta = avg != null && prevAvg != null ? avg - prevAvg : null;
                          return (
                            <TableCell key={m} className="text-center">
                              {avg != null ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <div className="flex items-center gap-1">
                                    <span className="text-base">{avg.toFixed(2)}</span>
                                    {delta != null && Math.abs(delta) >= 0.01 && (
                                      delta > 0 ? <TrendingUp className="w-3 h-3 text-green-600" />
                                                : <TrendingDown className="w-3 h-3 text-red-600" />
                                    )}
                                    {delta != null && Math.abs(delta) < 0.01 && (
                                      <Minus className="w-3 h-3 text-muted-foreground" />
                                    )}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground font-normal">
                                    {sessions} sessions · {tutors} tutors
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="by-tutor" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">Tutor Engagement</CardTitle>
                      <CardDescription>Per-tutor rating across months. Filter by team leader or search by name.</CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search tutor…"
                          className="pl-8 w-full sm:w-56"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      <Select value={tlFilter} onValueChange={setTlFilter}>
                        <SelectTrigger className="w-full sm:w-56">
                          <SelectValue placeholder="All team leaders" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All team leaders</SelectItem>
                          {teamLeaders.map(tl => (
                            <SelectItem key={tl} value={tl}>{tl}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tutor</TableHead>
                        <TableHead>Team Leader</TableHead>
                        {months.map(m => (
                          <TableHead key={m} className="text-center">{monthLabel(m)}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tutorSummary.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2 + months.length} className="text-center text-muted-foreground py-8">
                            No tutors match the filters.
                          </TableCell>
                        </TableRow>
                      )}
                      {tutorSummary.map(t => (
                        <TableRow key={`${t.tl}-${t.name}`}>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell className="text-muted-foreground">{t.tl}</TableCell>
                          {months.map(m => {
                            const c = t.perMonth[m];
                            if (!c || c.rating == null) {
                              return <TableCell key={m} className="text-center text-muted-foreground">—</TableCell>;
                            }
                            const r = c.rating;
                            const tone =
                              r >= 4.5 ? "bg-green-500/10 text-green-700 dark:text-green-400" :
                              r >= 4   ? "bg-blue-500/10 text-blue-700 dark:text-blue-400" :
                              r >= 3.5 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                                         "bg-red-500/10 text-red-700 dark:text-red-400";
                            return (
                              <TableCell key={m} className="text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <Badge variant="secondary" className={tone}>
                                    {r.toFixed(2)}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">{c.sessions}s</span>
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
