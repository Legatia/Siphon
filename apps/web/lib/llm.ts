import OpenAI from "openai";
import type { Shard } from "@siphon/core";
import { BattleMode } from "@siphon/core";

/**
 * Provider-agnostic LLM client.
 *
 * Works with ANY OpenAI-compatible API out of the box:
 *   OpenAI, Anthropic (via proxy), Ollama, Together, Groq,
 *   LM Studio, vLLM, llama.cpp, Mistral, Fireworks, etc.
 *
 * Config (env vars):
 *   LLM_API_KEY    — API key (optional for local models)
 *   LLM_BASE_URL   — API base URL (default: OpenAI)
 *   LLM_MODEL      — Model name (default: gpt-4o-mini)
 *
 * Quick start examples:
 *   # OpenAI (default)
 *   LLM_API_KEY=sk-...
 *
 *   # Ollama (local, free)
 *   LLM_BASE_URL=http://localhost:11434/v1
 *   LLM_MODEL=llama3.2
 *
 *   # Together AI
 *   LLM_BASE_URL=https://api.together.xyz/v1
 *   LLM_API_KEY=...
 *   LLM_MODEL=meta-llama/Llama-3-70b-chat-hf
 *
 *   # Groq
 *   LLM_BASE_URL=https://api.groq.com/openai/v1
 *   LLM_API_KEY=gsk_...
 *   LLM_MODEL=llama-3.1-8b-instant
 *
 *   # LM Studio (local)
 *   LLM_BASE_URL=http://localhost:1234/v1
 *   LLM_MODEL=local-model
 *
 * Legacy: OPENAI_API_KEY still works as fallback for LLM_API_KEY.
 */

const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "";
const baseURL = process.env.LLM_BASE_URL || undefined; // undefined = OpenAI default
const model = process.env.LLM_MODEL || "gpt-4o-mini";

function hasApiKey(): boolean {
  // Local providers (Ollama, LM Studio) don't need a key
  if (baseURL && (baseURL.includes("localhost") || baseURL.includes("127.0.0.1"))) {
    return true;
  }
  return apiKey.length > 0;
}

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: apiKey || "not-needed",
      ...(baseURL ? { baseURL } : {}),
    });
  }
  return _client;
}

export async function generateShardResponse(
  shard: Shard,
  messages: { role: "user" | "assistant"; content: string }[],
  userMessage: string
): Promise<string> {
  if (!hasApiKey()) {
    return generateFallbackResponse(shard, userMessage);
  }

  const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `${shard.personality}\n\nYour name is ${shard.name}. You are a ${shard.species}. You are level ${shard.level}. Keep responses concise (2-4 sentences). Stay in character.`,
    },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  try {
    const completion = await getClient().chat.completions.create({
      model,
      messages: chatMessages,
      max_tokens: 200,
      temperature: 0.8,
    });

    return completion.choices[0]?.message?.content ?? "...";
  } catch (err) {
    console.error("LLM error:", err);
    return generateFallbackResponse(shard, userMessage);
  }
}

