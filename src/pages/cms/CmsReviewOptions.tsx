import { useState } from "react";
import { CmsLayout } from "@/components/cms/CmsLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCmsRole } from "@/hooks/useCmsRole";
import {
  REVIEW_TABS,
  useCmsReviewOptions,
  type CmsReviewTab,
  type CmsReviewOptionKind,
  type CmsReviewOption,
} from "@/hooks/useCmsReviewOptions";
import { Navigate } from "react-router-dom";

const KINDS: { value: CmsReviewOptionKind; label: string }[] = [
  { value: "category", label: "Category" },
  { value: "status", label: "Status" },
  { value: "impact", label: "Impact" },
];

export default function CmsReviewOptions() {
  const { isCmsAdmin, loading } = useCmsRole();
  const { options, forTab, create, update, remove } = useCmsReviewOptions();
  const { toast } = useToast();
  const [tab, setTab] = useState<CmsReviewTab>("need_to_improve");
  const [newLabel, setNewLabel] = useState<Record<CmsReviewOptionKind, string>>({
    category: "", status: "", impact: "",
  });
  const [newColor, setNewColor] = useState<Record<CmsReviewOptionKind, string>>({
    category: "#64748b", status: "#16a34a", impact: "#0ea5e9",
  });

  if (loading) return <CmsLayout><div className="p-6">Loading…</div></CmsLayout>;
  if (!isCmsAdmin) return <Navigate to="/cms" replace />;

  const handleAdd = async (kind: CmsReviewOptionKind) => {
    if (!newLabel[kind].trim()) return;
    const list = forTab(tab, kind);
    const res = await create({
      tab,
      kind,
      label: newLabel[kind].trim(),
      color: newColor[kind],
      display_order: (list.at(-1)?.display_order ?? 0) + 1,
      is_active: true,
    });
    if (!res.ok) toast({ title: "Failed", description: res.error, variant: "destructive" });
    else setNewLabel({ ...newLabel, [kind]: "" });
  };

  return (
    <CmsLayout>
      <div className="p-6 space-y-6 max-w-5xl">
        <header>
          <h1 className="text-2xl font-bold">Review Options</h1>
          <p className="text-sm text-muted-foreground">
            Manage the dropdown options (Category, Status, Impact) for the review tabs inside CMS task cards.
          </p>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as CmsReviewTab)}>
          <TabsList>
            {REVIEW_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {REVIEW_TABS.map((t) => (
            <TabsContent key={t.value} value={t.value} className="space-y-4 mt-4">
              {KINDS.map((k) => {
                const list = options
                  .filter((o) => o.tab === t.value && o.kind === k.value)
                  .sort((a, b) => a.display_order - b.display_order);
                return (
                  <Card key={k.value}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{k.label}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Label</TableHead>
                            <TableHead className="w-32">Color</TableHead>
                            <TableHead className="w-24">Order</TableHead>
                            <TableHead className="w-24">Active</TableHead>
                            <TableHead className="w-12" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {list.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-4">
                                No options yet.
                              </TableCell>
                            </TableRow>
                          ) : list.map((o) => (
                            <OptionRow key={o.id} option={o} onUpdate={update} onDelete={remove} />
                          ))}
                        </TableBody>
                      </Table>
                      {/* Add new */}
                      <div className="flex items-end gap-2 pt-2 border-t">
                        <div className="flex-1">
                          <Input
                            placeholder={`New ${k.label.toLowerCase()}…`}
                            value={newLabel[k.value]}
                            onChange={(e) => setNewLabel({ ...newLabel, [k.value]: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && handleAdd(k.value)}
                          />
                        </div>
                        <input
                          type="color"
                          value={newColor[k.value]}
                          onChange={(e) => setNewColor({ ...newColor, [k.value]: e.target.value })}
                          className="h-10 w-12 rounded border cursor-pointer"
                        />
                        <Button onClick={() => handleAdd(k.value)} size="sm">
                          <Plus className="w-4 h-4 mr-1" /> Add
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </CmsLayout>
  );
}

function OptionRow({
  option,
  onUpdate,
  onDelete,
}: {
  option: CmsReviewOption;
  onUpdate: (id: string, patch: Partial<CmsReviewOption>) => Promise<{ ok: boolean; error?: string }>;
  onDelete: (id: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [label, setLabel] = useState(option.label);
  const [order, setOrder] = useState(String(option.display_order));
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: option.color }} />
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => { if (label !== option.label) onUpdate(option.id, { label }); }}
            className="h-8"
          />
        </div>
      </TableCell>
      <TableCell>
        <input
          type="color"
          value={option.color}
          onChange={(e) => onUpdate(option.id, { color: e.target.value })}
          className="h-8 w-14 rounded border cursor-pointer"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          onBlur={() => {
            const n = parseInt(order, 10);
            if (!isNaN(n) && n !== option.display_order) onUpdate(option.id, { display_order: n });
          }}
          className="h-8 w-20"
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={option.is_active}
          onCheckedChange={(v) => onUpdate(option.id, { is_active: v })}
        />
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(option.id)}>
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
