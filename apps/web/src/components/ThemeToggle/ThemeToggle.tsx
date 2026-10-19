import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import type { ThemePreference } from '../../lib/theme';
import './ThemeToggle.css';

const OPTIONS: { value: ThemePreference; label: string; Icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export interface ThemeToggleProps {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}

/** Three-way radio group (light / dark / system); arrow keys move between options natively. */
export function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  return (
    <fieldset className="tb-theme">
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map(({ value: option, label, Icon }) => (
        <label key={option} className="tb-theme__option" title={label}>
          <input
            className="tb-theme__input"
            type="radio"
            name="tb-theme"
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
          />
          <Icon size={16} aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </label>
      ))}
    </fieldset>
  );
}
