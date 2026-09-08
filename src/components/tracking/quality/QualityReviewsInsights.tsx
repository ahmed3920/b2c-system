import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useReplicaQuery } from "@/hooks/useReplicaQuery";

type CategoryRow = { category: string; avg_score: string | null; evaluations: number };
type TeamRow = { team_leader: string; reviews: number; avg_score: string | null };
type TutorRow = {
  tutor_tid: string;
  tutor_name: string;
  team_leader: string;
  reviews: number;
  avg_score: string | null;
  needs_coaching: number;
};

const color = (v: number) =>
  v >= 4.5 ? "hsl(var(--primary))" : v >= 4 ? "hsl(var(--chart-2, 38 92% 50%))" : "hsl(var(--destructive))";

export function QualityReviewsInsights({ params }: { params: Record<string, unknown> }) {
  const categories = useReplicaQuery<CategoryRow>("quality_category_averages", params);
  const teams = useReplicaQuery<TeamRow>("quality_by_team_leader", params);
  const tutors = useReplicaQuery<TutorRow>("quality_by_tutor", params);

  const catData = categories.rows.map((r) => ({
    name: r.category,
    score: Number(r.avg_score ?? 0),
  }));
  const teamData = teams.rows
    .filter((r) => r.reviews >= 3)
    .map((r) => ({ name: r.team_leader, score: Number(r.avg_score ?? 0), reviews: r.reviews }));
  const lowest = tutors.rows.filter((t) => t.reviews >= 2).slice(0, 15);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Average score by category</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {categories.loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catData} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis domain={[0, 5]} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {catData.map((d) => (
                      <Cell key={d.name} fill={color(d.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Average score by team leader</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {teams.loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamData} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 5]} fontSize={11} />
                  <YAxis type="category" dataKey="name" width={140} fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                    {teamData.map((d) => (
                      <Cell key={d.name} fill={color(d.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lowest scoring tutors</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {tutors.loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : lowest.length === 0 ? (
            <p className="text-muted-foreground">No tutors match these filters.</p>
          ) : (
            <div className="divide-y">
              {lowest.map((t) => (
                <div key={t.tutor_tid} className="flex items-center justify-between py-1.5">
                  <span>
                    {t.tutor_name}{" "}
                    <span className="text-muted-foreground text-xs">
                      {t.tutor_tid} · {t.team_leader}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {t.reviews} reviews ·{" "}
                    <span className="text-foreground font-medium">
                      {Number(t.avg_score ?? 0).toFixed(2)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
