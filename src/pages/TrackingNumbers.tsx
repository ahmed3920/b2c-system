import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, LogOut, BarChart3, Lock } from "lucide-react";
import { QualityTab } from "@/components/tracking/QualityTab";
import { useToast } from "@/hooks/use-toast";

const TABS = [
  { value: "quality", label: "Quality", enabled: true },
  { value: "attendance", label: "Attendance", enabled: false },
  { value: "retention", label: "Retention", enabled: false },
  { value: "satisfaction", label: "Satisfaction", enabled: false },
  { value: "completion", label: "Completion", enabled: false },
  { value: "engagement", label: "Engagement", enabled: false },
  { value: "performance", label: "Performance", enabled: false },
  { value: "growth", label: "Growth", enabled: false },
];

const TrackingNumbers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role, isLoading: roleLoading, isAdmin, isTeamLeader } = useUserRole();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      else setAuthChecked(true);
    });
  }, [navigate]);

  useEffect(() => {
    if (!roleLoading && role && !isAdmin && !isTeamLeader) {
      navigate("/home");
    }
  }, [role, roleLoading, isAdmin, isTeamLeader, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Logged out" });
    navigate("/auth");
  };

  if (!authChecked || roleLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <nav className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Logo variant="blue" className="h-10" />
              <div className="h-6 w-px bg-border" />
              <span className="font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Tracking Numbers
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/home")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Home
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Tracking Numbers</h1>
          <p className="text-muted-foreground mt-1">
            Upload structured sheets and visualize key performance metrics.
          </p>
        </div>

        <Tabs defaultValue="quality" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted p-1">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                disabled={!t.enabled}
                className="data-[state=active]:bg-background"
              >
                {!t.enabled && <Lock className="w-3 h-3 mr-1" />}
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="quality" className="mt-6">
            <QualityTab />
          </TabsContent>

          {TABS.filter((t) => !t.enabled).map((t) => (
            <TabsContent key={t.value} value={t.value} className="mt-6">
              <div className="bg-card rounded-xl p-12 text-center">
                <Lock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold">{t.label}</h3>
                <p className="text-muted-foreground mt-2">Coming soon.</p>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
};

export default TrackingNumbers;
