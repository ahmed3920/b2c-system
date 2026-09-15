import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, Download, Eye, FileText, GraduationCap, Heart, ImageOff, Loader2, MessageSquare, PlayCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { signProjectFiles, useProjectFiles, type ProjectRow } from "@/hooks/useProjectAudit";
import { ProjectEvaluationPanel } from "./ProjectEvaluationPanel";
import { statusShortLabel, type EvalStatus } from "@/lib/projectEvaluation";
import type { ProjectEvaluation } from "@/hooks/useProjectReviews";

type Props = {
  project: ProjectRow | null;
  evaluation?: ProjectEvaluation;
  onClose: () => void;
  onEvaluated?: () => void;
};

export function ProjectDetailDialog({ project, evaluation, onClose, onEvaluated }: Props) {
  const { toast } = useToast();
  const { files, urls, loading: filesLoading, error: filesError } = useProjectFiles(
    project?.project_id ?? null,
  );

  if (!project) return null;


  const images = files.filter((f) => (f.content_type ?? "").startsWith("image/"));
  const cover = images.find((f) => f.kind === "cover") ?? images[0];
  const gallery = images.filter((f) => f.key !== cover?.key);
  const documents = files.filter((f) => !(f.content_type ?? "").startsWith("image/"));
  const codeFile = files.find((f) => f.kind === "file");

  const openFile = async (key: string, download = false) => {
    try {
      const signed = await signProjectFiles([{ project_id: project.project_id, key }], download);
      const link = signed[key]?.url;
      if (!link) throw new Error("File is not available");
      window.open(link, "_blank", "noopener");
    } catch (e) {
      toast({
        title: "Could not open the file",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
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
          {evaluation && <Badge>{statusShortLabel(evaluation.status as EvalStatus)}</Badge>}

        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">{project.title || "Untitled project"}</h2>
            <div>
              <p className="font-medium">Description:</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{project.description || "—"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {codeFile ? (
                <Button
                  variant="outline"
                  className="rounded-full border-2"
                  onClick={() => openFile(codeFile.key)}
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Watch Code File
                </Button>
              ) : project.url ? (
                <Button asChild variant="outline" className="rounded-full border-2">
                  <a href={project.url} target="_blank" rel="noreferrer">
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Watch Code File
                  </a>
                </Button>
              ) : null}
              {documents
                .filter((d) => d.key !== codeFile?.key)
                .map((d) => (
                  <Button key={d.key} variant="outline" size="sm" onClick={() => openFile(d.key, true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    {d.filename}
                  </Button>
                ))}
            </div>

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
            <div className="rounded-lg border overflow-hidden bg-muted/40 aspect-video flex items-center justify-center">
              {filesLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : cover && urls[cover.key] ? (
                <img
                  src={urls[cover.key].url}
                  alt={`${project.title || "Project"} cover`}
                  className="h-full w-full object-cover cursor-zoom-in"
                  loading="lazy"
                  onClick={() => openFile(cover.key)}
                />
              ) : (
                <div className="text-center text-sm text-muted-foreground p-4">
                  <ImageOff className="h-5 w-5 mx-auto mb-2" />
                  {filesError ? filesError : "No preview image"}
                </div>
              )}
            </div>

            {gallery.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {gallery.map((g) =>
                  urls[g.key] ? (
                    <img
                      key={g.key}
                      src={urls[g.key].url}
                      alt={g.filename}
                      className="h-16 w-full object-cover rounded border cursor-zoom-in"
                      loading="lazy"
                      onClick={() => openFile(g.key)}
                    />
                  ) : (
                    <div key={g.key} className="h-16 rounded border bg-muted" />
                  ),
                )}
              </div>
            )}

            {cover && (
              <Button variant="ghost" size="sm" onClick={() => openFile(cover.key, true)}>
                <Download className="h-4 w-4 mr-2" />
                Download cover image
              </Button>
            )}

            <ProjectEvaluationPanel project={project} evaluation={evaluation} onSaved={onEvaluated} />


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
