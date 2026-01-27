import React, { useMemo, useState, useCallback, useEffect } from "react";
import ReactFlow from "reactflow";
import "reactflow/dist/style.css";
import { Background, Controls } from "reactflow";

const currentUserId = 1; // TEMP: Alice

export default function PermissionGraph({ token, onRemove }) {

  const [graphData, setGraphData] = useState(null);
  const [removedPermission, setRemovedPermission] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [impactData, setImpactData] = useState(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  useEffect(() => {
    fetch("http://localhost:4000/graph")
      .then(res => res.json())
      .then(data => setGraphData(data))
      .catch(err => console.error("Failed to load graph data", err));
  }, []);

  useEffect(() => {
    if (!removedPermission) {
      setImpactData(null);
      return;
    }

    fetch(`http://localhost:4000/impact?permission=${removedPermission}`)
      .then(res => res.json())
      .then(data => setImpactData(data))
      .catch(err => {
        console.error("Failed to load impact data", err);
        setImpactData(null);
      });
  }, [removedPermission]);

  useEffect(() => {
    setSelectedUser(null);
  }, [removedPermission]);

  const impactedUserIds = impactData
    ? impactData.impactedUsers.map(u => u.user_id)
    : [];

    // USERS FROM BACKEND
  const users = graphData?.users || [];

  const rolePermissionsMap = useMemo(() => {
    const map = {};
    graphData?.roles?.forEach((rp) => {
      if (!map[rp.name]) map[rp.name] = [];
      map[rp.name].push(rp.permission);
    });
    return map;
  }, [graphData]);


  let explanation = null;

  if (selectedUser && !removedPermission) {
    explanation = `${selectedUser.name} has the role "${selectedUser.role}".`;
  }

  if (selectedUser && removedPermission && impactData) {
    const impacted = impactData.impactedUsers.find(
      (u) => u.user_id === selectedUser.id
    );

    if (impacted) {
      explanation = `${selectedUser.name} is impacted because their role "${impacted.role}" includes the permission "${removedPermission}", which is being simulated as removed.`;
    } else {
      explanation = `${selectedUser.name} is not impacted by the removal of "${removedPermission}" because their role "${selectedUser.role}" does not include this permission.`;
    }
  }



  const { nodes, edges } = useMemo(() => {
    const nodes = [];
    const edges = [];
    const activeUser = users.find((u) => u.id === currentUserId);
    const activeRole = activeUser?.role;
    const activePermissions = rolePermissionsMap[activeRole] || [];

    const impactedRoles = new Set(
      impactData ? impactData.impactedUsers.map((u) => u.role) : []
    );

    // User nodes
    users.forEach((user, index) => {
      const isActiveUser = user.id === currentUserId;

      const isImpactedUser = impactedUserIds.includes(user.id);

      nodes.push({
        id: `user-${user.id}`,
        type: "user",
        data: {
          label: isImpactedUser ? `⚠️ ${user.name}` : `👤 ${user.name}`,
          user: user,
        },
        position: { x: 50, y: 100 + index * 100 },
        style: {
        //   background: isImpactedUser
        //     ? "rgba(239,68,68,0.25)"
        //     : "rgba(14,165,233,0.15)",
        //   border: isImpactedUser
        //     ? "1px solid rgba(248,113,113,0.6)"
        //     : "1px solid rgba(56,189,248,0.3)",
          background: isImpactedUser
            ? "rgba(239,68,68,0.18)"
            : "rgba(14,165,233,0.12)",
          border: isImpactedUser
            ? "1px solid rgba(248,113,113,0.5)"
            : "1px solid rgba(56,189,248,0.25)",

          color: "#fff",
          opacity: isImpactedUser ? 1 : 0.35,
        },
      });


      // edges.push({
      //   id: `edge-user-role-${user.id}`,
      //   source: `user-${user.id}`,
      //   target: `role-${user.role}`,
      // });

      edges.push({
        id: `edge-user-role-${user.id}`,
        source: `user-${user.id}`,
        target: `role-${user.role}`,
        // type: "smoothstep",
        // animated: false,
        style: {
          stroke: "#cbd5f5",
          strokeWidth: 1,
          opacity: 0.4,
          filter: "drop-shadow(0 0 1px rgba(203,213,245,0.3))",
        },
      });

    });


    Object.entries(rolePermissionsMap).forEach(([role, perms], roleIndex) => {
      const isActiveRole = role === activeRole;
      const isImpactedRole = impactedRoles.has(role);

      nodes.push({
        id: `role-${role}`,
        data: { label: `🛡️ ${role}` },
        position: { x: 300, y: 80 + roleIndex * 120 },
        // style: {
        //   background: isImpactedRole
        //     ? "rgba(239,68,68,0.15)"
        //     : "rgba(139,92,246,0.08)",
        //   border: isImpactedRole
        //     ? "1px solid rgba(248,113,113,0.4)"
        //     : "1px solid rgba(167,139,250,0.25)",
        //   color: "#fff",
        //   opacity: removedPermission
        //     ? isImpactedRole ? 0.85 : 0.25
        //     : 0.85,
        // },
        style: {
          background: isImpactedRole
            ? "rgba(139,92,246,0.18)"
            : "rgba(139,92,246,0.08)",
          border: "1px solid rgba(167,139,250,0.25)",
          color: "#fff",
          opacity: removedPermission
            ? isImpactedRole ? 0.7 : 0.25
            : 0.85,
        }

      });




      perms.forEach((perm, permIndex) => {
        const permId = `perm-${perm}`;
        const isRemovedPermission = perm === removedPermission;

        if (!nodes.find((n) => n.id === permId)) {
          const isActivePermission = activePermissions.includes(perm);

          nodes.push({
            id: permId,
            type: "permission",
            data: {
              label: isRemovedPermission ? `❌ ${perm}` : `✓ ${perm}`,
              permission: perm,
            },
            position: { x: 550, y: 100 + permIndex * 100 },
            style: {
              // background: isRemovedPermission
              //   ? "rgba(239,68,68,0.25)"
              //   : "rgba(34,197,94,0.15)",
              // border: isRemovedPermission
              //   ? "1px solid rgba(248,113,113,0.6)"
              //   : "1px solid rgba(74,222,128,0.3)",
              background: isRemovedPermission
                ? "rgba(239,68,68,0.22)"
                : "rgba(34,197,94,0.12)",
              border: isRemovedPermission
                ? "1px solid rgba(248,113,113,0.6)"
                : "1px solid rgba(74,222,128,0.25)",

              color: "#fff",
              opacity: isRemovedPermission ? 1 : 0.35,
              cursor: "pointer",
            },
          });
        }

        edges.push({
          id: `edge-role-perm-${role}-${perm}`,
          source: `role-${role}`,
          target: permId,
          // type: "smoothstep",
          // animated: false,
          style: {
          stroke: "#cbd5f5",
          strokeWidth: 1,
          opacity: 0.4,
          filter: "drop-shadow(0 0 1px rgba(203,213,245,0.3))",
        },
        });
      });
    });

    return { nodes, edges };
  }, [graphData, removedPermission, impactData, impactedUserIds]);

  const handleNodeClick = useCallback((_, node) => {
    if (node.type === "permission") {
      setRemovedPermission(node.data.permission);
    }

    if (node.type === "user") {
      setSelectedUser(node.data.user);
    }
  }, []);

  const applyPermissionRemoval = async () => {
    try {
      const res = await fetch("http://localhost:4000/permissions/remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permission: removedPermission }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Failed to remove permission");
        return;
      }

      const data = await res.json();
      console.log("Permission removed:", data);

      setRemovedPermission(null);
      setSelectedUser(null);
      setImpactData(null);
      setConfirmingRemoval(false);

      // refresh graph
      const refreshed = await fetch("http://localhost:4000/graph");
      const graph = await refreshed.json();
      setGraphData(graph);
      onRemove?.();

    } catch (err) {
      console.error("Failed to remove permission", err);
    }
  };




  if (!graphData) {
    return (
      <div className="h-105 flex items-center justify-center text-white/50">
        Loading permission graph...
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <div className="w-[280px] shrink-0">
        {selectedUser ? (
          <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-4">
            <h3 className="text-sm font-semibold mb-2 text-white/90">
              Impact Explanation
            </h3>

            <p className="text-sm text-white/70 leading-relaxed">
              {explanation}
            </p>

            {removedPermission && impactData && (
              <div className="mt-4 flex gap-3">
                <button
                  className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-sm"
                  onClick={() => setConfirmingRemoval(true)}
                >
                  Confirm removal
                </button>

                <button
                  className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700 text-white text-sm"
                  onClick={() => setRemovedPermission(null)}
                >
                  Cancel
                </button>
              </div>
            )}

            {confirmingRemoval && (
              <div className="mt-4 p-4 rounded border border-red-500/40 bg-red-500/10 text-sm text-white">
                <p className="mb-3">
                  This will permanently remove the permission{" "}
                  <strong>{removedPermission}</strong> from all roles.
                </p>

                <div className="flex gap-3">
                  <button
                    className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white"
                    onClick={applyPermissionRemoval}
                  >
                    Yes, remove
                  </button>

                  <button
                    className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700 text-white"
                    onClick={() => setConfirmingRemoval(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-white/40">
            Click a user to see their role and permission impact.
          </div>
        )}
      </div>

      <div className="relative h-[420px] flex-1 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(56,189,248,0.08)]">

        {removedPermission && (
          <button
            onClick={() => {
              setRemovedPermission(null);
            }}
            className="absolute top-3 right-3 z-10
                      px-3 py-1.5 rounded-lg
                      text-xs font-medium
                      bg-red-500/10 text-red-400
                      border border-red-500/20
                      hover:bg-red-500/20
                      transition"
          >
            Clear simulation
          </button>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          onNodeClick={handleNodeClick}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={32} size={1} color="#1e293b" />
        </ReactFlow>
      </div>

    </div>
  );

}
