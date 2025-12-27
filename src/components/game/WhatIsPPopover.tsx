import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function WhatIsPPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8 rounded-full"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          What is P?
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm" align="start">
        <div className="space-y-3">
          <h4 className="font-semibold">Understanding Percentiles</h4>
          <p className="text-muted-foreground text-xs leading-relaxed">
            P (percentile) shows where the DraftKings line falls within
            historical head-to-head totals for this matchup.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-status-under/10">
              <div className="w-2 h-2 rounded-full bg-status-under" />
              <div>
                <div className="font-medium text-status-under">
                  UNDER (P ≥ 70)
                </div>
                <div className="text-xs text-muted-foreground">
                  Line is higher than 70% of historical games
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
              <div>
                <div className="font-medium">NO EDGE (P 30–70)</div>
                <div className="text-xs text-muted-foreground">
                  Line is within normal historical range
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-status-over/10">
              <div className="w-2 h-2 rounded-full bg-status-over" />
              <div>
                <div className="font-medium text-status-over">
                  OVER (P ≤ 30)
                </div>
                <div className="text-xs text-muted-foreground">
                  Line is lower than 70% of historical games
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground border-t pt-2">
            We require at least 5 H2H games (n≥5) before making a pick.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
