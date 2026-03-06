import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAllTaskCategories, type TaskCategory } from "@/hooks/useTaskCategories";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Pencil, Check, X, Tags } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskCategoryManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roles = [
  { value: "mentor", label: "Mentor" },
  { value: "team_leader", label: "Team Leader" },
  { value: "admin", label: "Admin" },
  { value: "community_moderator", label: "Community Moderator" },
];

export function TaskCategoryManagerDialog({
  open,
  onOpenChange,
}: TaskCategoryManagerDialogProps) {
  const { toast } = useToast();
  const { categories, setCategories, isLoading, refetch } = useAllTaskCategories();
  const [activeTab, setActiveTab] = useState("mentor");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const roleCategories = categories.filter((c) => c.role === activeTab);

  const handleStartEdit = (cat: TaskCategory) => {
    setEditingId(cat.id);
    setEditValue(cat.category_name);
  };

  const handleSaveEdit = async (cat: TaskCategory) => {
    if (!editValue.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("task_categories")
        .update({ category_name: editValue.trim() })
        .eq("id", cat.id);

      if (error) throw error;

      setCategories(
        categories.map((c) =>
          c.id === cat.id ? { ...c, category_name: editValue.trim() } : c
        )
      );
      setEditingId(null);
      toast({ title: "Category updated" });
    } catch {
      toast({ title: "Error", description: "Failed to update category", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (cat: TaskCategory) => {
    try {
      const { error } = await supabase
        .from("task_categories")
        .delete()
        .eq("id", cat.id);

      if (error) throw error;

      setCategories(categories.filter((c) => c.id !== cat.id));
      toast({ title: "Category deleted", description: `"${cat.category_name}" removed from ${activeTab}` });
    } catch {
      toast({ title: "Error", description: "Failed to delete category", variant: "destructive" });
    }
  };

  const handleAdd = async () => {
    if (!newCategoryName.trim()) return;

    setIsSaving(true);
    try {
      const maxOrder = roleCategories.length > 0
        ? Math.max(...roleCategories.map((c) => c.display_order))
        : 0;

      const { data, error } = await supabase
        .from("task_categories")
        .insert({
          role: activeTab,
          category_name: newCategoryName.trim(),
          display_order: maxOrder + 1,
          is_default: false,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setCategories([...categories, data as TaskCategory]);
      setNewCategoryName("");
      setIsAdding(false);
      toast({ title: "Category added", description: `"${newCategoryName.trim()}" added to ${activeTab}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add category";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="w-5 h-5" />
            Manage Task Categories
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              {roles.map((r) => (
                <TabsTrigger key={r.value} value={r.value} className="text-xs">
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {roles.map((r) => (
              <TabsContent key={r.value} value={r.value} className="space-y-3 mt-4">
                <p className="text-sm text-muted-foreground">
                  {roleCategories.length} categories for {r.label} role
                </p>

                <div className="space-y-2">
                  {roleCategories.map((cat, idx) => (
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <span className="text-sm text-muted-foreground w-6 text-center">
                        {idx + 1}
                      </span>

                      {editingId === cat.id ? (
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-8"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(cat);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleSaveEdit(cat)}
                            disabled={isSaving}
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-1 text-sm font-medium">
                            {cat.category_name}
                          </span>
                          {cat.is_default && (
                            <Badge variant="secondary" className="text-xs">
                              Default
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleStartEdit(cat)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(cat)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {isAdding ? (
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-secondary/30">
                    <Input
                      placeholder="New category name..."
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="h-8"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAdd();
                        if (e.key === "Escape") {
                          setIsAdding(false);
                          setNewCategoryName("");
                        }
                      }}
                    />
                    <Button size="sm" onClick={handleAdd} disabled={isSaving}>
                      {isSaving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsAdding(false);
                        setNewCategoryName("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsAdding(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Category
                  </Button>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
