import { useState } from "react";
import { Navigate } from "react-router-dom";
import { CmsLayout } from "@/components/cms/CmsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3 } from "lucide-react";
import { useCmsRole } from "@/hooks/useCmsRole";
import { useCmsAnalytics } from "@/hooks/useCmsAnalytics";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
} from "recharts";

const COLORS = ["hsl(var(--primary))", "#16a34a", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7", "#64748b"];

function fmtHours(h: number): string {
  if (!h) return "0h";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export default function CmsAnalytics() {
  const { isCmsAdmin, isCmsSupervisor, loading: roleLoading } = useCmsRole();
  const [days, setDays] = useState(30);
  const { data, loading } = useCmsAnalytics(days);

  if (roleLoading) {
    return (
      <CmsLayout title="Analytics">
        <div className="p-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </CmsLayout>
    );
  }
  if (!isCmsAdmin && !isCmsSupervisor) return <Navigate to="/cms" replace />;

  return (
    <CmsLayout title="Analytics">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">CMS Analytics</h2>
          </div>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total Tasks" value={data.totalTasks} />
          <KpiCard label="Completed" value={data.byStatus.find((s) => s.name === "done")?.value ?? 0} />
          <KpiCard label="Avg Resolve Time" value={fmtHours(data.avgResolveHours)} />
          <KpiCard label="Median Resolve" value={fmtHours(data.medianResolveHours)} />
          <KpiCard label="Review Entries" value={data.reviewRowsTotal} />
          <KpiCard label="Categories Logged" value={data.reviewCategories.length} />
          <KpiCard label="Active Users" value={`${data.activeUsers} / ${data.totalUsers}`} />
          <KpiCard label="Range" value={`${days}d`} />
        </div>

        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="resolve">Resolve Time</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* TASKS */}
          <TabsContent value="tasks" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Status Breakdown">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={data.byStatus} dataKey="value" nameKey="name" outerRadius={90} label>
                      {data.byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Priority Breakdown">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.byPriority}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <ChartCard title="Tasks Created vs Completed">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data.tasksCreatedTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="created" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" />
                  <Area type="monotone" dataKey="done" stroke="#16a34a" fill="#16a34a33" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </TabsContent>

          {/* RESOLVE */}
          <TabsContent value="resolve" className="space-y-4">
            <ChartCard title="Average Resolve Time by Priority">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.resolveByPriority}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis label={{ value: "Hours", angle: -90, position: "insideLeft" }} />
                  <Tooltip formatter={(v: number) => fmtHours(v)} />
                  <Bar dataKey="avg_hours" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <Card>
              <CardHeader><CardTitle className="text-base">Slowest Tasks (top 15)</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2">Task</th>
                        <th className="text-left px-3 py-2">Priority</th>
                        <th className="text-right px-3 py-2">Resolve Time</th>
                        <th className="text-left px-3 py-2">Created</th>
                        <th className="text-left px-3 py-2">Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.resolveTimes.slice(0, 15).map((r) => (
                        <tr key={r.task_id} className="border-t">
                          <td className="px-3 py-2 font-medium">{r.title}</td>
                          <td className="px-3 py-2 capitalize">{r.priority}</td>
                          <td className="px-3 py-2 text-right">{fmtHours(r.resolve_hours)}</td>
                          <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                          <td className="px-3 py-2">{new Date(r.updated_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {data.resolveTimes.length === 0 && (
                        <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No completed tasks in this range.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REVIEWS */}
          <TabsContent value="reviews" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ChartCard title="Entries per Tab">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={data.reviewByTab} dataKey="value" nameKey="name" outerRadius={80} label>
                      {data.reviewByTab.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
              <ReviewCountCard title="Categories" rows={data.reviewCategories} />
              <ReviewCountCard title="Impact" rows={data.reviewImpacts} />
            </div>
            <ChartCard title="Top Categories">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.reviewCategories.slice(0, 12)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="label" type="category" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {data.reviewCategories.slice(0, 12).map((r, i) => <Cell key={i} fill={r.color || COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Impact Distribution">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.reviewImpacts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {data.reviewImpacts.map((r, i) => <Cell key={i} fill={r.color || COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </TabsContent>

          {/* ATTENDANCE */}
          <TabsContent value="attendance" className="space-y-4">
            <ChartCard title="Attendance Status Trend">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.attendanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present" stackId="a" fill="#16a34a" />
                  <Bar dataKey="late" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="absent" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Average Working Minutes per Day">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.attendanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip formatter={(v: number) => `${v} min`} />
                  <Line type="monotone" dataKey="avg_working_minutes" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </TabsContent>

          {/* ACTIVITY */}
          <TabsContent value="activity" className="space-y-4">
            <ChartCard title="Active vs Idle vs Inactive (minutes/day, all users)">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.activityTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="active_minutes" stackId="1" stroke="#16a34a" fill="#16a34a55" />
                  <Area type="monotone" dataKey="idle_minutes" stackId="1" stroke="#f59e0b" fill="#f59e0b55" />
                  <Area type="monotone" dataKey="inactive_minutes" stackId="1" stroke="#ef4444" fill="#ef444455" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </TabsContent>
        </Tabs>

        {loading && (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        )}
      </div>
    </CmsLayout>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium">{label}</CardTitle></CardHeader>
      <CardContent><div className="text-2xl font-semibold">{value}</div></CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ReviewCountCard({ title, rows }: { title: string; rows: { label: string; color: string; count: number }[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <ul className="space-y-2 max-h-[240px] overflow-y-auto">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <Badge style={{ background: r.color, color: "#fff" }} className="border-0">{r.label}</Badge>
                <span className="text-sm font-semibold">{r.count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
