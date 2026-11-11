import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import { AbsoluteFill, Audio, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import * as THREE from 'three';
import A from './assets.json';
import SHAPES from './shapes.json';
import T from './timeline.json';
import type { Layout } from './layouts';
import {
  BALL_R, CY, HIT, LEFT, LOOP_LEN, RIGHT, RING_T, SLAB, blurSamples, camera, carPose, lettersUp, loopPoint, morph,
  prog, racket, soccerBall, taglineIn, tennisBall, trackDrawn,
} from './motion';
import type { Ball } from './motion';

export const CREAM = '#FFEEC0';
const INK = '#222120';
const RED = '#E5352B';

// ------------------------------------------------------------- textures
const FILES = ['tex_soccer.png', 'tex_tennis.png', 'tex_globe_left.png', 'tex_globe_right.png', 'tagline.png'] as const;
type Tex = Record<(typeof FILES)[number], THREE.Texture>;

const useTextures = (): Tex | null => {
  const [tex, setTex] = useState<Tex | null>(null);
  const [handle] = useState(() => delayRender('loading textures'));
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    Promise.all(FILES.map((f) => loader.loadAsync(staticFile(`assets/${f}`)))).then((list) => {
      const out = {} as Tex;
      list.forEach((t, i) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        out[FILES[i]] = t;
      });
      setTex(out);
      continueRender(handle);
    });
  }, [handle]);
  return tex;
};

