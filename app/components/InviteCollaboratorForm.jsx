"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Mail, X } from "lucide-react";
import FixeaLoader from "./FixeaLoader";

/**
 * Invitación por mail: genera un código de acceso para un colaborador y lo
 * envía por correo. Si el servidor no tiene SMTP configurado, el código se
 * muestra igual para compartirlo a mano.
 */
export default function InviteCollaboratorForm({ projectId }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!projectId) return null;

  const close = () => {
    setOpen(false);
    setError("");
    setResult(null);
    setEmail("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (sending) return;

    const value = email.trim();
    if (!value) {
      setError("Ingresá el email del colaborador.");
      return;
    }

    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/projects/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, email: value }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo enviar la invitación.");
        return;
      }

      setResult({
        email: data.email || value,
        code: data.code || "",
        emailSent: Boolean(data.emailSent),
        warning: data.warning || "",
      });
    } catch {
      setError("No se pudo conectar con el servidor. Intentá de nuevo.");
    } finally {
      setSending(false);
    }
  };

  const copyCode = async () => {
    if (!result?.code) return;
    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles: el código queda seleccionable igual.
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-label="Invitar por mail"
        title="Invitar por mail"
        className="flex h-9 min-w-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#00E5FF]/40 bg-[#1F2029] px-2.5 text-xs font-bold text-[#00E5FF] transition-colors hover:border-[#00E5FF] hover:text-white"
      >
        <Mail className="h-4 w-4" aria-hidden="true" />
        <span>Invitar</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-[#00E5FF]/40 bg-[#1F2029] p-4 shadow-[0_0_30px_rgba(0,229,255,0.18)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-white">
                Invitar por mail
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Le enviamos un código para unirse a este proyecto.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar"
              className="cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {result ? (
            <div className="mt-4">
              <p
                className={`text-[11px] font-semibold ${
                  result.emailSent ? "text-[#00FF66]" : "text-[#FFEA00]"
                }`}
              >
                {result.emailSent
                  ? `Código enviado a ${result.email}.`
                  : `No se pudo enviar el mail. Compartí este código con ${result.email}:`}
              </p>

              {!result.emailSent && result.warning && (
                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                  {result.warning}
                </p>
              )}

              <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#0B0C10] py-1 pl-3 pr-1">
                <code className="flex-1 select-all font-mono text-xs font-bold tracking-wider text-white">
                  {result.code}
                </code>
                <button
                  type="button"
                  onClick={copyCode}
                  aria-label={copied ? "Código copiado" : "Copiar código"}
                  title={copied ? "¡Copiado!" : "Copiar código"}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#00E5FF]/10 hover:text-[#00E5FF]"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-[#00FF66]" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setEmail("");
                  setError("");
                }}
                className="mt-3 w-full cursor-pointer rounded-xl border border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-300 transition-colors hover:border-[#00E5FF] hover:text-white"
              >
                Invitar a otro email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4" noValidate>
              <label
                htmlFor={`invite-email-${projectId}`}
                className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400"
              >
                Email del colaborador
              </label>
              <input
                id={`invite-email-${projectId}`}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError("");
                }}
                placeholder="cliente@empresa.com"
                aria-invalid={Boolean(error)}
                className="w-full rounded-xl border border-slate-700 bg-[#0B0C10] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/20"
              />

              {error && (
                <p role="alert" className="mt-2 text-[11px] font-semibold text-[#FF5C8A]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={sending}
                className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#00E5FF]/60 bg-[#1F2029] px-4 py-2.5 text-xs font-bold text-[#00E5FF] transition-colors hover:border-[#00E5FF] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? (
                  <FixeaLoader size={14} />
                ) : (
                  <Mail className="h-4 w-4" aria-hidden="true" />
                )}
                {sending ? "Enviando…" : "Enviar código por mail"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
