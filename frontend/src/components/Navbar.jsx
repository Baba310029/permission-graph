function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export default function Navbar() {
  const token = localStorage.getItem("token");

  const decoded = token ? decodeToken(token) : null;
  const authRole = decoded?.role; // ✅ DEFINE IT HERE
  return (
    <nav className="flex justify-between items-center px-8 py-4 border-b border-white/10">
      <div className="flex items-center gap-3">
        <div className="bg-cyan-500/20 text-cyan-400 p-2 rounded-lg">
          🧬
        </div>
        <h1 className="text-xl font-semibold tracking-wide">
          PermissionGraph
        </h1>
      </div>

      {/* <div className="flex items-center gap-6 text-white/70">
        <span className="text-cyan-400 cursor-pointer">Dashboard</span>
        <span className="cursor-pointer hover:text-white">
          Analysis
        </span>
      </div> */}
      {authRole && (
        <span className="px-2 py-1 text-xss rounded-lg font-medium bg-white/10 text-white/80">
          {authRole === "admin" ? "Admin" : "Viewer"}
        </span>
      )}

      <button
        onClick={() => {
          localStorage.removeItem("token");
          window.location.reload();
        }}
        className="border border-white/20 px-4 py-2 rounded-lg hover:bg-white/10 transition"
      >
        Sign Out
      </button>

    </nav>
  )
}
