import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Announcement, audienceLabel } from "@/data/mockAnnouncements";

interface Props {
  announcement: Announcement;
  onView: (a: Announcement) => void;
}

export function AnnouncementCard({ announcement, onView }: Props) {
  return (
    <Card className="card-hover flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <Badge variant={announcement.priority === "important" ? "destructive" : "secondary"}>
            {announcement.priority === "important" ? "Important" : "Normal"}
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs">
            <Users className="h-3 w-3" />
            {audienceLabel(announcement.audience)}
          </Badge>
        </div>
        <CardTitle className="text-base leading-snug">{announcement.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 gap-3">
        <p className="text-sm text-muted-foreground line-clamp-2">{announcement.description}</p>
        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(announcement.date), "PP")}
          </span>
          <Button size="sm" variant="ghost" onClick={() => onView(announcement)}>
            View Details <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
