import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  TrendingUp, 
  ChevronDown, 
  BarChart3, 
  Flame, 
  Trophy, 
  TrendingDown,
  Calendar,
  Users,
  Percent,
  Zap,
  Target,
  LineChart,
  Swords,
  Activity,
  DollarSign,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon?: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const coreNav: NavItem[] = [
  { href: "/", label: "Today" },
  { href: "/week", label: "Week" },
  { href: "/parlay", label: "Parlay" },
];

const teamsGroup: NavGroup = {
  label: "Teams",
  items: [
    { href: "/standings", label: "Standings", icon: Trophy },
    { href: "/playoffs", label: "Playoffs", icon: Trophy },
    { href: "/teams", label: "All Teams", icon: Users },
    { href: "/compare", label: "Compare Teams", icon: Swords },
    { href: "/rankings", label: "Power Rankings", icon: Zap },
    { href: "/streaks", label: "Streaks", icon: Activity },
  ],
};

const analyticsGroup: NavGroup = {
  label: "Analytics",
  items: [
    { href: "/matchups", label: "Matchup Finder", icon: Target },
    { href: "/rivalries", label: "Rivalries", icon: Flame },
    { href: "/ou-trends", label: "O/U Trends", icon: TrendingDown },
    { href: "/league-stats", label: "League Stats", icon: LineChart },
    { href: "/simulator", label: "Bet Simulator", icon: DollarSign },
    { href: "/stats", label: "System Stats", icon: BarChart3 },
  ],
};

function NavDropdown({ group, isActive }: { group: NavGroup; isActive: boolean }) {
  const location = useLocation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 flex items-center gap-1",
            isActive
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          {group.label}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {group.items.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link
                to={item.href}
                className={cn(
                  "flex items-center gap-2 cursor-pointer",
                  location.pathname === item.href && "bg-muted"
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const location = useLocation();
  const isTeamsActive = teamsGroup.items.some(item => location.pathname === item.href);
  const isAnalyticsActive = analyticsGroup.items.some(item => location.pathname === item.href);

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/50">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 transition-transform duration-300 group-hover:scale-105">
            <Percent className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="hidden sm:block">
            <span className="text-lg font-semibold tracking-tight">
              Game Percentiles
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1 p-1 rounded-full bg-secondary/50">
          {coreNav.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-full transition-all duration-200",
                location.pathname === item.href
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {item.label}
            </Link>
          ))}
          
          <NavDropdown group={teamsGroup} isActive={isTeamsActive} />
          <NavDropdown group={analyticsGroup} isActive={isAnalyticsActive} />
        </nav>
      </div>
    </header>
  );
}
