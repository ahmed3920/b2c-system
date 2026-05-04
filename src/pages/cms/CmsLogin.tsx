import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function CmsLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("user_systems")
        .select("system")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data?.system === "cms") navigate("/cms");
    })();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.session) {
      setSubmitting(false);
      toast({ title: "Login failed", description: error?.message ?? "Invalid credentials", variant: "destructive" });
      return;
    }
    const { data: sysRow } = await supabase
      .from("user_systems")
      .select("system")
      .eq("user_id", data.session.user.id)
      .maybeSingle();
    if (sysRow?.system !== "cms") {
      await supabase.auth.signOut();
      setSubmitting(false);
      toast({
        title: "Access denied",
        description: "This account is not registered for the Content Management System.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(false);
    toast({ title: "Welcome back" });
    navigate("/cms");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Content Management System</CardTitle>
          <CardDescription>Sign in to your CMS workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Sign in
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-6">
            © 2026 iSchool – All rights reserved
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
