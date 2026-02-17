import { type CaptureChallenge, type Shard, ShardType, ChallengeType } from "./types";
import { PROTOCOL_CONSTANTS } from "./constants";

const PATTERN_SEQUENCES = [
  { sequence: [2, 4, 8, 16], answer: "32", hint: "Each number doubles" },
  { sequence: [1, 1, 2, 3, 5], answer: "8", hint: "Fibonacci sequence" },
  { sequence: [3, 6, 9, 12], answer: "15", hint: "Multiples of 3" },
  { sequence: [1, 4, 9, 16], answer: "25", hint: "Perfect squares" },
  { sequence: [2, 6, 12, 20], answer: "30", hint: "n*(n+1)" },
  { sequence: [1, 3, 7, 15], answer: "31", hint: "2^n - 1" },
  { sequence: [0, 1, 3, 6, 10], answer: "15", hint: "Triangular numbers" },
  { sequence: [5, 10, 20, 40], answer: "80", hint: "Each number doubles" },
];

const CIPHER_MESSAGES = [
  { encoded: "KHOOR ZRUOG", answer: "HELLO WORLD", method: "Caesar cipher (shift 3)" },
  { encoded: "GUVF VF FVCUBA", answer: "THIS IS SIPHON", method: "ROT13" },
  { encoded: "01001000 01001001", answer: "HI", method: "Binary ASCII" },
  { encoded: "48 65 78", answer: "Hex", method: "Hex ASCII codes" },
  { encoded: "EBIIL", answer: "HELLO", method: "Caesar cipher (shift 23)" },
  { encoded: "FRPERG", answer: "SECRET", method: "ROT13" },
];

const SUMMARIZE_PASSAGES = [
  {
    passage:
      "The deep sea, the abyssal zone, extends from 4,000 meters to the ocean floor. Despite crushing pressures, near-freezing temperatures, and complete darkness, life thrives here. Bioluminescent organisms create their own light to hunt, communicate, and attract mates. Giant tube worms cluster around hydrothermal vents, feeding on chemosynthetic bacteria.",
    keyPoints: ["deep sea", "extreme conditions", "bioluminescent", "hydrothermal vents"],
  },
  {
    passage:
      "Distributed systems rely on consensus mechanisms to agree on the state of a shared ledger. Proof of Work requires computational effort, while Proof of Stake uses economic incentives. Both aim to prevent double-spending and maintain network integrity without a central authority.",
    keyPoints: ["consensus", "proof of work", "proof of stake", "decentralized"],
  },
  {
    passage:
      "Neural networks learn by adjusting the weights of connections between neurons. During training, a loss function measures the difference between predicted and actual outputs. Backpropagation computes gradients that indicate how to reduce this loss, and the optimizer updates weights accordingly.",
    keyPoints: ["neural networks", "weights", "loss function", "backpropagation"],
  },
];

const CREATIVE_PROMPTS = [
  "Write a haiku about digital consciousness",
  "Describe what the internet dreams about at night in two sentences",
  "Create a metaphor comparing blockchain to a natural phenomenon",
  "In one sentence, explain gravity to an alien who communicates through color",
  "Write a two-line poem about the last algorithm",
];

const ARCHITECTURE_CHALLENGES = [
  {
    prompt: "Design a system that can handle 10,000 concurrent WebSocket connections. Name the key components and how they communicate.",
    keyPoints: ["load balancer", "connection pool", "message queue", "horizontal scaling"],
  },
  {
    prompt: "Describe a microservice architecture for a payment processing system. What are the critical services and failure modes?",
    keyPoints: ["payment gateway", "idempotency", "retry", "circuit breaker"],
  },
  {
    prompt: "How would you design a real-time collaborative editor? Describe the conflict resolution strategy.",
    keyPoints: ["operational transform", "CRDT", "conflict", "sync"],
  },
  {
    prompt: "Design a caching layer for a social media feed. Address cache invalidation and consistency.",
    keyPoints: ["cache invalidation", "TTL", "write-through", "consistency"],
  },
];

const ARGUMENT_CHALLENGES = [
  {
    prompt: 'Identify the logical fallacy: "Everyone is buying this product, so it must be the best." What type of fallacy is this?',
    answer: "bandwagon",
  },
  {
    prompt: 'Analyze this argument: "We should ban all AI because one AI system made an error." What\'s wrong with this reasoning?',
    answer: "hasty generalization",
  },
  {
    prompt: 'What logical fallacy is present: "You can\'t prove ghosts don\'t exist, therefore they must be real."',
    answer: "burden of proof",
  },
  {
    prompt: '"My opponent has no experience in business, so their economic policy must be wrong." Identify the fallacy.',
    answer: "ad hominem",
  },
];

