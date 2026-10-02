"use client";
import { useBootstrap } from "@/lib/hooks/useBootstrap";
import IndicesSection from "./IndicesSection";
export default function IndicesPageClient() {
  const { data, isLoading, error } = useBootstrap();
  return (
    <>
      {error && !data && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Saved index publication is unavailable.
        </p>
      )}
      <IndicesSection
        digest={data?.indexProducts ?? null}
        full
        loading={isLoading}
      />
    </>
  );
}
