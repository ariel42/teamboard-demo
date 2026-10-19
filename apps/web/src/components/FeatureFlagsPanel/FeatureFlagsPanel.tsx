import { useEffect, useId, useRef, useState } from 'react';
import { Flag } from 'lucide-react';
import type { FlagItem } from '../../lib/flags';
import { Button } from '../Button/Button';
import './FeatureFlagsPanel.css';

export interface FeatureFlagsPanelProps {
  flags: FlagItem[];
  onToggle: (key: string, enabled: boolean) => void;
  /** Start with the popover open (stories, tests). */
  defaultOpen?: boolean;
}

/** "Flags" button that opens a popover with one switch per feature flag. */
export function FeatureFlagsPanel({
  flags,
  onToggle,
  defaultOpen = false,
}: FeatureFlagsPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="tb-flags" ref={rootRef}>
      <Button
        ref={triggerRef}
        variant="secondary"
        size="sm"
        className="tb-flags__trigger"
        icon={<Flag size={14} aria-hidden="true" />}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="tb-flags__trigger-text">Flags</span>
      </Button>
      {open && (
        <div className="tb-flags__panel" id={panelId} role="group" aria-label="Feature flags">
          <h2 className="tb-flags__title">Feature flags</h2>
          {flags.length === 0 && <p className="tb-flags__empty">No flags available.</p>}
          <ul className="tb-flags__list">
            {flags.map((flag) => (
              <li key={flag.key}>
                <label className="tb-switch">
                  <input
                    className="tb-switch__input"
                    type="checkbox"
                    role="switch"
                    checked={flag.enabled}
                    onChange={(e) => onToggle(flag.key, e.target.checked)}
                  />
                  <span className="tb-switch__track" aria-hidden="true" />
                  <span className="tb-switch__text">
                    <span className="tb-switch__label">{flag.label}</span>
                    {flag.description && (
                      <span className="tb-switch__hint">{flag.description}</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
