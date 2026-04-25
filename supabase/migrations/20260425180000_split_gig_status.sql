-- Split gig "live" status into two independent booleans
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS is_live     boolean NOT NULL DEFAULT false;
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS voting_open boolean NOT NULL DEFAULT false;

-- Migrate existing live gigs: they were both live and had voting open
UPDATE gigs SET is_live = true, voting_open = true WHERE status = 'live';
