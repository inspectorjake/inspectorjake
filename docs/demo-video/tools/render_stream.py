"""Render an animation page straight to a finished MP4: parallel, forward-only, nothing written per frame.

Copied from the homes2go "Rent to Keys" motion kit; the frame size became an option (--width/--height, default
1920x1080).

Motion blur is drawn by the page (js/motionblur.js), so a frame is one capture. window.seek(t) may return nothing or a
promise; the renderer waits for it and then two animation frames before each capture. Only where the page asks for it,
with window.blurN(t) > 1 (camera moves: dives, zooms, 3D flights), does a frame average N sub-frames across a 180°
shutter. While it does, window.__accumulating is true and the page draws those sub-frames sharp.

Each worker renders a contiguous chunk in ascending time and pipes raw RGB into its own ffmpeg (BT.709 conversion and
tags), so no PNG is saved and no frame folder can go stale. The segments are joined without re-encoding, then the audio
is muxed.

    python3.11 render_stream.py video --port 8771 --out out/v.mp4 --audio sfx/mix.wav \
        [--page index.html] [--workers 4] [--preview out/v-preview.mp4] [--sheet out/v-sheet.jpg]
        [--no-mb]          the page's motion blur off (A/B)
        [--accum N]        average N sub-frames on EVERY frame instead (the old reference look)
    python3.11 render_stream.py stills --port 8771 --dir stills 1.5 4.6 6.0       PNGs, blur included

Times for stills go before or after the options; a frame's blur needs the frame before it, which the page measures
by itself. Serve the folder first:  exec python3.11 -I -m http.server <port> --bind 127.0.0.1 --directory <folder>
"""

import argparse
import base64
import io
import json
import os
import queue
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from multiprocessing import Process

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

W, H = 1920, 1080        # default frame size (16:9 for the README); --width/--height override it
ENC_VF = ("scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,"
          "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv")
X264 = ["-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-g", "60"]
LAUNCH_ARGS = []        # extra Chromium flags; the Lambda handler (tools/lambda/handler.py) sets its own


SEEK =("(t) => new Promise((done) => { Promise.resolve(window.seek(t)).then(() => "
        "requestAnimationFrame(() => requestAnimationFrame(done))); setTimeout(done, 250); })")


def decode(data):
    return np.asarray(Image.open(io.BytesIO(data)).convert("RGB"))     # RGB even when Chromium sends RGBA


def serve(root):
    """Serve a page folder on 127.0.0.1 from a thread (file:// breaks fetches). Returns (server, port, missing), where
    missing collects every path answered with an error, so an incomplete bundle shows up instead of a blank frame."""
    from functools import partial
    from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
    missing = []

    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def send_error(self, code, *rest, **kw):
            missing.append(f"{code} {self.path}")
            super().send_error(code, *rest, **kw)

    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=root))
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, server.server_address[1], missing


def open_page(p, a):
    t0 = time.time()
    browser = p.chromium.launch(args=LAUNCH_ARGS)
    a.launch_s = round(time.time() - t0, 2)               # how long Chromium took to start (reported by Lambda)
    page = browser.new_page(viewport={"width": a.width, "height": a.height})
    page.goto(f"http://127.0.0.1:{a.port}/{a.page}")
    page.wait_for_function("window.ready === true", timeout=120000)
    a.ready_s = round(time.time() - t0, 2)                # launch + load + window.ready
    if a.no_mb:
        page.evaluate("window.MB && (window.MB.enabled = false)")
    cdp = page.context.new_cdp_session(page)

    def grab(t):
        # Wait two animation frames after the seek (and for seek's promise, if it returns one): with SVG filters on,
        # Chromium otherwise sometimes captures layers it hasn't re-rastered yet (±2 grey levels, 1 run in 3).
        page.evaluate(SEEK, max(0.0, t))
        return base64.b64decode(cdp.send("Page.captureScreenshot", {"format": "png", "optimizeForSpeed": True})["data"])

    def subframes(t):
        if a.accum:
            return a.accum
        return int(page.evaluate(f"window.blurN ? Math.max(1, Math.round(window.blurN({t:.6f}))) : 1"))

    return browser, page, grab, subframes


def capture(page, grab, pool, t, n, fps, shutter):
    """Futures for one frame: one capture, or n sub-frames taken sharp and averaged later."""
    if n <= 1:
        return [pool.submit(decode, grab(t))]
    page.evaluate("window.__accumulating = true")
    futs = [pool.submit(decode, grab(t + ((k + 0.5) / n - 0.5) * shutter / fps)) for k in range(n)]
    page.evaluate("window.__accumulating = false")
    return futs


def combine(futs):
    if len(futs) == 1:
        return futs[0].result()
    acc = futs[0].result().astype(np.float32)
    for fu in futs[1:]:
        acc += fu.result()
    return np.clip(acc / len(futs) + 0.5, 0, 255).astype(np.uint8)


