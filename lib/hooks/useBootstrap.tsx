"use client";
import { createContext, useContext, useEffect, useState } from "react";
import useSWR from "swr";
import { snapshotStatus, type Bootstrap } from "../bootstrap";

export async function fetchBootstrap(url: string): Promise<Bootstrap> {
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Snapshot unavailable: ${response.status}`);
  return response.json();
}
function usePublication() {
  const result = useSWR<Bootstrap>("/api/bootstrap", fetchBootstrap, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = setInterval(update, 30_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return {
    ...result,
    now,
    status: result.data ? snapshotStatus(result.data.generatedAt, now) : null,
  };
}
const BootstrapContext = createContext<ReturnType<
  typeof usePublication
> | null>(null);
export function BootstrapProvider({ children }: { children: React.ReactNode }) {
  const value = usePublication();
  return (
    <BootstrapContext.Provider value={value}>
      {children}
    </BootstrapContext.Provider>
  );
}
export function useBootstrap() {
  const value = useContext(BootstrapContext);
  if (!value) throw new Error("useBootstrap requires BootstrapProvider");
  return value;
}
