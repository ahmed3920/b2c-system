import { format, parseISO } from "date-fns";
import { Calendar, Clock, FileText, Film, User, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Training } from "@/hooks/useTrainings";

export function TrainingDetailsDialog({
  training,
  open,
  onOpenChange,
}: {
  training: Training | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!training) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{training.title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Info icon={<Calendar className="h-4 w-4" />} label="Date">
                {format(parseISO(training.training_date), "PPP")}
              </Info>
              <Info icon={<Clock className="h-4 w-4" />} label="Time">
                {training.training_time?.slice(0, 5)}
              </Info>
              <Info icon={<User className="h-4 w-4" />} label="Creator">
                <span className="capitalize">{training.creator_type.replace("_", " ")}</span> ·{" "}
                {training.creator_name}
              </Info>
              <Info icon={<Users className="h-4 w-4" />} label="Team">
                {training.team_leader}
              </Info>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Conducted By</p>
              <div className="flex flex-wrap gap-1.5">
                {training.conducted_by.map((p) => (
                  <Badge key={p.id} variant="secondary">
                    {p.name}
                  </Badge>
                ))}
              </div>
            </div>

            {training.sub_teams.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Sub-Teams</p>
                <div className="flex flex-wrap gap-1.5">
                  {training.sub_teams.map((s) => (
                    <Badge key={s} variant="outline">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            <AttachmentList icon={<FileText className="h-4 w-4" />} label="Materials" items={training.material_urls} />
            <AttachmentList icon={<Film className="h-4 w-4" />} label="Records" items={training.record_urls} />

            {training.notes && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="whitespace-pre-wrap">{training.notes}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Info({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground flex items-center gap-1">{icon} {label}</p>
      <p className="font-medium">{children}</p>
    </div>
  );
}

function AttachmentList({
  icon,
  label,
  items,
}: {
  icon: React.ReactNode;
  label: string;
  items: { name: string; url: string; type: string }[];
}) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
        {icon} {label}
      </p>
      <ul className="space-y-1">
        {items.map((a, i) => (
          <li key={i} className="rounded border px-2 py-1 flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
            <a href={a.url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex-1">
              {a.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
