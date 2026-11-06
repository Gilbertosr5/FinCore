import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useThemeStore, type ThemePreference } from '@/stores/theme.store';

const OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

function isThemePreference(value: string): value is ThemePreference {
  return OPTIONS.some((option) => option.value === value);
}

export function AppearanceSettings() {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);

  return (
    <RadioGroup
      aria-label="Tema"
      value={preference}
      onValueChange={(value) => {
        if (isThemePreference(value)) setPreference(value);
      }}
      className="grid-cols-1 sm:grid-cols-3"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <Label
          key={value}
          htmlFor={`theme-${value}`}
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-4 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
        >
          <RadioGroupItem id={`theme-${value}`} value={value} />
          <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
          {label}
        </Label>
      ))}
    </RadioGroup>
  );
}
