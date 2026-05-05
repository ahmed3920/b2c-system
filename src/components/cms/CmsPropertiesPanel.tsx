import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Link as LinkIcon, Type, Hash, CalendarDays, ListChecks, CheckSquare, Percent, User as UserIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CmsPropertyDef, CmsPropertyValue, CmsPropType } from "@/hooks/useCmsTaskProperties";

interface User { user_id: string; full_name: string; active_status: boolean }

const typeIcon: Record<CmsPropType, JSX.Element> = {
  text: <Type className="w-3.5 h-3.5" />,
  number: <Hash className="w-3.5 h-3.5" />,
  select: <ListChecks className="w-3.5 h-3.5" />,
  multi_select: <ListChecks className="w-3.5 h-3.5" />,
  date: <CalendarDays className="w-3.5 h-3.5" />,
  url: <LinkIcon className="w-3.5 h-3.5" />,
  person: <UserIcon className="w-3.5 h-3.5" />,
  checkbox: <CheckSquare className="w-3.5 h-3.5" />,
  percent: <Percent className="w-3.5 h-3.5" />,
};

interface PanelProps {
  defs: CmsPropertyDef[];
  values: CmsPropertyValue[];
  users: User[];
  canEdit: boolean;
  onSetValue: (propId: string, value: unknown) => void;
}

export function CmsPropertiesPanel({ defs, values, users, canEdit, onSetValue }: PanelProps) {
  const valueMap = useMemo(
    () => new Map(values.map((v) => [v.prop_id, v.value])),
    [values],
  );
  const active = defs.filter((d) => d.is_active);

  if (active.length === 0) {
    return <div className="text-xs text-muted-foreground">No custom properties defined.</div>;
  }

  return (
    <div className="space-y-1">
      {active.map((def) => (
        <div key={def.id} className="flex items-start gap-3 min-h-[32px]">
          <div className="flex items-center gap-2 text-muted-foreground text-sm min-w-[180px] pt-1.5">
            <span className="opacity-70">{typeIcon[def.type]}</span>
            <span className="truncate">{def.label}</span>
          </div>
          <div className="flex-1 min-w-0">
            <PropertyEditor
              def={def}
              value={valueMap.get(def.id)}
              users={users}
              canEdit={canEdit}
              onChange={(v) => onSetValue(def.id, v)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PropertyEditor({
  def, value, users, canEdit, onChange,
}: {
  def: CmsPropertyDef;
  value: unknown;
  users: User[];
  canEdit: boolean;
  onChange: (v: unknown) => void;
}) {
  const empty = <span className="text-sm text-muted-foreground">Empty</span>;

  switch (def.type) {
    case "text": {
      return (
        <Input
          defaultValue={(value as string) ?? ""}
          onBlur={(e) => onChange(e.target.value || null)}
          disabled={!canEdit}
          placeholder="Empty"
          className="h-7 border-0 bg-transparent hover:bg-secondary/40 focus-visible:bg-secondary/40 px-2 text-sm"
        />
      );
    }
    case "number":
    case "percent": {
      return (
        <Input
          type="number"
          defaultValue={(value as number) ?? ""}
          onBlur={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          disabled={!canEdit}
          placeholder="Empty"
          className="h-7 border-0 bg-transparent hover:bg-secondary/40 focus-visible:bg-secondary/40 px-2 text-sm w-32"
        />
      );
    }
    case "url": {
      const url = (value as string) ?? "";
      if (!canEdit) {
        return url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate inline-block max-w-full">
            {url}
          </a>
        ) : empty;
      }
      return (
        <Input
          defaultValue={url}
          onBlur={(e) => onChange(e.target.value || null)}
          placeholder="https://…"
          className="h-7 border-0 bg-transparent hover:bg-secondary/40 focus-visible:bg-secondary/40 px-2 text-sm"
        />
      );
    }
    case "date": {
      return (
        <Input
          type="date"
          defaultValue={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={!canEdit}
          className="h-7 w-auto border-0 bg-transparent hover:bg-secondary/40 px-2 text-sm"
        />
      );
    }
    case "checkbox": {
      return (
        <Checkbox
          checked={!!value}
          onCheckedChange={(v) => onChange(!!v)}
          disabled={!canEdit}
        />
      );
    }
    case "select": {
      const v = (value as string) ?? "none";
      return (
        <Select value={v} onValueChange={(nv) => onChange(nv === "none" ? null : nv)} disabled={!canEdit}>
          <SelectTrigger className="h-7 w-auto border-0 bg-secondary/50 hover:bg-secondary text-xs px-2 gap-1">
            <SelectValue placeholder="Empty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Empty</SelectItem>
            {def.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case "multi_select": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <MultiSelect
          options={def.options}
          values={arr}
          canEdit={canEdit}
          onChange={onChange}
        />
      );
    }
    case "person": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      const userMap = new Map(users.map((u) => [u.user_id, u.full_name]));
      return (
        <PersonSelect
          users={users}
          values={arr}
          canEdit={canEdit}
          onChange={onChange}
          userMap={userMap}
        />
      );
    }
  }
}

function MultiSelect({
  options, values, canEdit, onChange,
}: {
  options: { value: string; label: string }[];
  values: string[];
  canEdit: boolean;
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) => {
    const next = values.includes(v) ? values.filter((x) => x !== v) : [...values, v];
    onChange(next);
  };
  return (
    <Popover open={open && canEdit} onOpenChange={(o) => canEdit && setOpen(o)}>
      <PopoverTrigger asChild>
        <button
          disabled={!canEdit}
          className={cn(
            "flex flex-wrap gap-1 items-center min-h-[28px] px-2 py-1 rounded-md text-sm w-full text-left",
            canEdit && "hover:bg-secondary/40",
          )}
        >
          {values.length === 0 ? (
            <span className="text-muted-foreground">Empty</span>
          ) : (
            values.map((v) => {
              const o = options.find((x) => x.value === v);
              return (
                <Badge key={v} variant="outline" className="text-xs">
                  {o?.label ?? v}
                </Badge>
              );
            })
          )}
          {canEdit && <ChevronDown className="w-3 h-3 opacity-40 ml-auto" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No options</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} onSelect={() => toggle(o.value)}>
                  <Checkbox checked={values.includes(o.value)} className="mr-2" />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PersonSelect({
  users, values, canEdit, onChange, userMap,
}: {
  users: User[];
  values: string[];
  canEdit: boolean;
  onChange: (v: string[]) => void;
  userMap: Map<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => {
    onChange(values.includes(id) ? values.filter((v) => v !== id) : [...values, id]);
  };
  return (
    <Popover open={open && canEdit} onOpenChange={(o) => canEdit && setOpen(o)}>
      <PopoverTrigger asChild>
        <button
          disabled={!canEdit}
          className={cn(
            "flex flex-wrap gap-1 items-center min-h-[28px] px-2 py-1 rounded-md text-sm w-full text-left",
            canEdit && "hover:bg-secondary/40",
          )}
        >
          {values.length === 0 ? (
            <span className="text-muted-foreground">Empty</span>
          ) : (
            values.map((id) => (
              <Badge key={id} variant="outline" className="text-xs">
                {userMap.get(id) ?? "Unknown"}
              </Badge>
            ))
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search people…" />
          <CommandList>
            <CommandEmpty>No users</CommandEmpty>
            <CommandGroup>
              {users.filter((u) => u.active_status).map((u) => (
                <CommandItem key={u.user_id} onSelect={() => toggle(u.user_id)}>
                  <Checkbox checked={values.includes(u.user_id)} className="mr-2" />
                  {u.full_name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
