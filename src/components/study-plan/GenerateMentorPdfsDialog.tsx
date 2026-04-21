import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, Download, Package } from "lucide-react";
import { toast } from "sonner";
import type { WeeklyPlan } from "@/hooks/useWeeklyStudyPlans";
import {
  generateBulkMentorStudyPlansZip,
  generateMentorStudyPlanPdf,
  groupPlansByMentor,
} from "@/utils/exportStudyPlanToPdf";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  weekStart: string;
  plans: WeeklyPlan[];
}

export function GenerateMentorPdfsDialog({
  open,
  onOpenChange,
  weekStart,
  plans,
}: Props) {
  const groups = useMemo(() => groupPlansByMentor(plans), [plans]);
  const [selectedMentor, setSelectedMentor] = useState<string>("");
  const [busySingle, setBusySingle] = useState(false);
  const [busyBulk, setBusyBulk] = useState(false);

  const handleSingle = async () => {
    const g = groups.find((x) => x.mentor === selectedMentor);
    if (!g) {
      toast.error("Pick a mentor first");
      return;
    }
    setBusySingle(true);
    try {
      await generateMentorStudyPlanPdf(weekStart, g.mentor, g.plans);
      toast.success(`PDF generated for ${g.mentor}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate PDF");
    } finally {
      setBusySingle(false);
    }
  };

  const handleBulk = async () => {
    setBusyBulk(true);
    try {
      const result = await generateBulkMentorStudyPlansZip(weekStart, plans);
      if (!result) {
        toast.error("No mentors with planned modules for this week");
        return;
      }
      toast.success(
        `Generated ${result.mentors} PDF${result.mentors > 1 ? "s" : ""} \u2014 ${result.fileName}`,
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate ZIP");
    } finally {
      setBusyBulk(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate study-plan PDFs</DialogTitle>
          <DialogDescription>
            Branded PDFs grouped by mentor for week of <b>{weekStart}</b>.
            Tutors with no planned modules are excluded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-md border p-3 text-sm flex items-center justify-between">
            <span>
              <b>{groups.length}</b> mentor{groups.length === 1 ? "" : "s"} ·{" "}
              <b>{groups.reduce((s, g) => s + g.plans.length, 0)}</b> tutors with plans
            </span>
          </div>

          {/* Per mentor */}
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" /> Single mentor
            </div>
            <div className="flex gap-2">
              <Select value={selectedMentor} onValueChange={setSelectedMentor}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select mentor" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.mentor} value={g.mentor}>
                      {g.mentor} ({g.plans.length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleSingle}
                disabled={!selectedMentor || busySingle}
              >
                {busySingle ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download PDF
              </Button>
            </div>
          </div>

          {/* Bulk */}
          <div className="space-y-2 rounded-md bg-muted/40 p-3">
            <div className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" /> Bulk for all mentors
            </div>
            <p className="text-xs text-muted-foreground">
              One PDF per mentor packaged into a single ZIP file.
            </p>
            <Button
              variant="default"
              onClick={handleBulk}
              disabled={busyBulk || groups.length === 0}
              className="w-full"
            >
              {busyBulk ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Package className="h-4 w-4" />
              )}
              Generate ZIP for {groups.length} mentor
              {groups.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
