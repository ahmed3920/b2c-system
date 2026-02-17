import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/RoleBadge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  MoreHorizontal,
  Pencil,
  Search,
  UserX,
  UserCheck,
  KeyRound,
  Filter,
  X,
  ShieldAlert,
  Archive,
  RotateCcw,
} from "lucide-react";
import type { UserWithRole } from "@/hooks/useAdminUsers";
import type { AppRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

interface UserTableProps {
  users: UserWithRole[];
  onEdit: (user: UserWithRole) => void;
  onDeactivate: (userId: string) => Promise<{ success: boolean; error?: string }>;
  onReactivate: (userId: string) => Promise<{ success: boolean; error?: string }>;
  onResetPassword: (user: UserWithRole) => void;
  currentUserId?: string;
  teamLeaders: string[];
}

export function UserTable({
  users,
  onEdit,
  onDeactivate,
  onReactivate,
  onResetPassword,
  currentUserId,
  teamLeaders,
}: UserTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [showArchived, setShowArchived] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);

  const hasActiveFilters =
    roleFilter !== "all" || teamFilter !== "all" || statusFilter !== "active" || searchQuery !== "";

  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setTeamFilter("all");
    setStatusFilter("active");
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      searchQuery === "" ||
      user.mentor_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.mentor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.email?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      user.team_leader.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesTeam = teamFilter === "all" || user.team_leader === teamFilter;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && user.active_status) ||
      (statusFilter === "inactive" && !user.active_status);

    // If showArchived is off, hide inactive users unless specifically filtering for them
    if (!showArchived && !user.active_status && statusFilter !== "inactive" && statusFilter !== "all") {
      return false;
    }

    return matchesSearch && matchesRole && matchesTeam && matchesStatus;
  });

  // Separate active and inactive users
  const activeUsers = filteredUsers.filter((u) => u.active_status);
  const inactiveUsers = filteredUsers.filter((u) => !u.active_status);

  const handleDeactivateClick = (user: UserWithRole) => {
    setSelectedUser(user);
    setDeactivateDialogOpen(true);
  };

  const handleReactivateClick = (user: UserWithRole) => {
    setSelectedUser(user);
    setReactivateDialogOpen(true);
  };

  const confirmDeactivate = async () => {
    if (selectedUser) {
      await onDeactivate(selectedUser.user_id);
      setDeactivateDialogOpen(false);
      setSelectedUser(null);
    }
  };

  const confirmReactivate = async () => {
    if (selectedUser) {
      await onReactivate(selectedUser.user_id);
      setReactivateDialogOpen(false);
      setSelectedUser(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const uniqueTeams = [...new Set(users.map((u) => u.team_leader))].sort();

  const isSuperAdmin = (user: UserWithRole) => user.role === "admin";

  const renderUserRow = (user: UserWithRole, isInactive = false) => (
    <TableRow key={user.user_id} className={cn(isInactive && "opacity-50 bg-muted/30")}>
      <TableCell className="font-mono text-sm">{user.mentor_id}</TableCell>
      <TableCell>
        <div>
          <p className="font-medium">{user.full_name || user.mentor_name}</p>
          {user.full_name && user.full_name !== user.mentor_name && (
            <p className="text-xs text-muted-foreground">{user.mentor_name}</p>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm">{user.email || "-"}</TableCell>
      <TableCell className="text-sm">{user.team_leader}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <RoleBadge role={user.role} size="sm" />
          {isSuperAdmin(user) && (
            <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
              <ShieldAlert className="w-3 h-3 mr-0.5" />
              Protected
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        {user.active_status ? (
          <span className="inline-flex items-center gap-1 text-sm text-green-600">
            <UserCheck className="w-3 h-3" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <UserX className="w-3 h-3" /> Inactive
          </span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(user.last_login)}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem onClick={() => onEdit(user)} disabled={isInactive && !isSuperAdmin(user)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit User
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onResetPassword(user)} disabled={isInactive}>
              <KeyRound className="w-4 h-4 mr-2" />
              Reset Password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {user.active_status ? (
              <DropdownMenuItem
                onClick={() => handleDeactivateClick(user)}
                className="text-destructive focus:text-destructive"
                disabled={user.user_id === currentUserId}
              >
                <Archive className="w-4 h-4 mr-2" />
                Deactivate User
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => handleReactivateClick(user)}
                className="text-green-600 focus:text-green-600"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reactivate User
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={roleFilter} onValueChange={(value: AppRole | "all") => setRoleFilter(value)}>
          <SelectTrigger className="w-[140px]">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="team_leader">Team Leader</SelectItem>
            <SelectItem value="mentor">Mentor</SelectItem>
          </SelectContent>
        </Select>

        <Select value={teamFilter} onValueChange={(value) => setTeamFilter(value)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {uniqueTeams.map((team) => (
              <SelectItem key={team} value={team}>
                {team}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="showArchived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label htmlFor="showArchived" className="text-sm text-muted-foreground cursor-pointer">
              Show Archived
            </Label>
          </div>
          <span className="text-sm text-muted-foreground">
            {filteredUsers.length} of {users.length} users
          </span>
        </div>
      </div>

      {/* Active Filters Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: "{searchQuery}"
              <button onClick={() => setSearchQuery("")}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {roleFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Role: {roleFilter.replace("_", " ")}
              <button onClick={() => setRoleFilter("all")}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {teamFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Team: {teamFilter}
              <button onClick={() => setTeamFilter("all")}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {statusFilter !== "active" && (
            <Badge variant="secondary" className="gap-1">
              Status: {statusFilter}
              <button onClick={() => setStatusFilter("active")}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>User ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Team / Leader</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeUsers.length === 0 && inactiveUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {hasActiveFilters ? "No users match the current filters" : "No users found"}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {activeUsers.map((user) => renderUserRow(user, false))}
                {showArchived && inactiveUsers.length > 0 && (
                  <>
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted/50 py-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <Archive className="w-4 h-4" />
                          Archived Users ({inactiveUsers.length})
                        </div>
                      </TableCell>
                    </TableRow>
                    {inactiveUsers.map((user) => renderUserRow(user, true))}
                  </>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-destructive" />
              Deactivate User
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to deactivate{" "}
                <span className="font-semibold">{selectedUser?.full_name || selectedUser?.mentor_name}</span>{" "}
                ({selectedUser?.mentor_id})?
              </p>
              <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium text-foreground">This will:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li>Set user status to Inactive</li>
                  <li>Hide user from active views, reports & metrics</li>
                  <li>Preserve all historical data</li>
                  <li>User can be reactivated at any time</li>
                </ul>
              </div>
              {selectedUser?.role === "team_leader" && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    ⚠️ Team Leader Warning
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Deactivating this Team Leader will leave their team members unassigned. 
                    You should reassign the team members to another leader.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate Confirmation Dialog */}
      <AlertDialog open={reactivateDialogOpen} onOpenChange={setReactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-green-600" />
              Reactivate User
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reactivate{" "}
              <span className="font-semibold">{selectedUser?.full_name || selectedUser?.mentor_name}</span>{" "}
              ({selectedUser?.mentor_id})? The user will be restored to active status and included in all dashboard metrics, reports, and task views.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReactivate}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Reactivate User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
