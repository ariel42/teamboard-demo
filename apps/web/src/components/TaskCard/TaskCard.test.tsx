import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TaskCard } from './TaskCard';

const base = {
  title: 'Ship it',
  priority: 'high' as const,
  labels: ['backend'],
  dueDate: '2030-01-01',
  commentCount: 4,
  assignee: { id: 1, name: 'Maya Chen', initials: 'MC', color: '#6366f1' },
};

describe('TaskCard', () => {
  it('shows title, labels, due date and comment count by default', () => {
    render(<TaskCard {...base} />);
    expect(screen.getByText('Ship it')).toBeInTheDocument();
    expect(screen.getByText('backend')).toBeInTheDocument();
    expect(screen.getByText('4 comments')).toBeInTheDocument();
    expect(document.querySelector('.tb-due')).not.toBeNull();
  });

  it('hides comments when the flag is off', () => {
    render(<TaskCard {...base} showComments={false} />);
    expect(screen.queryByText('4 comments')).not.toBeInTheDocument();
  });

  it('hides the due date when the flag is off', () => {
    const { container } = render(<TaskCard {...base} showDueDate={false} />);
    expect(container.querySelector('.tb-due')).toBeNull();
  });

  it('renders the compact variant without labels or footer', () => {
    const { container } = render(<TaskCard {...base} compact />);
    expect(container.firstElementChild).toHaveClass('tb-card--compact');
    expect(screen.queryByText('backend')).not.toBeInTheDocument();
    expect(screen.queryByText('4 comments')).not.toBeInTheDocument();
  });
});
