import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";

export default function CmsLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-xl shadow-xl overflow-hidden">
          {/* Header with iSchool Logo */}
          <div className="bg-gradient-primary p-6 text-center">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center"
            >
              <Logo variant="white" className="h-12 mb-4" />
              <h1 className="text-2xl font-bold text-primary-foreground">
                Content Management System
              </h1>
              <p className="text-primary-foreground/80 text-sm mt-1">
                Sign in to your CMS workspace
              </p>
            </motion.div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">User ID / Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  disabled={submitting}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90 transition-opacity btn-primary-shadow"
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <LogIn className="w-4 h-4 mr-2" />
              )}
              {submitting ? "Signing in..." : "Sign In"}
            </Button>

            <p className="text-xs text-center text-muted-foreground pt-2">
              Contact your administrator if you need an account
            </p>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          © 2026 iSchool – All rights reserved
        </p>
      </motion.div>
    </div>
  );
}
