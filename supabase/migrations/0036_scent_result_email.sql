-- Maison Obsidian — "Email my results" from /discover
--
-- scent_profiles.email already means "they asked us to send them this result"
-- (migration 0019). This stamps when we did, so each result is emailed once:
-- the send claims the row by setting the stamp, and clears it again if the
-- email provider refuses. Written only by the server (service role).

alter table public.scent_profiles
  add column if not exists result_emailed_at timestamptz;
