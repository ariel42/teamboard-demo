-- Initial Teamboard schema. {{app}}, {{config}} and {{mocks}} are replaced by the migration
-- runner with the (prefixed, quoted) schema names. The schemas themselves and the
-- {{app}}.migrations table are created by the runner.

create type {{app}}.priority as enum ('low', 'medium', 'high', 'urgent');

create table {{app}}.users (
  id       serial primary key,
  name     text not null unique,
  initials text not null,
  color    text not null
);

create table {{app}}.boards (
  id          serial primary key,
  name        text not null unique,
  description text not null default ''
);

create table {{app}}.columns (
  id       serial primary key,
  board_id integer not null,
  name     text not null,
  position integer not null check (position >= 0),
  constraint columns_board_id_fkey foreign key (board_id)
    references {{app}}.boards (id) on delete cascade
);
create index columns_board_position_idx on {{app}}.columns (board_id, position);

create table {{app}}.cards (
  id          serial primary key,
  column_id   integer not null,
  title       text not null,
  description text not null default '',
  assignee_id integer,
  priority    {{app}}.priority not null default 'medium',
  due_date    date,
  labels      text[] not null default '{}',
  position    integer not null check (position >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint cards_column_id_fkey foreign key (column_id)
    references {{app}}.columns (id) on delete cascade,
  constraint cards_assignee_id_fkey foreign key (assignee_id)
    references {{app}}.users (id) on delete set null
);
create index cards_column_position_idx on {{app}}.cards (column_id, position);
create index cards_assignee_idx on {{app}}.cards (assignee_id);

create table {{app}}.comments (
  id         serial primary key,
  card_id    integer not null,
  author_id  integer not null,
  body       text not null,
  created_at timestamptz not null default now(),
  constraint comments_card_id_fkey foreign key (card_id)
    references {{app}}.cards (id) on delete cascade,
  constraint comments_author_id_fkey foreign key (author_id)
    references {{app}}.users (id) on delete cascade
);
create index comments_card_idx on {{app}}.comments (card_id, created_at, id);

create table {{config}}.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text not null default ''
);

create table {{config}}.settings (
  key   text primary key,
  value jsonb not null
);

create table {{mocks}}.fixtures (
  name        text primary key,
  description text not null default '',
  data        jsonb not null
);
