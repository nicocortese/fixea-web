'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Circle,
  BarChart2,
  History,
  FileSpreadsheet,
  FileText,
  Contrast,
  Headphones,
  Zap,
  User,
  MoreHorizontal,
  Bell,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

const NEON_BUTTON =
  'cursor-pointer text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)] transition-transform hover:scale-110';

function Logo() {
  return (
    <Image
      src="/Logo.png"
      alt="Fixea"
      width={112}
      height={30}
      priority
      style={{ width: 'auto', height: 'auto' }}
    />
  );
}

export default function Sidebar({
  isOpen = true,
  setIsOpen,
  projects = [],
  activeProject = null,
  setActiveProject,
  onCreateProject,
  user,
  theme,
  onToggleTheme,
  onLogOut,
  loggingOut = false,
  logoutError = '',
}) {
  const pathname = usePathname();

  // COLAPSADA: solo logo + botón, fijos arriba a la izquierda, sin fondo.
  // No ocupa espacio en el flujo: el contenedor principal usa ml-0 + pt-16.
  if (!isOpen) {
    return (
      <div className="fixed left-4 top-4 z-40 flex items-center gap-3 select-none">
        <Link href="/" aria-label="Ir al inicio" className="flex items-center">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setIsOpen && setIsOpen(true)}
          aria-label="Abrir barra lateral"
          title="Abrir barra lateral"
          className={NEON_BUTTON}
        >
          <PanelLeftOpen size={18} aria-hidden="true" />
        </button>
      </div>
    );
  }

  // EXPANDIDA
  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 select-none flex-col justify-between overflow-hidden border-r border-[#F1F5F9] bg-[#0F1015] p-3 text-white">
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* HEADER */}
        <div className="flex items-center justify-between px-1">
          <Link href="/" aria-label="Ir al inicio" className="flex items-center">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Notificaciones"
              className="cursor-pointer text-gray-400 transition-colors hover:text-white"
            >
              <Bell size={16} />
            </button>
            <button
              type="button"
              onClick={() => setIsOpen && setIsOpen(false)}
              aria-label="Colapsar barra lateral"
              title="Colapsar barra lateral"
              className={NEON_BUTTON}
            >
              <PanelLeftClose size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* PROYECTOS */}
        <div className="flex min-h-0 flex-col gap-1">
          <div className="flex items-center justify-between px-2 py-1 text-xs font-medium text-gray-400">
            <span>Proyectos</span>
            <button
              type="button"
              onClick={onCreateProject}
              aria-label="Crear proyecto"
              className="cursor-pointer text-base hover:text-white"
            >
              +
            </button>
          </div>
          <div className="flex flex-col gap-0.5">
            {projects.map((project) => {
              const isActive = project.id === activeProject;

              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setActiveProject && setActiveProject(project.id)}
                  className={`flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-all ${
                    isActive
                      ? 'bg-[#1E1F28] font-medium text-white'
                      : 'text-gray-400 hover:bg-[#15161D] hover:text-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Circle
                      size={14}
                      className={
                        isActive ? 'fill-[#00E5FF]/20 text-[#00E5FF]' : 'text-gray-500'
                      }
                    />
                    <span className="truncate">{project.name}</span>
                  </div>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-700/50 bg-[#1E1F28] font-mono text-[11px] text-gray-300">
                    {project.count ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ESTADÍSTICAS */}
        <div className="flex flex-col gap-1 border-t border-gray-800/60 pt-2">
          <span className="px-2 py-1 text-xs font-medium text-gray-400">
            Estadísticas
          </span>
          <NavEntry href="/rendimiento" active={pathname === '/rendimiento'} icon={<BarChart2 size={16} />} label="Rendimiento" />
          <NavEntry href="/tiempo" active={pathname === '/tiempo'} icon={<History size={16} />} label="Tiempo" />
          <NavEntry href="/reportes" active={pathname === '/reportes'} icon={<FileSpreadsheet size={16} />} label="Reportes" />
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex flex-col gap-2 border-t border-gray-800/60 pt-2">
        <NavEntry href="/documentacion" active={pathname === '/documentacion'} icon={<FileText size={16} />} label="Documentación" />
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-gray-400 transition-all hover:bg-[#15161D] hover:text-gray-200"
          >
            <Contrast size={16} />
            <span>Cambiar tema: {theme === 'light' ? 'Oscuro' : 'Claro'}</span>
          </button>
        )}
        <NavEntry href="/soporte" active={pathname === '/soporte'} icon={<Headphones size={16} />} label="Soporte" />

        <div className="my-1">
          <Link
            href="/planes"
            aria-label="Ver planes de FIXEA"
            title="Ver planes de FIXEA"
            className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-purple-500/40 bg-gradient-to-r from-purple-900/30 to-pink-900/30 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:border-[#00E5FF]/70 hover:shadow-[0_0_16px_rgba(0,229,255,0.25)]"
          >
            <Zap size={14} className="fill-[#00E5FF] text-[#00E5FF]" />
            <span>
              Plan Gratuito o <strong className="font-bold italic">FIXEA PRO</strong>
            </span>
          </Link>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-800/80 bg-[#15161D] p-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-800 text-white">
              <User size={16} />
            </div>
            <div className="flex flex-col truncate">
              <span className="truncate text-xs font-semibold leading-tight text-white">
                {user?.name || user?.email || ''}
              </span>
              <span className="truncate text-[10px] text-gray-400">
                {user?.email || ''}
              </span>
            </div>
          </div>

          {onLogOut ? (
            <button
              type="button"
              onClick={onLogOut}
              disabled={loggingOut}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="cursor-pointer text-gray-400 transition-colors hover:text-[#FF003C] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut size={16} />
            </button>
          ) : (
            <MoreHorizontal size={16} className="ml-1 shrink-0 cursor-pointer text-gray-400 hover:text-white" />
          )}
        </div>

        {logoutError && (
          <p role="alert" className="px-1 text-[10px] font-semibold text-[#FF003C]">
            {logoutError}
          </p>
        )}
      </div>
    </aside>
  );
}

function NavEntry({ href, active, icon, label }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-all ${
        active
          ? 'bg-[#1E1F28] font-medium text-white'
          : 'text-gray-400 hover:bg-[#15161D] hover:text-gray-200'
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}