// --------------------------------------------------------------- camera
const Camera: React.FC<{ L: Layout; t: number }> = ({ L, t }) => {
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const c = camera(L, t);
  useLayoutEffect(() => {
    cam.fov = c.fov;
    cam.aspect = L.w / L.h;
    cam.near = 50;
    cam.far = 40000;
    cam.position.set(...c.position);
    cam.up.set(...c.up);
    cam.lookAt(...c.target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  });
  return null;
};

// ---------------------------------------------------------------- balls
/** A sphere that is one thing (a ball) and turns into another (a globe). */
const Sphere: React.FC<{ b: Ball; from: THREE.Texture; to: THREE.Texture; k: number; rough: number }> = ({ b, from, to, k, rough }) => {
  const mixU = useMemo(() => ({ value: 0 }), []);
  mixU.value = k;
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: from, roughness: rough, metalness: 0 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.map2 = { value: to };
      shader.uniforms.mixK = mixU;
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform sampler2D map2;\nuniform float mixK;\nvoid main() {')
        .replace('#include <map_fragment>', 'diffuseColor *= mix(texture2D(map, vMapUv), texture2D(map2, vMapUv), mixK);');
    };
    return m;
  }, [from, to, mixU, rough]);
  // rolling so far, then one last spin that lands the globe exactly as the logo draws it
  const q = useMemo(() => new THREE.Quaternion(), []);
  q.setFromAxisAngle(new THREE.Vector3(...b.rollAxis).normalize(), b.roll);
  q.slerp(new THREE.Quaternion(), k);
  q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 4 * k));
  const sx = 1 + (1 - b.sy) * 0.6;
  return (
    <group position={[b.x, b.y, b.z]} scale={[sx, b.sy, sx]}>
      <mesh quaternion={q} material={material} castShadow receiveShadow>
        <sphereGeometry args={[BALL_R, 96, 64]} />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------- track
const STEP = 6;
const useTrack = () =>
  useMemo(() => {
    const n = Math.ceil(LOOP_LEN / STEP);
    const pos: number[] = [];
    const nor: number[] = [];
    const idx: number[] = [];
    const dashPos: number[] = [];
    const dashIdx: number[] = [];
    const hw = RING_T / 2;
    for (let i = 0; i <= n; i++) {
      const p = loopPoint(Math.min(LOOP_LEN, i * STEP));
      const nx = -p.hz;
      const nz = p.hx;
      const L = [p.x - nx * hw, p.z - nz * hw];
      const R = [p.x + nx * hw, p.z + nz * hw];
      // 6 vertices per sample: top pair, left wall pair, right wall pair
      pos.push(L[0], SLAB, L[1], R[0], SLAB, R[1], L[0], SLAB, L[1], L[0], 0, L[1], R[0], SLAB, R[1], R[0], 0, R[1]);
      nor.push(0, 1, 0, 0, 1, 0, -nx, 0, -nz, -nx, 0, -nz, nx, 0, nz, nx, 0, nz);
      dashPos.push(p.x - nx * 3, SLAB + 0.8, p.z - nz * 3, p.x + nx * 3, SLAB + 0.8, p.z + nz * 3);
      if (i < n) {
        const a = i * 6;
        const b = a + 6;
        idx.push(a, a + 1, b, a + 1, b + 1, b, a + 2, b + 2, a + 3, a + 3, b + 2, b + 3, a + 4, a + 5, b + 4, a + 5, b + 5, b + 4);
        const d = i * 2;
        const on = Math.floor((i * STEP) / 34) % 2 === 0;
        if (on) dashIdx.push(d, d + 1, d + 2, d + 1, d + 3, d + 2);
        else dashIdx.push(d, d, d, d, d, d); // keeps the draw range in step with the track
      }
    }
    const track = new THREE.BufferGeometry();
    track.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    track.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    track.setIndex(idx);
    const dashes = new THREE.BufferGeometry();
    dashes.setAttribute('position', new THREE.Float32BufferAttribute(dashPos, 3));
    dashes.setIndex(dashIdx);
    return { track, dashes, n };
  }, []);

const Track: React.FC<{ t: number }> = ({ t }) => {
  const { track, dashes, n } = useTrack();
  const segs = Math.floor(trackDrawn(t) * n);
  track.setDrawRange(0, segs * 18);
  dashes.setDrawRange(0, segs * 6);
  const lane = 1 - prog(t, T.morph[0], T.morph[1]); // lane markings fade as the road becomes the logo
  if (segs === 0) return null;
  return (
    <>
      <mesh geometry={track} castShadow receiveShadow>
        <meshStandardMaterial color={INK} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      {lane > 0 ? (
        <mesh geometry={dashes}>
          <meshBasicMaterial color={CREAM} transparent opacity={lane} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ) : null}
    </>
  );
};

// -------------------------------------------------------------- letters
const useLetters = () =>
  useMemo(() => {
    const geoms: THREE.ExtrudeGeometry[] = [];
    for (const polys of Object.values(SHAPES) as { outer: number[][]; holes: number[][][] }[][]) {
      for (const p of polys) {
        const shape = new THREE.Shape(p.outer.map(([x, y]) => new THREE.Vector2(x, y)));
        for (const h of p.holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
        geoms.push(new THREE.ExtrudeGeometry(shape, { depth: SLAB, bevelEnabled: false, curveSegments: 4 }));
      }
    }
    return geoms;
  }, []);

const Letters: React.FC<{ t: number }> = ({ t }) => {
  const geoms = useLetters();
  const up = lettersUp(t);
  if (up <= 0) return null;
  return (
    <group position={[0, SLAB * up, 0]} scale={[1, Math.max(up, 0.001), 1]}>
      {geoms.map((g, i) => (
        <mesh key={i} geometry={g} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={INK} roughness={0.85} transparent={up < 1} opacity={Math.min(1, up * 1.6)} />
        </mesh>
      ))}
    </group>
  );
};

// ------------------------------------------------------------------ car
// A small racing car built from simple solids. Nose points along +x.
const Car: React.FC<{ t: number }> = ({ t }) => {
  const c = carPose(t);
  if (!c.visible) return null;
  const paint = <meshStandardMaterial color={RED} roughness={0.35} metalness={0.1} />;
  const dark = <meshStandardMaterial color="#1c1c1c" roughness={0.7} />;
  const wheel = (x: number, z: number, r: number) => (
    <mesh position={[x, r, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[r, r, 13, 24]} />
      {dark}
    </mesh>
  );
  return (
    <group position={[c.x, SLAB, c.z]} rotation={[0, c.yaw, 0]} scale={1.7}>
      <mesh position={[-8, 9, 0]} castShadow>{/* tub */}
        <boxGeometry args={[70, 10, 20]} />
        {paint}
      </mesh>
      <mesh position={[48, 7, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[1, 1, 1.6]} castShadow>{/* nose */}
        <coneGeometry args={[5.5, 46, 4]} />
        {paint}
      </mesh>
      <mesh position={[-12, 8, 17]} castShadow>{/* side pods */}
        <boxGeometry args={[40, 8, 12]} />
        {paint}
      </mesh>
      <mesh position={[-12, 8, -17]} castShadow>
        <boxGeometry args={[40, 8, 12]} />
        {paint}
      </mesh>
      <mesh position={[-26, 18, 0]} castShadow>{/* engine cover */}
        <boxGeometry args={[30, 10, 9]} />
        {paint}
      </mesh>
      <mesh position={[2, 15, 0]}>{/* cockpit */}
        <boxGeometry args={[16, 5, 10]} />
        {dark}
      </mesh>
      <mesh position={[68, 4, 0]} castShadow>{/* front wing */}
        <boxGeometry args={[9, 2.5, 58]} />
        {dark}
      </mesh>
      <mesh position={[-60, 24, 0]} castShadow>{/* rear wing */}
        <boxGeometry args={[10, 3, 46]} />
        {dark}
      </mesh>
      <mesh position={[-60, 16, 20]}>
        <boxGeometry args={[12, 18, 2]} />
        {dark}
      </mesh>
      <mesh position={[-60, 16, -20]}>
        <boxGeometry args={[12, 18, 2]} />
        {dark}
      </mesh>
      {wheel(44, 25, 11)}
      {wheel(44, -25, 11)}
      {wheel(-44, 26, 12.5)}
      {wheel(-44, -26, 12.5)}
    </group>
  );
};

// --------------------------------------------------------------- racket
const REACH = 780; // grip to the middle of the strings
const CONTACT_DEG = 222; // at contact the head lies down-left of the grip
const useStrings = () =>
  useMemo(() => {
    const pts: number[] = [];
    const a = 246;
    const b = 326;
    for (let x = -a + 26; x < a; x += 34) {
      const y = b * Math.sqrt(1 - (x * x) / (a * a));
      pts.push(x, -y, 0, x, y, 0);
    }
    for (let y = -b + 26; y < b; y += 34) {
      const x = a * Math.sqrt(1 - (y * y) / (b * b));
      pts.push(-x, y, 0, x, y, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

const Racket: React.FC<{ t: number }> = ({ t }) => {
  const strings = useStrings();
  const r = racket(t);
  if (!r.visible) return null;
  const rad = (CONTACT_DEG * Math.PI) / 180;
  const grip: [number, number, number] = [HIT.x - REACH * Math.cos(rad), HIT.y - REACH * Math.sin(rad) + r.lift, HIT.z - 40];
  const frame = <meshStandardMaterial color="#F08A24" roughness={0.4} />;
  return (
    <group position={grip} rotation={[0, 0, rad - Math.PI / 2 - (r.angle * Math.PI) / 180]}>
      <mesh position={[0, 60, 0]} castShadow>{/* grip */}
        <cylinderGeometry args={[24, 26, 400, 20]} />
        <meshStandardMaterial color="#F4F1E8" roughness={0.9} />
      </mesh>
      <mesh position={[-62, 345, 0]} rotation={[0, 0, 0.42]} castShadow>{/* throat */}
        <cylinderGeometry args={[13, 13, 230, 12]} />
        {frame}
      </mesh>
      <mesh position={[62, 345, 0]} rotation={[0, 0, -0.42]} castShadow>
        <cylinderGeometry args={[13, 13, 230, 12]} />
        {frame}
      </mesh>
      <group position={[0, REACH, 0]}>
        <mesh scale={[260, 340, 300]} castShadow>
          <torusGeometry args={[1, 0.055, 14, 96]} />
          {frame}
        </mesh>
        <lineSegments geometry={strings}>
          <lineBasicMaterial color="#8a8474" />
        </lineSegments>
      </group>
    </group>
  );
};

// ---------------------------------------------------------------- scene
const World: React.FC<{ L: Layout; t: number; tex: Tex }> = ({ L, t, tex }) => {
  const k = morph(t);
  const tb = tennisBall(t);
  const tag = taglineIn(t);
  return (
    <>
      <Camera L={L} t={t} />
      <color attach="background" args={[CREAM]} />
      <ambientLight intensity={1.5} />
      <directionalLight
        position={[-700, 3400, 1500]} intensity={2.1} castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={3}
        shadow-camera-left={-2600} shadow-camera-right={3400} shadow-camera-top={2600} shadow-camera-bottom={-2600}
        shadow-camera-near={100} shadow-camera-far={9000}
      />
      {/* the floor is the cream itself; it only shows shadows */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[800, 0, 300]} receiveShadow>
        <planeGeometry args={[40000, 40000]} />
        <shadowMaterial color="#5a4520" opacity={0.26} />
      </mesh>

      <Track t={t} />
      <Letters t={t} />
      <Sphere b={soccerBall(t)} from={tex['tex_soccer.png']} to={tex['tex_globe_left.png']} k={k} rough={0.45} />
      {tb.visible ? <Sphere b={tb} from={tex['tex_tennis.png']} to={tex['tex_globe_right.png']} k={k} rough={0.75 - 0.3 * k} /> : null}
      <Racket t={t} />
      <Car t={t} />

      {tag > 0 ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[A.tagline.dx + A.tagline.w / 2, 1.2, A.tagline.dy + A.tagline.h / 2 + 14 * (1 - tag)]}>
          <planeGeometry args={[A.tagline.w, A.tagline.h]} />
          <meshBasicMaterial map={tex['tagline.png']} transparent opacity={tag} toneMapped={false} depthWrite={false} />
        </mesh>
      ) : null}
    </>
  );
};

/** The whole picture at time t (seconds). Pure: the same t always draws the same frame. */
export const Scene: React.FC<{ L: Layout; t: number }> = ({ L, t }) => {
  const tex = useTextures();
  return (
    <AbsoluteFill style={{ backgroundColor: CREAM }}>
      {tex ? (
        <ThreeCanvas width={L.w} height={L.h} shadows="soft" flat gl={{ antialias: true }} dpr={1}>
          <World L={L} t={t} tex={tex} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};

// Motion blur: a 180 degree shutter, done exactly. Fast frames are drawn at
// several instants across the shutter interval ("sub-frames"), rendered as
// their own images and averaged afterwards by scripts/accumulate.py.
const SHUTTER = 0.5; // fraction of a frame

/** every sub-frame of the film, in order: which output frame it belongs to and its instant */
export const subFramePlan = (fps: number, frames: number) => {
  const groups: number[] = [];
  const times: number[] = [];
  for (let f = 0; f < frames; f++) {
    const t = f / fps;
    const n = blurSamples(t);
    groups.push(n);
    for (let i = 0; i < n; i++) times.push(n === 1 ? t : t + (SHUTTER / fps) * ((i + 0.5) / n - 0.5));
  }
  return { groups, times };
};

/** Preview / sharp version: one sample per frame, with sound. */
export const Sting: React.FC<{ layout: Layout }> = ({ layout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Scene L={layout} t={frame / fps} />
      <Audio src={staticFile('audio/loop_sting.wav')} />
    </AbsoluteFill>
  );
};

/** Master picture: one frame of this composition per sub-frame. */
export const StingSub: React.FC<{ layout: Layout; times: number[] }> = ({ layout, times }) => {
  const frame = useCurrentFrame();
  return <Scene L={layout} t={times[Math.min(frame, times.length - 1)]} />;
};
