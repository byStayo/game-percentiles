import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  Calendar, 
  Trophy, 
  LayoutDashboard, 
  Target,
  MoreHorizontal,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

const mainNavItems = [
  { href: "/", label: "Today", icon: Calendar },
  { href: "/best-bets", label: "Best Bets", icon: Trophy },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/parlay", label: "Parlay", icon: Target },
];

const moreNavItems = [
  { href: "/week", label: "Week Ahead" },
  { href: "/standings", label: "Standings" },
  { href: "/playoffs", label: "Playoffs" },
  { href: "/teams", label: "All Teams" },
  { href: "/compare", label: "Compare Teams" },
  { href: "/rankings", label: "Power Rankings" },
  { href: "/streaks", label: "Streaks" },
  { href: "/analysis", label: "Matchup Analysis" },
  { href: "/accuracy", label: "Accuracy Tracking" },
  { href: "/matchups", label: "Matchup Finder" },
  { href: "/rivalries", label: "Rivalries" },
  { href: "/ou-trends", label: "O/U Trends" },
  { href: "/league-stats", label: "League Stats" },
  { href: "/simulator", label: "Bet Simulator" },
  { href: "/stats", label: "System Stats" },
  { href: "/franchises", label: "Franchises" },
  { href: "/status", label: "System Status" },
];

export function BottomNav() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  
  const isMoreActive = moreNavItems.some(item => location.pathname === item.href);

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
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon className={cn(
                  "h-6 w-6 transition-transform",
                  isActive && "scale-110"
                )} />
                <span className={cn(
                  "text-[10px] font-medium",
                  isActive && "font-semibold"
                )}>
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
                  isMoreActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <MoreHorizontal className={cn(
                  "h-6 w-6 transition-transform",
                  isMoreActive && "scale-110"
                )} />
                <span className={cn(
                  "text-[10px] font-medium",
                  isMoreActive && "font-semibold"
                )}>
                  More
                </span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
              <SheetHeader className="pb-4">
                <SheetTitle>More Pages</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-2 overflow-y-auto pb-safe">
                {moreNavItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center px-4 py-3.5 rounded-xl text-sm font-medium transition-all",
                        "active:scale-98 touch-manipulation",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/50 text-foreground hover:bg-muted"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}