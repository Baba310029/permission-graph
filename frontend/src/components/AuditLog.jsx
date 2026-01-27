import { useEffect, useState } from "react";

export default function AuditLog({ token, onRestore }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [undoTarget, setUndoTarget] = useState(null);
  const onUndo = async (log) => {
    try {
      const res = await fetch("http://localhost:4000/permissions/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          auditLogId: log.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Undo failed");
        return;
      }

      // Refresh logs
      const refreshed = await fetch("http://localhost:4000/audit-logs", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setLogs(await refreshed.json());
      onRestore?.();
    } catch (err) {
      console.error("Undo failed", err);
    }
  };

  const undoRoleChange = async (log) => {
    try {
      const res = await fetch(
        "http://localhost:4000/users/role/restore",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ auditLogId: log.id }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }

      // Refresh audit logs
      const refreshed = await fetch("http://localhost:4000/audit-logs", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setLogs(await refreshed.json());

      // Refresh graph + users
      onRestore?.();

    } catch (err) {
      console.error("Undo failed", err);
    }
  };


  useEffect(() => {
    fetch("http://localhost:4000/audit-logs", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load audit logs");
        return res.json();
      })
      .then((data) => {
        setLogs(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  if (loading) return <div>Loading audit logs...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="rounded-xl p-4 bg-slate-900/60 backdrop-blur-md border border-white/10">
      <h2 className="text-lg font-semibold mb-4 text-white">
        Audit Log
      </h2>

      <div className="max-h-50 overflow-y-auto pr-2 audit-scroll">
        <ul className="divide-y divide-white/10">
          {logs.map((log) => (
            <li
              key={log.id}
              className="relative py-3 flex gap-4 items-start text-sm"
            >
              {log.action === "permission_removed" && (
                <button
                  onClick={() => setUndoTarget(log)}
                  className="absolute top-3 right-3 p-1 rounded-md text-white/40 hover:text-white/80 hover:bg-white/10 transition"
                  title="Undo permission removal"
                >
                  ⟲
                </button>
              )}
              {log.action === "user_role_changed" && (
                <button
                  onClick={() => undoRoleChange(log)}
                  className="absolute top-3 right-3 p-1 rounded-md text-cyan-400 hover:text-cyan-300 hover:bg-white/10 transition"
                  title="Undo role change"
                >
                  ⟲
                </button>
              )}
              {/* Status dot */}
              <div
                className={`mt-1 h-2 w-2 rounded-full ${
                  log.action === "permission_removed"
                    ? "bg-red-500"
                    : log.action === "permission_restored"
                    ? "bg-green-500"
                    : log.action === "user_role_changed"
                    ? "bg-cyan-400"
                    : log.action === "user_role_restored"
                    ? "bg-blue-400"
                    : "bg-white/30"
                }`}
              />

              {/* Content */}
              <div className="flex flex-col gap-0.5">
                <div className="text-white/90">
                  {log.action === "user_role_restored" && (
                    <>
                      Restored role{" "}
                      <span className="font-mono text-blue-400">
                        {log.permission}
                      </span>{" "}
                      for{" "}
                      <span className="text-white">
                        {log.details?.userName}
                      </span>
                    </>
                  )}

                  {log.action === "permission_removed" && (
                    <>
                      Removed permission{" "}
                      <span className="font-mono text-white">
                        {log.permission}
                      </span>
                    </>
                  )}

                  {log.action === "permission_restored" && (
                    <>
                      Restored permission{" "}
                      <span className="font-mono text-white">
                        {log.permission}
                      </span>
                    </>
                  )}

                  {log.action === "user_role_changed" && (
                    <>
                      Changed role to{" "}
                      <span className="font-mono text-cyan-400">
                        {log.permission}
                      </span>{" "}
                      for{" "}
                      <span className="text-white">
                        {log.details?.userName}
                      </span>
                    </>
                  )}

                </div>

                <div className="text-xs text-white/40 flex items-center gap-3">
                  <span>👤 {log.actor}</span>
                  <span>⏱ {new Date(log.created_at).toLocaleString()}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {undoTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-6 w-[360px] border border-white/10">
            <h3 className="text-white font-semibold mb-2">
              Restore permission?
            </h3>

            <p className="text-white/60 text-sm mb-4">
              This will restore permission{" "}
              <span className="font-mono text-white">
                {undoTarget.permission}
              </span>.
            </p>

            <div className="flex justify-end gap-3">
              <button
                className="px-3 py-1.5 text-sm text-white/60 hover:text-white"
                onClick={() => setUndoTarget(null)}
              >
                Cancel
              </button>

              <button
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md"
                onClick={() => {
                  onUndo(undoTarget);
                  setUndoTarget(null);
                }}
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

}
