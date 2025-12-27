import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock } from "lucide-react";

export type SegmentKey = "h2h_3y" | "h2h_5y" | "h2h_10y" | "h2h_20y" | "h2h_all";

interface SegmentSelectorProps {
  value: SegmentKey;
  onChange: (value: SegmentKey) => void;
  disabled?: boolean;
}

const segmentLabels: Record<SegmentKey, string> = {
  h2h_3y: "Last 3 Years",
  h2h_5y: "Last 5 Years",
  h2h_10y: "Last 10 Years",
  h2h_20y: "Last 20 Years",
  h2h_all: "All-Time",
};

export function SegmentSelector({ value, onChange, disabled }: SegmentSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Clock className="h-4 w-4 text-muted-foreground" />
      <Select value={value} onValueChange={(v) => onChange(v as SegmentKey)} disabled={disabled}>
        <SelectTrigger className="w-[140px] h-8 text-xs bg-card">
          <SelectValue placeholder="Time Window" />
        </SelectTrigger>
        <SelectContent className="bg-popover border border-border z-50">
          {Object.entries(segmentLabels).map(([key, label]) => (
            <SelectItem key={key} value={key} className="text-xs">
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
