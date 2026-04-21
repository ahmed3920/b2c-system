import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  FileText,
  Download,
  Package,
  CheckCircle2,
  AlertCircle,
  Archive,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { WeeklyPlan } from "@/hooks/useWeeklyStudyPlans";
import {
  generateBulkMentorStudyPlansZip,
  generateMentorStudyPlanPdf,
  generateMentorStudyPlanPreview,
  generateAllMentorPreviews,
  groupPlansByMentor,
  type MentorPdfPreview,
  type MentorPdfReady,
} from "@/utils/exportStudyPlanToPdf";

type RowStatus = "pending" | "in_progress" | "ready" | "error";

interface MentorRow {
  mentor: string;
  tutors: number;
  status: RowStatus;
  fileName?: string;
  url?: string;
  error?: string;
}

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
  const [busyPreviewSingle, setBusyPreviewSingle] = useState(false);
  const [busyPreviewAll, setBusyPreviewAll] = useState(false);
  const [busyBulk, setBusyBulk] = useState(false);

  // Status panel state
  const [rows, setRows] = useState<MentorRow[]>([]);
  const [zipInfo, setZipInfo] = useState<{ fileName: string; url: string } | null>(null);

  // Preview state
  const [previews, setPreviews] = useState<MentorPdfPreview[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const total = rows.length;
  const readyCount = rows.filter((r) => r.status === "ready").length;
  const errorCount = rows.filter((r) => r.status === "error").length;
  const progressPct = total > 0 ? Math.round(((readyCount + errorCount) / total) * 100) : 0;

  // Revoke object URLs when dialog closes
  useEffect(() => {
    if (!open) {
      rows.forEach((r) => r.url && URL.revokeObjectURL(r.url));
      previews.forEach((p) => URL.revokeObjectURL(p.url));
      if (zipInfo?.url) URL.revokeObjectURL(zipInfo.url);
      setRows([]);
      setPreviews([]);
      setPreviewIndex(0);
      setZipInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const clearPreviews = () => {
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    setPreviews([]);
    setPreviewIndex(0);
  };

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

  const handlePreviewSingle = async () => {
    const g = groups.find((x) => x.mentor === selectedMentor);
    if (!g) {
      toast.error("Pick a mentor first");
      return;
    }
    setBusyPreviewSingle(true);
    try {
      clearPreviews();
      const preview = await generateMentorStudyPlanPreview(
        weekStart,
        g.mentor,
        g.plans,
      );
      setPreviews([preview]);
      setPreviewIndex(0);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to build preview");
    } finally {
      setBusyPreviewSingle(false);
    }
  };

  const handlePreviewAll = async () => {
    setBusyPreviewAll(true);
    try {
      clearPreviews();
      const list = await generateAllMentorPreviews(weekStart, plans);
      if (list.length === 0) {
        toast.error("No mentors with planned modules for this week");
        return;
      }
      setPreviews(list);
      setPreviewIndex(0);
      toast.success(
        `Built ${list.length} preview${list.length === 1 ? "" : "s"} \u2014 review before downloading`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to build previews");
    } finally {
      setBusyPreviewAll(false);
    }
  };

  const handleBulk = async () => {
    setBusyBulk(true);
    setZipInfo(null);
    setRows(
      groups.map((g) => ({
        mentor: g.mentor,
        tutors: g.plans.length,
        status: "pending" as RowStatus,
      })),
    );

    try {
      const result = await generateBulkMentorStudyPlansZip(weekStart, plans, {
        onStart: (mentor) => {
          setRows((prev) =>
            prev.map((r) =>
              r.mentor === mentor ? { ...r, status: "in_progress" } : r,
            ),
          );
        },
        onReady: (info: MentorPdfReady) => {
          setRows((prev) =>
            prev.map((r) =>
              r.mentor === info.mentor
                ? {
                    ...r,
                    status: "ready",
                    fileName: info.fileName,
                    url: info.url,
                    tutors: info.tutors,
                  }
                : r,
            ),
          );
        },
        onError: (mentor, error) => {
          setRows((prev) =>
            prev.map((r) =>
              r.mentor === mentor
                ? { ...r, status: "error", error: error.message }
                : r,
            ),
          );
        },
        onZipReady: (fileName, url) => {
          setZipInfo({ fileName, url });
        },
      });
      if (!result) {
        toast.error("No mentors with planned modules for this week");
        return;
      }
      toast.success(
        `Generated ${result.mentors} PDF${result.mentors > 1 ? "s" : ""} \u2014 ${result.fileName}`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate ZIP");
    } finally {
      setBusyBulk(false);
    }
  };

  const StatusIcon = ({ status }: { status: RowStatus }) => {
    if (status === "ready")
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (status === "error")
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    if (status === "in_progress")
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    return <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />;
  };

  const currentPreview = previews[previewIndex];

  const downloadCurrentPreview = () => {
    if (!currentPreview) return;
    const a = document.createElement("a");
    a.href = currentPreview.url;
    a.download = currentPreview.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate study-plan PDFs</DialogTitle>
          <DialogDescription>
            Branded PDFs grouped by mentor for week of <b>{weekStart}</b>.
            Tutors with no planned modules are excluded. Preview before
            downloading.
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
            <div className="flex flex-wrap gap-2">
              <Select value={selectedMentor} onValueChange={setSelectedMentor}>
                <SelectTrigger className="flex-1 min-w-[200px]">
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
                variant="outline"
                onClick={handlePreviewSingle}
                disabled={!selectedMentor || busyPreviewSingle}
              >
                {busyPreviewSingle ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Preview
              </Button>
              <Button
                onClick={handleSingle}
                disabled={!selectedMentor || busySingle}
              >
                {busySingle ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download
              </Button>
            </div>
          </div>

          {/* Bulk */}
          <div className="space-y-2 rounded-md bg-muted/40 p-3">
            <div className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" /> Bulk for all mentors
            </div>
            <p className="text-xs text-muted-foreground">
              Preview every mentor&apos;s PDF first, then download a ZIP
              containing one PDF per mentor.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handlePreviewAll}
                disabled={busyPreviewAll || groups.length === 0}
                className="flex-1"
              >
                {busyPreviewAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Preview all ({groups.length})
              </Button>
              <Button
                variant="default"
                onClick={handleBulk}
                disabled={busyBulk || groups.length === 0}
                className="flex-1"
              >
                {busyBulk ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Package className="h-4 w-4" />
                )}
                {busyBulk
                  ? `Generating… ${readyCount + errorCount}/${total}`
                  : `Download ZIP`}
              </Button>
            </div>
          </div>

          {/* Preview viewer */}
          {currentPreview && (
            <div className="rounded-md border overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Eye className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {currentPreview.mentor}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {currentPreview.fileName} · {currentPreview.tutors} tutor
                      {currentPreview.tutors === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {previews.length > 1 && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setPreviewIndex(
                            (previewIndex - 1 + previews.length) %
                              previews.length,
                          )
                        }
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {previewIndex + 1} / {previews.length}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setPreviewIndex((previewIndex + 1) % previews.length)
                        }
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadCurrentPreview}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearPreviews}
                    aria-label="Close preview"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <iframe
                key={currentPreview.url}
                src={currentPreview.url}
                title={`Preview ${currentPreview.mentor}`}
                className="w-full h-[60vh] bg-muted"
              />
              {previews.length > 1 && (
                <div className="border-t bg-muted/20 px-3 py-2 flex flex-wrap gap-1">
                  {previews.map((p, idx) => (
                    <button
                      key={p.mentor}
                      onClick={() => setPreviewIndex(idx)}
                      className={cn(
                        "rounded-md px-2 py-1 text-xs transition-colors",
                        idx === previewIndex
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-accent",
                      )}
                    >
                      {p.mentor}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Status panel */}
          {rows.length > 0 && (
            <div className="rounded-md border">
              <div className="flex items-center justify-between gap-3 border-b p-3">
                <div className="space-y-1 flex-1">
                  <div className="text-sm font-medium">Generation status</div>
                  <Progress value={progressPct} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    {readyCount} ready · {errorCount} failed · {total} total
                  </div>
                </div>
                {zipInfo && (
                  <a
                    href={zipInfo.url}
                    download={zipInfo.fileName}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Re-download ZIP
                  </a>
                )}
              </div>

              <ScrollArea className="max-h-72">
                <ul className="divide-y">
                  {rows.map((r) => (
                    <li
                      key={r.mentor}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <StatusIcon status={r.status} />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.mentor}</div>
                          <div
                            className={cn(
                              "text-xs truncate",
                              r.status === "error"
                                ? "text-destructive"
                                : "text-muted-foreground",
                            )}
                          >
                            {r.status === "error"
                              ? r.error || "Failed"
                              : r.status === "ready"
                                ? r.fileName
                                : r.status === "in_progress"
                                  ? "Generating…"
                                  : `Queued · ${r.tutors} tutor${r.tutors === 1 ? "" : "s"}`}
                          </div>
                        </div>
                      </div>
                      {r.status === "ready" && r.url && r.fileName ? (
                        <a
                          href={r.url}
                          download={r.fileName}
                          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent"
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {r.tutors} tutor{r.tutors === 1 ? "" : "s"}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
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
