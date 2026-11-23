#!/usr/bin/env bash
# Usage: ./shot.sh <view: plaza|pond|overview> <out.png>   (needs godot 4.3 on PATH or $GODOT, plus xvfb-run on headless Linux)
set -e
cd "$(dirname "$0")"
GODOT="${GODOT:-godot}"
RUN=""; command -v xvfb-run >/dev/null && [ -z "$DISPLAY" ] && RUN="xvfb-run -a -s '-screen 0 1280x720x24'"
eval $RUN "$GODOT" --path . --rendering-driver opengl3 --resolution 1280x720 -- --shot="$2" --view="$1" $3
