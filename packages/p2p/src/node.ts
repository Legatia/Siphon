import { createLibp2p, type Libp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@libp2p/yamux";
import { bootstrap } from "@libp2p/bootstrap";
import { identify } from "@libp2p/identify";
import { kadDHT } from "@libp2p/kad-dht";
import { gossipsub } from "@libp2p/gossipsub";
import { TOPICS } from "./topics";

export interface SiphonNodeConfig {
  /** Multiaddrs of bootstrap peers to connect to on startup */
  bootstrapPeers?: string[];
  /** WebSocket addresses to listen on (browser nodes typically don't listen) */
  listenAddresses?: string[];
}

/**
 * Creates a libp2p node configured for browser usage with Siphon Protocol.
 *
 * The node uses:
 * - WebSocket transport (for browser compatibility)
 * - Noise encryption (secure channel)
 * - Yamux stream muxer
 * - Bootstrap peer discovery
 * - Kademlia DHT in client mode (for record storage/lookup)
 * - GossipSub (for pub/sub messaging across topics)
 * - Identify protocol (for peer identification)
 */
export async function createSiphonBrowserNode(
  config: SiphonNodeConfig = {}
): Promise<Libp2p> {
  const { bootstrapPeers = [], listenAddresses = [] } = config;

  const peerDiscovery = bootstrapPeers.length > 0
    ? [bootstrap({ list: bootstrapPeers })]
    : [];

  const node = await createLibp2p({
    addresses: {
      listen: listenAddresses,
    },
    transports: [
      webSockets(),
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connectionEncrypters: [noise()] as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    streamMuxers: [yamux()] as any,
    peerDiscovery,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    services: {
      identify: identify(),
      dht: kadDHT({
        clientMode: true,
      }),
      pubsub: gossipsub({
        emitSelf: false,
        allowPublishToZeroTopicPeers: true,
      }),
    } as any,
  });

  return node;
}

/**
 * Subscribe the node to all Siphon Protocol GossipSub topics.
 * Returns an unsubscribe function that removes all subscriptions.
 */
export async function subscribeToAllTopics(
  node: Libp2p,
  handlers: Partial<Record<string, (data: Uint8Array) => void>>
): Promise<() => void> {
  const pubsub = (node.services as Record<string, unknown>).pubsub as {
    subscribe: (topic: string) => void;
    unsubscribe: (topic: string) => void;
    addEventListener: (event: string, handler: (evt: unknown) => void) => void;
    removeEventListener: (event: string, handler: (evt: unknown) => void) => void;
  };

  const topicValues = Object.values(TOPICS);

  for (const topic of topicValues) {
    pubsub.subscribe(topic);
  }

  const messageHandler = (evt: unknown) => {
    const event = evt as { detail: { topic: string; data: Uint8Array } };
    const { topic, data } = event.detail;
    const handler = handlers[topic];
    if (handler) {
      handler(data);
    }
  };

  pubsub.addEventListener("message", messageHandler);

  return () => {
    pubsub.removeEventListener("message", messageHandler);
    for (const topic of topicValues) {
      pubsub.unsubscribe(topic);
    }
  };
}
