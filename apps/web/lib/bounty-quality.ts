export interface BountyQualityScore {
  overall: number;
  verdict: "excellent" | "good" | "needs_work";
  dimensions: {
    completeness: number;
    specificity: number;
    actionability: number;
    clarity: number;
  };
  strengths: string[];
  risks: string[];
  summary: string;
}

function clamp(v: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, v));
}

export function evaluateBountyQuality(output: string): BountyQualityScore {
  const text = output.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const lines = text ? text.split(/\n+/).filter(Boolean).length : 0;
  const bulletCount = (text.match(/^\s*[-*]\s+/gm) ?? []).length;
  const numberedCount = (text.match(/^\s*\d+\.\s+/gm) ?? []).length;
  const codeBlockCount = (text.match(/```[\s\S]*?```/g) ?? []).length;
  const digitCount = (text.match(/\d/g) ?? []).length;
  const sentenceCount = (text.match(/[.!?]+/g) ?? []).length || 1;

  const avgSentenceLen = words / sentenceCount;

  const completeness = clamp(
    (words >= 250 ? 70 : words >= 120 ? 55 : words >= 60 ? 40 : 20) +
      (lines >= 8 ? 20 : lines >= 4 ? 12 : 4) +
      (codeBlockCount > 0 ? 10 : 0)
  );

  const specificity = clamp(
    (digitCount >= 10 ? 35 : digitCount >= 4 ? 22 : 10) +
      (codeBlockCount > 0 ? 25 : 0) +
      (bulletCount + numberedCount >= 5 ? 30 : bulletCount + numberedCount >= 2 ? 16 : 5) +
      (words >= 140 ? 10 : 0)
  );

  const actionability = clamp(
    (bulletCount + numberedCount >= 3 ? 35 : bulletCount + numberedCount >= 1 ? 20 : 6) +
      (/\b(next|step|action|implement|deploy|verify|test|run|ship|measure)\b/i.test(text)
        ? 30
        : 8) +
      (/\bshould|must|need to|recommend\b/i.test(text) ? 20 : 5) +
      (codeBlockCount > 0 ? 15 : 8)
  );

  const clarity = clamp(
    65 - Math.max(0, avgSentenceLen - 22) * 1.6 +
      (bulletCount + numberedCount > 0 ? 18 : 4) +
      (lines > 0 ? 10 : 0)
  );

  const overall = Math.round((completeness + specificity + actionability + clarity) / 4);
  const verdict: BountyQualityScore["verdict"] =
    overall >= 80 ? "excellent" : overall >= 60 ? "good" : "needs_work";

  const strengths: string[] = [];
  const risks: string[] = [];

  if (completeness >= 70) strengths.push("Response covers scope with sufficient depth.");
  else risks.push("Output may be too shallow for confident acceptance.");

  if (specificity >= 65) strengths.push("Contains concrete details and structured evidence.");
  else risks.push("Lacks concrete details, metrics, or explicit artifacts.");

  if (actionability >= 65) strengths.push("Includes actionable steps suitable for execution.");
  else risks.push("Needs clearer next steps or implementation guidance.");

  if (clarity >= 65) strengths.push("Reasonably clear and easy to parse.");
  else risks.push("Formatting or sentence structure reduces readability.");

  const summary =
    verdict === "excellent"
      ? "High-quality submission with clear execution value."
      : verdict === "good"
      ? "Usable submission, but improvements can reduce review risk."
      : "Submission likely needs revision before approval.";

  return {
    overall,
    verdict,
    dimensions: {
      completeness: Math.round(completeness),
      specificity: Math.round(specificity),
      actionability: Math.round(actionability),
      clarity: Math.round(clarity),
    },
    strengths,
    risks,
    summary,
  };
}
