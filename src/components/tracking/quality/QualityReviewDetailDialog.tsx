import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ThumbsUp, ThumbsDown, Flag } from "lucide-react";
import { useReplicaQuery } from "@/hooks/useReplicaQuery";
import { statusLabel } from "@/hooks/useQualityReviews";
import { flagBadgeClass, flagLevelLabel, flagTypeLabel, scorePct } from "@/lib/qualityFlags";

type ReviewFlag = {
  id: string;
  flag_type: number | null;
  description: string | null;
  criterion_name: string | null;
  parent_name: string | null;
};

type Detail = Record<string, unknown> & {
  id: string;
  score: string | null;
  status: string | null;
  session_type: string | null;
  session_start_at: string | null;
  submission_date: string | null;
  tutor_tid: string | null;
  tutor_name: string | null;
  team_leader: string | null;
  lesson_name: string | null;
  student_sid: string | null;
  student_feedback: number | null;
  student_feedback_comment: string | null;
  is_student_absent: boolean | null;
  needs_coaching: boolean;
  needs_immediate_action: boolean;
  immediate_action_reason: string | null;
  remarkable_session: boolean;
  has_flags: boolean;
  tutor_join_time: string | null;
  student_join_time: string | null;
};

type Criterion = {
  id: string;
  score: string | null;
  criterion_id: string;
  criterion_name: string | null;
  parent_id: string | null;
  parent_name: string | null;
  comments: string | null;
};

type Comment = {
  id: string;
  body: string | null;
  comment_type: number | null;
  criterion_name: string | null;
  parent_name: string | null;
};

const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString() : "—");

export function QualityReviewDetailDialog({
  reviewId,
  onOpenChange,
}: {
  reviewId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const enabled = !!reviewId;
  const params = { review_id: reviewId };
  const detail = useReplicaQuery<Detail>("quality_review_detail", params, { enabled });
  const criteria = useReplicaQuery<Criterion>("quality_review_criteria", params, { enabled });
  const comments = useReplicaQuery<Comment>("quality_review_comments", params, { enabled });
  const flags = useReplicaQuery<ReviewFlag>("quality_review_flags", params, { enabled });

  const d = detail.rows[0];
  const loading = detail.loading || criteria.loading || comments.loading;

  const groups = new Map<string, Criterion[]>();
  for (const c of criteria.rows) {
    const key = c.parent_name ?? c.criterion_name ?? "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const positives = comments.rows.filter((c) => Number(c.comment_type) === 0);
  const negatives = comments.rows.filter((c) => Number(c.comment_type) === 1);

  return (
    <Dialog open={enabled} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Session review
            {d && (
              <Badge variant="secondary" className="text-base">
                {Number(d.score ?? 0).toFixed(2)} / 5
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && !d ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading review…
          </div>
        ) : detail.error ? (
          <p className="text-destructive text-sm">{detail.error}</p>
        ) : d ? (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              <Info label="Tutor" value={`${d.tutor_name ?? "—"} (${d.tutor_tid ?? "—"})`} />
              <Info label="Team leader" value={d.team_leader ?? "—"} />
              <Info label="Lesson" value={d.lesson_name ?? "—"} />
              <Info label="Student" value={d.student_sid ?? "—"} />
              <Info label="Session date" value={fmt(d.session_start_at)} />
              <Info label="Submitted" value={fmt(d.submission_date)} />
              <Info label="Session type" value={d.session_type ?? "—"} />
              <Info label="Status" value={statusLabel(d.status)} />
              <Info label="Tutor joined" value={fmt(d.tutor_join_time)} />
              <Info label="Student joined" value={fmt(d.student_join_time)} />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {d.needs_immediate_action && <Badge variant="destructive">Immediate action</Badge>}
              {d.needs_coaching && <Badge variant="destructive">Needs coaching</Badge>}
              {d.remarkable_session && <Badge>Remarkable</Badge>}
              {d.is_student_absent && <Badge variant="outline">Student absent</Badge>}
              <Badge variant="outline">{scorePct(d.score)}</Badge>
              {(d.flag_level as string) && d.flag_level !== "none" ? (
                <Badge className={flagBadgeClass(d.flag_level as string)}>
                  {flagLevelLabel(d.flag_level as string)} flag
                </Badge>
              ) : null}
            </div>
            {d.immediate_action_reason ? (
              <p className="text-sm text-destructive">{d.immediate_action_reason}</p>
            ) : null}

            {flags.rows.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Flag className="w-4 h-4" /> Flags ({flags.rows.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {flags.rows.map((f) => (
                    <div key={f.id} className="flex items-start gap-2">
                      <Badge className={flagBadgeClass(Number(f.flag_type) === 2 ? "red" : Number(f.flag_type) === 1 ? "yellow" : "none")}>
                        {flagTypeLabel(f.flag_type)}
                      </Badge>
                      <div>
                        {f.criterion_name ? (
                          <span className="text-xs text-muted-foreground block">
                            {f.parent_name ? `${f.parent_name} · ` : ""}
                            {f.criterion_name}
                          </span>
                        ) : null}
                        <span>{f.description ?? "—"}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}


            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Category scores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[...groups.entries()].map(([parent, items]) => {
                  const scored = items.filter((i) => i.score != null);
                  const avg = scored.length
                    ? scored.reduce((s, i) => s + Number(i.score), 0) / scored.length
                    : null;
                  return (
                    <div key={parent}>
                      <div className="flex items-center justify-between font-medium text-sm">
                        <span>{parent}</span>
                        <span>{avg != null ? `${avg.toFixed(2)} / 5` : "—"}</span>
                      </div>
                      <div className="mt-1 space-y-1">
                        {items.map((i) => (
                          <div
                            key={i.id}
                            className="flex items-start justify-between text-sm text-muted-foreground border-l pl-3"
                          >
                            <span>
                              {i.criterion_name}
                              {i.comments ? (
                                <span className="block text-xs italic">{i.comments}</span>
                              ) : null}
                            </span>
                            <span className="text-foreground">
                              {i.score != null ? Number(i.score).toFixed(1) : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {groups.size === 0 && (
                  <p className="text-sm text-muted-foreground">No criterion scores recorded.</p>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <CommentList title="Positive" icon={<ThumbsUp className="w-4 h-4" />} items={positives} />
              <CommentList
                title="Needs improvement"
                icon={<ThumbsDown className="w-4 h-4" />}
                items={negatives}
              />
            </div>

            {d.student_feedback_comment ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Student feedback {d.student_feedback != null ? `(${d.student_feedback})` : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {d.student_feedback_comment}
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function CommentList({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: Comment[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title} ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {items.length === 0 ? (
          <p className="text-muted-foreground">None.</p>
        ) : (
          items.map((c) => (
            <div key={c.id}>
              {c.criterion_name ? (
                <span className="text-xs text-muted-foreground block">
                  {c.parent_name ? `${c.parent_name} · ` : ""}
                  {c.criterion_name}
                </span>
              ) : null}
              <span>{c.body}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
