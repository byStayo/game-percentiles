import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import WeekAhead from "./pages/WeekAhead";
import GameDetail from "./pages/GameDetail";
import Status from "./pages/Status";
import Stats from "./pages/Stats";
import ParlayMachine from "./pages/ParlayMachine";
import TeamSeasons from "./pages/TeamSeasons";
import TeamDetail from "./pages/TeamDetail";
import TeamCompare from "./pages/TeamCompare";
import Standings from "./pages/Standings";
import PlayoffBracket from "./pages/PlayoffBracket";
import LeagueStats from "./pages/LeagueStats";
import MatchupFinder from "./pages/MatchupFinder";
import OverUnderTrends from "./pages/OverUnderTrends";
import Rivalries from "./pages/Rivalries";
import PowerRankings from "./pages/PowerRankings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/week" element={<WeekAhead />} />
            <Route path="/game/:id" element={<GameDetail />} />
            <Route path="/status" element={<Status />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/parlay" element={<ParlayMachine />} />
            <Route path="/teams" element={<TeamSeasons />} />
            <Route path="/team/:teamId" element={<TeamDetail />} />
            <Route path="/compare" element={<TeamCompare />} />
            <Route path="/standings" element={<Standings />} />
            <Route path="/playoffs" element={<PlayoffBracket />} />
            <Route path="/league-stats" element={<LeagueStats />} />
            <Route path="/matchups" element={<MatchupFinder />} />
            <Route path="/ou-trends" element={<OverUnderTrends />} />
            <Route path="/rivalries" element={<Rivalries />} />
            <Route path="/rankings" element={<PowerRankings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
