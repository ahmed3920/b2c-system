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
import { useUserRole } from "@/hooks/useUserRole";

type NavItem = { title: string; url: string; icon: any; roles?: string[] };

const overview: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
];

const operations: NavItem[] = [
  { title: "Tutors", url: "/tutors", icon: Users },
  { title: "Teams", url: "/teams", icon: UsersRound },
  { title: "Performance", url: "/performance", icon: Activity },
];

const tracking: NavItem[] = [
  { title: "Tracking", url: "/tracking", icon: LineChart },
  { title: "Engagement", url: "/engagement", icon: Star, roles: ["admin"] },
  { title: "Weekly Study Plan", url: "/study-plan", icon: BookOpen, roles: ["admin", "team_leader"] },
];

const growthRisk: NavItem[] = [
  { title: "Growth", url: "/growth", icon: TrendingUp },
  { title: "Risk Control", url: "/risk-control", icon: ShieldAlert },
  { title: "Action Plans", url: "/action-plans", icon: Target },
];

const taskTracker: NavItem[] = [
  { title: "Tasks", url: "/tasks", icon: ClipboardList },
  { title: "Kanban", url: "/kanban", icon: KanbanIcon },
  { title: "Progress", url: "/progress", icon: BarChart3 },
  { title: "Reports", url: "/reports", icon: FileText },
];

const admin: NavItem[] = [
  { title: "System Dashboard", url: "/admin/dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { title: "User Management", url: "/admin/users", icon: Settings, roles: ["admin"] },
  { title: "Announcements", url: "/admin/announcements", icon: Megaphone, roles: ["admin"] },
  { title: "Team Overview", url: "/team/dashboard", icon: UsersRound, roles: ["team_leader"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { role } = useUserRole();

  const filterByRole = (items: NavItem[]) =>
    items.filter((i) => !i.roles || (role && i.roles.includes(role)));

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
        <div className="flex items-center gap-2 px-2 py-1">
          <Logo variant="blue" className="h-8" />
          {!collapsed && (
            <span className="font-semibold text-sm text-sidebar-foreground">B2C_MS</span>
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
