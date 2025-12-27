import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Clock } from "lucide-react";

export type SegmentKey = 
  | "h2h_1y" 
  | "h2h_3y" 
  | "h2h_5y" 
  | "h2h_10y" 
  | "h2h_20y" 
  | "h2h_all"
  | "decade_2020s"
  | "decade_2010s"
  | "decade_2000s"
  | "decade_1990s";

interface SegmentSelectorProps {
  value: SegmentKey;
  onChange: (value: SegmentKey) => void;
  disabled?: boolean;
}

const timeWindowSegments: { key: SegmentKey; label: string }[] = [
  { key: "h2h_1y", label: "Last 1 Year" },
  { key: "h2h_3y", label: "Last 3 Years" },
  { key: "h2h_5y", label: "Last 5 Years" },
  { key: "h2h_10y", label: "Last 10 Years" },
  { key: "h2h_20y", label: "Last 20 Years" },
  { key: "h2h_all", label: "All-Time" },
];

const decadeSegments: { key: SegmentKey; label: string }[] = [
  { key: "decade_2020s", label: "2020s" },
  { key: "decade_2010s", label: "2010s" },
  { key: "decade_2000s", label: "2000s" },
  { key: "decade_1990s", label: "1990s" },
];

const allSegmentLabels: Record<SegmentKey, string> = {
  h2h_1y: "Last 1 Year",
  h2h_3y: "Last 3 Years",
  h2h_5y: "Last 5 Years",
  h2h_10y: "Last 10 Years",
  h2h_20y: "Last 20 Years",
  h2h_all: "All-Time",
  decade_2020s: "2020s",
  decade_2010s: "2010s",
  decade_2000s: "2000s",
  decade_1990s: "1990s",
};

export function SegmentSelector({ value, onChange, disabled }: SegmentSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Clock className="h-4 w-4 text-muted-foreground" />
      <Select value={value} onValueChange={(v) => onChange(v as SegmentKey)} disabled={disabled}>
        <SelectTrigger className="w-[150px] h-8 text-xs bg-card">
          <SelectValue placeholder="Time Window">
            {allSegmentLabels[value]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-popover border border-border z-50">
          <SelectGroup>
            <SelectLabel className="text-2xs text-muted-foreground">Recent (Most Relevant)</SelectLabel>
            {timeWindowSegments.slice(0, 3).map(({ key, label }) => (
              <SelectItem key={key} value={key} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel className="text-2xs text-muted-foreground">Extended History</SelectLabel>
            {timeWindowSegments.slice(3).map(({ key, label }) => (
              <SelectItem key={key} value={key} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel className="text-2xs text-muted-foreground">By Decade</SelectLabel>
            {decadeSegments.map(({ key, label }) => (
              <SelectItem key={key} value={key} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
