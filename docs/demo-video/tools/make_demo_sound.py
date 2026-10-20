#!/usr/bin/env python3
"""Make the Inspector Jake demo video's music bed and SFX with ElevenLabs.

Same endpoints and auth header the Rosecut module already uses in production
(app/Modules/Rosecut/Services/Reels/ElevenLabsSound.php):
  music -> POST /v1/music            {prompt, music_length_ms}
  sfx   -> POST /v1/sound-generation {text, duration_seconds, prompt_influence}

The key comes from ELEVENLABS_API_KEY, or from the .env file named by ELEVENLABS_ENV_FILE, and is never printed.
Writes MP3 44.1 kHz into OUT_DIR, two takes per cue, then ffprobe verifies
each one rather than trusting the byte count.
"""

import json
import os
import pathlib
import subprocess
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ENV = os.environ.get("ELEVENLABS_ENV_FILE", "")     # optional: a .env holding ELEVENLABS_API_KEY
OUT = pathlib.Path(__file__).resolve().parent.parent / "sfx" / "raw"
BASE = "https://api.elevenlabs.io"
FMT = "mp3_44100_128"

# The API's floor for a sound effect is 0.5 s; anything shorter is asked for at
# 0.5 s and trimmed by whoever mixes it. Noted per cue so the report can say so.
MIN_SFX = 0.5

DRY = "dry, close-miked, mono, no reverb, no music, no background noise, single isolated sound"

SFX = {
    "tick":     (0.1, f"A soft, tiny UI hover tick. One very short muted wooden click, quiet and neutral, like a cursor snapping onto a box. {DRY}"),
    "click":    (0.1, f"A crisp laptop trackpad click. One short tactile plastic click, clean and modern. {DRY}"),
    "swoosh":   (0.7, f"A light airy swoosh, soft filtered white noise sweeping quickly past and fading. Gentle, not aggressive, no impact at the end. {DRY}"),
    "pop":      (0.2, f"A soft rounded UI pop, a short plinky bubble pop with a touch of tone, friendly and light, like a card landing in a list. {DRY}"),
    "typing":   (2.0, f"Quiet laptop keyboard typing, steady unhurried rhythm of soft low-profile key presses, no mouse, no voices, consistent through the whole clip. {DRY}"),
    "toggle":   (0.3, f"A soft UI toggle swish, a short muted sliding sound as a segmented control slides from one side to the other. {DRY}"),
    "sent":     (0.4, f"A generic message-sent sound, a short upward whoosh ending in a soft rounded pop. Light and clean, an original design, not any branded notification sound. {DRY}"),
    "whip":     (0.55, f"A fast camera whip-pan whoosh, a quick aggressive air sweep with a short tail, cinematic transition. {DRY}"),
    "blips":    (2.0, f"Subtle digital terminal blips, very soft tiny high-pitched data ticks at an even pace, like text printing to a console. Understated, low in level, steady through the whole clip. {DRY}"),
    "chime":    (0.5, f"A small success chime, two soft bright bell tones rising, clean and short, a task completing. {DRY}"),
    "sparkle":  (0.8, f"A magical shimmer, light glistening high-pitched sparkle tones twinkling upward and fading, delicate and clean. {DRY}"),
    "received": (0.4, f"A gentle message-received ding, one soft warm mellow bell note, quiet and friendly, an original design, not any branded notification sound. {DRY}"),
    "riser":    (0.6, f"A soft rising whoosh, smooth filtered noise and air sweeping upward in pitch, building into a reveal, no impact hit at the end. {DRY}"),
    "thump":    (0.3, f"A soft low thump, a muted rounded bass drop with a short tail, like a picture frame landing on a surface. {DRY}"),
    "boing":    (0.4, f"A playful cartoon pop-up boing, a short bouncy springy rubber boing with a touch of wobble, light and comedic. {DRY}"),
    # the user's notes after the first mix: typing should sound like ice cubes in a cup; the boing was harsh
    "ice":      (2.0, "Ice cubes gently clinking in a glass cup, a light uneven run of small bright glassy tinks and clinks, like someone softly swirling a cold drink, steady through the whole clip. No pouring, no liquid splash, no voices. Dry, close-miked, no reverb, no music, no background noise."),
    # and then: the keys should be thocky, not clicky
    "thock":    (2.0, "Deep, thocky mechanical keyboard typing: lubed linear switches on a foam-dampened board, each key a muted, low, rounded thock with a soft bottom-out, a satisfying marbly sound. Steady, unhurried typing rhythm through the whole clip. No clicky switches, no high-pitched clicks, no spacebar rattle, no voices. Dry, close-miked, no reverb, no music, no background noise."),
    # and then: the sound that brings up the logo was still bad, so one gentle reveal replaces riser + thump + pop
    "reveal":   (1.6, "A warm, gentle logo reveal: a soft airy swell that blooms into one clear, mellow bell chime with a light sparkle tail, pleasant and uplifting, like a friendly app intro. Smooth and rounded. No whoosh, no white noise, no impact hit, no harsh high frequencies, no voices. Dry, close-miked, no music, no background noise."),
    "bloop":    (0.5, f"A soft, warm, rounded cartoon pop-up bloop, a gentle low-mid bubbly pop with a short friendly upward bend, smooth and mellow. No metallic twang, no spring buzz, no harsh high frequencies. {DRY}"),
}

