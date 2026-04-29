import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { History, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface EditEntry {
  id: string;
  editor_name: string | null;
  previous_note: string;
  new_note: string;
  edited_at: string;
}

interface Props {
  stepId: string;
}

/**
 * Shows the full edit history of an action plan timeline step (update / sent email).
 * Lazy-loads only when the popover is opened.
 */
export function StepEditHistory({ stepId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState<EditEntry[]>([]);
  const [count, setCount] = useState<number | null>(null);

  // Fetch a lightweight count on mount so we can show the badge / hide the button.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count: c } = await supabase
        .from("action_plan_step_edits")
        .select("id", { head: true, count: "exact" })
        .eq("step_id", stepId);
      if (!cancelled) setCount(c ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [stepId]);

  const loadEdits = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("action_plan_step_edits")
      .select("id, editor_name, previous_note, new_note, edited_at")
      .eq("step_id", stepId)
      .order("edited_at", { ascending: false });
    if (!error && data) setEdits(data as EditEntry[]);
    setLoading(false);
  };

  if (count === 0) return null;

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && edits.length === 0) loadEdits();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
          title="View edit history"
        >
          <History className="w-3 h-3" />
          Edited{count && count > 1 ? ` ${count}×` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-[400px] overflow-y-auto p-3" align="end">
        <div className="text-xs font-semibold mb-2 flex items-center gap-1">
          <History className="w-3 h-3" /> Edit history
        </div>
        {loading && (
          <div className="flex items-center justify-center py-4 text-muted-foreground text-xs">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Loading…
          </div>
        )}
        {!loading && edits.length === 0 && (
          <p className="text-xs text-muted-foreground">No edits recorded.</p>
        )}
        {!loading && edits.length > 0 && (
          <ol className="space-y-3">
            {edits.map((e) => (
              <li key={e.id} className="border-l-2 border-primary/30 pl-2">
                <div className="text-[11px] text-muted-foreground flex justify-between gap-2">
                  <span className="font-medium text-foreground truncate">
                    {e.editor_name || "User"}
                  </span>
                  <span>{format(new Date(e.edited_at), "MMM d, yyyy · HH:mm")}</span>
                </div>
                <div className="mt-1 text-[11px]">
                  <p className="text-muted-foreground line-through whitespace-pre-wrap break-words">
                    {e.previous_note}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{e.new_note}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </PopoverContent>
    </Popover>
  );
}
