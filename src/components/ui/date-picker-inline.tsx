import { format, addDays, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DatePickerInlineProps {
  date: Date;
  onDateChange: (date: Date) => void;
  className?: string;
}

export function DatePickerInline({ date, onDateChange, className }: DatePickerInlineProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const selectedDate = new Date(date);
  selectedDate.setHours(0, 0, 0, 0);
  
  const isToday = selectedDate.getTime() === today.getTime();

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full"
        onClick={() => onDateChange(subDays(date, 1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-base font-medium min-w-[140px] sm:min-w-[180px]">
          {format(date, 'EEE, MMM d')}
        </span>
        {isToday && (
          <span className="text-2xs px-2 py-0.5 bg-foreground text-background rounded-full font-medium">
            Today
          </span>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full"
        onClick={() => onDateChange(addDays(date, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!isToday && (
        <Button
          variant="outline"
          size="sm"
          className="ml-2 text-xs h-8 rounded-full"
          onClick={() => onDateChange(today)}
        >
          Today
        </Button>
      )}
    </div>
  );
}
