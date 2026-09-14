import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, Eye, GraduationCap, Heart, MessageSquare, PlayCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Decision, ProjectRow } from "@/hooks/useProjectAudit";

type Props = {
  project: ProjectRow | null;
  decision?: Decision;
  onClose: () => void;
  onDecide: (project: ProjectRow, status: "approved" | "rejected", reason: string) => Promise<void>;
};

export function ProjectDetailDialog({ project, decision, onClose, onDecide }: Props) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setReason(decision?.reason ?? "");
  }, [decision, project?.project_id]);

  if (!project) return null;

  const decide = async (status: "approved" | "rejected") => {
    if (status === "rejected" && !reason.trim()) {
      toast({ title: "A reason is required to reject", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await onDecide(project, status, reason.trim());
      toast({ title: status === "approved" ? "Project approved" : "Project rejected" });
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const published = project.created_at ? new Date(project.created_at).toLocaleDateString() : "—";

  return (
    <Dialog open={!!project} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Project</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <GraduationCap className="h-4 w-4" />
            {[project.grade, project.module, project.lesson].filter(Boolean).join(" / ") || "—"}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-4 w-4" />
            Published on {published}
          </span>
          {project.published ? <Badge variant="secondary">Published</Badge> : <Badge variant="outline">Draft</Badge>}
          {project.archived && <Badge variant="destructive">Archived</Badge>}
          {decision && (
            <Badge variant={decision.status === "approved" ? "default" : decision.status === "rejected" ? "destructive" : "outline"}>
              {decision.status}
            </Badge>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">{project.title || "Untitled project"}</h2>
            <div>
              <p className="font-medium">Description:</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{project.description || "—"}</p>
            </div>
            {project.url && (
              <Button asChild variant="outline" className="rounded-full border-2">
                <a href={project.url} target="_blank" rel="noreferrer">
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Watch Code File
                </a>
              </Button>
            )}

            <Separator />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Student</p>
                <p className="font-medium">
                  {project.student_name || "—"} {project.s_id ? `(${project.s_id})` : ""}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Tutor</p>
                <p className="font-medium">
                  {project.tutor_name || "—"} {project.tutor_tid ? `(${project.tutor_tid})` : ""}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Team leader</p>
                <p className="font-medium">{project.team_leader}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Score</p>
                <p className="font-medium">{project.final_score ?? "—"}</p>
              </div>
            </div>

            <div className="flex gap-4 text-sm">
              <span className="inline-flex items-center gap-1">
                <Eye className="h-4 w-4" /> {project.views_count}
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="h-4 w-4" /> {project.likes_count}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="h-4 w-4" /> {project.comments_count}
              </span>
            </div>

            {project.tutor_comment && (
              <div>
                <p className="text-muted-foreground text-sm">Tutor comment</p>
                <p className="text-sm whitespace-pre-wrap">{project.tutor_comment}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="font-medium mb-2">Audit decision</p>
              {decision?.decided_at && (
                <p className="text-xs text-muted-foreground mb-2">
                  {decision.status} by {decision.decided_by_name || "—"} on{" "}
                  {new Date(decision.decided_at).toLocaleString()}
                </p>
              )}
              <Textarea
                placeholder="Reason / notes (required when rejecting)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={5}
              />
              <div className="flex gap-2 mt-3">
                <Button disabled={saving} onClick={() => decide("approved")}>
                  Approve
                </Button>
                <Button disabled={saving} variant="destructive" onClick={() => decide("rejected")}>
                  Reject
                </Button>
              </div>
            </div>

            {project.session_start_at && (
              <p className="text-sm text-muted-foreground">
                Session date: {new Date(project.session_start_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
