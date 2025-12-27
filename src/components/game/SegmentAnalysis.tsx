import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  useMatchupSegments, 
  SegmentStats, 
  getConfidenceColor, 
  getDataQualityColor,
  getDataQualityVariant 
} from "@/hooks/useMatchupSegments";
import { 
  Target, 
  TrendingUp, 
  Clock, 
  Star, 
  AlertTriangle,
  CheckCircle2,
  Info
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PercentileBar } from "@/components/ui/percentile-bar";

interface SegmentAnalysisProps {
  sportId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeFranchiseId?: string | null;
  awayFranchiseId?: string | null;
  homeRosterContinuity?: number | null;
  awayRosterContinuity?: number | null;
  dkLine?: number | null;
  onSegmentSelect?: (segmentKey: string) => void;
  selectedSegment?: string;
}

export function SegmentAnalysis({
  sportId,
  homeTeamId,
  awayTeamId,
  homeFranchiseId,
  awayFranchiseId,
  homeRosterContinuity,
  awayRosterContinuity,
  dkLine,
  onSegmentSelect,
  selectedSegment,
}: SegmentAnalysisProps) {
  const { data, isLoading, error } = useMatchupSegments({
    sportId,
    homeTeamId,
    awayTeamId,
    homeFranchiseId,
    awayFranchiseId,
    homeRosterContinuity,
    awayRosterContinuity,
  });

  if (isLoading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Segment Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Unable to load segment data
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const { segments, recommended_segment, recommendation_reason, total_historical_games, data_quality } = data;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Segment Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={getDataQualityVariant(data_quality)} className="text-xs">
              {data_quality.charAt(0).toUpperCase() + data_quality.slice(1)} Data
            </Badge>
            <span className="text-xs text-muted-foreground">
              {total_historical_games} total games
            </span>
          </div>
        </div>
        
        {/* Recommendation */}
        <div className="mt-2 p-2 bg-primary/5 rounded-md border border-primary/20">
          <div className="flex items-center gap-2 text-xs">
            <Star className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium text-primary">Recommended:</span>
            <span className="text-foreground">{recommendation_reason}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {segments.map((segment) => (
          <SegmentRow
            key={segment.segment_key}
            segment={segment}
            dkLine={dkLine}
            isSelected={selectedSegment === segment.segment_key}
            isRecommended={segment.is_recommended}
            onSelect={() => onSegmentSelect?.(segment.segment_key)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface SegmentRowProps {
  segment: SegmentStats;
  dkLine?: number | null;
  isSelected: boolean;
  isRecommended: boolean;
  onSelect?: () => void;
}

function SegmentRow({ segment, dkLine, isSelected, isRecommended, onSelect }: SegmentRowProps) {
  const hasData = segment.n_games > 0;
  const confidenceColor = getConfidenceColor(segment.confidence);

  return (
    <TooltipProvider>
      <div
        onClick={hasData ? onSelect : undefined}
        className={`
          p-3 rounded-lg border transition-all
          ${hasData ? 'cursor-pointer hover:bg-accent/50' : 'opacity-50 cursor-not-allowed'}
          ${isSelected ? 'border-primary bg-primary/5' : 'border-border/50 bg-card/30'}
          ${isRecommended && !isSelected ? 'border-primary/40' : ''}
        `}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{segment.label}</span>
            {isRecommended && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                <Star className="h-2.5 w-2.5 mr-0.5" />
                Best
              </Badge>
            )}
            {isSelected && (
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`text-xs font-medium cursor-help ${confidenceColor}`}>
                  {segment.confidence}%
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{segment.confidence_label} confidence</p>
              </TooltipContent>
            </Tooltip>
            
            <span className="text-xs text-muted-foreground">
              {segment.n_games} games
            </span>
          </div>
        </div>

        {hasData ? (
          <>
            <div className="flex items-center justify-between text-xs mb-2">
              <div className="flex items-center gap-4">
                <span className="text-status-under font-mono">
                  P05: {segment.p05.toFixed(1)}
                </span>
                <span className="text-muted-foreground font-mono">
                  Med: {segment.median.toFixed(1)}
                </span>
                <span className="text-status-over font-mono">
                  P95: {segment.p95.toFixed(1)}
                </span>
              </div>
              <span className="text-muted-foreground">
                Range: {segment.range.toFixed(1)}
              </span>
            </div>

            {dkLine && (
              <PercentileBar
                p05={segment.p05}
                p95={segment.p95}
                dkLine={dkLine}
                className="h-2"
              />
            )}

            {/* Year breakdown tooltip */}
            {segment.games_breakdown?.by_year && Object.keys(segment.games_breakdown.by_year).length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 mt-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {Object.entries(segment.games_breakdown.by_year)
                        .sort(([a], [b]) => Number(b) - Number(a))
                        .slice(0, 3)
                        .map(([year, count]) => `${year}: ${count}`)
                        .join(' • ')}
                      {Object.keys(segment.games_breakdown.by_year).length > 3 && ' ...'}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs font-medium mb-1">Games by Year</p>
                  <div className="space-y-0.5">
                    {Object.entries(segment.games_breakdown.by_year)
                      .sort(([a], [b]) => Number(b) - Number(a))
                      .map(([year, count]) => (
                        <div key={year} className="flex justify-between gap-4 text-xs">
                          <span>{year}</span>
                          <span className="font-mono">{count as number}</span>
                        </div>
                      ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            No games in this time window
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
