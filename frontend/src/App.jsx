import { useState } from "react";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";

export default function App() {
  const [token, setToken] = useState(
    localStorage.getItem("token")
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState("");

  const login = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);
      setToken(data.token);
      location.reload();
    } catch (err) {
      setError("Server unreachable");
      setLoading(false);
    }
  };

  const register = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("http://localhost:4000/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      // After signup → switch to login
      setIsSignup(false);
      setError("Account created. Please sign in.");
      setLoading(false);
    } catch {
      setError("Server unreachable");
      setLoading(false);
    }
  };


  // 🔐 NOT LOGGED IN → SHOW INLINE LOGIN
  if (!token) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-black">
        <div className="w-[360px] bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">
            {isSignup ? "Create an account" : "Sign in to PermissionGraph"}
          </h2>
          <div className="space-y-3">
            {isSignup && (
              <input
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-800 text-white text-sm"
              />
            )}

            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800 text-white text-sm"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800 text-white text-sm"
            />
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={isSignup ? register : login}
            disabled={loading}
            className="mt-4 w-full bg-cyan-600 hover:bg-cyan-500 text-black font-semibold py-2 rounded-md transition"
          >
            {loading
              ? "Please wait..."
              : isSignup
              ? "Create Account"
              : "Sign In"}
          </button>

          <div className="mt-4 text-sm text-white/60 text-center">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <span
                  className="text-cyan-400 cursor-pointer hover:underline"
                  onClick={() => setIsSignup(false)}
                >
                  Sign in
                </span>
              </>
            ) : (
              <>
                New here?{" "}
                <span
                  className="text-cyan-400 cursor-pointer hover:underline"
                  onClick={() => setIsSignup(true)}
                >
                  Create an account
                </span>
              </>
            )}
          </div>

        </div>
      </div>
    );
  }

  // ✅ LOGGED IN → NORMAL APP
  return (
    <>
      <Navbar />
      <Dashboard />
    </>
  );
}
