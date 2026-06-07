import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmailTemplates, type EmailTemplate } from "@/hooks/useEmailTemplates";
import { CATEGORY_LABELS, type ActionPlanCategory } from "@/hooks/useActionPlans";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function EmailTemplatesDialog({ open, onOpenChange }: Props) {
  const { templates, refetch } = useEmailTemplates();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("none");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.template_name);
      setCategory(editing.action_plan_category ?? "none");
      setSubject(editing.subject);
      setBody(editing.body);
      setIsActive(editing.is_active);
    } else {
      setName("");
      setCategory("none");
      setSubject("");
      setBody("");
      setIsActive(true);
    }
  }, [editing, creating]);

  const beginEdit = (t: EmailTemplate) => { setEditing(t); setCreating(false); };
  const beginCreate = () => { setEditing(null); setCreating(true); };
  const cancel = () => { setEditing(null); setCreating(false); };

  const save = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast.error("Name, subject and body are required");
      return;
    }
    setSaving(true);
    const payload = {
      template_name: name.trim(),
      action_plan_category: category === "none" ? null : (category as ActionPlanCategory),
      subject: subject.trim(),
      body: body,
      is_active: isActive,
    };
    const { error } = editing
      ? await supabase.from("email_templates").update(payload as never).eq("id", editing.id)
      : await supabase.from("email_templates").insert(payload as never);
    setSaving(false);
    if (error) {
      toast.error("Save failed", { description: error.message });
      return;
    }
    toast.success(editing ? "Template updated" : "Template created");
    cancel();
    refetch();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    const { error } = await supabase.from("email_templates").delete().eq("id", id);
    if (error) {
      toast.error("Delete failed", { description: error.message });
      return;
    }
    toast.success("Template deleted");
    refetch();
  };

  const isEditing = editing || creating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email Templates</DialogTitle>
        </DialogHeader>

        {!isEditing && (
          <>
            <div className="flex justify-end">
              <Button onClick={beginCreate}><Plus className="w-4 h-4 mr-2" /> New Template</Button>
            </div>
            <div className="space-y-2">
              {templates.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No templates yet.</p>
              )}
              {templates.map((t) => (
                <Card key={t.id}>
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{t.template_name}</p>
                        {t.action_plan_category && (
                          <Badge variant="outline" className="text-xs">
                            {CATEGORY_LABELS[t.action_plan_category]}
                          </Badge>
                        )}
                        {!t.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => beginEdit(t)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => remove(t.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {isEditing && (
          <div className="space-y-3">
            <div>
              <Label>Template Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Action Plan Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category (general)</SelectItem>
                  {(Object.keys(CATEGORY_LABELS) as ActionPlanCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject *</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>Body *</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground mt-1">
                Placeholders: <code>{"{{tutor_name}}"}</code>, <code>{"{{tutor_id}}"}</code>, <code>{"{{team_leader}}"}</code>, <code>{"{{category}}"}</code>, <code>{"{{summary}}"}</code>, <code>{"{{start_date}}"}</code>, <code>{"{{due_date}}"}</code>, <code>{"{{status}}"}</code>, <code>{"{{progress}}"}</code>, <code>{"{{date}}"}</code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Active</Label>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={cancel} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
