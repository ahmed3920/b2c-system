import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, AlertTriangle, Download, ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import { useQualityFilters, PAGE_SIZE } from "@/hooks/useQualityReviews";
import { runReplicaQuery, useReplicaQuery } from "@/hooks/useReplicaQuery";
import { QualityReviewDetailDialog } from "./QualityReviewDetailDialog";
import { QualityFilterBar, Field, Kpi, downloadCsv } from "./QualityFilterBar";
import { toast } from "@/hooks/use-toast";
import { tutorStatusLabel } from "@/lib/tutorStatus";

const ALL = "all";

type CommentRow = {
  review_id: string;
  score: string | null;
  session_start_at: string | null;
  review_cycle: string | number | null;
  tutor_tid: string | null;
  tutor_name: string | null;
  tutor_status: number | null;
  team_leader: string | null;
  mentor_name: string | null;
  source: "evaluation" | "tag";
  body: string | null;
  comment_type: number | null;
  criterion_name: string | null;
  parent_name: string | null;
  criterion_score: string | null;
};

type CommentCount = { total: number; positive: number; negative: number; written: number };

type MentorRow = {
  mentor_name: string;
  mentor_tid: string | null;
  tutors: number;
  reviews: number;
  avg_score: string | null;
  positive: number;
  negative: number;
  written: number;
};

function TypeBadge({ type, source }: { type: number | null; source: string }) {
  if (type === 0) return <Badge className="gap-1"><ThumbsUp className="w-3 h-3" /> Positive</Badge>;
  if (type === 1) return <Badge variant="destructive" className="gap-1"><ThumbsDown className="w-3 h-3" /> Negative</Badge>;
  if (source === "evaluation") return <Badge variant="secondary" className="gap-1"><MessageSquare className="w-3 h-3" /> Written</Badge>;
  return <Badge variant="outline">—</Badge>;
}

