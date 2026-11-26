# Godot look-dev prototype

Reproduces the Lantern Vale look in Godot 4.3 (Compatibility renderer): 1/3-res SubViewport pixelation, 4-step toon ramp,
depth outline, hard-edged cloud shadows, light shafts, painterly water (3 depth bands, contour lines, foam, caustics), a town patch built from `data/town.json`.

```bash
godot --path .                                   # windowed
./shot.sh plaza out.png                          # headless screenshot (views: plaza | pond | overview); GODOT=/path/to/godot
```
`data/*.json` are copies of `../data/` (run `node ../tools/export_data.mjs` then copy `town.json`, `biomes.json`).
Verified only by rendering on Linux with Mesa llvmpipe (software GL); not tested on a real GPU or on macOS. See `shots/` and `../docs/08_*.md` §10.
