# Psychedelic Pills — Lively wallpaper

A live, music-reactive Windows wallpaper for [Lively Wallpaper](https://www.rocksdanister.com/lively/):
you fly through an endless grid of tumbling neon capsules, coloured in rainbow bands by distance.

The shader is a WebGL port of **"Psychedelic Pills" by [@kishimisu](https://www.shadertoy.com/user/kishimisu)**
([shadertoy.com/view/csfSRN](https://www.shadertoy.com/view/csfSRN)), including its 2× anti-aliasing.

## Patterns

| Pattern | What it is |
|---|---|
| Psychedelic pills | The original shader. |
| Pill kaleidoscope | The same flight seen through a slowly turning 6-fold kaleidoscope. |
| Pill vortex | The pill grid twists around the flight axis into a spiral. |

## Install in Lively

1. Download [`PsychedelicPills.zip`](PsychedelicPills.zip).
2. Drag the zip into the Lively window (or **Add Wallpaper → Browse**).
3. Open the wallpaper's **Customize** panel to change pattern, speed, pill size, colours, music reaction and performance.

Music reaction uses Lively's system-audio capture: bass swells the pills and speeds up the flight,
mids add a ripple, treble adds shimmer, and kick drums flash, roll the camera and jump the colours.

If your GPU struggles, set **Anti-aliasing** to *Off* or lower **Render quality** / **FPS limit**.
Lively also pauses the wallpaper when a game or app goes fullscreen.

## Studio (browser)

`wallpaper/studio.html` runs the same engine in a browser with a settings panel, music input
(file or microphone) and a recorder for 9:16 Reels/Stories (1080×1920 MP4 in Chrome/Edge).
It must be served over http:

```bash
python -m http.server 8765 --directory wallpaper
```

Then open http://localhost:8765/studio.html.

## Build

```bash
node tools/build.mjs
```

Regenerates `wallpaper/LivelyProperties.json` from the `SETTINGS` list in `wallpaper/pills.js`
and packs `PsychedelicPills.zip` (Windows, uses PowerShell `Compress-Archive`).

## Licence

The original shader is © 2022 @kishimisu, licensed under
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). This adaptation is shared under
the same licence: credit the original author, non-commercial use only, and share changes alike.
