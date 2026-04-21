import { ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { RoleBadge } from "@/components/RoleBadge";
import { useToast } from "@/hooks/use-toast";
import { useFeatureControls, isFeatureEnabled } from "@/hooks/useFeatureControls";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  /** If set, only these roles can access. Others are redirected to /home. */
  allowedRoles?: ("admin" | "team_leader" | "super_team_leader" | "mentor" | "community_moderator")[];
}

export function AppLayout({ children, title, allowedRoles }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { role, isLoading: roleLoading } = useUserRole();
  const { features, loading: featuresLoading } = useFeatureControls();
  const [authChecked, setAuthChecked] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, mentor_name")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setDisplayName(profile?.full_name || profile?.mentor_name || "User");
      setAuthChecked(true);
    };
    check();
  }, [navigate]);

  useEffect(() => {
    if (!roleLoading && allowedRoles && role && !allowedRoles.includes(role)) {
      navigate("/home");
    }
  }, [role, roleLoading, allowedRoles, navigate]);

  // Block disabled features per role (sidebar already hides them).
  // Admin's "Feature Control" page is never blocked.
  useEffect(() => {
    if (roleLoading || featuresLoading || !role) return;
    if (location.pathname.startsWith("/admin/feature-control")) return;
    if (!isFeatureEnabled(features, location.pathname, role)) {
      toast({
        title: "Feature unavailable",
        description: "This section has been disabled for your role.",
        variant: "destructive",
      });
      navigate("/home");
    }
  }, [features, featuresLoading, role, roleLoading, location.pathname, navigate, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Logged out" });
    navigate("/auth");
  };

  if (!authChecked || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b bg-card px-4 sticky top-0 z-40">
            <SidebarTrigger />
            <div className="flex-1 min-w-0">
              {title && (
                <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{displayName}</span>
                <RoleBadge role={role} size="sm" />
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
