import { useState } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { ShieldCheck, Lock, User } from "lucide-react";

const FIXED_ID = "admin";
const FIXED_PASSWORD = "admin@123";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && localStorage.getItem("ct_auth") === "true") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (loginId.trim() === FIXED_ID && password === FIXED_PASSWORD) {
      localStorage.setItem("ct_auth", "true");
      navigate({ to: "/dashboard" });
    } else {
      setError("Invalid login ID or password.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0b0f14",
        padding: 20,
      }}
    >
      <div
        className="panel"
        style={{
          width: "min(400px, 100%)",
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src="/favicon.png"
            alt="CryptoTrace logo"
            style={{ width: 40, height: 40, objectFit: "contain", flexShrink: 0 }}
          />
          <div>
            <strong style={{ display: "block", fontSize: 16, lineHeight: 1.3 }}>CryptoTrace</strong>
            <span style={{ fontSize: 11, color: "#8798a8", letterSpacing: 0.5 }}>INVESTIGATION OS</span>
          </div>
        </div>

        <div>
          <h2 style={{ margin: 0, fontSize: 19 }}>Admin Portal Login</h2>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#8798a8" }}>
            Sign in to access the investigation workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#8798a8" }}>Login ID</span>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <User
                size={15}
                style={{
                  position: "absolute",
                  left: 12,
                  color: "#8798a8",
                  pointerEvents: "none",
                }}
              />
              <input
                className="text-input"
                style={{
                  paddingLeft: 36,
                  width: "100%",
                  boxSizing: "border-box",
                  height: 42,
                }}
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Enter login ID"
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#8798a8" }}>Password</span>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Lock
                size={15}
                style={{
                  position: "absolute",
                  left: 12,
                  color: "#8798a8",
                  pointerEvents: "none",
                }}
              />
              <input
                type="password"
                className="text-input"
                style={{
                  paddingLeft: 36,
                  width: "100%",
                  boxSizing: "border-box",
                  height: 42,
                }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "#ff6b6b" }}>{error}</div>
          )}

          <button
            type="submit"
            className="primary-button"
            style={{ justifyContent: "center", height: 44, marginTop: 4 }}
          >
            <ShieldCheck size={16} /> Sign in
          </button>
        </form>
      </div>
    </div>
  );
}