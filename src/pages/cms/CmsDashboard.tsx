import { useEffect, useState } from "react";
import { CmsLayout } from "@/components/cms/CmsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CmsCheckinCard } from "@/components/cms/CmsCheckinCard";
import { useCmsTasks } from "@/hooks/useCmsTasks";
import { useCmsRole } from "@/hooks/useCmsRole";
import { supabase } from "@/integrations/supabase/client";

export default function CmsDashboard() {
  const { tasks, loading } = useCmsTasks();
  const { role } = useCmsRole();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user.id ?? null));
  }, []);

  const myTasks = tasks.filter((t) => t.assignee_id === userId);
  const myOpen = myTasks.filter((t) => t.status !== "done" && t.status !== "archived");
  const totalOpen = tasks.filter((t) => t.status !== "done" && t.status !== "archived").length;

  return (
    <CmsLayout title="Dashboard">
      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm text-muted-foreground">My open tasks</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-semibold">{loading ? "—" : myOpen.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm text-muted-foreground">My total tasks</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-semibold">{loading ? "—" : myTasks.length}</div></CardContent>
          </Card>
          {(role === "cms_admin" || role === "cms_supervisor") && (
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Team open tasks</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-semibold">{loading ? "—" : totalOpen}</div></CardContent>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CmsCheckinCard />
          <Card>
            <CardHeader><CardTitle>Recent tasks</CardTitle></CardHeader>
            <CardContent>
              {myTasks.slice(0, 5).length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks yet.</p>
              ) : (
                <ul className="space-y-2">
                  {myTasks.slice(0, 5).map((t) => (
                    <li key={t.id} className="flex justify-between text-sm">
                      <span className="truncate">{t.title}</span>
                      <span className="text-muted-foreground capitalize">{t.status.replace("_", " ")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </CmsLayout>
  );
}
