-- The JSON fixtures table is gone: Storybook reads the sb_ schemas (see docs/storybook.md).
-- Drops the legacy {{mocks}} schema created by 001. Idempotent. To go back to the code that still
-- needs mocks.fixtures, see "Going back to fixtures-main" in docs/storybook.md.
drop schema if exists {{mocks}} cascade;
