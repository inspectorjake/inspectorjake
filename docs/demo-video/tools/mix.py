"""Mix the soundtrack (the music bed plus each sound effect on its cue), then put it on the videos.

    python3.11 tools/mix.py                                   sfx/mix.wav, from sfx/cues.json and the files in sfx/raw/
    python3.11 tools/mix.py --mux out/a-silent.mp4:out/a.mp4  also writes each video with the mix as its audio

A cue's sound is sfx/raw/<sound>.(wav|mp3|...), or <sound>-1.* when there are numbered takes; a cue can name a take
("sound": "click-2"). Leading silence is trimmed so every sound starts on its cue, "from" starts partway into the file
instead, and "length" cuts a sound short with a quick fade. Every sound is first peak-normalised to -1 dBFS, so a cue's gain means the same for every file.
The music can be re-arranged with "segments": [[from, to], ...] in source seconds (to = null for the end), joined
with short crossfades; cut just before downbeats. The mix is normalised to the cue sheet's loudness (about -16 LUFS).
"""

import argparse
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX = os.path.join(ROOT, "sfx")
EXTS = ("wav", "mp3", "m4a", "flac", "ogg")
FORMAT = "aformat=sample_rates=48000:channel_layouts=stereo"


def find(name):
    for stem in (name, f"{name}-1", f"{name}_1"):
        for ext in EXTS:
            path = os.path.join(SFX, "raw", f"{stem}.{ext}")
            if os.path.exists(path):
                return path
    sys.exit(f"missing sound: sfx/raw/{name}.*")


_peaks = {}


def peak_db(path):
    """A file's sample peak in dBFS (ffmpeg volumedetect)."""
    if path not in _peaks:
        err = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "volumedetect", "-f", "null", "-"],
                             capture_output=True, text=True, check=True).stderr
        _peaks[path] = float(err.split("max_volume:")[1].split("dB")[0])
    return _peaks[path]


def music_source(music, chains):
    """The music input, re-arranged by its segments if it has any. Returns the label to read it from."""
    segs = music.get("segments")
    if not segs:
        chains.append(f"[0:a]{FORMAT}[mus]")
        return "[mus]"
    d = music.get("crossfade", 0.012)
    chains.append(f"[0:a]{FORMAT},asplit={len(segs)}" + "".join(f"[ms{j}]" for j in range(len(segs))))
    for j, (a, b) in enumerate(segs):
        # each join overlaps d seconds, split evenly either side of the cut, so the timing stays exact
        start = a - d / 2 if j > 0 else a
        end = f":end={b + d / 2:.4f}" if b is not None else ""
        chains.append(f"[ms{j}]atrim=start={start:.4f}{end},asetpts=PTS-STARTPTS[mp{j}]")
    cur = "[mp0]"
    for j in range(1, len(segs)):
        chains.append(f"{cur}[mp{j}]acrossfade=d={d}:c1=qsin:c2=qsin[mx{j}]")
        cur = f"[mx{j}]"
    return cur


def mix(cfg, out):
    dur = cfg["duration"]
    # A silent bed from 0 s: adelay shifts timestamps, so without it the mix would start at the first sound
    inputs, chains, labels = [], [f"anullsrc=r=48000:cl=stereo,atrim=0:{dur}[bed]"], ["[bed]"]

    music = cfg.get("music")
    if music:
        inputs += ["-i", find(music["file"])]
        src = music_source(music, chains)
        chains.append(f"{src}atrim=0:{dur},volume={music['gain_db']}dB,afade=t=in:d=0.15,"
                      f"afade=t=out:st={music['fade_out_at']}:d={music['fade_out']}[m]")
        labels.append("[m]")

    for i, cue in enumerate(cfg["cues"]):
        n = len(inputs) // 2
        path = find(cue["sound"])
        inputs += ["-i", path]
        gain = cue["gain_db"] - 1 - peak_db(path)
        ms = round(cue["at"] * 1000)
        cut = ""
        if "length" in cue:
            cut = f",atrim=0:{cue['length']},afade=t=out:st={max(0.0, cue['length'] - 0.08):.3f}:d=0.08"
        start = (f"atrim=start={cue['from']},asetpts=PTS-STARTPTS" if "from" in cue
                 else "silenceremove=start_periods=1:start_threshold=-50dB")
        chains.append(f"[{n}:a]{FORMAT},{start}{cut},"
                      f"volume={gain:.2f}dB,adelay={ms}|{ms}[c{i}]")
        labels.append(f"[c{i}]")

    core = (";".join(chains) + f";{''.join(labels)}amix=inputs={len(labels)}:normalize=0:dropout_transition=0,"
            f"apad=whole_dur={dur},atrim=0:{dur}")

    # Two-pass loudness: measure, then one fixed gain (linear mode). Single-pass loudnorm rides the gain, which
    # smears the cues and changes their balance.
    loud = cfg["loudness"]
    target = f"I={loud['lufs']}:TP={loud['true_peak']}:LRA=11"
    probe = subprocess.run(["ffmpeg", "-hide_banner", "-y", *inputs, "-filter_complex",
                            f"{core},loudnorm={target}:print_format=json[out]", "-map", "[out]", "-f", "null", "-"],
                           capture_output=True, text=True, check=True).stderr
    m = json.loads(probe[probe.rindex("{"):probe.rindex("}") + 1])
    measured = (f"measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
                f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex",
                    f"{core},loudnorm={target}:{measured},aresample=48000,alimiter=limit={10 ** (loud['true_peak'] / 20):.3f}:level=false[out]", "-map", "[out]",
                    "-ar", "48000", "-ac", "2", out], check=True)
    print(out)


def mux(video, audio, out):
    """The video stream as it is, plus the mix as AAC."""
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-i", audio, "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest",
                    "-movflags", "+faststart", out], check=True)
    print(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cues", default=os.path.join(SFX, "cues.json"))
    ap.add_argument("--out", default=os.path.join(SFX, "mix.wav"))
    ap.add_argument("--mux", nargs="*", default=[], metavar="SILENT:OUT", help="videos to give the mix to")
    a = ap.parse_args()
    with open(a.cues) as fh:
        cfg = json.load(fh)
    mix(cfg, a.out)
    for pair in a.mux:
        src, dst = pair.split(":", 1)
        mux(src, a.out, dst)


if __name__ == "__main__":
    main()
