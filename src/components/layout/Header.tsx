import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";

const navItems = [
  { href: "/", label: "Today" },
  { href: "/status", label: "Status" },
];

export function Header() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
            <Activity className="h-4 w-4 text-background" />
          </div>
          <span className="text-base font-semibold tracking-tight hidden sm:inline">
            Percentile Totals
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-full transition-colors",
                location.pathname === item.href
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
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
