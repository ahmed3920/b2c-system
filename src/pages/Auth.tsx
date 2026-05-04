import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTokenLoading, setIsTokenLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loginAttempts, setLoginAttempts] = useState(0);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { audience } = useParams<{ audience?: string }>();
  const isMentorAudience = audience === "mentor";
  const pageTitle = isMentorAudience ? "Mentor Task Tracker" : "B2C Management System";
  const { toast } = useToast();

  // Handle login token from URL
  useEffect(() => {
    const loginToken = searchParams.get("login_token");
    if (loginToken) {
      handleTokenLogin(loginToken);
    }
  }, [searchParams]);

  const handleTokenLogin = async (token: string) => {
    setIsTokenLoading(true);
    try {
      const response = await supabase.functions.invoke("token-login", {
        body: { token },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message || "Invalid login link");
      }

      const actionLink = response.data?.action_link;
      if (actionLink) {
        // Extract token_hash and type from the action link
        const url = new URL(actionLink);
        const tokenHash = url.searchParams.get("token") || url.hash?.match(/token=([^&]+)/)?.[1];
        const type = url.searchParams.get("type") || "magiclink";
        
        if (tokenHash) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });

          if (error) throw error;

          toast({
            title: "Welcome!",
            description: "You have been logged in successfully.",
          });
          navigate("/home");
          return;
        }
      }

      throw new Error("Failed to process login link");
    } catch (error: any) {
      toast({
        title: "Login Link Failed",
        description: error.message || "This login link is invalid. Please contact your administrator.",
        variant: "destructive",
      });
    } finally {
      setIsTokenLoading(false);
    }
  };

  const validateForm = () => {
    const data = { email, password };
    const result = authSchema.safeParse(data);
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (loginAttempts >= 5) {
      toast({
        title: "Account Locked",
        description: "Too many failed attempts. Please contact an administrator.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setLoginAttempts(prev => prev + 1);
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Login Failed",
            description: `Invalid email or password. ${5 - loginAttempts - 1} attempts remaining.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Login Failed",
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      // Block CMS users from logging in to the B2C workspace.
      if (data.user) {
        const { data: sysRow } = await supabase
          .from("user_systems")
          .select("system")
          .eq("user_id", data.user.id)
          .maybeSingle();
        if (sysRow?.system === "cms") {
          await supabase.auth.signOut();
          toast({
            title: "Wrong workspace",
            description: "This account belongs to the Content Management System. Please use the CMS login.",
            variant: "destructive",
          });
          navigate("/cms/login");
          return;
        }

        await supabase
          .from("profiles")
          .update({ last_login: new Date().toISOString() })
          .eq("user_id", data.user.id);
      }

      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      navigate("/home");
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isTokenLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Signing you in...</p>
        </div>
      </div>
    );
  }

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
                {pageTitle}
              </h1>
              <p className="text-primary-foreground/80 text-sm mt-1">
                Please login to continue
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
                placeholder="Enter your User ID (e.g., mentor@ischool.com)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={errors.email ? "border-destructive animate-shake" : ""}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
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
                  className={errors.password ? "border-destructive animate-shake pr-10" : "pr-10"}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            {loginAttempts > 0 && loginAttempts < 5 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-warning text-center"
              >
                ⚠️ {5 - loginAttempts} login attempts remaining
              </motion.p>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90 transition-opacity btn-primary-shadow"
              disabled={isLoading || loginAttempts >= 5}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <LogIn className="w-4 h-4 mr-2" />
              )}
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

            <p className="text-xs text-center text-muted-foreground pt-2">
              Contact your administrator if you need an account
            </p>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          © 2026 iSchool - All rights reserved
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
