import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Activity,
  LineChart,
  TrendingUp,
  ShieldAlert,
  ClipboardList,
  BookOpen,
  Kanban as KanbanIcon,
  BarChart3,
  FileText,
  Target,
  Star,
  Settings,
  Hash,
  Megaphone,
  Rocket,
  ShieldCheck,
  ToggleLeft,
  CalendarCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { Logo } from "@/components/Logo";
import ischoolIcon from "@/assets/ischool-icon.png";
import { useUserRole } from "@/hooks/useUserRole";
import { useFeatureControls, isFeatureEnabled } from "@/hooks/useFeatureControls";

type NavItem = {
  title: string;
  url: string;
  icon: any;
  roles?: string[];
  /** Optional feature key from `feature_controls`. If unset, the URL is used. */
  featureKey?: string;
};

const overview: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, featureKey: "dashboard" },
  { title: "Home", url: "/home", icon: LayoutDashboard, featureKey: "home" },
  { title: "Attendance", url: "/attendance", icon: CalendarCheck, roles: ["admin", "team_leader", "super_team_leader"] },
];

const operations: NavItem[] = [
  { title: "Tutors", url: "/tutors", icon: Users, featureKey: "tutors" },
  { title: "Teams", url: "/teams", icon: UsersRound, featureKey: "teams" },
  { title: "Performance", url: "/performance", icon: Activity, featureKey: "performance" },
];

const tracking: NavItem[] = [
  { title: "Tracking", url: "/tracking", icon: LineChart, featureKey: "tracking" },
  { title: "Engagement", url: "/engagement", icon: Star, roles: ["admin"], featureKey: "engagement" },
  { title: "Weekly Study Plan", url: "/study-plan", icon: BookOpen, roles: ["admin", "team_leader"], featureKey: "study_plan" },
];

const growthRisk: NavItem[] = [
  { title: "Growth", url: "/growth", icon: TrendingUp, featureKey: "growth" },
  { title: "Risk Control", url: "/risk-control", icon: ShieldAlert, featureKey: "risk_control" },
  { title: "Action Plans", url: "/action-plans", icon: Target, featureKey: "action_plans" },
];

const taskTracker: NavItem[] = [
  { title: "Tasks", url: "/tasks", icon: ClipboardList, featureKey: "tasks" },
  { title: "Kanban", url: "/kanban", icon: KanbanIcon, featureKey: "kanban" },
  { title: "Progress", url: "/progress", icon: BarChart3, featureKey: "progress" },
  { title: "Reports", url: "/reports", icon: FileText, featureKey: "reports" },
];

const admin: NavItem[] = [
  { title: "System Dashboard", url: "/admin/dashboard", icon: LayoutDashboard, roles: ["admin"], featureKey: "admin_dashboard" },
  { title: "User Management", url: "/admin/users", icon: Settings, roles: ["admin"], featureKey: "admin_users" },
  { title: "Feature Control", url: "/admin/feature-control", icon: ToggleLeft, roles: ["admin"] },
  { title: "Announcements", url: "/admin/announcements", icon: Megaphone, roles: ["admin"], featureKey: "admin_announcements" },
  { title: "Feature Plans", url: "/admin/feature-plans", icon: Rocket, roles: ["admin"], featureKey: "admin_feature_plans" },
  { title: "Edu Descriptions", url: "/admin/edu-descriptions", icon: ShieldCheck, roles: ["admin"], featureKey: "admin_edu_descriptions" },
  { title: "CS Ticket Categories", url: "/admin/cs-ticket-categories", icon: Hash, roles: ["admin"], featureKey: "admin_cs_ticket_categories" },
  { title: "Team Overview", url: "/team/dashboard", icon: UsersRound, roles: ["team_leader"], featureKey: "team_dashboard" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { role } = useUserRole();
  const { features } = useFeatureControls();

  const filterByRole = (items: NavItem[]) =>
    items.filter((i) => {
      if (i.roles && (!role || !i.roles.includes(role))) return false;
      // Feature Control itself is always visible to admins (no toggle).
      if (!i.featureKey) return true;
      return isFeatureEnabled(features, i.featureKey, role);
    });

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const renderGroup = (label: string, items: NavItem[]) => {
    const visible = filterByRole(items);
    if (visible.length === 0) return null;
    return (
      <SidebarGroup>
        {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
        <SidebarGroupContent>
          <SidebarMenu>
            {visible.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                  <NavLink
                    to={item.url}
                    className="flex items-center gap-2"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-1">
          {collapsed ? (
            <img src={ischoolIcon} alt="iSchool" className="h-12 w-12 object-contain mx-auto" />
          ) : (
            <>
              <Logo variant="blue" className="h-8" />
              <span className="font-semibold text-sm text-sidebar-foreground">B2C_MS</span>
            </>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Overview", overview)}
        {renderGroup("Operations", operations)}
        {renderGroup("Tracking", tracking)}
        {renderGroup("Growth & Risk", growthRisk)}
        {renderGroup("Task Tracker", taskTracker)}
        {renderGroup("Admin", admin)}
      </SidebarContent>
    </Sidebar>
  );
}
