"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount, useSwitchChain } from "wagmi";
import { config } from "@/lib/wagmi";
import { useState, useEffect, type ReactNode } from "react";
import { baseSepolia } from "wagmi/chains";

function ChainGuard({ children }: { children: ReactNode }) {
  const { chain, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const [dismissed, setDismissed] = useState(false);

  const wrongChain = isConnected && chain && chain.id !== baseSepolia.id;

  useEffect(() => {
    setDismissed(false);
  }, [chain?.id]);

  if (wrongChain && !dismissed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/80 backdrop-blur-sm">
        <div className="bg-deep-void border border-siphon-teal/20 rounded-xl p-6 max-w-sm text-center space-y-4">
          <h3 className="text-lg font-bold text-foam">Wrong Network</h3>
          <p className="text-ghost text-sm">
            Siphon Protocol runs on Base Sepolia. You&apos;re currently on{" "}
            <span className="text-foam font-medium">{chain.name}</span>.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => switchChain({ chainId: baseSepolia.id })}
              className="px-4 py-2 bg-siphon-teal text-abyss rounded-lg text-sm font-medium hover:bg-siphon-teal/90 transition-colors"
            >
              Switch to Base Sepolia
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-4 py-2 border border-ghost/20 text-ghost rounded-lg text-sm hover:text-foam transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ChainGuard>{children}</ChainGuard>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
