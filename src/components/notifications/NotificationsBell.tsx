import { Bell, AlertTriangle, Clock, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

const iconForType = (type: string) => {
  if (type === "cs_ticket_due_today") return <Clock className="w-4 h-4 text-amber-500" />;
  if (type === "cs_ticket_new") return <FileText className="w-4 h-4 text-primary" />;
  if (type === "live_issue_new") return <AlertTriangle className="w-4 h-4 text-destructive" />;
  return <Bell className="w-4 h-4 text-muted-foreground" />;
};

export function NotificationsBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleClick = (n: AppNotification) => {
    if (!n.read_status) markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-[10px]"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold text-sm">Notifications</p>
          {unreadCount > 0 && (
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-muted/50 flex gap-3 items-start transition-colors",
                      !n.read_status && "bg-primary/5",
                    )}
                  >
                    <div className="mt-0.5">{iconForType(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm leading-snug", !n.read_status && "font-medium")}>
                        {n.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.read_status && (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
