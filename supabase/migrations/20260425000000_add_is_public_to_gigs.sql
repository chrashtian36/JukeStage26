-- Add is_public flag to gigs (default false = private, only accessible via QR/link)
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
