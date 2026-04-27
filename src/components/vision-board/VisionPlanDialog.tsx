import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Loader2, Trash2 } from "lucide-react";
import { STATUS_LABELS, URGENCY_COLUMNS, type VisionPlan, type VisionTag, type VisionStatus, type VisionUrgency } from "@/hooks/useVisionBoard";

interface AdminUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: VisionPlan | null;
  defaultUrgency?: VisionUrgency;
  tags: VisionTag[];
  adminUsers: AdminUser[];
}

export function VisionPlanDialog({ open, onOpenChange, plan, defaultUrgency, tags, adminUsers }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<VisionStatus>("not_started");
  const [urgency, setUrgency] = useState<VisionUrgency>("medium");
  const [ownerMode, setOwnerMode] = useState<"user" | "text">("user");
  const [ownerUserId, setOwnerUserId] = useState<string>("none");
  const [ownerName, setOwnerName] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      if (plan) {
        setTitle(plan.title);
        setDescription(plan.description ?? "");
        setStatus(plan.status);
        setUrgency(plan.urgency);
        setOwnerUserId(plan.owner_user_id ?? "none");
        setOwnerName(plan.owner_name ?? "");
        setOwnerMode(plan.owner_user_id ? "user" : (plan.owner_name ? "text" : "user"));
        setDeadline(plan.deadline ?? "");
        setSelectedTags(plan.tags ?? []);
      } else {
        setTitle("");
        setDescription("");
        setStatus("not_started");
        setUrgency(defaultUrgency ?? "medium");
        setOwnerMode("user");
        setOwnerUserId("none");
        setOwnerName("");
        setDeadline("");
        setSelectedTags([]);
      }
    }
  }, [open, plan, defaultUrgency]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      title: title.trim(),
      description: description.trim(),
      status,
      urgency,
      owner_user_id: ownerMode === "user" && ownerUserId !== "none" ? ownerUserId : null,
      owner_name: ownerMode === "text" ? ownerName.trim() || null : null,
      deadline: deadline || null,
      tags: selectedTags,
    };
    const res = plan
      ? await supabase.from("vision_board_plans").update(payload).eq("id", plan.id)
      : await supabase.from("vision_board_plans").insert({ ...payload, created_by: user?.id });
    setSaving(false);
    if (res.error) {
      toast({ title: "Save failed", description: res.error.message, variant: "destructive" });
    } else {
      toast({ title: plan ? "Plan updated" : "Plan created" });
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (!plan) return;
    if (!confirm("Delete this plan? This cannot be undone.")) return;
    const { error } = await supabase.from("vision_board_plans").delete().eq("id", plan.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Plan deleted" });
      onOpenChange(false);
    }
  };

  const toggleTag = (name: string) => {
    setSelectedTags((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? "Edit Plan" : "New Vision Plan"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Strategic plan title" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What is this plan about?" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={(v) => setUrgency(v as VisionUrgency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {URGENCY_COLUMNS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as VisionStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Owner</Label>
            <div className="flex gap-2 mb-2">
              <Button type="button" size="sm" variant={ownerMode === "user" ? "default" : "outline"} onClick={() => setOwnerMode("user")}>From users</Button>
              <Button type="button" size="sm" variant={ownerMode === "text" ? "default" : "outline"} onClick={() => setOwnerMode("text")}>Free text</Button>
            </div>
            {ownerMode === "user" ? (
              <Select value={ownerUserId} onValueChange={setOwnerUserId}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {adminUsers.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Owner name" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Deadline</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const active = selectedTags.includes(tag.name);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.name)}
                    className="rounded-full px-3 py-1 text-xs font-medium border transition-colors"
                    style={
                      active
                        ? { backgroundColor: tag.color, color: "white", borderColor: tag.color }
                        : { borderColor: tag.color, color: tag.color }
                    }
                  >
                    {tag.name}
                    {active && <X className="inline h-3 w-3 ml-1" />}
                  </button>
                );
              })}
              {tags.length === 0 && <p className="text-xs text-muted-foreground">No tags configured. Add some via "Manage Tags".</p>}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          {plan ? (
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {plan ? "Save" : "Create"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