MUSIC_PROMPT = (
    "A 25 second upbeat instrumental product demo music bed at about 112 BPM. Warm modern "
    "electronic lo-fi house: soft rounded sine bass, gentle plucky synth, warm electric piano "
    "chords, light crisp drums with a soft kick and shaker, subtle vinyl warmth. Playful, bright "
    "and friendly but clean and uncluttered, suitable under a software screen recording narrated "
    "by nobody. Absolutely no vocals, no singing, no vocal chops, no speech. Start simple and "
    "intimate, add light percussion and a warm pad through the middle, then lift into a brighter "
    "uplifting swell at about 19 seconds for a logo end card, and resolve cleanly on one final "
    "sustained major chord at about 24 to 25 seconds with a short natural tail. An original "
    "composition with a simple memorable motif, not resembling any existing or well-known song."
)
MUSIC_MS = 25500


def key() -> str:
    """The environment wins, so a key with more headroom can be passed in without editing this."""
    if os.environ.get("ELEVENLABS_API_KEY"):
        return os.environ["ELEVENLABS_API_KEY"].strip()
    if ENV and pathlib.Path(ENV).exists():
        for line in pathlib.Path(ENV).read_text().splitlines():
            if line.startswith("ELEVENLABS_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("Set ELEVENLABS_API_KEY, or ELEVENLABS_ENV_FILE to a .env that has it")


API_KEY = key()


def post(path: str, body: dict, timeout: int) -> bytes:
    req = urllib.request.Request(
        f"{BASE}{path}?output_format={FMT}",
        data=json.dumps(body).encode(),
        headers={"xi-api-key": API_KEY, "Accept": "audio/mpeg", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        detail = e.read()[:300].decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {e.code}: {detail}") from None


def probe(p: pathlib.Path) -> str:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "stream=sample_rate,channels:format=duration,bit_rate",
         "-of", "json", str(p)],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        return "UNREADABLE"
    d = json.loads(out.stdout)
    s = (d.get("streams") or [{}])[0]
    f = d.get("format", {})
    dur = float(f.get("duration", 0) or 0)
    return f"{dur:.2f}s {s.get('sample_rate')}Hz {s.get('channels')}ch {int(f.get('bit_rate', 0) or 0)//1000}kbps"


def done_already(name: str):
    """A re-run must not pay for a cue that already landed. Credits are the scarce thing here."""
    p = OUT / name
    if p.exists() and p.stat().st_size > 512:
        return (name, f"{probe(p)}  (kept, already present)")
    return None


def sfx_job(args):
    cue, take = args
    asked, prompt = SFX[cue]
    seconds = max(asked, MIN_SFX)
    name = f"{cue}-{take}.mp3"
    if (kept := done_already(name)) is not None:
        return (kept[0], kept[1], asked, seconds)
    try:
        audio = post("/v1/sound-generation", {
            "text": prompt,
            "duration_seconds": seconds,
            "prompt_influence": 0.6,
        }, 120)
    except Exception as e:
        return (name, f"FAILED {e}", asked, seconds)
    if len(audio) < 512:
        return (name, f"FAILED tiny response ({len(audio)} bytes)", asked, seconds)
    p = OUT / name
    p.write_bytes(audio)
    return (name, probe(p), asked, seconds)


def music_job(take: int):
    name = "music.mp3" if take == 1 else f"music-{take}.mp3"
    if (kept := done_already(name)) is not None:
        return kept
    try:
        audio = post("/v1/music", {"prompt": MUSIC_PROMPT, "music_length_ms": MUSIC_MS}, 300)
    except Exception as e:
        return (name, f"FAILED {e}")
    if len(audio) < 512:
        return (name, f"FAILED tiny response ({len(audio)} bytes)")
    p = OUT / name
    p.write_bytes(audio)
    return (name, probe(p))


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    what = sys.argv[1] if len(sys.argv) > 1 else "all"

    if what in ("all", "music"):
        print("== music ==", flush=True)
        with ThreadPoolExecutor(max_workers=2) as pool:
            for name, info in pool.map(music_job, [1, 2]):
                print(f"{name:16} {info}", flush=True)

    if what in ("all", "sfx"):
        print("== sfx ==", flush=True)
        jobs = [(c, t) for c in SFX for t in (1, 2)]
        with ThreadPoolExecutor(max_workers=4) as pool:
            for name, info, asked, used in sorted(pool.map(sfx_job, jobs)):
                note = "" if asked >= MIN_SFX else f"  (asked {asked}s, API floor {used}s - trim)"
                print(f"{name:16} {info}{note}", flush=True)
