export type UserRole = "admin" | "instructor" | "staff" | "student";
export type UserStatus = "active" | "inactive" | "suspended";

export type UserLike = {
  name: string;
  role: UserRole;
  status: UserStatus;
  last_login?: string;
};

export type EditUserForm = {
  name: string;
  role: UserRole;
  status: UserStatus;
};

export function buildEditUserFormFromUser(user: UserLike): EditUserForm {
  return {
    name: user.name,
    role: user.role,
    status: user.status,
  };
}

export function getRoleBadgeColor(role: UserRole): string {
  switch (role) {
    case "admin":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "instructor":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "staff":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "student":
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getStatusBadgeColor(status: UserStatus): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "inactive":
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    case "suspended":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function formatLastLogin(lastLoginIso?: string): string {
  if (!lastLoginIso) return "Never";
  return new Date(lastLoginIso).toLocaleDateString();
}
