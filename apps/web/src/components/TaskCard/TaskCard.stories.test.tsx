import { render, screen } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import { describe, expect, it } from 'vitest';
import * as stories from './TaskCard.stories';

/**
 * Portable stories: the same story file Storybook renders, composed and run in plain jsdom.
 * No browser, no database, no Storybook server. Pure-props stories only.
 */
const { Default, NoAssignee, ManyLabels } = composeStories(stories);

describe('TaskCard stories as unit tests', () => {
  it('renders the default story with its args', () => {
    render(<Default />);
    expect(screen.getByText('Migrate the payment ledger to the new schema')).toBeInTheDocument();
    expect(screen.getByText('backend')).toBeInTheDocument();
  });

  it('story args can be overridden per render', () => {
    render(<Default title="Rotate the signing keys" />);
    expect(screen.getByText('Rotate the signing keys')).toBeInTheDocument();
  });

  it('the NoAssignee story shows no avatar', () => {
    const { container: withAssignee } = render(<Default />);
    const avatars = withAssignee.querySelectorAll('.tb-avatar').length;
    const { container } = render(<NoAssignee />);
    expect(container.querySelectorAll('.tb-avatar').length).toBeLessThan(avatars);
  });

  it('the ManyLabels story renders every label', () => {
    render(<ManyLabels />);
    for (const label of ManyLabels.args.labels ?? []) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
});
