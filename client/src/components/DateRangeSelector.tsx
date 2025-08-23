import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";

export interface DateRange {
  from: Date;
  to: Date;
  preset?: string;
}

interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (dateRange: DateRange) => void;
  className?: string;
}

const presetRanges = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "14d", label: "Last 14 days", days: 14 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
];

export default function DateRangeSelector({ value, onChange, className }: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempRange, setTempRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: value.from,
    to: value.to,
  });

  const handlePresetSelect = (preset: string) => {
    const days = presetRanges.find(r => r.value === preset)?.days || 7;
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    
    const newRange = { from, to, preset };
    onChange(newRange);
  };

  const handleCustomRangeApply = () => {
    if (tempRange.from && tempRange.to) {
      onChange({
        from: tempRange.from,
        to: tempRange.to,
        preset: "custom"
      });
      setIsOpen(false);
    }
  };

  const handleCustomRangeReset = () => {
    setTempRange({ from: value.from, to: value.to });
  };

  const getDisplayText = () => {
    if (value.preset && value.preset !== "custom") {
      return presetRanges.find(r => r.value === value.preset)?.label || "Last 7 days";
    }
    return `${format(value.from, "MMM dd")} - ${format(value.to, "MMM dd")}`;
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Calendar className="h-4 w-4 text-gray-500" />
      <Select value={value.preset || "custom"} onValueChange={handlePresetSelect}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          {presetRanges.map((range) => (
            <SelectItem key={range.value} value={range.value}>
              {range.label}
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>

      {(value.preset === "custom" || !value.preset) && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[240px] justify-start">
              <Calendar className="mr-2 h-4 w-4" />
              {getDisplayText()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">From</label>
                  <CalendarComponent
                    mode="single"
                    selected={tempRange.from}
                    onSelect={(date) => setTempRange(prev => ({ ...prev, from: date }))}
                    disabled={(date) => date > new Date() || date < new Date("2020-01-01")}
                    initialFocus
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">To</label>
                  <CalendarComponent
                    mode="single"
                    selected={tempRange.to}
                    onSelect={(date) => setTempRange(prev => ({ ...prev, to: date }))}
                    disabled={(date) => date > new Date() || date < new Date("2020-01-01")}
                  />
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={handleCustomRangeReset}>
                    Reset
                  </Button>
                  <Button onClick={handleCustomRangeApply}>
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}