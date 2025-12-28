import { ArrowLeftRight } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface SwapButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function SwapButton({ onClick, disabled, className }: SwapButtonProps) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-8 w-8 rounded-full bg-background hover:bg-muted transition-all",
        "hover:rotate-180 duration-300",
        className
      )}
    >
      <ArrowLeftRight className="h-4 w-4" />
      <span className="sr-only">Swap teams</span>
    </Button>
  );
}
