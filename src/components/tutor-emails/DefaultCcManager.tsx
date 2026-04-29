import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, RotateCcw } from "lucide-react";
import { useDefaultEmailCc } from "@/hooks/useDefaultEmailCc";
import { toast } from "sonner";

interface Props {
  /** Optional extra CC (comma-separated) typed by the user for this single email only. */
  extraCc: string;
  onExtraCcChange: (v: string) => void;
}

/**
 * Manages the persistent default CC recipient list (saved in localStorage)
 * plus an extra one-off CC input for this specific email.
 */
export function DefaultCcManager({ extraCc, onExtraCcChange }: Props) {
  const { list, addEmail, removeEmail, reset } = useDefaultEmailCc();
  const [draft, setDraft] = useState("");

  const onAdd = () => {
    const ok = addEmail(draft);
    if (!ok) {
      toast.error("Enter a valid email address");
      return;
    }
    setDraft("");
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Default CC (auto-added to every email)</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={reset}
          title="Reset to original 4 emails"
        >
          <RotateCcw className="w-3 h-3 mr-1" /> Reset
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {list.length === 0 && (
          <span className="text-xs text-muted-foreground">No default CC.</span>
        )}
        {list.map((e) => (
          <Badge key={e} variant="secondary" className="gap-1 pr-1">
            {e}
            <button
              type="button"
              onClick={() => removeEmail(e)}
              className="rounded-sm hover:bg-destructive/20 p-0.5"
              aria-label={`Remove ${e}`}
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>

      <div className="flex gap-1">
        <Input
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder="Add email to default CC..."
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={onAdd}>
          <Plus className="w-3 h-3 mr-1" /> Add
        </Button>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Extra CC for this email only (optional)</Label>
        <Input
          value={extraCc}
          onChange={(e) => onExtraCcChange(e.target.value)}
          placeholder="manager@example.com, hr@example.com"
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}
