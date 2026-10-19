import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Column } from './Column';

describe('Column WIP indicator', () => {
  it('shows nothing when the flag is off', () => {
    render(<Column name="Doing" count={5} wipLimit={3} />);
    expect(screen.getByTestId('column-count')).toHaveTextContent(/^5/);
    expect(screen.queryByText('Over limit')).not.toBeInTheDocument();
  });

  it('shows count / limit and the right state', () => {
    const { rerender } = render(<Column name="Doing" count={2} wipLimit={3} showWip />);
    expect(screen.getByTestId('column-count')).toHaveTextContent('2 / 3');
    expect(screen.queryByText('At limit')).not.toBeInTheDocument();
    rerender(<Column name="Doing" count={3} wipLimit={3} showWip />);
    expect(screen.getByText('At limit')).toBeInTheDocument();
    rerender(<Column name="Doing" count={4} wipLimit={3} showWip />);
    expect(screen.getByText('Over limit')).toBeInTheDocument();
  });

  it('shows the empty hint for an empty column', () => {
    const { container } = render(<Column name="Done" count={0} />);
    expect(container.querySelector('.tb-column__empty')).not.toBeNull();
  });

  it('submits the trimmed title from the composer', async () => {
    const onAddCard = vi.fn();
    render(<Column name="Todo" count={0} onAddCard={onAddCard} />);
    await userEvent.click(screen.getByRole('button', { name: /add card/i }));
    await userEvent.type(screen.getByRole('textbox'), '  New thing  {Enter}');
    expect(onAddCard).toHaveBeenCalledWith('New thing');
  });
});
