import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Megaphone } from "lucide-react";
import { format } from "date-fns";
import {
  Announcement,
  audienceLabel,
  getAnnouncements,
  removeAnnouncement,
  subscribeAnnouncements,
} from "@/data/mockAnnouncements";
import { AnnouncementFormDialog } from "@/components/announcements/AnnouncementFormDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export default function AnnouncementsAdmin() {
  const { toast } = useToast();
  const [items, setItems] = useState<Announcement[]>(getAnnouncements());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAnnouncements(() => setItems(getAnnouncements()));
    return () => {
      unsub();
    };
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await removeAnnouncement(deletingId);
      toast({ title: "Announcement deleted" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Failed to delete announcement", description: message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppLayout title="Announcements Management" allowedRoles={["admin"]}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-primary" />
              Announcements
            </h1>
            <p className="text-sm text-muted-foreground">
              Create, edit and publish announcements for Team Leaders and Mentors.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Create Announcement
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      No announcements yet. Click "Create Announcement" to add one.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium max-w-[320px] truncate">{a.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{audienceLabel(a.audience)}</Badge>
                      </TableCell>
                      <TableCell>{format(new Date(a.date), "PP")}</TableCell>
                      <TableCell>
                        <Badge variant={a.priority === "important" ? "destructive" : "secondary"}>
                          {a.priority === "important" ? "Important" : "Normal"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={a.status === "published" ? "default" : "outline"}
                          className={a.status === "published" ? "bg-success text-success-foreground hover:bg-success/90" : ""}
                        >
                          {a.status === "published" ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(a)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeletingId(a.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AnnouncementFormDialog open={formOpen} onOpenChange={setFormOpen} announcement={editing} />

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the announcement. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
