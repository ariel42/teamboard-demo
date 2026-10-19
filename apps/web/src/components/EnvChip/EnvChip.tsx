import type { CSSProperties } from 'react';
import { Server } from 'lucide-react';
import { labelHue } from '../../lib/colors';
import './EnvChip.css';

/** Known environment kinds get a fixed accent; any other kind gets a stable hash-based one. */
const KIND_HUES: Record<string, number> = {
  coder: 200,
  local: 155,
  e2e: 35,
  ci: 345,
  prod: 15,
};

export interface EnvChipProps {
  /** DEVENV_KIND, e.g. "coder" */
  kind: string;
  /** DEVENV_USER, e.g. "aba4000" */
  user: string;
}

export function EnvChip({ kind, user }: EnvChipProps) {
  const hue = KIND_HUES[kind.toLowerCase()] ?? labelHue(kind);
  return (
    <span
      className="tb-env"
      data-testid="env-chip"
      data-kind={kind}
      style={{ '--label-hue': hue } as CSSProperties}
      title={`Environment: ${kind}, user ${user}`}
    >
      <Server size={14} aria-hidden="true" />
      <span className="tb-env__text">
        {kind} &middot; {user}
      </span>
    </span>
  );
}
