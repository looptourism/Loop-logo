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
BEATS="01_ball_drops_in:24 02_first_bounce:31 03_second_hop:45 04_serve_toss:76 05_racket_hit:89 \
06_tennis_bounce:104 07_balls_at_rest:130 08_loop_drawing:152 09_loop_drawn:182 10_car_enters:196 \
11_car_wipes_logo_on:207 12_car_exits:222 13_tagline:250 14_hold:330 15_last_frame:419"
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
