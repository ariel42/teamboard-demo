import { cx } from '../../lib/cx';
import { initialsOf, readableTextColor } from '../../lib/colors';
import type { User } from '../../lib/types';
import './Avatar.css';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

export interface AvatarProps {
  name: string;
  /** Falls back to initials derived from `name`. */
  initials?: string;
  /** Background color, e.g. "#6366f1"; text color is chosen for contrast. */
  color?: string;
  size?: AvatarSize;
  /** Hide from assistive tech when the name is already shown next to the avatar. */
  decorative?: boolean;
  className?: string;
}

export function Avatar({
  name,
  initials,
  color = '#64748b',
  size = 'md',
  decorative = false,
  className,
}: AvatarProps) {
  return (
    <span
      className={cx('tb-avatar', `tb-avatar--${size}`, className)}
      style={{ backgroundColor: color, color: readableTextColor(color) }}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': name })}
      title={decorative ? undefined : name}
    >
      <span aria-hidden="true">{initials ?? initialsOf(name)}</span>
    </span>
  );
}

export interface AvatarGroupProps {
  users: Pick<User, 'name' | 'initials' | 'color'>[];
  /** Avatars shown before collapsing the rest into "+N". */
  max?: number;
  size?: AvatarSize;
}

export function AvatarGroup({ users, max = 3, size = 'sm' }: AvatarGroupProps) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <span className="tb-avatar-group" role="group" aria-label={`${users.length} people`}>
      {shown.map((user) => (
        <Avatar key={user.name} {...user} size={size} />
      ))}
      {extra > 0 && (
        <span className={cx('tb-avatar', 'tb-avatar--more', `tb-avatar--${size}`)}>+{extra}</span>
      )}
    </span>
  );
}
