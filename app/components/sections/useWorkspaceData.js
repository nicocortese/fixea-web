"use client";

import { useCallback, useEffect, useState } from "react";

// === Datos del programador: proyectos + tickets ===
export default function useWorkspaceData({ includeDeleted = false } = {}) {
  const [projects, setProjects] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const ticketsUrl = `/api/tickets?compact=1${includeDeleted ? "&includeDeleted=true" : ""}`;
        const [projectsRes, ticketsRes] = await Promise.all([
          fetch("/api/projects", { cache: "no-store" }),
          fetch(ticketsUrl, { cache: "no-store" }),
        ]);
        const [projectsData, ticketsData] = await Promise.all([
          projectsRes.json().catch(() => null),
          ticketsRes.json().catch(() => null),
        ]);

        if (!projectsRes.ok || !ticketsRes.ok) {
          throw new Error(
            ticketsData?.error || projectsData?.error || "No se pudieron cargar los datos.",
          );
        }
        if (!active) return;

        setProjects(Array.isArray(projectsData?.projects) ? projectsData.projects : []);
        setTickets(Array.isArray(ticketsData?.tickets) ? ticketsData.tickets : []);
      } catch (loadError) {
        if (active) setError(loadError?.message || "No se pudieron cargar los datos.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [includeDeleted, reloadKey]);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  return { projects, tickets, loading, error, reload };
}
