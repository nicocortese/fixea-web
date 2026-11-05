"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

// Devuelve false en el render del servidor y en el render de hidratación, y
// true en el re-render posterior: mismo resultado que el patrón
// useState(false) + useEffect(setMounted(true)), pero sin setState dentro de
// un efecto.
export default function useIsMounted() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
