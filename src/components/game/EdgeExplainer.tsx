import { HelpCircle, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EdgeExplainerProps {
  compact?: boolean;
  className?: string;
}

export function EdgeExplainer({ compact = false, className }: EdgeExplainerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors",
            compact ? "text-xs" : "text-sm",
            className
          )}
        >
          <HelpCircle className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
          <span>How picks work</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-foreground mb-2">Edge Detection</h4>
            <p className="text-sm text-muted-foreground">
              We compare DraftKings lines against historical head-to-head data to find value.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded bg-status-over/20 text-status-over shrink-0 mt-0.5">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="font-medium text-sm text-foreground">OVER</span>
                <p className="text-xs text-muted-foreground">
                  DK line is low vs history. 95%+ of past games scored higher than this line.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded bg-status-under/20 text-status-under shrink-0 mt-0.5">
                <TrendingDown className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="font-medium text-sm text-foreground">UNDER</span>
                <p className="text-xs text-muted-foreground">
                  DK line is high vs history. 95%+ of past games scored lower than this line.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded bg-secondary text-muted-foreground shrink-0 mt-0.5">
                <Minus className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="font-medium text-sm text-foreground">NO EDGE</span>
                <p className="text-xs text-muted-foreground">
                  DK line falls within the normal historical range. No clear value either way.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">+X.X edge</span> = points between the DK line and historical threshold. Higher = stronger signal.
              </p>
            </div>
          </div>

          <div className="text-xs text-muted-foreground/70 pt-1">
            Requires 5+ historical matchups (n≥5) for recommendations.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
