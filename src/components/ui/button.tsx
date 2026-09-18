import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "cinematic-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-sm font-semibold cursor-pointer transition-[transform,background-color,border-color,box-shadow,filter] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-0.5 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-primary/70 bg-primary text-primary-foreground shadow-brand hover:bg-primary/90",
        destructive: "border-brand/50 bg-surface-2 text-silver shadow-glass hover:bg-brand/20 hover:text-foreground",
        outline:
          "border-metal/30 bg-surface/80 text-foreground shadow-glass hover:border-cyan/40 hover:bg-surface-2",
        secondary: "border-metal/20 bg-secondary text-secondary-foreground shadow-glass hover:bg-accent",
        ghost: "border-transparent hover:border-metal/20 hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        brand:
          "border-cyan/40 brand-gradient text-primary-foreground shadow-brand hover:brightness-110",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
        xl: "h-12 rounded-xl px-8 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
