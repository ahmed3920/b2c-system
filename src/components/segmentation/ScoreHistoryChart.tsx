import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Loader2 } from "lucide-react";

interface Props {
  tutorExternalId: string;
}

export function ScoreHistoryChart({ tutorExternalId }: Props) {
  const [data, setData] = useState<{ date: string; health: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("tutor_segmentation_scores" as any)
        .select("snapshot_date, health_score")
        .eq("tutor_external_id", tutorExternalId)
        .order("snapshot_date", { ascending: false })
        .limit(12);
      const rows = ((data as any[]) ?? [])
        .map((r) => ({ date: String(r.snapshot_date).slice(5), health: Number(r.health_score) }))
        .reverse();
      setData(rows);
      setLoading(false);
    })();
  }, [tutorExternalId]);

  if (loading) return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading history…</div>;
  if (data.length < 2) return <div className="text-xs text-muted-foreground">Not enough history yet.</div>;

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={30} />
          <Tooltip />
          <Line type="monotone" dataKey="health" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
