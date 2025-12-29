import { AlertTriangle, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Injury {
  id: string;
  player_name: string;
  position: string | null;
  injury_status: string;
  injury_type: string | null;
  injury_details: string | null;
}

interface InjuryCardProps {
  homeTeamName: string;
  awayTeamName: string;
  homeTeamAbbrev: string;
  awayTeamAbbrev: string;
  homeInjuries: Injury[];
  awayInjuries: Injury[];
}

const statusOrder: Record<string, number> = {
  out: 0,
  ir: 0,
  doubtful: 1,
  questionable: 2,
  probable: 3,
};

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  out: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30" },
  ir: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30" },
  doubtful: { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/30" },
  questionable: { bg: "bg-yellow-500/10", text: "text-yellow-500", border: "border-yellow-500/30" },
  probable: { bg: "bg-green-500/10", text: "text-green-500", border: "border-green-500/30" },
};

function getStatusKey(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("out") || normalized === "o") return "out";
  if (normalized.includes("ir") || normalized.includes("injured reserve")) return "ir";
  if (normalized.includes("doubtful") || normalized === "d") return "doubtful";
  if (normalized.includes("questionable") || normalized === "q") return "questionable";
  if (normalized.includes("probable") || normalized === "p") return "probable";
  return "questionable";
}

function sortInjuries(injuries: Injury[]): Injury[] {
  return [...injuries].sort((a, b) => {
    const aKey = getStatusKey(a.injury_status);
    const bKey = getStatusKey(b.injury_status);
    return (statusOrder[aKey] ?? 99) - (statusOrder[bKey] ?? 99);
  });
}

function InjuryList({ injuries, teamName }: { injuries: Injury[]; teamName: string }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = sortInjuries(injuries);
  const displayInjuries = expanded ? sorted : sorted.slice(0, 5);
  const hasMore = sorted.length > 5;

  if (injuries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic py-2">
        No injuries reported
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayInjuries.map((injury) => {
        const statusKey = getStatusKey(injury.injury_status);
        const colors = statusColors[statusKey] || statusColors.questionable;

        return (
          <div
            key={injury.id}
            className={cn(
              "flex items-start gap-3 p-2.5 rounded-lg border",
              colors.bg,
              colors.border
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={cn("text-sm font-medium", colors.text)}>
                  {injury.player_name}
                </span>
                {injury.position && (
                  <span className="text-xs text-muted-foreground">
                    ({injury.position})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={cn("font-semibold uppercase", colors.text)}>
                  {injury.injury_status}
                </span>
                {injury.injury_type && (
                  <span className="text-muted-foreground">
                    • {injury.injury_type}
                  </span>
                )}
              </div>
              {injury.injury_details && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {injury.injury_details}
                </p>
              )}
            </div>
          </div>
        );
      })}
      
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              Show {sorted.length - 5} more
            </>
          )}
        </Button>
      )}
    </div>
  );
}

export function InjuryCard({
  homeTeamName,
  awayTeamName,
  homeTeamAbbrev,
  awayTeamAbbrev,
  homeInjuries,
  awayInjuries,
}: InjuryCardProps) {
  const totalInjuries = homeInjuries.length + awayInjuries.length;
  
  const homeOut = homeInjuries.filter(i => {
    const key = getStatusKey(i.injury_status);
    return key === "out" || key === "ir";
  }).length;
  
  const awayOut = awayInjuries.filter(i => {
    const key = getStatusKey(i.injury_status);
    return key === "out" || key === "ir";
  }).length;

  if (totalInjuries === 0) {
    return null;
  }

  return (
    <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <span className="font-semibold">Injury Report</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {homeOut + awayOut > 0 && (
            <span className="px-2 py-0.5 rounded bg-destructive/10 text-destructive font-medium">
              {homeOut + awayOut} OUT
            </span>
          )}
          <span className="text-muted-foreground">
            {totalInjuries} total
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/40">
        {/* Away team */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Away</span>
            <span className="font-medium">{awayTeamAbbrev}</span>
            {awayInjuries.length > 0 && (
              <span className="text-xs text-muted-foreground">
                ({awayInjuries.length})
              </span>
            )}
          </div>
          <InjuryList injuries={awayInjuries} teamName={awayTeamName} />
        </div>

        {/* Home team */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Home</span>
            <span className="font-medium">{homeTeamAbbrev}</span>
            {homeInjuries.length > 0 && (
              <span className="text-xs text-muted-foreground">
                ({homeInjuries.length})
              </span>
            )}
          </div>
          <InjuryList injuries={homeInjuries} teamName={homeTeamName} />
        </div>
      </div>
    </div>
  );
}
