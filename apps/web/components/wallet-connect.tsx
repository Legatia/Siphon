"use client";

import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { Button } from "@/components/ui/button";
import { Wallet, LogOut, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [showPicker, setShowPicker] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const didSignRef = useRef(false);

  // Check existing session on mount
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) setSessionAddress(data.address);
      })
      .catch(() => {});
  }, []);

  // Auto-sign-in when wallet connects (if no session yet)
  const signIn = useCallback(async () => {
    if (!address || signingIn || didSignRef.current) return;
    didSignRef.current = true;
    setSigningIn(true);
    try {
      // 1. Get nonce
      const nonceRes = await fetch("/api/auth/nonce");
      const { nonce } = await nonceRes.json();

      // 2. Build message and sign
      const message = `Sign in to Siphon Protocol\n\nAddress: ${address}\nNonce: ${nonce}`;
      const signature = await signMessageAsync({ message });

      // 3. Verify on server
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature }),
      });

      if (verifyRes.ok) {
        setSessionAddress(address.toLowerCase());
      }
    } catch (err) {
      console.error("SIWE sign-in failed:", err);
      didSignRef.current = false;
    } finally {
      setSigningIn(false);
    }
  }, [address, signingIn, signMessageAsync]);

  useEffect(() => {
    if (isConnected && address && !sessionAddress) {
      // Check if address matches existing session
      if (sessionAddress === address.toLowerCase()) return;
      signIn();
    }
  }, [isConnected, address, sessionAddress, signIn]);

  const handleDisconnect = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setSessionAddress(null);
    didSignRef.current = false;
    disconnect();
  };

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        {signingIn && (
          <Loader2 className="h-3 w-3 text-siphon-teal animate-spin" />
        )}
        <span className="text-xs font-mono text-siphon-teal bg-siphon-teal/10 px-3 py-1.5 rounded-lg border border-siphon-teal/20">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <Button variant="ghost" size="icon" onClick={handleDisconnect}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Filter to connectors that are actually available
  const available = connectors.filter(
    (c) => c.type === "injected" || c.type === "coinbaseWallet"
  );

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          if (available.length === 1) {
            connect({ connector: available[0] });
          } else {
            setShowPicker(!showPicker);
          }
        }}
      >
        <Wallet className="h-4 w-4 mr-2" />
        Connect Wallet
      </Button>

      {showPicker && available.length > 1 && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-deep-void border border-siphon-teal/20 rounded-lg shadow-lg p-2 min-w-[180px]">
          {available.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => {
                connect({ connector });
                setShowPicker(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-foam hover:bg-siphon-teal/10 rounded-md transition-colors"
            >
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
