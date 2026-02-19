import { useEffect, useState } from "react";
import ShardScene from "@/components/ShardScene";
import { listShards, type ShardInfo } from "@/hooks/useTauri";

const SHARD_TYPE_COLORS: Record<string, string> = {
  Oracle: "#f59e0b",
  Cipher: "#3b82f6",
  Scribe: "#00d4aa",
  Muse: "#ec4899",
  Architect: "#8b5cf6",
  Advocate: "#ef4444",
  Sentinel: "#6b7280",
  Mirror: "#e2e8f0",
};

export default function Farm() {
  const [shards, setShards] = useState<ShardInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listShards()
      .then(setShards)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="px-6 py-4 border-b border-siphon-teal/10">
        <h1 className="text-xl font-semibold glow-text">The Drift</h1>
        <p className="text-ghost text-sm mt-1">
          Capture, train, and fuse your shards
        </p>
      </header>

      <div className="flex-1 flex flex-col overflow-auto">
        <ShardScene className="h-64 w-full" />

        <div className="px-6 py-4 flex-1">
          <h2 className="text-sm font-medium text-ghost uppercase tracking-wider mb-3">
            Your Shards
          </h2>

          {loading && (
            <p className="text-ghost text-sm">Loading shards...</p>
          )}
          {error && (
            <p className="text-ember text-sm">
              Could not load shards: {error}
            </p>
          )}

          {!loading && !error && shards.length === 0 && (
            <div className="text-center py-12 text-ghost">
              <p className="text-lg mb-1">No shards yet</p>
              <p className="text-sm">
                Capture wild shards in The Drift or spawn one from the web app.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {shards.map((shard) => (
              <div
                key={shard.id}
                className="glow-border rounded-lg p-3 bg-midnight/50 hover:bg-midnight/80 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        SHARD_TYPE_COLORS[shard.shard_type] ?? "#00d4aa",
                    }}
                  />
                  <span className="text-sm font-medium truncate">
                    {shard.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-ghost">
                  <span>{shard.shard_type}</span>
                  <span>Lv.{shard.level}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
