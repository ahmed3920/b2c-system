import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ArrowLeft, Loader2, Star } from "lucide-react";
import { EngagementTab } from "@/components/engagement/EngagementTab";

const EngagementPage = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading } = useUserRole();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
    });
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">You don't have access to Student Engagement.</p>
          <Button onClick={() => navigate("/home")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
          </Button>
        </div>
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
                <Star className="w-4 h-4 text-primary" /> Student Engagement
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/home")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Home
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <EngagementTab />
      </main>
    </div>
  );
};

export default EngagementPage;
