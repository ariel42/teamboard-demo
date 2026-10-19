import type { CSSProperties } from 'react';
import { cx } from '../../lib/cx';
import { labelHue } from '../../lib/colors';
import './Label.css';

export interface LabelProps {
  name: string;
  /** Override the hue (0-360); by default it is derived from the name so a label keeps its color. */
  hue?: number;
  className?: string;
}

export function Label({ name, hue, className }: LabelProps) {
  const style = { '--label-hue': hue ?? labelHue(name) } as CSSProperties;
  return (
    <span className={cx('tb-label', className)} style={style}>
      {name}
    </span>
  );
}
