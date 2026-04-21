import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeft, Loader2 } from "lucide-react";
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
      <AppLayout title="Student Engagement">
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout title="Student Engagement">
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">You don't have access to Student Engagement.</p>
            <Button onClick={() => navigate("/home")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Student Engagement">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <EngagementTab />
      </div>
    </AppLayout>
  );
};

export default EngagementPage;
