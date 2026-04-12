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
  let playedCountThisSession = 0; // punt 10: teller bewaren in geheugen

  // ════════════════════════════════════════════
  // MEERTALIGHEID (punt 8)
  // ════════════════════════════════════════════
  const translations = {
    nl: {
      'lbl-role-choice': 'BEN JE BEZOEKER OF ARTIEST?',
      'lbl-visitor': 'Bezoeker — Aanvragen & Stemmen',
      'lbl-artist': 'Artiest / DJ Inloggen',
      'lbl-login-title': 'Inloggen',
      'lbl-email': 'E-mailadres',
      'lbl-password': 'Wachtwoord',
      'lbl-do-login': 'Inloggen',
      'lbl-back': 'Terug',
      'lbl-voter-subtitle': '✦ Vraag jouw nummer aan ✦',
      'lbl-tonight': 'VANAVOND LIVE',
      'lbl-your-name': 'Jouw naam (optioneel)',
      'lbl-enter-jukebox': 'Ga naar de Jukebox →',
      'lbl-now-playing': 'Nu Speelt',
      'itab-queue': 'Wachtrij',
      'itab-myrequests': 'Mijn Aanvragen',
      'itab-request': 'Aanvragen',
      'itab-messages': 'Berichten',
      'itab-comments': 'Reviews',
      'btab-queue': 'Wachtrij',
      'btab-search': 'Zoeken',
      'btab-mine': 'Mijn',
      'btab-messages': 'Berichten',
      'btab-reviews': 'Reviews',
      'lbl-queue-title': 'Wachtrij',
      'lbl-send-msg': 'Stuur een Bericht',
      'lbl-msg-label': 'Jouw berichtje aan de artiest',
      'lbl-send-msg-btn': 'Versturen',
      'lbl-review-title': 'LAAT EEN REVIEW ACHTER',
      'lbl-review-name': 'Jouw naam *',
      'lbl-review-song': 'Over welk nummer? (optioneel)',
      'lbl-rating': 'Beoordeling',
      'lbl-review-text': 'Je reactie',
      'lbl-submit-review-btn': 'Review Plaatsen',
      'lbl-reviews-title': 'Reviews',
      'lbl-req-msg': 'Berichtje (optioneel)',
      'lbl-cancel-btn': 'Annuleren',
      'btn-request-text': 'Aanvragen!',
      'lbl-tagline': '✦ Live Muziek op het Podium ✦',
      'lbl-now-playing-empty': 'Nog niets aan het spelen',
      'lbl-no-messages-voter': 'Nog geen berichten',
      'lbl-no-requests': 'Je hebt nog geen nummers aangevraagd',
      'voter-logo-sub': '\u2756 Live Muziek \u2756',
      'artist-logo-sub': '\u2756 Artiest Panel \u2756',
      'divider-myrequests': 'Mijn Aanvragen',
      'ph-email': 'jij@voorbeeld.nl',
      'ph-voter-name': 'bijv. Sarah',
      'ph-search-song': 'Zoek een nummer of artiest...',
      'ph-msg-text': 'bijv. \"Kun je iets van The Beatles spelen? \ud83c\udfb8\"',
      'ph-required': 'Verplicht',
      'ph-comment-text': 'Wat vond je van het optreden?',
      'ph-search-songbook': 'Zoek in je songbook...',
      'ph-gig-name': 'Naam van het optreden',
      'ph-gig-venue': 'Caf\u00e9, Zaal, etc.',
      'ph-song-title': 'Naam van het nummer',
      'ph-song-artist': 'bijv. Eagles',
      'ph-new-gig-name': 'bijv. Vrijdagavond in Caf\u00e9 de Zon',
      'ph-new-gig-venue': 'Caf\u00e9, Zaal, etc.',
      'status-pending': '\u23f3 In behandeling',
      'status-approved': '\u2713 Goedgekeurd',
      'status-queued': '\ud83c\udfb5 In wachtrij',
      'status-playing': '\u25b6 Wordt gespeeld',
      'status-played': '\u2713 Gespeeld',
      'status-rejected': '\u2717 Afgewezen',
      'empty-queue-artist': 'Wachtrij is leeg. Keur aanvragen goed om te beginnen.',
      'empty-queue-voter': 'Wachtrij is leeg. Vraag als eerste een nummer aan!',
      'empty-requests': 'Geen nieuwe aanvragen',
      'empty-songs': 'Geen nummers beschikbaar',
      'empty-songbook': 'Geen nummers in je songbook',
      'empty-messages': 'Nog geen berichten',
      'empty-history': 'Nog geen gig historie',
      'empty-reviews': 'Nog geen reviews',
      'lbl-approve': '\u2713 Goedkeuren',
      'lbl-reject': '\u2717 Afwijzen',
      'lbl-played': '\u2713 Gespeeld',
      'lbl-votes': 'stemmen',
      'lbl-requested-by': 'Aangevraagd door',
      'lbl-anonymous': 'Anoniem',
      'lbl-new': 'nieuw',
      'lbl-no-active-gig': 'Geen actieve gig',
      'confirm-close-gig': 'Wil je de gig echt afsluiten?',
      'lbl-close-gig': 'Gig Afsluiten',
      'lbl-activate-gig': 'Activeer',
      'lbl-gig-artists': 'Artiesten',
      'lbl-settings-artists': 'Artiesten',
      'lbl-create-one': 'maak er een aan',
      'lbl-logout': 'Uit',
      'stat-lbl-queue': 'Wachtrij',
      'stat-lbl-played': 'Gespeeld',
      'stat-lbl-messages': 'Berichten',
      'atab-lbl-queue': 'Wachtrij',
      'atab-lbl-requests': 'Aanvragen',
      'atab-lbl-songbook': 'Songbook',
      'atab-lbl-history': 'Historie',
      'atab-lbl-settings': 'Instellingen',
      'lbl-live-queue-header': 'Live Wachtrij — versleep om te sorteren',
      'lbl-new-requests-header': 'Nieuwe Aanvragen',
      'lbl-new-gig-banner-title': 'Nieuwe Gig Aanmaken',
      'lbl-new-gig-banner-sub': 'Start een nieuw optreden',
      'btn-new-gig': '+ Nieuwe Gig',
      'lbl-my-songbook': 'Mijn Songbook',
      'btn-add-song': '+ Nummer',
      'lbl-inbox-header': 'Berichten van Bezoekers',
      'btn-all-read': 'Alles gelezen',
      'lbl-history-header': 'Gig Historie',
      'lbl-settings-header': 'Gig Instellingen',
      'lbl-gig-naam': 'Gig Naam',
      'lbl-locatie': 'Locatie',
      'lbl-allow-requests': 'Aanvragen toestaan',
      'lbl-allow-requests-sub': 'Publiek kan nummers aanvragen',
      'lbl-allow-votes': 'Stemmen toestaan',
      'lbl-allow-votes-sub': 'Publiek kan stemmen op aanvragen',
      'lbl-show-karaoke': 'Lyrics optie tonen',
      'lbl-show-karaoke-sub': 'Lyrics badge zichtbaar voor publiek',
      'lbl-gig-live': 'Gig is LIVE',
      'lbl-gig-live-sub': 'Zichtbaar voor publiek via QR-code',
      'lbl-qr-label': 'QR-Code & Link',
      'btn-copy-link': 'Link Kopiëren',
      'btn-download-qr': 'QR Downloaden',
      'btn-save-settings': 'Instellingen Opslaan',
      'abtab-lbl-live': 'Live',
      'abtab-lbl-requests': 'Aanvragen',
      'abtab-lbl-songbook': 'Songbook',
      'abtab-lbl-inbox': 'Inbox',
      'abtab-lbl-settings': 'Instellingen',
      'lbl-modal-request-title': 'Nummer Aanvragen',
      'lbl-modal-song-title': 'Nummer Toevoegen',
      'lbl-song-title-label': 'Titel *',
      'lbl-song-artist-label': 'Originele Artiest *',
      'lbl-song-key': 'Toonsoort',
      'lbl-song-ug': 'Ultimate Guitar URL',
      'lbl-song-karaoke-url': 'Lyrics URL (optioneel)',
      'lbl-song-karaoke-toggle': 'Lyrics beschikbaar',
      'btn-cancel-song': 'Annuleren',
      'btn-save-song': 'Opslaan',
      'lbl-gig-detail': 'Gig Detail',
      'btn-close-history': 'Sluiten',
      'lbl-new-gig-modal-title': 'Nieuwe Gig Aanmaken',
      'lbl-new-gig-naam': 'Gig Naam *',
      'lbl-new-gig-locatie': 'Locatie',
      'lbl-new-gig-datum': 'Datum',
      'btn-cancel-new-gig': 'Annuleren',
      'btn-create-gig': 'Gig Aanmaken',
      'lbl-admin-add': 'Direct toevoegen aan wachtrij',
      'lbl-choose-song': '— Kies een nummer —',
      'btn-add-to-queue': '+ Wachtrij',
      'toast-request-sent': 'Aanvraag verzonden! 🎵',
      'toast-voted': 'Stem uitgebracht! ❤️',
      'toast-welcome-back': 'Welkom terug! 🎸',
      'toast-order-updated': 'Volgorde aangepast ✓',
      'toast-gig-offline': 'Gig offline gezet',
      'toast-gig-live': 'Gig is nu LIVE! 🎸',
      'opt-general-review': '— Algemene review over het optreden —',
      'toast-gig-switched': 'Gig gewisseld ✓',
      'toast-gig-closed': 'Gig afgesloten ✓',
    },
    en: {
      'lbl-role-choice': 'ARE YOU A VISITOR OR ARTIST?',
      'lbl-visitor': 'Visitor — Request & Vote',
      'lbl-artist': 'Artist / DJ Login',
      'lbl-login-title': 'Login',
      'lbl-email': 'Email address',
      'lbl-password': 'Password',
      'lbl-do-login': 'Login',
      'lbl-back': 'Back',
      'lbl-voter-subtitle': '✦ Request your song ✦',
      'lbl-tonight': 'TONIGHT LIVE',
      'lbl-your-name': 'Your name (optional)',
      'lbl-enter-jukebox': 'Enter the Jukebox →',
      'lbl-now-playing': 'Now Playing',
      'itab-queue': 'Queue',
      'itab-myrequests': 'My Requests',
      'itab-request': 'Request',
      'itab-messages': 'Messages',
      'itab-comments': 'Reviews',
      'btab-queue': 'Queue',
      'btab-search': 'Search',
      'btab-mine': 'Mine',
      'btab-messages': 'Messages',
      'btab-reviews': 'Reviews',
      'lbl-queue-title': 'Queue',
      'lbl-send-msg': 'Send a Message',
      'lbl-msg-label': 'Your message to the artist',
      'lbl-send-msg-btn': 'Send',
      'lbl-review-title': 'LEAVE A REVIEW',
      'lbl-review-name': 'Your name *',
      'lbl-review-song': 'About which song? (optional)',
      'lbl-rating': 'Rating',
      'lbl-review-text': 'Your review',
      'lbl-submit-review-btn': 'Post Review',
      'lbl-reviews-title': 'Reviews',
      'lbl-req-msg': 'Message (optional)',
      'lbl-cancel-btn': 'Cancel',
      'btn-request-text': 'Request!',
      'lbl-tagline': '✦ Live Music on Stage ✦',
      'lbl-now-playing-empty': 'Nothing playing yet',
      'lbl-no-messages-voter': 'No messages yet',
      'lbl-no-requests': 'You have not requested any songs yet',
      'voter-logo-sub': '\u2756 Live Music \u2756',
      'artist-logo-sub': '\u2756 Artist Panel \u2756',
      'divider-myrequests': 'My Requests',
      'ph-email': 'you@example.com',
      'ph-voter-name': 'e.g. Sarah',
      'ph-search-song': 'Search a song or artist...',
      'ph-msg-text': 'e.g. \"Can you play something by The Beatles? \ud83c\udfb8\"',
      'ph-required': 'Required',
      'ph-comment-text': 'What did you think of the performance?',
      'ph-search-songbook': 'Search your songbook...',
      'ph-gig-name': 'Name of the performance',
      'ph-gig-venue': 'Caf\u00e9, Hall, etc.',
      'ph-song-title': 'Name of the song',
      'ph-song-artist': 'e.g. Eagles',
      'ph-new-gig-name': 'e.g. Friday Night at The Crown',
      'ph-new-gig-venue': 'Caf\u00e9, Hall, etc.',
      'status-pending': '\u23f3 Pending',
      'status-approved': '\u2713 Approved',
      'status-queued': '\ud83c\udfb5 Queued',
      'status-playing': '\u25b6 Now Playing',
      'status-played': '\u2713 Played',
      'status-rejected': '\u2717 Rejected',
      'empty-queue-artist': 'Queue is empty. Approve requests to get started.',
      'empty-queue-voter': 'Queue is empty. Be the first to request a song!',
      'empty-requests': 'No new requests',
      'empty-songs': 'No songs available',
      'empty-songbook': 'No songs in your songbook',
      'empty-messages': 'No messages yet',
      'empty-history': 'No gig history yet',
      'empty-reviews': 'No reviews yet',
      'lbl-approve': '\u2713 Approve',
      'lbl-reject': '\u2717 Reject',
      'lbl-played': '\u2713 Played',
      'lbl-votes': 'votes',
      'lbl-requested-by': 'Requested by',
      'lbl-anonymous': 'Anonymous',
      'lbl-new': 'new',
      'lbl-no-active-gig': 'No active gig',
      'confirm-close-gig': 'Are you sure you want to close this gig?',
      'lbl-close-gig': 'Close Gig',
      'lbl-activate-gig': 'Activate',
      'lbl-gig-artists': 'Artists',
      'lbl-settings-artists': 'Artists',
      'lbl-create-one': 'create one',
      'lbl-logout': 'Logout',
      'stat-lbl-queue': 'Queue',
      'stat-lbl-played': 'Played',
      'stat-lbl-messages': 'Messages',
      'atab-lbl-queue': 'Queue',
      'atab-lbl-requests': 'Requests',
      'atab-lbl-songbook': 'Songbook',
      'atab-lbl-history': 'History',
      'atab-lbl-settings': 'Settings',
      'lbl-live-queue-header': 'Live Queue — drag to reorder',
      'lbl-new-requests-header': 'New Requests',
      'lbl-new-gig-banner-title': 'Create New Gig',
      'lbl-new-gig-banner-sub': 'Start a new performance',
      'btn-new-gig': '+ New Gig',
      'lbl-my-songbook': 'My Songbook',
      'btn-add-song': '+ Song',
      'lbl-inbox-header': 'Messages from Visitors',
      'btn-all-read': 'Mark all read',
      'lbl-history-header': 'Gig History',
      'lbl-settings-header': 'Gig Settings',
      'lbl-gig-naam': 'Gig Name',
      'lbl-locatie': 'Venue',
      'lbl-allow-requests': 'Allow requests',
      'lbl-allow-requests-sub': 'Audience can request songs',
      'lbl-allow-votes': 'Allow voting',
      'lbl-allow-votes-sub': 'Audience can vote on requests',
      'lbl-show-karaoke': 'Show lyrics option',
      'lbl-show-karaoke-sub': 'Lyrics badge visible to audience',
      'lbl-gig-live': 'Gig is LIVE',
      'lbl-gig-live-sub': 'Visible to audience via QR code',
      'lbl-qr-label': 'QR Code & Link',
      'btn-copy-link': 'Copy Link',
      'btn-download-qr': 'Download QR',
      'btn-save-settings': 'Save Settings',
      'abtab-lbl-live': 'Live',
      'abtab-lbl-requests': 'Requests',
      'abtab-lbl-songbook': 'Songbook',
      'abtab-lbl-inbox': 'Inbox',
      'abtab-lbl-settings': 'Settings',
      'lbl-modal-request-title': 'Request Song',
      'lbl-modal-song-title': 'Add Song',
      'lbl-song-title-label': 'Title *',
      'lbl-song-artist-label': 'Original Artist *',
      'lbl-song-key': 'Key',
      'lbl-song-ug': 'Ultimate Guitar URL',
      'lbl-song-karaoke-url': 'Lyrics URL (optional)',
      'lbl-song-karaoke-toggle': 'Lyrics available',
      'btn-cancel-song': 'Cancel',
      'btn-save-song': 'Save',
      'lbl-gig-detail': 'Gig Detail',
      'btn-close-history': 'Close',
      'lbl-new-gig-modal-title': 'Create New Gig',
      'lbl-new-gig-naam': 'Gig Name *',
      'lbl-new-gig-locatie': 'Venue',
      'lbl-new-gig-datum': 'Date',
      'btn-cancel-new-gig': 'Cancel',
      'btn-create-gig': 'Create Gig',
      'lbl-admin-add': 'Add directly to queue',
      'lbl-choose-song': '— Choose a song —',
      'btn-add-to-queue': '+ Queue',
      'toast-request-sent': 'Request sent! 🎵',
      'toast-voted': 'Vote cast! ❤️',
      'toast-welcome-back': 'Welcome back! 🎸',
      'toast-order-updated': 'Order updated ✓',
      'toast-gig-offline': 'Gig taken offline',
      'toast-gig-live': 'Gig is now LIVE! 🎸',
      'opt-general-review': '— General review of the performance —',
      'toast-gig-switched': 'Gig switched ✓',
      'toast-gig-closed': 'Gig closed ✓',
    },
    fr: {
      'lbl-role-choice': 'ÊTES-VOUS VISITEUR OU ARTISTE?',
      'lbl-visitor': 'Visiteur — Demander & Voter',
      'lbl-artist': 'Artiste / DJ Se connecter',
      'lbl-login-title': 'Connexion',
      'lbl-email': 'Adresse e-mail',
      'lbl-password': 'Mot de passe',
      'lbl-do-login': 'Se connecter',
      'lbl-back': 'Retour',
      'lbl-voter-subtitle': '✦ Demandez votre chanson ✦',
      'lbl-tonight': 'CE SOIR EN LIVE',
      'lbl-your-name': 'Votre prénom (optionnel)',
      'lbl-enter-jukebox': 'Entrer dans le Jukebox →',
      'lbl-now-playing': 'En ce moment',
      'itab-queue': 'File',
      'itab-myrequests': 'Mes demandes',
      'itab-request': 'Demander',
      'itab-messages': 'Messages',
      'itab-comments': 'Avis',
      'btab-queue': 'File',
      'btab-search': 'Chercher',
      'btab-mine': 'Moi',
      'btab-messages': 'Messages',
      'btab-reviews': 'Avis',
      'lbl-queue-title': "File d'attente",
      'lbl-send-msg': 'Envoyer un message',
      'lbl-msg-label': "Votre message à l'artiste",
      'lbl-send-msg-btn': 'Envoyer',
      'lbl-review-title': 'LAISSER UN AVIS',
      'lbl-review-name': 'Votre prénom *',
      'lbl-review-song': 'Pour quelle chanson? (optionnel)',
      'lbl-rating': 'Note',
      'lbl-review-text': 'Votre commentaire',
      'lbl-submit-review-btn': "Publier l'avis",
      'lbl-reviews-title': 'Avis',
      'lbl-req-msg': 'Message (optionnel)',
      'lbl-cancel-btn': 'Annuler',
      'btn-request-text': 'Demander!',
      'lbl-tagline': '✦ Musique Live sur Scène ✦',
      'lbl-now-playing-empty': 'Rien en cours',
      'lbl-no-messages-voter': "Aucun message pour l'instant",
      'lbl-no-requests': "Vous n'avez pas encore demand\u00e9 de chanson",
      'voter-logo-sub': '\u2756 Musique Live \u2756',
      'artist-logo-sub': '\u2756 Panneau Artiste \u2756',
      'divider-myrequests': 'Mes demandes',
      'ph-email': 'vous@exemple.fr',
      'ph-voter-name': 'ex. Sarah',
      'ph-search-song': 'Rechercher une chanson ou artiste...',
      'ph-msg-text': 'ex. \"Pouvez-vous jouer du Beatles? \ud83c\udfb8\"',
      'ph-required': 'Obligatoire',
      'ph-comment-text': "Qu'avez-vous pens\u00e9 du spectacle?",
      'ph-search-songbook': 'Rechercher dans votre r\u00e9pertoire...',
      'ph-gig-name': 'Nom du spectacle',
      'ph-gig-venue': 'Caf\u00e9, Salle, etc.',
      'ph-song-title': 'Nom de la chanson',
      'ph-song-artist': 'ex. Eagles',
      'ph-new-gig-name': 'ex. Vendredi soir au Bar du Coin',
      'ph-new-gig-venue': 'Caf\u00e9, Salle, etc.',
      'status-pending': '\u23f3 En attente',
      'status-approved': '\u2713 Approuv\u00e9',
      'status-queued': '\ud83c\udfb5 En file',
      'status-playing': '\u25b6 En cours',
      'status-played': '\u2713 Jou\u00e9',
      'status-rejected': '\u2717 Rejet\u00e9',
      'empty-queue-artist': "File vide. Approuvez des demandes pour commencer.",
      'empty-queue-voter': "File vide. Soyez le premier \u00e0 demander une chanson!",
      'empty-requests': 'Aucune nouvelle demande',
      'empty-songs': 'Aucune chanson disponible',
      'empty-songbook': 'Aucune chanson dans votre r\u00e9pertoire',
      'empty-messages': "Aucun message pour l'instant",
      'empty-history': 'Aucun historique de concert',
      'empty-reviews': 'Aucun avis pour l instant',
      'lbl-approve': '\u2713 Approuver',
      'lbl-reject': '\u2717 Rejeter',
      'lbl-played': '\u2713 Jou\u00e9',
      'lbl-votes': 'votes',
      'lbl-requested-by': 'Demand\u00e9 par',
      'lbl-anonymous': 'Anonyme',
      'lbl-new': 'nouveau',
      'lbl-no-active-gig': 'Aucun concert actif',
      'confirm-close-gig': 'Voulez-vous vraiment terminer ce concert?',
      'lbl-close-gig': 'Terminer le concert',
      'lbl-activate-gig': 'Activer',
      'lbl-gig-artists': 'Artistes',
      'lbl-settings-artists': 'Artistes',
      'lbl-create-one': 'créez-en un',
      'lbl-logout': 'Déconnexion',
      'stat-lbl-queue': 'File',
      'stat-lbl-played': 'Joué',
      'stat-lbl-messages': 'Messages',
      'atab-lbl-queue': 'File',
      'atab-lbl-requests': 'Demandes',
      'atab-lbl-songbook': 'Répertoire',
      'atab-lbl-history': 'Historique',
      'atab-lbl-settings': 'Paramètres',
      'lbl-live-queue-header': 'File en direct — glisser pour trier',
      'lbl-new-requests-header': 'Nouvelles demandes',
      'lbl-new-gig-banner-title': 'Créer un concert',
      'lbl-new-gig-banner-sub': 'Démarrer un nouveau spectacle',
      'btn-new-gig': '+ Nouveau concert',
      'lbl-my-songbook': 'Mon répertoire',
      'btn-add-song': '+ Chanson',
      'lbl-inbox-header': 'Messages des visiteurs',
      'btn-all-read': 'Tout marquer lu',
      'lbl-history-header': 'Historique des concerts',
      'lbl-settings-header': 'Paramètres du concert',
      'lbl-gig-naam': 'Nom du concert',
      'lbl-locatie': 'Lieu',
      'lbl-allow-requests': 'Autoriser les demandes',
      'lbl-allow-requests-sub': 'Le public peut demander des chansons',
      'lbl-allow-votes': 'Autoriser les votes',
      'lbl-allow-votes-sub': 'Le public peut voter pour les demandes',
      'lbl-show-karaoke': 'Afficher option lyrics',
      'lbl-show-karaoke-sub': 'Badge lyrics visible pour le public',
      'lbl-gig-live': 'Concert est EN DIRECT',
      'lbl-gig-live-sub': 'Visible pour le public via QR code',
      'lbl-qr-label': 'QR Code & Lien',
      'btn-copy-link': 'Copier le lien',
      'btn-download-qr': 'Télécharger QR',
      'btn-save-settings': 'Enregistrer',
      'abtab-lbl-live': 'Direct',
      'abtab-lbl-requests': 'Demandes',
      'abtab-lbl-songbook': 'Répertoire',
      'abtab-lbl-inbox': 'Boîte',
      'abtab-lbl-settings': 'Réglages',
      'lbl-modal-request-title': 'Demander une chanson',
      'lbl-modal-song-title': 'Ajouter une chanson',
      'lbl-song-title-label': 'Titre *',
      'lbl-song-artist-label': 'Artiste original *',
      'lbl-song-key': 'Tonalité',
      'lbl-song-ug': 'URL Ultimate Guitar',
      'lbl-song-karaoke-url': 'URL Lyrics (optionnel)',
      'lbl-song-karaoke-toggle': 'Lyrics disponible',
      'btn-cancel-song': 'Annuler',
      'btn-save-song': 'Enregistrer',
      'lbl-gig-detail': 'Détail du concert',
      'btn-close-history': 'Fermer',
      'lbl-new-gig-modal-title': 'Créer un concert',
      'lbl-new-gig-naam': 'Nom du concert *',
      'lbl-new-gig-locatie': 'Lieu',
      'lbl-new-gig-datum': 'Date',
      'btn-cancel-new-gig': 'Annuler',
      'btn-create-gig': 'Créer le concert',
      'lbl-admin-add': 'Ajouter directement à la file',
      'lbl-choose-song': '— Choisir une chanson —',
      'btn-add-to-queue': '+ File',
      'toast-request-sent': 'Demande envoyée! 🎵',
      'toast-voted': 'Vote enregistré! ❤️',
      'toast-welcome-back': 'Bon retour! 🎸',
      'toast-order-updated': 'Ordre mis à jour ✓',
      'toast-gig-offline': 'Concert mis hors ligne',
      'toast-gig-live': 'Concert en DIRECT! 🎸',
      'opt-general-review': '— Avis général sur le spectacle —',
      'toast-gig-switched': 'Concert changé ✓',
      'toast-gig-closed': 'Concert terminé ✓',
    },
    de: {
      'lbl-role-choice': 'BIST DU BESUCHER ODER KÜNSTLER?',
      'lbl-visitor': 'Besucher — Anfragen & Abstimmen',
      'lbl-artist': 'Künstler / DJ Anmelden',
      'lbl-login-title': 'Anmelden',
      'lbl-email': 'E-Mail-Adresse',
      'lbl-password': 'Passwort',
      'lbl-do-login': 'Anmelden',
      'lbl-back': 'Zurück',
      'lbl-voter-subtitle': '✦ Frag deinen Song an ✦',
      'lbl-tonight': 'HEUTE ABEND LIVE',
      'lbl-your-name': 'Dein Name (optional)',
      'lbl-enter-jukebox': 'Zur Jukebox →',
      'lbl-now-playing': 'Gerade gespielt',
      'itab-queue': 'Warteschlange',
      'itab-myrequests': 'Meine Anfragen',
      'itab-request': 'Anfragen',
      'itab-messages': 'Nachrichten',
      'itab-comments': 'Bewertungen',
      'btab-queue': 'Warteschlange',
      'btab-search': 'Suchen',
      'btab-mine': 'Meine',
      'btab-messages': 'Nachrichten',
      'btab-reviews': 'Bewertungen',
      'lbl-queue-title': 'Warteschlange',
      'lbl-send-msg': 'Nachricht senden',
      'lbl-msg-label': 'Deine Nachricht an den Künstler',
      'lbl-send-msg-btn': 'Senden',
      'lbl-review-title': 'BEWERTUNG HINTERLASSEN',
      'lbl-review-name': 'Dein Name *',
      'lbl-review-song': 'Für welchen Song? (optional)',
      'lbl-rating': 'Bewertung',
      'lbl-review-text': 'Dein Kommentar',
      'lbl-submit-review-btn': 'Bewertung posten',
      'lbl-reviews-title': 'Bewertungen',
      'lbl-req-msg': 'Nachricht (optional)',
      'lbl-cancel-btn': 'Abbrechen',
      'btn-request-text': 'Anfragen!',
      'lbl-tagline': '✦ Live Musik auf der Bühne ✦',
      'lbl-now-playing-empty': 'Noch nichts gespielt',
      'lbl-no-messages-voter': 'Noch keine Nachrichten',
      'lbl-no-requests': 'Du hast noch keine Songs angefragt',
      'voter-logo-sub': '\u2756 Live Musik \u2756',
      'artist-logo-sub': '\u2756 K\u00fcnstler Panel \u2756',
      'divider-myrequests': 'Meine Anfragen',
      'ph-email': 'du@beispiel.de',
      'ph-voter-name': 'z.B. Sarah',
      'ph-search-song': 'Song oder K\u00fcnstler suchen...',
      'ph-msg-text': 'z.B. \"Kannst du etwas von The Beatles spielen? \ud83c\udfb8\"',
      'ph-required': 'Pflichtfeld',
      'ph-comment-text': 'Was dachtest du \u00fcber die Auff\u00fchrung?',
      'ph-search-songbook': 'Songbook durchsuchen...',
      'ph-gig-name': 'Name des Auftritts',
      'ph-gig-venue': 'Caf\u00e9, Halle, etc.',
      'ph-song-title': 'Name des Songs',
      'ph-song-artist': 'z.B. Eagles',
      'ph-new-gig-name': 'z.B. Freitagabend im Caf\u00e9',
      'ph-new-gig-venue': 'Caf\u00e9, Halle, etc.',
      'status-pending': '\u23f3 In Bearbeitung',
      'status-approved': '\u2713 Genehmigt',
      'status-queued': '\ud83c\udfb5 In Warteschlange',
      'status-playing': '\u25b6 Wird gespielt',
      'status-played': '\u2713 Gespielt',
      'status-rejected': '\u2717 Abgelehnt',
      'empty-queue-artist': 'Warteschlange leer. Anfragen genehmigen zum Starten.',
      'empty-queue-voter': 'Warteschlange leer. Sei der Erste der einen Song anfragt!',
      'empty-requests': 'Keine neuen Anfragen',
      'empty-songs': 'Keine Songs verf\u00fcgbar',
      'empty-songbook': 'Keine Songs im Songbook',
      'empty-messages': 'Noch keine Nachrichten',
      'empty-history': 'Noch keine Gig-Historie',
      'empty-reviews': 'Noch keine Bewertungen',
      'lbl-approve': '\u2713 Genehmigen',
      'lbl-reject': '\u2717 Ablehnen',
      'lbl-played': '\u2713 Gespielt',
      'lbl-votes': 'Stimmen',
      'lbl-requested-by': 'Angefragt von',
      'lbl-anonymous': 'Anonym',
      'lbl-new': 'neu',
      'lbl-no-active-gig': 'Kein aktiver Auftritt',
      'confirm-close-gig': 'Möchten Sie den Auftritt wirklich beenden?',
      'lbl-close-gig': 'Auftritt beenden',
      'lbl-activate-gig': 'Aktivieren',
      'lbl-gig-artists': 'Künstler',
      'lbl-settings-artists': 'Künstler',
      'lbl-create-one': 'erstelle einen',
      'lbl-logout': 'Abmelden',
      'stat-lbl-queue': 'Warteschlange',
      'stat-lbl-played': 'Gespielt',
      'stat-lbl-messages': 'Nachrichten',
      'atab-lbl-queue': 'Warteschlange',
      'atab-lbl-requests': 'Anfragen',
      'atab-lbl-songbook': 'Songbook',
      'atab-lbl-history': 'Verlauf',
      'atab-lbl-settings': 'Einstellungen',
      'lbl-live-queue-header': 'Live-Warteschlange — zum Sortieren ziehen',
      'lbl-new-requests-header': 'Neue Anfragen',
      'lbl-new-gig-banner-title': 'Neuen Auftritt erstellen',
      'lbl-new-gig-banner-sub': 'Neuen Auftritt starten',
      'btn-new-gig': '+ Neuer Auftritt',
      'lbl-my-songbook': 'Mein Songbook',
      'btn-add-song': '+ Song',
      'lbl-inbox-header': 'Nachrichten von Besuchern',
      'btn-all-read': 'Alles als gelesen markieren',
      'lbl-history-header': 'Auftritts-Verlauf',
      'lbl-settings-header': 'Auftritts-Einstellungen',
      'lbl-gig-naam': 'Auftrittsname',
      'lbl-locatie': 'Veranstaltungsort',
      'lbl-allow-requests': 'Anfragen erlauben',
      'lbl-allow-requests-sub': 'Publikum kann Songs anfragen',
      'lbl-allow-votes': 'Abstimmung erlauben',
      'lbl-allow-votes-sub': 'Publikum kann für Anfragen abstimmen',
      'lbl-show-karaoke': 'Lyrics-Option anzeigen',
      'lbl-show-karaoke-sub': 'Lyrics-Badge für Publikum sichtbar',
      'lbl-gig-live': 'Auftritt ist LIVE',
      'lbl-gig-live-sub': 'Für Publikum via QR-Code sichtbar',
      'lbl-qr-label': 'QR-Code & Link',
      'btn-copy-link': 'Link kopieren',
      'btn-download-qr': 'QR herunterladen',
      'btn-save-settings': 'Einstellungen speichern',
      'abtab-lbl-live': 'Live',
      'abtab-lbl-requests': 'Anfragen',
      'abtab-lbl-songbook': 'Songbook',
      'abtab-lbl-inbox': 'Posteingang',
      'abtab-lbl-settings': 'Einstellungen',
      'lbl-modal-request-title': 'Song anfragen',
      'lbl-modal-song-title': 'Song hinzufügen',
      'lbl-song-title-label': 'Titel *',
      'lbl-song-artist-label': 'Originalkünstler *',
      'lbl-song-key': 'Tonart',
      'lbl-song-ug': 'Ultimate Guitar URL',
      'lbl-song-karaoke-url': 'Lyrics URL (optional)',
      'lbl-song-karaoke-toggle': 'Lyrics verfügbar',
      'btn-cancel-song': 'Abbrechen',
      'btn-save-song': 'Speichern',
      'lbl-gig-detail': 'Auftrittsdetail',
      'btn-close-history': 'Schließen',
      'lbl-new-gig-modal-title': 'Neuen Auftritt erstellen',
      'lbl-new-gig-naam': 'Auftrittsname *',
      'lbl-new-gig-locatie': 'Veranstaltungsort',
      'lbl-new-gig-datum': 'Datum',
      'btn-cancel-new-gig': 'Abbrechen',
      'btn-create-gig': 'Auftritt erstellen',
      'lbl-admin-add': 'Direkt zur Warteschlange hinzufügen',
      'lbl-choose-song': '— Song auswählen —',
      'btn-add-to-queue': '+ Warteschlange',
      'toast-request-sent': 'Anfrage gesendet! 🎵',
      'toast-voted': 'Stimme abgegeben! ❤️',
      'toast-welcome-back': 'Willkommen zurück! 🎸',
      'toast-order-updated': 'Reihenfolge aktualisiert ✓',
      'toast-gig-offline': 'Gig offline geschaltet',
      'toast-gig-live': 'Gig ist jetzt LIVE! 🎸',
      'opt-general-review': '— Allgemeine Bewertung der Vorstellung —',
      'toast-gig-switched': 'Gig gewechselt ✓',
      'toast-gig-closed': 'Gig abgeschlossen ✓',
    },
    es: {
      'lbl-role-choice': '¿ERES VISITANTE O ARTISTA?',
      'lbl-visitor': 'Visitante — Pedir & Votar',
      'lbl-artist': 'Artista / DJ Iniciar sesión',
      'lbl-login-title': 'Iniciar sesión',
      'lbl-email': 'Correo electrónico',
      'lbl-password': 'Contraseña',
      'lbl-do-login': 'Iniciar sesión',
      'lbl-back': 'Volver',
      'lbl-voter-subtitle': '✦ Pide tu canción ✦',
      'lbl-tonight': 'ESTA NOCHE EN VIVO',
      'lbl-your-name': 'Tu nombre (opcional)',
      'lbl-enter-jukebox': 'Ir a la Jukebox →',
      'lbl-now-playing': 'Sonando ahora',
      'itab-queue': 'Cola',
      'itab-myrequests': 'Mis pedidos',
      'itab-request': 'Pedir',
      'itab-messages': 'Mensajes',
      'itab-comments': 'Reseñas',
      'btab-queue': 'Cola',
      'btab-search': 'Buscar',
      'btab-mine': 'Mío',
      'btab-messages': 'Mensajes',
      'btab-reviews': 'Reseñas',
      'lbl-queue-title': 'Cola de espera',
      'lbl-send-msg': 'Enviar un mensaje',
      'lbl-msg-label': 'Tu mensaje al artista',
      'lbl-send-msg-btn': 'Enviar',
      'lbl-review-title': 'DEJAR UNA RESEÑA',
      'lbl-review-name': 'Tu nombre *',
      'lbl-review-song': '¿Para qué canción? (opcional)',
      'lbl-rating': 'Puntuación',
      'lbl-review-text': 'Tu comentario',
      'lbl-submit-review-btn': 'Publicar reseña',
      'lbl-reviews-title': 'Reseñas',
      'lbl-req-msg': 'Mensaje (opcional)',
      'lbl-cancel-btn': 'Cancelar',
      'btn-request-text': '¡Pedir!',
      'lbl-tagline': '✦ Música en Vivo en el Escenario ✦',
      'lbl-now-playing-empty': 'Nada sonando aún',
      'lbl-no-messages-voter': 'A\u00fan no hay mensajes',
      'lbl-no-requests': 'A\u00fan no has pedido ninguna canci\u00f3n',
      'voter-logo-sub': '\u2756 M\u00fasica en Vivo \u2756',
      'artist-logo-sub': '\u2756 Panel del Artista \u2756',
      'divider-myrequests': 'Mis pedidos',
      'ph-email': 'tu@ejemplo.es',
      'ph-voter-name': 'ej. Sarah',
      'ph-search-song': 'Buscar canci\u00f3n o artista...',
      'ph-msg-text': 'ej. \"\u00bfPuedes tocar algo de The Beatles? \ud83c\udfb8\"',
      'ph-required': 'Obligatorio',
      'ph-comment-text': '\u00bfQu\u00e9 te pareci\u00f3 la actuaci\u00f3n?',
      'ph-search-songbook': 'Buscar en tu repertorio...',
      'ph-gig-name': 'Nombre de la actuaci\u00f3n',
      'ph-gig-venue': 'Caf\u00e9, Sala, etc.',
      'ph-song-title': 'Nombre de la canci\u00f3n',
      'ph-song-artist': 'ej. Eagles',
      'ph-new-gig-name': 'ej. Viernes por la noche en el Bar',
      'ph-new-gig-venue': 'Caf\u00e9, Sala, etc.',
      'status-pending': '\u23f3 Pendiente',
      'status-approved': '\u2713 Aprobado',
      'status-queued': '\ud83c\udfb5 En cola',
      'status-playing': '\u25b6 Sonando',
      'status-played': '\u2713 Tocado',
      'status-rejected': '\u2717 Rechazado',
      'empty-queue-artist': 'Cola vac\u00eda. Aprueba pedidos para empezar.',
      'empty-queue-voter': 'Cola vac\u00eda. \u00a1S\u00e9 el primero en pedir una canci\u00f3n!',
      'empty-requests': 'No hay nuevos pedidos',
      'empty-songs': 'No hay canciones disponibles',
      'empty-songbook': 'No hay canciones en tu repertorio',
      'empty-messages': 'A\u00fan no hay mensajes',
      'empty-history': 'Sin historial de conciertos',
      'empty-reviews': 'A\u00fan no hay rese\u00f1as',
      'lbl-approve': '\u2713 Aprobar',
      'lbl-reject': '\u2717 Rechazar',
      'lbl-played': '\u2713 Tocado',
      'lbl-votes': 'votos',
      'lbl-requested-by': 'Pedido por',
      'lbl-anonymous': 'An\u00f3nimo',
      'lbl-new': 'nuevo',
      'lbl-no-active-gig': 'Sin concierto activo',
      'confirm-close-gig': '¿Seguro que quieres cerrar el concierto?',
      'lbl-close-gig': 'Cerrar concierto',
      'lbl-activate-gig': 'Activar',
      'lbl-gig-artists': 'Artistas',
      'lbl-settings-artists': 'Artistas',
      'lbl-create-one': 'crea uno',
      'lbl-logout': 'Salir',
      'stat-lbl-queue': 'Cola',
      'stat-lbl-played': 'Tocado',
      'stat-lbl-messages': 'Mensajes',
      'atab-lbl-queue': 'Cola',
      'atab-lbl-requests': 'Pedidos',
      'atab-lbl-songbook': 'Repertorio',
      'atab-lbl-history': 'Historial',
      'atab-lbl-settings': 'Ajustes',
      'lbl-live-queue-header': 'Cola en vivo — arrastra para ordenar',
      'lbl-new-requests-header': 'Nuevos pedidos',
      'lbl-new-gig-banner-title': 'Crear nuevo concierto',
      'lbl-new-gig-banner-sub': 'Empezar una nueva actuación',
      'btn-new-gig': '+ Nuevo concierto',
      'lbl-my-songbook': 'Mi repertorio',
      'btn-add-song': '+ Canción',
      'lbl-inbox-header': 'Mensajes de los visitantes',
      'btn-all-read': 'Marcar todo leído',
      'lbl-history-header': 'Historial de conciertos',
      'lbl-settings-header': 'Ajustes del concierto',
      'lbl-gig-naam': 'Nombre del concierto',
      'lbl-locatie': 'Lugar',
      'lbl-allow-requests': 'Permitir pedidos',
      'lbl-allow-requests-sub': 'El público puede pedir canciones',
      'lbl-allow-votes': 'Permitir votos',
      'lbl-allow-votes-sub': 'El público puede votar pedidos',
      'lbl-show-karaoke': 'Mostrar opción lyrics',
      'lbl-show-karaoke-sub': 'Insignia de lyrics visible para el público',
      'lbl-gig-live': 'El concierto está EN VIVO',
      'lbl-gig-live-sub': 'Visible al público mediante código QR',
      'lbl-qr-label': 'Código QR & Enlace',
      'btn-copy-link': 'Copiar enlace',
      'btn-download-qr': 'Descargar QR',
      'btn-save-settings': 'Guardar ajustes',
      'abtab-lbl-live': 'En vivo',
      'abtab-lbl-requests': 'Pedidos',
      'abtab-lbl-songbook': 'Repertorio',
      'abtab-lbl-inbox': 'Bandeja',
      'abtab-lbl-settings': 'Ajustes',
      'lbl-modal-request-title': 'Pedir canción',
      'lbl-modal-song-title': 'Añadir canción',
      'lbl-song-title-label': 'Título *',
      'lbl-song-artist-label': 'Artista original *',
      'lbl-song-key': 'Tonalidad',
      'lbl-song-ug': 'URL Ultimate Guitar',
      'lbl-song-karaoke-url': 'URL Lyrics (opcional)',
      'lbl-song-karaoke-toggle': 'Lyrics disponible',
      'btn-cancel-song': 'Cancelar',
      'btn-save-song': 'Guardar',
      'lbl-gig-detail': 'Detalle del concierto',
      'btn-close-history': 'Cerrar',
      'lbl-new-gig-modal-title': 'Crear nuevo concierto',
      'lbl-new-gig-naam': 'Nombre del concierto *',
      'lbl-new-gig-locatie': 'Lugar',
      'lbl-new-gig-datum': 'Fecha',
      'btn-cancel-new-gig': 'Cancelar',
      'btn-create-gig': 'Crear concierto',
      'lbl-admin-add': 'Añadir directamente a la cola',
      'lbl-choose-song': '— Elige una canción —',
      'btn-add-to-queue': '+ Cola',
      'toast-request-sent': '¡Solicitud enviada! 🎵',
      'toast-voted': '¡Voto emitido! ❤️',
      'toast-welcome-back': '¡Bienvenido de vuelta! 🎸',
      'toast-order-updated': 'Orden actualizado ✓',
      'toast-gig-offline': 'Actuación desconectada',
      'toast-gig-live': '¡Actuación EN DIRECTO! 🎸',
      'opt-general-review': '— Reseña general de la actuación —',
      'toast-gig-switched': 'Actuación cambiada ✓',
      'toast-gig-closed': 'Actuación cerrada ✓',
    },
    mg: {
      'lbl-role-choice': 'MITSIDIKA SA MPANAO FEON-KIRA?',
      'lbl-visitor': 'Mpitsidika — Hangataka & Hivoto',
      'lbl-artist': 'Mpanao feon-kira Hiditra',
      'lbl-login-title': 'Hiditra',
      'lbl-email': 'Adiresy mailaka',
      'lbl-password': 'Teny miafina',
      'lbl-do-login': 'Hiditra',
      'lbl-back': 'Hiverina',
      'lbl-voter-subtitle': '✦ Hangataha ny hira tianao ✦',
      'lbl-tonight': 'ALINA IZAO VELONA',
      'lbl-your-name': 'Ny anaranao (tsy voatery)',
      'lbl-enter-jukebox': "Mankany amin'ny Jukebox →",
      'lbl-now-playing': 'Miasa ankehitriny',
      'itab-queue': 'Lisitra',
      'itab-myrequests': 'Fangatahako',
      'itab-request': 'Hangataka',
      'itab-messages': 'Hafatra',
      'itab-comments': 'Hevitra',
      'btab-queue': 'Lisitra',
      'btab-search': 'Hikaroka',
      'btab-mine': 'Ahy',
      'btab-messages': 'Hafatra',
      'btab-reviews': 'Hevitra',
      'lbl-queue-title': 'Lisitra fandraisan-javatra',
      'lbl-send-msg': 'Mandefa hafatra',
      'lbl-msg-label': "Ny hafatrao ho an'ny mpanao feon-kira",
      'lbl-send-msg-btn': 'Alefa',
      'lbl-review-title': 'LEAVE HEVITRA',
      'lbl-review-name': 'Ny anaranao *',
      'lbl-review-song': 'Momba hira iza? (tsy voatery)',
      'lbl-rating': 'Tombana',
      'lbl-review-text': 'Ny hevitrao',
      'lbl-submit-review-btn': 'Asio hevitra',
      'lbl-reviews-title': 'Hevitra',
      'lbl-req-msg': 'Hafatra (tsy voatery)',
      'lbl-cancel-btn': 'Ajanony',
      'btn-request-text': 'Hangataka!',
      'lbl-tagline': '✦ Mozika Velona amin\'ny Sehatra ✦',
      'lbl-now-playing-empty': 'Tsy misy miasa mbola',
      'lbl-no-messages-voter': 'Tsy misy hafatra mbola',
      'lbl-no-requests': 'Tsy mbola nangataka hira ianao',
      'voter-logo-sub': '\u2756 Mozika Velona \u2756',
      'artist-logo-sub': "\u2756 Panely ny Mpanao feon-kira \u2756",
      'divider-myrequests': 'Fangatahako',
      'ph-email': 'ianao@ohatra.mg',
      'ph-voter-name': 'ohatra. Sarah',
      'ph-search-song': 'Hikaroka hira na mpanao feon-kira...',
      'ph-msg-text': 'ohatra. \"Hira Beatles ve? \ud83c\udfb8\"',
      'ph-required': 'Ilaina',
      'ph-comment-text': 'Inona ny hevitrao momba ny fampisehoana?',
      'ph-search-songbook': 'Hikaroka ao amin ny bokinao...',
      'ph-gig-name': 'Anaran ny fampisehoana',
      'ph-gig-venue': 'Kafe, Efitrano, sns.',
      'ph-song-title': 'Anaran ny hira',
      'ph-song-artist': 'ohatra. Eagles',
      'ph-new-gig-name': 'ohatra. Zoma alina ao amin ny Kafe',
      'ph-new-gig-venue': 'Kafe, Efitrano, sns.',
      'status-pending': '\u23f3 Andinandiana',
      'status-approved': '\u2713 Voaraisina',
      'status-queued': '\ud83c\udfb5 Ao amin ny lisitra',
      'status-playing': '\u25b6 Miasa ankehitriny',
      'status-played': '\u2713 Efa nataon-kira',
      'status-rejected': '\u2717 Nolavin',
      'empty-queue-artist': 'Lisitra foana. Tereo fangatahana vao mianara.',
      'empty-queue-voter': 'Lisitra foana. Angataho hira voalohany!',
      'empty-requests': 'Tsy misy fangatahana vaovao',
      'empty-songs': 'Tsy misy hira azo alaina',
      'empty-songbook': 'Tsy misy hira ao amin ny bokinareo',
      'empty-messages': 'Tsy misy hafatra mbola',
      'empty-history': 'Tsy misy tantara gig mbola',
      'empty-reviews': 'Tsy misy hevitra mbola',
      'lbl-approve': '\u2713 Ekena',
      'lbl-reject': '\u2717 Atsahatra',
      'lbl-played': '\u2713 Efa nataon-kira',
      'lbl-votes': 'vato',
      'lbl-requested-by': 'Ngatahina avy amin',
      'lbl-anonymous': 'Tsy fantatra',
      'lbl-new': 'vaovao',
      'lbl-no-active-gig': 'Tsy misy gig mavitrika',
      'confirm-close-gig': 'Te ka hanidy ny gig?',
      'lbl-close-gig': 'Hanidy ny Gig',
      'lbl-activate-gig': 'Hanainga',
      'lbl-gig-artists': 'Mpanao feon-kira',
      'lbl-settings-artists': 'Mpanao feon-kira',
      'lbl-create-one': 'mamorona iray',
      'lbl-logout': 'Hivoaka',
      'stat-lbl-queue': 'Lisitra',
      'stat-lbl-played': 'Nataon-kira',
      'stat-lbl-messages': 'Hafatra',
      'atab-lbl-queue': 'Lisitra',
      'atab-lbl-requests': 'Fangatahana',
      'atab-lbl-songbook': 'Bokin-kira',
      'atab-lbl-history': 'Tantara',
      'atab-lbl-settings': 'Fikirana',
      'lbl-live-queue-header': 'Lisitra velona — hofaka hampifindra',
      'lbl-new-requests-header': 'Fangatahana vaovao',
      'lbl-new-gig-banner-title': 'Hamorona gig vaovao',
      'lbl-new-gig-banner-sub': 'Hanomboka fampisehoana vaovao',
      'btn-new-gig': '+ Gig vaovao',
      'lbl-my-songbook': 'Ny bokin-kirako',
      'btn-add-song': '+ Hira',
      'lbl-inbox-header': 'Hafatra avy amin ny mpitsidika',
      'btn-all-read': 'Novakiana avokoa',
      'lbl-history-header': 'Tantaran ny gig',
      'lbl-settings-header': 'Fikirana ny gig',
      'lbl-gig-naam': 'Anaran ny gig',
      'lbl-locatie': 'Toerana',
      'lbl-allow-requests': 'Hamela fangatahana',
      'lbl-allow-requests-sub': 'Ny mpihaino afaka hangataka hira',
      'lbl-allow-votes': 'Hamela fivotana',
      'lbl-allow-votes-sub': 'Ny mpihaino afaka hivoto',
      'lbl-show-karaoke': 'Haneho lyrics',
      'lbl-show-karaoke-sub': 'Famantarana lyrics hita ho an ny mpihaino',
      'lbl-gig-live': 'Gig dia VELONA',
      'lbl-gig-live-sub': 'Hita ho an ny mpihaino amin ny QR code',
      'lbl-qr-label': 'QR Code & Rohy',
      'btn-copy-link': 'Haka rohy',
      'btn-download-qr': 'Hisintona QR',
      'btn-save-settings': 'Hitahiry fikirana',
      'abtab-lbl-live': 'Velona',
      'abtab-lbl-requests': 'Fangatahana',
      'abtab-lbl-songbook': 'Bokin-kira',
      'abtab-lbl-inbox': 'Boaty',
      'abtab-lbl-settings': 'Fikirana',
      'lbl-modal-request-title': 'Hangataka hira',
      'lbl-modal-song-title': 'Hanampy hira',
      'lbl-song-title-label': 'Lohateny *',
      'lbl-song-artist-label': 'Mpanao feon-kira tany am-boalohany *',
      'lbl-song-key': 'Lakile',
      'lbl-song-ug': 'URL Ultimate Guitar',
      'lbl-song-karaoke-url': 'URL Lyrics (tsy voatery)',
      'lbl-song-karaoke-toggle': 'Lyrics mety',
      'btn-cancel-song': 'Ajanony',
      'btn-save-song': 'Hitahiry',
      'lbl-gig-detail': 'Antsipiriany ny gig',
      'btn-close-history': 'Hanidy',
      'lbl-new-gig-modal-title': 'Hamorona gig vaovao',
      'lbl-new-gig-naam': 'Anaran ny gig *',
      'lbl-new-gig-locatie': 'Toerana',
      'lbl-new-gig-datum': 'Daty',
      'btn-cancel-new-gig': 'Ajanony',
      'btn-create-gig': 'Hamorona gig',
      'lbl-admin-add': 'Hanampy mivantana amin ny lisitra',
      'lbl-choose-song': '— Hifidy hira —',
      'btn-add-to-queue': '+ Lisitra',
      'toast-request-sent': 'Fangatahana nalefa! 🎵',
      'toast-voted': 'Nifidy! ❤️',
      'toast-welcome-back': 'Tonga soa indray! 🎸',
      'toast-order-updated': 'Filaharan\'ny nalaina ✓',
      'toast-gig-offline': 'Gig nalefaka niala an-tserasera',
      'toast-gig-live': 'Gig LIVE izao! 🎸',
      'opt-general-review': '— Hevitra ankapobe momba ny fampisehoana —',
      'toast-gig-switched': 'Gig novaina ✓',
      'toast-gig-closed': 'Gig voatanaty ✓',
    }
  };


  let currentLang = (typeof localStorage !== 'undefined' && localStorage.getItem('jukestage_lang')) || 'nl';

  function t(key) {
    return (translations[currentLang] || translations.nl)[key] || (translations.nl)[key] || key;
  }

  function setLang(lang) {
    currentLang = lang;
    try { localStorage.setItem('jukestage_lang', lang); } catch(e) {}
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.lang-btn').forEach(b => {
      if (b.textContent.includes(lang.toUpperCase())) b.classList.add('active');
    });
    const tr = translations[lang] || translations.nl;
    // Translate text content by ID
    Object.entries(tr).forEach(([id, text]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    });
    // Translate placeholders via data-i18n-ph attribute
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.getAttribute('data-i18n-ph');
      if (tr[key]) el.placeholder = tr[key];
    });
    // Update artist role badge text if visible
    const badge = document.getElementById('artist-role-badge');
    if (badge) {
      const role = (typeof currentUser !== 'undefined' && currentUser?.role) || '';
      badge.textContent = role === 'admin' ? 'ADMIN' : (lang === 'nl' ? 'ARTIEST' : lang === 'en' ? 'ARTIST' : lang === 'fr' ? 'ARTISTE' : lang === 'de' ? 'KÜNSTLER' : lang === 'es' ? 'ARTISTA' : 'MPANAO FEON-KIRA');
    }
    // Update no-active-gig if showing
    const gigEl = document.getElementById('artist-gig-name');
    if (gigEl && gigEl.textContent === (translations[lang === 'nl' ? 'en' : 'nl']['lbl-no-active-gig'] || 'Geen actieve gig')) {
      gigEl.textContent = tr['lbl-no-active-gig'] || 'Geen actieve gig';
    }
    // Translate <option> placeholder in admin select
    const chooseOpt = document.getElementById('lbl-choose-song');
    if (chooseOpt && tr['lbl-choose-song']) chooseOpt.textContent = tr['lbl-choose-song'];
  }

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
  function showLoginForm() {
    document.getElementById('card-choice').style.display = 'none';
    document.getElementById('card-login').style.display = 'block';
  }
  function showLandingChoice() {
    document.getElementById('card-choice').style.display = 'block';
    document.getElementById('card-login').style.display = 'none';
  }

  // ════════════════════════════════════════════
  // AUTH
  // ════════════════════════════════════════════
  async function doLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pw    = document.getElementById('login-password').value;
    if (!email || !pw) { showToast('Vul alle velden in', 'error'); return; }
    showToast('Inloggen...', '');

    const { data, error } = await db.auth.signInWithPassword({ email, password: pw });
    if (error) { showToast('Inloggen mislukt', 'error'); return; }

    // Find user record: try auth_id first, then fall back to email
    let { data: _uRows1 } = await db.from('users')
      .select('id, role, display_name, auth_id').eq('auth_id', data.user.id).limit(1);
    let userData = _uRows1?.[0] || null;

    if (!userData) {
      // auth_id not set yet — find by email and update auth_id
      const { data: _uByEmail } = await db.from('users')
        .select('id, role, display_name, auth_id').eq('email', email).limit(1);
      userData = _uByEmail?.[0] || null;
      if (userData && !userData.auth_id) {
        await db.from('users').update({ auth_id: data.user.id }).eq('id', userData.id);
      }
    }

    currentUser = {
      ...data.user,
      id: userData?.id,
      auth_id: data.user.id,
      role: userData?.role || 'artist',
      name: userData?.display_name || email
    };

    const badge = document.getElementById('artist-role-badge');
    badge.textContent = currentUser.role === 'admin' ? 'ADMIN' : 'ARTIEST';
    badge.className = currentUser.role === 'admin' ? 'badge badge-red' : 'badge badge-chrome';

    // Punt 14: toon admin direct-toevoegen als admin
    if (currentUser.role === 'admin') {
      document.getElementById('admin-direct-add').style.display = 'block';
    }

    showToast(t('toast-welcome-back'), 'success');
    showView('view-artist');
    loadArtistData();
  }

  // ════════════════════════════════════════════
  // VOTER FLOW — multi-gig keuze
  // ════════════════════════════════════════════
  let selectedVoterGig = null;

  async function loadLiveGigs() {
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
    const gigToken = params.get('gig') || params.get('token');

    if (gigToken) {
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
      .select('*').eq('status', 'live').eq('is_active', true)
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
    let html = '<div style="font-family:var(--font-retro);font-size:10px;letter-spacing:3px;color:var(--neon);text-transform:uppercase;margin-bottom:12px;text-align:center;">Kies jouw gig</div>';
    liveGigs.forEach(function(g, i) {
      const datePart = g.gig_date ? new Date(g.gig_date).toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}) : '';
      const meta = [g.venue, datePart].filter(Boolean).join(' \u00B7 ');
      html += '<div class="gig-pick-card" id="gigpick_' + i + '">'
        + '<div><div class="gig-pick-name">' + (g.name || 'Gig') + '</div>'
        + (meta ? '<div class="gig-pick-meta">' + meta + '</div>' : '')
        + '</div>'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18" style="color:var(--neon);flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>'
        + '</div>';
    });
    pickArea.innerHTML = html;
    // Koppel click handlers na render
    liveGigs.forEach(function(g, i) {
      const el = document.getElementById('gigpick_' + i);
      if (el) el.addEventListener('click', function() { selectVoterGig(g); });
    });
  }

  function selectVoterGig(gig) {
    selectedVoterGig = gig;
    document.getElementById('voter-gig-pick-area').style.display = 'none';
    document.getElementById('voter-name-area').style.display = 'block';
    const nameEl  = document.getElementById('voter-selected-gig-name');
    const venueEl = document.getElementById('voter-selected-gig-venue');
    if (nameEl)  nameEl.textContent  = gig.name || 'Live vanavond';
    if (venueEl) venueEl.textContent = (gig.venue && gig.name !== gig.venue) ? '📍 ' + gig.venue : '';
  }

  function backToGigPick() {
    selectedVoterGig = null;
    document.getElementById('voter-gig-pick-area').style.display = 'block';
    document.getElementById('voter-name-area').style.display = 'none';
  }

  async function enterAsVoter() {
    const nameEl = document.getElementById('voter-name');
    const name   = nameEl ? nameEl.value.trim() || null : null;
    const gig    = selectedVoterGig;
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
      .select('*, songs(title, original_artist, karaoke_url, is_karaoke_available)')
      .eq('gig_id', currentGig.id).eq('status', 'playing').limit(1);

    const npTitle  = document.getElementById('voter-np-title');
    const npArtist = document.getElementById('voter-np-artist');
    if (playing && playing.length > 0) {
      npTitle.textContent  = playing[0].songs?.title || '—';
      npArtist.textContent = playing[0].songs?.original_artist || '—';

      // Toon lyrics-knop als karaoke_url aanwezig is én gig het toestaat
      const showKaraokeBtn = currentGig.allow_karaoke !== false;
      const karaokeUrl = playing[0].songs?.karaoke_url;
      let lyricsBtn = document.getElementById('voter-np-lyrics-btn');
      if (karaokeUrl && showKaraokeBtn) {
        if (!lyricsBtn) {
          lyricsBtn = document.createElement('a');
          lyricsBtn.id = 'voter-np-lyrics-btn';
          lyricsBtn.target = '_blank';
          lyricsBtn.rel = 'noopener noreferrer';
          lyricsBtn.className = 'btn-karaoke-link';
          lyricsBtn.innerHTML = '🎤 Lyrics openen';
          npArtist.parentNode.insertBefore(lyricsBtn, npArtist.nextSibling);
        }
        lyricsBtn.href = karaokeUrl;
        lyricsBtn.style.display = 'inline-flex';
      } else if (lyricsBtn) {
        lyricsBtn.style.display = 'none';
      }
    } else {
      npTitle.textContent  = '—';
      npArtist.textContent = (translations[currentLang] || translations.nl)['lbl-now-playing-empty'] || 'Nog niets aan het spelen';
      // Verberg lyrics-knop als er niets speelt
      const lyricsBtn = document.getElementById('voter-np-lyrics-btn');
      if (lyricsBtn) lyricsBtn.style.display = 'none';
    }

    const { data: requests } = await db.from('requests')
      .select('*, songs(title, original_artist), gig_songs(vote_count), voter_sessions(display_name)')
      .eq('gig_id', currentGig.id)
      .in('status', ['approved','queued','pending'])
      .order('created_at', { ascending: true });

    const votedGigSongIds = new Set();
    if (voterSession) {
      const { data: myVotes } = await db.from('votes')
        .select('gig_song_id').eq('voter_session_id', voterSession.id);
      myVotes?.forEach(v => votedGigSongIds.add(v.gig_song_id));
    }

    const list = document.getElementById('voter-queue-list');
    if (!requests || requests.length === 0) {
      list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 18V5l12-3v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="15" r="3"/></svg><p>${t('empty-queue-voter')}</p></div>`;
      return;
    }

    // Punt 1 FIX: vote werkt nu ook voor custom requests (gigSongId kan null zijn)
    // Punt 16 FIX: toon aanvrager naam
    list.innerHTML = requests.map((req, i) => {
      const voted = req.gig_song_id ? votedGigSongIds.has(req.gig_song_id) : false;
      const voteCount = req.gig_songs?.vote_count || 0;
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

    let allGigSongs = [];
    if (artistIds.length > 0) {
      const { data: artistSongs } = await db.from('artist_songs')
        .select('song_id, artist_id, artists(name), songs(id, title, original_artist, is_karaoke_available)')
        .in('artist_id', artistIds);
      const seen = new Set();
      allGigSongs = (artistSongs || []).filter(as => {
        if (seen.has(as.song_id)) return false;
        seen.add(as.song_id); return true;
      });
    }

    const { data: gigSongsDb } = await db.from('gig_songs')
      .select('id, song_id').eq('gig_id', currentGig.id).eq('is_active', true);
    const gigSongMap = {};
    gigSongsDb?.forEach(gs => { gigSongMap[gs.song_id] = gs.id; });

    const list = document.getElementById('voter-song-list');
    if (!allGigSongs || allGigSongs.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>${t('empty-songs')}</p></div>`; return;
    }

    const showKaraoke = currentGig.allow_karaoke !== false;
    const filtered = query
      ? allGigSongs.filter(as => as.songs?.title?.toLowerCase().includes(query.toLowerCase()) || as.songs?.original_artist?.toLowerCase().includes(query.toLowerCase()))
      : allGigSongs;
    filtered.sort((a, b) => (a.songs?.title || '').localeCompare(b.songs?.title || ''));

    list.innerHTML = filtered.map(as => {
      const gigSongId = gigSongMap[as.song_id] || null;
      const artistName = as.artists?.name || '';
      const title = (as.songs?.title||'').replace(/'/g, "\\'");
      const origArtist = (as.songs?.original_artist||'').replace(/'/g, "\\'");
      return `<div class="song-card" data-song-id="${as.song_id}" data-gig-song-id="${gigSongId || ''}" data-title="${(as.songs?.title||'').replace(/"/g,'&quot;')}" data-artist="${(as.songs?.original_artist||'').replace(/"/g,'&quot;')}" onclick="openRequestFromCard(this)">`
        + '<div style="display:flex;align-items:center;justify-content:space-between;">'
        + '<div>'
        + '<div class="song-card-title">' + (as.songs?.title || 'Onbekend') + '</div>'
        + '<div class="song-card-artist">' + (as.songs?.original_artist || '') + (artistName ? ' · 🎸 ' + artistName : '') + '</div>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:7px;">'
        + (as.songs?.is_karaoke_available && showKaraoke ? '<span class="badge badge-karaoke">🎤 Lyrics</span>' : '')
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
        return;
      }
      btn.classList.add('voted');
      btn.querySelector('svg').setAttribute('fill', 'currentColor');
      btn.querySelector('svg').removeAttribute('stroke');
      countEl.textContent = parseInt(countEl.textContent) + 1;
      showToast(t('toast-voted'), 'success');
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
        showToast(t('toast-request-sent'), 'success');
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
      select.innerHTML = `<option value="">${t('opt-general-review')}</option>`;
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
        .select('gig_id, gigs(*)').eq('user_id', _ugId).limit(1);
      if (ugErr) console.warn('user_gigs query failed:', ugErr.message);
      else userGigs = _ugData;
    }

    // Smart sort: live > upcoming (most recent) > finished
    const _sortedGigs = (userGigs || [])
      .filter(ug => ug.gigs)
      .sort((a, b) => {
        const order = { live: 0, upcoming: 1, finished: 2 };
        return (order[a.gigs.status] ?? 3) - (order[b.gigs.status] ?? 3)
          || (b.gigs.gig_date || '').localeCompare(a.gigs.gig_date || '');
      });

    // Only auto-select if no currentGig yet (don't override manual switchActiveGig)
    if (!currentGig && _sortedGigs.length > 0) {
      currentGig = _sortedGigs[0].gigs;
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
    document.getElementById('new-gig-date').value = new Date().toISOString().split('T')[0];
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

  function dragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.queue-card').forEach(c => c.classList.remove('drag-over'));
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
    showToast(t('toast-order-updated'), 'success');
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
      .select('*, songs(title, original_artist, ug_tabs), gig_songs(vote_count), voter_sessions(display_name)')
      .eq('gig_id', currentGig.id)
      .in('status', ['approved','queued','playing'])
      .order('created_at', { ascending: true });

    const list = document.getElementById('artist-queue-list');
    document.getElementById('stat-queue').textContent = requests?.length || 0;

    if (!requests || requests.length === 0) {
      list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg><p>${t('empty-queue-artist')}</p></div>`;
      return;
    }

    list.innerHTML = requests.map((req, i) => {
      const isPlaying = req.status === 'playing';
      const ug = req.songs?.ug_tabs;
      const requester = req.voter_sessions?.display_name;
      return `<div class="queue-card ${isPlaying ? 'playing' : ''}" data-id="${req.id}" draggable="true"
          ondragstart="dragStart(event)" ondragend="dragEnd(event)" ondragover="dragOver(event)" ondrop="dragDrop(event)" ondragleave="dragLeave(event)">
        ${!isPlaying ? `<div class="drag-handle" id="dh-${req.id}" title="Versleep">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>
        </div>` : ''}
        <div class="queue-num ${isPlaying ? 'playing' : ''}">${isPlaying ? '▶' : i + 1}</div>
        <div style="flex:1;min-width:0;">
          <div class="queue-song-title">${req.songs?.title || 'Onbekend'}</div>
          <div class="queue-song-meta">${req.songs?.original_artist || ''} · ${req.gig_songs?.vote_count || 0} ${t('lbl-votes')}</div>
          ${requester ? `<div class="requester-badge">🎵 ${t('lbl-requested-by')} ${requester}</div>` : ''}
          ${ug ? `<a href="${ug}" target="_blank" class="ug-link" onclick="event.stopPropagation()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77A5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
            Ultimate Guitar tabs
          </a>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;">
          ${isPlaying
            ? `<button class="btn btn-primary btn-icon" onclick="markPlayed('${req.id}')" title="Gespeeld" style="width:auto;padding:6px 12px;font-size:11px;">${t('lbl-played')}</button>`
            : `<button class="btn btn-primary btn-icon" onclick="playNow('${req.id}')" title="Nu spelen">
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </button>
              <button class="btn btn-secondary btn-icon" onclick="skipSong('${req.id}')" title="Overslaan">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
              </button>`}
        </div>
      </div>`;
    }).join('');

    // Touch drag instellen na render (punt 6)
    requests.forEach(req => {
      if (req.status !== 'playing') {
        const handle = document.getElementById(`dh-${req.id}`);
        const card   = list.querySelector(`[data-id="${req.id}"]`);
        if (handle && card) setupTouchDrag(handle, card);
      }
    });
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

    list.innerHTML = requests.map(req => {
      const name = req.voter_sessions?.display_name || t('lbl-anonymous');
      const time = new Date(req.created_at).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' });
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:9px;" data-req-id="${req.id}">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
          <div>
            <div class="queue-song-title">${req.songs?.title || 'Onbekend'}</div>
            <div class="queue-song-meta">${req.songs?.original_artist || ''} · ${name} · ${time}</div>
          </div>
          <span class="badge badge-neon">${req.gig_songs?.vote_count || 0} ❤</span>
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
    if (!currentUser || !currentGig) return;

    const { data: gigArtists } = await db.from('gig_artists')
      .select('artist_id, artists(name)').eq('gig_id', currentGig.id);
    const artistIds = gigArtists?.map(ga => ga.artist_id) || [];

    if (artistIds.length === 0) {
      allSongs = []; renderSongbook(allSongs); return;
    }

    const { data: songs } = await db.from('artist_songs')
      .select('songs(*), artists(name)').in('artist_id', artistIds);

    const seen = new Set();
    allSongs = (songs || []).filter(s => {
      if (!s.songs || seen.has(s.songs.id)) return false;
      seen.add(s.songs.id); return true;
    }).map(s => ({ ...s.songs, _artistName: s.artists?.name }));

    renderSongbook(allSongs);
  }

  function filterSongbook(query) {
    const q = query.toLowerCase();
    const filtered = q ? allSongs.filter(s =>
      s.title?.toLowerCase().includes(q) || s.original_artist?.toLowerCase().includes(q)) : allSongs;
    renderSongbook(filtered);
  }

  function renderSongbook(songs) {
    const list = document.getElementById('artist-songbook-list');
    if (!songs || songs.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>${t('empty-songbook')}</p></div>`; return;
    }
    list.innerHTML = songs.map(song => `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:9px;">
        <div style="display:flex;justify-content:space-between;align-items:start;">
          <div style="flex:1;">
            <div class="queue-song-title">${song.title}</div>
            <div class="queue-song-meta">${song.original_artist || ''}${song.key_signature ? ' · ' + song.key_signature : ''}${song.duration ? ' · ' + song.duration : ''}</div>
            <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
              ${song.genre ? `<span class="badge badge-chrome">${song.genre}</span>` : ''}
              ${song.is_karaoke_available ? '<span class="badge badge-karaoke">🎤 Lyrics</span>' : ''}
            </div>
          </div>
          <button class="btn btn-ghost btn-icon" onclick="editSong(${song.id})" style="margin-left:8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon" onclick="deleteSong(${song.id})" style="margin-left:4px;color:var(--neon3);" title="Verwijderen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
        ${song.ug_tabs ? `<a href="${song.ug_tabs}" target="_blank" class="ug-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77A5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
          Ultimate Guitar tabs
        </a>` : ''}
      </div>`).join('');
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
    const content = document.getElementById('modal-history-content');
    content.innerHTML = `<div style="color:var(--muted);font-family:var(--font-retro);text-align:center;padding:20px;">Laden...</div>`;
    document.getElementById('modal-history').classList.add('open');

    const [{ data: played }, { data: messages }, { data: comments }] = await Promise.all([
      db.from('requests').select('*, songs(title, original_artist), voter_sessions(display_name)')
        .eq('gig_id', gigId).eq('status', 'played').order('updated_at', { ascending: true }),
      db.from('gig_messages').select('*').eq('gig_id', gigId).order('created_at', { ascending: true }),
      db.from('comments').select('*').eq('gig_id', gigId).order('created_at', { ascending: false })
    ]);

    let html = '';
    html += `<div style="font-family:var(--font-retro);font-size:11px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin-bottom:10px;">🎵 Gespeelde Songs (${played?.length || 0})</div>`;
    if (played?.length) {
      html += played.map((r, i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--surface2);border-radius:9px;margin-bottom:6px;">
          <div style="font-family:var(--font-display);font-size:18px;color:var(--border2);min-width:28px;">${i+1}</div>
          <div>
            <div style="font-family:var(--font-display);font-size:16px;">${r.songs?.title || '—'}</div>
            <div style="font-size:11px;color:var(--muted);font-family:var(--font-retro);">${r.songs?.original_artist || ''}${r.voter_sessions?.display_name ? ' · aangevraagd door ' + r.voter_sessions.display_name : ''}${r.message ? ' · "' + r.message + '"' : ''}</div>
          </div>
        </div>`).join('');
    } else { html += `<div style="color:var(--muted);font-size:13px;margin-bottom:12px;font-family:var(--font-retro);">Geen songs gespeeld</div>`; }

    html += `<div class="divider"></div>`;
    html += `<div style="font-family:var(--font-retro);font-size:11px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin-bottom:10px;">💬 Berichten (${messages?.length || 0})</div>`;
    if (messages?.length) {
      html += messages.map(m => {
        const time = new Date(m.created_at).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' });
        return `<div class="msg-item" style="margin-bottom:6px;">
          <div class="msg-avatar">${(m.sender_name || 'A')[0].toUpperCase()}</div>
          <div><div class="msg-name">${m.sender_name || 'Anoniem'} · ${time}</div><div class="msg-text">${m.message}</div></div>
        </div>`;
      }).join('');
    } else { html += `<div style="color:var(--muted);font-size:13px;margin-bottom:12px;font-family:var(--font-retro);">Geen berichten</div>`; }

    if (comments?.length) {
      html += `<div class="divider"></div>`;
      html += `<div style="font-family:var(--font-retro);font-size:11px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin-bottom:10px;">⭐ Reviews (${comments.length})</div>`;
      html += comments.map(c => {
        const stars = c.rating ? '★'.repeat(c.rating) + '☆'.repeat(5-c.rating) : '';
        return `<div class="comment-card">${stars ? `<div style="color:var(--neon2);margin-bottom:4px;">${stars}</div>` : ''}<div class="comment-author" style="margin-bottom:4px;">${c.author_name}</div><div class="comment-text">${c.content}</div></div>`;
      }).join('');
    }

    content.innerHTML = html;
  }

  // ════════════════════════════════════════════
  // GIG SETTINGS + QR (punt 12)
  // ════════════════════════════════════════════

  // ════════════════════════════════════════════
  // GIG AFSLUITEN
  // ════════════════════════════════════════════
  async function closeGig() {
    if (!currentGig) return;
    if (!confirm(t('confirm-close-gig') || 'Wil je de gig echt afsluiten?')) return;

    await db.from('gigs').update({ status: 'finished', is_active: false }).eq('id', currentGig.id);
    await db.from('requests')
      .update({ status: 'rejected' })
      .eq('gig_id', currentGig.id)
      .in('status', ['pending', 'approved', 'queued']);

    currentGig.status = 'finished';
    currentGig.is_active = false;
    document.getElementById('artist-gig-status').style.display = 'none';
    showToast(t('toast-gig-closed'), 'success');
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
    // Herlaad stat-played voor de nieuwe gig
    db.from('requests').select('*', { count: 'exact', head: true })
      .eq('gig_id', currentGig.id).eq('status', 'played')
      .then(({ count }) => {
        const el = document.getElementById('stat-played');
        if (el) el.textContent = count || 0;
      });
    showToast(t('toast-gig-switched'), 'success');
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

    // Load current artists for this gig
    const { data: gigArtistsData } = await db.from('gig_artists')
      .select('artist_id, artists(id, name)').eq('gig_id', currentGig.id);
    settingsGigArtists = (gigArtistsData || []).map(ga => ({ id: ga.artists.id, name: ga.artists.name }));
    renderArtistPills('settings');
    document.getElementById('settings-artist-search').value = '';
    document.getElementById('settings-artist-results').style.display = 'none';

    // Punt 12: echte URL + werkende QR code
    const gigUrl = `https://jukestage.vercel.app/?gig=${currentGig.qr_token || currentGig.id}`;
    document.getElementById('qr-link').textContent = gigUrl;
    generateQRCode(gigUrl);

    const setToggle = (id, val) => {
      const el = document.getElementById(id);
      if (el) { el.classList.toggle('on', val !== false); }
    };
    setToggle('toggle-requests', currentGig.allow_requests);
    setToggle('toggle-votes', currentGig.allow_votes);
    setToggle('toggle-live', currentGig.status === 'live');

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


  function generateQRCode(url) {
    const el = document.getElementById('qr-canvas');
    if (!el || !url || url === '—') return;
    el.innerHTML = '';
    if (typeof QRCode === 'undefined') {
      el.innerHTML = '<div style="color:var(--muted);font-size:11px;text-align:center;padding:20px;">QR library laden...</div>';
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.onload = () => generateQRCode(url);
      document.head.appendChild(script);
      return;
    }
    new QRCode(el, {
      text: url,
      width: 200,
      height: 200,
      colorDark: '#0d0705',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
    // Store canvas ref for download
    setTimeout(() => { el._canvas = el.querySelector('canvas'); }, 100);
  }


  function downloadQR() {
    const url = document.getElementById('qr-link').textContent;
    if (!url || url === '—') { showToast('Geen QR-code beschikbaar', 'error'); return; }
    const el = document.getElementById('qr-canvas');
    const canvas = el?._canvas || el?.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'jukestage-qr.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('QR code gedownload! 📲', 'success');
    } else {
      generateQRCode(url);
      setTimeout(() => downloadQR(), 500);
    }
  }

  async function saveGigSettings() {
    if (!currentGig) return;
    const name    = document.getElementById('settings-gig-name').value.trim();
    const venue   = document.getElementById('settings-gig-venue').value.trim();
    const allowReq  = document.getElementById('toggle-requests').classList.contains('on');
    const allowVote = document.getElementById('toggle-votes').classList.contains('on');

    await db.from('gigs').update({
      name: name || currentGig.name,
      venue: venue || currentGig.venue,
      allow_requests: allowReq,
      allow_votes: allowVote
    }).eq('id', currentGig.id);

    // Sync gig_artists: remove all, re-insert selected
    await db.from('gig_artists').delete().eq('gig_id', currentGig.id);
    for (const a of settingsGigArtists) {
      await db.from('gig_artists').insert({ gig_id: currentGig.id, artist_id: a.id });
    }

    showToast('Instellingen opgeslagen ✓', 'success');
    loadArtistData();
  }

  async function toggleGigLive(btn) {
    btn.classList.toggle('on');
    const isLive = btn.classList.contains('on');
    await db.from('gigs').update({ status: isLive ? 'live' : 'upcoming' }).eq('id', currentGig.id);
    document.getElementById('artist-gig-status').style.display = isLive ? 'inline-flex' : 'none';
    showToast(isLive ? t('toast-gig-live') : t('toast-gig-offline'), isLive ? 'success' : '');
  }

  // ════════════════════════════════════════════
  // QUEUE ACTIES
  // ════════════════════════════════════════════
  async function markPlayed(requestId) {
    await db.from('requests').update({ status: 'played', updated_at: new Date().toISOString() }).eq('id', requestId);
    // Punt 10: verhoog teller in geheugen (persistent over refresh via DB)
    playedCountThisSession++;
    const stat = document.getElementById('stat-played');
    if (stat) stat.textContent = parseInt(stat.textContent) + 1;
    showToast('Gespeeld! ✓', 'success');
    loadArtistQueue();
    loadArtistHistory(); // update stat in history direct
  }

  async function skipSong(requestId) {
    await db.from('requests').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', requestId);
    showToast('Overgeslagen', '');
    loadArtistQueue();
  }

  async function playNow(requestId) {
    await db.from('requests').update({ status: 'queued' }).eq('gig_id', currentGig.id).eq('status', 'playing');
    await db.from('requests').update({ status: 'playing', updated_at: new Date().toISOString() }).eq('id', requestId);
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
    document.getElementById('modal-add-song').classList.add('open');
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
    document.getElementById('modal-add-song').classList.add('open');
  }
  async function deleteSong(songId) {
    if (!confirm('Wil je dit nummer verwijderen uit je songbook?')) return;
    const { error } = await db.from('songs').delete().eq('id', songId);
    if (error) { showToast('Fout bij verwijderen', 'error'); return; }
    allSongs = allSongs.filter(s => s.id !== songId);
    renderSongbook(allSongs);
    showToast('Nummer verwijderd ✓', 'success');
  }

  async function saveSong() {
    const title    = document.getElementById('song-title').value.trim();
    const artist   = document.getElementById('song-artist').value.trim();
    const key      = document.getElementById('song-key').value.trim() || null;
    const bpm      = parseInt(document.getElementById('song-bpm').value) || null;
    const ugTabs   = document.getElementById('song-ug').value.trim() || null;
    const karaUrl  = document.getElementById('song-karaoke-url').value.trim() || null;
    const isKaraoke = document.getElementById('song-karaoke-toggle').classList.contains('on');

    if (!title) { showToast('Vul een titel in', 'error'); return; }

    if (editingSongId) {
      await db.from('songs').update({
        title, original_artist: artist, key_signature: key,
        tempo_bpm: bpm, ug_tabs: ugTabs, karaoke_url: karaUrl, is_karaoke_available: isKaraoke
      }).eq('id', editingSongId);
      showToast('Nummer bijgewerkt ✓', 'success');
    } else {
      const { data: song, error } = await db.from('songs').insert({
        title, original_artist: artist, key_signature: key,
        tempo_bpm: bpm, ug_tabs: ugTabs, karaoke_url: karaUrl,
        is_karaoke_available: isKaraoke, is_active: true, created_at: new Date().toISOString()
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
  // PUNT 11 FIX: TAB SYNC — inner tabs en bottom tabs synchroon
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
    playedCountThisSession = 0;
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
    // Check URL voor gig token (punt 2 & 12)
    checkGigUrl();

    const { data: { session } } = await db.auth.getSession();
    if (session) {
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
      currentUser = {
        ...session.user,
        id: _userData2?.id,
        auth_id: session.user.id,
        role: _userData2?.role || 'artist',
        name: _userData2?.display_name || session.user.email
      };
      const badge = document.getElementById('artist-role-badge');
      badge.textContent = currentUser.role === 'admin' ? 'ADMIN' : 'ARTIEST';
      badge.className = currentUser.role === 'admin' ? 'badge badge-red' : 'badge badge-chrome';
      if (currentUser.role === 'admin') {
        document.getElementById('admin-direct-add').style.display = 'block';
      }

      // Laad gespeeld teller vanuit DB (punt 10)
      showView('view-artist');
      await loadArtistData();

      if (currentGig) {
        const { count } = await db.from('requests')
          .select('*', { count: 'exact', head: true })
          .eq('gig_id', currentGig.id).eq('status', 'played');
        if (count) document.getElementById('stat-played').textContent = count;
      }
    }
  })();
