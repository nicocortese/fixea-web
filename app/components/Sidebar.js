"use client";

import { useState } from "react";
import {
  Bell,
  Menu,
  Plus,
  BarChart2,
  Clock,
  FileText,
  BookOpen,
  Sun,
  Headset,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";

export default function Sidebar({
  isOpen,
  setIsOpen,
  activeProject,
  setActiveProject,
}) {
  const projects = [
    { name: "Retrokicks", count: 4 },
    { name: "Potrero", count: 10 },
    { name: "UMAI", count: 56 },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 bg-[#1F2029] border-r border-slate-800/80 flex flex-col justify-between ${isOpen ? "w-64" : "w-18"}`}
    >
      <div>
        <div className="flex items-center justify-between p-4 border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <Image
              src="/Logo.png"
              alt="FIXEA Logo"
              width={90}
              height={28}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="text-[#F1F5F9] hover:text-white p-1 rounded-md">
              <Bell className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-[#F1F5F9] hover:text-white p-1 rounded-md"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[#F1F5F9] uppercase tracking-wider mb-3">
            {isOpen && <span>Proyectos</span>}
            <Plus className="w-4 h-4 cursor-pointer hover:text-[#F1F5F9]" />
          </div>
          <div className="space-y-1">
            {projects.map((proj) => (
              <button
                key={proj.name}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                  activeProject === proj.name
                    ? "bg-slate-800/60 text-white font-medium border-l-2 border-cyan-400"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                }`}
              >
                <div className="flex items-centr gap-2 truncate">
                  <div
                    className={`w-2 h-2 rounded-full ${activeProject === proj.name ? `bg-cyan-400` : `border border-slate-500`}`}
                  />
                  {isOpen && <span className="truncate">{proj.name}</span>}
                </div>
                {isOpen && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    {proj.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          {isOpen && (
            <div className="mt-6">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Estadísticas
              </div>
              <div className="space-y-1 text-sm text-slate-400">
                <div className="flex items-center gap-3 px-3 py-2 hover:texr-white cursor-pointer rounded-lg hover:bg-slate-800/30">
                  <BarChart2 className="w-4 h-4" /> Rendimiento
                </div>
                <div className="flex items-center gap-3 px-3 py-2 hover:texr-white cursor-pointer rounded-lg hover:bg-slate-800/30">
                  <Clock className="w-4 h-4" /> Tiempo
                </div>
                <div className="flex items-center gap-3 px-3 py-2 hover:text-white cursor-pointer rounded-lg hover:bg-slate-800/30">
                  <FileText className="w-4 h-4" /> Reportes
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-slate-800/50 space-y-2">
        {isOpen && (
          <div className="space-y-1 text-xs text-slate-400 mb-3">
            <div className="flex items-center gap-2 py-1 hover:text-white cursor-pointer">
              <BookOpen className="w-3.5 h-3.5" /> Documentación
            </div>
            <div className="flex items-center gap-2 py-1 hover:text-white cursor-pointer">
              <Sun className="w-3.5 h-3.5" /> Cambiar tema: Claro
            </div>
            <div className="flex items-center gap-2 py-1 hover:text-white cursor-pointer">
              <Headset className="w-3.5 h-3.5" /> Soporte
            </div>
          </div>
        )}

        {isOpen && (
          <div className="p-2 rounded-xl bg-linear-to-r from-blue-900/30 to-purple-900/30 border border-slate-700/50  flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-cyan-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                Plan Gratuito o <strong>FIXEA PRO</strong>
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white">
            NC
          </div>
          {isOpen && (
            <div className="truncate">
                <p className="text-xs font-medium text-white truncate">Nicolás Cortese</p>
                <p className="text-[10px] text-slate-500 truncate">nicolascortese2004@gmail.com</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
