"use client";
import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import TicketCard from "./components/TicketCard";
import TicketModal from "./components/TicketModal";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeProject, setActiveProject] = useState("Retrokicks");
  const [isModalOpen, setIsModalOpen] = useState(false);
  

  return (
    <div className="min-h-screen bg-[#0b0d13] text-white flex">
      <Sidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        activeProject={activeProject}
        setActiveProject={setActiveProject}
      />

      <main
        className={`flex-1 transition-all duration-300 p-8 ${sidebarOpen ? "ml-64" : "ml-20"}`}
      >
        {/*Sección pendiente*/}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/cliente"
              className="flex items-center gap-2 bg-[#0c0e17]/90 hover:bg-cyan-950/80 border border-cyan-400 text-cyan-400 px-4 py-2 rounded-2xl text-xs font-bold transition-all shadow-[0_0_20px_rgba(0,229,255,0.25)] hover:scale-105 backdrop-blur-md"
            >
              <span>Ver Web Cliente</span>
              <ExternalLink className="w-4 h-4" />
            </Link>
            <div className="inline-block px-6 py-2 rounded-2xl neon-border-gradient mb-6">
              <h1 className="text-xl font-black tracking-wider uppercase">
                PENDIENTE
              </h1>
            </div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
            <TicketCard onClick={() => setIsModalOpen(true)} />
            <TicketCard onClick={() => setIsModalOpen(true)} />
            <TicketCard onClick={() => setIsModalOpen(true)} />
            <TicketCard onClick={() => setIsModalOpen(true)} />
            <TicketCard onClick={() => setIsModalOpen(true)} />
          </div>
        </section>

        {/*Sección en proceso*/}
        <section>
          <div className="inline-block px-6 py-2 rounded-2xl border border-slate-800 bg-[#10131d] mb-6">
            <h2 className="text-xl font-black tracking-wider uppercase text-slate-300">
              EN PROCESO
            </h2>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
            <TicketCard
              onClick={() => setIsModalOpen(true)}
              className="opacity-60"
            />
            <TicketCard
              onClick={() => setIsModalOpen(true)}
              className="opacity-60"
            />
            <TicketCard
              onClick={() => setIsModalOpen(true)}
              className="opacity-60"
            />
          </div>
        </section>

        {/* Sección finalizado */}
        <section>
          <div className="inline-block px-6 py-2 rounded-2xl border border-slate-800 bg-[#10131d] mb-6">
            <h2 className="text-xl font-black tracking-wider uppercase text-slate-300">
              FINALIZADO
            </h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
            <TicketCard
              onClick={() => setIsModalOpen(true)}
              className="opacity-30"
            />
            <TicketCard
              onClick={() => setIsModalOpen(true)}
              className="opacity-30"
            />
            <TicketCard
              onClick={() => setIsModalOpen(true)}
              className="opacity-30"
            />
            <TicketCard
              onClick={() => setIsModalOpen(true)}
              className="opacity-30"
            />
          </div>
        </section>

        {/*Modal*/}
        <TicketModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </main>
    </div>
  );
}
