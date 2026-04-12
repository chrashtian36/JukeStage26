"""
JukeStage — Songs importeren in Supabase
=========================================
Gebruik:
  1. Installeer dependencies:
       pip install openpyxl supabase

  2. Vul je Supabase credentials in (zie hieronder)

  3. Zet dit script in dezelfde map als jukestage_songs.xlsx

  4. Draai het:
       python import_songs.py
"""

import openpyxl
from supabase import create_client

# ── CONFIGURATIE ──────────────────────────────────────────
SUPABASE_URL = "https://zrcxlycwfcrbsispgwju.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3hseWN3ZmNyYnNpc3Bnd2p1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA5NTYxOCwiZXhwIjoyMDg2NjcxNjE4fQ.kCV6ddUhX8m6XqOwBlfgIou71ONbGa5bgfFQlXC391A"   # ← Invullen! (Settings → API → service_role)
XLSX_FILE    = "jukestage_songs.xlsx"    # ← Pas aan als je bestand anders heet
ARTIST_ID    = 1                         # ← Jouw artist ID in Supabase
# ──────────────────────────────────────────────────────────

def main():
    db = create_client(SUPABASE_URL, SUPABASE_KEY)

    wb = openpyxl.load_workbook(XLSX_FILE)
    ws = wb.active

    songs = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        title, artist, key, bpm, ug, karaoke_url, is_karaoke = row
        if not title:
            continue
        songs.append({
            "title":                title.strip(),
            "original_artist":      artist.strip() if artist else None,
            "key_signature":        key if key else None,
            "tempo_bpm":            int(bpm) if bpm else None,
            "ug_tabs":              ug.strip() if ug else None,
            "karaoke_url":          karaoke_url.strip() if karaoke_url else None,
            "is_karaoke_available": str(is_karaoke).upper() == "TRUE",
            "is_active":            True,
        })

    print(f"📋 {len(songs)} nummers gevonden in Excel...")

    # Invoegen in batches van 50
    inserted = 0
    errors = 0
    batch_size = 50

    for i in range(0, len(songs), batch_size):
        batch = songs[i:i+batch_size]
        result = db.from_("songs").insert(batch).execute()

        if result.data:
            new_ids = [s["id"] for s in result.data]
            # Koppel aan artiest via artist_songs
            artist_links = [{"artist_id": ARTIST_ID, "song_id": sid} for sid in new_ids]
            db.from_("artist_songs").insert(artist_links).execute()
            inserted += len(new_ids)
            print(f"  ✓ Batch {i//batch_size + 1}: {len(new_ids)} nummers ingevoegd")
        else:
            errors += batch_size
            print(f"  ✗ Batch {i//batch_size + 1}: fout bij invoegen")

    print(f"\n✅ Klaar! {inserted} nummers ingevoegd, {errors} fouten.")
    if errors:
        print("   Tip: controleer of er al dubbele titels in de tabel staan.")

if __name__ == "__main__":
    main()