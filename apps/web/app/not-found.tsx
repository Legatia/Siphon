import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Ghost } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="p-8 max-w-md text-center space-y-4">
        <Ghost className="h-12 w-12 text-ghost/30 mx-auto" />
        <h2 className="text-xl font-bold text-foam">Lost in the Drift</h2>
        <p className="text-ghost text-sm">
          This page doesn&apos;t exist. The signal faded before we could lock on.
        </p>
        <Link href="/">
          <Button variant="outline">Return Home</Button>
        </Link>
      </Card>
    </div>
  );
}
