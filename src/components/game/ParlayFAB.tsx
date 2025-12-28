import { useState } from "react";
import { Plus, X, TrendingUp, TrendingDown, Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ParlayFABProps {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  dkLine: number | null;
  percentile: number | null;
  p05: number | null;
  p95: number | null;
  className?: string;
}

export function ParlayFAB({
  gameId,
  homeTeam,
  awayTeam,
  dkLine,
  percentile,
  p05,
  p95,
  className,
}: ParlayFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [addedPicks, setAddedPicks] = useState<Set<"over" | "under">>(new Set());

  const hasEdge = percentile !== null && (percentile < 30 || percentile > 70);
  const suggestedPick = percentile !== null && percentile > 70 ? "over" : percentile !== null && percentile < 30 ? "under" : null;

  const handleAddToParlayList = (pick: "over" | "under") => {
    // Get existing parlay picks from localStorage
    const existing = JSON.parse(localStorage.getItem("parlayPicks") || "[]");
    
    // Check if this game is already in the list
    const existingIndex = existing.findIndex((p: any) => p.gameId === gameId);
    
    const newPick = {
      gameId,
      homeTeam,
      awayTeam,
      pick,
      line: dkLine,
      percentile,
      addedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      existing[existingIndex] = newPick;
    } else {
      existing.push(newPick);
    }

    localStorage.setItem("parlayPicks", JSON.stringify(existing));
    setAddedPicks(new Set([...addedPicks, pick]));
    
    toast.success(`Added ${pick.toUpperCase()} ${dkLine} to parlay list`, {
      description: `${awayTeam} @ ${homeTeam}`,
      action: {
        label: "View List",
        onClick: () => window.location.href = "/best-bets#lock-parlay",
      },
    });
  };

  const handleShare = async () => {
    const shareText = `${awayTeam} @ ${homeTeam}\n${suggestedPick ? `${suggestedPick.toUpperCase()} ${dkLine}` : `Line: ${dkLine}`}\nP${percentile} | Range: ${p05}-${p95}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${awayTeam} @ ${homeTeam}`,
          text: shareText,
        });
      } catch (e) {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      toast.success("Copied to clipboard");
    }
    setIsOpen(false);
  };

  if (!dkLine) return null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* FAB Container */}
      <div className={cn("fixed bottom-20 right-4 z-50 flex flex-col items-end gap-3", className)}>
        {/* Expanded Actions */}
        {isOpen && (
          <div className="flex flex-col gap-2 animate-in slide-in-from-bottom-4 fade-in duration-200">
            {/* Over Button */}
            <button
              onClick={() => handleAddToParlayList("over")}
              className={cn(
                "flex items-center gap-3 pl-4 pr-5 py-3 rounded-full shadow-lg transition-all",
                "bg-status-over/90 text-white hover:bg-status-over",
                suggestedPick === "over" && "ring-2 ring-white/50",
                addedPicks.has("over") && "bg-status-over"
              )}
            >
              {addedPicks.has("over") ? (
                <Check className="h-5 w-5" />
              ) : (
                <TrendingUp className="h-5 w-5" />
              )}
              <span className="font-semibold">Over {dkLine}</span>
              {suggestedPick === "over" && (
                <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">Suggested</span>
              )}
            </button>

            {/* Under Button */}
            <button
              onClick={() => handleAddToParlayList("under")}
              className={cn(
                "flex items-center gap-3 pl-4 pr-5 py-3 rounded-full shadow-lg transition-all",
                "bg-status-under/90 text-white hover:bg-status-under",
                suggestedPick === "under" && "ring-2 ring-white/50",
                addedPicks.has("under") && "bg-status-under"
              )}
            >
              {addedPicks.has("under") ? (
                <Check className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
              <span className="font-semibold">Under {dkLine}</span>
              {suggestedPick === "under" && (
                <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">Suggested</span>
              )}
            </button>

            {/* Share Button */}
            <button
              onClick={handleShare}
              className="flex items-center gap-3 pl-4 pr-5 py-3 rounded-full shadow-lg bg-muted hover:bg-muted/80 transition-all"
            >
              <Share2 className="h-5 w-5" />
              <span className="font-semibold">Share Pick</span>
            </button>
          </div>
        )}

        {/* Main FAB Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "fab-button flex items-center justify-center w-14 h-14 rounded-full shadow-xl transition-all",
            isOpen 
              ? "bg-muted-foreground rotate-45" 
              : hasEdge 
                ? "bg-status-edge shadow-edge-glow" 
                : "bg-primary",
            "hover:scale-105 active:scale-95"
          )}
        >
          {isOpen ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <Plus className="h-6 w-6 text-white" />
          )}
        </button>

        {/* Badge for edge indicator */}
        {!isOpen && hasEdge && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-status-edge flex items-center justify-center animate-pulse">
            <span className="text-2xs font-bold text-white">!</span>
          </div>
        )}
      </div>
    </>
  );
}
