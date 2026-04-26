import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, CalendarDays, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  useAddOfficialHoliday,
  useDeleteOfficialHoliday,
  useOfficialHolidays,
} from "@/hooks/useOfficialHolidays";

export function OfficialHolidaysCard() {
  const { data: holidays = [], isLoading } = useOfficialHolidays();
  const add = useAddOfficialHoliday();
  const del = useDeleteOfficialHoliday();

  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");

  const handleAdd = async () => {
    if (!date) {
      toast.error("Pick a date");
      return;
    }
    try {
      await add.mutateAsync({ holiday_date: date, label: label.trim() || null });
      toast.success("Holiday added");
      setDate("");
      setLabel("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add holiday");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this holiday?")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Holiday removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to remove holiday");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Official holidays
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Each holiday day inside a tutor&apos;s working week subtracts{" "}
            <b>5h</b> from their available study hours when generating the plan.
            Re-run <b>Generate Plan</b> after changes.
          </AlertDescription>
        </Alert>

        <div className="grid gap-2 md:grid-cols-[160px_1fr_auto] items-end">
          <div>
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Label (optional)</Label>
            <Input
              placeholder="e.g. Eid al-Fitr"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <Button onClick={handleAdd} disabled={add.isPending || !date}>
            {add.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : holidays.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            No official holidays defined yet.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {holidays.map((h) => (
              <Badge
                key={h.id}
                variant="secondary"
                className="flex items-center gap-2 py-1.5 px-2.5"
              >
                <span className="font-medium">{h.holiday_date}</span>
                {h.label && (
                  <span className="text-muted-foreground">— {h.label}</span>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(h.id)}
                  className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Remove holiday"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
