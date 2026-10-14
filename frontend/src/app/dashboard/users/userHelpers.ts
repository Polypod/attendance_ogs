export type UserRole = "admin" | "editor" | "instructor" | "staff" | "student";
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
    case "editor":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
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

// OGS single sign-on link, edited per user by an admin
export type OgsLink = {
  ogs_user_id: string;
  sso_enabled: boolean;
};

export type OgsLinkChanges = {
  ogs_user_id?: string | null;
  sso_enabled?: boolean;
};

export type OgsStaffAccount = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  status: string | null;
  isActive: boolean | null;
};

export function getOgsLinkFromUser(user: {
  external_identity?: { subject?: string } | null;
  sso_enabled?: boolean;
}): OgsLink {
  return {
    ogs_user_id: user.external_identity?.subject ?? "",
    sso_enabled: Boolean(user.sso_enabled),
  };
}

/**
 * Only the fields the admin changed, so saving a user's name never touches
 * the OGS link.
 */
export function buildOgsLinkChanges(initial: OgsLink, current: OgsLink): OgsLinkChanges {
  const changes: OgsLinkChanges = {};
  const id = current.ogs_user_id.trim();

  if (id !== initial.ogs_user_id.trim()) {
    changes.ogs_user_id = id || null;
  }
  const ssoEnabled = id ? current.sso_enabled : false;
  if (ssoEnabled !== initial.sso_enabled || (changes.ogs_user_id !== undefined && ssoEnabled)) {
    changes.sso_enabled = ssoEnabled;
  }
  return changes;
}

/**
 * The OGS role that lets an account sign in, using the same rule as the backend:
 * approved, not explicitly inactive, and admin (preferred) or editor.
 */
export function getOgsGrantedRole(account?: OgsStaffAccount | null): "admin" | "editor" | null {
  if (!account || account.status !== "approved" || account.isActive === false) return null;
  if (account.roles?.includes("admin")) return "admin";
  if (account.roles?.includes("editor")) return "editor";
  return null;
}
