"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

export default function InviteCodeResult({
  projectName = "",
  email = "",
  code = "",
  emailSent = false,
  warning = "",
  onClose,
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
    }
  };

  return (
    <div className="mt-5">
      <p className="text-sm font-black text-[#00FF66]">
        {projectName
          ? `"${projectName}" se creó correctamente.`
          : "Proyecto creado correctamente."}
      </p>

      <p className="mt-2 text-xs leading-relaxed text-slate-300">
        {emailSent
          ? `Enviamos el código de invitación a ${email}.`
          : email
            ? `No pudimos enviar el mail a ${email}. Compartile este código:`
            : "Compartile este código a la otra parte:"}
      </p>

      {warning && (
        <p className="mt-1 text-[10px] leading-relaxed text-[#FFEA00]">
          {warning}
        </p>
      )}

      {code ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#0B0C10] py-1 pl-3 pr-1">
          <code className="flex-1 select-all font-mono text-xs font-bold tracking-wider text-white">
            {code}
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
      ) : (
        <p className="mt-3 rounded-xl bg-[#0B0C10] px-3 py-2 text-[11px] leading-relaxed text-slate-400">
          No se pudo generar el código. Podés reintentarlo desde el botón
          Invitar de la barra superior.
        </p>
      )}

      <button
        type="button"
        onClick={onClose}
        className="mt-5 w-full cursor-pointer rounded-xl border border-[#00E5FF]/60 bg-[#1F2029] px-4 py-2.5 text-xs font-bold text-[#00E5FF] transition-colors hover:border-[#00E5FF] hover:text-white"
      >
        Listo
      </button>
    </div>
  );
}
