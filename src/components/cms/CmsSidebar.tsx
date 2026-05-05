import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarCheck,
  Users,
  Kanban as KanbanIcon,
  Settings2,
  Shield,
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
import { useCmsRole } from "@/hooks/useCmsRole";

type NavItem = {
  title: string;
  url: string;
  icon: any;
  adminOnly?: boolean;
};

const overview: NavItem[] = [
  { title: "Dashboard", url: "/cms", icon: LayoutDashboard },
  { title: "Attendance", url: "/cms/attendance", icon: CalendarCheck },
];

const taskTracker: NavItem[] = [
  { title: "Tasks", url: "/cms/tasks", icon: ClipboardList },
  { title: "Kanban", url: "/cms/kanban", icon: KanbanIcon },
];

const admin: NavItem[] = [
  { title: "Users", url: "/cms/users", icon: Users, adminOnly: true },
  { title: "Task Properties", url: "/cms/task-properties", icon: Settings2, adminOnly: true },
  { title: "Permissions", url: "/cms/permissions", icon: Shield, adminOnly: true },
];

export function CmsSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isCmsAdmin } = useCmsRole();

  const isActive = (path: string) =>
    path === "/cms"
      ? location.pathname === "/cms"
      : location.pathname === path || location.pathname.startsWith(path + "/");

  const renderGroup = (label: string, items: NavItem[]) => {
    const visible = items.filter((it) => !it.adminOnly || isCmsAdmin);
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
              <span className="font-semibold text-sm text-sidebar-foreground">CMS</span>
            </>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Overview", overview)}
        {renderGroup("Task Tracker", taskTracker)}
        {renderGroup("Admin", admin)}
      </SidebarContent>
    </Sidebar>
  );
}
