// supabase/functions/get-analytics-summary/index.ts
// Deploy: supabase functions deploy get-analytics-summary
//
// Levert een samenvatting van analytics_events op voor het admin-only
// "Analytics"-tabblad in het artiestenpaneel. Vereist een geldige sessie van
// een gebruiker met role = 'admin' in de users-tabel (anders 401/403).
//
// Vereiste secrets (al aanwezig, geen extra setup nodig):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//   (SUPABASE_ANON_KEY en SUPABASE_SERVICE_ROLE_KEY worden door Supabase
//   automatisch aan elke edge function meegegeven)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return json({ error: "unauthorized" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: userRow } = await admin.from("users").select("role").eq("auth_id", user.id).limit(1).single();
    if (!userRow || userRow.role !== "admin") {
      return json({ error: "forbidden" }, 403);
    }

    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const countSessions = async (since?: Date) => {
      let q = admin.from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "session_start");
      if (since) q = q.gte("created_at", since.toISOString());
      const { count } = await q;
      return count || 0;
    };

    const [today, d7count, d30count, all] = await Promise.all([
      countSessions(startOfToday),
      countSessions(d7),
      countSessions(d30),
      countSessions(),
    ]);

    const { data: geoRows } = await admin.from("analytics_events")
      .select("country")
      .eq("event_type", "session_start")
      .gte("created_at", d30.toISOString())
      .limit(5000);
    const geoCounts: Record<string, number> = {};
    (geoRows || []).forEach((r: any) => {
      const c = r.country || "Onbekend";
      geoCounts[c] = (geoCounts[c] || 0) + 1;
    });
    const geo = Object.entries(geoCounts)
      .map(([country, sessions]) => ({ country, sessions }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 15);

    const { data: langRows } = await admin.from("analytics_events")
      .select("event_data")
      .eq("event_type", "session_start")
      .gte("created_at", d30.toISOString())
      .limit(5000);
    const langCounts: Record<string, number> = {};
    (langRows || []).forEach((r: any) => {
      const l = r.event_data?.language || "nl";
      langCounts[l] = (langCounts[l] || 0) + 1;
    });
    const languages = Object.entries(langCounts)
      .map(([language, sessions]) => ({ language, sessions }))
      .sort((a, b) => b.sessions - a.sessions);

    const { data: eventRows } = await admin.from("analytics_events")
      .select("event_type")
      .gte("created_at", d30.toISOString())
      .limit(10000);
    const eventCounts: Record<string, number> = {};
    (eventRows || []).forEach((r: any) => {
      eventCounts[r.event_type] = (eventCounts[r.event_type] || 0) + 1;
    });
    const events = Object.entries(eventCounts)
      .map(([event_type, count]) => ({ event_type, count }))
      .sort((a, b) => b.count - a.count);

    const { data: recent } = await admin.from("analytics_events")
      .select("created_at, event_type, event_data, country, city, session_id")
      .order("created_at", { ascending: false })
      .limit(50);

    return json({
      totals: { today, d7: d7count, d30: d30count, all },
      geo,
      languages,
      events,
      recent: recent || [],
    });
  } catch (e) {
    console.error("[get-analytics-summary] exception:", e);
    return json({ error: String(e) }, 500);
  }
});
