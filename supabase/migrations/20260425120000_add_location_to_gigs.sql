-- Location fields for gigs
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS location_type   text    NOT NULL DEFAULT 'physical';
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS location_address text;
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS location_lat    numeric(10,7);
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS location_lng    numeric(10,7);
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS stream_url      text;
