import type { Libp2p } from "libp2p";
import {
  createSiphonBrowserNode,
  subscribeToAllTopics,
  TOPICS,
} from "@siphon/p2p";

type MessageHandler = (data: Uint8Array) => void;

/**
 * SiphonP2PClient wraps the @siphon/p2p browser node with
 * application-level convenience methods and graceful fallback
 * when P2P is unavailable (e.g., SSR, unsupported browser).
 */
export class SiphonP2PClient {
  private node: Libp2p | null = null;
  private unsubscribe: (() => void) | null = null;
  private topicHandlers: Map<string, Set<MessageHandler>> = new Map();
  private _peerCount = 0;
  private peerCountInterval: ReturnType<typeof setInterval> | null = null;

  /** Whether the P2P node is currently connected */
  get isConnected(): boolean {
    return this.node !== null;
  }

  /** Number of currently connected peers */
  get peerCount(): number {
    return this._peerCount;
  }

  /**
   * Connect to the Siphon P2P network.
   * Fails gracefully in environments where P2P is not available.
   */
  async connect(bootstrapPeers: string[] = []): Promise<void> {
    if (this.node) {
      console.warn("[p2p] Already connected");
      return;
    }

    if (typeof window === "undefined") {
      console.warn("[p2p] P2P is not available in server-side rendering");
      return;
    }

    try {
      this.node = await createSiphonBrowserNode({ bootstrapPeers });

      // Set up GossipSub message routing
      const handlers: Record<string, (data: Uint8Array) => void> = {};
      for (const topic of Object.values(TOPICS)) {
        handlers[topic] = (data: Uint8Array) => {
          const topicHandlers = this.topicHandlers.get(topic);
          if (topicHandlers) {
            for (const handler of topicHandlers) {
              try {
                handler(data);
              } catch (err) {
                console.error(`[p2p] Handler error on ${topic}:`, err);
              }
            }
          }
        };
      }

      this.unsubscribe = await subscribeToAllTopics(this.node, handlers);

      // Track peer count
      this.peerCountInterval = setInterval(() => {
        if (this.node) {
          this._peerCount = this.node.getPeers().length;
        }
      }, 5000);

      // Initial peer count
      this._peerCount = this.node.getPeers().length;

      console.log(
        "[p2p] Connected. PeerId:",
        this.node.peerId.toString()
      );
    } catch (err) {
      console.error("[p2p] Failed to connect:", err);
      this.node = null;
    }
  }

  /**
   * Disconnect from the P2P network and clean up resources.
   */
  async disconnect(): Promise<void> {
    if (this.peerCountInterval) {
      clearInterval(this.peerCountInterval);
      this.peerCountInterval = null;
    }

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.node) {
      try {
        await this.node.stop();
      } catch (err) {
        console.error("[p2p] Error during disconnect:", err);
      }
      this.node = null;
    }

    this._peerCount = 0;
    this.topicHandlers.clear();
    console.log("[p2p] Disconnected");
  }

  /**
   * Subscribe to a GossipSub topic with a message handler.
   * Returns an unsubscribe function.
   */
  subscribe(topic: string, handler: MessageHandler): () => void {
    let handlers = this.topicHandlers.get(topic);
    if (!handlers) {
      handlers = new Set();
      this.topicHandlers.set(topic, handlers);
    }
    handlers.add(handler);

    return () => {
      handlers!.delete(handler);
      if (handlers!.size === 0) {
        this.topicHandlers.delete(topic);
      }
    };
  }

  /**
   * Publish data to a GossipSub topic.
   */
  async publish(topic: string, data: Uint8Array): Promise<void> {
    if (!this.node) {
      console.warn("[p2p] Cannot publish: not connected");
      return;
    }

    try {
      const pubsub = (this.node.services as Record<string, unknown>).pubsub as {
        publish: (topic: string, data: Uint8Array) => Promise<unknown>;
      };
      await pubsub.publish(topic, data);
    } catch (err) {
      console.error(`[p2p] Publish error on ${topic}:`, err);
    }
  }

  /**
   * Listen for shard spawn events on the network.
   */
  onShardSpawn(handler: (data: Uint8Array) => void): () => void {
    return this.subscribe(TOPICS.SHARD_SPAWN, handler);
  }

  /**
   * Listen for wild shard drift position updates.
   */
  onWildDrift(handler: (data: Uint8Array) => void): () => void {
    return this.subscribe(TOPICS.WILD_DRIFT, handler);
  }

  /**
   * Listen for keeper heartbeat messages.
   */
  onKeeperHeartbeat(handler: (data: Uint8Array) => void): () => void {
    return this.subscribe(TOPICS.KEEPER_HEARTBEAT, handler);
  }

  /**
   * Listen for battle challenge events.
   */
  onBattleChallenge(handler: (data: Uint8Array) => void): () => void {
    return this.subscribe(TOPICS.BATTLE_CHALLENGE, handler);
  }
}

/** Singleton P2P client instance for the web app */
export const p2pClient = new SiphonP2PClient();
