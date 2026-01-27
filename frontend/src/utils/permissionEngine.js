
// Get permissions of a user from backend-provided data
export function getUserPermissions(userId, users, rolePermissionsMap) {
  const user = users.find((u) => u.id === userId);
  if (!user) return [];

  return rolePermissionsMap[user.role] || [];
}


// Check if a user has a specific permission
export function hasPermission(rolePermissionsMap, role, permission) {
  return rolePermissionsMap[role]?.includes(permission);
}

