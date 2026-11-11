#!/usr/bin/env bash
# Renders the deliverables into out/ and one still per story beat into out/frames/.
#   bash scripts/render.sh            all three formats
#   bash scripts/render.sh 9x16       just one
# Picture: sub-frames rendered as lossless PNG, averaged into motion blur by
# accumulate.py, encoded once. Sound is muxed afterwards so it sits on frame 0.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/frames build_cache
[ -f public/audio/loop_sting.wav ] || python3 scripts/make_audio.py
npx remotion bundle src/index.ts --out-dir build_cache/bundle --log=error
# one still per beat, name:frame at 60 fps
BEATS="01_football_drops_in:27 02_first_bounce:33 03_serve:60 04_tennis_bounce:80 05_balls_at_rest:112 \
06_car_arrives:128 07_car_lays_the_loop:160 08_car_on_far_ring:185 09_camera_rises:204 10_balls_become_globes:222 \
11_letters_rise:236 12_tagline:265 13_hold:330 14_last_frame:419"
for id in ${@:-16x9 9x16 1x1}; do
  rm -rf "build_cache/sub_$id"
  npx tsx scripts/plan.ts "$id" "build_cache/plan_$id.json"
  npx remotion render build_cache/bundle "Loop${id}Sub" "build_cache/sub_$id" --sequence --image-format=png --muted --log=error
  python3 scripts/accumulate.py "build_cache/sub_$id" "build_cache/plan_$id.json" "build_cache/picture_$id.mp4" --stills out/frames "$id" $BEATS
  ffmpeg -v error -y -i "build_cache/picture_$id.mp4" -i public/audio/loop_sting.wav \
    -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -ar 48000 -ac 2 -t 7 \
    -movflags +faststart "out/loop_$id.mp4"
  rm -rf "build_cache/sub_$id"
  echo "wrote out/loop_$id.mp4"
done
