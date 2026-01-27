import { useEffect, useState } from "react";

function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export default function UserList({ token, onRoleChange }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingChange, setPendingChange] = useState(null);
  const decoded = token ? decodeToken(token) : null;
  const isAdmin = decoded?.role === "admin";

  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "viewer",
  });

  const AVAILABLE_ROLES = ["admin", "editor", "viewer"];

  useEffect(() => {
    fetch("http://localhost:4000/users", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load users");
        return res.json();
      })
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return <div className="text-white/60">Loading users…</div>;
  }

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  const changeRole = async (userId, newRole) => {
    try {
      const res = await fetch(`http://localhost:4000/users/${userId}/role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to change role");
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, role: newRole } : u
        )
      );
      onRoleChange?.();
    } catch (err) {
      console.error("Role update failed", err);
      alert("Role update failed");
    }
  };

  const createUser = async () => {
    try {
      const res = await fetch("http://localhost:4000/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newUser),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(JSON.stringify(err));
        return;
      }

      // Refresh users
      const refreshed = await fetch("http://localhost:4000/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUsers(await refreshed.json());
      setShowAddUser(false);
      setNewUser({
        name: "",
        email: "",
        password: "",
        role: "viewer",
      });
      onRoleChange?.();
    } catch (err) {
      console.error("Create user failed", err);
      alert("Create user failed");
    }
  };

  const deleteUser = async (id) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const res = await fetch(`http://localhost:4000/users/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to delete user");
        return;
      }

      // Remove from UI
      setUsers((prev) => prev.filter((u) => u.id !== id));
      onRoleChange?.();
    } catch (err) {
      console.error("Delete user failed", err);
      alert("Delete user failed");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {isAdmin && (
          <button
            onClick={() => setShowAddUser(true)}
            className="text-xs px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
          >
            + Add User
          </button>
        )}
      </div>

      {users.map((user) => (
        <div
          key={user.id}
          className="flex items-center justify-between px-3 py-2 rounded-md bg-white/5 border border-white/10"
        >
          <div>
            <div className="text-white">{user.name}</div>
            <div className="text-xs text-white/50">{user.email}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Role</span>
            { /* select here */ }

            <select
              value={user.role}
              onChange={(e) =>
                setPendingChange({
                  user,
                  newRole: e.target.value,
                })
              }
              disabled={!isAdmin}
              className={`
                bg-slate-800/70
                text-slate-200
                text-xs
                px-3
                py-1.5
                rounded-md
                border
                border-slate-600/40
                focus:outline-none
                focus:ring-2
                focus:ring-cyan-500/40
                transition
                ${!isAdmin ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-700/70 cursor-pointer"}
              `}
            >

              {AVAILABLE_ROLES.map((role) => (
                <option
                  key={role}
                  value={role}
                  className="bg-slate-900 text-slate-200"
                >
                  {role}
                </option>
              ))}
            </select>
            {isAdmin && (
              <button
                onClick={() => deleteUser(user.id)}
                className="ml-2 text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            )}
          </div>

        </div>
      ))}
      {pendingChange && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-[360px]">
            <h3 className="text-white font-semibold mb-2">
              Confirm role change
            </h3>

            <p className="text-white/60 text-sm mb-4">
              Change role of{" "}
              <span className="text-white font-medium">
                {pendingChange.user.name}
              </span>{" "}
              to{" "}
              <span className="text-cyan-400 font-mono">
                {pendingChange.newRole}
              </span>
              ?
            </p>

            <div className="flex justify-end gap-3">
              <button
                className="px-3 py-1.5 text-sm text-white/60 hover:text-white"
                onClick={() => setPendingChange(null)}
              >
                Cancel
              </button>

              <button
                className="px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-md"
                onClick={() => {
                  changeRole(
                    pendingChange.user.id,
                    pendingChange.newRole
                  );
                  setPendingChange(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-[380px]">
            <h3 className="text-white font-semibold mb-4">
              Create new user
            </h3>

            <div className="space-y-3">
              <input
                placeholder="Name"
                value={newUser.name}
                onChange={(e) =>
                  setNewUser({ ...newUser, name: e.target.value })
                }
                className="w-full px-3 py-2 rounded bg-slate-800 text-white text-sm"
              />

              <input
                placeholder="Email"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser({ ...newUser, email: e.target.value })
                }
                className="w-full px-3 py-2 rounded bg-slate-800 text-white text-sm"
              />

              <input
                type="password"
                placeholder="Password"
                value={newUser.password}
                onChange={(e) =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
                className="w-full px-3 py-2 rounded bg-slate-800 text-white text-sm"
              />

              <select
                value={newUser.role}
                onChange={(e) =>
                  setNewUser({ ...newUser, role: e.target.value })
                }
                className="w-full px-3 py-2 rounded bg-slate-800 text-white text-sm"
              >
                {AVAILABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                className="text-sm text-white/60 hover:text-white"
                onClick={() => setShowAddUser(false)}
              >
                Cancel
              </button>

              <button
                className="text-sm bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-1.5 rounded-md"
                onClick={createUser}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
