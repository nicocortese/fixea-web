"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export default function ProjectDropdown({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();
  const active = options.find((option) => option.id === value) ?? options[0];

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Proyecto activo"
        onClick={() => setOpen((current) => !current)}
        className={`flex max-w-[260px] cursor-pointer items-center gap-3 rounded-xl border bg-[#161822] py-2 pl-3.5 pr-3.5 text-sm font-bold text-[#00E5FF] transition-all ${
          open
            ? "border-[#00E5FF]/60 shadow-[0_0_16px_rgba(0,229,255,0.22)]"
            : "border-[#2A2C38] hover:border-[#00E5FF]/40"
        }`}
      >
        <span className="truncate">{active?.name ?? "Elegí un proyecto"}</span>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={2}
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul
          id={menuId}
          role="listbox"
          aria-label="Proyectos"
          className="absolute left-0 top-[calc(100%+6px)] z-50 max-h-72 min-w-full w-max max-w-[320px] overflow-y-auto rounded-2xl border border-[#2A2C38] bg-[#12131A] p-1.5 shadow-[0_14px_32px_rgba(0,0,0,0.65)]"
        >
          {options.map((option) => {
            const selected = option.id === active?.id;

            return (
              <li key={option.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${
                    selected
                      ? "bg-[#00E5FF]/10 text-[#00E5FF]"
                      : "text-[#F4F4F6] hover:bg-[#1F2029]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      selected
                        ? "bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]"
                        : "bg-[#2A2C38]"
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  {selected && (
                    <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
