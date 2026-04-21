import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Announcement, audienceLabel } from "@/data/mockAnnouncements";
import { Calendar, Users } from "lucide-react";

interface Props {
  announcement: Announcement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AnnouncementDetailsDialog({ announcement, open, onOpenChange }: Props) {
  if (!announcement) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={announcement.priority === "important" ? "destructive" : "secondary"}>
              {announcement.priority === "important" ? "Important" : "Normal"}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {audienceLabel(announcement.audience)}
            </Badge>
          </div>
          <DialogTitle className="text-xl">{announcement.title}</DialogTitle>
          <DialogDescription className="flex items-center gap-1 text-xs">
            <Calendar className="h-3 w-3" />
            {format(new Date(announcement.date), "PPP")}
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {announcement.description}
        </div>
      </DialogContent>
    </Dialog>
  );
}
