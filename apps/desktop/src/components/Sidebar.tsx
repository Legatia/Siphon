import { cn } from "@/lib/utils";
import { Sprout, Factory, Swords, Settings } from "lucide-react";

export type Zone = "farm" | "factory" | "arena" | "settings";

interface SidebarProps {
  active: Zone;
  onNavigate: (zone: Zone) => void;
}

const navItems: { zone: Zone; label: string; icon: typeof Sprout }[] = [
  { zone: "farm", label: "The Drift", icon: Sprout },
  { zone: "factory", label: "Workspace", icon: Factory },
  { zone: "arena", label: "Arena", icon: Swords },
  { zone: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside className="w-16 bg-midnight/80 border-r border-siphon-teal/10 flex flex-col items-center py-6 gap-2">
      <div className="mb-6">
        <div className="w-8 h-8 rounded-lg bg-siphon-teal/20 flex items-center justify-center">
          <span className="text-siphon-teal font-bold text-sm">S</span>
        </div>
      </div>

      {navItems.map(({ zone, label, icon: Icon }) => (
        <button
          key={zone}
          onClick={() => onNavigate(zone)}
          title={label}
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
            active === zone
              ? "bg-siphon-teal/20 text-siphon-teal"
              : "text-ghost hover:text-foam hover:bg-foam/5"
          )}
        >
          <Icon size={20} />
        </button>
      ))}
    </aside>
  );
}
