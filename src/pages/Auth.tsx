import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, LogIn, UserPlus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  mentorName: z.string().optional(),
  mentorId: z.string().optional(),
  teamLeader: z.string().optional(),
});

const teamLeaders = [
  "Ahmed Hassan",
  "Sarah Mohamed",
  "Omar Ali",
  "Fatima Khalil",
  "Youssef Ibrahim",
  "Nour El-Din",
];

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mentorName, setMentorName] = useState("");
  const [mentorId, setMentorId] = useState("");
  const [teamLeader, setTeamLeader] = useState(teamLeaders[0]);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  const validateForm = () => {
    const data = { email, password, mentorName, mentorId, teamLeader };
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

    if (!isLogin) {
      if (!mentorName.trim()) {
        setErrors({ mentorName: "Mentor name is required" });
        return false;
      }
      if (!mentorId.trim() || !/^T-\d{4}$/.test(mentorId)) {
        setErrors({ mentorId: "Mentor ID must be in format T-XXXX" });
        return false;
      }
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Login Failed",
              description: "Invalid email or password. Please try again.",
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

        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        navigate("/home");
      } else {
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/home`,
          },
        });

        if (signUpError) {
          if (signUpError.message.includes("already registered")) {
            toast({
              title: "Account Exists",
              description: "This email is already registered. Please login instead.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Sign Up Failed",
              description: signUpError.message,
              variant: "destructive",
            });
          }
          return;
        }

        if (authData.user) {
          const { error: profileError } = await supabase.from("profiles").insert({
            user_id: authData.user.id,
            mentor_id: mentorId.trim().toUpperCase(),
            mentor_name: mentorName.trim(),
            team_leader: teamLeader,
          });

          if (profileError) {
            toast({
              title: "Profile Creation Failed",
              description: "Account created but profile setup failed. Please contact support.",
              variant: "destructive",
            });
            return;
          }

          toast({
            title: "Account Created!",
            description: "Welcome to the Mentor Task Tracker.",
          });
          navigate("/home");
        }
      }
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

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-primary p-6 text-center">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="w-16 h-16 bg-primary-foreground/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary-foreground">iS</span>
              </div>
              <h1 className="text-2xl font-bold text-primary-foreground">
                Mentor Task Tracker
              </h1>
              <p className="text-primary-foreground/80 text-sm mt-1">
                {isLogin ? "Welcome back!" : "Create your account"}
              </p>
            </motion.div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="mentorName">Mentor Name</Label>
                  <Input
                    id="mentorName"
                    type="text"
                    placeholder="Enter your full name"
                    value={mentorName}
                    onChange={(e) => setMentorName(e.target.value)}
                    className={errors.mentorName ? "border-destructive animate-shake" : ""}
                  />
                  {errors.mentorName && (
                    <p className="text-sm text-destructive">{errors.mentorName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mentorId">Mentor ID</Label>
                  <Input
                    id="mentorId"
                    type="text"
                    placeholder="T-XXXX (e.g., T-1008)"
                    value={mentorId}
                    onChange={(e) => setMentorId(e.target.value.toUpperCase())}
                    className={errors.mentorId ? "border-destructive animate-shake" : ""}
                  />
                  {errors.mentorId && (
                    <p className="text-sm text-destructive">{errors.mentorId}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teamLeader">Team Leader</Label>
                  <select
                    id="teamLeader"
                    value={teamLeader}
                    onChange={(e) => setTeamLeader(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    {teamLeaders.map((leader) => (
                      <option key={leader} value={leader}>
                        {leader}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={errors.email ? "border-destructive animate-shake" : ""}
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

            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90 transition-opacity btn-primary-shadow"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : isLogin ? (
                <LogIn className="w-4 h-4 mr-2" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              {isLoading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
            </Button>

            <div className="text-center pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          © 2024 iSchool Mentor Task Tracker
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
