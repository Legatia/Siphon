import { type Hex, isAddressEqual } from "viem";
import {
  ERC8004_IDENTITY_ADDRESS,
  ERC8004_IDENTITY_CONFIGURED,
  ZERO_EVM_ADDRESS,
  publicClient,
} from "@/lib/contracts";

export async function verifyIdentityTx(
  txHash: string,
  expectedFrom: `0x${string}`
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!ERC8004_IDENTITY_CONFIGURED) {
    return { ok: false, error: "ERC8004 identity contract is not configured" };
  }

  try {
    const hash = txHash as Hex;
    const [tx, receipt] = await Promise.all([
      publicClient.getTransaction({ hash }),
      publicClient.getTransactionReceipt({ hash }),
    ]);

    if (!tx.to || isAddressEqual(tx.to, ZERO_EVM_ADDRESS)) {
      return { ok: false, error: "Identity transaction has no target contract" };
    }
    if (!isAddressEqual(tx.to, ERC8004_IDENTITY_ADDRESS)) {
      return { ok: false, error: "Identity transaction targets the wrong contract" };
    }
    if (!isAddressEqual(tx.from, expectedFrom)) {
      return { ok: false, error: "Identity transaction sender mismatch" };
    }
    if (receipt.status !== "success") {
      return { ok: false, error: "Identity transaction failed on-chain" };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to verify identity transaction on-chain" };
  }
}
