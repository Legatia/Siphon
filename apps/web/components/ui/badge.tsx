import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-siphon-teal/30 bg-siphon-teal/10 text-siphon-teal",
        oracle: "border-siphon-teal/30 bg-siphon-teal/10 text-siphon-teal",
        cipher: "border-deep-violet/30 bg-deep-violet/10 text-deep-violet",
        scribe: "border-current/30 bg-current/10 text-current",
        muse: "border-ember/30 bg-ember/10 text-ember",
        architect: "border-cyan-400/30 bg-cyan-400/10 text-cyan-400",
        advocate: "border-pink-400/30 bg-pink-400/10 text-pink-400",
        sentinel: "border-red-400/30 bg-red-400/10 text-red-400",
        mirror: "border-purple-400/30 bg-purple-400/10 text-purple-400",
        secondary: "border-ghost/30 bg-ghost/10 text-ghost",
        destructive: "border-red-500/30 bg-red-500/10 text-red-400",
        success: "border-green-500/30 bg-green-500/10 text-green-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
