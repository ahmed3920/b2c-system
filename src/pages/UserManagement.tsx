import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminUsers, type UserWithRole } from "@/hooks/useAdminUsers";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { UserTable } from "@/components/admin/UserTable";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { EditUserDialog } from "@/components/admin/EditUserDialog";
import { ArrowLeft, UserPlus, Loader2, RefreshCw, Users } from "lucide-react";
import { motion } from "framer-motion";

const UserManagement = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { users, isLoading, teamLeaders, fetchUsers, createUser, updateUser, deleteUser } =
    useAdminUsers();

  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      setCurrentUserId(session.user.id);
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/home");
    }
  }, [isAdmin, roleLoading, navigate]);

  const handleEdit = (user: UserWithRole) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  if (roleLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation */}
      <nav className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/home")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Logo variant="blue" className="h-8" />
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">User Management</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchUsers()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Create User
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-card rounded-lg p-4 shadow border border-border">
            <p className="text-sm text-muted-foreground">Total Users</p>
            <p className="text-2xl font-bold text-foreground">{users.length}</p>
          </div>
          <div className="bg-card rounded-lg p-4 shadow border border-border">
            <p className="text-sm text-muted-foreground">Admins</p>
            <p className="text-2xl font-bold text-destructive">
              {users.filter((u) => u.role === "admin").length}
            </p>
          </div>
          <div className="bg-card rounded-lg p-4 shadow border border-border">
            <p className="text-sm text-muted-foreground">Team Leaders</p>
            <p className="text-2xl font-bold text-secondary">
              {users.filter((u) => u.role === "team_leader").length}
            </p>
          </div>
          <div className="bg-card rounded-lg p-4 shadow border border-border">
            <p className="text-sm text-muted-foreground">Mentors</p>
            <p className="text-2xl font-bold text-primary">
              {users.filter((u) => u.role === "mentor").length}
            </p>
          </div>
        </motion.div>

        {/* User Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl shadow-lg p-6"
        >
          <UserTable
            users={users}
            onEdit={handleEdit}
            onDelete={deleteUser}
            currentUserId={currentUserId}
          />
        </motion.div>
      </main>

      {/* Create User Dialog */}
      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={createUser}
        teamLeaders={teamLeaders}
      />

      {/* Edit User Dialog */}
      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={selectedUser}
        onSubmit={updateUser}
        teamLeaders={teamLeaders}
      />
    </div>
  );
};

export default UserManagement;
