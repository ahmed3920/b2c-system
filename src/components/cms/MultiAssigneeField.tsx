import { useState } from "react";
import { Plus, X, User as UserIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { CmsAssigneeRole, CmsTaskAssignee } from "@/hooks/useCmsTaskAssignees";

interface User { user_id: string; full_name: string; active_status: boolean }

interface Props {
  label: string;
  role: CmsAssigneeRole;
  assignees: CmsTaskAssignee[];
  users: User[];
  canEdit: boolean;
  onAdd: (user_id: string, role: CmsAssigneeRole) => void;
  onRemove: (id: string) => void;
}

const colorByRole: Record<CmsAssigneeRole, string> = {
  developer: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-300",
  reviewer: "bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-300",
  senior_developer: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
  team_leader: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
};

export function MultiAssigneeField({
  label, role, assignees, users, canEdit, onAdd, onRemove,
}: Props) {
  const [open, setOpen] = useState(false);
  const filtered = assignees.filter((a) => a.role === role);
  const userMap = new Map(users.map((u) => [u.user_id, u]));
  const available = users.filter(
    (u) => u.active_status && !filtered.some((a) => a.user_id === u.user_id),
  );

  return (
    <div className="flex items-start gap-3 min-h-[32px]">
      <div className="flex items-center gap-2 text-muted-foreground text-sm min-w-[110px] pt-1">
        <UserIcon className="w-4 h-4" />
        <span>{label}</span>
      </div>
      <div className="flex-1 flex flex-wrap items-center gap-1.5">
        {filtered.length === 0 && !canEdit && (
          <span className="text-sm text-muted-foreground">Empty</span>
        )}
        {filtered.map((a) => {
          const u = userMap.get(a.user_id);
          return (
            <Badge
              key={a.id}
              variant="outline"
              className={cn("text-xs gap-1 px-2 py-0.5", colorByRole[role])}
            >
              <span className="w-4 h-4 rounded-full bg-background flex items-center justify-center text-[10px] font-bold">
                {(u?.full_name ?? "?").charAt(0).toUpperCase()}
              </span>
              {u?.full_name ?? "Unknown"}
              {canEdit && (
                <button onClick={() => onRemove(a.id)} className="ml-0.5 opacity-60 hover:opacity-100">
                  <X className="w-3 h-3" />
                </button>
              )}
            </Badge>
          );
        })}
        {canEdit && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground">
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command>
                <CommandInput placeholder={`Add ${label.toLowerCase()}…`} />
                <CommandList>
                  <CommandEmpty>No users.</CommandEmpty>
                  <CommandGroup>
                    {available.map((u) => (
                      <CommandItem
                        key={u.user_id}
                        value={u.full_name}
                        onSelect={() => { onAdd(u.user_id, role); setOpen(false); }}
                      >
                        {u.full_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
