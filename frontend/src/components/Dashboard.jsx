import Card from "./Card"
import RadarPlaceholder from "./RadarPlaceholder"
import { hasPermission } from "../utils/permissionEngine";
import PermissionGraph from "../components/PermissionGraph";
import AuditLog from "../components/AuditLog";
import { useState, useEffect } from "react";
import UserList from "../components/UserList";

function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const currentUserId = 1; // TEMP: Alice
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  const [graphRefreshKey, setGraphRefreshKey] = useState(0);
  const decoded = token ? decodeToken(token) : null;

  const refreshGraph = () => {
    setGraphRefreshKey((k) => k + 1);
  };

  const [auditRefreshKey, setAuditRefreshKey] = useState(0);

  const refreshAuditLog = () => {
    setAuditRefreshKey((k) => k + 1);
  };

  if (!token) {
    return (
      <div className="h-screen flex items-center justify-center text-white/60">
        Please sign in again.
      </div>
    );
  }

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">
            My Permission Graph
          </h1>
          <p className="text-white/60">
            Analyze and visualize role–permission relationships.
          </p>
        </div>

        <div className="flex gap-4">
          <button className="border border-white/20 px-4 py-2 rounded-lg hover:bg-white/10 transition">
            Refresh Analysis
          </button>
          {hasPermission(currentUserId, "write") && (
            <button className="bg-cyan-500 text-black px-4 py-2 rounded-lg font-semibold hover:bg-cyan-400 transition">
              Add User / Role
            </button>
          )}

        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card title="Permission Graph Radar">
            <div className="mt-4 h-[400px]">
              <PermissionGraph
                key={graphRefreshKey}
                token={token}
                onRemove={refreshAuditLog}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {decoded?.role === "admin" && (
            <Card title="Audit Log">
              <AuditLog
                key={auditRefreshKey}
                token={token}
                onRestore={refreshGraph}
              />
            </Card>
          )}

          {decoded?.role === "admin" && (
            <Card title="Users">
              <UserList
                token={token}
                onRoleChange={() => {
                  refreshAuditLog();
                  refreshGraph();
                }}
              />
            </Card>
          )}

          <Card title="Pro Tip">
            <p className="text-white/60">
              Avoid circular role inheritance to prevent permission leaks.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
