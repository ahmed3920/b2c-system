import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";
import {
  FeaturePlan,
  getVisibleFeaturePlans,
  subscribeFeaturePlans,
} from "@/data/mockFeaturePlans";
import { FeatureStatusBadge } from "./FeatureStatusBadge";
import { FeatureDetailsDialog } from "./FeatureDetailsDialog";

export function ProductUpdatesSection() {
  const { role } = useUserRole();
  const [items, setItems] = useState<FeaturePlan[]>(getVisibleFeaturePlans());
  const [selected, setSelected] = useState<FeaturePlan | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeFeaturePlans(() => setItems(getVisibleFeaturePlans()));
    return () => {
      unsub();
    };
  }, []);

  const visible = items.filter((f) => {
    if (f.visibility === "both") return true;
    if (role === "admin") return true;
    if (role === "team_leader") return f.visibility === "team_leaders";
    return f.visibility === "mentors";
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">What's New</h2>
        <span className="text-sm text-muted-foreground">— Product updates</span>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 flex flex-col items-center justify-center text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No product updates yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.slice(0, 6).map((f) => (
            <Card
              key={f.id}
              className="cursor-pointer transition-all hover:shadow-md hover:border-primary/40"
              onClick={() => {
                setSelected(f);
                setOpen(true);
              }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{f.name}</CardTitle>
                  <FeatureStatusBadge status={f.status} />
                </div>
                <Badge variant="outline" className="w-fit mt-1 text-xs">
                  {f.module}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">{f.description}</p>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{f.progress}%</span>
                  </div>
                  <Progress value={f.progress} className="h-1.5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FeatureDetailsDialog feature={selected} open={open} onOpenChange={setOpen} />
    </section>
  );
}
