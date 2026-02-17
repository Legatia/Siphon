"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { p2pClient } from "@/lib/p2p-client";

/**
 * Inline P2P status indicator for the navbar.
 * Shows connection state (green dot = connected, gray = offline)
 * and peer count on click.
 */
export function P2PStatus() {
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setConnected(p2pClient.isConnected);
      setPeers(p2pClient.peerCount);
    }, 3000);

    // Initial check
    setConnected(p2pClient.isConnected);
    setPeers(p2pClient.peerCount);

    return () => clearInterval(interval);
  }, []);

  const handleClick = useCallback(() => {
    setShowTooltip(true);
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
    }
    tooltipTimeout.current = setTimeout(() => {
      setShowTooltip(false);
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (tooltipTimeout.current) {
        clearTimeout(tooltipTimeout.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono transition-colors hover:bg-white/5"
        aria-label={connected ? `P2P connected, ${peers} peers` : "P2P offline"}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            connected
              ? "bg-siphon-teal shadow-[0_0_6px_rgba(0,212,170,0.6)]"
              : "bg-ghost/40"
          }`}
        />
        <span className={connected ? "text-siphon-teal" : "text-ghost/60"}>
          {connected ? "P2P" : "Offline"}
        </span>
      </button>

      {showTooltip && (
        <div className="absolute top-full right-0 mt-1 px-3 py-1.5 rounded-lg bg-midnight border border-siphon-teal/20 text-xs text-foam whitespace-nowrap z-50 shadow-lg">
          {connected ? (
            <span>
              <span className="text-siphon-teal font-semibold">{peers}</span>{" "}
              {peers === 1 ? "peer" : "peers"} connected
            </span>
          ) : (
            <span className="text-ghost">Not connected to P2P network</span>
          )}
        </div>
      )}
    </div>
  );
}
