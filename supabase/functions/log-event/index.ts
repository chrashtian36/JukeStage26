// supabase/functions/log-event/index.ts
// Deploy: supabase functions deploy log-event
//
// Ontvangt analytics-events vanuit de client (sessie-start, schermnavigatie,
// taalkeuze, QR-aankomst, login, song requests, stemmen, berichten, reviews)
// en schrijft ze weg naar analytics_events met de service-role key, zodat
// clients nooit rechtstreeks in die tabel kunnen lezen of schrijven.
//
// Vereiste secrets (al aanwezig voor fetch-genius-urls, geen extra setup nodig):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_EVENT_TYPES = new Set([
  "session_start",
  "view_screen",
  "qr_arrival",
  "language_selected",
  "voter_login_success",
  "artist_login_success",
  "artist_signup",
  "song_request",
  "vote",
  "message_sent",
  "rating_submitted",
]);

// Kleine in-memory cache: zolang deze function-instance warm blijft, wordt
// hetzelfde IP niet telkens opnieuw opgezocht bij een reeks events uit één sessie.
type Geo = { country: string | null; region: string | null; city: string | null };
const geoCache = new Map<string, Geo>();

async function lookupGeo(ip: string): Promise<Geo | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`https://ipwho.is/${ip}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.success) return null;
    return {
      country: data.country || null,
      region: data.region || null,
      city: data.city || null,
    };
  } catch (e) {
    console.error("[log-event] geo lookup failed:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      event_type,
      session_id,
      gig_id,
      voter_session_id,
      artist_id,
      event_data,
      referrer,
      path,
      language,
    } = body ?? {};

    if (typeof event_type !== "string" || !ALLOWED_EVENT_TYPES.has(event_type)) {
      return new Response(JSON.stringify({ error: "invalid event_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof session_id !== "string" || !session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    const userAgent = req.headers.get("user-agent") || null;

    // Geo is per sessie relevant, niet per actie — alleen opzoeken bij
    // session_start voorkomt onnodige lookup-calls bij drukte (elke schermwissel,
    // stem of aanvraag zou anders ook een lookup triggeren).
    let geo: Geo = { country: null, region: null, city: null };
    if (ip && event_type === "session_start") {
      const cached = geoCache.get(ip);
      if (cached) {
        geo = cached;
      } else {
        const looked_up = await lookupGeo(ip);
        if (looked_up) {
          geo = looked_up;
          geoCache.set(ip, geo); // alleen succesvolle lookups cachen, nooit een mislukking
        }
      }
    }

    const row = {
      session_id,
      event_type,
      event_data: { ...(event_data && typeof event_data === "object" ? event_data : {}), language: language ?? undefined },
      gig_id: gig_id || null,
      voter_session_id: voter_session_id || null,
      artist_id: artist_id || null,
      path: typeof path === "string" ? path.slice(0, 500) : null,
      referrer: typeof referrer === "string" ? referrer.slice(0, 500) : null,
      user_agent: userAgent,
      country: geo.country,
      region: geo.region,
      city: geo.city,
    };

    const { error } = await supabase.from("analytics_events").insert(row);
    if (error) {
      console.error("[log-event] insert failed:", error.message);
      return new Response(JSON.stringify({ error: "insert failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[log-event] exception:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