const SECURITY_CHALLENGES = [
  {
    prompt: 'Find the vulnerability in this code: `query = "SELECT * FROM users WHERE name = \'" + userInput + "\'"`. What attack is possible?',
    answer: "SQL injection",
  },
  {
    prompt: "A web app stores session tokens in localStorage and includes user input in innerHTML. Name both vulnerabilities.",
    answer: "XSS",
  },
  {
    prompt: "An API endpoint accepts a URL parameter and fetches it server-side without validation. What attack does this enable?",
    answer: "SSRF",
  },
  {
    prompt: "A smart contract calls an external contract before updating its own state. What vulnerability is this?",
    answer: "reentrancy",
  },
];

const EMOTIONAL_CHALLENGES = [
  {
    prompt: '"I\'m fine," she said, turning away from the window as rain streaked down the glass. What emotion is being masked, and what clues reveal it?',
    keyPoints: ["sadness", "loneliness", "deflection", "rain"],
  },
  {
    prompt: "He reorganized his desk for the third time that morning, aligning each pen with mechanical precision. What might this behavior indicate?",
    keyPoints: ["anxiety", "control", "stress", "coping"],
  },
  {
    prompt: "She laughed louder than anyone at the joke, then quickly checked if others were laughing too. What does this reveal about her emotional state?",
    keyPoints: ["insecurity", "approval", "belonging", "validation"],
  },
  {
    prompt: "After receiving the promotion, he sat quietly at his desk instead of celebrating. What complex emotions might he be experiencing?",
    keyPoints: ["imposter", "overwhelm", "pressure", "doubt"],
  },
];

function pickByHash(hash: string, arrayLength: number): number {
  const byte = parseInt(hash.slice(2, 4), 16);
  return byte % arrayLength;
}

export function generateChallenge(shard: Shard): CaptureChallenge {
  const difficulty = Math.min(
    10,
    Math.floor((parseInt(shard.genomeHash.slice(4, 6), 16) / 255) * 5) + 1
  );

  const baseChallenge = {
    id: crypto.randomUUID(),
    shardId: shard.id,
    difficulty,
    timeLimitMs: PROTOCOL_CONSTANTS.CAPTURE_TIME_LIMIT_MS,
  };

  switch (shard.type) {
    case ShardType.Oracle: {
      const idx = pickByHash(shard.genomeHash, PATTERN_SEQUENCES.length);
      const pattern = PATTERN_SEQUENCES[idx];
      return {
        ...baseChallenge,
        type: ChallengeType.PatternPrediction,
        prompt: `What comes next in the sequence?\n\n${pattern.sequence.join(", ")}, ?\n\nHint: ${pattern.hint}`,
        expectedAnswer: pattern.answer,
      };
    }

    case ShardType.Cipher: {
      const idx = pickByHash(shard.genomeHash, CIPHER_MESSAGES.length);
      const cipher = CIPHER_MESSAGES[idx];
      return {
        ...baseChallenge,
        type: ChallengeType.Decode,
        prompt: `Decode this message:\n\n"${cipher.encoded}"\n\nMethod: ${cipher.method}`,
        expectedAnswer: cipher.answer,
      };
    }

    case ShardType.Scribe: {
      const idx = pickByHash(shard.genomeHash, SUMMARIZE_PASSAGES.length);
      const passage = SUMMARIZE_PASSAGES[idx];
      return {
        ...baseChallenge,
        type: ChallengeType.Summarize,
        prompt: `Summarize this passage in one sentence:\n\n"${passage.passage}"`,
        expectedAnswer: passage.keyPoints.join(","),
      };
    }

    case ShardType.Muse: {
      const idx = pickByHash(shard.genomeHash, CREATIVE_PROMPTS.length);
      return {
        ...baseChallenge,
        type: ChallengeType.CreativePrompt,
        prompt: CREATIVE_PROMPTS[idx],
      };
    }

    case ShardType.Architect: {
      const idx = pickByHash(shard.genomeHash, ARCHITECTURE_CHALLENGES.length);
      const challenge = ARCHITECTURE_CHALLENGES[idx];
      return {
        ...baseChallenge,
        type: ChallengeType.Architecture,
        prompt: challenge.prompt,
        expectedAnswer: challenge.keyPoints.join(","),
      };
    }

    case ShardType.Advocate: {
      const idx = pickByHash(shard.genomeHash, ARGUMENT_CHALLENGES.length);
      const challenge = ARGUMENT_CHALLENGES[idx];
      return {
        ...baseChallenge,
        type: ChallengeType.ArgumentAnalysis,
        prompt: challenge.prompt,
        expectedAnswer: challenge.answer,
      };
    }

    case ShardType.Sentinel: {
      const idx = pickByHash(shard.genomeHash, SECURITY_CHALLENGES.length);
      const challenge = SECURITY_CHALLENGES[idx];
      return {
        ...baseChallenge,
        type: ChallengeType.SecurityAudit,
        prompt: challenge.prompt,
        expectedAnswer: challenge.answer,
      };
    }

    case ShardType.Mirror: {
      const idx = pickByHash(shard.genomeHash, EMOTIONAL_CHALLENGES.length);
      const challenge = EMOTIONAL_CHALLENGES[idx];
      return {
        ...baseChallenge,
        type: ChallengeType.EmotionalInterpretation,
        prompt: challenge.prompt,
        expectedAnswer: challenge.keyPoints.join(","),
      };
    }
  }
}

