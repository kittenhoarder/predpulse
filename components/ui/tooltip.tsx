"use client";
import * as React from "react";
import * as Primitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";
const TooltipProvider = Primitive.Provider;
const TouchContext = React.createContext<(() => void) | null>(null);
function Tooltip({
  children,
  ...props
}: React.ComponentProps<typeof Primitive.Root>) {
  const [open, setOpen] = React.useState(false);
  return (
    <TouchContext.Provider value={() => setOpen((value) => !value)}>
      <Primitive.Root
        {...props}
        open={props.open ?? open}
        onOpenChange={(value) => {
          setOpen(value);
          props.onOpenChange?.(value);
        }}
      >
        {children}
      </Primitive.Root>
    </TouchContext.Provider>
  );
}
const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof Primitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof Primitive.Trigger>
>(({ onClick, ...props }, ref) => {
  const toggle = React.useContext(TouchContext);
  return (
    <Primitive.Trigger
      ref={ref}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (window.matchMedia("(hover: none)").matches) toggle?.();
      }}
    />
  );
});
TooltipTrigger.displayName = "TooltipTrigger";
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <Primitive.Portal>
    <Primitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={16}
      className={cn(
        "z-[60] max-w-[calc(100vw-2rem)] rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground shadow-lg",
        className,
      )}
      {...props}
    />
  </Primitive.Portal>
));
TooltipContent.displayName = "TooltipContent";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
