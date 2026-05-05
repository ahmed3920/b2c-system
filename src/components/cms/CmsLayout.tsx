import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CmsSidebar } from "./CmsSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSystem } from "@/hooks/useSystem";
import { useCmsRole, type CmsRole } from "@/hooks/useCmsRole";
import { useCmsActivityTracker } from "@/hooks/useCmsActivityTracker";

interface CmsLayoutProps {
  children: ReactNode;
  title?: string;
  allowedRoles?: CmsRole[];
}

const roleLabel: Record<CmsRole, string> = {
  cms_admin: "Admin",
  cms_supervisor: "Supervisor",
  cms_member: "Content Team",
};

export function CmsLayout({ children, title, allowedRoles }: CmsLayoutProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { system, loading: sysLoading } = useSystem();
  const { role, loading: roleLoading } = useCmsRole();
  const [authChecked, setAuthChecked] = useState(false);
  const [displayName, setDisplayName] = useState("User");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/cms/login");
        return;
      }
      const { data: profile } = await supabase
        .from("cms_profiles")
        .select("full_name")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setDisplayName(profile?.full_name ?? "User");
      setAuthChecked(true);
    })();
  }, [navigate]);

  useEffect(() => {
    if (sysLoading) return;
    if (system && system !== "cms") {
      toast({ title: "Wrong workspace", description: "This account belongs to the B2C system.", variant: "destructive" });
      supabase.auth.signOut().then(() => navigate("/cms/login"));
    }
  }, [system, sysLoading, navigate, toast]);

  useEffect(() => {
    if (roleLoading) return;
    if (allowedRoles && role && !allowedRoles.includes(role)) {
      navigate("/cms");
    }
  }, [role, roleLoading, allowedRoles, navigate]);

  const handleLogout = () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
    // Fire-and-forget: don't await — signOut can hang on stale sessions
    supabase.auth.signOut().catch((e) => console.error("CMS signOut error", e));
    toast({ title: "Logged out" });
    window.location.href = "/cms/login";
  };

  if (!authChecked || sysLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <CmsSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b bg-card px-4 sticky top-0 z-40">
            <SidebarTrigger />
            <div className="flex-1 min-w-0">
              {title && <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>}
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{displayName}</span>
                {role && <Badge variant="secondary">{roleLabel[role]}</Badge>}
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
