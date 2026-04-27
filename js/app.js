  // ════════════════════════════════════════════
  // SUPABASE
  // ════════════════════════════════════════════
  const SUPABASE_URL = 'https://zrcxlycwfcrbsispgwju.supabase.co';
  // SECURITY FIX (punt 17): Gebruik een Row Level Security-compatible anon key
  // Zorg in Supabase dashboard dat RLS policies actief zijn op alle tabellen!
  const SUPABASE_KEY = 'sb_publishable_lsvdYSTKIo4Buj17rKZOcw_2Rparioi';
  const { createClient } = supabase;
  const db = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ════════════════════════════════════════════
  // STATE
  // ════════════════════════════════════════════
  let currentUser   = null;
  let currentGig    = null;
  let currentArtist = null;
  let voterSession  = null;
  let currentRating = 0;
  let currentRequestSong = null;
  let realtimeChannel    = null;
  let allSongs      = [];
  let editingSongId = null;
  let playedCountThisSession = 0;
  let arrivedViaQR  = false; // voter gelockt aan gig via QR-link
  let voterAuthUser    = null;  // ingelogde voter (Supabase auth user)
  let voterPendingEmail = '';   // e-mail tijdens OTP verificatie

  // ════════════════════════════════════════════
  // VOTER AUTH — MAGIC LINK
  // ════════════════════════════════════════════
  function showVoterScreen(name) {
    ['choice','quick','email','code','newname'].forEach(s => {
      const el = document.getElementById('voter-screen-' + s);
      if (el) el.style.display = s === name ? 'block' : 'none';
    });
    if (name === 'quick')   document.getElementById('voter-name')?.focus();
    if (name === 'email')   document.getElementById('voter-email')?.focus();
    if (name === 'code')    { const c = document.getElementById('voter-otp-code'); if(c){c.value='';c.focus();} }
    if (name === 'newname') document.getElementById('voter-account-name')?.focus();
  }

  async function sendVoterOTP() {
    const email = document.getElementById('voter-email')?.value.trim();
    if (!email || !email.includes('@')) {
      showToast('Vul een geldig e-mailadres in', 'error');
      return;
    }
    // Hergebruik bestaande sessie als die geldig is (voorkomt rate limit)
    const { data: { session } } = await db.auth.getSession();
    if (session && session.user.email === email) {
      voterAuthUser = session.user;
      const { data: profile } = await db.from('voter_profiles')
        .select('display_name').eq('id', session.user.id).single();
      if (profile) {
        await _enterAsVoterWithAuth(profile.display_name);
      } else {
        const prefill = document.getElementById('voter-account-name');
        if (prefill) prefill.value = '';
        showVoterScreen('newname');
      }
      return;
    }
    const { error } = await db.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin }
    });
    if (error) {
      if (error.status === 429 || error.message?.toLowerCase().includes('rate limit')) {
        showToast('Te veel codes verstuurd. Wacht even of gebruik de laatste code die je hebt ontvangen.', 'error');
      } else {
        showToast('Fout: ' + error.message, 'error');
      }
      return;
    }
    voterPendingEmail = email;
    showVoterScreen('code');
  }

  async function verifyVoterOTP() {
    const code = document.getElementById('voter-otp-code')?.value.trim();
    if (!code || code.length < 6) {
      showToast('Vul de volledige inlogcode in', 'error');
      return;
    }
    const { data, error } = await db.auth.verifyOtp({
      email: voterPendingEmail,
      token: code,
      type: 'email'
    });
    if (error) { showToast('Ongeldige of verlopen code', 'error'); return; }
    voterAuthUser = data.user;

    const { data: profile } = await db.from('voter_profiles')
      .select('display_name').eq('id', data.user.id).single();
    if (profile) {
      await _enterAsVoterWithAuth(profile.display_name);
    } else {
      const prefill = document.getElementById('voter-account-name');
      if (prefill) prefill.value = '';
      showVoterScreen('newname');
    }
  }

  async function saveVoterProfile() {
    const name = document.getElementById('voter-account-name')?.value.trim();
    if (!name) { showToast('Vul je naam in', 'error'); return; }
    if (!voterAuthUser) { showToast('Sessie verlopen, probeer opnieuw', 'error'); return; }
    const { error } = await db.from('voter_profiles')
      .insert({ id: voterAuthUser.id, display_name: name });
    if (error && error.code !== '23505') { // 23505 = already exists
      showToast('Opslaan mislukt: ' + error.message, 'error'); return;
    }
    await _enterAsVoterWithAuth(name);
  }

  async function _enterAsVoterWithAuth(overrideName) {
    const gig = selectedVoterGig;
    if (!gig) { showToast('Gig niet gevonden', 'error'); return; }
    let displayName = overrideName;
    if (!displayName && voterAuthUser) {
      const { data: profile } = await db.from('voter_profiles')
        .select('display_name').eq('id', voterAuthUser.id).single();
      displayName = profile?.display_name;
    }
    if (!displayName) { showVoterScreen('newname'); return; }
    currentGig = gig;
    const { data: sess } = await db.from('voter_sessions')
      .insert({ gig_id: gig.id, display_name: displayName, auth_user_id: voterAuthUser?.id || null })
      .select('*').single();
    voterSession = sess;
    showView('view-voter');
    const logoutBtn = document.getElementById('voter-logout-btn');
    if (logoutBtn) logoutBtn.style.display = voterAuthUser ? '' : 'none';
    loadVoterGigInfo();
    loadVoterQueue();
    loadVoterSongs();
    loadVoterMessages();
    loadVoterComments();
    subscribeRealtime();
  }

  // OTP verificatie wordt afgehandeld in verifyVoterOTP()
  // onAuthStateChange alleen nodig voor artist session herstel
  db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      currentUser = null; currentGig = null; voterAuthUser = null;
    }
  });

  // ════════════════════════════════════════════
  // VIEW ROUTING
  // ════════════════════════════════════════════
  function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const t = document.getElementById(id);
    if (t) { t.classList.add('active'); window.scrollTo(0,0); }
  }

  // ════════════════════════════════════════════
  // LANDING
  // ════════════════════════════════════════════
  async function showLoginForm() {
    // Controleer eerst of er al een geldige sessie is — zo ja, direct inloggen
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      let { data: uRows } = await db.from('users')
        .select('id, role, display_name, auth_id').eq('auth_id', session.user.id).limit(1);
      let userData = uRows?.[0] || null;
      if (!userData) {
        const { data: uByEmail } = await db.from('users')
          .select('id, role, display_name, auth_id').eq('email', session.user.email).limit(1);
        userData = uByEmail?.[0] || null;
      }
      if (userData) {
        currentUser = {
          ...session.user,
          id: userData.id,
          auth_id: session.user.id,
          role: userData.role || 'artist',
          name: userData.display_name || session.user.email
        };
        const badge = document.getElementById('artist-role-badge');
        badge.textContent = currentUser.role === 'admin' ? 'ADMIN' : 'ARTIEST';
        badge.className = currentUser.role === 'admin' ? 'badge badge-red' : 'badge badge-chrome';
        if (currentUser.role === 'admin') {
          document.getElementById('admin-direct-add').style.display = 'block';
        }
        showView('view-artist');
        await loadArtistData();
        return;
      }
    }
    // Geen geldige sessie — toon OTP-scherm
    document.getElementById('card-choice').style.display = 'none';
    document.getElementById('card-login').style.display = 'block';
    showArtistScreen('email');
  }
  function showLandingChoice() {
    document.getElementById('card-choice').style.display = 'block';
    document.getElementById('card-login').style.display = 'none';
  }
  function showArtistScreen(name) {
    ['email','code','newname'].forEach(s => {
      const el = document.getElementById('artist-screen-' + s);
      if (el) el.style.display = s === name ? 'block' : 'none';
    });
  }

  // ════════════════════════════════════════════
  // ARTIST AUTH — OTP login + signup
  // ════════════════════════════════════════════
  let artistPendingEmail   = '';
  let artistPendingAuthUser = null;
  let queueSortMode    = 'chrono'; // chrono | popular | custom
  let queueCustomOrder = [];       // song_id array voor eigen volgorde

  async function sendArtistOTP() {
    const email = document.getElementById('login-email').value.trim();
    if (!email || !email.includes('@')) {
      showToast('Vul een geldig e-mailadres in', 'error'); return;
    }
    showToast('Code versturen...', '');
    const { error } = await db.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin }
    });
    if (error) {
      if (error.status === 429 || error.message?.toLowerCase().includes('rate limit')) {
        // Toon rate-limit melding én spring meteen naar code-invoer (code van eerder gebruiken)
        artistPendingEmail = email;
        showArtistScreen('code');
        document.getElementById('artist-otp-code').value = '';
        showToast('Rate limit bereikt — gebruik de code uit je laatste e-mail.', 'error');
      } else {
        showToast('Fout: ' + error.message, 'error');
      }
      return;
    }
    artistPendingEmail = email;
    showArtistScreen('code');
    document.getElementById('artist-otp-code').value = '';
    showToast('Code verstuurd! Check je e-mail.', 'success');
  }

  function useExistingCode() {
    const email = document.getElementById('login-email')?.value.trim();
    if (!email || !email.includes('@')) {
      showToast('Vul eerst je e-mailadres in', 'error'); return;
    }
    artistPendingEmail = email;
    showArtistScreen('code');
    document.getElementById('artist-otp-code').value = '';
    document.getElementById('artist-otp-code').focus();
  }

  async function verifyArtistOTP() {
    const code = document.getElementById('artist-otp-code')?.value.trim();
    if (!code || code.length < 6) {
      showToast('Vul de volledige inlogcode in', 'error'); return;
    }
    showToast('Verifiëren...', '');
    const { data, error } = await db.auth.verifyOtp({
      email: artistPendingEmail,
      token: code,
      type: 'email'
    });
    if (error) { showToast('Ongeldige of verlopen code', 'error'); return; }

    artistPendingAuthUser = data.user;

    // Zoek users-record: eerst op auth_id, dan op email (bestaande accounts zonder auth_id)
    let { data: uRows } = await db.from('users')
      .select('id, role, display_name, auth_id').eq('auth_id', data.user.id).limit(1);
    let userData = uRows?.[0] || null;

    if (!userData) {
      const { data: uByEmail } = await db.from('users')
        .select('id, role, display_name, auth_id').eq('email', artistPendingEmail).limit(1);
      userData = uByEmail?.[0] || null;
      if (userData && !userData.auth_id) {
        await db.from('users').update({ auth_id: data.user.id }).eq('id', userData.id);
        userData.auth_id = data.user.id;
      }
    }

    if (userData) {
      // Bestaande gebruiker — inloggen
      currentUser = {
        ...data.user,
        id: userData.id,
        auth_id: data.user.id,
        role: userData.role || 'artist',
        name: userData.display_name || artistPendingEmail
      };
      showToast('Welkom terug! 🎸', 'success');
      _enterAsArtist();
    } else {
      // Nieuwe gebruiker — naam opgeven
      document.getElementById('artist-signup-name').value = '';
      showArtistScreen('newname');
    }
  }

  async function saveArtistProfile() {
    const name = document.getElementById('artist-signup-name')?.value.trim();
    if (!name) { showToast('Vul een naam in', 'error'); return; }
    if (!artistPendingAuthUser) { showToast('Sessie verlopen, probeer opnieuw', 'error'); return; }

    const btn = document.getElementById('btn-save-artist-profile');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

    showToast('Account aanmaken...', '');

    // 1. Artists-rij aanmaken
    const { data: artistData, error: artistErr } = await db.from('artists')
      .insert({ name, tier: 'free', subscription_valid_until: null })
      .select('id').single();
    if (artistErr) {
      showToast('Aanmaken mislukt: ' + artistErr.message, 'error');
      if (btn) { btn.disabled = false; btn.style.opacity = ''; }
      return;
    }

    // 2. Users-rij aanmaken
    const { data: userData, error: userErr } = await db.from('users')
      .insert({
        auth_id: artistPendingAuthUser.id,
        email:   artistPendingEmail,
        display_name: name,
        role: 'artist'
      })
      .select('id').single();
    if (userErr) {
      showToast('Aanmaken mislukt: ' + userErr.message, 'error');
      if (btn) { btn.disabled = false; btn.style.opacity = ''; }
      return;
    }

    // 3. Koppeling user ↔ artist
    await db.from('user_artists').insert({ user_id: userData.id, artist_id: artistData.id });

    currentUser = {
      ...artistPendingAuthUser,
      id: userData.id,
      auth_id: artistPendingAuthUser.id,
      role: 'artist',
      name
    };
    showToast('Welkom bij JukeStage! 🎸', 'success');
    _enterAsArtist();

    // Fire-and-forget notificatie — fout blokkeert signup nooit
    console.log('[signup] Invoking notify-artist-signup for', artistPendingEmail);
    db.functions.invoke('notify-artist-signup', {
      body: { name, email: artistPendingEmail, tier: 'free', created_at: new Date().toISOString() }
    }).then(({ data, error }) => {
      if (error) console.error('[signup] notify-artist-signup error:', error);
      else console.log('[signup] notify-artist-signup response:', data);
    }).catch(e => console.error('[signup] notify-artist-signup exception:', e));
  }

  function _enterAsArtist() {
    const badge = document.getElementById('artist-role-badge');
    badge.textContent = currentUser.role === 'admin' ? 'ADMIN' : 'ARTIEST';
    badge.className   = currentUser.role === 'admin' ? 'badge badge-red' : 'badge badge-chrome';
    if (currentUser.role === 'admin') {
      document.getElementById('admin-direct-add').style.display = 'block';
    }
    showView('view-artist');
    loadArtistData();
  }

  // ════════════════════════════════════════════
  // VOTER FLOW — multi-gig keuze
  // ════════════════════════════════════════════
  let selectedVoterGig = null;

  async function loadLiveGigs(ignoreToken = false) {
    const pickArea = document.getElementById('voter-gig-pick-area');
    const nameArea = document.getElementById('voter-name-area');
    if (!pickArea) return;
    pickArea.style.display = 'block';
    if (nameArea) nameArea.style.display = 'none';
    selectedVoterGig = null;

    // Reset loader
    pickArea.innerHTML = '<div style="text-align:center;padding:20px 0;">'
      + '<div style="width:24px;height:24px;border:2px solid var(--neon);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 10px;"></div>'
      + '<div style="font-family:var(--font-retro);font-size:11px;color:var(--muted);letter-spacing:2px;">LADEN...</div></div>';

    const params   = new URLSearchParams(window.location.search);
    const gigToken = !ignoreToken && (params.get('gig') || params.get('token'));

    if (gigToken) {
      arrivedViaQR = true;
      try {
        const { data: gigData } = await db.from('gigs').select('*').eq('qr_token', gigToken).single();
        if (gigData && gigData.status !== 'finished') { selectVoterGig(gigData); return; }
        pickArea.innerHTML = '<div style="text-align:center;padding:20px 0;color:var(--neon3);font-family:var(--font-retro);font-size:12px;">Deze gig is niet beschikbaar.</div>';
      } catch(e) {
        pickArea.innerHTML = '<div style="text-align:center;padding:20px 0;color:var(--neon3);font-family:var(--font-retro);font-size:12px;">Gig niet gevonden.</div>';
      }
      return;
    }

    const { data: liveGigs } = await db.from('gigs')
      .select('*')
      .or('is_live.eq.true,voting_open.eq.true')
      .eq('is_active', true).eq('is_public', true).neq('status', 'finished')
      .order('gig_date', { ascending: false });

    if (!liveGigs || liveGigs.length === 0) {
      pickArea.innerHTML = '<div style="text-align:center;padding:24px 0;">'
        + '<div style="font-size:32px;margin-bottom:10px;">🎸</div>'
        + '<div style="font-family:var(--font-display);font-size:18px;color:var(--muted);">Geen live gigs</div>'
        + '<div style="font-size:12px;color:var(--muted);margin-top:6px;font-family:var(--font-retro);">Vraag de artiest om de QR-code te scannen</div></div>';
      return;
    }

    if (liveGigs.length === 1) { selectVoterGig(liveGigs[0]); return; }

    // Meerdere gigs — toon keuzelijst
    function buildGigPickCard(g, i) {
      const locType  = g.location_type || 'physical';
      const dateObj  = g.gig_date ? new Date(g.gig_date) : null;
      const datePart = dateObj ? dateObj.toLocaleDateString('nl-NL', { weekday:'short', day:'numeric', month:'short' }) : '';
      const timePart = dateObj ? dateObj.toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' }) : '';
      const dateTime = [datePart, timePart].filter(Boolean).join(' · ');

      let locationBadge = '';
      if (locType === 'online') {
        locationBadge = '<span class="gig-pick-badge gig-pick-badge--online">🌐 Online</span>';
      } else if (locType === 'hybrid') {
        locationBadge = (g.venue ? '<span class="gig-pick-badge">📍 ' + g.venue + '</span>' : '')
          + '<span class="gig-pick-badge gig-pick-badge--online">🌐 Online</span>';
      } else if (g.venue) {
        locationBadge = '<span class="gig-pick-badge">📍 ' + g.venue + '</span>';
      }

      const liveDot  = g.is_live ? '<span class="gig-live-dot"></span>' : '';
      const metaParts = [locationBadge, dateTime].filter(Boolean);

      return '<div class="gig-pick-card" id="gigpick_' + i + '">'
        + '<div style="min-width:0;">'
        + '<div class="gig-pick-name">' + liveDot + (g.name || 'Gig') + '</div>'
        + (metaParts.length ? '<div class="gig-pick-meta" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:5px;">' + metaParts.join('') + '</div>' : '')
        + '</div>'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18" style="color:var(--neon);flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>'
        + '</div>';
    }

    function renderGigPickList(gigs) {
      let html = '';
      gigs.forEach(function(g, i) { html += buildGigPickCard(g, i); });
      document.getElementById('gig-pick-list').innerHTML = html;
      gigs.forEach(function(g, i) {
        const el = document.getElementById('gigpick_' + i);
        if (el) el.addEventListener('click', function() { selectVoterGig(g); });
      });
    }

    const showSearch = liveGigs.length > 4;
    let html = '<div style="font-family:var(--font-retro);font-size:10px;letter-spacing:3px;color:var(--neon);text-transform:uppercase;margin-bottom:12px;text-align:center;">Kies jouw gig</div>';
    if (showSearch) {
      html += '<div style="position:relative;margin-bottom:12px;">'
        + '<svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
        + '<input id="gig-pick-search" class="search-input" type="text" placeholder="Zoek op naam of locatie…" autocomplete="off">'
        + '</div>';
    }
    html += '<div id="gig-pick-list"></div>';
    pickArea.innerHTML = html;
    renderGigPickList(liveGigs);

    if (showSearch) {
      document.getElementById('gig-pick-search').addEventListener('input', function() {
        const q = this.value.toLowerCase();
        const filtered = liveGigs.filter(function(g) {
          return (g.name || '').toLowerCase().includes(q)
            || (g.venue || '').toLowerCase().includes(q);
        });
        renderGigPickList(filtered);
      });
    }
  }

  function selectVoterGig(gig) {
    selectedVoterGig = gig;
    document.getElementById('voter-gig-pick-area').style.display = 'none';
    document.getElementById('voter-name-area').style.display = 'block';
    const nameEl  = document.getElementById('voter-selected-gig-name');
    const venueEl = document.getElementById('voter-selected-gig-venue');
    if (nameEl) nameEl.textContent = gig.name || 'Live vanavond';
    if (venueEl) {
      const locType = gig.location_type || 'physical';
      if (locType === 'online') {
        venueEl.innerHTML = '<span class="gig-pick-badge gig-pick-badge--online" style="font-size:10px;">🌐 Online</span>'
          + (gig.stream_url ? ' <a href="' + (gig.stream_url.startsWith('http') ? gig.stream_url : '#') + '" target="_blank" rel="noopener" style="color:var(--neon);font-size:10px;font-family:var(--font-retro);">Bekijk stream →</a>' : '');
      } else if (locType === 'hybrid') {
        venueEl.innerHTML = (gig.venue ? '<span style="font-size:11px;">📍 ' + gig.venue + '</span> ' : '')
          + '<span class="gig-pick-badge gig-pick-badge--online" style="font-size:10px;">🌐 Online</span>'
          + (gig.stream_url ? ' <a href="' + (gig.stream_url.startsWith('http') ? gig.stream_url : '#') + '" target="_blank" rel="noopener" style="color:var(--neon);font-size:10px;font-family:var(--font-retro);">Stream →</a>' : '');
      } else {
        venueEl.textContent = (gig.venue && gig.name !== gig.venue) ? '📍 ' + gig.venue : '';
      }
    }
    const backBtn = document.getElementById('voter-back-btn');
    if (backBtn) backBtn.style.display = arrivedViaQR ? 'none' : '';
    // Al ingelogd als voter → direct doorgaan
    if (voterAuthUser) { _enterAsVoterWithAuth(); return; }
    showVoterScreen('choice');
  }

  function backToGigPick() {
    if (arrivedViaQR) return; // gelockt aan gig via QR — niet terug
    selectedVoterGig = null;
    document.getElementById('voter-gig-pick-area').style.display = 'block';
    document.getElementById('voter-name-area').style.display = 'none';
    loadLiveGigs(true);
  }

  async function enterAsVoter() {
    const nameEl = document.getElementById('voter-name');
    const name   = nameEl ? nameEl.value.trim() : '';
    if (!name) {
      nameEl.focus();
      nameEl.style.borderColor = 'var(--neon3)';
      setTimeout(() => { nameEl.style.borderColor = ''; }, 2000);
      showToast('Vul je naam in (minimaal 1 karakter)', 'error');
      return;
    }
    const gig = selectedVoterGig;
    if (!gig) { showToast('Selecteer eerst een gig', 'error'); return; }
    if (gig.status === 'finished') { showToast('Deze gig is al afgesloten', 'error'); return; }
    currentGig = gig;

    const { data: session } = await db.from('voter_sessions')
      .insert({ gig_id: gig.id, display_name: name }).select('*').single();
    voterSession = session;

    showView('view-voter');
    loadVoterGigInfo();
    loadVoterQueue();
    loadVoterSongs();
    loadMyRequests();
    subscribeToQueue();
  }

  // ════════════════════════════════════════════
  // VOTER — GIG INFO (naam, venue, artiesten)
  // ════════════════════════════════════════════
  async function loadVoterGigInfo() {
    if (!currentGig) return;
    const nameEl    = document.getElementById('voter-gig-display-name');
    const venueEl   = document.getElementById('voter-gig-venue');
    const artistsEl = document.getElementById('voter-gig-artists');

    if (nameEl)  nameEl.textContent  = currentGig.name  || currentGig.venue || 'Live vanavond';
    if (venueEl) venueEl.textContent = currentGig.venue && currentGig.name !== currentGig.venue
      ? '📍 ' + currentGig.venue : '';

    // Live-badge in header koppelen aan is_live
    const liveBadge = document.getElementById('voter-live-badge');
    if (liveBadge) liveBadge.style.display = currentGig.is_live ? '' : 'none';

    // Status-rij: "Live nu bezig" / "Stemmen open vanaf [datum]" / gepland tijdstip
    const statusRow = document.getElementById('voter-gig-status-row');
    if (statusRow) {
      const localeMap = { nl:'nl-NL', en:'en-GB', fr:'fr-FR', de:'de-DE', es:'es-ES', mg:'fr-FR' };
      const dateLocale = localeMap[currentLang] || 'nl-NL';
      const parts = [];
      if (currentGig.is_live) {
        parts.push(`<span class="badge badge-neon" style="font-size:11px;">${t('gig-status-live')}</span>`);
      }
      if (!currentGig.voting_open) {
        if (currentGig.gig_date) {
          const d = new Date(currentGig.gig_date);
          const formatted = d.toLocaleString(dateLocale, { weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' });
          parts.push(`<span style="font-family:var(--font-retro);font-size:11px;color:var(--chrome);">${t('gig-status-voting-opens')} ${formatted}</span>`);
        } else {
          parts.push(`<span style="font-family:var(--font-retro);font-size:11px;color:var(--muted);">${t('gig-status-voting-closed')}</span>`);
        }
      } else if (!currentGig.is_live && currentGig.gig_date) {
        const d = new Date(currentGig.gig_date);
        const formatted = d.toLocaleString(dateLocale, { weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' });
        parts.push(`<span style="font-family:var(--font-retro);font-size:11px;color:var(--chrome);">🗓 ${formatted}</span>`);
      }
      statusRow.innerHTML = parts.join('');
      statusRow.style.display = parts.length ? '' : 'none';
    }

    // Locatie tonen — altijd als voter in de gig zit (private = QR-only, public = iedereen)
    const locEl = document.getElementById('voter-gig-location');
    if (locEl) {
      const locType = currentGig.location_type || 'physical';
      const parts = [];
      if ((locType === 'physical' || locType === 'hybrid') && currentGig.location_address) {
        const addr = encodeURIComponent(currentGig.location_address);
        const mapsUrl = `https://maps.google.com/?q=${addr}`;
        parts.push(`<a href="${mapsUrl}" target="_blank" rel="noopener" class="badge badge-chrome" style="text-decoration:none;">📍 ${currentGig.location_address}</a>`);
      }
      if ((locType === 'online' || locType === 'hybrid') && currentGig.stream_url) {
        const safeUrl = currentGig.stream_url.startsWith('http') ? currentGig.stream_url : '#';
        parts.push(`<a href="${safeUrl}" target="_blank" rel="noopener" class="badge badge-neon" style="text-decoration:none;">🎥 Kijk Live</a>`);
      }
      locEl.innerHTML = parts.join('');
      locEl.style.display = parts.length ? 'flex' : 'none';
    }

    // Haal artiesten op voor deze gig
    if (artistsEl) {
      try {
        const { data: gigArtists } = await db.from('gig_artists')
          .select('artists(name)').eq('gig_id', currentGig.id);
        const names = (gigArtists || []).map(ga => ga.artists?.name).filter(Boolean);
        artistsEl.textContent = names.length > 0 ? '🎸 ' + names.join(' · ') : '';
      } catch(e) {
        artistsEl.textContent = '';
      }
    }
  }

  // ════════════════════════════════════════════
  // VOTER — WACHTRIJ
  // ════════════════════════════════════════════
  async function loadVoterQueue() {
    if (!currentGig) return;

    const { data: playing } = await db.from('requests')
      .select('*, songs(title, original_artist, karaoke_url)')
      .eq('gig_id', currentGig.id).eq('status', 'playing').limit(1);

    const npTitle  = document.getElementById('voter-np-title');
    const npArtist = document.getElementById('voter-np-artist');
    if (playing && playing.length > 0) {
      npTitle.textContent  = playing[0].songs?.title || '—';
      npArtist.textContent = playing[0].songs?.original_artist || '—';

      const karaokeUrl = playing[0].songs?.karaoke_url;
      const showKaraokeBtn = currentGig.allow_karaoke !== false;
      let lyricsBtn = document.getElementById('voter-np-lyrics-btn');
      if (karaokeUrl && showKaraokeBtn) {
        if (!lyricsBtn) {
          lyricsBtn = document.createElement('a');
          lyricsBtn.id = 'voter-np-lyrics-btn';
          lyricsBtn.target = '_blank';
          lyricsBtn.rel = 'noopener noreferrer';
          lyricsBtn.className = 'btn-karaoke-link';
          lyricsBtn.innerHTML = t('btn-open-lyrics');
          npArtist.parentNode.insertBefore(lyricsBtn, npArtist.nextSibling);
        }
        lyricsBtn.href = karaokeUrl;
        lyricsBtn.style.display = 'inline-flex';
      } else {
        if (lyricsBtn) lyricsBtn.style.display = 'none';
      }
    } else {
      npTitle.textContent  = '—';
      npArtist.textContent = (translations[currentLang] || translations.nl)['lbl-now-playing-empty'] || 'Nog niets aan het spelen';
      const lyricsBtn = document.getElementById('voter-np-lyrics-btn');
      if (lyricsBtn) lyricsBtn.style.display = 'none';
    }

    const { data: requests } = await db.from('requests')
      .select('*, songs(title, original_artist), gig_songs(vote_count), voter_sessions(display_name)')
      .eq('gig_id', currentGig.id)
      .in('status', ['approved','queued','pending'])
      .order('created_at', { ascending: true });

    // Track welke requests deze voter al geliked heeft (op request_id)
    const votedRequestIds = new Set();
    if (voterSession) {
      const { data: myVotes } = await db.from('votes')
        .select('request_id').eq('voter_session_id', voterSession.id);
      myVotes?.forEach(v => { if (v.request_id) votedRequestIds.add(v.request_id); });
    }

    // Tel votes live per request
    const requestIds = (requests || []).map(r => r.id);
    let voteMap = {};
    if (requestIds.length > 0) {
      const { data: voteCounts } = await db.from('votes')
        .select('request_id').in('request_id', requestIds);
      (voteCounts || []).forEach(v => {
        if (v.request_id) voteMap[v.request_id] = (voteMap[v.request_id] || 0) + 1;
      });
    }

    const list = document.getElementById('voter-queue-list');
    if (!requests || requests.length === 0) {
      list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 18V5l12-3v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="15" r="3"/></svg><p>${t('empty-queue-voter')}</p></div>`;
      return;
    }

    // Punt 1 FIX: vote werkt nu ook voor custom requests (gigSongId kan null zijn)
    // Punt 16 FIX: toon aanvrager naam
    list.innerHTML = requests.map((req, i) => {
      const voted = votedRequestIds.has(req.id);
      const voteCount = voteMap[req.id] || 0;
      const requester = req.voter_sessions?.display_name;
      const allowVote = currentGig.allow_votes !== false;

      return `<div class="queue-card" data-req="${req.id}" data-gs="${req.gig_song_id || ''}">
        <div class="queue-num">${i + 1}</div>
        <div style="flex:1;min-width:0;">
          <div class="queue-song-title">${req.songs?.title || 'Onbekend'}</div>
          <div class="queue-song-meta">${req.songs?.original_artist || ''}${req.message ? ' · "' + req.message + '"' : ''}</div>
          ${requester ? `<div class="requester-badge">🎵 ${requester}</div>` : ''}
        </div>
        ${allowVote
          ? `<button class="vote-btn ${voted ? 'voted' : ''}" onclick="toggleVote(this,'${req.id}','${req.gig_song_id || ''}','${req.song_id || ''}')">
              <svg viewBox="0 0 24 24" ${voted ? 'fill="currentColor"' : 'fill="none" stroke="currentColor"'}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span>${voteCount}</span>
            </button>`
          : `<span class="badge badge-chrome" style="font-size:10px;">${voteCount} ❤</span>`
        }
      </div>`;
    }).join('');
  }

  // ════════════════════════════════════════════
  // PUNT 4: MIJN AANVRAGEN
  // ════════════════════════════════════════════
  async function loadMyRequests() {
    if (!voterSession || !currentGig) return;
    const { data: myReqs } = await db.from('requests')
      .select('*, songs(title, original_artist)')
      .eq('voter_session_id', voterSession.id)
      .eq('gig_id', currentGig.id)
      .order('created_at', { ascending: false });

    const list = document.getElementById('voter-my-requests-list');
    if (!myReqs || myReqs.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>${t('lbl-no-requests')}</p></div>`;
      return;
    }

    const statusLabel = { pending: t('status-pending'), approved: t('status-approved'), queued: t('status-queued'), playing: t('status-playing'), played: t('status-played'), rejected: t('status-rejected') };
    list.innerHTML = myReqs.map(req => `
      <div class="my-request-card">
        <div style="flex:1;">
          <div class="queue-song-title" style="font-size:17px;">${req.songs?.title || 'Onbekend'}</div>
          <div class="queue-song-meta">${req.songs?.original_artist || ''}</div>
          ${req.message ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;font-style:italic;">"${req.message}"</div>` : ''}
        </div>
        <span class="badge ${req.status === 'played' || req.status === 'approved' ? 'badge-green' : req.status === 'rejected' ? 'badge-red' : 'badge-neon'}">${statusLabel[req.status] || req.status}</span>
      </div>
    `).join('');
  }

  // ════════════════════════════════════════════
  // VOTER — SONGS
  // ════════════════════════════════════════════
  async function loadVoterSongs(query = '') {
    if (!currentGig) return;

    const { data: gigArtists } = await db.from('gig_artists')
      .select('artist_id, artists(name)').eq('gig_id', currentGig.id);
    const artistIds = gigArtists?.map(ga => ga.artist_id) || [];
    const gigIsMultiArtist = artistIds.length > 1;

    // Haal gig_songs op voor gigSongId mapping (voor vote-koppeling)
    const { data: gigSongsDb } = await db.from('gig_songs')
      .select('id, song_id, is_active').eq('gig_id', currentGig.id);
    const gigSongMap = {};
    gigSongsDb?.forEach(gs => { gigSongMap[gs.song_id] = gs; });

    // Modus bepaalt wat zichtbaar is — dit is de enige bron van waarheid bij refresh
    const gigMode = currentGig?.repertoire_mode || 'full';

    // Bouw een map: 'title_lower|artist_lower' → { song_id, songs, gigSongId, artistNames[] }
    // Dedupliceer op titel+artiest zodat dezelfde song van meerdere artiesten als één kaart verschijnt
    const songMap = {};

    if (artistIds.length > 0) {
      const { data: artistSongs } = await db.from('artist_songs')
        .select('song_id, artist_id, artists(name), songs(id, title, original_artist, is_karaoke_available, is_active, song_category)')
        .in('artist_id', artistIds);

      (artistSongs || []).forEach(as => {
        if (!as.songs) return;
        const sid = as.song_id;
        const cat = as.songs.song_category || (as.songs.is_active === false ? 'archived' : 'optional');

        // Gearchiveerde nummers nooit tonen
        if (cat === 'archived') return;

        // gig_songs.is_active=false = handmatig uitgeschakeld
        const gs = gigSongMap[sid];
        if (gs && gs.is_active === false) return;

        // Optionele nummers alleen in 'full' modus
        if (cat !== 'core' && gigMode !== 'full') return;

        // Dedupliceert op titel+genormaliseerde artiest (incl. "The"-matching)
        const key = (as.songs.title || '').toLowerCase() + '|' + _normArtist(as.songs.original_artist);
        if (!songMap[key]) {
          songMap[key] = { song_id: sid, songs: as.songs, gigSongId: gs?.id || null, artistNames: [] };
        } else if (!songMap[key].gigSongId && gs?.id) {
          // Geef voorkeur aan entry met een gig_songs-koppeling
          songMap[key].gigSongId = gs.id;
          songMap[key].song_id   = sid;
        }
        // Voeg artiestnaam toe (vermijd duplicaten)
        const aName = as.artists?.name;
        if (aName && !songMap[key].artistNames.includes(aName)) {
          songMap[key].artistNames.push(aName);
        }
      });
    }

    const allGigSongs = Object.values(songMap);
    const list = document.getElementById('voter-song-list');
    if (allGigSongs.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>${t('empty-songs')}</p></div>`; return;
    }

    const showKaraoke = currentGig.allow_karaoke !== false;
    const filtered = query
      ? allGigSongs.filter(item => item.songs?.title?.toLowerCase().includes(query.toLowerCase()) || item.songs?.original_artist?.toLowerCase().includes(query.toLowerCase()))
      : allGigSongs;

    // Multi-artist gig: gedeelde songs bovenaan, daarna alfabetisch
    filtered.sort((a, b) => {
      if (gigIsMultiArtist) {
        const aShared = a.artistNames.length > 1 ? 0 : 1;
        const bShared = b.artistNames.length > 1 ? 0 : 1;
        if (aShared !== bShared) return aShared - bShared;
      }
      return (a.songs?.title || '').localeCompare(b.songs?.title || '');
    });

    list.innerHTML = filtered.map(item => {
      const isSongShared = gigIsMultiArtist && item.artistNames.length > 1;
      // Artiestnaam alleen tonen bij multi-artist gig
      const performerLabel = gigIsMultiArtist
        ? (isSongShared ? item.artistNames.join(' & ') : (item.artistNames[0] || ''))
        : '';
      return `<div class="song-card${isSongShared ? ' multi-artist' : ''}" data-song-id="${item.song_id}" data-gig-song-id="${item.gigSongId || ''}" data-title="${(item.songs?.title||'').replace(/"/g,'&quot;')}" data-artist="${(item.songs?.original_artist||'').replace(/"/g,'&quot;')}" onclick="openRequestFromCard(this)">`
        + '<div style="display:flex;align-items:center;justify-content:space-between;">'
        + '<div>'
        + '<div class="song-card-title">' + (item.songs?.title || 'Onbekend') + (isSongShared ? ' <span class="multi-artist-badge">★</span>' : '') + '</div>'
        + '<div class="song-card-artist">' + (item.songs?.original_artist || '') + (performerLabel ? ' · <span style="color:var(--neon2);">' + performerLabel + '</span>' : '') + '</div>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:7px;">'
        + (item.songs?.is_karaoke_available && showKaraoke ? '<span class="badge badge-karaoke">🎤 Lyrics</span>' : '')
        + '<svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" width="18" height="18"><path d="M9 18l6-6-6-6"/></svg>'
        + '</div></div></div>';
    }).join('');
  }

  // ════════════════════════════════════════════
  // REALTIME
  // ════════════════════════════════════════════
  function subscribeToQueue() {
    if (!currentGig) return;
    if (realtimeChannel) db.removeChannel(realtimeChannel);
    realtimeChannel = db.channel('queue-' + currentGig.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `gig_id=eq.${currentGig.id}` }, () => {
        loadVoterQueue();
        loadMyRequests();
        if (currentUser) { loadArtistQueue(); loadArtistRequests(); }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => {
        loadVoterQueue();
        if (currentUser) loadArtistQueue();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gig_messages', filter: `gig_id=eq.${currentGig.id}` }, () => {
        if (currentUser) loadArtistInbox();
      })
      .subscribe();
  }

  function subscribeArtistRealtime() {
    if (!currentGig) return;
    if (realtimeChannel) db.removeChannel(realtimeChannel);
    realtimeChannel = db.channel('artist-' + currentGig.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `gig_id=eq.${currentGig.id}` }, () => {
        loadArtistQueue();
        loadArtistRequests();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => {
        loadArtistQueue();
        loadArtistRequests();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gig_songs' }, () => {
        loadArtistQueue();
        loadArtistRequests();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gig_messages', filter: `gig_id=eq.${currentGig.id}` }, () => {
        loadArtistInbox();
      })
      .subscribe();
  }

  // ════════════════════════════════════════════
  // PUNT 1 FIX: VOTING werkt ook voor custom aanvragen
  // ════════════════════════════════════════════
  async function toggleVote(btn, requestId, gigSongId, songId) {
    if (!voterSession) { showToast('Sessie verlopen', 'error'); return; }
    if (!currentGig?.allow_votes) { showToast('Stemmen is uitgeschakeld', 'error'); return; }
    if (btn.disabled) return;

    btn.disabled = true;
    const voted = btn.classList.contains('voted');
    const countEl = btn.querySelector('span');

    const cleanGigSongId = (gigSongId && gigSongId !== 'null' && gigSongId !== '') ? gigSongId : null;
    const cleanRequestId  = (requestId  && requestId  !== 'null' && requestId  !== '') ? requestId  : null;

    if (!voted) {
      const voteObj = {
        voter_session_id: voterSession.id,
        voter_name: voterSession.display_name || null,
        request_id: cleanRequestId,
        gig_song_id: cleanGigSongId
      };

      const { error } = await db.from('votes').insert(voteObj);
      if (error) {
        if (error.code === '23505') {
          showToast('Je hebt al gestemd! ❤️', 'error');
        } else {
          console.error('Vote error:', error);
          showToast('Stemmen mislukt: ' + (error.message || error.code), 'error');
        }
        btn.disabled = false;
        return;
      }
      btn.classList.add('voted');
      btn.querySelector('svg').setAttribute('fill', 'currentColor');
      btn.querySelector('svg').removeAttribute('stroke');
      countEl.textContent = parseInt(countEl.textContent) + 1;
      showToast('Stem uitgebracht! ❤️', 'success');
    } else {
      let deleteQ = db.from('votes').delete().eq('voter_session_id', voterSession.id);
      if (cleanRequestId) {
        deleteQ = deleteQ.eq('request_id', cleanRequestId);
      } else if (cleanGigSongId) {
        deleteQ = deleteQ.eq('gig_song_id', cleanGigSongId);
      }
      await deleteQ;
      btn.classList.remove('voted');
      btn.querySelector('svg').setAttribute('fill', 'none');
      btn.querySelector('svg').setAttribute('stroke', 'currentColor');
      countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
      showToast('Stem ingetrokken', '');
    }

    btn.disabled = false;
    // Refresh artiest queue zodat die meteen de nieuwe telling ziet
    if (currentUser) { loadArtistQueue(); loadArtistRequests(); }
  }

  // ════════════════════════════════════════════
  // REQUEST MODAL
  // ════════════════════════════════════════════
  function openRequestFromCard(el) {
    openRequestModal(el.dataset.title, el.dataset.artist, el.dataset.songId, el.dataset.gigSongId || null);
  }

  function openRequestModal(title, artist, songId, gigSongId) {
    currentRequestSong = { title, artist, songId, gigSongId };
    document.getElementById('modal-req-title').textContent = title;
    document.getElementById('modal-req-artist').textContent = artist;
    document.getElementById('request-message').value = '';
    document.getElementById('modal-request').classList.add('open');
  }

  async function submitRequest() {
    if (!currentRequestSong || !currentGig || !voterSession) { showToast('Sessie verlopen', 'error'); return; }
    const message = document.getElementById('request-message').value.trim() || null;

    const { data: existing } = await db.from('requests')
      .select('id, gig_song_id, vote_count')
      .eq('gig_id', currentGig.id)
      .eq('song_id', currentRequestSong.songId)
      .in('status', ['pending','approved','queued','playing'])
      .limit(1);

    if (existing && existing.length > 0) {
      const req = existing[0];
      const voteObj = {
        voter_session_id: voterSession.id,
        voter_name: voterSession.display_name,
        request_id: req.id
      };
      if (req.gig_song_id || currentRequestSong.gigSongId) {
        voteObj.gig_song_id = req.gig_song_id || currentRequestSong.gigSongId;
      }
      const { error: voteErr } = await db.from('votes').insert(voteObj);
      if (voteErr && voteErr.code === '23505') {
        showToast('Je hebt dit nummer al gestemd!', 'error');
      } else if (voteErr) {
        showToast('Aanvraag mislukt', 'error');
      } else {
        showToast('Nummer al in wachtrij — stem uitgebracht! ❤️', 'success');
      }
    } else {
      const { error } = await db.from('requests').insert({
        gig_id: currentGig.id,
        song_id: currentRequestSong.songId,
        gig_song_id: currentRequestSong.gigSongId || null,
        voter_session_id: voterSession.id,
        message,
        status: 'pending'
      });
      if (error) {
        showToast('Aanvraag mislukt', 'error');
      } else {
        showToast('Aanvraag verzonden! 🎵', 'success');
        loadMyRequests(); // update "mijn aanvragen"
      }
    }
    closeModal('modal-request');
  }

  // ════════════════════════════════════════════
  // BERICHTEN (voter)
  // ════════════════════════════════════════════
  async function sendMessage() {
    const text = document.getElementById('voter-msg-text').value.trim();
    if (!text) { showToast('Schrijf eerst een bericht', 'error'); return; }
    if (!currentGig || !voterSession) { showToast('Sessie verlopen', 'error'); return; }

    const { error } = await db.from('gig_messages').insert({
      gig_id: currentGig.id,
      voter_session_id: voterSession.id,
      sender_name: voterSession.display_name,
      message: text
    });
    if (error) { showToast('Kon bericht niet versturen', 'error'); return; }
    document.getElementById('voter-msg-text').value = '';
    showToast('Bericht verstuurd! 💬', 'success');
  }

  // ════════════════════════════════════════════
  // PUNT 5 FIX: COMMENTS/REVIEW — laad gespeelde songs voor dropdown
  // ════════════════════════════════════════════
  async function loadComments() {
    if (!currentGig) return;

    // Laad gespeelde songs voor review dropdown (punt 5 + punt 7)
    const { data: playedSongs } = await db.from('requests')
      .select('songs(id, title, original_artist)')
      .eq('gig_id', currentGig.id)
      .in('status', ['played', 'playing', 'approved', 'queued']);

    const select = document.getElementById('comment-song-select');
    if (select) {
      const seen = new Set();
      select.innerHTML = '<option value="">— Algemene review over het optreden —</option>';
      playedSongs?.forEach(r => {
        if (r.songs && !seen.has(r.songs.id)) {
          seen.add(r.songs.id);
          const opt = document.createElement('option');
          opt.value = r.songs.id;
          opt.textContent = `${r.songs.title} — ${r.songs.original_artist || ''}`;
          select.appendChild(opt);
        }
      });
    }

    const { data: comments } = await db.from('comments')
      .select('*').eq('gig_id', currentGig.id).eq('is_approved', true)
      .order('created_at', { ascending: false });

    const list = document.getElementById('voter-comments-list');
    if (!comments || comments.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>${t('empty-reviews')}</p></div>`; return;
    }
    list.innerHTML = comments.map(c => {
      const stars = c.rating ? '★'.repeat(c.rating) + '☆'.repeat(5 - c.rating) : '';
      return `<div class="comment-card">
        <div class="comment-header">
          <div class="comment-author">${c.author_name}</div>
          ${stars ? `<div class="stars">${stars}</div>` : ''}
        </div>
        ${c.song_title ? `<div style="font-size:11px;color:var(--neon2);margin-bottom:4px;font-family:var(--font-mono);">🎵 ${c.song_title}</div>` : ''}
        <div class="comment-text">${c.content}</div>
        <div class="comment-date">${new Date(c.created_at).toLocaleString('nl-NL')}</div>
      </div>`;
    }).join('');
  }

  async function submitComment() {
    const author = document.getElementById('comment-author').value.trim();
    const text   = document.getElementById('comment-text').value.trim();
    const songId = document.getElementById('comment-song-select')?.value || null;
    if (!author) { showToast('Vul je naam in', 'error'); return; }
    if (!text)   { showToast('Schrijf een reactie', 'error'); return; }
    if (!currentGig) { showToast('Geen gig gevonden', 'error'); return; }

    // Haal songtitel op als geselecteerd
    let songTitle = null;
    if (songId) {
      const opt = document.getElementById('comment-song-select');
      const sel = opt?.querySelector(`option[value="${songId}"]`);
      songTitle = sel?.textContent || null;
    }

    const { error } = await db.from('comments').insert({
      gig_id: currentGig.id, author_name: author,
      content: text, rating: currentRating || null,
      song_id: songId || null,
      song_title: songTitle
    });
    if (error) { showToast('Kon review niet plaatsen', 'error'); return; }
    document.getElementById('comment-author').value = '';
    document.getElementById('comment-text').value = '';
    setRating(0);
    showToast('Review geplaatst! ⭐', 'success');
    loadComments();
  }

  // ════════════════════════════════════════════
  // ARTIEST — DATA LADEN
  // ════════════════════════════════════════════
  async function loadArtistData() {
    if (!currentUser) return;

    const _uaId = currentUser.id;
    let uArtists = null;
    if (_uaId) {
      const { data: _uaData, error: uaErr } = await db.from('user_artists')
        .select('artist_id, artists(*)').eq('user_id', _uaId).limit(1);
      if (uaErr) console.warn('user_artists query failed:', uaErr.message);
      else uArtists = _uaData;
    }
    if (uArtists?.[0]) {
      currentArtist = uArtists[0].artists;
      document.getElementById('artist-display-name').textContent = currentArtist.name || currentUser.name || 'Artiest';
    } else {
      document.getElementById('artist-display-name').textContent = currentUser.name || 'Artiest';
    }

    const _ugId = currentUser.id;
    let userGigs = null;
    if (_ugId) {
      const { data: _ugData, error: ugErr } = await db.from('user_gigs')
        .select('gig_id, gigs(*)').eq('user_id', _ugId);
      if (ugErr) console.warn('user_gigs query failed:', ugErr.message);
      else userGigs = _ugData;
    }

    // Fallback: artiest is via gig_artists aan een gig gekoppeld maar heeft geen user_gigs-rij
    if ((!userGigs || userGigs.length === 0) && currentArtist?.id) {
      const { data: gaRows } = await db.from('gig_artists')
        .select('gig_id, gigs(*)').eq('artist_id', currentArtist.id);
      if (gaRows?.length) {
        userGigs = gaRows.filter(r => r.gigs);
      }
    }

    // Smart sort: live > upcoming (most recent) > finished
    const _sortedGigs = (userGigs || [])
      .filter(ug => ug.gigs)
      .sort((a, b) => {
        const order = { live: 0, upcoming: 1, finished: 2 };
        return (order[a.gigs.status] ?? 3) - (order[b.gigs.status] ?? 3)
          || (b.gigs.gig_date || '').localeCompare(a.gigs.gig_date || '');
      });

    // Herstel gecachte gig, anders gebruik de eerste gesorteerde
    if (!currentGig && _sortedGigs.length > 0) {
      const cachedId = (() => { try { return localStorage.getItem('jukestage_active_gig'); } catch(e) { return null; } })();
      const cachedGig = cachedId && _sortedGigs.find(ug => String(ug.gigs.id) === String(cachedId));
      currentGig = cachedGig ? cachedGig.gigs : _sortedGigs[0].gigs;
    }

    if (currentGig) {
      updateActiveGigPill(currentGig);
      document.getElementById('artist-gig-name').textContent = currentGig.name || currentGig.venue || t('lbl-no-active-gig') || 'Naamloze gig';
      if (currentGig.status === 'live') {
        document.getElementById('artist-gig-status').style.display = 'inline-flex';
      }

      const { data: gigArtists } = await db.from('gig_artists')
        .select('artists(name)').eq('gig_id', currentGig.id);
      if (gigArtists && gigArtists.length > 0) {
        const names = gigArtists.map(ga => ga.artists?.name).filter(Boolean).join(' · ');
        document.getElementById('artist-gig-name').textContent =
          (currentGig.name || currentGig.venue || 'Naamloze gig') + ' · 🎸 ' + names;
      }

      // Toon wissel-knop alleen als er meerdere gigs zijn
      const switchEl = document.getElementById('active-gig-pill-switch');
      if (switchEl) switchEl.style.display = _sortedGigs.length > 1 ? 'block' : 'none';

      loadArtistQueue();
      loadArtistRequests();
      loadArtistSongbook();
      loadArtistInbox();
      loadGigSettings();
      loadArtistHistory();
      subscribeArtistRealtime();
    } else {
      // Punt 13: geen gig — toon "nieuwe gig aanmaken"
      document.getElementById('new-gig-banner').style.display = 'flex';
      document.getElementById('artist-gig-name').textContent = t('lbl-no-active-gig') + ' — ' + t('lbl-create-one');
      updateActiveGigPill(null);
    }

    // Toon altijd "nieuwe gig" knop voor admin
    if (currentUser.role === 'admin') {
      document.getElementById('new-gig-banner').style.display = 'flex';
    }
  }

  // ════════════════════════════════════════════
  // ACTIVE GIG PILL — bijwerken & wisselen
  // ════════════════════════════════════════════
  function updateActiveGigPill(gig) {
    const nameEl  = document.getElementById('active-gig-pill-name');
    const labelEl = document.getElementById('active-gig-pill-label');
    const dotEl   = document.getElementById('active-gig-pill-dot');
    if (!nameEl) return;
    if (!gig) {
      nameEl.textContent  = 'Geen actieve gig';
      labelEl.textContent = 'GIG';
      labelEl.className   = 'active-gig-pill-label inactive';
      dotEl.className     = 'active-gig-pill-dot inactive';
      return;
    }
    const isLive = gig.status === 'live';
    nameEl.textContent  = gig.name || gig.venue || 'Naamloze gig';
    labelEl.textContent = isLive ? '● LIVE' : (gig.status === 'upcoming' ? 'GEPLAND' : 'GIG');
    labelEl.className   = 'active-gig-pill-label' + (isLive ? '' : ' inactive');
    dotEl.className     = 'active-gig-pill-dot'   + (isLive ? '' : ' inactive');
  }

  async function openGigSwitchModal() {
    if (!currentUser) return;
    document.getElementById('modal-gig-switch').classList.add('open');
    const listEl = document.getElementById('gig-switch-list');
    listEl.innerHTML = '<div class="empty-state"><p>Laden...</p></div>';

    const { data: userGigs } = await db.from('user_gigs')
      .select('gig_id, gigs(*)').eq('user_id', currentUser.id);
    const sorted = (userGigs || []).filter(ug => ug.gigs).sort((a, b) => {
      const order = { live: 0, upcoming: 1, finished: 2 };
      return (order[a.gigs.status] ?? 3) - (order[b.gigs.status] ?? 3)
        || (b.gigs.gig_date || '').localeCompare(a.gigs.gig_date || '');
    });

    if (sorted.length === 0) { listEl.innerHTML = '<div class="empty-state"><p>Geen gigs gevonden</p></div>'; return; }

    listEl.innerHTML = '';
    sorted.forEach(function(ug, i) {
      const g = ug.gigs;
      const isActive = currentGig && currentGig.id === g.id;
      const statusColor = g.status === 'live' ? 'var(--neon)' : g.status === 'upcoming' ? 'var(--neon2)' : 'var(--muted)';
      const statusLabel = g.status === 'live' ? '&#9679; LIVE' : g.status === 'upcoming' ? 'GEPLAND' : 'AFGELOPEN';
      const datePart = g.gig_date ? new Date(g.gig_date).toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}) : '';
      const meta = [g.venue, datePart].filter(Boolean).join(' · ');
      const div = document.createElement('div');
      div.className = 'gig-pick-card';
      if (isActive) div.style.cssText = 'border-color:var(--neon);background:linear-gradient(135deg,#1e0e06,#271508);';
      div.innerHTML = '<div style="flex:1;min-width:0;">'
        + '<div class="gig-pick-name"' + (isActive ? ' style="color:var(--neon2);"' : '') + '>' + (g.name || 'Naamloze gig') + '</div>'
        + (meta ? '<div class="gig-pick-meta">' + meta + '</div>' : '')
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">'
        + '<span style="font-family:var(--font-mono);font-size:9px;color:' + statusColor + ';letter-spacing:1px;">' + statusLabel + '</span>'
        + (isActive ? '<span style="font-family:var(--font-retro);font-size:9px;color:var(--neon);letter-spacing:1px;">ACTIEF</span>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16" style="color:var(--muted);"><polyline points="9 18 15 12 9 6"/></svg>')
        + '</div>';
      if (!isActive) {
        div.addEventListener('click', (function(gigId) { return function() { switchActiveGig(gigId); closeModal('modal-gig-switch'); }; })(g.id));
      }
      listEl.appendChild(div);
    });
  }
  // ════════════════════════════════════════════
  function openNewGigModal() {
    document.getElementById('new-gig-name').value = '';
    document.getElementById('new-gig-venue').value = '';
    const _now = new Date(); const _local = new Date(_now.getTime() - _now.getTimezoneOffset()*60000).toISOString().slice(0,16);
    document.getElementById('new-gig-date').value = _local;
    document.getElementById('new-gig-artist-search').value = '';
    document.getElementById('new-gig-artist-results').style.display = 'none';
    newGigArtists = currentArtist ? [{ id: currentArtist.id, name: currentArtist.name }] : [];
    renderArtistPills('new-gig');
    document.getElementById('modal-new-gig').classList.add('open');
  }

  async function createNewGig() {
    const name  = document.getElementById('new-gig-name').value.trim();
    const venue = document.getElementById('new-gig-venue').value.trim();
    const date  = document.getElementById('new-gig-date').value;
    if (!name) { showToast('Vul een gig naam in', 'error'); return; }
    if (!venue) { showToast('Vul een locatie in', 'error'); return; }

    // Genereer QR token
    const qrToken = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

    const gigDate = date ? new Date(date).toISOString() : new Date().toISOString();
    const gigVenue = venue || '—';
    const isPublic   = document.getElementById('new-gig-public')?.classList.contains('on') ?? false;
    const locType    = ['physical','online','hybrid'].find(t => document.getElementById(`new-loc-${t}`)?.classList.contains('active')) || 'physical';
    const locAddress = document.getElementById('new-location-address')?.value.trim() || null;
    const locLat     = parseFloat(document.getElementById('new-location-lat')?.value) || null;
    const locLng     = parseFloat(document.getElementById('new-location-lng')?.value) || null;
    const streamUrl  = document.getElementById('new-stream-url')?.value.trim() || null;

    const { data: gig, error } = await db.from('gigs').insert({
      name,
      venue: gigVenue,
      gig_date: gigDate,
      artist: currentArtist?.name || currentUser?.name || name,
      status: 'upcoming',
      is_active: true,
      allow_requests: true,
      allow_votes: true,
      allow_karaoke: true,
      is_public: isPublic,
      location_type: locType,
      location_address: locAddress,
      location_lat: locLat,
      location_lng: locLng,
      stream_url: streamUrl,
      created_at: new Date().toISOString()
    }).select().single();

    if (error) { showToast('Gig aanmaken mislukt: ' + error.message, 'error'); return; }

    // Koppel gig aan user
    await db.from('user_gigs').insert({ user_id: currentUser.id, gig_id: gig.id });

    // Koppel artiesten aan gig
    for (const a of newGigArtists) {
      await db.from('gig_artists').insert({ gig_id: gig.id, artist_id: a.id });
    }

    closeModal('modal-new-gig');
    showToast('Gig aangemaakt! 🎸', 'success');
    currentGig = gig;
    try { localStorage.setItem('jukestage_active_gig', gig.id); } catch(e) {}
    loadArtistData();
  }

  // ════════════════════════════════════════════
  // PUNT 6 FIX: DRAG & DROP met TOUCH SUPPORT (Android/ASUS tablet)
  // ════════════════════════════════════════════
  let draggedId = null;
  let touchDragEl = null;
  let touchDragClone = null;
  let touchDragOffsetY = 0;

  function dragStart(e) {
    draggedId = e.currentTarget.dataset.id;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }

  function dragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = e.currentTarget;
    if (card.dataset.id !== draggedId) card.classList.add('drag-over');
  }

  function dragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  async function dragDrop(e) {
    e.preventDefault();
    const targetCard = e.currentTarget;
    targetCard.classList.remove('drag-over');
    const targetId = targetCard.dataset.id;
    if (!draggedId || draggedId === targetId) return;
    reorderCards(draggedId, targetId);
    draggedId = null;
  }

  function reorderCards(fromId, toId) {
    const list = document.getElementById('artist-queue-list');
    const cards = [...list.querySelectorAll('.queue-card[data-id]')];
    const fromEl = cards.find(c => c.dataset.id === fromId);
    const toEl   = cards.find(c => c.dataset.id === toId);
    if (!fromEl || !toEl) return;
    const fromIdx = cards.indexOf(fromEl);
    const toIdx   = cards.indexOf(toEl);
    if (fromIdx < toIdx) toEl.after(fromEl);
    else toEl.before(fromEl);
    // Hernummeren
    [...list.querySelectorAll('.queue-card[data-id]')].forEach((c, i) => {
      const numEl = c.querySelector('.queue-num');
      if (numEl && !numEl.classList.contains('playing')) numEl.textContent = i + 1;
    });
    // Sla nieuwe volgorde op als custom order (song_ids)
    queueCustomOrder = [...list.querySelectorAll('.queue-card[data-id]')].map(c => c.dataset.id);
    // Schakel automatisch over naar eigen volgorde
    if (queueSortMode !== 'custom') {
      queueSortMode = 'custom';
      ['chrono','popular','custom'].forEach(m => {
        const btn = document.getElementById('sort-btn-' + m);
        if (btn) btn.classList.toggle('active', m === 'custom');
      });
    }
    showToast('Volgorde aangepast ✓', 'success');
  }

  // Touch drag voor Android (punt 6)
  function setupTouchDrag(handle, card) {
    handle.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      draggedId = card.dataset.id;
      const touch = e.touches[0];
      const rect = card.getBoundingClientRect();
      touchDragOffsetY = touch.clientY - rect.top;
      touchDragEl = card;
      card.classList.add('touch-dragging');

      // Clone voor visueel sleepeffect
      touchDragClone = card.cloneNode(true);
      touchDragClone.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;z-index:1000;opacity:0.9;pointer-events:none;transition:none;border-color:var(--neon2);`;
      document.body.appendChild(touchDragClone);
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
      if (!touchDragEl || !touchDragClone) return;
      e.preventDefault();
      const touch = e.touches[0];
      const newTop = touch.clientY - touchDragOffsetY;
      touchDragClone.style.top = newTop + 'px';

      // Vind kaart waarover we slepen
      const list = document.getElementById('artist-queue-list');
      const cards = [...list.querySelectorAll('.queue-card[data-id]:not(.touch-dragging)')];
      cards.forEach(c => c.classList.remove('drag-over'));
      const target = cards.find(c => {
        const r = c.getBoundingClientRect();
        return touch.clientY > r.top && touch.clientY < r.bottom;
      });
      if (target) target.classList.add('drag-over');
    }, { passive: false });

    handle.addEventListener('touchend', (e) => {
      if (!touchDragEl || !touchDragClone) return;
      const touch = e.changedTouches[0];
      const list = document.getElementById('artist-queue-list');
      const cards = [...list.querySelectorAll('.queue-card[data-id]:not(.touch-dragging)')];
      cards.forEach(c => c.classList.remove('drag-over'));
      const target = cards.find(c => {
        const r = c.getBoundingClientRect();
        return touch.clientY > r.top && touch.clientY < r.bottom;
      });

      touchDragEl.classList.remove('touch-dragging');
      document.body.removeChild(touchDragClone);
      touchDragClone = null;

      if (target && target.dataset.id !== draggedId) {
        reorderCards(draggedId, target.dataset.id);
      }

      touchDragEl = null;
      draggedId = null;
    });
  }

  // ════════════════════════════════════════════
  // ARTIEST — WACHTRIJ
  // ════════════════════════════════════════════
  async function loadArtistQueue() {
    if (!currentGig) return;
    const { data: requests } = await db.from('requests')
      .select('*, songs(title, original_artist, ug_tabs), gig_songs(id, vote_count), voter_sessions(display_name)')
      .eq('gig_id', currentGig.id)
      .in('status', ['approved','queued','playing'])
      .order('created_at', { ascending: true });

    const list = document.getElementById('artist-queue-list');

    if (!requests || requests.length === 0) {
      document.getElementById('stat-queue').textContent = 0;
      list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg><p>${t('empty-queue-artist')}</p></div>`;
      return;
    }

    // Tel votes live vanuit de votes tabel per request, inclusief namen
    const requestIds = requests.map(r => r.id);
    const { data: voteCounts } = await db.from('votes')
      .select('request_id, voter_name')
      .in('request_id', requestIds);

    const voteMap  = {};  // request_id -> count
    const voterMap = {};  // request_id -> [namen]
    (voteCounts || []).forEach(v => {
      if (!v.request_id) return;
      voteMap[v.request_id] = (voteMap[v.request_id] || 0) + 1;
      if (!voterMap[v.request_id]) voterMap[v.request_id] = [];
      if (v.voter_name) voterMap[v.request_id].push(v.voter_name);
    });

    // Groepeer requests per song_id
    const groups = {};       // song_id -> { song, reqs[], firstCreatedAt, totalVotes, voters[], messages[], isPlaying }
    const groupOrder = [];   // song_ids in chronologische volgorde (eerste aanvraag)
    requests.forEach(req => {
      const sid = req.song_id;
      if (!sid) return;
      if (!groups[sid]) {
        groups[sid] = {
          songId:       sid,
          song:         req.songs,
          ug:           req.songs?.ug_tabs,
          reqs:         [],
          firstCreatedAt: req.created_at,
          totalVotes:   0,
          allVoterNames: [],
          requesters:   [],
          messages:     [],
          isPlaying:    false,
        };
        groupOrder.push(sid);
      }
      const g = groups[sid];
      g.reqs.push(req);
      g.totalVotes += voteMap[req.id] || 0;
      (voterMap[req.id] || []).forEach(n => g.allVoterNames.push(n));
      if (req.voter_sessions?.display_name) g.requesters.push(req.voter_sessions.display_name);
      if (req.message) g.messages.push({ name: req.voter_sessions?.display_name, msg: req.message });
      if (req.status === 'playing') g.isPlaying = true;
    });

    // Embed voterMap on window for popup (per group: use songId as key)
    window._voterMap = {};
    groupOrder.forEach(sid => {
      window._voterMap[sid] = groups[sid].allVoterNames;
    });

    document.getElementById('stat-queue').textContent = groupOrder.length;

    // Verwijder song_ids uit queueCustomOrder die niet meer in de queue zitten
    queueCustomOrder = queueCustomOrder.filter(sid => groups[sid]);
    // Voeg nieuwe song_ids toe aan het einde van queueCustomOrder
    groupOrder.forEach(sid => { if (!queueCustomOrder.includes(sid)) queueCustomOrder.push(sid); });

    // Sorteer de groepen op basis van queueSortMode
    let sortedIds = [...groupOrder];
    if (queueSortMode === 'popular') {
      sortedIds.sort((a, b) => groups[b].totalVotes - groups[a].totalVotes || groups[a].firstCreatedAt.localeCompare(groups[b].firstCreatedAt));
    } else if (queueSortMode === 'custom') {
      sortedIds = queueCustomOrder.filter(sid => groups[sid]);
    }
    // 'chrono' = standaard groupOrder (op volgorde van eerste aanvraag)

    list.innerHTML = sortedIds.map((sid, i) => {
      const g = groups[sid];
      const isPlaying = g.isPlaying;
      const multiReq  = g.reqs.length > 1;
      const reqNames  = [...new Set(g.requesters)].join(', ');
      const votes     = g.totalVotes;

      return `<div class="queue-card ${isPlaying ? 'playing' : ''}" data-id="${sid}" draggable="true"
          ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="dragDrop(event)" ondragleave="dragLeave(event)">
        ${!isPlaying ? `<div class="drag-handle" id="dh-${sid}" title="Versleep">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>
        </div>` : ''}
        <div class="queue-num ${isPlaying ? 'playing' : ''}">${isPlaying ? '▶' : i + 1}</div>
        <div style="flex:1;min-width:0;">
          <div class="queue-song-title">${g.song?.title || 'Onbekend'}</div>
          <div class="queue-song-meta">${g.song?.original_artist || ''} · <span
            style="cursor:${votes > 0 ? 'pointer' : 'default'};color:${votes > 0 ? 'var(--neon3)' : 'inherit'};text-decoration:${votes > 0 ? 'underline dotted' : 'none'};"
            onclick="${votes > 0 ? `showVoters(event,'${sid}')` : ''}"
            title="${votes > 0 ? 'Klik om te zien wie gestemd heeft' : ''}"
          >${votes} ${t('lbl-votes')}</span></div>
          ${reqNames ? `<div class="requester-badge">${multiReq ? '👥' : '🎵'} ${t('lbl-requested-by')} ${reqNames}${multiReq ? ` <span class="multi-req-badge">${g.reqs.length}×</span>` : ''}</div>` : ''}
          ${g.messages.map(m => `<div class="queue-message-item">${m.name ? `<strong>${m.name}:</strong> ` : ''}"${m.msg}"</div>`).join('')}
          ${g.ug ? `<a href="${g.ug}" target="_blank" class="ug-link" onclick="event.stopPropagation()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77A5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
            Tabs / Akkoorden
          </a>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;">
          ${isPlaying
            ? `<button class="btn btn-primary btn-icon" onclick="markPlayed('${sid}')" title="Gespeeld" style="width:auto;padding:6px 12px;font-size:11px;">${t('lbl-played')}</button>`
            : `<button class="btn btn-primary btn-icon" onclick="playNow('${sid}')" title="Nu spelen">
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </button>
              <button class="btn btn-secondary btn-icon" onclick="skipSong('${sid}')" title="Overslaan">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
              </button>`}
        </div>
      </div>`;
    }).join('');

    // Touch drag instellen na render
    sortedIds.forEach(sid => {
      const g = groups[sid];
      if (!g.isPlaying) {
        const handle = document.getElementById(`dh-${sid}`);
        const card   = list.querySelector(`[data-id="${sid}"]`);
        if (handle && card) setupTouchDrag(handle, card);
      }
    });
  }

  function setQueueSort(mode) {
    queueSortMode = mode;
    ['chrono','popular','custom'].forEach(m => {
      const btn = document.getElementById('sort-btn-' + m);
      if (btn) btn.classList.toggle('active', m === mode);
    });
    loadArtistQueue();
  }

  // ════════════════════════════════════════════
  // ARTIEST — AANVRAGEN (punt 14)
  // ════════════════════════════════════════════
  async function loadArtistRequests() {
    if (!currentGig) return;
    const { data: requests } = await db.from('requests')
      .select('*, songs(title, original_artist), voter_sessions(display_name), gig_songs(vote_count)')
      .eq('gig_id', currentGig.id).eq('status', 'pending')
      .order('created_at', { ascending: false });

    const list = document.getElementById('artist-requests-list');
    const badge = document.getElementById('requests-count-badge');
    if (badge) badge.textContent = `${requests?.length || 0} ${t('lbl-new')}`;

    // Vul admin direct-toevoegen dropdown
    const adminSelect = document.getElementById('admin-add-song-select');
    if (adminSelect && allSongs.length > 0) {
      adminSelect.innerHTML = `<option value="" id="lbl-choose-song">${t('lbl-choose-song')}</option>` +
        allSongs.map(s => `<option value="${s.id}">${s.title} — ${s.original_artist || ''}</option>`).join('');
    }

    if (!requests || requests.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>${t('empty-requests')}</p></div>`; return;
    }

    // Tel votes live vanuit de votes tabel per request
    const requestIds = requests.map(r => r.id);
    const { data: voteCounts } = await db.from('votes')
      .select('request_id')
      .in('request_id', requestIds);
    const voteMap = {};
    (voteCounts || []).forEach(v => {
      if (v.request_id) voteMap[v.request_id] = (voteMap[v.request_id] || 0) + 1;
    });

    list.innerHTML = requests.map(req => {
      const name = req.voter_sessions?.display_name || t('lbl-anonymous');
      const time = new Date(req.created_at).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' });
      const liveVotes = voteMap[req.id] || req.gig_songs?.vote_count || 0;
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:9px;" data-req-id="${req.id}">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
          <div>
            <div class="queue-song-title">${req.songs?.title || 'Onbekend'}</div>
            <div class="queue-song-meta">${req.songs?.original_artist || ''} · ${name} · ${time}</div>
          </div>
          <span class="badge badge-neon">${liveVotes} ❤</span>
        </div>
        ${req.message ? `<div style="font-size:12px;color:var(--muted);margin-bottom:10px;font-style:italic;font-family:var(--font-retro);">"${req.message}"</div>` : ''}
        <div class="action-strip">
          <button class="btn btn-primary" style="flex:1;padding:9px;font-size:11px;" onclick="approveRequest('${req.id}',this)">${t('lbl-approve')}</button>
          <button class="btn btn-danger" style="flex:1;padding:9px;font-size:11px;" onclick="rejectRequest('${req.id}',this)">${t('lbl-reject')}</button>
        </div>
      </div>`;
    }).join('');
  }

  // Punt 14: Admin direct toevoegen aan wachtrij
  async function adminAddToQueue() {
    const songId = document.getElementById('admin-add-song-select').value;
    if (!songId || !currentGig) { showToast('Kies eerst een nummer', 'error'); return; }

    // Haal gig_song_id op
    const { data: gigSong } = await db.from('gig_songs')
      .select('id').eq('gig_id', currentGig.id).eq('song_id', songId).limit(1);

    const { error } = await db.from('requests').insert({
      gig_id: currentGig.id,
      song_id: songId,
      gig_song_id: gigSong?.[0]?.id || null,
      voter_session_id: null,
      message: 'Direct toegevoegd door artiest',
      status: 'approved'
    });

    if (error) { showToast('Toevoegen mislukt', 'error'); return; }
    showToast('Nummer direct in wachtrij! 🎵', 'success');
    loadArtistQueue();
  }

  // ════════════════════════════════════════════
  // ARTIEST — SONGBOOK
  // ════════════════════════════════════════════
  async function loadArtistSongbook() {
    if (!currentUser) return;

    // Songbook toont alleen songs van de ingelogde artiest zelf — geen gig nodig
    const ownArtistId = currentArtist?.id;
    if (!ownArtistId) {
      allSongs = []; renderSongbook(allSongs); return;
    }

    // Basis song-info (kolommen die zeker bestaan)
    const { data: songs, error: songsErr } = await db.from('artist_songs')
      .select('songs(id,title,original_artist,key_signature,tempo_bpm,genre,ug_tabs,karaoke_url,is_karaoke_available,is_active), artists(name)')
      .eq('artist_id', ownArtistId);

    if (songsErr) { console.error('loadArtistSongbook:', songsErr.message); return; }

    // Probeer song_category op te halen — kolom bestaat mogelijk nog niet
    let categoryMap = {};
    try {
      const songIds = (songs || []).map(s => s.songs?.id).filter(Boolean);
      if (songIds.length > 0) {
        const { data: cats, error: catErr } = await db.from('songs')
          .select('id, song_category').in('id', songIds);
        if (!catErr && cats) {
          cats.forEach(c => { categoryMap[c.id] = c.song_category; });
        }
        // Als catErr een 400/PGRST error is, betekent het dat de kolom niet bestaat — stilletjes doorgaan
      }
    } catch(e) { /* kolom bestaat nog niet — prima, we gebruiken fallback */ }

    // Haal gig_songs op voor de actieve gig indien beschikbaar
    const gigSongMap = {};
    if (currentGig) {
      const { data: gigSongsDb } = await db.from('gig_songs')
        .select('id, song_id, is_active').eq('gig_id', currentGig.id);
      gigSongsDb?.forEach(gs => { gigSongMap[gs.song_id] = { id: gs.id, active: gs.is_active }; });
    }

    const seen = new Set();
    allSongs = (songs || []).filter(s => {
      if (!s.songs) return false;
      const key = (s.songs.title || '').toLowerCase() + '|' + _normArtist(s.songs.original_artist);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).map(s => {
      const gs = gigSongMap[s.songs.id];
      // Fallback: als song_category kolom niet bestaat → afleiden van is_active + gig_songs
      const cat = categoryMap[s.songs.id]
        || (s.songs.is_active === false ? 'archived'
          : (gs && gs.active === false ? 'optional' : 'optional'));
      return {
        ...s.songs,
        song_category: cat,
        _artistName: s.artists?.name,
        _gigSongId: gs?.id || null,
        _gigActive: gs ? gs.active : true
      };
    });

    renderSongbook(allSongs);
  }

  function filterSongbook(query) {
    const q = query.toLowerCase();
    // Filter op naam/artiest maar behoud alle niveaus (actief, gig-uit, gearchiveerd)
    const filtered = q ? allSongs.filter(s =>
      s.title?.toLowerCase().includes(q) || s.original_artist?.toLowerCase().includes(q)) : allSongs;
    renderSongbook(filtered);
  }

  function renderSongbook(songs) {
    const list = document.getElementById('artist-songbook-list');
    if (!songs || songs.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>${t('empty-songbook')}</p></div>`; return;
    }

    const core     = songs.filter(s => (s.song_category || 'optional') === 'core');
    const optional = songs.filter(s => (s.song_category || 'optional') === 'optional');
    const archived = songs.filter(s => (s.song_category || 'optional') === 'archived');

    const renderCard = (song) => {
      const cat       = song.song_category || 'optional';
      const safeTitle = (song.title||'').replace(/'/g,"\'").replace(/"/g,'&quot;');
      const isArchived = cat === 'archived';
      const borderColor = cat === 'core' ? 'rgba(255,170,0,0.35)' : cat === 'archived' ? 'var(--border)' : 'var(--border)';
      const opacity = isArchived ? '0.5' : '1';

      return `<div style="background:var(--surface);border:1px solid ${borderColor};border-radius:12px;padding:14px;margin-bottom:9px;opacity:${opacity};">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
              <div class="queue-song-title" style="font-size:18px;">${song.title}</div>
            </div>
            <div class="queue-song-meta">${song.original_artist || ''}${song.key_signature ? ' · ' + song.key_signature : ''}</div>
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
              ${song.genre ? `<span class="badge badge-chrome">${song.genre}</span>` : ''}
              ${song.is_karaoke_available ? '<span class="badge badge-karaoke">🎤 Lyrics</span>' : ''}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;align-items:flex-end;">
            <!-- Categorie-knoppen -->
            <div style="display:flex;gap:4px;" title="Categorie instellen">
              <button class="cat-btn ${cat==='core'?'active-core':''}"    onclick="setSongCategory(${song.id},'core')"     title="⭐ Vast repertoire — altijd beschikbaar">⭐</button>
              <button class="cat-btn ${cat==='optional'?'active-optional':''}" onclick="setSongCategory(${song.id},'optional')"  title="🎵 Optioneel — per gig in te schakelen">🎵</button>
              <button class="cat-btn ${cat==='archived'?'active-archived':''}" onclick="setSongCategory(${song.id},'archived')"  title="🗃 Gearchiveerd — niet aanvraagbaar">🗃</button>
            </div>
            ${cat !== 'archived' ? `<button class="btn btn-ghost btn-icon" onclick="editSong(${song.id})" title="Bewerken" style="margin-top:2px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>` : ''}
          </div>
        </div>
        ${song.ug_tabs ? `<a href="${song.ug_tabs}" target="_blank" class="ug-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77A5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
          Tabs / Akkoorden
        </a>` : ''}
      </div>`;
    };

    let html = '';
    if (core.length > 0) {
      html += `<div style="font-family:var(--font-retro);font-size:9px;letter-spacing:3px;color:var(--neon2);text-transform:uppercase;margin:10px 0 8px;">${t('cat-core').toUpperCase()} (${core.length})</div>`;
      html += core.map(renderCard).join('');
    }
    if (optional.length > 0) {
      html += `<div style="font-family:var(--font-retro);font-size:9px;letter-spacing:3px;color:var(--neon);text-transform:uppercase;margin:14px 0 8px;">${t('cat-optional').toUpperCase()} (${optional.length})</div>`;
      html += optional.map(renderCard).join('');
    }
    if (archived.length > 0) {
      html += `<div style="font-family:var(--font-retro);font-size:9px;letter-spacing:3px;color:var(--muted);text-transform:uppercase;margin:14px 0 8px;">${t('cat-archived').toUpperCase()} (${archived.length})</div>`;
      html += archived.map(renderCard).join('');
    }
    list.innerHTML = html;
  }

  // ════════════════════════════════════════════
  // ARTIEST — INBOX
  // ════════════════════════════════════════════
  async function loadArtistInbox() {
    if (!currentGig) return;
    const { data: messages } = await db.from('gig_messages')
      .select('*').eq('gig_id', currentGig.id)
      .order('created_at', { ascending: false });

    const list = document.getElementById('artist-inbox-list');
    const unread = messages?.filter(m => !m.is_read).length || 0;
    const countEl = document.getElementById('inbox-count');
    if (countEl) { countEl.textContent = unread; countEl.style.display = unread > 0 ? 'inline' : 'none'; }
    document.getElementById('stat-messages').textContent = unread;

    if (!messages || messages.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>${t('empty-messages')}</p></div>`; return;
    }
    list.innerHTML = messages.map(msg => {
      const time = new Date(msg.created_at).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' });
      const initial = (msg.sender_name || 'A')[0].toUpperCase();
      return `<div class="msg-item" style="${!msg.is_read ? 'border-color:var(--neon);' : ''}" data-msg-id="${msg.id}">
        <div class="msg-avatar">${initial}</div>
        <div style="flex:1;">
          <div class="msg-name">${msg.sender_name || t('lbl-anonymous')} · ${time}${!msg.is_read ? ` <span style="color:var(--neon);">● ${t('lbl-new')}</span>` : ''}</div>
          <div class="msg-text">${msg.message}</div>
        </div>
      </div>`;
    }).join('');
  }

  // ════════════════════════════════════════════
  // ARTIEST — HISTORIE (punt 7 + punt 10)
  // ════════════════════════════════════════════
  async function loadArtistHistory() {
    if (!currentUser) return;
    const { data: userGigs } = await db.from('user_gigs')
      .select('gig_id, gigs(*)').eq('user_id', currentUser.id || 0);

    const list = document.getElementById('artist-history-list');
    if (!userGigs || userGigs.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>${t('empty-history')}</p></div>`; return;
    }

    const gigData = await Promise.all(userGigs.map(async (ug) => {
      const gig = ug.gigs;
      const [{ count: played }, { count: requested }, { count: msgs }] = await Promise.all([
        db.from('requests').select('*', { count: 'exact', head: true }).eq('gig_id', gig.id).eq('status', 'played'),
        db.from('requests').select('*', { count: 'exact', head: true }).eq('gig_id', gig.id),
        db.from('gig_messages').select('*', { count: 'exact', head: true }).eq('gig_id', gig.id)
      ]);
      return { gig, played: played || 0, requested: requested || 0, msgs: msgs || 0 };
    }));

    _allGigData = gigData.filter(d => d.gig != null);
    renderHistoryList();
  }

  async function openGigHistory(gigId, gigName) {
    document.getElementById('modal-history-title').textContent = gigName;
    const contentEl = document.getElementById('modal-history-content');
    contentEl.innerHTML = `<div style="color:var(--muted);font-family:var(--font-retro);text-align:center;padding:20px;">Laden...</div>`;
    document.getElementById('modal-history').classList.add('open');

    const [{ data: played }, { data: messages }, { data: comments }, { data: allVotes }] = await Promise.all([
      db.from('requests').select('id, message, status, songs(title, original_artist), voter_sessions(display_name)')
        .eq('gig_id', gigId).eq('status', 'played').order('updated_at', { ascending: true }),
      db.from('gig_messages').select('*').eq('gig_id', gigId).order('created_at', { ascending: true }),
      db.from('comments').select('*').eq('gig_id', gigId).order('created_at', { ascending: false }),
      // Haal alle votes op voor deze gig via requests
      db.from('votes').select('request_id, voter_name, gig_song_id')
        .in('request_id',
          // subquery workaround: haal eerst request-ids op
          (await db.from('requests').select('id').eq('gig_id', gigId)).data?.map(r => r.id) || []
        )
    ]);

    // Bouw een map: request_id -> { song title, voters[] }
    // Combineer met alle requests (ook niet gespeeld) voor volledig stemoverzicht
    const { data: allRequests } = await db.from('requests')
      .select('id, songs(title, original_artist)')
      .eq('gig_id', gigId)
      .not('status', 'eq', 'rejected');

    const votesByRequest = {};
    (allVotes || []).forEach(v => {
      if (!v.request_id) return;
      if (!votesByRequest[v.request_id]) votesByRequest[v.request_id] = [];
      if (v.voter_name) votesByRequest[v.request_id].push(v.voter_name);
    });

    // Sorteer op stemcount
    const votedRequests = (allRequests || [])
      .map(r => ({ ...r, voters: votesByRequest[r.id] || [] }))
      .filter(r => r.voters.length > 0)
      .sort((a, b) => b.voters.length - a.voters.length);

    // ── Tabs bovenaan de modal ──
    const tabHtml = `
      <div style="display:flex;gap:6px;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:12px;">
        <button onclick="historyTab('songs',this)"   id="htab-songs"   style="flex:1;padding:7px 4px;font-family:var(--font-retro);font-size:10px;letter-spacing:1px;cursor:pointer;border-radius:8px;border:none;background:var(--neon);color:#000;text-transform:uppercase;">🎵 Songs</button>
        <button onclick="historyTab('votes',this)"   id="htab-votes"   style="flex:1;padding:7px 4px;font-family:var(--font-retro);font-size:10px;letter-spacing:1px;cursor:pointer;border-radius:8px;border:none;background:var(--surface2);color:var(--muted);text-transform:uppercase;">❤ Likes</button>
        <button onclick="historyTab('messages',this)" id="htab-messages" style="flex:1;padding:7px 4px;font-family:var(--font-retro);font-size:10px;letter-spacing:1px;cursor:pointer;border-radius:8px;border:none;background:var(--surface2);color:var(--muted);text-transform:uppercase;">💬 Berichten</button>
        <button onclick="historyTab('reviews',this)" id="htab-reviews" style="flex:1;padding:7px 4px;font-family:var(--font-retro);font-size:10px;letter-spacing:1px;cursor:pointer;border-radius:8px;border:none;background:var(--surface2);color:var(--muted);text-transform:uppercase;">⭐ Reviews</button>
      </div>`;

    // ── Songs sectie ──
    let songHtml = '';
    if (played?.length) {
      songHtml += played.map((r, i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--surface2);border-radius:9px;margin-bottom:6px;">
          <div style="font-family:var(--font-display);font-size:18px;color:var(--border2);min-width:28px;">${i+1}</div>
          <div>
            <div style="font-family:var(--font-display);font-size:16px;">${r.songs?.title || '—'}</div>
            <div style="font-size:11px;color:var(--muted);font-family:var(--font-retro);">${r.songs?.original_artist || ''}${r.voter_sessions?.display_name ? ' · door ' + r.voter_sessions.display_name : ''}${r.message ? ' · "' + r.message + '"' : ''}</div>
          </div>
        </div>`).join('');
    } else {
      songHtml = `<div style="color:var(--muted);font-size:13px;font-family:var(--font-retro);padding:16px 0;">Geen songs gespeeld</div>`;
    }

    // ── Votes/likes sectie — het echte overzicht ──
    let votesHtml = '';
    if (votedRequests.length > 0) {
      // Totaaltelling unieke voters
      const allVoterNames = [...new Set((allVotes || []).filter(v => v.voter_name).map(v => v.voter_name))];
      votesHtml += `
        <div style="background:rgba(255,51,102,0.07);border:1px solid rgba(255,51,102,0.2);border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;gap:16px;">
          <div style="text-align:center;">
            <div style="font-family:var(--font-display);font-size:28px;color:var(--neon3);">${(allVotes||[]).length}</div>
            <div style="font-size:9px;color:var(--muted);font-family:var(--font-retro);letter-spacing:1px;">TOTAAL LIKES</div>
          </div>
          <div style="text-align:center;">
            <div style="font-family:var(--font-display);font-size:28px;color:var(--neon3);">${allVoterNames.length}</div>
            <div style="font-size:9px;color:var(--muted);font-family:var(--font-retro);letter-spacing:1px;">UNIEKE VOTERS</div>
          </div>
        </div>`;

      votesHtml += votedRequests.map(r => {
        const hearts = '❤'.repeat(Math.min(r.voters.length, 8)) + (r.voters.length > 8 ? ` +${r.voters.length - 8}` : '');
        return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div>
              <div style="font-family:var(--font-display);font-size:16px;">${r.songs?.title || '—'}</div>
              <div style="font-size:11px;color:var(--muted);font-family:var(--font-retro);">${r.songs?.original_artist || ''}</div>
            </div>
            <div style="font-family:var(--font-display);font-size:22px;color:var(--neon3);flex-shrink:0;">${r.voters.length}</div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;">
            ${r.voters.map(n => `<span style="background:rgba(255,51,102,0.12);border:1px solid rgba(255,51,102,0.25);border-radius:100px;padding:2px 9px;font-size:11px;color:var(--text);font-family:var(--font-retro);">❤ ${n}</span>`).join('')}
          </div>
        </div>`;
      }).join('');
    } else {
      votesHtml = `<div style="color:var(--muted);font-size:13px;font-family:var(--font-retro);padding:16px 0;">Geen likes uitgebracht</div>`;
    }

    // ── Berichten sectie ──
    let msgHtml = '';
    if (messages?.length) {
      msgHtml = messages.map(m => {
        const time = new Date(m.created_at).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' });
        return `<div class="msg-item" style="margin-bottom:6px;">
          <div class="msg-avatar">${(m.sender_name || 'A')[0].toUpperCase()}</div>
          <div><div class="msg-name">${m.sender_name || '—'} · ${time}</div><div class="msg-text">${m.message}</div></div>
        </div>`;
      }).join('');
    } else {
      msgHtml = `<div style="color:var(--muted);font-size:13px;font-family:var(--font-retro);padding:16px 0;">Geen berichten</div>`;
    }

    // ── Reviews sectie ──
    let reviewHtml = '';
    if (comments?.length) {
      const avgRating = comments.filter(c => c.rating).reduce((s, c) => s + c.rating, 0) / (comments.filter(c => c.rating).length || 1);
      reviewHtml += `
        <div style="background:rgba(255,170,0,0.07);border:1px solid rgba(255,170,0,0.2);border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;gap:16px;align-items:center;">
          <div style="font-family:var(--font-display);font-size:32px;color:var(--neon2);">${avgRating.toFixed(1)}</div>
          <div>
            <div style="color:var(--neon2);font-size:16px;letter-spacing:2px;">${'★'.repeat(Math.round(avgRating))}${'☆'.repeat(5-Math.round(avgRating))}</div>
            <div style="font-size:9px;color:var(--muted);font-family:var(--font-retro);letter-spacing:1px;">${comments.length} REVIEW${comments.length !== 1 ? 'S' : ''}</div>
          </div>
        </div>`;
      reviewHtml += comments.map(c => {
        const stars = c.rating ? '★'.repeat(c.rating) + '☆'.repeat(5-c.rating) : '';
        return `<div class="comment-card">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <div class="comment-author">${c.author_name}</div>
            ${stars ? `<div style="color:var(--neon2);">${stars}</div>` : ''}
          </div>
          ${c.song_title ? `<div style="font-size:11px;color:var(--neon2);margin:3px 0;font-family:var(--font-mono);">🎵 ${c.song_title}</div>` : ''}
          <div class="comment-text">${c.content}</div>
        </div>`;
      }).join('');
    } else {
      reviewHtml = `<div style="color:var(--muted);font-size:13px;font-family:var(--font-retro);padding:16px 0;">Geen reviews</div>`;
    }

    contentEl.innerHTML = tabHtml
      + `<div id="hpanel-songs">${songHtml}</div>`
      + `<div id="hpanel-votes" style="display:none;">${votesHtml}</div>`
      + `<div id="hpanel-messages" style="display:none;">${msgHtml}</div>`
      + `<div id="hpanel-reviews" style="display:none;">${reviewHtml}</div>`;
  }

  function historyTab(tab, btn) {
    ['songs','votes','messages','reviews'].forEach(t => {
      const panel = document.getElementById('hpanel-' + t);
      const tbtn  = document.getElementById('htab-' + t);
      if (panel) panel.style.display = t === tab ? 'block' : 'none';
      if (tbtn)  tbtn.style.cssText  = t === tab
        ? 'flex:1;padding:7px 4px;font-family:var(--font-retro);font-size:10px;letter-spacing:1px;cursor:pointer;border-radius:8px;border:none;background:var(--neon);color:#000;text-transform:uppercase;'
        : 'flex:1;padding:7px 4px;font-family:var(--font-retro);font-size:10px;letter-spacing:1px;cursor:pointer;border-radius:8px;border:none;background:var(--surface2);color:var(--muted);text-transform:uppercase;';
    });
  }

  // ════════════════════════════════════════════
  // GIG SETTINGS + QR (punt 12)
  // ════════════════════════════════════════════

  // ════════════════════════════════════════════
  async function saveGigSettings() {
    if (!currentGig) return;
    const name    = document.getElementById('settings-gig-name').value.trim();
    const venue   = document.getElementById('settings-gig-venue').value.trim();
    const gigDateVal = document.getElementById('settings-gig-date').value;
    const gigDate = gigDateVal ? new Date(gigDateVal).toISOString() : currentGig.gig_date;
    const allowReq  = document.getElementById('toggle-requests').classList.contains('on');
    const allowVote = document.getElementById('toggle-votes').classList.contains('on');
    const isPublic   = document.getElementById('toggle-public')?.classList.contains('on') ?? false;
    const locType    = ['physical','online','hybrid'].find(t => document.getElementById(`settings-loc-${t}`)?.classList.contains('active')) || 'physical';
    const locAddress = document.getElementById('settings-location-address')?.value.trim() || null;
    const locLat     = parseFloat(document.getElementById('settings-location-lat')?.value) || null;
    const locLng     = parseFloat(document.getElementById('settings-location-lng')?.value) || null;
    const streamUrl  = document.getElementById('settings-stream-url')?.value.trim() || null;

    await db.from('gigs').update({
      name: name || currentGig.name,
      venue: venue || currentGig.venue,
      gig_date: gigDate,
      allow_requests: allowReq,
      allow_votes: allowVote,
      is_public: isPublic,
      location_type: locType,
      location_address: locAddress,
      location_lat: locLat,
      location_lng: locLng,
      stream_url: streamUrl,
    }).eq('id', currentGig.id);
    // Update local state
    currentGig.name = name || currentGig.name;
    currentGig.venue = venue || currentGig.venue;
    currentGig.gig_date = gigDate;
    currentGig.allow_requests = allowReq;
    currentGig.allow_votes = allowVote;
    currentGig.is_public = isPublic;
    currentGig.location_type = locType;
    currentGig.location_address = locAddress;
    currentGig.location_lat = locLat;
    currentGig.location_lng = locLng;
    currentGig.stream_url = streamUrl;

    // Sync gig_artists: diff-based (alleen toevoegen/verwijderen wat echt veranderd is)
    const uniqueArtists = settingsGigArtists.filter(
      (a, i, arr) => arr.findIndex(b => b.id === a.id) === i
    );
    settingsGigArtists = uniqueArtists;

    const { data: currentGA } = await db.from('gig_artists')
      .select('artist_id').eq('gig_id', currentGig.id);
    const currentIds = new Set((currentGA || []).map(r => r.artist_id));
    const desiredIds = new Set(uniqueArtists.map(a => a.id));

    // Verwijder artiesten die niet meer in de lijst staan
    for (const id of currentIds) {
      if (!desiredIds.has(id)) {
        const { error: delErr } = await db.from('gig_artists')
          .delete().eq('gig_id', currentGig.id).eq('artist_id', id);
        if (delErr) showToast('Fout bij verwijderen artiest: ' + delErr.message, 'error');
      }
    }
    // Voeg nieuwe artiesten toe
    for (const a of uniqueArtists) {
      if (!currentIds.has(a.id)) {
        await db.from('gig_artists').insert({ gig_id: currentGig.id, artist_id: a.id });
      }
    }

    // Zorg dat elke gekoppelde artiest ook een user_gigs-rij heeft zodat ze de gig zien na refresh
    if (uniqueArtists.length > 0) {
      const { data: uaRows } = await db.from('user_artists')
        .select('user_id').in('artist_id', uniqueArtists.map(a => a.id));
      if (uaRows?.length) {
        const userIds = uaRows.map(ua => ua.user_id);
        // Haal bestaande user_gigs-rijen op om duplicaten te vermijden
        const { data: existingUG } = await db.from('user_gigs')
          .select('user_id').eq('gig_id', currentGig.id).in('user_id', userIds);
        const alreadyLinked = new Set((existingUG || []).map(r => r.user_id));
        const toInsert = userIds.filter(uid => !alreadyLinked.has(uid));
        if (toInsert.length) {
          await db.from('user_gigs').insert(
            toInsert.map(uid => ({ user_id: uid, gig_id: currentGig.id }))
          );
        }
      }
    }

    showToast('Instellingen opgeslagen ✓', 'success');
    // Herlaad alleen wat echt hoeft — NIET loadArtistData() want dat reset settingsGigArtists
    updateActiveGigPill(currentGig);
    document.getElementById('artist-gig-name').textContent = currentGig.name || currentGig.venue || 'Gig';
    loadArtistSongbook();
    loadSettingsSongList();
    loadArtistHistory();
  }

  async function toggleGigIsLive(btn) {
    if (!currentGig) return;
    btn.classList.toggle('on');
    const val = btn.classList.contains('on');
    await db.from('gigs').update({ is_live: val }).eq('id', currentGig.id);
    currentGig.is_live = val;
    const badge = document.getElementById('artist-gig-status');
    if (badge) badge.style.display = val ? 'inline-flex' : 'none';
    showToast(val ? 'Gig is nu LIVE! 🎸' : 'Live-status uitgeschakeld', val ? 'success' : '');
  }

  async function toggleVotingOpen(btn) {
    if (!currentGig) return;
    btn.classList.toggle('on');
    const val = btn.classList.contains('on');
    await db.from('gigs').update({ voting_open: val }).eq('id', currentGig.id);
    currentGig.voting_open = val;
    showToast(val ? 'Stemmen geopend ✓' : 'Stemmen gesloten', val ? 'success' : '');
  }

  // ════════════════════════════════════════════
  // GIG AFSLUITEN
  // ════════════════════════════════════════════
  async function closeGig() {
    if (!currentGig) return;
    if (!confirm(t('confirm-close-gig') || 'Wil je de gig echt afsluiten?')) return;

    await db.from('gigs').update({ status: 'finished', is_active: false, is_live: false, voting_open: false }).eq('id', currentGig.id);
    await db.from('requests')
      .update({ status: 'rejected' })
      .eq('gig_id', currentGig.id)
      .in('status', ['pending', 'approved', 'queued']);

    currentGig.status = 'finished';
    currentGig.is_active = false;
    document.getElementById('artist-gig-status').style.display = 'none';
    showToast('Gig afgesloten ✓', 'success');
    loadGigSettings();
    loadArtistQueue();
    loadArtistRequests();
    loadArtistHistory();
  }

  // ════════════════════════════════════════════
  // GIG OVERZICHT & FILTERS
  // ════════════════════════════════════════════
  let _allGigData = [];
  let _historyFilter = 'all';

  function filterHistory(filter, btn) {
    _historyFilter = filter;
    document.querySelectorAll('#history-filter-row button').forEach(b => {
      b.className = 'badge';
      b.style.cssText = 'cursor:pointer;padding:5px 12px;font-size:11px;background:var(--surface2);color:var(--muted);border:1px solid var(--border);';
    });
    btn.className = 'badge badge-neon';
    btn.style.cssText = 'cursor:pointer;padding:5px 12px;font-size:11px;';
    renderHistoryList();
  }

  function renderHistoryList() {
    const list = document.getElementById('artist-history-list');
    if (!list) return;

    const filtered = _historyFilter === 'all'
      ? _allGigData
      : _allGigData.filter(d => d.gig.status === _historyFilter);

    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>${t('empty-history')}</p></div>`; return;
    }

    const order = { live: 0, upcoming: 1, finished: 2 };
    filtered.sort((a, b) =>
      (order[a.gig.status] ?? 3) - (order[b.gig.status] ?? 3) ||
      (b.gig.gig_date || '').localeCompare(a.gig.gig_date || '')
    );

    list.innerHTML = filtered.map(({ gig, played, requested, msgs }) => {
      const date = gig.gig_date ? new Date(gig.gig_date).toLocaleDateString('nl-NL') : '—';
      const displayPlayed = (gig.id === currentGig?.id) ? Math.max(played, playedCountThisSession) : played;
      const isActive = gig.id === currentGig?.id;

      const statusBadge = gig.status === 'live'
        ? `<span class="badge badge-neon" style="font-size:9px;">● LIVE</span>`
        : gig.status === 'finished'
        ? `<span class="badge badge-green" style="font-size:9px;">✓ Afgesloten</span>`
        : `<span class="badge badge-chrome" style="font-size:9px;">○ Gepland</span>`;

      const safeName = (gig.name || gig.venue || 'Gig').replace(/'/g, "\'");

      return `<div class="history-gig-card" style="${isActive ? 'border-color:var(--neon);' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
          <div style="flex:1;cursor:pointer;" onclick="openGigHistory(${gig.id},'${safeName}')">
            <div class="history-gig-name">${gig.name || 'Naamloze gig'}${isActive ? ' <span style="font-size:10px;color:var(--neon);font-family:var(--font-retro);">← actief</span>' : ''}</div>
            <div class="history-gig-meta" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:3px;">
              ${gig.venue || '—'} · ${date} ${statusBadge}
            </div>
          </div>
          ${!isActive && gig.status !== 'finished'
            ? `<button class="btn btn-secondary" style="padding:5px 10px;font-size:11px;white-space:nowrap;margin-left:8px;" onclick="switchActiveGig(${gig.id})">${t('lbl-activate-gig') || 'Activeer'}</button>`
            : ''}
        </div>
        <div class="history-stats" style="cursor:pointer;" onclick="openGigHistory(${gig.id},'${safeName}')">
          <span class="history-stat">🎵 ${displayPlayed} gespeeld</span>
          <span class="history-stat">📋 ${requested} aanvragen</span>
          <span class="history-stat">💬 ${msgs} berichten</span>
        </div>
      </div>`;
    }).join('');
  }

  async function switchActiveGig(gigId) {
    const { data: gigData } = await db.from('gigs').select('*').eq('id', gigId).single();
    if (!gigData) return;
    currentGig = gigData;
    try { localStorage.setItem('jukestage_active_gig', gigId); } catch(e) {}
    updateActiveGigPill(currentGig);
    document.getElementById('artist-gig-name').textContent = currentGig.name || currentGig.venue || t('lbl-no-active-gig');
    document.getElementById('artist-gig-status').style.display = currentGig.status === 'live' ? 'inline-flex' : 'none';
    loadArtistQueue();
    loadArtistRequests();
    loadArtistSongbook();
    loadArtistInbox();
    loadGigSettings();
    loadArtistHistory();
    subscribeArtistRealtime();
    showToast('Gig gewisseld: ' + (currentGig.name || 'Gig'), 'success');
  }

  // ════════════════════════════════════════════
  // ARTIESTEN BEHEER BIJ GIG
  // ════════════════════════════════════════════
  let newGigArtists = [];      // artists selected for new gig
  let settingsGigArtists = []; // artists selected in settings

  function renderArtistPills(context) {
    const list = context === 'new-gig' ? newGigArtists : settingsGigArtists;
    const el = document.getElementById(context + '-artists-list');
    if (!el) return;
    if (list.length === 0) {
      el.innerHTML = `<span style="color:var(--muted);font-size:12px;font-family:var(--font-retro);">Nog geen artiesten</span>`;
      return;
    }
    el.innerHTML = list.map(a => `
      <div style="display:inline-flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border2);border-radius:100px;padding:4px 10px;font-size:12px;">
        <span>${a.name}</span>
        <button onclick="removeGigArtist('${context}',${a.id})" style="background:none;border:none;color:var(--muted);cursor:pointer;padding:0;line-height:1;font-size:14px;">✕</button>
      </div>`).join('');
  }

  function removeGigArtist(context, artistId) {
    if (context === 'new-gig') {
      newGigArtists = newGigArtists.filter(a => a.id !== artistId);
    } else {
      settingsGigArtists = settingsGigArtists.filter(a => a.id !== artistId);
    }
    renderArtistPills(context);
  }

  function addGigArtist(context, artist) {
    const list = context === 'new-gig' ? newGigArtists : settingsGigArtists;
    if (!list.find(a => a.id === artist.id)) {
      list.push(artist);
    }
    if (context === 'new-gig') newGigArtists = list;
    else settingsGigArtists = list;
    renderArtistPills(context);
    document.getElementById(context + '-artist-search').value = '';
    document.getElementById(context + '-artist-results').style.display = 'none';
  }

  let _artistSearchTimer = null;
  async function searchArtistsFor(context) {
    clearTimeout(_artistSearchTimer);
    const query = document.getElementById(context + '-artist-search').value.trim();
    const resultsEl = document.getElementById(context + '-artist-results');
    if (!query) { resultsEl.style.display = 'none'; return; }
    _artistSearchTimer = setTimeout(async () => {
      const { data: artists } = await db.from('artists')
        .select('id, name').ilike('name', `%${query}%`).limit(8);
      if (!artists || artists.length === 0) {
        resultsEl.innerHTML = `<div style="padding:10px;color:var(--muted);font-size:13px;">Geen artiesten gevonden</div>`;
      } else {
        resultsEl.innerHTML = artists.map(a => `
          <div onclick="addGigArtist('${context}', {id:${a.id},name:'${a.name.replace(/'/g,"\'")}'})"
               style="padding:10px 14px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border);"
               onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background=''">
            ${a.name}
          </div>`).join('');
      }
      resultsEl.style.display = 'block';
    }, 250);
  }

  async function loadGigSettings() {
    if (!currentGig) return;

    // Refresh from DB to ensure qr_token is present
    const { data: freshGig } = await db.from('gigs').select('*').eq('id', currentGig.id).single();
    if (freshGig) currentGig = freshGig;

    // Fill gig selector dropdown with all user gigs
    const _selEl = document.getElementById('settings-gig-select');
    if (_selEl && currentUser?.id) {
      const { data: _allUG } = await db.from('user_gigs')
        .select('gig_id, gigs(id, name, venue, status, gig_date)').eq('user_id', currentUser.id);
      if (_allUG?.length) {
        const _order = { live: 0, upcoming: 1, finished: 2 };
        const _sorted = _allUG.filter(ug => ug.gigs).sort((a, b) =>
          (_order[a.gigs.status] ?? 3) - (_order[b.gigs.status] ?? 3) ||
          (b.gigs.gig_date || '').localeCompare(a.gigs.gig_date || '')
        );
        _selEl.innerHTML = _sorted.map(ug => {
          const g = ug.gigs;
          const statusIcon = g.status === 'live' ? '● ' : g.status === 'finished' ? '✓ ' : '○ ';
          const date = g.gig_date ? new Date(g.gig_date).toLocaleDateString('nl-NL') : '';
          return `<option value="${g.id}" ${g.id === currentGig.id ? 'selected' : ''}>${statusIcon}${g.name || g.venue || 'Gig'} ${date ? '· ' + date : ''}</option>`;
        }).join('');
      }
    }

    document.getElementById('settings-gig-name').value  = currentGig.name || '';
    document.getElementById('settings-gig-venue').value = currentGig.venue || '';
    if (currentGig.gig_date) {
      const d = new Date(currentGig.gig_date);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      document.getElementById('settings-gig-date').value = local;
    } else {
      document.getElementById('settings-gig-date').value = '';
    }

    // Load current artists for this gig
    const { data: gigArtistsData } = await db.from('gig_artists')
      .select('artist_id, artists(id, name)').eq('gig_id', currentGig.id);
    settingsGigArtists = (gigArtistsData || []).map(ga => ({ id: ga.artists.id, name: ga.artists.name }));
    renderArtistPills('settings');
    document.getElementById('settings-artist-search').value = '';
    document.getElementById('settings-artist-results').style.display = 'none';

    // Punt 12: echte URL + werkende QR code
    const gigUrl = `https://jukestage.live/?gig=${currentGig.qr_token || currentGig.id}`;
    document.getElementById('qr-link').textContent = gigUrl;
    generateQRCode(gigUrl);

    const setToggle = (id, val) => {
      const el = document.getElementById(id);
      if (el) { el.classList.toggle('on', val !== false); }
    };
    setToggle('toggle-requests', currentGig.allow_requests);
    setToggle('toggle-votes', currentGig.allow_votes);
    setToggle('toggle-is-live', currentGig.is_live);
    setToggle('toggle-voting-open', currentGig.voting_open);
    setToggle('toggle-public', currentGig.is_public);

    // Locatie velden laden
    const locType = currentGig.location_type || 'physical';
    setLocationType(locType, 'settings');
    const addrEl = document.getElementById('settings-location-address');
    const latEl  = document.getElementById('settings-location-lat');
    const lngEl  = document.getElementById('settings-location-lng');
    const urlEl  = document.getElementById('settings-stream-url');
    if (addrEl) addrEl.value = currentGig.location_address || '';
    if (latEl)  latEl.value  = currentGig.location_lat  != null ? currentGig.location_lat  : '';
    if (lngEl)  lngEl.value  = currentGig.location_lng  != null ? currentGig.location_lng  : '';
    if (urlEl)  urlEl.value  = currentGig.stream_url    || '';

    // Status badge
    const statusBadge = document.getElementById('settings-gig-status-badge');
    if (statusBadge) {
      if (currentGig.status === 'live') { statusBadge.textContent = '● LIVE'; statusBadge.className = 'badge badge-neon'; statusBadge.style.cssText = ''; }
      else if (currentGig.status === 'upcoming') { statusBadge.textContent = '○ Gepland'; statusBadge.className = 'badge badge-chrome'; statusBadge.style.cssText = ''; }
      else { statusBadge.textContent = '✓ Afgesloten'; statusBadge.style.cssText = 'background:var(--surface2);color:var(--muted);border:1px solid var(--border);border-radius:100px;padding:2px 8px;font-size:10px;'; }
      statusBadge.style.display = '';
    }
    const closeBtn = document.getElementById('btn-close-gig');
    const reopenBtn = document.getElementById('btn-reopen-gig');
    if (closeBtn) closeBtn.style.display = currentGig.status === 'finished' ? 'none' : '';
    if (reopenBtn) reopenBtn.style.display = currentGig.status === 'finished' ? '' : 'none';

    // Laad de per-gig songlijst in de instellingen
    loadSettingsSongList();
    // Zet modus-knoppen op juiste staat
    updateRepertoireModeUI(currentGig.repertoire_mode || 'full');
  }

  async function reopenGig() {
    if (!currentGig) return;
    await db.from('gigs').update({ status: 'upcoming', is_active: true }).eq('id', currentGig.id);
    currentGig.status = 'upcoming';
    currentGig.is_active = true;
    showToast('Gig heropend ○', 'success');
    loadGigSettings();
    loadArtistHistory();
  }

  // QUEUE ACTIES
  // ════════════════════════════════════════════
  async function markPlayed(songId) {
    // Markeer alle actieve requests voor dit nummer als gespeeld
    await db.from('requests')
      .update({ status: 'played', updated_at: new Date().toISOString() })
      .eq('gig_id', currentGig.id)
      .eq('song_id', songId)
      .in('status', ['approved','queued','playing']);
    // Punt 10: verhoog teller in geheugen (persistent over refresh via DB)
    playedCountThisSession++;
    const stat = document.getElementById('stat-played');
    if (stat) stat.textContent = parseInt(stat.textContent) + 1;
    // Verwijder uit queueCustomOrder
    queueCustomOrder = queueCustomOrder.filter(sid => sid !== songId);
    showToast('Gespeeld! ✓', 'success');
    loadArtistQueue();
    loadArtistHistory(); // update stat in history direct
  }

  async function skipSong(songId) {
    // Sla alle actieve requests voor dit nummer over
    await db.from('requests')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('gig_id', currentGig.id)
      .eq('song_id', songId)
      .in('status', ['approved','queued','playing']);
    // Verwijder uit queueCustomOrder
    queueCustomOrder = queueCustomOrder.filter(sid => sid !== songId);
    showToast('Overgeslagen', '');
    loadArtistQueue();
  }

  async function playNow(songId) {
    // Zet huidige 'playing' terug naar 'queued'
    await db.from('requests').update({ status: 'queued' }).eq('gig_id', currentGig.id).eq('status', 'playing');
    // Zet de eerste (oudste) approved/queued request voor dit nummer op 'playing'
    const { data: reqs } = await db.from('requests')
      .select('id')
      .eq('gig_id', currentGig.id)
      .eq('song_id', songId)
      .in('status', ['approved','queued'])
      .order('created_at', { ascending: true })
      .limit(1);
    if (reqs && reqs.length > 0) {
      await db.from('requests').update({ status: 'playing', updated_at: new Date().toISOString() }).eq('id', reqs[0].id);
    }
    showToast('Nu aan het spelen! ▶', 'success');
    loadArtistQueue();
  }

  async function approveRequest(requestId, btn) {
    await db.from('requests').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', requestId);
    const card = btn.closest('[data-req-id]');
    if (card) { card.style.borderColor = 'var(--green)'; card.querySelector('.action-strip').innerHTML = '<span class="badge badge-green">✓ Goedgekeurd — toegevoegd aan wachtrij</span>'; }
    showToast('Aanvraag goedgekeurd ✓', 'success');
    loadArtistQueue();
  }

  async function rejectRequest(requestId, btn) {
    await db.from('requests').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', requestId);
    const card = btn.closest('[data-req-id]');
    if (card) { card.style.opacity = '0.4'; card.style.pointerEvents = 'none'; }
    showToast('Aanvraag afgewezen', '');
  }

  async function markAllRead() {
    if (!currentGig) return;
    await db.from('gig_messages').update({ is_read: true }).eq('gig_id', currentGig.id).eq('is_read', false);
    showToast('Alles gelezen ✓', 'success');
    loadArtistInbox();
  }

  // ════════════════════════════════════════════
  // SONGBOOK MODAL
  // ════════════════════════════════════════════
  function openAddSongModal() {
    editingSongId = null;
    document.getElementById('modal-song-title').textContent = 'Nummer Toevoegen';
    ['song-title','song-artist','song-key','song-ug','song-karaoke-url'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('song-bpm').value = '';
    document.getElementById('song-karaoke-toggle').classList.remove('on');
    selectSongCatModal('optional');
    document.getElementById('modal-add-song').classList.add('open');
  }

  let _modalSongCat = 'optional';
  const _catLabels = () => ({ core: t('cat-core-desc'), optional: t('cat-optional-desc'), archived: t('cat-archived-desc') });

  function selectSongCatModal(cat) {
    _modalSongCat = cat;
    ['core','optional','archived'].forEach(c => {
      const btn = document.getElementById('cat-btn-' + c);
      if (btn) btn.className = 'cat-btn' + (c === cat ? ' active-' + c : '');
    });
    const lbl = document.getElementById('cat-modal-label');
    if (lbl) lbl.textContent = _catLabels()[cat] || cat;
  }

  async function editSong(songId) {
    editingSongId = songId;
    const song = allSongs.find(s => s.id === songId);
    if (!song) return;
    document.getElementById('modal-song-title').textContent = 'Nummer Bewerken';
    document.getElementById('song-title').value  = song.title || '';
    document.getElementById('song-artist').value = song.original_artist || '';
    document.getElementById('song-key').value    = song.key_signature || '';
    document.getElementById('song-bpm').value    = song.tempo_bpm || '';
    document.getElementById('song-ug').value     = song.ug_tabs || '';
    document.getElementById('song-karaoke-url').value = song.karaoke_url || '';
    document.getElementById('song-karaoke-toggle').classList.toggle('on', !!song.is_karaoke_available);
    selectSongCatModal(song.song_category || 'optional');
    document.getElementById('modal-add-song').classList.add('open');
  }

  async function saveSong() {
    const title    = document.getElementById('song-title').value.trim();
    const artist   = document.getElementById('song-artist').value.trim();
    const key      = document.getElementById('song-key').value.trim() || null;
    const bpm      = parseInt(document.getElementById('song-bpm').value) || null;
    const ugTabs   = document.getElementById('song-ug').value.trim() || null;
    const karaUrl  = document.getElementById('song-karaoke-url').value.trim() || null;
    const isKaraoke = document.getElementById('song-karaoke-toggle').classList.contains('on');
    const songCat = _modalSongCat || 'optional';

    if (!title) { showToast('Vul een titel in', 'error'); return; }

    if (editingSongId) {
      await db.from('songs').update({
        title, original_artist: artist, key_signature: key,
        tempo_bpm: bpm, ug_tabs: ugTabs, karaoke_url: karaUrl,
        is_karaoke_available: isKaraoke,
        song_category: songCat,
        is_active: songCat !== 'archived'
      }).eq('id', editingSongId);
      showToast('Nummer bijgewerkt ✓', 'success');
    } else {
      const { data: song, error } = await db.from('songs').insert({
        title, original_artist: artist, key_signature: key,
        tempo_bpm: bpm, ug_tabs: ugTabs, karaoke_url: karaUrl,
        is_karaoke_available: isKaraoke,
        song_category: songCat,
        is_active: songCat !== 'archived',
        created_at: new Date().toISOString()
      }).select().single();
      if (error) { showToast('Kon nummer niet opslaan', 'error'); return; }
      if (currentArtist) {
        await db.from('artist_songs').insert({ artist_id: currentArtist.id, song_id: song.id });
      }
      // Voeg ook toe aan gig_songs
      if (currentGig && song) {
        await db.from('gig_songs').insert({
          gig_id: currentGig.id,
          song_id: song.id,
          is_active: true,
          vote_count: 0
        });
      }
      showToast('Nummer toegevoegd ✓', 'success');
    }

    closeModal('modal-add-song');
    loadArtistSongbook();
    loadVoterSongs(); // update voter lijst ook
  }

  // ════════════════════════════════════════════
  // ════════════════════════════════════════════
  // CSV IMPORT
  // ════════════════════════════════════════════
  let csvValidRows  = [];
  let csvLinkRows   = []; // al in DB maar nog niet gekoppeld aan deze artiest
  let csvSkipRows   = []; // al gekoppeld aan deze artiest
  let csvErrorRows  = [];

  function openCSVImportModal() {
    csvValidRows = []; csvLinkRows = []; csvSkipRows = []; csvErrorRows = [];
    const fileInput = document.getElementById('csv-file-input');
    if (fileInput) fileInput.value = '';
    document.getElementById('csv-preview-section').style.display = 'none';
    document.getElementById('modal-csv-import').classList.add('open');
  }

  function downloadCSVTemplate() {
    const header = 'titel,artiest,toonsoort,bpm,ultimate_guitar_url,lyrics_url,lyrics_beschikbaar,categorie\n';
    const blob = new Blob([header], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'jukestage-songbook-template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCSVFile(input) {
    const file = input.files[0];
    if (!file) return;

    // Songs die al gekoppeld zijn aan deze artiest (echte duplicaten → overslaan)
    let ownKeys = new Set();
    if (currentArtist) {
      const { data: existing } = await db.from('artist_songs')
        .select('songs(title, original_artist)').eq('artist_id', currentArtist.id);
      (existing || []).forEach(row => {
        if (row.songs?.title) {
          ownKeys.add(
            row.songs.title.trim().toLowerCase() + '|' +
            (row.songs.original_artist || '').trim().toLowerCase()
          );
        }
      });
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        // Verzamel unieke titels uit de CSV om globale DB-check te beperken
        const titlesInCSV = [...new Set(
          results.data.map(r => (r['titel'] || '').trim()).filter(Boolean)
        )];

        // Zoek bestaande songs in de DB op basis van die titels
        let globalSongMap = {}; // 'title_lower|artist_lower' → song_id
        if (titlesInCSV.length > 0) {
          const { data: globalSongs } = await db.from('songs')
            .select('id, title, original_artist').in('title', titlesInCSV);
          (globalSongs || []).forEach(s => {
            const key = s.title.trim().toLowerCase() + '|' + (s.original_artist || '').trim().toLowerCase();
            if (!globalSongMap[key]) globalSongMap[key] = s.id;
          });
        }

        _previewCSV(results, ownKeys, globalSongMap);
      },
      error: (err) => showToast('CSV kon niet worden gelezen: ' + err.message, 'error')
    });
  }

  function _validateCSVRow(row, rowNum) {
    const titel   = (row['titel']   || '').trim();
    const artiest = (row['artiest'] || '').trim();

    const errors = [];
    if (!titel)   errors.push('Titel ontbreekt');
    if (!artiest) errors.push('Artiest ontbreekt');

    const bpmRaw = (row['bpm'] || '').trim();
    let bpm = null;
    if (bpmRaw) {
      const parsed = parseInt(bpmRaw, 10);
      if (isNaN(parsed) || String(parsed) !== bpmRaw) {
        errors.push(`BPM is geen geldig getal ('${bpmRaw}')`);
      } else { bpm = parsed; }
    }

    const catRaw = (row['categorie'] || '').trim().toLowerCase();
    const catMap  = { 'vast': 'core', 'optioneel': 'optional', 'archief': 'archived', '': 'optional' };
    if (catRaw && !(catRaw in catMap)) {
      errors.push(`Categorie ongeldig ('${catRaw}') — gebruik vast/optioneel/archief`);
    }

    const ugUrl     = (row['ultimate_guitar_url'] || '').trim();
    const lyricsUrl = (row['lyrics_url']          || '').trim();
    if (ugUrl     && !/^https?:\/\//i.test(ugUrl))
      errors.push(`Tabs URL ongeldig (moet beginnen met http/https)`);
    if (lyricsUrl && !/^https?:\/\//i.test(lyricsUrl))
      errors.push(`Lyrics URL ongeldig (moet beginnen met http/https)`);

    if (errors.length) return { valid: false, errors, rowNum };

    const isKaraoke = (row['lyrics_beschikbaar'] || '').trim().toLowerCase() === 'ja';
    const songCat   = catMap[catRaw] || 'optional';
    return {
      valid: true,
      data: {
        title: titel,
        original_artist: artiest,
        key_signature: (row['toonsoort'] || '').trim() || null,
        tempo_bpm: bpm,
        ug_tabs: ugUrl || null,
        karaoke_url: lyricsUrl || null,
        is_karaoke_available: isKaraoke,
        song_category: songCat,
        is_active: songCat !== 'archived',
        created_at: new Date().toISOString()
      }
    };
  }

  function _previewCSV(results, ownKeys, globalSongMap) {
    csvValidRows = []; csvLinkRows = []; csvSkipRows = []; csvErrorRows = [];

    results.data.forEach((row, idx) => {
      const rowNum = idx + 2; // rij 1 = header
      const result = _validateCSVRow(row, rowNum);
      if (!result.valid) {
        csvErrorRows.push({ rowNum, errors: result.errors });
      } else {
        const key = result.data.title.toLowerCase() + '|' + result.data.original_artist.toLowerCase();
        if (ownKeys.has(key)) {
          csvSkipRows.push({ rowNum, title: result.data.title, artist: result.data.original_artist });
        } else if (globalSongMap[key]) {
          // Bestaat al in DB, maar nog niet gekoppeld aan deze artiest
          csvLinkRows.push({ ...result.data, _existingSongId: globalSongMap[key] });
        } else {
          csvValidRows.push(result.data);
        }
      }
    });

    // Summary pills
    const summaryEl = document.getElementById('csv-summary');
    summaryEl.innerHTML =
      `<span class="csv-summary-pill valid">✓ ${csvValidRows.length} nieuw</span>` +
      (csvLinkRows.length  ? `<span class="csv-summary-pill link">↷ ${csvLinkRows.length} al bekend, wordt gekoppeld</span>` : '') +
      (csvSkipRows.length  ? `<span class="csv-summary-pill skipped">↷ ${csvSkipRows.length} al in songbook</span>` : '') +
      (csvErrorRows.length ? `<span class="csv-summary-pill error">✗ ${csvErrorRows.length} ongeldig</span>` : '');

    // Preview tabel (eerste 10 nieuwe rijen; link-rijen worden ook getoond)
    const tableWrap = document.getElementById('csv-preview-table-wrap');
    const previewRows = [...csvValidRows, ...csvLinkRows].slice(0, 10);
    if (previewRows.length > 0) {
      const catLabel = { core: '⭐ Vast', optional: '🎵 Optioneel', archived: '🗃 Archief' };
      tableWrap.innerHTML =
        '<table class="csv-preview-table"><thead><tr>'
        + '<th>#</th><th>Titel</th><th>Artiest</th><th>Cat.</th>'
        + '</tr></thead><tbody>'
        + previewRows.map((r, i) =>
            `<tr><td style="color:var(--muted);font-family:var(--font-mono);">${i + 1}</td>`
            + `<td title="${r.title}">${r.title}</td>`
            + `<td title="${r.original_artist}">${r.original_artist}</td>`
            + `<td style="white-space:nowrap;">${catLabel[r.song_category] || '🎵'}</td></tr>`
          ).join('')
        + '</tbody></table>'
        + (previewRows.length < csvValidRows.length + csvLinkRows.length
            ? `<div style="font-family:var(--font-retro);font-size:10px;color:var(--muted);padding:6px 10px;">... en nog ${csvValidRows.length + csvLinkRows.length - 10} meer</div>`
            : '');
    } else {
      tableWrap.innerHTML = '<div style="padding:12px;font-family:var(--font-retro);font-size:11px;color:var(--muted);">Geen geldige rijen gevonden.</div>';
    }

    // Fout- en duplicatenlijst
    const errorList = document.getElementById('csv-error-list');
    const errorItems = [
      ...csvErrorRows.flatMap(e => e.errors.map(msg => `Rij ${e.rowNum}: ${msg}`)),
      ...csvSkipRows.map(s => `Rij ${s.rowNum}: "${s.title}" — ${s.artist} (al in songbook, overgeslagen)`)
    ];
    if (errorItems.length > 0) {
      errorList.style.display = 'block';
      errorList.innerHTML =
        '<div style="font-family:var(--font-retro);font-size:10px;letter-spacing:1px;color:var(--muted);margin-bottom:6px;">DETAILS</div>'
        + errorItems.map(e => `<div class="csv-error-item">• ${e}</div>`).join('');
    } else {
      errorList.style.display = 'none';
    }

    // Bevestigingsknop
    const confirmBtn = document.getElementById('btn-confirm-csv-import');
    const labelEl    = document.getElementById('lbl-confirm-csv');
    const count      = csvValidRows.length + csvLinkRows.length;
    if (labelEl) labelEl.textContent = `Importeer ${count} nummer${count !== 1 ? 's' : ''}`;
    confirmBtn.disabled = count === 0;

    document.getElementById('csv-preview-section').style.display = 'block';
  }

  async function confirmCSVImport() {
    if (!csvValidRows.length && !csvLinkRows.length) return;

    const btn   = document.getElementById('btn-confirm-csv-import');
    const label = document.getElementById('lbl-confirm-csv');
    btn.disabled = true;
    if (label) label.textContent = 'Importeren...';

    // Stap 1: insert écht nieuwe songs
    let newIds = [];
    if (csvValidRows.length > 0) {
      const { data: inserted, error } = await db.from('songs')
        .insert(csvValidRows).select('id');
      if (error) {
        showToast('Import mislukt: ' + error.message, 'error');
        btn.disabled = false;
        if (label) label.textContent = `Importeer ${csvValidRows.length + csvLinkRows.length} nummers`;
        return;
      }
      newIds = inserted.map(s => s.id);
    }

    // Stap 2: IDs van songs die al in DB bestonden (enkel koppelen)
    const linkIds = csvLinkRows.map(r => r._existingSongId);
    const allIds  = [...newIds, ...linkIds];

    // Bepaal artist_id: currentArtist, of fallback via gig_artists
    let importArtistId = currentArtist?.id || null;
    if (!importArtistId && currentGig) {
      const { data: ga } = await db.from('gig_artists')
        .select('artist_id').eq('gig_id', currentGig.id).limit(1);
      importArtistId = ga?.[0]?.artist_id || null;
    }

    // Stap 3: artist_songs links aanmaken voor alle IDs
    if (importArtistId && allIds.length) {
      await db.from('artist_songs').insert(
        allIds.map(id => ({ artist_id: importArtistId, song_id: id }))
      );
    }

    // Stap 4: gig_songs voor nieuwe songs direct toevoegen
    if (currentGig && newIds.length) {
      await db.from('gig_songs').insert(
        newIds.map(id => ({ gig_id: currentGig.id, song_id: id, is_active: true, vote_count: 0 }))
      );
    }

    // Stap 5: gig_songs voor al bestaande songs — alleen als ze er nog niet in zitten
    if (currentGig && linkIds.length) {
      const { data: existingGs } = await db.from('gig_songs')
        .select('song_id').eq('gig_id', currentGig.id).in('song_id', linkIds);
      const alreadyIn = new Set((existingGs || []).map(gs => gs.song_id));
      const toAdd = linkIds.filter(id => !alreadyIn.has(id));
      if (toAdd.length) {
        await db.from('gig_songs').insert(
          toAdd.map(id => ({ gig_id: currentGig.id, song_id: id, is_active: true, vote_count: 0 }))
        );
      }
    }

    const skippedTotal = csvSkipRows.length + csvErrorRows.length;
    const msg = skippedTotal > 0
      ? `${allIds.length} nummers gekoppeld, ${skippedTotal} overgeslagen`
      : `${allIds.length} nummers gekoppeld ✓`;

    showToast(msg, 'success');
    closeModal('modal-csv-import');
    loadArtistSongbook();
  }

  // ════════════════════════════════════════════
  // VOTERS POPUP
  // ════════════════════════════════════════════
  let _popupEl = null;

  async function showVoters(event, songId) {
    event.stopPropagation();
    removeVotersPopup();

    // Gebruik gecachte map als beschikbaar, anders haal live op uit DB
    let names = (window._voterMap || {})[songId] || null;
    if (names === null && currentGig) {
      // Haal alle request_ids op voor dit nummer in deze gig
      const { data: reqs } = await db.from('requests')
        .select('id').eq('gig_id', currentGig.id).eq('song_id', songId);
      const reqIds = (reqs || []).map(r => r.id);
      if (reqIds.length > 0) {
        const { data: votes } = await db.from('votes')
          .select('voter_name').in('request_id', reqIds);
        names = (votes || []).map(v => v.voter_name).filter(Boolean);
      } else {
        names = [];
      }
    }

    if (names.length === 0) {
      showToast('Geen namen bekend voor deze likes', '');
      return;
    }

    const popup = document.createElement('div');
    popup.className = 'voters-popup';
    popup.id = 'voters-popup';
    popup.innerHTML = `
      <div class="voters-popup-title">❤ ${names.length} stem${names.length !== 1 ? 'men' : ''}</div>
      ${names.map(n => `<div class="voters-popup-name">${n}</div>`).join('')}
    `;

    document.body.appendChild(popup);
    _popupEl = popup;

    // Positie: boven of onder de klik
    const rect = event.target.getBoundingClientRect();
    const popupH = names.length * 26 + 40;
    const top = rect.bottom + 6 + popupH > window.innerHeight
      ? rect.top - popupH - 6
      : rect.bottom + 6;
    const left = Math.min(rect.left, window.innerWidth - 250);
    popup.style.top  = top  + window.scrollY + 'px';
    popup.style.left = Math.max(8, left) + 'px';

    // Sluit bij klik buiten
    setTimeout(() => {
      document.addEventListener('click', removeVotersPopup, { once: true });
    }, 10);
  }

  function removeVotersPopup() {
    if (_popupEl) { _popupEl.remove(); _popupEl = null; }
  }

  // ════════════════════════════════════════════
  // INSTELLINGEN — NUMMERS PER GIG
  // ════════════════════════════════════════════
  let _settingsSongs = []; // cache voor de instellingen-songlijst
  let _settingsGigIsMultiArtist = false;

  // Normaliseert artiestnaam voor matching: lowercase + strip leading "The "
  function _normArtist(name) {
    return (name || '').trim().toLowerCase().replace(/^the\s+/i, '');
  }

  async function loadSettingsSongList() {
    if (!currentGig) return;
    const listEl = document.getElementById('settings-song-list');
    if (!listEl) return;

    const { data: gigArtists } = await db.from('gig_artists')
      .select('artist_id, artists(name)').eq('gig_id', currentGig.id);
    const artistIds = (gigArtists || []).map(ga => ga.artist_id);
    _settingsGigIsMultiArtist = artistIds.length > 1;

    if (artistIds.length === 0) {
      listEl.innerHTML = '<div style="padding:14px;color:var(--muted);font-size:12px;font-family:var(--font-retro);text-align:center;">Koppel eerst artiesten aan deze gig</div>';
      return;
    }

    const { data: songs } = await db.from('artist_songs')
      .select('song_id, artist_id, artists(name), songs(id,title,original_artist)')
      .in('artist_id', artistIds);

    const { data: gigSongsDb } = await db.from('gig_songs')
      .select('id, song_id, is_active').eq('gig_id', currentGig.id);
    const gigSongMap = {};
    gigSongsDb?.forEach(gs => { gigSongMap[gs.song_id] = { id: gs.id, active: gs.is_active }; });

    // Groepeer op genormaliseerde titel+artiest; meerdere artiesten → overlap
    const groupMap = {};
    (songs || []).forEach(s => {
      if (!s.songs || s.songs.is_active === false) return;
      const key = (s.songs.title || '').trim().toLowerCase() + '|' + _normArtist(s.songs.original_artist);
      if (!groupMap[key]) {
        const gs = gigSongMap[s.songs.id];
        groupMap[key] = {
          id: s.songs.id,
          title: s.songs.title,
          original_artist: s.songs.original_artist,
          _gigSongId: gs?.id || null,
          _gigActive: gs ? gs.active : true,
          artistNames: []
        };
      }
      const aName = s.artists?.name;
      if (aName && !groupMap[key].artistNames.includes(aName)) {
        groupMap[key].artistNames.push(aName);
      }
    });

    _settingsSongs = Object.values(groupMap).sort((a, b) => {
      // Overlap-songs bovenaan, dan alfabetisch
      if (b.artistNames.length !== a.artistNames.length) return b.artistNames.length - a.artistNames.length;
      return (a.title || '').localeCompare(b.title || '');
    });

    renderSettingsSongList(_settingsSongs);
  }

  function renderSettingsSongList(songs) {
    const listEl = document.getElementById('settings-song-list');
    if (!listEl) return;
    if (!songs || songs.length === 0) {
      listEl.innerHTML = '<div style="padding:14px;color:var(--muted);font-size:12px;font-family:var(--font-retro);text-align:center;">Geen nummers gevonden</div>';
      return;
    }
    listEl.innerHTML = songs.map((song, i) => {
      const on = song._gigActive !== false;
      const isSongShared = _settingsGigIsMultiArtist && song.artistNames.length > 1;
      const border = i < songs.length - 1 ? 'border-bottom:1px solid var(--border);' : '';
      // Artiestnaam alleen tonen bij multi-artist gig
      const artistLine = _settingsGigIsMultiArtist
        ? (isSongShared
          ? `<span style="color:var(--neon2);font-weight:600;">★ ${song.artistNames.join(' & ')}</span>`
          : (song.artistNames[0] ? `<span style="color:var(--chrome);">${song.artistNames[0]}</span>` : ''))
        : '';
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;${border}${isSongShared ? 'background:rgba(255,170,0,0.04);' : ''}" id="ssl-${song.id}">
        <div style="flex:1;min-width:0;">
          <div style="font-family:var(--font-display);font-size:16px;color:${on ? 'var(--text)' : 'var(--muted)'};">${song.title}</div>
          <div style="font-size:11px;color:var(--muted);font-family:var(--font-retro);">${song.original_artist || ''}${artistLine ? ' · ' + artistLine : ''}</div>
        </div>
        <button class="toggle ${on ? 'on' : ''}" id="sst-${song.id}"
          onclick="toggleSettingsSong('${song._gigSongId}','${song.id}',this)"
          title="${on ? 'Uitzetten voor deze gig' : 'Aanzetten voor deze gig'}"></button>
      </div>`;
    }).join('');
  }

  function filterSettingsSongs(query) {
    const q = query.toLowerCase();
    const filtered = q
      ? _settingsSongs.filter(s => s.title?.toLowerCase().includes(q) || s.original_artist?.toLowerCase().includes(q))
      : _settingsSongs;
    renderSettingsSongList(filtered);
  }

  async function toggleSettingsSong(gigSongId, songId, btn) {
    const nowOn = !btn.classList.contains('on');
    btn.classList.toggle('on');
    // Update tekst kleur in dezelfde rij
    const row = document.getElementById('ssl-' + songId);
    if (row) {
      const titleEl = row.querySelector('[style*="font-display"]') || row.querySelector('div > div');
      if (titleEl) titleEl.style.color = nowOn ? 'var(--text)' : 'var(--muted)';
    }

    if (gigSongId && gigSongId !== 'null') {
      await db.from('gig_songs').update({ is_active: nowOn }).eq('id', gigSongId);
    } else {
      // Nog geen gig_song record — aanmaken
      const { data: newGs } = await db.from('gig_songs').insert({
        gig_id: currentGig.id, song_id: parseInt(songId),
        is_active: nowOn, vote_count: 0
      }).select('id').single();
      // Update cache
      const song = _settingsSongs.find(s => String(s.id) === String(songId));
      if (song && newGs) song._gigSongId = newGs.id;
    }
    // Update cache
    const song = _settingsSongs.find(s => String(s.id) === String(songId));
    if (song) song._gigActive = nowOn;

    showToast(nowOn ? 'Nummer beschikbaar ✓' : 'Nummer uitgezet', nowOn ? 'success' : '');
    // Sync ook songbook als dat open is
    if (allSongs.length > 0) {
      const sb = allSongs.find(s => String(s.id) === String(songId));
      if (sb) { sb._gigActive = nowOn; }
      const sbList = document.getElementById('artist-songbook-list');
      if (sbList && sbList.innerHTML) renderSongbook(allSongs);
    }
    loadVoterSongs();
  }

  // ════════════════════════════════════════════
  // SONGBOOK — CATEGORIE SYSTEEM
  // ════════════════════════════════════════════

  // Stel de permanente categorie in voor een nummer
  async function setSongCategory(songId, category) {
    const labels = { core: t('cat-core'), optional: t('cat-optional'), archived: t('cat-archived') };
    const { error } = await db.from('songs')
      .update({ song_category: category, is_active: category !== 'archived' })
      .eq('id', songId);
    if (error) { showToast('Opslaan mislukt', 'error'); return; }

    // gig_songs.is_active: archived → altijd uit, anders aan
    // (modus-filtering gebeurt live in loadVoterSongs via repertoire_mode)
    const gigActive = category !== 'archived';
    await db.from('gig_songs').update({ is_active: gigActive }).eq('song_id', songId);

    showToast(labels[category] + ' ingesteld ✓', 'success');
    // Update lokaal in allSongs zonder volledige herlaad
    const s = allSongs.find(x => x.id === songId);
    if (s) { s.song_category = category; s.is_active = category !== 'archived'; }
    renderSongbook(allSongs);
    loadVoterSongs();
  }

  // Wissel de repertoire-modus van de actieve gig
  // repertoire_mode in de gigs tabel is de enige bron van waarheid —
  // geen gig_songs updates nodig, loadVoterSongs leest de modus direct bij elke refresh
  function setLocationType(type, prefix) {
    // prefix is 'settings' or 'new'
    const types = ['physical', 'online', 'hybrid'];
    types.forEach(t => {
      const btn = document.getElementById(`${prefix}-loc-${t}`);
      if (btn) btn.classList.toggle('active', t === type);
    });
    const showPhysical = type === 'physical' || type === 'hybrid';
    const showOnline   = type === 'online'   || type === 'hybrid';
    const pf = document.getElementById(`${prefix}-loc-physical-fields`);
    const of = document.getElementById(`${prefix}-loc-online-fields`);
    if (pf) pf.style.display = showPhysical ? '' : 'none';
    if (of) of.style.display = showOnline   ? '' : 'none';
  }

  async function setRepertoireMode(mode) {
    if (!currentGig) return;
    await db.from('gigs').update({ repertoire_mode: mode }).eq('id', currentGig.id);
    currentGig.repertoire_mode = mode;
    updateRepertoireModeUI(mode);
    showToast(mode === 'core' ? t('mode-core-btn') : t('mode-full-btn'), 'success');
    loadArtistSongbook();
    loadVoterSongs();
  }

  function updateRepertoireModeUI(mode) {
    // Settings knoppen
    ['core','full'].forEach(m => {
      const btn = document.getElementById('mode-btn-' + m);
      if (btn) btn.classList.toggle('active', m === mode);
    });
    // Songbook knoppen
    ['core','full'].forEach(m => {
      const btn = document.getElementById('sb-mode-btn-' + m);
      if (btn) btn.classList.toggle('active', m === mode);
    });
    // Beschrijving
    const desc = document.getElementById('mode-desc');
    if (desc) desc.textContent = mode === 'core' ? t('mode-core-desc') : t('mode-full-desc');
  }


  // ════════════════════════════════════════════
  const artistTabMap = {
    'queue': 'abtab-queue',
    'requests': 'abtab-requests',
    'songbook': 'abtab-songbook',
    'inbox': 'abtab-inbox',
    'settings': 'abtab-settings',
    'history': null // geen bottom tab voor history
  };

  function switchVoterTab(tab, innerEl, btabEl) {
    ['queue','myrequests','request','messages','comments'].forEach(t => {
      const el = document.getElementById('vtab-' + t);
      if (el) el.style.display = t === tab ? 'block' : 'none';
    });
    // Sync inner tabs
    document.querySelectorAll('#view-voter .itab').forEach(t => t.classList.remove('active'));
    const innerTabEl = innerEl || document.getElementById('itab-' + tab);
    if (innerTabEl) innerTabEl.classList.add('active');
    // Sync bottom tabs
    document.querySelectorAll('#view-voter .btab').forEach(t => t.classList.remove('active'));
    const btab = btabEl || document.getElementById('vbtab-' + tab);
    if (btab) btab.classList.add('active');

    if (tab === 'comments') loadComments();
    if (tab === 'request') loadVoterSongs(document.getElementById('voter-search').value);
    if (tab === 'myrequests') loadMyRequests();
  }

  function switchArtistTab(tab, innerEl, btabEl) {
    ['queue','requests','songbook','inbox','history','settings'].forEach(t => {
      const el = document.getElementById('atab-' + t);
      if (el) el.style.display = t === tab ? 'block' : 'none';
    });
    // Sync inner tabs
    document.querySelectorAll('#view-artist .itab').forEach(t => t.classList.remove('active'));
    if (innerEl) innerEl.classList.add('active');
    // Sync bottom tabs (punt 11)
    document.querySelectorAll('#view-artist .btab').forEach(t => t.classList.remove('active'));
    const btabId = artistTabMap[tab];
    const btab = btabEl || (btabId ? document.getElementById(btabId) : null);
    if (btab) btab.classList.add('active');
  }

  function filterSongs(query) { loadVoterSongs(query); }

  // ════════════════════════════════════════════
  // STAR RATING
  // ════════════════════════════════════════════
  function setRating(n) {
    currentRating = n;
    document.querySelectorAll('#star-rating span').forEach((s, i) => {
      s.textContent = i < n ? '★' : '☆';
      s.style.color = i < n ? 'var(--neon2)' : 'var(--muted)';
    });
  }

  // ════════════════════════════════════════════
  // MODALS
  // ════════════════════════════════════════════
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
  });

  // ════════════════════════════════════════════
  // QR + LOGOUT
  // ════════════════════════════════════════════
  function copyQR() {
    const link = document.getElementById('qr-link').textContent;
    navigator.clipboard.writeText(link).catch(() => {
      // Fallback
      const el = document.createElement('textarea');
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
    showToast('Link gekopieerd! 📋', 'success');
  }

  async function logout() {
    await db.auth.signOut();
    currentUser = null; currentGig = null; currentArtist = null;
    allSongs = [];
    playedCountThisSession = 0;
    const sbList = document.getElementById('artist-songbook-list');
    if (sbList) sbList.innerHTML = '';
    showView('view-landing');
  }

  async function voterLogout() {
    await db.auth.signOut();
    voterAuthUser = null;
    voterSession = null;
    currentGig = null;
    arrivedViaQR = false;
    showView('view-landing');
  }

  // ════════════════════════════════════════════
  // TOAST
  // ════════════════════════════════════════════
  function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + type;
    setTimeout(() => t.className = 'toast', 2500);
  }

  // ════════════════════════════════════════════
  // PUNT 2 & 15: URL-based gig routing + app icon fix
  // ════════════════════════════════════════════
  async function checkGigUrl() {
    const params = new URLSearchParams(window.location.search);
    const gigToken = params.get('gig') || params.get('token');
    if (gigToken) {
      showView('view-voter-landing');
      await loadLiveGigs();
    }
  }

  // ════════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════════
  document.querySelectorAll(".lang-btn[data-lang]").forEach(btn => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });
  // Restore saved language on load
  if (currentLang !== 'nl') setLang(currentLang);

  (async () => {
    try {
    // Check URL voor gig token
    await checkGigUrl();

    const { data: { session } } = await db.auth.getSession();
    if (!session) return;

    // Probeer eerst artist/admin login
    let { data: _uRows2 } = await db.from('users')
      .select('id, role, display_name, auth_id').eq('auth_id', session.user.id).limit(1);
    let _userData2 = _uRows2?.[0] || null;
    if (!_userData2) {
      const { data: _uByEmail2 } = await db.from('users')
        .select('id, role, display_name, auth_id').eq('email', session.user.email).limit(1);
      _userData2 = _uByEmail2?.[0] || null;
      if (_userData2 && !_userData2.auth_id) {
        await db.from('users').update({ auth_id: session.user.id }).eq('id', _userData2.id);
      }
    }

    if (_userData2) {
      // Artist / admin login
      currentUser = {
        ...session.user,
        id: _userData2.id,
        auth_id: session.user.id,
        role: _userData2.role || 'artist',
        name: _userData2.display_name || session.user.email
      };
      const badge = document.getElementById('artist-role-badge');
      badge.textContent = currentUser.role === 'admin' ? 'ADMIN' : 'ARTIEST';
      badge.className = currentUser.role === 'admin' ? 'badge badge-red' : 'badge badge-chrome';
      if (currentUser.role === 'admin') {
        document.getElementById('admin-direct-add').style.display = 'block';
      }
      showView('view-artist');
      await loadArtistData();

      if (currentGig) {
        const { count } = await db.from('requests')
          .select('*', { count: 'exact', head: true })
          .eq('gig_id', currentGig.id).eq('status', 'played');
        if (count) document.getElementById('stat-played').textContent = count;
      }
      return; // artist login afgehandeld
    }

    // Geen artist gevonden — check voter profiel (gecachede login)
    const { data: voterProfile } = await db.from('voter_profiles')
      .select('display_name').eq('id', session.user.id).single();
    if (voterProfile) {
      voterAuthUser = session.user;
      if (selectedVoterGig) {
        // Gig al bekend via QR — direct doorgaan
        await _enterAsVoterWithAuth(voterProfile.display_name);
      } else {
        // Geen gig in URL — toon voter landing zodat ze er één kunnen kiezen
        showView('view-voter-landing');
        await loadLiveGigs();
      }
    }
    } catch (e) {
      console.error('Init fout:', e);
      showView('view-landing'); // fallback: toon landingspagina bij elke fout
    }
  })();