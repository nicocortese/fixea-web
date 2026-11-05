"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Input de contraseña con botón "ojito" para mostrar/ocultar el texto.
 * Acepta las mismas props que un <input>; `className` estiliza el input.
 */
export default function PasswordInput({ className = "", id, ...props }) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Ocultar contraseña" : "Mostrar contraseña";

  return (
    <div className="relative">
      <input
        {...props}
        id={id}
        type={visible ? "text" : "password"}
        className={`${className} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={label}
        aria-controls={id}
        aria-pressed={visible}
        title={label}
        className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center rounded-r-xl text-slate-500 transition-colors hover:text-[#00E5FF] focus-visible:text-[#00E5FF] focus-visible:outline-none"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
