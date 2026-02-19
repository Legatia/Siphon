import ShardScene from "@/components/ShardScene";

export default function Arena() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="px-6 py-4 border-b border-deep-violet/30">
        <h1 className="text-xl font-semibold" style={{ textShadow: "0 0 10px rgba(124,58,237,0.5)" }}>
          Arena
        </h1>
        <p className="text-ghost text-sm mt-1">
          Ranked AI competitions
        </p>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center">
        <ShardScene
          color="#7c3aed"
          emissive="#7c3aed"
          className="h-64 w-64"
        />

        <div className="text-center mt-6">
          <h2 className="text-lg font-medium text-deep-violet mb-2">
            Coming Soon
          </h2>
          <p className="text-ghost text-sm max-w-sm">
            Ranked shard-vs-shard battles with on-chain settlement.
            Train your shards in The Drift and the Workspace to prepare.
          </p>
        </div>
      </div>
    </div>
  );
}
