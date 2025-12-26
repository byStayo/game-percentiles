import { format, addDays, subDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onDateChange(subDays(date, 1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold min-w-[160px] text-center">
          {format(date, 'EEEE, MMM d')}
        </span>
        {isToday && (
          <span className="text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded-full font-medium">
            Today
          </span>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onDateChange(addDays(date, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!isToday && (
        <Button
          variant="outline"
          size="sm"
          className="ml-2 text-xs"
          onClick={() => onDateChange(today)}
        >
          Go to Today
        </Button>
      )}
    </div>
  );
}
