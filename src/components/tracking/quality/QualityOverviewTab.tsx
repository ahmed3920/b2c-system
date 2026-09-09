import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useQualityReviews } from "@/hooks/useQualityReviews";
import { useReplicaQuery } from "@/hooks/useReplicaQuery";
import { QualityFilterBar, Kpi } from "./QualityFilterBar";
import { QualityReviewsInsights } from "./QualityReviewsInsights";
import { scorePct } from "@/lib/qualityFlags";

type FlagRow = {
  team_leader: string;
  reviews: number;
  red_flags: number;
  yellow_flags: number;
  red_reviews: number;
  yellow_reviews: number;
};

type TutorRow = {
  tutor_tid: string;
  tutor_name: string;
  reviews: number;
  avg_score: string | null;
};

const BANDS = [
  { name: "Below 3", min: 0, max: 3 },
  { name: "3 – 3.5", min: 3, max: 3.5 },
  { name: "3.5 – 4", min: 3.5, max: 4 },
  { name: "4 – 4.5", min: 4, max: 4.5 },
  { name: "4.5 – 5", min: 4.5, max: 5.01 },
];

/** Live overview of the current quality-review system (replica-backed). */
export function QualityOverviewTab() {
  const q = useQualityReviews();
  const flags = useReplicaQuery<FlagRow>("quality_flag_breakdown", q.baseParams);
  const tutors = useReplicaQuery<TutorRow>("quality_by_tutor", q.baseParams);

  const s = q.summary;
  const flagData = flags.rows
    .filter((r) => r.red_flags + r.yellow_flags > 0)
    .map((r) => ({ name: r.team_leader, Red: r.red_flags, Yellow: r.yellow_flags }));

  const distribution = BANDS.map((b) => ({
    name: b.name,
    tutors: tutors.rows.filter((t) => {
      const v = Number(t.avg_score ?? 0);
      return v >= b.min && v < b.max;
    }).length,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Reviews" value={(s?.total ?? 0).toLocaleString()} loading={q.summaryLoading} />
        <Kpi
          label="Average score"
          value={s?.avg_score ? `${Number(s.avg_score).toFixed(2)} / 5` : "—"}
          hint={s?.avg_score ? `${scorePct(s.avg_score)} overall` : undefined}
          loading={q.summaryLoading}
        />
        <Kpi
          label="Red flags"
          value={(s?.red_flagged ?? 0).toLocaleString()}
          hint={`${(s?.yellow_flagged ?? 0).toLocaleString()} yellow-flagged reviews`}
          loading={q.summaryLoading}
        />
        <Kpi
          label="Immediate action"
          value={(s?.needs_immediate_action ?? 0).toLocaleString()}
          hint={`${(s?.pending_objections ?? 0).toLocaleString()} pending objections`}
          loading={q.summaryLoading}
        />
      </div>

      <QualityFilterBar
        filters={q.filters}
        update={q.update}
        reset={q.reset}
        options={q.options}
        onRefresh={q.refetch}
        loading={q.loading}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Flags by team leader</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {flags.loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : flagData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No flags in this selection.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flagData} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" fontSize={11} />
                  <YAxis type="category" dataKey="name" width={140} fontSize={10} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Red" stackId="f" fill="hsl(var(--destructive))" />
                  <Bar dataKey="Yellow" stackId="f" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tutor score distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {tutors.loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="tutors" radius={[4, 4, 0, 0]}>
                    {distribution.map((d, i) => (
                      <Cell
                        key={d.name}
                        fill={i < 2 ? "hsl(var(--destructive))" : i < 4 ? "hsl(var(--warning))" : "hsl(var(--primary))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <QualityReviewsInsights params={q.baseParams} />

      <QualityCoverageByTeamLeaderCard />
    </div>
  );
}
