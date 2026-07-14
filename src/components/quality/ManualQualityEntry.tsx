import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onAdded?: () => void;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Simple monthly quality entry: tutor + month number + score.
 * Stores one row per tutor per month in `quality_uploads`.
 */
export const ManualQualityEntry = ({ onAdded }: Props) => {
  const now = new Date();
  const [year, setYear] = useState<string>(String(now.getFullYear()));
  const [month, setMonth] = useState<string>(String(now.getMonth() + 1));
  const [tutorId, setTutorId] = useState("");
  const [score, setScore] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    const id = tutorId.trim();
    const num = parseFloat(score.replace("%", "").trim());
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (!id || Number.isNaN(num)) {
      toast({ title: "Missing data", description: "Tutor ID and Score are required.", variant: "destructive" });
      return;
    }
    if (num < 0 || num > 100) {
      toast({ title: "Invalid score", description: "Score must be between 0 and 100.", variant: "destructive" });
      return;
    }
    if (!m || m < 1 || m > 12 || !y) {
      toast({ title: "Invalid month", description: "Pick a valid month.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in.");
      const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
      const next = new Date(y, m, 1);
      const nextMonthISO = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;

      await supabase
        .from("quality_uploads")
        .delete()
        .eq("uploaded_by", user.id)
        .eq("tutor_id", id)
        .gte("session_date", monthStart)
        .lt("session_date", nextMonthISO);

      const { error } = await supabase.from("quality_uploads").insert({
        tutor_id: id,
        agent_name: id,
        team_leader: "",
        session_date: monthStart,
        score: num,
        uploaded_by: user.id,
        scope: "team",
      });
      if (error) throw error;

      toast({ title: "Quality saved", description: `${id} · ${MONTHS[m - 1]} ${y} · ${num}%` });
      setTutorId("");
      setScore("");
      onAdded?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const currentYear = now.getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <UserPlus className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold">Add Monthly Quality</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Pick a tutor, month and score. Overwrites any prior entry from you for the same tutor and month.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tutor ID *</Label>
              <Input value={tutorId} onChange={(e) => setTutorId(e.target.value)} placeholder="e.g. T-1234" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Month *</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Year *</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Score % *</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="0 - 100"
              />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Save quality
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
