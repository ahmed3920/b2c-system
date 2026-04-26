import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  Announcement,
  AnnouncementAudience,
  AnnouncementPriority,
  addAnnouncement,
  updateAnnouncement,
} from "@/data/mockAnnouncements";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement?: Announcement | null;
}

export function AnnouncementFormDialog({ open, onOpenChange, announcement }: Props) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("both");
  const [priority, setPriority] = useState<AnnouncementPriority>("normal");
  const [date, setDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (open) {
      setTitle(announcement?.title ?? "");
      setDescription(announcement?.description ?? "");
      setAudience(announcement?.audience ?? "both");
      setPriority(announcement?.priority ?? "normal");
      setDate(announcement ? new Date(announcement.date) : new Date());
    }
  }, [open, announcement]);

  const handleSubmit = async (status: "published" | "draft") => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!date) {
      toast({ title: "Date is required", variant: "destructive" });
      return;
    }
    const payload = {
      title: title.trim(),
      description: description.trim(),
      audience,
      priority,
      date: date.toISOString(),
      status,
    };
    const wasPublished = announcement?.status === "published";
    try {
      if (announcement) {
        await updateAnnouncement(announcement.id, payload);
      } else {
        await addAnnouncement(payload);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Failed to save announcement", description: message, variant: "destructive" });
      return;
    }

    // Send notifications when publishing (newly published only)
    if (status === "published" && !wasPublished) {
      try {
        const { error } = await supabase.rpc("broadcast_announcement_notification", {
          _title: payload.title,
          _audience: payload.audience,
          _priority: payload.priority,
        });
        if (error) throw error;
        toast({ title: "Announcement published", description: "Recipients have been notified." });
      } catch (e) {
        console.error("Failed to send announcement notifications", e);
        toast({
          title: "Published, but notifications failed",
          description: "The announcement was saved but recipients were not notified.",
          variant: "destructive",
        });
      }
    } else {
      toast({ title: status === "published" ? "Announcement updated" : "Draft saved" });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{announcement ? "Edit Announcement" : "Create Announcement"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ann-title">Title</Label>
            <Input
              id="ann-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New Session Logging Guidelines"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ann-desc">Description</Label>
            <Textarea
              id="ann-desc"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write the announcement content..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Audience</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as AnnouncementAudience)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="team_leaders">Team Leaders</SelectItem>
                  <SelectItem value="mentors">Mentors</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as AnnouncementPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="important">Important</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleSubmit("draft")}>Save Draft</Button>
          <Button onClick={() => handleSubmit("published")}>Publish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
