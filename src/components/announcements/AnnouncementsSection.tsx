import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Announcement,
  getPublishedAnnouncements,
  subscribeAnnouncements,
} from "@/data/mockAnnouncements";
import { AnnouncementCard } from "./AnnouncementCard";
import { AnnouncementDetailsDialog } from "./AnnouncementDetailsDialog";

export function AnnouncementsSection() {
  const { role } = useUserRole();
  const [items, setItems] = useState<Announcement[]>(getPublishedAnnouncements());
  const [selected, setSelected] = useState<Announcement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeAnnouncements(() => setItems(getPublishedAnnouncements()));
    return () => {
      unsub();
    };
  }, []);

  const visible = items.filter((a) => {
    if (a.audience === "both") return true;
    if (role === "team_leader") return a.audience === "team_leaders";
    if (role === "admin") return true;
    return a.audience === "mentors";
  });

  const handleView = (a: Announcement) => {
    setSelected(a);
    setOpen(true);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Announcements</h2>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 flex flex-col items-center justify-center text-center text-muted-foreground">
            <Megaphone className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No announcements yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.slice(0, 6).map((a) => (
            <AnnouncementCard key={a.id} announcement={a} onView={handleView} />
          ))}
        </div>
      )}

      <AnnouncementDetailsDialog announcement={selected} open={open} onOpenChange={setOpen} />
    </section>
  );
}
