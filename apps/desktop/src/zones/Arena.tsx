import { useEffect, useMemo, useState } from "react";
import ShardScene from "@/components/ShardScene";
import { listShards, type ShardInfo } from "@/hooks/useTauri";

type DuelResult = {
  winnerId: string;
  loserId: string;
  score: string;
} | null;

export default function Arena() {
  const [shards, setShards] = useState<ShardInfo[]>([]);
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");
  const [result, setResult] = useState<DuelResult>(null);

  useEffect(() => {
    listShards()
      .then((data) => {
        setShards(data);
        if (data.length > 0) setLeftId(data[0].id);
        if (data.length > 1) setRightId(data[1].id);
      })
      .catch(() => {});
  }, []);

  const left = useMemo(() => shards.find((s) => s.id === leftId), [shards, leftId]);
  const right = useMemo(() => shards.find((s) => s.id === rightId), [shards, rightId]);

  const simulateDuel = () => {
    if (!left || !right || left.id === right.id) return;
    const leftPower = left.level + Math.random() * 4;
    const rightPower = right.level + Math.random() * 4;
    const leftWins = leftPower >= rightPower;
    const winner = leftWins ? left : right;
    const loser = leftWins ? right : left;
    setResult({
      winnerId: winner.id,
      loserId: loser.id,
      score: `${leftPower.toFixed(1)} : ${rightPower.toFixed(1)}`,
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="px-6 py-4 border-b border-deep-violet/30">
        <h1 className="text-xl font-semibold" style={{ textShadow: "0 0 10px rgba(124,58,237,0.5)" }}>
          Arena
        </h1>
        <p className="text-ghost text-sm mt-1">
          Local duel simulator
        </p>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-deep-violet/30 bg-midnight/50 p-4">
            <p className="text-xs uppercase tracking-wider text-ghost mb-2">Challenger</p>
            <select
              value={leftId}
              onChange={(e) => setLeftId(e.target.value)}
              className="w-full bg-abyss border border-deep-violet/30 rounded-md px-3 py-2 text-sm"
            >
              {shards.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.shard_type}) Lv.{s.level}
                </option>
              ))}
            </select>
            <ShardScene className="h-52 w-full mt-4" variant={left?.shard_type} />
          </div>

          <div className="rounded-xl border border-deep-violet/30 bg-midnight/50 p-4">
            <p className="text-xs uppercase tracking-wider text-ghost mb-2">Defender</p>
            <select
              value={rightId}
              onChange={(e) => setRightId(e.target.value)}
              className="w-full bg-abyss border border-deep-violet/30 rounded-md px-3 py-2 text-sm"
            >
              {shards.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.shard_type}) Lv.{s.level}
                </option>
              ))}
            </select>
            <ShardScene className="h-52 w-full mt-4" variant={right?.shard_type} />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={simulateDuel}
            disabled={!left || !right || left.id === right.id}
            className="px-4 py-2 rounded-md bg-deep-violet text-white disabled:opacity-50"
          >
            Simulate Duel
          </button>
          {left && right && left.id === right.id && (
            <p className="text-sm text-ghost">Choose two different shards.</p>
          )}
        </div>

        {result && (
          <div className="mt-4 rounded-xl border border-siphon-teal/30 bg-siphon-teal/5 p-4">
            <p className="text-sm text-ghost">Score {result.score}</p>
            <p className="text-base font-medium mt-1">
              Winner: {shards.find((s) => s.id === result.winnerId)?.name}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
