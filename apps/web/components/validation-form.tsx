"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ValidationFormProps {
  tokenId: string;
  onValidated?: () => void;
}

export function ValidationForm({ tokenId, onValidated }: ValidationFormProps) {
  const [result, setResult] = useState<boolean>(true);
  const [evidence, setEvidence] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!evidence.trim()) {
      setFeedback({ type: "error", message: "Evidence is required" });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/identity/${tokenId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validatorId: "local-validator",
          result,
          evidence: evidence.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Validation submission failed");
      }

      const data = await res.json();

      setFeedback({
        type: "success",
        message: `Validation recorded. Total validations: ${data.validationCount}`,
      });
      setEvidence("");
      onValidated?.();
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to submit validation",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-ghost">
          Submit Validation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Result toggle */}
          <div className="space-y-2">
            <label className="text-xs text-ghost font-medium">Result</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setResult(true)}
                className={cn(
                  "flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all border",
                  result
                    ? "bg-siphon-teal/20 text-siphon-teal border-siphon-teal/40 shadow-[0_0_15px_rgba(0,212,170,0.15)]"
                    : "bg-transparent text-ghost border-ghost/20 hover:border-ghost/40"
                )}
              >
                Pass
              </button>
              <button
                type="button"
                onClick={() => setResult(false)}
                className={cn(
                  "flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all border",
                  !result
                    ? "bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                    : "bg-transparent text-ghost border-ghost/20 hover:border-ghost/40"
                )}
              >
                Fail
              </button>
            </div>
          </div>

          {/* Evidence textarea */}
          <div className="space-y-2">
            <label
              htmlFor="evidence"
              className="text-xs text-ghost font-medium"
            >
              Evidence
            </label>
            <textarea
              id="evidence"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="Describe the validation evidence..."
              rows={4}
              disabled={submitting}
              className={cn(
                "w-full rounded-lg border border-siphon-teal/10 bg-abyss/60 px-4 py-3",
                "text-sm text-foam placeholder:text-ghost/50",
                "focus:outline-none focus:ring-2 focus:ring-siphon-teal/50 focus:border-siphon-teal/30",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "resize-none transition-all"
              )}
            />
          </div>

          {/* Feedback message */}
          {feedback && (
            <div
              className={cn(
                "rounded-lg px-4 py-3 text-sm border",
                feedback.type === "success"
                  ? "bg-siphon-teal/10 text-siphon-teal border-siphon-teal/20"
                  : "bg-red-500/10 text-red-400 border-red-500/20"
              )}
            >
              {feedback.message}
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting || !evidence.trim()}
            className="w-full"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-abyss animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-abyss animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-abyss animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            ) : (
              "Submit Validation"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
