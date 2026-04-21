import { AppRole } from "@/hooks/useUserRole";

interface RoleBadgeProps {
  role: AppRole | null;
  size?: "sm" | "md" | "lg";
}

const roleConfig = {
  admin: {
    label: "Administrator",
    className: "bg-red-100 text-red-700 border-red-200",
  },
  team_leader: {
    label: "Team Leader",
    className: "bg-amber-100 text-amber-700 border-amber-300",
  },
  super_team_leader: {
    label: "Super Team Leader",
    className: "bg-orange-100 text-orange-700 border-orange-300",
  },
  mentor: {
    label: "Mentor",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  community_moderator: {
    label: "Community Moderator",
    className: "bg-purple-100 text-purple-700 border-purple-200",
  },
};

const sizeClasses = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-3 py-1",
  lg: "text-base px-4 py-1.5",
};

export const RoleBadge = ({ role, size = "md" }: RoleBadgeProps) => {
  const config = roleConfig[(role as keyof typeof roleConfig) || "mentor"] ?? roleConfig.mentor;
  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${config.className} ${sizeClasses[size]}`}>
      {config.label}
    </span>
  );
};
