import { useState, useEffect } from "react";
import { Toaster } from "sonner";
import Sidebar, { type Zone } from "@/components/Sidebar";
import TierGate from "@/components/TierGate";
import Farm from "@/zones/Farm";
import Factory from "@/zones/Factory";
import Arena from "@/zones/Arena";
import Settings from "@/pages/Settings";
import ErrorBoundary from "@/components/ErrorBoundary";
import { getUserTier } from "@/hooks/useTauri";

export default function App() {
  const [zone, setZone] = useState<Zone>("farm");
  const [tier, setTier] = useState("free_trainer");

  useEffect(() => {
    getUserTier().then((t) => setTier(t.tier)).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen bg-abyss particle-bg">
      <Sidebar active={zone} onNavigate={setZone} />

      <main className="flex-1 flex flex-col overflow-hidden">
        <ErrorBoundary>
          {zone === "farm" && <Farm />}
          {zone === "factory" && (
            <TierGate tier={tier} requiredTier="keeper">
              <Factory />
            </TierGate>
          )}
          {zone === "arena" && <Arena />}
          {zone === "settings" && <Settings />}
        </ErrorBoundary>
      </main>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#1a1a2e",
            border: "1px solid rgba(0,212,170,0.2)",
            color: "#ffffff",
          },
        }}
      />
    </div>
  );
}
