import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import type { VisionTag } from "@/hooks/useVisionBoard";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: VisionTag[];
}

export function VisionTagsDialog({ open, onOpenChange, tags }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#056eec");

  const addTag = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("vision_board_tags").insert({
      name: name.trim(),
      color,
      display_order: tags.length + 1,
    });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      setName("");
      toast({ title: "Tag added" });
    }
  };

  const deleteTag = async (id: string) => {
    const { error } = await supabase.from("vision_board_tags").delete().eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">New tag name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing" />
            </div>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-12 rounded border cursor-pointer"
            />
            <Button onClick={addTag} size="icon"><Plus className="h-4 w-4" /></Button>
          </div>

          <div className="space-y-1">
            {tags.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-card">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="text-sm font-medium">{t.name}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteTag(t.id)} className="h-7 w-7">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
            {tags.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No tags yet.</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
