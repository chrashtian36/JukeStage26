-- Sla de handmatige wachtrij-volgorde op per gig (array van song_ids)
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS queue_order jsonb DEFAULT '[]'::jsonb;
