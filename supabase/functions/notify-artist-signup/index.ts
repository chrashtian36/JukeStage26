// supabase/functions/notify-artist-signup/index.ts
// Deploy: supabase functions deploy notify-artist-signup
//
// Vereiste secrets (Supabase dashboard → Settings → Edge Functions → Secrets):
//   RESEND_API_KEY     → https://resend.com/api-keys
//   NOTIFY_EMAIL       → jouw e-mailadres voor notificaties

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const NOTIFY_EMAIL   = Deno.env.get("NOTIFY_EMAIL")!;
const FROM_EMAIL     = "notifications@jukestage.live";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email, tier, created_at } = await req.json();

    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: "name and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedDate = new Date(created_at ?? Date.now()).toLocaleString("nl-NL", {
      timeZone: "Europe/Amsterdam",
      dateStyle: "long",
      timeStyle: "short",
    });

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a;">
        <div style="background:#0d0705;padding:20px 24px;border-radius:8px 8px 0 0;">
          <span style="font-size:22px;font-weight:bold;color:#ffaa00;letter-spacing:3px;">JUKESTAGE</span>
        </div>
        <div style="border:1px solid #e0e0e0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          <h2 style="margin:0 0 16px;font-size:18px;">Nieuwe artiest aangemeld 🎸</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:8px 0;color:#666;width:110px;">Naam</td>
              <td style="padding:8px 0;font-weight:600;">${escHtml(name)}</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:8px 0;color:#666;">E-mail</td>
              <td style="padding:8px 0;"><a href="mailto:${escHtml(email)}" style="color:#ff6b00;">${escHtml(email)}</a></td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:8px 0;color:#666;">Tijdstip</td>
              <td style="padding:8px 0;">${escHtml(formattedDate)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666;">Tier</td>
              <td style="padding:8px 0;">${escHtml(tier ?? "free")}</td>
            </tr>
          </table>
        </div>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to:   NOTIFY_EMAIL,
        subject: `Nieuwe JukeStage-artiest: ${name}`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", res.status, errText);
      return new Response(
        JSON.stringify({ error: "Resend request failed", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resData = await res.json();
    return new Response(
      JSON.stringify({ ok: true, id: resData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("notify-artist-signup exception:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
