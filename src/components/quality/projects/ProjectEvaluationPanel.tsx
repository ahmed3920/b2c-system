import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EVAL_STATUS_OPTIONS, needsEvidence, statusShortLabel, type EvalStatus } from "@/lib/projectEvaluation";
import { saveEvaluation, type ProjectEvaluation } from "@/hooks/useProjectReviews";
import type { ProjectRow } from "@/hooks/useProjectAudit";

type Props = {
  project: ProjectRow;
  evaluation?: ProjectEvaluation;
  onSaved?: () => void;
};

/** Phase 1 functionality audit: three checks, one status, evidence when needed. */
export function ProjectEvaluationPanel({ project, evaluation, onSaved }: Props) {
  const { toast } = useToast();
  const [access, setAccess] = useState(false);
  const [evidence, setEvidence] = useState(false);
  const [core, setCore] = useState(false);
  const [status, setStatus] = useState<EvalStatus>("fully_working");
  const [note, setNote] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAccess(evaluation?.check_access ?? false);
    setEvidence(evaluation?.check_evidence ?? false);
    setCore(evaluation?.check_core_function ?? false);
    setStatus((evaluation?.status as EvalStatus) ?? "fully_working");
    setNote(evaluation?.note ?? "");
    setEvidenceUrl(evaluation?.evidence_url ?? "");
  }, [evaluation, project.project_id]);

  const submit = async () => {
    if (needsEvidence(status) && (!note.trim() || !evidenceUrl.trim())) {
      toast({
        title: "Evidence required",
        description: "Add a note and a screenshot link for this result.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await saveEvaluation({
        project_id: Number(project.project_id),
        check_access: access,
        check_evidence: evidence,
        check_core_function: core,
        status,
        note: note.trim(),
        evidence_url: evidenceUrl.trim(),
        student_external_id: project.s_id,
        student_name: project.student_name,
        tutor_external_id: project.tutor_tid,
        tutor_name: project.tutor_name,
        team_leader: project.team_leader,
        project_title: project.title,
        project_created_at: project.created_at,
      });
      toast({ title: "Evaluation saved" });
      onSaved?.();
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

  return (
    <div className="rounded-lg border bg-muted/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-medium">Phase 1 functionality audit</p>
        {evaluation && <Badge variant="secondary">{statusShortLabel(evaluation.status)}</Badge>}
      </div>
      {evaluation?.reviewed_by_name && (
        <p className="text-xs text-muted-foreground">
          Last saved by {evaluation.reviewed_by_name} on {new Date(evaluation.updated_at).toLocaleString()}
        </p>
      )}

      <div className="space-y-2 text-sm">
        <label className="flex items-start gap-2">
          <Checkbox checked={access} onCheckedChange={(v) => setAccess(v === true)} />
          <span>Project access and launch: the link opens and the project starts without a fatal error.</span>
        </label>
        <label className="flex items-start gap-2">
          <Checkbox checked={evidence} onCheckedChange={(v) => setEvidence(v === true)} />
          <span>Submission evidence match: title, description and screenshot belong to the opened project.</span>
        </label>
        <label className="flex items-start gap-2">
          <Checkbox checked={core} onCheckedChange={(v) => setCore(v === true)} />
          <span>Core function: the main intended action can be completed.</span>
        </label>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Result</Label>
        <RadioGroup value={status} onValueChange={(v) => setStatus(v as EvalStatus)} className="space-y-1">
          {EVAL_STATUS_OPTIONS.map((o) => (
            <label key={o.value} className="flex items-start gap-2 text-sm">
              <RadioGroupItem value={o.value} className="mt-1" />
              <span>
                <span className="font-medium">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.help}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">
          Note {needsEvidence(status) ? "(required)" : "(optional)"}
        </Label>
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you observe?" />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">
          Screenshot link {needsEvidence(status) ? "(required)" : "(optional)"}
        </Label>
        <Input
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>

      <Button onClick={submit} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save evaluation
      </Button>
    </div>
  );
}
