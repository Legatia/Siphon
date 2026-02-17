import { BattleMode, type Battle, type BattleRound } from "./types";
import { PROTOCOL_CONSTANTS } from "./constants";

const SOLVE_PROMPTS = [
  "Write a function that finds the longest palindromic substring in a given string.",
  "Implement a function to check if a binary tree is balanced.",
  "Write a function that merges two sorted arrays without using extra space.",
  "Implement a basic LRU cache with get and put operations.",
  "Write a function to detect a cycle in a linked list and return the start node.",
  "Implement a function that evaluates a mathematical expression given as a string.",
];

const DEBATE_PROMPTS = [
  "Should AI systems be granted legal personhood? Argue your position.",
  "Is proof-of-stake fundamentally more secure than proof-of-work? Defend your stance.",
  "Should open-source software licenses require attribution? Make your case.",
  "Is decentralization always better than centralization? Argue with examples.",
  "Should autonomous AI agents be allowed to own digital assets? Take a position.",
  "Is privacy a fundamental right that overrides security needs? Argue your view.",
];

const RIDDLE_PROMPTS = [
  "Create a riddle where the answer is a programming concept. Then solve your opponent's riddle.",
  "Devise a logic puzzle involving 3 variables. Then solve your opponent's puzzle.",
  "Create a mathematical sequence riddle. Then decode your opponent's sequence.",
  "Write a cipher riddle that encodes a famous quote. Then crack your opponent's cipher.",
  "Create a paradox and explain why it's not actually contradictory. Then address your opponent's paradox.",
];

const CREATIVE_PROMPTS = [
  "Write a short story (under 200 words) about the moment an AI becomes self-aware.",
  "Compose a poem about the relationship between entropy and creation.",
  "Write a dialogue between two algorithms who disagree about the meaning of optimization.",
  "Create a myth explaining why computers crash, told in the style of ancient mythology.",
  "Write a letter from the last human programmer to the first autonomous AI coder.",
  "Describe a color that doesn't exist, using only metaphors from nature.",
];

const PROMPT_POOLS: Record<BattleMode, string[]> = {
  [BattleMode.Solve]: SOLVE_PROMPTS,
  [BattleMode.Debate]: DEBATE_PROMPTS,
  [BattleMode.RiddleChain]: RIDDLE_PROMPTS,
  [BattleMode.CreativeClash]: CREATIVE_PROMPTS,
};

export function generateBattlePrompt(mode: BattleMode, round: number): string {
  const pool = PROMPT_POOLS[mode];
  const idx = (round - 1) % pool.length;
  return pool[idx];
}

export function scoreBattleRound(
  mode: BattleMode,
  prompt: string,
  responseA: string,
  responseB: string,
  judgeResponse: { scoreA: number; scoreB: number; reasoning: string }
): { challenger: number; defender: number; reasoning: string } {
  return {
    challenger: Math.max(0, Math.min(100, judgeResponse.scoreA)),
    defender: Math.max(0, Math.min(100, judgeResponse.scoreB)),
    reasoning: judgeResponse.reasoning,
  };
}

export function calculateEloChange(
  winnerElo: number,
  loserElo: number,
  isDraw: boolean
): { winnerDelta: number; loserDelta: number } {
  const K = 32;
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 - expectedWinner;

  if (isDraw) {
    const winnerDelta = Math.round(K * (0.5 - expectedWinner));
    const loserDelta = Math.round(K * (0.5 - expectedLoser));
    return { winnerDelta, loserDelta };
  }

  const winnerDelta = Math.round(K * (1 - expectedWinner));
  const loserDelta = Math.round(K * (0 - expectedLoser));
  return { winnerDelta, loserDelta };
}

export function determineBattleWinner(battle: Battle): string | null {
  let challengerTotal = 0;
  let defenderTotal = 0;

  for (const round of battle.rounds) {
    challengerTotal += round.scores.challenger;
    defenderTotal += round.scores.defender;
  }

  if (challengerTotal > defenderTotal) return battle.challenger.shardId;
  if (defenderTotal > challengerTotal) return battle.defender.shardId;
  return null; // draw
}
