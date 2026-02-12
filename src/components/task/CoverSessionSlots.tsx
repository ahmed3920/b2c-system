import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";

const SESSION_SLOTS = [
  { time: "15:00", label: "3:00 PM" },
  { time: "16:30", label: "4:30 PM" },
  { time: "18:00", label: "6:00 PM" },
  { time: "19:30", label: "7:30 PM" },
  { time: "21:00", label: "9:00 PM" },
];

interface CoverSessionSlotsProps {
  selectedSlots: string[];
  onSlotsChange: (slots: string[]) => void;
}

export function CoverSessionSlots({ selectedSlots, onSlotsChange }: CoverSessionSlotsProps) {
  const toggleSlot = (time: string) => {
    if (selectedSlots.includes(time)) {
      onSlotsChange(selectedSlots.filter((s) => s !== time));
    } else {
      onSlotsChange([...selectedSlots, time]);
    }
  };

  const totalHours = selectedSlots.length;

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-secondary/30">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Session Slots</Label>
        {totalHours > 0 && (
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
            {totalHours} {totalHours === 1 ? "hour" : "hours"} total
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Select the sessions you covered (1 hour each)</p>
      <div className="grid grid-cols-2 gap-2">
        {SESSION_SLOTS.map((slot) => (
          <label
            key={slot.time}
            className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-secondary/50 transition-colors"
          >
            <Checkbox
              checked={selectedSlots.includes(slot.time)}
              onCheckedChange={() => toggleSlot(slot.time)}
            />
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-sm">{slot.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export { SESSION_SLOTS };
