import { useState } from "react";
import * as XLSX from "xlsx";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Users, Ticket, Activity, Target, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getMergedRoster } from "@/data/rosterCache";

type Loading = Record<string, boolean>;

function downloadSheet(rows: any[], sheet: string, filename: string) {
  if (!rows.length) {
    rows = [{ note: "No data" }];
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

export default function ExportCenter() {
  const { toast } = useToast();
  const [loading, setLoading] = useState<Loading>({});

  const run = async (key: string, fn: () => Promise<void>) => {
    setLoading((l) => ({ ...l, [key]: true }));
    try {
      await fn();
      toast({ title: "Export ready", description: "File downloaded successfully." });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setLoading((l) => ({ ...l, [key]: false }));
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  const exports = [
    {
      key: "tutors",
      title: "Tutors Roster",
      desc: "Full merged tutor roster including mentor & team leader overrides.",
      icon: <Users className="h-5 w-5" />,
      run: async () => {
        const roster = getMergedRoster();
        downloadSheet(roster, "Tutors", `tutors_${today}.xlsx`);
      },
    },
    {
      key: "cs",
      title: "CS Tickets",
      desc: "All CS tickets with validation status, mentor evaluation, and team leader.",
      icon: <Ticket className="h-5 w-5" />,
      run: async () => {
        const { data, error } = await supabase
          .from("cs_tickets")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        downloadSheet(data ?? [], "CS Tickets", `cs_tickets_${today}.xlsx`);
      },
    },
    {
      key: "live",
      title: "Live Session Issues",
      desc: "All live session cases with EDU validation results.",
      icon: <Activity className="h-5 w-5" />,
      run: async () => {
        const { data, error } = await supabase
          .from("live_session_issues")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        downloadSheet(data ?? [], "Live Issues", `live_issues_${today}.xlsx`);
      },
    },
    {
      key: "incidents",
      title: "Session Incidents",
      desc: "All session incidents reported by tutors with mentor validation.",
      icon: <Activity className="h-5 w-5" />,
      run: async () => {
        const { data, error } = await supabase
          .from("session_incidents")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        downloadSheet(data ?? [], "Incidents", `session_incidents_${today}.xlsx`);
      },
    },
    {
      key: "plans",
      title: "Action Plans",
      desc: "All action plans across categories with progress and evaluation.",
      icon: <Target className="h-5 w-5" />,
      run: async () => {
        const { data, error } = await supabase
          .from("action_plans")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        downloadSheet(data ?? [], "Action Plans", `action_plans_${today}.xlsx`);
      },
    },
  ];

  return (
    <AppLayout title="Export Center" allowedRoles={["admin"]}>
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Export Center</h2>
          <p className="text-sm text-muted-foreground">
            Download Excel exports of the main B2C datasets.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exports.map((x) => (
            <Card key={x.key}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-muted">{x.icon}</div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{x.title}</CardTitle>
                    <CardDescription className="mt-1 text-xs">{x.desc}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  size="sm"
                  disabled={!!loading[x.key]}
                  onClick={() => run(x.key, x.run)}
                >
                  {loading[x.key] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Export {x.title}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
