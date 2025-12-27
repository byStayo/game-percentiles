import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TrendingUp, ChevronDown, BarChart3, Flame, Trophy, TrendingDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/", label: "Today" },
  { href: "/week", label: "Week" },
  { href: "/parlay", label: "Parlay" },
  { href: "/standings", label: "Standings" },
  { href: "/playoffs", label: "Playoffs" },
  { href: "/teams", label: "Teams" },
  { href: "/compare", label: "Compare" },
];

const analyticsItems = [
  { href: "/matchups", label: "Matchup Finder", icon: BarChart3 },
  { href: "/rankings", label: "Power Rankings", icon: Trophy },
  { href: "/rivalries", label: "Rivalries", icon: Flame },
  { href: "/ou-trends", label: "O/U Trends", icon: TrendingDown },
  { href: "/league-stats", label: "League Stats", icon: TrendingUp },
  { href: "/stats", label: "System Stats", icon: BarChart3 },
];

export function Header() {
  const location = useLocation();
  const isAnalyticsActive = analyticsItems.some(item => location.pathname === item.href);

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/50">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground transition-transform duration-300 group-hover:scale-105">
            <TrendingUp className="h-4.5 w-4.5 text-background" />
          </div>
          <div className="hidden sm:block">
            <span className="text-lg font-semibold tracking-tight">
              Percentile Totals
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1 p-1 rounded-full bg-secondary/50">
          {navItems.map((item) => (
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
          
          {/* Analytics Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 flex items-center gap-1",
                  isAnalyticsActive
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                Analytics
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {analyticsItems.map((item) => {
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
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </header>
  );
}