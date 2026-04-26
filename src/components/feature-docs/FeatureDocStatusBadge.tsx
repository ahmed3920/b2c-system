import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FeatureDocStatus, STATUS_LABEL, STATUS_STYLE } from "@/data/featureDocumentation";

export function FeatureDocStatusBadge({ status }: { status: FeatureDocStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_STYLE[status])}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
