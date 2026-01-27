export function getUsersImpactedByPermission(
  permission,
  users,
  rolePermissionsMap
) {
  const impactedUsers = [];

  users.forEach((user) => {
    const perms = rolePermissionsMap[user.role] || [];
    if (perms.includes(permission)) {
      impactedUsers.push({
        userId: user.id,
        role: user.role,
      });
    }
  });

  return impactedUsers;
}
