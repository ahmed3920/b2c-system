import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FeaturePlan, visibilityLabel } from "@/data/mockFeaturePlans";
import { FeatureStatusBadge } from "./FeatureStatusBadge";
import { format } from "date-fns";
import { Calendar, User, Layers, Eye, Clock } from "lucide-react";

interface Props {
  feature: FeaturePlan | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function FeatureDetailsDialog({ feature, open, onOpenChange }: Props) {
  if (!feature) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            {feature.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <FeatureStatusBadge status={feature.status} />
            <Badge variant="outline">
              <Layers className="h-3 w-3 mr-1" />
              {feature.module}
            </Badge>
            <Badge variant="outline">
              <Eye className="h-3 w-3 mr-1" />
              {visibilityLabel(feature.visibility)}
            </Badge>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-1.5 text-muted-foreground">Description</h3>
            <p className="text-sm leading-relaxed">{feature.description}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-sm font-medium text-muted-foreground">Progress</h3>
              <span className="text-sm font-semibold">{feature.progress}%</span>
            </div>
            <Progress value={feature.progress} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Assigned To</p>
                <p className="font-medium">{feature.assignedTo}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Target Release</p>
                <p className="font-medium">{format(new Date(feature.targetRelease), "PPP")}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Timeline
            </h3>
            <div className="border-l-2 border-border ml-2 space-y-3 pl-4 py-1">
              <div className="relative">
                <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-primary" />
                <p className="text-sm font-medium">Feature created</p>
                <p className="text-xs text-muted-foreground">Initial planning kicked off</p>
              </div>
              {feature.progress > 0 && (
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-blue-500" />
                  <p className="text-sm font-medium">Development started</p>
                  <p className="text-xs text-muted-foreground">Currently at {feature.progress}% complete</p>
                </div>
              )}
              {feature.status === "completed" && (
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-green-500" />
                  <p className="text-sm font-medium">Released</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(feature.targetRelease), "PPP")}
                  </p>
                </div>
              )}
              {feature.status === "blocked" && (
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-destructive" />
                  <p className="text-sm font-medium">Blocked</p>
                  <p className="text-xs text-muted-foreground">Awaiting resolution</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