export function QualityMentorCommentsTab() {
  const f = useQualityFilters();
  const [view, setView] = useState<"comments" | "mentors">("comments");
  const [criterion, setCriterion] = useState("");
  const [commentType, setCommentType] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Small debounce so we don't hit the replica on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const commentParams = useMemo(
    () => ({
      ...f.baseParams,
      criterion: criterion || null,
      search: debounced || null,
      comment_type: commentType === "" ? null : Number(commentType),
    }),
    [f.baseParams, criterion, debounced, commentType],
  );
  const listParams = useMemo(
    () => ({ ...commentParams, limit: PAGE_SIZE, offset: f.page * PAGE_SIZE }),
    [commentParams, f.page],
  );

  const list = useReplicaQuery<CommentRow>("quality_comments_list", listParams, { enabled: view === "comments" });
  const counts = useReplicaQuery<CommentCount>("quality_comments_count", commentParams);
  const mentors = useReplicaQuery<MentorRow>("quality_comments_by_mentor", f.baseParams, { enabled: view === "mentors" });

  const c = counts.rows[0];
  const total = c?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows =
        view === "comments"
          ? await runReplicaQuery<Record<string, unknown>>("quality_comments_list", { ...commentParams, limit: 2000, offset: 0 })
          : await runReplicaQuery<Record<string, unknown>>("quality_comments_by_mentor", f.baseParams);
      const mapped = rows.map((r) =>
        "tutor_status" in r ? { ...r, tutor_status: tutorStatusLabel(r.tutor_status as number) } : r,
      );
      if (!downloadCsv(`quality-${view}-${new Date().toISOString().slice(0, 10)}.csv`, mapped)) {
        toast({ title: "Nothing to export" });
      }
    } catch (e) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Comments" value={total.toLocaleString()} loading={counts.loading} />
        <Kpi label="Positive" value={(c?.positive ?? 0).toLocaleString()} loading={counts.loading} />
        <Kpi label="Negative" value={(c?.negative ?? 0).toLocaleString()} loading={counts.loading} />
        <Kpi label="Written notes" value={(c?.written ?? 0).toLocaleString()} loading={counts.loading} />
      </div>

      <QualityFilterBar
        filters={f.filters}
        update={f.update}
        reset={() => {
          f.reset();
          setCriterion("");
          setCommentType("");
          setSearch("");
        }}
        options={f.options}
        onRefresh={() => {
          list.refetch();
          counts.refetch();
          mentors.refetch();
        }}
        loading={list.loading || mentors.loading}
        actions={
          <Button size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
            Export CSV
          </Button>
        }
      >
        <Field label="Criterion">
          <Select value={criterion || ALL} onValueChange={(v) => { f.setPage(0); setCriterion(v === ALL ? "" : v); }}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ALL}>All criteria</SelectItem>
              {(f.options?.criteria ?? []).map((x) => (
                <SelectItem key={x} value={x}>{x}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Comment type">
          <Select value={commentType || ALL} onValueChange={(v) => { f.setPage(0); setCommentType(v === ALL ? "" : v); }}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All comments</SelectItem>
              <SelectItem value="0">Positive</SelectItem>
              <SelectItem value="1">Negative</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Search comment text">
          <Input placeholder="e.g. camera" value={search} onChange={(e) => { f.setPage(0); setSearch(e.target.value); }} />
        </Field>
      </QualityFilterBar>

      <Tabs value={view} onValueChange={(v) => { f.setPage(0); setView(v as "comments" | "mentors"); }}>
        <TabsList>
          <TabsTrigger value="comments">Reviewer comments</TabsTrigger>
          <TabsTrigger value="mentors">Grouped by mentor</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "comments" ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Reviewer comments{" "}
              <span className="text-sm font-normal text-muted-foreground">showing {list.rows.length} of {total.toLocaleString()}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {list.error ? (
              <p className="text-destructive text-sm flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5" /> {list.error}</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Tutor</TableHead>
                        <TableHead>Mentor</TableHead>
                        <TableHead>Criterion</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Comment</TableHead>
                        <TableHead className="text-right">Review score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.loading && list.rows.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading comments…</TableCell></TableRow>
                      ) : list.rows.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No comments match these filters.</TableCell></TableRow>
                      ) : (
                        list.rows.map((r, i) => (
                          <TableRow key={`${r.review_id}-${i}`} className="cursor-pointer" onClick={() => setSelected(r.review_id)}>
                            <TableCell className="whitespace-nowrap text-sm">
                              {r.session_start_at ? new Date(r.session_start_at).toLocaleDateString() : "—"}
                              {r.review_cycle != null && <span className="block text-xs text-muted-foreground">Cycle {r.review_cycle}</span>}
                            </TableCell>
                            <TableCell>
                              {r.tutor_name}
                              <span className="block text-xs text-muted-foreground">{r.tutor_tid} · {r.team_leader ?? "—"}</span>
                            </TableCell>
                            <TableCell className="text-sm">{r.mentor_name ?? "—"}</TableCell>
                            <TableCell className="text-sm">
                              {r.parent_name ?? "—"}
                              {r.criterion_name && r.criterion_name !== r.parent_name && (
                                <span className="block text-xs text-muted-foreground">{r.criterion_name}</span>
                              )}
                            </TableCell>
                            <TableCell><TypeBadge type={r.comment_type} source={r.source} /></TableCell>
                            <TableCell className="text-sm max-w-[380px] whitespace-pre-wrap">{r.body}</TableCell>
                            <TableCell className="text-right font-medium">{r.score != null ? Number(r.score).toFixed(2) : "—"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between pt-3 text-sm">
                  <span className="text-muted-foreground">Page {f.page + 1} of {pages}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={f.page === 0 || list.loading} onClick={() => f.setPage(f.page - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" disabled={f.page + 1 >= pages || list.loading} onClick={() => f.setPage(f.page + 1)}>Next</Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Comments grouped by mentor</CardTitle>
          </CardHeader>
          <CardContent>
            {mentors.error ? (
              <p className="text-destructive text-sm flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5" /> {mentors.error}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mentor</TableHead>
                      <TableHead className="text-right">Tutors</TableHead>
                      <TableHead className="text-right">Reviews</TableHead>
                      <TableHead className="text-right">Avg score</TableHead>
                      <TableHead className="text-right">Positive</TableHead>
                      <TableHead className="text-right">Negative</TableHead>
                      <TableHead className="text-right">Written</TableHead>
                      <TableHead className="text-right">Negative share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mentors.loading && mentors.rows.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                    ) : mentors.rows.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No mentors match these filters.</TableCell></TableRow>
                    ) : (
                      mentors.rows.map((m) => {
                        const tagged = m.positive + m.negative;
                        const share = tagged ? Math.round((m.negative / tagged) * 100) : 0;
                        return (
                          <TableRow key={`${m.mentor_name}-${m.mentor_tid ?? ""}`}>
                            <TableCell>
                              {m.mentor_name}
                              {m.mentor_tid && <span className="block text-xs text-muted-foreground">{m.mentor_tid}</span>}
                            </TableCell>
                            <TableCell className="text-right">{m.tutors}</TableCell>
                            <TableCell className="text-right">{m.reviews}</TableCell>
                            <TableCell className="text-right font-medium">{m.avg_score != null ? Number(m.avg_score).toFixed(2) : "—"}</TableCell>
                            <TableCell className="text-right">{m.positive}</TableCell>
                            <TableCell className="text-right">{m.negative}</TableCell>
                            <TableCell className="text-right">{m.written}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={share >= 50 ? "destructive" : share >= 25 ? "outline" : "secondary"}>{share}%</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <QualityReviewDetailDialog reviewId={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
