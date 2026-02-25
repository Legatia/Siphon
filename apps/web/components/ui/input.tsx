import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-none border-2 border-siphon-teal/35 bg-[rgba(7,16,29,0.88)] px-3 py-2 text-base text-foam placeholder:text-ghost/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-siphon-teal/50 focus-visible:border-siphon-teal/80 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-[0_3px_0_rgba(2,8,16,0.95)]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
