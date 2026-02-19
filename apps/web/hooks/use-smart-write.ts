"use client";

import { useMemo, useCallback } from "react";
import { useAccount } from "wagmi";
import { useCapabilities, useWriteContracts } from "wagmi/experimental";
import type { Abi } from "viem";

/**
 * Detects if the connected wallet supports paymaster (gasless) transactions.
 * Returns capabilities object to pass to writeContracts.
 */
export function usePaymasterCapabilities() {
  const { address, chainId } = useAccount();

  const { data: availableCapabilities } = useCapabilities({
    account: address,
  });

  const capabilities = useMemo(() => {
    if (!availableCapabilities || !chainId) return undefined;

    const chainCaps =
      availableCapabilities[chainId as keyof typeof availableCapabilities];
    if (
      chainCaps &&
      typeof chainCaps === "object" &&
      "paymasterService" in chainCaps &&
      (chainCaps as any).paymasterService?.supported
    ) {
      return {
        paymasterService: {
          url: "/api/paymaster",
        },
      };
    }
    return undefined;
  }, [availableCapabilities, chainId]);

  return {
    capabilities,
    isSmartWallet: !!capabilities,
  };
}

interface SmartWriteCall {
  address: `0x${string}`;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

/**
 * Hook for batched + sponsored contract writes via Smart Wallet.
 * Falls back to single tx for EOA wallets.
 *
 * Usage:
 *   const { smartWrite, isSmartWallet } = useSmartWrite();
 *   await smartWrite([{ address, abi, functionName, args }]);
 */
export function useSmartWrite() {
  const { capabilities, isSmartWallet } = usePaymasterCapabilities();
  const { writeContractsAsync } = useWriteContracts();

  const smartWrite = useCallback(
    async (calls: SmartWriteCall[]) => {
      if (!isSmartWallet || !capabilities) return null;

      const id = await writeContractsAsync({
        contracts: calls.map((c) => ({
          address: c.address,
          abi: c.abi as Abi,
          functionName: c.functionName,
          args: c.args as any,
          value: c.value,
        })),
        capabilities,
      });

      return id;
    },
    [isSmartWallet, capabilities, writeContractsAsync]
  );

  return {
    smartWrite,
    isSmartWallet,
  };
}
