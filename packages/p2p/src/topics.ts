export const TOPICS = {
  SHARD_SPAWN: "/siphon/shard/spawn/1.0.0",
  WILD_DRIFT: "/siphon/wild/drift/1.0.0",
  KEEPER_HEARTBEAT: "/siphon/keeper/heartbeat/1.0.0",
  BATTLE_CHALLENGE: "/siphon/battle/challenge/1.0.0",
} as const;

export type TopicKey = keyof typeof TOPICS;
export type TopicValue = (typeof TOPICS)[TopicKey];