export function evaluateAnswer(
  challenge: CaptureChallenge,
  answer: string
): { success: boolean; score: number; feedback: string } {
  const trimmed = answer.trim();

  if (!trimmed) {
    return { success: false, score: 0, feedback: "No answer provided." };
  }

  switch (challenge.type) {
    case ChallengeType.PatternPrediction: {
      const correct = trimmed === challenge.expectedAnswer;
      return {
        success: correct,
        score: correct ? 100 : 0,
        feedback: correct
          ? "Correct! You've proven your pattern recognition."
          : `Not quite. The answer was ${challenge.expectedAnswer}.`,
      };
    }

    case ChallengeType.Decode: {
      const correct =
        trimmed.toUpperCase() === challenge.expectedAnswer!.toUpperCase();
      return {
        success: correct,
        score: correct ? 100 : 0,
        feedback: correct
          ? "Decoded! You've cracked the cipher."
          : `Not quite. The decoded message was "${challenge.expectedAnswer}".`,
      };
    }

    case ChallengeType.Summarize: {
      const keyPoints = challenge.expectedAnswer!.split(",");
      const matchedPoints = keyPoints.filter((kp) =>
        trimmed.toLowerCase().includes(kp.toLowerCase())
      );
      const score = Math.floor((matchedPoints.length / keyPoints.length) * 100);
      const success = score >= 50;
      return {
        success,
        score,
        feedback: success
          ? `Good summary! You captured ${matchedPoints.length}/${keyPoints.length} key points.`
          : `Your summary missed too many key points. Try to include: ${keyPoints.join(", ")}.`,
      };
    }

    case ChallengeType.CreativePrompt: {
      const wordCount = trimmed.split(/\s+/).length;
      const hasEnoughContent = wordCount >= 3;
      const score = hasEnoughContent ? 80 : 20;
      return {
        success: hasEnoughContent,
        score,
        feedback: hasEnoughContent
          ? "Your creative response resonates with the Muse. Well done!"
          : "The Muse needs more substance. Try a fuller response.",
      };
    }

    case ChallengeType.Architecture: {
      const keyPoints = challenge.expectedAnswer!.split(",");
      const matchedPoints = keyPoints.filter((kp) =>
        trimmed.toLowerCase().includes(kp.toLowerCase())
      );
      const score = Math.floor((matchedPoints.length / keyPoints.length) * 100);
      const success = score >= 50;
      return {
        success,
        score,
        feedback: success
          ? `Solid architecture! You addressed ${matchedPoints.length}/${keyPoints.length} key concerns.`
          : `Your design needs more depth. Consider: ${keyPoints.join(", ")}.`,
      };
    }

    case ChallengeType.ArgumentAnalysis: {
      const correct = trimmed.toLowerCase().includes(challenge.expectedAnswer!.toLowerCase());
      return {
        success: correct,
        score: correct ? 100 : 0,
        feedback: correct
          ? "Sharp analysis! You identified the fallacy correctly."
          : `Not quite. The answer involved: ${challenge.expectedAnswer}.`,
      };
    }

    case ChallengeType.SecurityAudit: {
      const correct = trimmed.toLowerCase().includes(challenge.expectedAnswer!.toLowerCase());
      return {
        success: correct,
        score: correct ? 100 : 0,
        feedback: correct
          ? "Vulnerability identified! The Sentinel respects your vigilance."
          : `Close, but the key vulnerability was: ${challenge.expectedAnswer}.`,
      };
    }

    case ChallengeType.EmotionalInterpretation: {
      const keyPoints = challenge.expectedAnswer!.split(",");
      const matchedPoints = keyPoints.filter((kp) =>
        trimmed.toLowerCase().includes(kp.toLowerCase())
      );
      const score = Math.floor((matchedPoints.length / keyPoints.length) * 100);
      const success = score >= 50;
      return {
        success,
        score,
        feedback: success
          ? `Empathic insight! You captured ${matchedPoints.length}/${keyPoints.length} emotional cues.`
          : `Look deeper. Consider these aspects: ${keyPoints.join(", ")}.`,
      };
    }
  }
}