def encoder(fps, seg, w, h):
    """ffmpeg reading raw RGB frames on stdin and writing one H.264 segment (BT.709 conversion and tags, no audio)."""
    return subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
                             "-r", str(fps), "-i", "-", "-vf", ENC_VF, *X264, "-crf", "16", "-maxrate", "12M",
                             "-bufsize", "24M", "-an", seg], stdin=subprocess.PIPE)


def render_frames(page, grab, subframes, frames, fps, shutter, enc, tag, frame_s=None):
    """Capture frames in ascending time into the encoder's stdin. Returns the number of captures. frame_s, if given,
    collects each frame's seconds (the Lambda orchestrator balances the next render's chunks on them)."""
    q = queue.Queue(maxsize=6)
    failed = []

    def write():
        while (futs := q.get()) is not None:
            if failed:
                continue                       # keep draining so the capture loop never blocks on a full queue
            try:
                enc.stdin.write(combine(futs).tobytes())
            except Exception as e:             # ffmpeg died (a broken pipe): stop at the next frame, not at a timeout
                failed.append(e)

    writer = threading.Thread(target=write, daemon=True)
    writer.start()
    pool = ThreadPoolExecutor(3)
    captures = 0
    t0 = time.time()
    for j, f in enumerate(frames):
        if failed:
            break
        t = f / fps
        tf = time.time()
        futs = capture(page, grab, pool, t, subframes(t), fps, shutter)
        captures += len(futs)
        q.put(futs)
        if frame_s is not None:
            frame_s.append(round(time.time() - tf, 3))
        if j % 60 == 0:
            print(f"[{tag}] {j}/{len(frames)} {time.time() - t0:.0f}s", flush=True)
    q.put(None)
    writer.join()
    pool.shutdown(wait=True)
    if failed:
        raise RuntimeError(f"{tag}: writing to ffmpeg failed: {failed[0]!r}")
    return captures


def join(segs, tmp, audio, dur, out, frames=None, fps=30):
    """Join segments without re-encoding, mux the audio (AAC 48 kHz stereo) and move the index to the front.

    frames: each segment's frame count. Each segment's exact duration (frames / fps) then goes into the concat list,
    so every frame lands on the n/fps grid. Without it the concat demuxer offsets each segment by the duration it
    reads from the file, which some ffmpeg builds (Debian's 5.1) get wrong by a few timebase ticks per segment:
    22 segments drifted 5.7 ms and failed the 30 fps / 22.000 s check."""
    listing = os.path.join(tmp, "list.txt")
    with open(listing, "w") as fh:
        for i, s in enumerate(segs):
            fh.write(f"file '{s}'\n" + (f"duration {frames[i] / fps:.6f}\n" if frames else ""))
    aud = ["-i", audio, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"] \
        if audio else ["-an"]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listing, *aud,
                    "-c:v", "copy", "-movflags", "+faststart", "-t", f"{dur:.3f}", out], check=True)
    grid_timestamps(out, fps)                       # rosecut-motion, 2026-10-12: see grid_timestamps below


# ---- rosecut-motion, 2026-10-12: a last guard on the join ----------------------------------------------------------
# The concat list's exact durations (above) fix the cause. This checks the result anyway: if any video packet is off the
# n/fps grid (seen before that fix: one frame 0.03301 s after the last at a segment boundary, so avg_frame_rate read
# 30.0005 and the 30 fps check failed), it rewrites the timestamps in place without re-encoding (the setts bitstream
# filter: DTS = n frames from the first, each packet keeping its PTS-DTS reordering offset). Needs ffprobe, which ships
# with ffmpeg (Debian's package included). Returns how many packets were off; 0 leaves the file untouched.
def grid_timestamps(path, fps):
    probe = lambda entries: subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", entries,
                                            "-of", "csv=p=0", path], capture_output=True, text=True, check=True).stdout.split()
    num, den = map(int, probe("stream=time_base")[0].split("/"))
    step = den / num / fps                          # ticks per frame
    pts = sorted(int(x) for x in probe("packet=pts") if x.strip().lstrip("-").isdigit())
    off = sum(1 for i, t in enumerate(pts) if abs(t - pts[0] - i * step) > 0.5)
    if not off or step != round(step):
        return off
    step = int(step)
    fixed = path + ".grid.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-map", "0", "-c", "copy", "-bsf:v",
                    f"setts=dts=STARTDTS+N*{step}:pts=PTS-DTS+STARTDTS+N*{step}", "-movflags", "+faststart", fixed], check=True)
    os.replace(fixed, path)
    print(f"[join] {off} frame(s) were off the 1/{fps} s grid: timestamps rewritten, no re-encode", flush=True)
    return off
# ---- end rosecut-motion -------------------------------------------------------------------------------------------


def worker(a, frames, wid, seg, stats):
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(1))    # terminate() -> close Chromium and ffmpeg on the way out
    enc = encoder(a.fps, seg, a.width, a.height)
    with sync_playwright() as p:
        browser, page, grab, subframes = open_page(p, a)
        t0 = time.time()
        captures = render_frames(page, grab, subframes, frames, a.fps, a.shutter, enc, f"w{wid}")
        browser.close()
    enc.stdin.close()
    if enc.wait():
        sys.exit(f"worker {wid}: ffmpeg failed")
    with open(stats, "w") as fh:
        json.dump({"frames": len(frames), "captures": captures, "s": round(time.time() - t0, 1)}, fh)
    print(f"[w{wid}] done {len(frames)} frames, {captures} captures in {time.time() - t0:.1f}s", flush=True)


