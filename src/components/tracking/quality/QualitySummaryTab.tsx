import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useQualityFilters, type QualitySummary } from "@/hooks/useQualityReviews";
import { useReplicaQuery } from "@/hooks/useReplicaQuery";
import { QualityFilterBar, Kpi } from "./QualityFilterBar";
import { tutorStatusLabel } from "@/lib/tutorStatus";

type CategoryRow = { category: string; avg_score: string | null; evaluations: number };
type SubRow = { category: string; criterion: string; avg_score: string | null; evaluations: number };
type TeamRow = { team_leader: string; reviews: number; tutors: number; avg_score: string | null; needs_coaching: number; needs_immediate_action: number };
type TutorRow = { tutor_tid: string; tutor_name: string; tutor_status: number | null; team_leader: string; reviews: number; avg_score: string | null; needs_coaching: number };
type Bucket = { bucket: string; reviews: number };
type Tag = { body: string; comment_type: number | null; parent_name: string | null; uses: number };

const color = (v: number) =>
  v >= 4.5 ? "hsl(var(--primary))" : v >= 4 ? "hsl(var(--chart-2, 38 92% 50%))" : "hsl(var(--destructive))";

export function QualitySummaryTab() {
  const f = useQualityFilters();
  const p = f.baseParams;

  const summary = useReplicaQuery<QualitySummary>("quality_reviews_count", p);
  const categories = useReplicaQuery<CategoryRow>("quality_category_averages", p);
  const sub = useReplicaQuery<SubRow>("quality_subcriteria_averages", p);
  const teams = useReplicaQuery<TeamRow>("quality_by_team_leader", p);
  const tutors = useReplicaQuery<TutorRow>("quality_by_tutor", p);
  const dist = useReplicaQuery<Bucket>("quality_score_distribution", p);
  const tags = useReplicaQuery<Tag>("quality_comment_tags", p);

  const s = summary.rows[0];
  const catData = categories.rows.map((r) => ({ name: r.category, score: Number(r.avg_score ?? 0), n: r.evaluations }));
  const distData = dist.rows.map((r) => ({ name: r.bucket, reviews: r.reviews }));
  const ranked = tutors.rows.filter((t) => t.reviews >= 2);
  const lowest = ranked.slice(0, 10);
  const highest = [...ranked].reverse().slice(0, 10);
  const weakest = sub.rows.filter((r) => r.evaluations >= 5).slice().sort((a, b) => Number(a.avg_score ?? 0) - Number(b.avg_score ?? 0)).slice(0, 8);
  const positiveTags = tags.rows.filter((t) => t.comment_type === 0).slice(0, 10);
  const negativeTags = tags.rows.filter((t) => t.comment_type === 1).slice(0, 10);

  const refresh = () => [summary, categories, sub, teams, tutors, dist, tags].forEach((q) => q.refetch());

  return (
    <div className="space-y-4">
      <QualityFilterBar filters={f.filters} update={f.update} reset={f.reset} options={f.options} onRefresh={refresh} loading={summary.loading} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Reviews" value={(s?.total ?? 0).toLocaleString()} loading={summary.loading} hint={`${s?.tutors ?? 0} tutors · ${s?.team_leaders ?? 0} team leaders`} />
        <Kpi label="Average score" value={s?.avg_score ? `${Number(s.avg_score).toFixed(2)} / 5` : "—"} loading={summary.loading} />
        <Kpi label="Needs coaching" value={(s?.needs_coaching ?? 0).toLocaleString()} loading={summary.loading} hint={`${s?.needs_immediate_action ?? 0} immediate action`} />
        <Kpi label="Remarkable sessions" value={(s?.remarkable ?? 0).toLocaleString()} loading={summary.loading} hint={`${s?.flagged ?? 0} flagged · ${s?.pending_objections ?? 0} objections`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Average score by main criterion</CardTitle></CardHeader>
          <CardContent className="h-72">
            {categories.loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catData} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis domain={[0, 5]} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {catData.map((d) => <Cell key={d.name} fill={color(d.score)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Score distribution</CardTitle></CardHeader>
          <CardContent className="h-72">
            {dist.loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distData} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="reviews" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Team leaders</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {teams.loading ? <p className="text-muted-foreground">Loading…</p> : (
              <div className="divide-y">
                {teams.rows.map((t) => (
                  <div key={t.team_leader} className="flex items-center justify-between py-1.5 gap-2">
                    <span className="truncate">{t.team_leader}<span className="text-xs text-muted-foreground"> · {t.tutors} tutors · {t.reviews} reviews</span></span>
                    <span className="flex items-center gap-2 shrink-0">
                      {t.needs_coaching > 0 && <Badge variant="outline">{t.needs_coaching} coaching</Badge>}
                      <span className="font-medium">{t.avg_score != null ? Number(t.avg_score).toFixed(2) : "—"}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Weakest sub-criteria</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {sub.loading ? <p className="text-muted-foreground">Loading…</p> : weakest.length === 0 ? <p className="text-muted-foreground">Not enough evaluations.</p> : (
              <div className="divide-y">
                {weakest.map((r) => (
                  <div key={`${r.category}-${r.criterion}`} className="flex items-center justify-between py-1.5 gap-2">
                    <span className="truncate">{r.criterion}<span className="text-xs text-muted-foreground"> · {r.category} · {r.evaluations} evals</span></span>
                    <span className="font-medium shrink-0">{Number(r.avg_score ?? 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TutorList title="Lowest scoring tutors" rows={lowest} loading={tutors.loading} />
        <TutorList title="Top scoring tutors" rows={highest} loading={tutors.loading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TagList title="Most common positive comments" rows={positiveTags} loading={tags.loading} />
        <TagList title="Most common negative comments" rows={negativeTags} loading={tags.loading} negative />
      </div>
    </div>
  );
}

function TutorList({ title, rows, loading }: { title: string; rows: TutorRow[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="text-sm">
        {loading ? <p className="text-muted-foreground">Loading…</p> : rows.length === 0 ? <p className="text-muted-foreground">No tutors with 2+ reviews.</p> : (
          <div className="divide-y">
            {rows.map((t) => (
              <div key={t.tutor_tid} className="flex items-center justify-between py-1.5 gap-2">
                <span className="truncate">
                  {t.tutor_name}
                  <span className="text-xs text-muted-foreground"> · {t.tutor_tid} · {t.team_leader} · {tutorStatusLabel(t.tutor_status)}</span>
                </span>
                <span className="text-muted-foreground shrink-0">{t.reviews} reviews · <span className="text-foreground font-medium">{Number(t.avg_score ?? 0).toFixed(2)}</span></span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TagList({ title, rows, loading, negative }: { title: string; rows: Tag[]; loading: boolean; negative?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="text-sm">
        {loading ? <p className="text-muted-foreground">Loading…</p> : rows.length === 0 ? <p className="text-muted-foreground">No comments in this range.</p> : (
          <div className="divide-y">
            {rows.map((t, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 gap-2">
                <span className="truncate">{t.body}{t.parent_name && <span className="text-xs text-muted-foreground"> · {t.parent_name}</span>}</span>
                <Badge variant={negative ? "destructive" : "secondary"} className="shrink-0">{t.uses}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
