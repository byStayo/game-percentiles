import { Calendar, TrendingUp, Search, Zap, Trophy, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: "calendar" | "trending" | "search" | "zap" | "trophy" | "target";
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const icons = {
  calendar: Calendar,
  trending: TrendingUp,
  search: Search,
  zap: Zap,
  trophy: Trophy,
  target: Target,
};

const iconColors = {
  calendar: "bg-muted text-muted-foreground",
  trending: "bg-status-over/10 text-status-over",
  search: "bg-primary/10 text-primary",
  zap: "bg-status-edge/10 text-status-edge",
  trophy: "bg-yellow-500/10 text-yellow-600",
  target: "bg-status-under/10 text-status-under",
};

export function EmptyState({ 
  title, 
  description, 
  icon = "calendar",
  action,
  className 
}: EmptyStateProps) {
  const Icon = icons[icon];
  const colorClass = iconColors[icon];

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in",
      className
    )}>
      <div className={cn("mb-4 rounded-2xl p-4", colorClass)}>
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">{description}</p>
      {action && (
        <Button 
          variant="outline" 
          onClick={action.onClick}
          className="mt-6"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
