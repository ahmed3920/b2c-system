import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CmsPropertyDef } from "@/hooks/useCmsTaskProperties";
import type { CmsAssigneeRole } from "@/hooks/useCmsTaskAssignees";

export interface PropertyFilter {
  propId: string;
  value: string; // string match (case-insensitive contains for text, equality for select/checkbox)
}

export interface TaskFilterState {
  search: string;
  assigneeId: string; // 'all' or user_id
  assigneeRole: "all" | CmsAssigneeRole;
  properties: PropertyFilter[];
}

export const emptyFilters: TaskFilterState = {
  search: "",
  assigneeId: "all",
  assigneeRole: "all",
  properties: [],
};

interface Props {
  users: { user_id: string; full_name: string; active_status: boolean }[];
  defs: CmsPropertyDef[];
  filters: TaskFilterState;
  onChange: (f: TaskFilterState) => void;
}

export function CmsTaskFilters({ users, defs, filters, onChange }: Props) {
  const activeDefs = useMemo(() => defs.filter((d) => d.is_active), [defs]);
  const [pickProp, setPickProp] = useState<string>("");

  const setProp = (propId: string, value: string) => {
    const others = filters.properties.filter((p) => p.propId !== propId);
    if (!value) onChange({ ...filters, properties: others });
    else onChange({ ...filters, properties: [...others, { propId, value }] });
  };

  const removeProp = (propId: string) =>
    onChange({ ...filters, properties: filters.properties.filter((p) => p.propId !== propId) });

  const reset = () => onChange(emptyFilters);

  const propMap = useMemo(() => new Map(activeDefs.map((d) => [d.id, d])), [activeDefs]);

  const usableDefs = activeDefs.filter(
    (d) => !filters.properties.find((p) => p.propId === d.id),
  );

  const activeCount =
    (filters.search ? 1 : 0) +
    (filters.assigneeId !== "all" ? 1 : 0) +
    (filters.assigneeRole !== "all" ? 1 : 0) +
    filters.properties.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search title or description…"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="pl-8 h-9"
          />
        </div>

        <Select
          value={filters.assigneeId}
          onValueChange={(v) => onChange({ ...filters, assigneeId: v })}
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            {users.filter((u) => u.active_status).map((u) => (
              <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.assigneeRole}
          onValueChange={(v) => onChange({ ...filters, assigneeRole: v as TaskFilterState["assigneeRole"] })}
        >
          <SelectTrigger className="w-[170px] h-9">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any role</SelectItem>
            <SelectItem value="developer">Developer</SelectItem>
            <SelectItem value="senior_developer">Senior Developer</SelectItem>
            <SelectItem value="reviewer">Reviewer</SelectItem>
            <SelectItem value="team_leader">Team Leader</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <SlidersHorizontal className="w-4 h-4 mr-1" />
              Properties
              {filters.properties.length > 0 && (
                <Badge variant="secondary" className="ml-2">{filters.properties.length}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-3">
              <div className="text-sm font-medium">Filter by property</div>
              {usableDefs.length === 0 ? (
                <p className="text-xs text-muted-foreground">All properties already filtered.</p>
              ) : (
                <Select value={pickProp} onValueChange={(v) => { setPickProp(v); }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select property…" /></SelectTrigger>
                  <SelectContent>
                    {usableDefs.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {pickProp && propMap.get(pickProp) && (
                <PropertyValueInput
                  def={propMap.get(pickProp)!}
                  onSubmit={(v) => { setProp(pickProp, v); setPickProp(""); }}
                />
              )}
            </div>
          </PopoverContent>
        </Popover>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-9" onClick={reset}>
            <X className="w-4 h-4 mr-1" />Clear
          </Button>
        )}
      </div>

      {filters.properties.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.properties.map((p) => {
            const def = propMap.get(p.propId);
            if (!def) return null;
            return (
              <Badge key={p.propId} variant="secondary" className="gap-1 pr-1">
                <span className="text-xs">{def.label}: {p.value}</span>
                <button
                  className="hover:bg-background/40 rounded p-0.5"
                  onClick={() => removeProp(p.propId)}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PropertyValueInput({
  def, onSubmit,
}: { def: CmsPropertyDef; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState("");

  if (def.type === "select" || def.type === "multi_select") {
    return (
      <Select value={value} onValueChange={(v) => { setValue(v); onSubmit(v); }}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Select value…" /></SelectTrigger>
        <SelectContent>
          {def.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (def.type === "checkbox") {
    return (
      <Select value={value} onValueChange={(v) => { setValue(v); onSubmit(v); }}>
        <SelectTrigger className="h-9"><SelectValue placeholder="True / False" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="true">True</SelectItem>
          <SelectItem value="false">False</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter value…"
        type={def.type === "number" || def.type === "percent" ? "number" : def.type === "date" ? "date" : "text"}
        className="h-9"
        onKeyDown={(e) => {
          if (e.key === "Enter" && value) onSubmit(value);
        }}
      />
      <Button size="sm" disabled={!value} onClick={() => onSubmit(value)}>Add</Button>
    </div>
  );
}

// Hook that loads all assignees + property values once for client-side filtering.
export function useCmsTaskFilterIndex() {
  const [assignees, setAssignees] = useState<{ task_id: string; user_id: string; role: CmsAssigneeRole }[]>([]);
  const [propValues, setPropValues] = useState<{ task_id: string; prop_id: string; value: unknown }[]>([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [a, p] = await Promise.all([
        supabase.from("cms_task_assignees").select("task_id,user_id,role"),
        supabase.from("cms_task_property_values").select("task_id,prop_id,value"),
      ]);
      if (cancel) return;
      setAssignees((a.data as never) ?? []);
      setPropValues((p.data as never) ?? []);
    })();
    return () => { cancel = true; };
  }, []);

  return { assignees, propValues };
}

export function applyTaskFilters<T extends { id: string; title: string; description: string | null; assignee_id: string | null }>(
  tasks: T[],
  filters: TaskFilterState,
  index: { assignees: { task_id: string; user_id: string; role: CmsAssigneeRole }[]; propValues: { task_id: string; prop_id: string; value: unknown }[] },
): T[] {
  const q = filters.search.trim().toLowerCase();
  return tasks.filter((t) => {
    if (q && !(t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q))) return false;

    if (filters.assigneeId !== "all" || filters.assigneeRole !== "all") {
      const taskAssignees = index.assignees.filter((a) => a.task_id === t.id);
      // Include legacy single assignee_id when role is 'all'
      const matchUser = filters.assigneeId === "all"
        ? true
        : (t.assignee_id === filters.assigneeId && filters.assigneeRole === "all") ||
          taskAssignees.some((a) => a.user_id === filters.assigneeId &&
            (filters.assigneeRole === "all" || a.role === filters.assigneeRole));
      const matchRoleOnly = filters.assigneeId !== "all"
        ? matchUser
        : taskAssignees.some((a) => filters.assigneeRole === "all" || a.role === filters.assigneeRole);
      if (!matchRoleOnly) return false;
    }

    for (const pf of filters.properties) {
      const v = index.propValues.find((x) => x.task_id === t.id && x.prop_id === pf.propId);
      if (!v) return false;
      const raw = v.value;
      const target = pf.value.toLowerCase();
      let matched = false;
      if (Array.isArray(raw)) matched = raw.some((x) => String(x).toLowerCase() === target);
      else if (typeof raw === "boolean") matched = String(raw) === target;
      else matched = String(raw ?? "").toLowerCase().includes(target);
      if (!matched) return false;
    }

    return true;
  });
}
