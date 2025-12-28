import { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Calculator, 
  Plus,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

interface ParlayPick {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  pick: "over" | "under";
  line: number | null;
  percentile: number | null;
  addedAt: string;
}

export default function ParlayBuilder() {
  const [picks, setPicks] = useState<ParlayPick[]>([]);
  const [copied, setCopied] = useState(false);

  // Load picks from localStorage
  useEffect(() => {
    const loadPicks = () => {
      const stored = localStorage.getItem("parlayPicks");
      if (stored) {
        setPicks(JSON.parse(stored));
      }
    };
    
    loadPicks();
    
    // Listen for storage changes
    window.addEventListener("storage", loadPicks);
    return () => window.removeEventListener("storage", loadPicks);
  }, []);

  // Save picks to localStorage
  const savePicks = (newPicks: ParlayPick[]) => {
    localStorage.setItem("parlayPicks", JSON.stringify(newPicks));
    setPicks(newPicks);
  };

  // Remove a pick
  const removePick = (gameId: string) => {
    const newPicks = picks.filter(p => p.gameId !== gameId);
    savePicks(newPicks);
    toast.success("Pick removed");
  };

  // Clear all picks
  const clearAll = () => {
    savePicks([]);
    toast.success("All picks cleared");
  };

  // Calculate combined probability (simplified calculation)
  const parlayStats = useMemo(() => {
    if (picks.length === 0) return null;

    // For each pick, estimate probability based on percentile
    // A percentile of 10 for an under = high probability (around 90%)
    // A percentile of 90 for an over = high probability (around 90%)
    const probabilities = picks.map(pick => {
      if (pick.percentile === null) return 0.5;
      
      if (pick.pick === "under") {
        // For unders: lower percentile = higher probability of hitting
        return Math.min(0.95, Math.max(0.05, (100 - pick.percentile) / 100));
      } else {
        // For overs: higher percentile = higher probability of hitting
        return Math.min(0.95, Math.max(0.05, pick.percentile / 100));
      }
    });

    const combinedProb = probabilities.reduce((acc, p) => acc * p, 1);
    
    // Convert probability to American odds
    const toAmericanOdds = (prob: number): string => {
      if (prob >= 0.5) {
        const odds = -100 * prob / (1 - prob);
        return Math.round(odds).toString();
      } else {
        const odds = 100 * (1 - prob) / prob;
        return `+${Math.round(odds)}`;
      }
    };

    // Calculate potential payout for $10 bet
    const impliedOdds = 1 / combinedProb;
    const potentialPayout = 10 * impliedOdds;

    return {
      numLegs: picks.length,
      combinedProbability: combinedProb * 100,
      americanOdds: toAmericanOdds(combinedProb),
      potentialPayout: potentialPayout.toFixed(2),
      individualProbs: probabilities.map(p => (p * 100).toFixed(0)),
    };
  }, [picks]);

  // Copy parlay to clipboard
  const copyToClipboard = async () => {
    const text = picks.map(p => 
      `${p.awayTeam} @ ${p.homeTeam}: ${p.pick.toUpperCase()} ${p.line}`
    ).join("\n");
    
    const summary = `\n---\n${picks.length}-Leg Parlay | Est. ${parlayStats?.combinedProbability.toFixed(1)}% | Odds: ${parlayStats?.americanOdds}`;
    
    await navigator.clipboard.writeText(text + summary);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Layout>
      <Helmet>
        <title>Parlay Builder | Game Percentiles</title>
        <meta
          name="description"
          content="Build your parlay with saved picks and calculate combined odds based on historical percentiles."
        />
      </Helmet>

      <PageTransition>
        <div className="container mx-auto py-6 px-4 space-y-6 max-w-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Parlay Builder</h1>
              <p className="text-muted-foreground">
                {picks.length} pick{picks.length !== 1 ? "s" : ""} saved
              </p>
            </div>
            {picks.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={clearAll}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            )}
          </div>

          {/* Summary Card */}
          {parlayStats && picks.length > 0 && (
            <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Parlay Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{parlayStats.numLegs}</div>
                    <div className="text-xs text-muted-foreground">Legs</div>
                  </div>
                  <div className="text-center">
                    <div className={cn(
                      "text-3xl font-bold tabular-nums",
                      parlayStats.combinedProbability > 30 ? "text-status-under" : 
                      parlayStats.combinedProbability > 15 ? "text-status-over" : 
                      "text-destructive"
                    )}>
                      {parlayStats.combinedProbability.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Est. Prob</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold tabular-nums">
                      {parlayStats.americanOdds}
                    </div>
                    <div className="text-xs text-muted-foreground">Odds</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">$10 bet potential payout:</span>
                    <span className="font-bold text-lg">${parlayStats.potentialPayout}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={copyToClipboard}
                    variant="outline"
                    className="flex-1"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Parlay
                      </>
                    )}
                  </Button>
                </div>

                {parlayStats.combinedProbability < 10 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>Low probability parlay. Consider reducing legs for better odds.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Picks List */}
          {picks.length > 0 ? (
            <div className="space-y-3">
              {picks.map((pick, index) => (
                <Card 
                  key={pick.gameId}
                  className="group overflow-hidden"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground font-medium">
                            #{index + 1}
                          </span>
                          <Badge 
                            variant="outline"
                            className={cn(
                              "text-xs",
                              pick.pick === "over" 
                                ? "border-status-over/50 text-status-over bg-status-over/10" 
                                : "border-status-under/50 text-status-under bg-status-under/10"
                            )}
                          >
                            {pick.pick === "over" ? (
                              <TrendingUp className="h-3 w-3 mr-1" />
                            ) : (
                              <TrendingDown className="h-3 w-3 mr-1" />
                            )}
                            {pick.pick.toUpperCase()} {pick.line}
                          </Badge>
                          {pick.percentile !== null && (
                            <span className={cn(
                              "text-xs font-medium",
                              pick.percentile < 30 || pick.percentile > 70 
                                ? "text-status-edge" 
                                : "text-muted-foreground"
                            )}>
                              P{pick.percentile}
                            </span>
                          )}
                        </div>
                        <div className="font-medium truncate">
                          {pick.awayTeam} @ {pick.homeTeam}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Added {format(new Date(pick.addedAt), "MMM d, h:mm a")}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link to={`/game/${pick.gameId}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removePick(pick.gameId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Probability indicator */}
                    {parlayStats && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Leg probability</span>
                          <span className="font-medium tabular-nums">
                            {parlayStats.individualProbs[index]}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all",
                              Number(parlayStats.individualProbs[index]) > 60 
                                ? "bg-status-under" 
                                : Number(parlayStats.individualProbs[index]) > 40 
                                  ? "bg-primary" 
                                  : "bg-status-over"
                            )}
                            style={{ width: `${parlayStats.individualProbs[index]}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-gradient-to-br from-muted/50 to-muted/20">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No picks yet</h3>
                <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                  Add picks from game detail pages using the floating action button, 
                  or browse today's best bets.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild>
                    <Link to="/">
                      <Plus className="h-4 w-4 mr-2" />
                      Browse Today's Games
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/best-bets">
                      Best Bets
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tips */}
          {picks.length > 0 && picks.length < 3 && (
            <Card className="bg-muted/30">
              <CardContent className="py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  💡 Tip: Add more legs from game pages or check{" "}
                  <Link to="/best-bets" className="text-primary hover:underline">
                    Best Bets
                  </Link>{" "}
                  for top edge picks.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </PageTransition>
    </Layout>
  );
}
