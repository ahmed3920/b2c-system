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

import ActionPlans from "./pages/ActionPlans";
import Engagement from "./pages/Engagement";
import Dashboard from "./pages/Dashboard";
import Tutors from "./pages/Tutors";
import TutorProfile from "./pages/TutorProfile";
import TeamsPage from "./pages/Teams";
import TeamDetail from "./pages/TeamDetail";
import Performance from "./pages/Performance";
import Tracking from "./pages/Tracking";
import Growth from "./pages/Growth";
import RiskControl from "./pages/RiskControl";
import StudyPlan from "./pages/StudyPlan";
import AnnouncementsAdmin from "./pages/AnnouncementsAdmin";
import FeaturePlansAdmin from "./pages/FeaturePlansAdmin";
import EduDescriptionsAdmin from "./pages/EduDescriptionsAdmin";
import CSTicketCategoriesAdmin from "./pages/CSTicketCategoriesAdmin";
import FeatureControlAdmin from "./pages/FeatureControlAdmin";
import Attendance from "./pages/Attendance";
import FeatureDocumentation from "./pages/FeatureDocumentation";
import VisionBoardPage from "./pages/VisionBoard";
import SessionIncidents from "./pages/SessionIncidents";
import SessionIncidentSettings from "./pages/SessionIncidentSettings";
import IncidentSubmit from "./pages/IncidentSubmit";

// CMS (separate workspace)
import CmsLogin from "./pages/cms/CmsLogin";
import CmsDashboard from "./pages/cms/CmsDashboard";
import CmsTasks from "./pages/cms/CmsTasks";
import CmsKanban from "./pages/cms/CmsKanban";
import CmsAttendance from "./pages/cms/CmsAttendance";
import CmsUsers from "./pages/cms/CmsUsers";
import CmsTaskProperties from "./pages/cms/CmsTaskProperties";
import CmsPermissions from "./pages/cms/CmsPermissions";
import CmsActivityMonitoring from "./pages/cms/CmsActivityMonitoring";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/auth/admin" replace />} />
          <Route path="/auth" element={<Navigate to="/auth/admin" replace />} />
          <Route path="/auth/:audience" element={<Auth />} />
          <Route path="/home" element={<Home />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/kanban" element={<Kanban />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/dashboard" element={<SystemDashboard />} />
          {/* All System Tasks route removed - Admins only see team-level aggregates */}
          <Route path="/team/dashboard" element={<TeamDashboard />} />
          
          <Route path="/action-plans" element={<ActionPlans />} />
          <Route path="/engagement" element={<Engagement />} />
          {/* New B2C dashboard sections */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tutors" element={<Tutors />} />
          <Route path="/tutors/:id" element={<TutorProfile />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:id" element={<TeamDetail />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="/tracking" element={<Tracking />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/growth" element={<Growth />} />
          <Route path="/risk-control" element={<RiskControl />} />
          <Route path="/study-plan" element={<StudyPlan />} />
          <Route path="/admin/announcements" element={<AnnouncementsAdmin />} />
          <Route path="/admin/feature-plans" element={<FeaturePlansAdmin />} />
          <Route path="/admin/edu-descriptions" element={<EduDescriptionsAdmin />} />
          <Route path="/admin/cs-ticket-categories" element={<CSTicketCategoriesAdmin />} />
          <Route path="/admin/feature-control" element={<FeatureControlAdmin />} />
          <Route path="/admin/feature-documentation" element={<FeatureDocumentation />} />
          <Route path="/admin/vision-board" element={<VisionBoardPage />} />
          <Route path="/session-incidents" element={<SessionIncidents />} />
          <Route path="/admin/session-incident-settings" element={<SessionIncidentSettings />} />
          <Route path="/incident-submit" element={<IncidentSubmit />} />

          {/* CMS workspace (isolated) */}
          <Route path="/cms/login" element={<CmsLogin />} />
          <Route path="/cms" element={<CmsDashboard />} />
          <Route path="/cms/tasks" element={<CmsTasks />} />
          <Route path="/cms/kanban" element={<CmsKanban />} />
          <Route path="/cms/attendance" element={<CmsAttendance />} />
          <Route path="/cms/users" element={<CmsUsers />} />
          <Route path="/cms/task-properties" element={<CmsTaskProperties />} />
          <Route path="/cms/permissions" element={<CmsPermissions />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
