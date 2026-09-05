-- Logging van bezoekersgedrag: geografische herkomst, taalkeuze en de route die
-- iemand door de app aflegt (welke schermen, in welke volgorde, per sessie).
-- Wordt uitsluitend geschreven via de "log-event" edge function met de
-- service-role key — daarom bewust geen RLS-policies (RLS staat wel aan, dus
-- de anon/authenticated rollen kunnen nooit direct lezen of schrijven).
create table if not exists analytics_events (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  session_id        text not null,
  event_type        text not null,
  event_data        jsonb not null default '{}'::jsonb,
  gig_id            integer references gigs(id) on delete set null,
  voter_session_id  uuid references voter_sessions(id) on delete set null,
  artist_id         integer references artists(id) on delete set null,
  path              text,
  referrer          text,
  user_agent        text,
  country           text,
  region            text,
  city              text
);

create index if not exists analytics_events_session_idx on analytics_events (session_id, created_at);
create index if not exists analytics_events_gig_idx     on analytics_events (gig_id, created_at);
create index if not exists analytics_events_type_idx    on analytics_events (event_type, created_at);

alter table analytics_events enable row level security;

-- Voorbeeld-views voor snel inzicht in de Supabase SQL-editor.

-- Herkomst per land, gebaseerd op het begin van elke sessie.
create or replace view analytics_geo_summary as
select country, region, city, count(distinct session_id) as sessions
from analytics_events
where event_type = 'session_start'
group by country, region, city
order by sessions desc;

-- Gekozen taal per sessie (session_start bevat de actieve taal op dat moment).
create or replace view analytics_language_summary as
select coalesce(event_data->>'language', 'nl') as language, count(distinct session_id) as sessions
from analytics_events
where event_type = 'session_start'
group by 1
order by sessions desc;

-- Route-analyse: haal alle events van één sessie op in volgorde om te zien
-- welke schermen iemand doorloopt.
--   select created_at, event_type, event_data, gig_id
--   from analytics_events
--   where session_id = '<sessie-id>'
--   order by created_at;
