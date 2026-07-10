"use client";

import { useEffect, useState } from "react";
import { WhatIfTab } from "@/app/numbers/page";
import { CardsSkeleton, LoadingLine } from "@/components/ui/Loading";
import { CapabilityNotice, PageTitle } from "@/components/ui/Section";
import { f1dbSeasonCatalog } from "@/lib/db/catalog";
import { getDb } from "@/lib/db/duckdb";

export default function ScenariosPage() {
  const [years, setYears] = useState<number[]>([]);
  const [progress, setProgress] = useState("STARTING DUCKDB");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb(setProgress)
      .then(() => f1dbSeasonCatalog())
      .then((catalog) => setYears(catalog.filter((entry) => entry.capabilities.has("scenarios")).map((entry) => entry.year)))
      .catch((reason) => setError(String(reason)));
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-6 md:py-10">
      <PageTitle index="STUDIO / MODEL.02" title="Championship scenarios" sub="Recompute points after removing rounds or injecting non-finishes. Runs locally against the bundled F1DB release." />
      <div className="mt-5"><CapabilityNotice source="F1DB">Available seasons are derived from result and standings rows, not a hard-coded year range.</CapabilityNotice></div>
      {error && <div className="mt-4 border border-red/30 bg-red/5 p-3 font-mono text-[10px] text-red">{error}</div>}
      {years.length === 0 && !error ? <div className="mt-8"><LoadingLine>{progress}</LoadingLine><CardsSkeleton count={2} className="mt-4" /></div> : <WhatIfTab years={years} />}
    </main>
  );
}
