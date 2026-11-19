"use client";

import { useEffect, useState } from "react";
import { Link2, Mail } from "lucide-react";
import FixeaLoader from "./FixeaLoader";

export default function JoinProjectForm({ onJoined, autoFocus = false, compact = false }) {
  const [key, setKey] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let invite = "";
    try {
      invite = new URLSearchParams(window.location.search).get("invite") || "";
    } catch {
      invite = "";
    }
    if (!invite) return undefined;

    const timer = setTimeout(() => setKey(invite.trim()), 0);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (joining) return;

    const value = key.trim();
    if (!value) {
      setError("Pegá el código que te llegó por mail.");
      return;
    }

    setJoining(true);
    setError("");

    try {
      const res = await fetch("/api/projects/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: value, inviteCode: value }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success || !data?.project) {
        setError(data?.error || "No se pudo vincular el proyecto.");
        return;
      }

      setKey("");
      onJoined?.(data.project, { alreadyMember: Boolean(data.alreadyMember) });
    } catch {
      setError("No se pudo conectar con el servidor. Intentá de nuevo.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full text-left" noValidate>
      <label
        htmlFor="join-project-code"
        className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400"
      >
        Código de invitación
      </label>
      <div className={`flex gap-2 ${compact ? "flex-col" : "flex-col sm:flex-row"}`}>
        <div className="relative flex-1">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00E5FF]/70"
            aria-hidden="true"
          />
          <input
            id="join-project-code"
            name="inviteCode"
            type="text"
            autoComplete="off"
            spellCheck={false}
            autoFocus={autoFocus}
            maxLength={40}
            value={key}
            onChange={(event) => {
              setKey(event.target.value);
              if (error) setError("");
            }}
            placeholder="FXI-XXXX-XXXX"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "join-project-error" : undefined}
            className="w-full rounded-xl border border-slate-700 bg-[#0B0C10] py-2.5 pl-9 pr-3 font-mono text-sm uppercase tracking-wider text-white placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-600 focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/20"
          />
        </div>
        <button
          type="submit"
          disabled={joining}
          className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#00E5FF]/60 bg-[#1F2029] px-4 py-2.5 text-xs font-bold text-[#00E5FF] transition-colors hover:border-[#00E5FF] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {joining ? <FixeaLoader size={14} /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
          {joining ? "Ingresando…" : "Ingresar al proyecto"}
        </button>
      </div>
      {error && (
        <p
          id="join-project-error"
          role="alert"
          className="mt-2 text-xs font-semibold text-[#FF5C8A]"
        >
          {error}
        </p>
      )}
    </form>
  );
}
