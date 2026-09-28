import { useState } from "react";
import { useStore } from "../store";
import { Panel } from "../components/ui";
import { navigate } from "../router";

export function Login() {
  const { userEmail, isAdmin, signIn, signOut } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (userEmail) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <Panel title="Signed in">
          <p className="text-[14px]">
            Signed in as <strong>{userEmail}</strong>
          </p>
          <p className="mt-1 text-[13px] text-mist">
            {isAdmin
              ? "Admin access granted — you can add, edit and tune the engine."
              : "This account has no admin flag, so the database is read-only for you."}
          </p>
          <button
            onClick={() => {
              void signOut().then(() => navigate("/"));
            }}
            className="mt-5 w-full rounded-lg border border-line bg-paper px-4 py-2 text-[14px] font-medium text-mist hover:text-ink"
          >
            Sign out
          </button>
        </Panel>
      </div>
    );
  }

  const submit = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setBusy(true);
    const msg = await signIn(email.trim(), password);
    setBusy(false);
    if (msg) setError(msg);
    else navigate("/binder");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="font-display text-2xl font-bold">Admin sign in</h1>
      <p className="mt-1 text-[13px] text-mist">
        The catalog is public, but writing needs an admin account (email + password).
      </p>
      <Panel className="mt-6">
        <label className="mb-1.5 block text-[13px] font-semibold" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          placeholder="admin@example.com"
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[14px] placeholder:text-mist/60 focus:border-ink/40"
        />
        <label className="mb-1.5 mt-4 block text-[13px] font-semibold" htmlFor="login-password">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[14px] focus:border-ink/40"
        />
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-punch-soft px-3 py-2 text-[13px] font-medium text-punch">
            {error}
          </p>
        )}
        <button
          onClick={() => void submit()}
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-punch px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-punch/90 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </Panel>
    </div>
  );
}
