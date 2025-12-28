import { useState } from "react";
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
  Menu,
  X,
  LayoutDashboard,
  Building2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOptimizerPicksCount } from "@/hooks/useOptimizerPicksCount";
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
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/", label: "Today", icon: Calendar },
  { href: "/week", label: "Week", icon: Calendar },
  { href: "/best-bets", label: "Best Bets", icon: Trophy },
  { href: "/parlay", label: "Parlay", icon: Target },
  { href: "/parlay-optimizer", label: "Optimizer", icon: Zap },
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
    { href: "/analysis", label: "Matchup Analysis", icon: Target },
    { href: "/accuracy", label: "Accuracy Tracking", icon: Target },
    { href: "/matchups", label: "Matchup Finder", icon: Target },
    { href: "/rivalries", label: "Rivalries", icon: Flame },
    { href: "/ou-trends", label: "O/U Trends", icon: TrendingDown },
    { href: "/league-stats", label: "League Stats", icon: LineChart },
    { href: "/simulator", label: "Bet Simulator", icon: DollarSign },
    { href: "/stats", label: "System Stats", icon: BarChart3 },
    { href: "/franchises", label: "Franchises", icon: Building2 },
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
      <DropdownMenuContent align="end" className="w-52 bg-popover">
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

function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const allNavItems = [
    ...coreNav,
    { href: "", label: "Teams", isHeader: true },
    ...teamsGroup.items,
    { href: "", label: "Analytics", isHeader: true },
    ...analyticsGroup.items,
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 bg-background">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            Game Percentiles
          </SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-1">
          {allNavItems.map((item, idx) => {
            if ('isHeader' in item && item.isHeader) {
              return (
                <div key={idx} className="px-3 py-2 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {item.label}
                </div>
              );
            }
            const Icon = (item as NavItem).icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function Header() {
  const location = useLocation();
  const isTeamsActive = teamsGroup.items.some(item => location.pathname === item.href);
  const isAnalyticsActive = analyticsGroup.items.some(item => location.pathname === item.href);
  const optimizerCount = useOptimizerPicksCount();

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-12 sm:h-14 md:h-16 items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 transition-transform duration-300 group-hover:scale-105">
            <Percent className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-primary-foreground" />
          </div>
          <span className="text-sm sm:text-base md:text-lg font-semibold tracking-tight">
            Percentiles
          </span>
        </Link>

        {/* Desktop Navigation - hidden on mobile, BottomNav handles mobile */}
        <nav className="hidden md:flex items-center gap-1 p-1 rounded-full bg-secondary/50">
          {coreNav.slice(0, 5).map((item) => {
            const isOptimizer = item.href === "/parlay-optimizer";
            const showBadge = isOptimizer && optimizerCount > 0;
            
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "relative px-4 py-2 text-sm font-medium rounded-full transition-all duration-200",
                  location.pathname === item.href
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {item.label}
                {showBadge && (
                  <Badge 
                    className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-status-edge text-white border-0"
                  >
                    {optimizerCount}
                  </Badge>
                )}
              </Link>
            );
          })}
          
          <NavDropdown group={teamsGroup} isActive={isTeamsActive} />
          <NavDropdown group={analyticsGroup} isActive={isAnalyticsActive} />
        </nav>

        {/* Mobile: Empty space - BottomNav handles all mobile navigation */}
        <div className="md:hidden" />
      </div>
    </header>
  );
}
