import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-none text-base font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-siphon-teal/60 disabled:pointer-events-none disabled:opacity-50 border-2 border-transparent",
  {
    variants: {
      variant: {
        default:
          "bg-siphon-teal text-abyss border-siphon-teal shadow-[0_4px_0_rgba(1,12,14,0.95)] hover:translate-y-[1px] hover:shadow-[0_3px_0_rgba(1,12,14,0.95)] active:translate-y-[2px] active:shadow-[0_2px_0_rgba(1,12,14,0.95)]",
        destructive: "bg-red-500 text-white border-red-300 shadow-[0_4px_0_rgba(30,5,5,0.95)]",
        outline:
          "border-siphon-teal/55 bg-[rgba(8,19,31,0.85)] text-siphon-teal shadow-[0_4px_0_rgba(2,8,16,0.95)] hover:bg-[rgba(14,33,45,0.9)] hover:translate-y-[1px] hover:shadow-[0_3px_0_rgba(2,8,16,0.95)]",
        secondary:
          "bg-current text-abyss border-current shadow-[0_4px_0_rgba(19,8,4,0.9)] hover:translate-y-[1px] hover:shadow-[0_3px_0_rgba(19,8,4,0.9)]",
        ghost: "text-ghost border-transparent hover:bg-[rgba(18,34,59,0.7)] hover:text-foam",
        link: "text-siphon-teal underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-sm",
        lg: "h-12 px-6 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
