"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

/**
 * Key de conexión del proyecto activo. El programador se la pasa al cliente,
 * que la ingresa en la extensión para vincularse al proyecto.
 */
export default function ProjectKeyBadge({ projectKey }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!projectKey) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(projectKey);
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles: el texto queda seleccionable igual.
    }
  };

  return (
    <div className="rounded-xl bg-[linear-gradient(135deg,#00E5FF_0%,#7000FF_50%,#FF007F_100%)] p-[1.5px] shadow-[0_0_18px_rgba(0,229,255,0.18)]">
      <div className="flex items-center gap-2 rounded-[10.5px] bg-[#1F2029] py-1 pl-3 pr-1">
        <KeyRound className="h-4 w-4 shrink-0 text-[#00E5FF]" aria-hidden="true" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Key
        </span>
        <code
          className="select-all font-mono text-xs font-bold tracking-wider text-white"
          title="Compartila con tu cliente para vincular la extensión"
        >
          {projectKey}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Key copiada" : "Copiar Key"}
          title={copied ? "¡Copiada!" : "Copiar Key"}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#00E5FF]/10 hover:text-[#00E5FF]"
        >
          {copied ? (
            <Check className="h-4 w-4 text-[#00FF66]" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
