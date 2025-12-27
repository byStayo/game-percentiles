import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Trophy,
  LayoutDashboard,
  Target,
  MoreHorizontal,
  CalendarDays,
  Medal,
  Flag,
  Users,
  GitCompare,
  TrendingUp,
  Flame,
  BarChart3,
  Crosshair,
  Search,
  Swords,
  LineChart,
  PieChart,
  Dices,
  Activity,
  Building2,
  Server,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useState } from "react";

const mainNavItems = [
  { href: "/", label: "Today", icon: Calendar },
  { href: "/best-bets", label: "Best Bets", icon: Trophy },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/parlay", label: "Parlay", icon: Target },
];

const moreNavGroups = [
  {
    label: "Schedule",
    items: [
      { href: "/week", label: "Week Ahead", icon: CalendarDays },
    ],
  },
  {
    label: "Teams",
    items: [
      { href: "/standings", label: "Standings", icon: Medal },
      { href: "/playoffs", label: "Playoffs", icon: Flag },
      { href: "/teams", label: "All Teams", icon: Users },
      { href: "/compare", label: "Compare", icon: GitCompare },
      { href: "/rankings", label: "Power Rankings", icon: TrendingUp },
      { href: "/streaks", label: "Streaks", icon: Flame },
    ],
  },
  {
    label: "Analysis",
    items: [
      { href: "/analysis", label: "Matchup Analysis", icon: BarChart3 },
      { href: "/accuracy", label: "Accuracy", icon: Crosshair },
      { href: "/matchups", label: "Matchup Finder", icon: Search },
      { href: "/rivalries", label: "Rivalries", icon: Swords },
      { href: "/ou-trends", label: "O/U Trends", icon: LineChart },
      { href: "/league-stats", label: "League Stats", icon: PieChart },
      { href: "/simulator", label: "Bet Simulator", icon: Dices },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/stats", label: "System Stats", icon: Activity },
      { href: "/franchises", label: "Franchises", icon: Building2 },
      { href: "/status", label: "System Status", icon: Server },
    ],
  },
];

// Flatten for checking active state
const allMoreItems = moreNavGroups.flatMap(g => g.items);

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const isMoreActive = allMoreItems.some((item) => location.pathname === item.href);

  const goTo = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Safe area background for notched devices */}
      <div className="bg-background/95 backdrop-blur-xl border-t border-border/60 pb-safe">
        <div className="flex items-center justify-around h-16 px-2">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[64px]",
                  "active:scale-95 touch-manipulation",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-6 w-6 transition-transform", isActive && "scale-110")} />
                <span className={cn("text-[10px] font-medium", isActive && "font-semibold")}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* More button */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[64px]",
                  "active:scale-95 touch-manipulation",
                  isMoreActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <MoreHorizontal className={cn("h-6 w-6 transition-transform", isMoreActive && "scale-110")} />
                <span className={cn("text-[10px] font-medium", isMoreActive && "font-semibold")}>
                  More
                </span>
              </button>
            </SheetTrigger>

            <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl px-0">
              <SheetHeader className="px-4 pb-2">
                <SheetTitle>All Pages</SheetTitle>
              </SheetHeader>

              <div className="px-4 pb-safe">
                <Command className="h-[calc(85vh-4rem)] rounded-2xl border border-border/60">
                  <CommandInput placeholder="Search pages…" />

                  <CommandList className="max-h-[calc(85vh-8rem)]">
                    <CommandEmpty>No pages found.</CommandEmpty>

                    {moreNavGroups.map((group, groupIndex) => (
                      <div key={group.label}>
                        <CommandGroup heading={group.label}>
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.href;

                            return (
                              <CommandItem
                                key={item.href}
                                value={`${group.label} ${item.label}`}
                                onSelect={() => goTo(item.href)}
                                className={cn(
                                  "py-3",
                                  isActive && "bg-accent text-accent-foreground",
                                )}
                              >
                                <Icon className="mr-2 h-4 w-4" />
                                <span className="flex-1">{item.label}</span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>

                        {groupIndex < moreNavGroups.length - 1 && <CommandSeparator />}
                      </div>
                    ))}
                  </CommandList>
                </Command>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