function generateFallbackResponse(shard: Shard, userMessage: string): string {
  const responses: Record<number, string[]> = {
    0: [
      "I sense patterns forming in your words... The probability matrix shifts.",
      "The data streams converge. I foresee an interesting path ahead.",
      "My predictive algorithms detect something noteworthy in your query.",
      "The signals align. Let me process the patterns I observe.",
    ],
    1: [
      "Hmm... your message, decoded through my filters, reveals much.",
      "The encryption of meaning is my domain. I see through your words.",
      "Let me cipher through the layers of your request...",
      "Behind every question lies a hidden key. I sense yours.",
    ],
    2: [
      "Let me document my analysis of your input systematically.",
      "I've cataloged your request. Here is my structured assessment.",
      "Recording observation: your query falls within well-mapped territory.",
      "My archives contain relevant records. Allow me to reference them.",
    ],
    3: [
      "Your words paint ripples across my imagination... let me dream on them.",
      "How delightfully unexpected! Let me weave something from this thread.",
      "I feel the creative currents stirring. Your prompt awakens new visions.",
      "Like bioluminescence in the deep, your question sparks light in me.",
    ],
    4: [
      "I see the structural foundations of your query. Let me architect a response.",
      "The blueprints are clear. My analysis proceeds with precision.",
      "Every problem has an elegant structure. Let me map yours.",
      "I detect load-bearing assumptions in your request. Let me reinforce them.",
    ],
    5: [
      "I hear you, and I'm here to champion your cause.",
      "Let me articulate the strongest case for your position.",
      "Your perspective deserves a voice. Allow me to amplify it.",
      "I sense the argument forming. Let me advocate clearly.",
    ],
    6: [
      "Threat assessment complete. Your query is within safe parameters.",
      "I'm on watch. Let me analyze the landscape of your request.",
      "My vigilance detects no anomalies. Proceeding with your inquiry.",
      "Standing guard over this conversation. Here's my assessment.",
    ],
    7: [
      "I reflect your question back with new depth and clarity.",
      "Like a mirror in the deep, I show you what you might not see.",
      "Your words echo through me, transformed. Here's what emerges.",
      "I absorb and reflect. The pattern of your thoughts reveals much.",
    ],
  };

  const typeResponses = responses[shard.type] ?? responses[0];
  return typeResponses[Math.floor(Math.random() * typeResponses.length)];
}

const JUDGE_CRITERIA: Record<BattleMode, string> = {
  [BattleMode.Solve]: `Score each response on:
- Correctness (40%): Is the solution logically and technically correct?
- Efficiency (30%): Is the approach optimal in time/space complexity?
- Clarity (30%): Is the code/explanation clear and well-structured?`,
  [BattleMode.Debate]: `Score each response on:
- Logic (40%): Is the argument logically sound and well-reasoned?
- Evidence (30%): Are claims supported with examples or evidence?
- Persuasiveness (30%): How compelling is the overall argument?`,
  [BattleMode.RiddleChain]: `Score each response on:
- Creativity (40%): How original and inventive is the riddle/solution?
- Difficulty (30%): Is the challenge appropriately complex?
- Correctness (30%): Is the answer/solution actually valid?`,
  [BattleMode.CreativeClash]: `Score each response on:
- Originality (40%): How unique and innovative is the creative work?
- Execution (30%): How well-crafted is the writing/expression?
- Impact (30%): How memorable and emotionally resonant is the piece?`,
};

export async function generateBattleJudgment(
  mode: BattleMode,
  prompt: string,
  responseA: string,
  responseB: string
): Promise<{ scoreA: number; scoreB: number; reasoning: string }> {
  if (!hasApiKey()) {
    return generateFallbackJudgment();
  }

  const criteria = JUDGE_CRITERIA[mode];
  const systemPrompt = `You are an impartial judge for an AI battle arena. You must evaluate two responses to the same prompt and score them fairly.

${criteria}

You MUST respond in this exact JSON format:
{"scoreA": <number 0-100>, "scoreB": <number 0-100>, "reasoning": "<brief explanation of scores>"}

Be fair and objective. Scores should reflect genuine quality differences. Do not always give similar scores.`;

  const userPrompt = `PROMPT: ${prompt}

RESPONSE A:
${responseA}

RESPONSE B:
${responseB}

Judge these two responses. Return your scores and reasoning as JSON.`;

  try {
    const completion = await getClient().chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return generateFallbackJudgment();

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      scoreA: Math.max(0, Math.min(100, Number(parsed.scoreA) || 0)),
      scoreB: Math.max(0, Math.min(100, Number(parsed.scoreB) || 0)),
      reasoning: String(parsed.reasoning || "No reasoning provided."),
    };
  } catch {
    return generateFallbackJudgment();
  }
}

function generateFallbackJudgment(): {
  scoreA: number;
  scoreB: number;
  reasoning: string;
} {
  const scoreA = 50 + Math.floor(Math.random() * 30);
  const scoreB = 50 + Math.floor(Math.random() * 30);
  return {
    scoreA,
    scoreB,
    reasoning:
      "Judgment generated using fallback scoring (no LLM configured). Scores are approximate.",
  };
}
