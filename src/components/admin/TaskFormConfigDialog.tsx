import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, GripVertical, Lock, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskFormField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  field_options: unknown;
  is_required: boolean;
  is_system_field: boolean;
  display_order: number;
  is_active: boolean;
}

interface TaskFormConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fieldTypes = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Text Area" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "number", label: "Number" },
  { value: "url", label: "URL" },
  { value: "file", label: "File Upload" },
];

export function TaskFormConfigDialog({
  open,
  onOpenChange,
}: TaskFormConfigDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fields, setFields] = useState<TaskFormField[]>([]);
  const [newField, setNewField] = useState({
    field_name: "",
    field_label: "",
    field_type: "text",
    is_required: false,
    field_options: "",
  });
  const [showAddField, setShowAddField] = useState(false);

  useEffect(() => {
    if (open) {
      fetchFields();
    }
  }, [open]);

  const fetchFields = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("task_form_fields")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setFields(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load form fields",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleRequired = async (field: TaskFormField) => {
    if (field.is_system_field) return;
    
    try {
      const { error } = await supabase
        .from("task_form_fields")
        .update({ is_required: !field.is_required })
        .eq("id", field.id);

      if (error) throw error;
      
      setFields(fields.map(f => 
        f.id === field.id ? { ...f, is_required: !f.is_required } : f
      ));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update field",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (field: TaskFormField) => {
    if (field.is_system_field) return;
    
    try {
      const { error } = await supabase
        .from("task_form_fields")
        .update({ is_active: !field.is_active })
        .eq("id", field.id);

      if (error) throw error;
      
      setFields(fields.map(f => 
        f.id === field.id ? { ...f, is_active: !f.is_active } : f
      ));
      
      toast({
        title: field.is_active ? "Field Disabled" : "Field Enabled",
        description: `"${field.field_label}" has been ${field.is_active ? "disabled" : "enabled"}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update field",
        variant: "destructive",
      });
    }
  };

  const handleAddField = async () => {
    if (!newField.field_name.trim() || !newField.field_label.trim()) {
      toast({
        title: "Validation Error",
        description: "Field name and label are required",
        variant: "destructive",
      });
      return;
    }

    // Convert field name to snake_case
    const fieldName = newField.field_name
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    setIsSaving(true);
    try {
      let fieldOptions = null;
      if (newField.field_type === "select" && newField.field_options.trim()) {
        fieldOptions = newField.field_options.split(",").map(o => o.trim());
      }

      const { data, error } = await supabase
        .from("task_form_fields")
        .insert({
          field_name: `custom_${fieldName}`,
          field_label: newField.field_label,
          field_type: newField.field_type,
          is_required: newField.is_required,
          is_system_field: false,
          display_order: fields.length + 1,
          is_active: true,
          field_options: fieldOptions,
        })
        .select()
        .single();

      if (error) throw error;

      setFields([...fields, data]);
      setNewField({
        field_name: "",
        field_label: "",
        field_type: "text",
        is_required: false,
        field_options: "",
      });
      setShowAddField(false);
      
      toast({
        title: "Field Added",
        description: `"${newField.field_label}" has been added to the task form`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add field";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteField = async (field: TaskFormField) => {
    if (field.is_system_field) {
      toast({
        title: "Cannot Delete",
        description: "System fields cannot be deleted",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("task_form_fields")
        .delete()
        .eq("id", field.id);

      if (error) throw error;
      
      setFields(fields.filter(f => f.id !== field.id));
      
      toast({
        title: "Field Deleted",
        description: `"${field.field_label}" has been removed`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete field",
        variant: "destructive",
      });
    }
  };

  const handleUpdateLabel = async (field: TaskFormField, newLabel: string) => {
    if (field.is_system_field) return;
    
    try {
      const { error } = await supabase
        .from("task_form_fields")
        .update({ field_label: newLabel })
        .eq("id", field.id);

      if (error) throw error;
      
      setFields(fields.map(f => 
        f.id === field.id ? { ...f, field_label: newLabel } : f
      ));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update field label",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Configure Task Form Fields
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure the fields that appear in the task creation form. System fields cannot be deleted but can be marked as required/optional.
            </p>

            {/* Fields List */}
            <div className="space-y-2">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    field.is_active ? "bg-card" : "bg-muted/50 opacity-60"
                  )}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {field.is_system_field ? (
                        <span className="font-medium text-foreground">{field.field_label}</span>
                      ) : (
                        <Input
                          value={field.field_label}
                          onChange={(e) => handleUpdateLabel(field, e.target.value)}
                          className="h-8 max-w-[200px]"
                        />
                      )}
                      {field.is_system_field && (
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Type: {fieldTypes.find(t => t.value === field.field_type)?.label || field.field_type}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`required-${field.id}`} className="text-xs text-muted-foreground">
                        Required
                      </Label>
                      <Switch
                        id={`required-${field.id}`}
                        checked={field.is_required}
                        onCheckedChange={() => handleToggleRequired(field)}
                        disabled={field.is_system_field}
                      />
                    </div>

                    {!field.is_system_field && (
                      <>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`active-${field.id}`} className="text-xs text-muted-foreground">
                            Active
                          </Label>
                          <Switch
                            id={`active-${field.id}`}
                            checked={field.is_active}
                            onCheckedChange={() => handleToggleActive(field)}
                          />
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteField(field)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Field */}
            {showAddField ? (
              <div className="p-4 border rounded-lg bg-secondary/30 space-y-4">
                <h4 className="font-medium text-foreground">Add New Field</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Field Label *</Label>
                    <Input
                      placeholder="e.g., Attachment"
                      value={newField.field_label}
                      onChange={(e) => setNewField({ 
                        ...newField, 
                        field_label: e.target.value,
                        field_name: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Field Type</Label>
                    <Select
                      value={newField.field_type}
                      onValueChange={(value) => setNewField({ ...newField, field_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {newField.field_type === "select" && (
                  <div className="space-y-2">
                    <Label>Options (comma-separated)</Label>
                    <Input
                      placeholder="Option 1, Option 2, Option 3"
                      value={newField.field_options}
                      onChange={(e) => setNewField({ ...newField, field_options: e.target.value })}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch
                    checked={newField.is_required}
                    onCheckedChange={(checked) => setNewField({ ...newField, is_required: checked })}
                  />
                  <Label>Required field</Label>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAddField} disabled={isSaving}>
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Add Field
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddField(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowAddField(true)}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Field
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
