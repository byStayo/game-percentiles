import { cn } from "@/lib/utils";
import { Users, TrendingUp, Calendar } from "lucide-react";

interface RosterContinuityCardProps {
  homeTeamName: string;
  awayTeamName: string;
  homeContinuity: number | null;
  awayContinuity: number | null;
  homeEra: string | null;
  awayEra: string | null;
}

export function RosterContinuityCard({
  homeTeamName,
  awayTeamName,
  homeContinuity,
  awayContinuity,
  homeEra,
  awayEra,
}: RosterContinuityCardProps) {
  const hasData = homeContinuity !== null || awayContinuity !== null;

  if (!hasData) {
    return null;
  }

  return (
    <div className="bg-card rounded-2xl border border-border/60 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Roster Continuity</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TeamContinuityBox
          teamName={awayTeamName}
          label="Away"
          continuity={awayContinuity}
          era={awayEra}
        />
        <TeamContinuityBox
          teamName={homeTeamName}
          label="Home"
          continuity={homeContinuity}
          era={homeEra}
        />
      </div>

      <p className="text-2xs text-muted-foreground mt-4 text-center">
        Higher continuity means historical data is more applicable to current roster
      </p>
    </div>
  );
}

function TeamContinuityBox({
  teamName,
  label,
  continuity,
  era,
}: {
  teamName: string;
  label: string;
  continuity: number | null;
  era: string | null;
}) {
  const getContinuityColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 70) return "text-status-live";
    if (score >= 40) return "text-yellow-500";
    return "text-status-over";
  };

  const getContinuityLabel = (score: number | null) => {
    if (score === null) return "Unknown";
    if (score >= 70) return "High";
    if (score >= 40) return "Medium";
    return "Low";
  };

  const getContinuityBg = (score: number | null) => {
    if (score === null) return "bg-muted/30";
    if (score >= 70) return "bg-status-live/10";
    if (score >= 40) return "bg-yellow-500/10";
    return "bg-status-over/10";
  };

  return (
    <div className={cn(
      "p-4 rounded-xl",
      getContinuityBg(continuity)
    )}>
      <div className="text-2xs text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="font-medium text-sm truncate mb-3">{teamName}</div>

      {/* Continuity Score */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className={cn(
          "text-3xl font-bold tabular-nums",
          getContinuityColor(continuity)
        )}>
          {continuity !== null ? `${Math.round(continuity)}%` : "—"}
        </span>
        <span className={cn(
          "text-xs font-medium",
          getContinuityColor(continuity)
        )}>
          {getContinuityLabel(continuity)}
        </span>
      </div>

      {/* Era Tag */}
      {era && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{era}</span>
        </div>
      )}

      {/* Progress Bar */}
      {continuity !== null && (
        <div className="mt-3 h-1.5 bg-background/50 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              continuity >= 70 ? "bg-status-live" :
              continuity >= 40 ? "bg-yellow-500" : "bg-status-over"
            )}
            style={{ width: `${Math.min(100, continuity)}%` }}
          />
        </div>
      )}
    </div>
  );
}
