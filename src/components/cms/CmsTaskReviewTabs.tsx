import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertCircle, ThumbsUp, Palette } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  REVIEW_TABS,
  useCmsReviewOptions,
  type CmsReviewTab,
  type CmsReviewOption,
  type CmsReviewOptionKind,
} from "@/hooks/useCmsReviewOptions";
import { useCmsTaskReviewRows, type CmsTaskReviewRow } from "@/hooks/useCmsTaskReviewRows";

const TAB_ICONS: Record<CmsReviewTab, JSX.Element> = {
  need_to_improve: <AlertCircle className="w-4 h-4" />,
  positive_comments: <ThumbsUp className="w-4 h-4" />,
  design: <Palette className="w-4 h-4" />,
};

interface Props {
  taskId: string;
  canEdit: boolean;
}

export function CmsTaskReviewTabs({ taskId, canEdit }: Props) {
  const [active, setActive] = useState<CmsReviewTab>("need_to_improve");
  const { options, forTab } = useCmsReviewOptions();
  const { rows, add, update, remove } = useCmsTaskReviewRows(taskId);
  const { toast } = useToast();

  const optionsById = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  const tabRows = rows.filter((r) => r.tab === active);

  const handleAdd = async () => {
    const res = await add(active);
    if (!res.ok) toast({ title: "Failed", description: res.error, variant: "destructive" });
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {REVIEW_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setActive(t.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors",
              active === t.value
                ? "bg-secondary border-border font-medium"
                : "bg-transparent border-transparent hover:bg-secondary/50 text-muted-foreground",
            )}
          >
            {TAB_ICONS[t.value]}
            {t.label}
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {rows.filter((r) => r.tab === t.value).length}
            </Badge>
          </button>
        ))}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16"># Attempt</TableHead>
              <TableHead className="min-w-[260px]">Note</TableHead>
              <TableHead className="w-[160px]">Category</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[140px]">Impact</TableHead>
              <TableHead className="min-w-[180px]">Deliverable File</TableHead>
              {canEdit && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tabRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 7 : 6} className="text-center text-muted-foreground py-6 text-sm">
                  No rows yet.
                </TableCell>
              </TableRow>
            ) : (
              tabRows.map((row) => (
                <ReviewRow
                  key={row.id}
                  row={row}
                  canEdit={canEdit}
                  options={options}
                  forTab={forTab}
                  optionsById={optionsById}
                  onUpdate={(patch) => update(row.id, patch)}
                  onDelete={() => remove(row.id)}
                />
              ))
            )}
          </TableBody>
        </Table>
        {canEdit && (
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" onClick={handleAdd} className="w-full justify-start text-muted-foreground">
              <Plus className="w-4 h-4 mr-1" /> Add row
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

interface RowProps {
  row: CmsTaskReviewRow;
  canEdit: boolean;
  options: CmsReviewOption[];
  forTab: (tab: CmsReviewTab, kind: CmsReviewOptionKind) => CmsReviewOption[];
  optionsById: Map<string, CmsReviewOption>;
  onUpdate: (patch: Partial<CmsTaskReviewRow>) => void;
  onDelete: () => void;
}

function ReviewRow({ row, canEdit, forTab, optionsById, onUpdate, onDelete }: RowProps) {
  const [note, setNote] = useState(row.note);
  const [url, setUrl] = useState(row.deliverable_url ?? "");
  const [attempt, setAttempt] = useState(String(row.attempt));

  const renderPicker = (
    kind: CmsReviewOptionKind,
    valueId: string | null,
    onChange: (id: string | null) => void,
  ) => {
    const opts = forTab(row.tab, kind);
    const selected = valueId ? optionsById.get(valueId) : null;
    return (
      <Select
        value={valueId ?? "none"}
        onValueChange={(v) => onChange(v === "none" ? null : v)}
        disabled={!canEdit}
      >
        <SelectTrigger className="h-7 text-xs px-2 border-0 bg-secondary/40 hover:bg-secondary">
          {selected ? (
            <span
              className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${selected.color}20`, color: selected.color }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: selected.color }} />
              {selected.label}
            </span>
          ) : (
            <SelectValue placeholder="—" />
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">—</SelectItem>
          {opts.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.color }} />
                {o.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <TableRow>
      <TableCell>
        <Input
          type="number"
          min={1}
          value={attempt}
          onChange={(e) => setAttempt(e.target.value)}
          onBlur={() => {
            const n = parseInt(attempt, 10);
            if (!isNaN(n) && n !== row.attempt) onUpdate({ attempt: n });
          }}
          disabled={!canEdit}
          className="h-7 w-14 text-sm px-2"
        />
      </TableCell>
      <TableCell>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => { if (note !== row.note) onUpdate({ note }); }}
          disabled={!canEdit}
          placeholder="Describe the item…"
          className="h-7 text-sm border-0 bg-transparent hover:bg-secondary/40 focus-visible:bg-secondary/40 px-2"
        />
      </TableCell>
      <TableCell>{renderPicker("category", row.category_id, (id) => onUpdate({ category_id: id }))}</TableCell>
      <TableCell>{renderPicker("status", row.status_id, (id) => onUpdate({ status_id: id }))}</TableCell>
      <TableCell>{renderPicker("impact", row.impact_id, (id) => onUpdate({ impact_id: id }))}</TableCell>
      <TableCell>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => { if (url !== (row.deliverable_url ?? "")) onUpdate({ deliverable_url: url || null }); }}
          disabled={!canEdit}
          placeholder="https://…"
          className="h-7 text-sm border-0 bg-transparent hover:bg-secondary/40 focus-visible:bg-secondary/40 px-2"
        />
      </TableCell>
      {canEdit && (
        <TableCell>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete} title="Delete row">
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}
