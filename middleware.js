const SUPABASE_URL = 'https://zrcxlycwfcrbsispgwju.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lsvdYSTKIo4Buj17rKZOcw_2Rparioi';

const BOT_UA = /whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|telegrambot|discord|googlebot|bingbot/i;

export default async function middleware(request) {
  const url = new URL(request.url);
  const gigToken = url.searchParams.get('gig');
  if (!gigToken) return;

  const ua = request.headers.get('user-agent') || '';
  if (!BOT_UA.test(ua)) return;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/gigs?qr_token=eq.${encodeURIComponent(gigToken)}&select=id,venue,gig_date,gig_artists(artists(name))`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Accept': 'application/json'
        }
      }
    );
    const gigs = await res.json();
    const gig = gigs?.[0];
    if (!gig) return;

    const artistNames = (gig.gig_artists || []).map(ga => ga.artists?.name).filter(Boolean);
    const artistName = artistNames.length ? artistNames.join(' & ') : 'Live muziek';
    const venue = gig.venue || '';
    const date = gig.gig_date
      ? new Date(gig.gig_date).toLocaleDateString('nl-NL', { timeZone: 'Europe/Brussels', weekday: 'long', day: 'numeric', month: 'long' })
      : '';

    const title = `${artistName} — JukeStage`;
    const parts = [venue, date].filter(Boolean);
    const description = parts.length
      ? `${parts.join(' · ')} — Vraag nummers aan en stem mee!`
      : 'Vraag nummers aan en stem mee!';

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="https://jukestage.live/apple-touch-icon.png">
<meta property="og:image:width" content="180">
<meta property="og:image:height" content="180">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(url.href)}">
<meta property="og:site_name" content="JukeStage">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="https://jukestage.live/apple-touch-icon.png">
<title>${esc(title)}</title>
</head><body></body></html>`;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (e) {
    // Bij fout gewoon doorlaten naar de SPA
    return;
  }
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const config = {
  matcher: '/'
};
