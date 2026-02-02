import { Toaster } from "@/components/ui/toaster";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Tasks from "./pages/Tasks";
import Kanban from "./pages/Kanban";
import Progress from "./pages/Progress";
import Reports from "./pages/Reports";
import UserManagement from "./pages/UserManagement";
import TeamDashboard from "./pages/TeamDashboard";
import SystemDashboard from "./pages/SystemDashboard";
import SystemTasks from "./pages/SystemTasks";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/home" element={<Home />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/kanban" element={<Kanban />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/dashboard" element={<SystemDashboard />} />
          <Route path="/admin/tasks" element={<SystemTasks />} />
          <Route path="/team/dashboard" element={<TeamDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
