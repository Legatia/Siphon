import type { Libp2p } from "libp2p";

/** Access the DHT service from a libp2p node */
function getDHT(node: Libp2p) {
  const dht = (node.services as Record<string, unknown>).dht as {
    put: (key: Uint8Array, value: Uint8Array) => AsyncIterable<unknown>;
    get: (key: Uint8Array) => AsyncIterable<{ value?: Uint8Array }>;
  };
  if (!dht) {
    throw new Error("DHT service not available on this node");
  }
  return dht;
}

/** Encode a string key into a Uint8Array for DHT operations */
function encodeKey(key: string): Uint8Array {
  return new TextEncoder().encode(key);
}

/**
 * Publish a record to the Kademlia DHT.
 *
 * @param node - The libp2p node instance
 * @param key - Human-readable key (e.g., "/siphon/shard/<id>")
 * @param value - The value to store as a Uint8Array
 */
export async function publishRecord(
  node: Libp2p,
  key: string,
  value: Uint8Array
): Promise<void> {
  const dht = getDHT(node);
  const keyBytes = encodeKey(key);

  // Iterate through the async iterable to complete the put operation
  for await (const _event of dht.put(keyBytes, value)) {
    // DHT put emits routing events; we consume them to drive the operation
  }
}

/**
 * Look up a record from the Kademlia DHT.
 *
 * @param node - The libp2p node instance
 * @param key - Human-readable key to look up
 * @returns The stored value, or null if not found
 */
export async function lookupRecord(
  node: Libp2p,
  key: string
): Promise<Uint8Array | null> {
  const dht = getDHT(node);
  const keyBytes = encodeKey(key);

  try {
    for await (const event of dht.get(keyBytes)) {
      if (event.value) {
        return event.value;
      }
    }
  } catch {
    // Record not found or DHT query failed
    return null;
  }

  return null;
}

/**
 * Publish a JSON-serializable object to the DHT.
 * Convenience wrapper around publishRecord that handles encoding.
 */
export async function publishJSON(
  node: Libp2p,
  key: string,
  value: unknown
): Promise<void> {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  await publishRecord(node, key, encoded);
}

/**
 * Look up a JSON object from the DHT.
 * Convenience wrapper around lookupRecord that handles decoding.
 */
export async function lookupJSON<T = unknown>(
  node: Libp2p,
  key: string
): Promise<T | null> {
  const data = await lookupRecord(node, key);
  if (!data) return null;

  try {
    const text = new TextDecoder().decode(data);
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
