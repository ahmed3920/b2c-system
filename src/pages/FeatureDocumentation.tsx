import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  Plus,
  BookOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import {
  FeatureDoc,
  fetchFeatureDocs,
  moduleStats,
} from "@/data/featureDocumentation";
import { FeatureDocCard } from "@/components/feature-docs/FeatureDocCard";
import { FeatureDocEditDialog } from "@/components/feature-docs/FeatureDocEditDialog";
import { toast } from "sonner";

export default function FeatureDocumentation() {
  const { role } = useUserRole();
  const isAdmin = role === "admin";
  const [docs, setDocs] = useState<FeatureDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<FeatureDoc | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setDocs(await fetchFeatureDocs());
    } catch (err) {
      console.error(err);
      toast.error("Failed to load documentation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.feature_name.toLowerCase().includes(q) ||
        d.module.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q),
    );
  }, [docs, search]);

  const grouped = useMemo(() => moduleStats(filtered), [filtered]);
  const totalStats = useMemo(() => {
    return {
      total: docs.length,
      completed: docs.filter((d) => d.status === "completed").length,
      in_progress: docs.filter((d) => d.status === "in_progress").length,
      planned: docs.filter((d) => d.status === "planned").length,
      needs_review: docs.filter((d) => d.status === "needs_review").length,
    };
  }, [docs]);
  const completionPct = totalStats.total
    ? Math.round((totalStats.completed / totalStats.total) * 100)
    : 0;

  const recentlyUpdated = useMemo(
    () =>
      [...docs]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5),
    [docs],
  );
  const lastUpdated = recentlyUpdated[0]?.updated_at;

  const openCreate = () => {
    setEditingDoc(null);
    setEditOpen(true);
  };
  const openEdit = (doc: FeatureDoc) => {
    setEditingDoc(doc);
    setEditOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              System Documentation
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {lastUpdated
                ? `Last updated ${new Date(lastUpdated).toLocaleString()}`
                : "No updates yet"}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Documentation
            </Button>
          )}
        </div>

        {/* System Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Total"
            value={totalStats.total}
            icon={<BookOpen className="h-4 w-4" />}
            tone="default"
          />
          <KpiCard
            label="Completed"
            value={totalStats.completed}
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="green"
          />
          <KpiCard
            label="In Progress"
            value={totalStats.in_progress}
            icon={<Clock className="h-4 w-4" />}
            tone="blue"
          />
          <KpiCard
            label="Planned"
            value={totalStats.planned}
            icon={<Sparkles className="h-4 w-4" />}
            tone="amber"
          />
          <KpiCard
            label="Needs Review"
            value={totalStats.needs_review}
            icon={<AlertCircle className="h-4 w-4" />}
            tone="muted"
          />
        </div>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">Overall completion</span>
                <span className="text-sm text-muted-foreground">{completionPct}%</span>
              </div>
              <Progress value={completionPct} />
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by feature name, module, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Recently updated */}
        {!search && recentlyUpdated.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">What's New</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentlyUpdated.map((d) => (
                  <a
                    key={d.id}
                    href={`#feature-${d.id}`}
                    className="rounded-full border bg-background px-3 py-1 text-xs hover:bg-muted transition-colors"
                  >
                    {d.feature_name}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Module navigation */}
        {grouped.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {grouped.map((g) => (
              <a
                key={g.module}
                href={`#module-${g.module.replace(/\s+/g, "-")}`}
                className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              >
                {g.module}
                <span className="ml-1.5 text-muted-foreground">({g.total})</span>
              </a>
            ))}
          </div>
        )}

        {/* Module sections */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading documentation...</p>
        ) : grouped.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No documentation matches your search.
            </CardContent>
          </Card>
        ) : (
          grouped.map((g) => {
            const pct = g.total ? Math.round((g.completed / g.total) * 100) : 0;
            return (
              <section
                key={g.module}
                id={`module-${g.module.replace(/\s+/g, "-")}`}
                className="space-y-3 scroll-mt-20"
              >
                <div className="flex items-end justify-between gap-3 border-b pb-2">
                  <div>
                    <h2 className="text-lg font-semibold">{g.module}</h2>
                    <p className="text-xs text-muted-foreground">
                      {g.total} feature{g.total !== 1 ? "s" : ""} • {g.completed} completed •{" "}
                      {g.in_progress} in progress
                    </p>
                  </div>
                  <div className="flex items-center gap-2 min-w-[160px]">
                    <Progress value={pct} className="h-2" />
                    <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {g.items.map((d) => (
                    <div key={d.id} id={`feature-${d.id}`} className="scroll-mt-20">
                      <FeatureDocCard
                        doc={d}
                        isAdmin={isAdmin}
                        onEdit={() => openEdit(d)}
                        onChanged={load}
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>

      <FeatureDocEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        doc={editingDoc}
        onSaved={load}
      />
    </AppLayout>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "default" | "green" | "blue" | "amber" | "muted";
}) {
  const toneClasses = {
    default: "text-foreground",
    green: "text-green-600 dark:text-green-400",
    blue: "text-blue-600 dark:text-blue-400",
    amber: "text-amber-600 dark:text-amber-400",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`flex items-center gap-2 text-xs ${toneClasses}`}>
          {icon}
          <span className="font-medium uppercase tracking-wide">{label}</span>
        </div>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
