import { LayoutDashboard, ClipboardList, CalendarCheck, Users } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { Logo } from "@/components/Logo";
import ischoolIcon from "@/assets/ischool-icon.png";
import { useCmsRole } from "@/hooks/useCmsRole";

const items = [
  { title: "Dashboard", url: "/cms", icon: LayoutDashboard },
  { title: "Tasks", url: "/cms/tasks", icon: ClipboardList },
  { title: "Attendance", url: "/cms/attendance", icon: CalendarCheck },
  { title: "Users", url: "/cms/users", icon: Users, adminOnly: true },
];

export function CmsSidebar() {
  const { isCmsAdmin } = useCmsRole();
  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-3 border-b">
        <div className="flex items-center gap-2">
          <img src={ischoolIcon} alt="" className="w-7 h-7 rounded" />
          <div className="min-w-0">
            <Logo />
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">CMS</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items
                .filter((it) => !it.adminOnly || isCmsAdmin)
                .map((it) => (
                  <SidebarMenuItem key={it.url}>
                    <SidebarMenuButton asChild>
                      <NavLink to={it.url} end>
                        <it.icon className="w-4 h-4" />
                        <span>{it.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
