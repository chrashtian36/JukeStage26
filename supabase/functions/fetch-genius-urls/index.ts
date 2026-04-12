// supabase/functions/fetch-genius-urls/index.ts
// Deploy: supabase functions deploy fetch-genius-urls
//
// Vereiste environment variabelen (via Supabase dashboard of CLI):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   GENIUS_ACCESS_TOKEN  → https://genius.com/api-clients

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GENIUS_TOKEN = Deno.env.get("GENIUS_ACCESS_TOKEN")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getGeniusUrl(artist: string, title: string): Promise<string | null> {
  const q = encodeURIComponent(`${artist} ${title}`);
  const res = await fetch(`https://api.genius.com/search?q=${q}`, {
    headers: { Authorization: `Bearer ${GENIUS_TOKEN}` },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const hits = data?.response?.hits ?? [];

  // Zoek de beste match: artist naam moet overeenkomen
  const artistLower = artist.toLowerCase();
  const match = hits.find((h: any) => {
    const hitArtist = h.result?.primary_artist?.name?.toLowerCase() ?? "";
    return hitArtist.includes(artistLower) || artistLower.includes(hitArtist.split(" ")[0]);
  });

  return match?.result?.url ?? hits[0]?.result?.url ?? null;
}

Deno.serve(async (req) => {
  // Optioneel: bescherm de functie met een secret header
  // const authHeader = req.headers.get("x-secret");
  // if (authHeader !== Deno.env.get("FUNCTION_SECRET")) {
  //   return new Response("Unauthorized", { status: 401 });
  // }

  // Haal alle songs op zonder karaoke_url
  const { data: songs, error } = await supabase
    .from("songs")
    .select("id, title, original_artist")
    .is("karaoke_url", null)
    .eq("is_active", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results = [];
  let updated = 0;
  let failed = 0;

  for (const song of songs ?? []) {
    // Wacht 300ms tussen requests om rate limiting te vermijden
    await new Promise((r) => setTimeout(r, 300));

    const url = await getGeniusUrl(song.original_artist, song.title);

    if (url) {
      const { error: updateError } = await supabase
        .from("songs")
        .update({ karaoke_url: url })
        .eq("id", song.id);

      if (updateError) {
        results.push({ id: song.id, title: song.title, status: "update_failed", error: updateError.message });
        failed++;
      } else {
        results.push({ id: song.id, title: song.title, status: "ok", url });
        updated++;
      }
    } else {
      results.push({ id: song.id, title: song.title, status: "not_found" });
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ updated, failed, total: songs?.length ?? 0, results }),
    { headers: { "Content-Type": "application/json" } }
  );
});