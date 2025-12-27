import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

const navItems = [
  { href: "/", label: "Today" },
  { href: "/week", label: "Week" },
  { href: "/parlay", label: "Parlay" },
  { href: "/teams", label: "Teams" },
  { href: "/compare", label: "Compare" },
  { href: "/stats", label: "Stats" },
  { href: "/status", label: "Status" },
];

export function Header() {
  const location = useLocation();

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
        </nav>
      </div>
    </header>
  );
}