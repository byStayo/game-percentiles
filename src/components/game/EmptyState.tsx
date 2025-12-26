import { Calendar, TrendingUp } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: "calendar" | "trending";
}

export function EmptyState({ title, description, icon = "calendar" }: EmptyStateProps) {
  const Icon = icon === "calendar" ? Calendar : TrendingUp;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="mb-4 rounded-full bg-secondary p-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
