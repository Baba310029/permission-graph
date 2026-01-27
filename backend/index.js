import express from "express";
import cors from "cors";
import pool from "./db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const app = express();
const JWT_SECRET = "super-secret-key";

app.use(cors());
app.use(express.json());

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function isAdmin(req) {
  return req.user?.role === "admin";
}

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM auth_users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});


// 🔴 DATABASE CONNECTION TEST — THIS MUST EXIST
pool.query("SELECT NOW()")
  .then(() => console.log("Database connected"))
  .catch(err => {
    console.error("Database connection failed");
    console.error(err);
  });

app.get("/graph", async (req, res) => {
  try {
    const usersResult = await pool.query(`
      SELECT u.id, u.name, r.name AS role
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
    `);

    const rolesResult = await pool.query(`
      SELECT r.id, r.name, p.name AS permission
      FROM roles r
      JOIN role_permissions rp ON rp.role_id = r.id
      JOIN permissions p ON p.id = rp.permission_id
    `);

    res.json({
      users: usersResult.rows,
      roles: rolesResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load graph data" });
  }
});

app.get("/impact", async (req, res) => {
  const { permission } = req.query;

  if (!permission) {
    return res.status(400).json({ error: "Permission is required" });
  }

  try {
    const result = await pool.query(`
      SELECT u.id AS user_id, u.name AS user_name, r.name AS role
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      JOIN role_permissions rp ON rp.role_id = r.id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.name = $1
    `, [permission]);

    res.json({
      permission,
      impactedUsers: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impact analysis failed" });
  }
});

app.post("/permissions/remove", authenticate, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Forbidden: admin access required" });
  }

  const { permission } = req.body;

  if (!permission) {
    return res.status(400).json({ error: "Permission is required" });
  }

  try {
    // 1️⃣ Find permission id
    const permResult = await pool.query(
      "SELECT id FROM permissions WHERE name = $1",
      [permission]
    );

    if (permResult.rows.length === 0) {
      return res.status(404).json({ error: "Permission not found" });
    }

    const permissionId = permResult.rows[0].id;

    // 2️⃣ Compute impact BEFORE removal
    const impactResult = await pool.query(
      `
      SELECT u.id, u.name, r.name AS role
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      JOIN role_permissions rp ON rp.role_id = r.id
      WHERE rp.permission_id = $1
      `,
      [permissionId]
    );

    // 3️⃣ Remove permission from roles
    await pool.query(
      "DELETE FROM role_permissions WHERE permission_id = $1",
      [permissionId]
    );

    // 4️⃣ Audit log
    await pool.query(
      `
      INSERT INTO audit_logs (action, permission, details, actor)
      VALUES ($1, $2, $3, $4)
      `,
      [
        "permission_removed",
        permission,
        JSON.stringify({ impactedUsers: impactResult.rows }),
        req.user.email,
      ]
    );

    res.json({
      removedPermission: permission,
      impactedUsers: impactResult.rows,
      status: "removed",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Permission removal failed" });
  }
});


app.post("/permissions/restore", authenticate, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Forbidden: admin access required" });
  }

  const { auditLogId } = req.body;

  if (!auditLogId) {
    return res.status(400).json({ error: "auditLogId is required" });
  }

  try {
    // 1️⃣ Fetch audit entry
    const auditResult = await pool.query(
      "SELECT * FROM audit_logs WHERE id = $1",
      [auditLogId]
    );

    if (auditResult.rows.length === 0) {
      return res.status(404).json({ error: "Audit log not found" });
    }

    const audit = auditResult.rows[0];

    if (audit.action !== "permission_removed") {
      return res.status(400).json({ error: "This action cannot be restored" });
    }

    // details may already be JSON or may need parsing
    const details =
      typeof audit.details === "string"
        ? JSON.parse(audit.details)
        : audit.details;

    const impactedUsers = details?.impactedUsers || [];
    if (impactedUsers.length === 0) {
      return res.status(400).json({
        error: "No impacted roles found for this audit entry",
      });
    }
    const permissionName = audit.permission;

    // 2️⃣ Get permission id
    const permResult = await pool.query(
      "SELECT id FROM permissions WHERE name = $1",
      [permissionName]
    );

    if (permResult.rows.length === 0) {
      return res.status(404).json({ error: "Permission not found" });
    }

    const permissionId = permResult.rows[0].id;

    // 3️⃣ Restore permission to impacted roles
    for (const user of impactedUsers) {
      const roleResult = await pool.query(
        "SELECT id FROM roles WHERE name = $1",
        [user.role]
      );

      if (roleResult.rows.length === 0) continue;

      const roleId = roleResult.rows[0].id;

      await pool.query(
        `
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [roleId, permissionId]
      );
    }

    // 4️⃣ Log restoration
    await pool.query(
      `
      INSERT INTO audit_logs (action, permission, details, actor)
      VALUES ($1, $2, $3, $4)
      `,
      [
        "permission_restored",
        permissionName,
        JSON.stringify({ restoredFromAudit: auditLogId }),
        req.user.email,
      ]
    );

    res.json({
      restoredPermission: permissionName,
      restoredRoles: [...new Set(impactedUsers.map(u => u.role))],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Permission restore failed" });
  }
});

app.get("/audit-logs", authenticate, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Admin only" });
  }

  try {
    const result = await pool.query(
      `
      SELECT id, action, permission, actor, details, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 50
      `
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

app.get("/users", authenticate, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Admin only" });
  }

  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        r.name AS role
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      ORDER BY u.id
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// ✅ Admin-only: Create new user
app.post("/users", authenticate, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Admin only" });
  }

  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({
      error: "name, email, password, and role are required",
    });
  }

  try {
    // 1️⃣ Check email uniqueness
    const existing = await pool.query(
      "SELECT id FROM auth_users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email already exists" });
    }

    // 2️⃣ Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 3️⃣ Create auth user
    const authRole = role === "admin" ? "admin" : "viewer";

    const authResult = await pool.query(
      `
      INSERT INTO auth_users (email, password_hash, role)
      VALUES ($1, $2, authRole)
      RETURNING id
      `,
      [email, passwordHash, authRole]
    );

    const authUserId = authResult.rows[0].id;

    // 4️⃣ Create user profile (DO NOT INSERT id)
    const userResult = await pool.query(
      `
      INSERT INTO users (name, email)
      VALUES ($1, $2)
      RETURNING id
      `,
      [name, email]
    );

    const userId = userResult.rows[0].id;


    // 5️⃣ Assign role
    const roleResult = await pool.query(
      "SELECT id FROM roles WHERE name = $1",
      [role]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json({ error: "Role not found" });
    }

    await pool.query(
      `
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1, $2)
      `,
      [userId, roleResult.rows[0].id]
    );

    // 6️⃣ Audit log
    await pool.query(
      `
      INSERT INTO audit_logs (action, permission, details, actor)
      VALUES ($1, $2, $3, $4)
      `,
      [
        "user_created",
        role,
        JSON.stringify({ userId: authUserId, userName: name }),
        req.user.email,
      ]
    );

    res.status(201).json({
      status: "created",
      userId,
      name,
      email,
      role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "User creation failed" });
  }
});

// ❌ Admin-only: delete user
app.delete("/users/:id", authenticate, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Admin only" });
  }

  const userId = req.params.id;

  try {
    // Prevent admin from deleting themselves (important safety)
    if (req.user.id === Number(userId)) {
      return res.status(400).json({
        error: "You cannot delete your own account",
      });
    }

    // Remove role mapping
    await pool.query(
      "DELETE FROM user_roles WHERE user_id = $1",
      [userId]
    );

    // Remove user profile
    await pool.query(
      "DELETE FROM users WHERE id = $1",
      [userId]
    );

    // Remove auth record
    await pool.query(
      "DELETE FROM auth_users WHERE id = $1",
      [userId]
    );

    // Audit log
    await pool.query(
      `
      INSERT INTO audit_logs (action, details, actor)
      VALUES ($1, $2, $3)
      `,
      [
        "user_deleted",
        JSON.stringify({ userId }),
        req.user.email,
      ]
    );

    res.json({ status: "deleted" });
  } catch (err) {
    console.error("User deletion failed:", err);
    res.status(500).json({ error: "User deletion failed" });
  }
});

app.post("/users/:id/role", authenticate, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Admin only" });
  }

  const userId = Number(req.params.id);
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({ error: "Role is required" });
  }

  try {
    // 1️⃣ Verify user exists
    const userResult = await pool.query(
      "SELECT id, name FROM users WHERE id = $1",
      [userId]
    );

    // 🔁 Get current role BEFORE changing it
    const currentRoleResult = await pool.query(
      `
      SELECT r.name
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
      `,
      [userId]
    );

    const previousRole = currentRoleResult.rows[0].name;


    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult.rows[0];

    // 2️⃣ Verify role exists
    const roleResult = await pool.query(
      "SELECT id FROM roles WHERE name = $1",
      [role]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json({ error: "Role not found" });
    }

    const roleId = roleResult.rows[0].id;

    // 3️⃣ Update user role
    await pool.query(
      "UPDATE user_roles SET role_id = $1 WHERE user_id = $2",
      [roleId, userId]
    );

    // 4️⃣ Audit log
    await pool.query(
      `
      INSERT INTO audit_logs (action, permission, details, actor)
      VALUES ($1, $2, $3, $4)
      `,
      [
        "user_role_changed",
        role,
        JSON.stringify({
          userId,
          userName: user.name,
          previousRole,
        }),
        req.user.email,
      ]
    );

    res.json({
      status: "ok",
      userId,
      newRole: role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update role" });
  }
});

app.post("/users/role/restore", authenticate, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Admin only" });
  }

  const { auditLogId } = req.body;

  if (!auditLogId) {
    return res.status(400).json({ error: "auditLogId is required" });
  }

  try {
    // 1️⃣ Load audit entry
    const auditResult = await pool.query(
      "SELECT * FROM audit_logs WHERE id = $1",
      [auditLogId]
    );

    if (auditResult.rows.length === 0) {
      return res.status(404).json({ error: "Audit entry not found" });
    }

    const audit = auditResult.rows[0];

    if (audit.action !== "user_role_changed") {
      return res.status(400).json({ error: "Invalid audit action" });
    }

    const details =
      typeof audit.details === "string"
        ? JSON.parse(audit.details)
        : audit.details;

    const { userId, previousRole } = details;

    if (!previousRole) {
      return res
        .status(400)
        .json({ error: "No previous role recorded" });
    }

    // 2️⃣ Restore role
    const roleResult = await pool.query(
      "SELECT id FROM roles WHERE name = $1",
      [previousRole]
    );

    await pool.query(
      "UPDATE user_roles SET role_id = $1 WHERE user_id = $2",
      [roleResult.rows[0].id, userId]
    );

    // Fetch user name
    const userResult = await pool.query(
      "SELECT name FROM users WHERE id = $1",
      [userId]
    );

    const userName = userResult.rows[0]?.name;

    await pool.query(
      `
      INSERT INTO audit_logs (action, permission, details, actor)
      VALUES ($1, $2, $3, $4)
      `,
      [
        "user_role_restored",
        previousRole,
        JSON.stringify({ userId, userName }),
        req.user.email,
      ]
    );

    res.json({ status: "restored" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Role restore failed" });
  }
});

// 🌐 Public signup — viewer only
app.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields required" });
  }

  try {
    const exists = await pool.query(
      "SELECT id FROM auth_users WHERE email = $1",
      [email]
    );

    if (exists.rows.length > 0) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // 1️⃣ auth user → always normal user
    const authResult = await pool.query(
      `
      INSERT INTO auth_users (email, password_hash, role)
      VALUES ($1, $2, 'viewer')
      RETURNING id
      `,
      [email, passwordHash]
    );

    // 2️⃣ user profile
    const userResult = await pool.query(
      `INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id`,
      [name, email]
    );

    if (!userResult.rows[0]) {
      throw new Error("User insert failed");
    }

    const userId = userResult.rows[0].id;


      // 3️⃣ assign viewer role
    const viewerRole = await pool.query(
      "SELECT id FROM roles WHERE name = 'viewer'"
    );

    if (viewerRole.rows.length === 0) {
      return res.status(500).json({
        error: "Viewer role not configured in system"
      });
    }

    await pool.query(
      "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)",
      [userId, viewerRole.rows[0].id]
    );

    res.status(201).json({ status: "registered" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});


app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
