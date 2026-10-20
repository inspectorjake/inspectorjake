# README demo video

The motion graphics at the top of the main README. The whole video is one web page, `index.html`: a paused GSAP
timeline drives a camera through a browser (a demo Inspector Jake landing page plus the Inspector Jake DevTools
panel) and a Claude Code terminal. Each frame is a pure function of time, so a headless browser can render it frame by frame.

There are two versions of the same timeline:

- **Camera** (`index.html`): the camera zooms and pans to each action.
- **Static** (`index.html?static`): a fixed camera. The browser fills the left, the terminal sits beside it with the
  captions underneath, and a soft spotlight dims whatever isn't in play.

| Path | What it is |
|---|---|
| `index.html` | The animation. `window.seek(t)` draws time `t`; `window.DURATION` is the length. |
| `assets/logo.svg` | Jake, copied from `packages/chrome-extension/icons/logo.svg`. |
| `vendor/` | GSAP 3.15 and CustomEase ([standard license](https://gsap.com/standard-license)). |
| `js/motionblur.js` | Motion blur the page draws itself, for things that fly across a still camera. |
| `tools/render_stream.py` | Headless renderer: parallel workers piping frames into ffmpeg. Camera moves are blurred by averaging sub-frames where `window.blurN(t)` asks for them. |

`js/motionblur.js` and `tools/render_stream.py` come from the homes2go "Rent to Keys" motion kit. The only change is
that the renderer's frame size is now an option (`--width`/`--height`, default 1920×1080).

## Preview

Serve the folder and open the page:

```bash
python3 -m http.server 8793 --bind 127.0.0.1 --directory docs/demo-video
# http://127.0.0.1:8793/?play     plays it in real time, looping
# http://127.0.0.1:8793/?t=12.5   shows one moment
# http://127.0.0.1:8793/?static&play   the fixed-camera version
```

## Render

Needs Python 3.11 with `playwright`, `numpy` and `pillow` (plus `playwright install chromium`), and `ffmpeg`. With the
folder served as above:

```bash
cd docs/demo-video
python3.11 tools/render_stream.py stills --port 8793 --dir stills 2.1 6.0 12.7     # PNGs of single moments
python3.11 tools/render_stream.py video --port 8793 --workers 4 \
  --out out/inspector-jake-demo-master.mp4 --sheet out/sheet.jpg                  # 1920×1080, 30 fps, silent
python3.11 tools/render_stream.py video --port 8793 --workers 4 --page 'index.html?static' \
  --out out/inspector-jake-demo-static-master.mp4                               # the fixed-camera version

# a lighter encode of each, so it stays under GitHub's 10 MB video limit once the sound is on
for n in inspector-jake-demo inspector-jake-demo-static; do
  ffmpeg -i out/$n-master.mp4 -c:v libx264 -profile:v high -preset slow -crf 21 -pix_fmt yuv420p \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 -an -movflags +faststart out/$n-silent.mp4
done
```

Then add the soundtrack (below).

## Sound

The music bed and sound effects come from ElevenLabs (a paid plan, so commercial use is covered with no attribution).

| Path | What it is |
|---|---|
| `tools/make_demo_sound.py` | Asks ElevenLabs for the music and every effect (two takes each) into `sfx/raw/`. It skips files already there. Needs `ELEVENLABS_API_KEY`, or `ELEVENLABS_ENV_FILE` naming a `.env` that has it. |
| `sfx/raw/` | The takes. The ones in use were picked by envelope: single clean hits, no doubles, nothing broken. |
| `sfx/cues.json` | When each effect plays, its gain, and how the music is arranged. |
| `tools/mix.py` | Mixes the music and effects to `sfx/mix.wav` at -16 LUFS, then adds it to the videos. |

Notes:

- ElevenLabs placed the music's final chord at 17.2 s, not at the end. The track is a steady 112 BPM, so the cue sheet replays bars 6-7. The chord then lands at 21.46 s, just after the end card's title, and rings out under the end card.
- Each effect is peak-normalised before its gain. The gains set each effect's peak 6-16 dB above the music at that moment, and the same sound always gets the same gain.
- Effects land on the frame where the motion makes contact, or one frame after it.

```bash
python3.11 tools/mix.py --mux out/inspector-jake-demo-silent.mp4:out/inspector-jake-demo.mp4 \
  out/inspector-jake-demo-static-silent.mp4:out/inspector-jake-demo-static.mp4
```

The output goes to `out/`, which git ignores. GitHub only plays videos inline when they're uploaded as attachments,
so to update the README, edit `README.md` on github.com, drag the new MP4 into the editor, and use the URL it gives you.

## Rules the page keeps

- Never return the timeline from `window.seek`: Playwright hangs serialising it.
- `fromTo()` always gets `immediateRender: false` (the page wraps `tl.fromTo`), or the from-state flashes on frame 0.
- Two tweens must never animate the same property at overlapping times. The camera drifts only between moves.
- Render in ascending time. Seeking backwards past a `fromTo` shows its from-state.
