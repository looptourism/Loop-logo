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
BEATS="01_fade_in:18 02_logo_still:36 03_car_anticipation:58 04_car_drive:90 05_car_exit:104 \
06_racket_windback:141 07_racket_hit:150 08_ball_ground:159 09_ball_flies_out:161 \
10_soccer_hop_1:198 11_soccer_landing_squash:212 12_soccer_hop_2:227 13_soccer_bounces_out:262 \
14_props_fade_settle:294 15_hold:375 16_last_frame:419"
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
