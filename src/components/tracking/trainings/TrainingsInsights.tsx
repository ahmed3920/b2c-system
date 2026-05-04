import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Training } from "@/hooks/useTrainings";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "#fe7f1b", "#10b981"];

export function TrainingsInsights({ items }: { items: Training[] }) {
  const stats = useMemo(() => {
    const total = items.length;
    const now = new Date();
    const monthKey = format(now, "yyyy-MM");
    const thisMonth = items.filter((t) => t.training_date.startsWith(monthKey)).length;
    const trainerSet = new Set<string>();
    items.forEach((t) => t.conducted_by.forEach((p) => trainerSet.add(p.id)));
    const withMaterial = items.filter((t) => (t.material_urls?.length ?? 0) > 0).length;
    const withRecord = items.filter((t) => (t.record_urls?.length ?? 0) > 0).length;
    return {
      total,
      thisMonth,
      uniqueTrainers: trainerSet.size,
      pctMaterial: total ? Math.round((withMaterial / total) * 100) : 0,
      pctRecord: total ? Math.round((withRecord / total) * 100) : 0,
    };
  }, [items]);

  // Per month (last 12)
  const perMonth = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      map.set(format(d, "yyyy-MM"), 0);
    }
    items.forEach((t) => {
      const k = t.training_date.slice(0, 7);
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([k, v]) => ({
      month: format(parseISO(`${k}-01`), "MMM yy"),
      count: v,
    }));
  }, [items]);

  const perSubTeam = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((t) => {
      const groups = t.sub_teams?.length ? t.sub_teams : ["Whole Team"];
      groups.forEach((g) => map.set(g, (map.get(g) ?? 0) + 1));
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [items]);

  const byCreatorType = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((t) => map.set(t.creator_type, (map.get(t.creator_type) ?? 0) + 1));
    return Array.from(map.entries()).map(([k, v]) => ({
      name: k.replace("_", " "),
      value: v,
    }));
  }, [items]);

  const topTrainers = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((t) =>
      t.conducted_by.forEach((p) => map.set(p.name, (map.get(p.name) ?? 0) + 1)),
    );
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Total Trainings" value={stats.total} />
        <Kpi label="This Month" value={stats.thisMonth} />
        <Kpi label="Unique Trainers" value={stats.uniqueTrainers} />
        <Kpi label="% with Material" value={`${stats.pctMaterial}%`} />
        <Kpi label="% with Record" value={`${stats.pctRecord}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Trainings per Month</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perMonth}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Trainings per Sub-Team</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perSubTeam} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#fe7f1b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">By Creator Type</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCreatorType}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {byCreatorType.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Active Trainers</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTrainers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#056eec" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