def plan(a):
    """The duration, and each frame's cost in captures (window.blurN), read once from the page."""
    with sync_playwright() as p:
        browser, page, _, _ = open_page(p, a)
        d = a.duration or float(page.evaluate("window.DURATION || 22"))
        n = round(d * a.fps)
        costs = [a.accum] * n if a.accum else page.evaluate(
            "([n, fps]) => Array.from({ length: n }, (_, f) => window.blurN ? Math.max(1, Math.round(window.blurN(f / fps))) : 1)",
            [n, a.fps])
        browser.close()
    return d, costs


def chunks(costs, w):
    """Split frames into w contiguous chunks of about equal cost (a capture, plus a little per frame for the encode)."""
    weight = np.cumsum(np.asarray(costs, float) + 0.3)
    cuts = [0] + [int(np.searchsorted(weight, weight[-1] * i / w)) for i in range(1, w)] + [len(costs)]
    return [(cuts[i], cuts[i + 1]) for i in range(w) if cuts[i + 1] > cuts[i]]


def video(a):
    start = time.time()
    dur, costs = plan(a)
    frames = list(range(len(costs)))
    parts = chunks(costs, max(1, min(a.workers, len(frames))))     # balanced by cost, not by frame count
    w = len(parts)
    tmp = tempfile.mkdtemp(prefix="render_stream_")
    try:
        segs = [os.path.join(tmp, f"seg{i}.mp4") for i in range(w)]
        stats = [os.path.join(tmp, f"stats{i}.json") for i in range(w)]
        procs = [Process(target=worker, args=(a, frames[lo:hi], i, segs[i], stats[i])) for i, (lo, hi) in enumerate(parts)]
        try:
            for p in procs:
                p.start()
            for p in procs:
                p.join()
        finally:                      # stopped part-way (Ctrl-C, a failed worker): take the other workers down too
            for p in procs:
                if p.is_alive():
                    p.terminate()
        if any(p.exitcode for p in procs):
            sys.exit("a worker failed")
        os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
        join(segs, tmp, a.audio, dur, a.out, [hi - lo for lo, hi in parts], a.fps)
        captures = sum(json.load(open(s))["captures"] for s in stats)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    if a.preview:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.out, "-vf", ENC_VF, *X264, "-crf", "21", "-maxrate", "9M",
                        "-bufsize", "18M", "-c:a", "copy", "-movflags", "+faststart", a.preview], check=True)
    if a.sheet:
        cols = 11 if a.height > a.width else 6
        rows = -(-round(dur * 2) // cols)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.out, "-vf",
                        f"fps=2,scale={a.width // 5}:{a.height // 5},tile={cols}x{rows}:padding=4", "-frames:v", "1", a.sheet], check=True)
    print(json.dumps({"out": a.out, "frames": len(frames), "captures": captures, "workers": w,
                      "wall_s": round(time.time() - start, 1)}))


def stills(a):
    os.makedirs(a.dir, exist_ok=True)
    with sync_playwright() as p:
        browser, page, grab, subframes = open_page(p, a)
        pool = ThreadPoolExecutor(3)
        for t in sorted(a.times):            # ascending: the page only ever seeks forward
            img = combine(capture(page, grab, pool, t, subframes(t), a.fps, a.shutter))
            path = os.path.join(a.dir, f"t{t:05.2f}.png")
            Image.fromarray(img).save(path, compress_level=1)
            print(path, flush=True)
        browser.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["video", "stills"])
    ap.add_argument("--port", type=int, required=True)
    ap.add_argument("--page", default="index.html")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--width", type=int, default=W)
    ap.add_argument("--height", type=int, default=H)
    ap.add_argument("--shutter", type=float, default=0.5)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--duration", type=float, help="default: the page's window.DURATION")
    ap.add_argument("--out", default="out/video.mp4")
    ap.add_argument("--audio", help="the final mix (song + effects, about -14 LUFS)")
    ap.add_argument("--preview", help="also write a smaller copy for sending (under 30 MB)")
    ap.add_argument("--sheet", help="also write a contact sheet, a frame every 0.5 s")
    ap.add_argument("--dir", default="stills")
    ap.add_argument("--no-mb", action="store_true", help="turn the page's motion blur off")
    ap.add_argument("--accum", type=int, default=0, help="average N sub-frames on every frame (reference look)")
    a, extra = ap.parse_known_args()
    try:
        a.times = [float(x) for x in extra]       # stills: times may sit anywhere among the options
    except ValueError:
        ap.error(f"unrecognised arguments: {' '.join(extra)}")
    if a.mode == "video" and a.times:
        ap.error("times are only for stills")
    video(a) if a.mode == "video" else stills(a)


if __name__ == "__main__":
    main()
