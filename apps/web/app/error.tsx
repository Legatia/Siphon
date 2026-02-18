"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="p-8 max-w-md text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-ember mx-auto" />
        <h2 className="text-xl font-bold text-foam">Something went wrong</h2>
        <p className="text-ghost text-sm">
          {error.message || "An unexpected error occurred."}
        </p>
        <Button onClick={reset} variant="outline">
          Try Again
        </Button>
      </Card>
    </div>
  );
}
