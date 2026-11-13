"use client"

// LED Badges by Louis Studios.
// 140+ more hand-made React components at https://studios.lou15.com/?ref=21st-code

import * as React from "react"

export interface LedBadgesProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /**
   * Messages for the seven bar badges, in reading order: the top bar first, the tall bar on the right last.
   * Each bar scrolls its message as an LED marquee. Missing entries fall back to the defaults.
   */
  messages?: string[]
  /** LED colours of the seven bar badges, in the same order as `messages`. Any CSS colour. */
  colors?: string[]
  /** LED colours of the four round badges: the grinning face, the smiling face, the tall-eyed face and the ring. */
  iconColors?: string[]
  /** Backdrop colour painted behind the pile. Use "transparent" to let the page show through (the glow still adds light). */
  background?: string
  /** Colour of the gunmetal bezels around every badge. */
  bezel?: string
  /**
   * Font of the marquee text, as a CSS font family stack. The heavy face is rasterised onto the LED grid
   * at 10 of the 12 dot rows, so its strokes land 2 to 3 dots thick. "5x7" uses the built-in 5 by 7 pixel font instead.
   */
  font?: string
  /** Horizontal squeeze applied to the CSS font before it is rasterised. 0.85 condenses a black grotesque like the reference; 1 keeps the font's own width. Ignored for "5x7". */
  stretch?: number
  /** Playback speed multiplier for the marquees, the blinks and the drift. 1 is the designed timing; 0 freezes the motion. */
  speed?: number
  /** Strength of the LED bloom and of the light that bleeds onto the bezels. 0 turns the glow off, 1 matches the design. */
  glow?: number
  /** Pointer movement tilts the pile in 3D with parallax, and a click flashes every LED and restarts the marquees. */
  interactive?: boolean
}

const MESSAGES = ["LOUIS STUDIOS", "NEW DROP", "HI", "ONLINE", "MADE BY HAND", "24/7", "HELLO"]
const COLORS = ["#ff1f3c", "#2f74ff", "#ffaa22", "#1ff09c", "#2f6cff", "#bf36ff", "#62f52a"]
const ICON_COLORS = ["#c6f53a", "#2ef2c2", "#e02ee8", "#ff9a2a"]
const BACKGROUND = "#000000"
const BEZEL = "#2b2c31"
const FONT = '"Arial Black", "Arial Bold", Gadget, "Helvetica Neue", Helvetica, Arial, sans-serif'

/* ------------------------------------------------------------------ */
/* Layout, measured on the 720 x 720 reference frame (y down).          */
/* x, y: LED window centre. a: clockwise angle in degrees. l, h: window */
/* size. inv: lit background with dark letters. z: stacking layer.      */
/* ------------------------------------------------------------------ */

type BarSpec = { x: number; y: number; a: number; l: number; h: number; inv: number; z: number; v: number; o: number; lean: number }
type CoinSpec = { x: number; y: number; a: number; d: number; icon: IconKind; z: number; lean: number }
type IconKind = "grin" | "smile" | "strokes" | "ring"

// o: dot column where the message starts in the resting frame. lean: oval tilt of the LEDs in degrees.
const BARS: BarSpec[] = [
  { x: 268, y: 137, a: -18, l: 366, h: 76, inv: 0, z: 0, v: 11, o: 1, lean: 28 },
  { x: 432, y: 190, a: 11.5, l: 358, h: 75, inv: 1, z: 1, v: 8, o: 2, lean: 52 },
  { x: 392, y: 287, a: 30, l: 326, h: 66, inv: 0, z: 2, v: 13, o: 1, lean: 62 },
  { x: 277, y: 369, a: 10.5, l: 350, h: 70, inv: 0, z: 6, v: 9, o: 1, lean: 48 },
  { x: 302, y: 466, a: 2, l: 318, h: 76, inv: 0, z: 5, v: 12, o: 1, lean: 58 },
  { x: 252, y: 574, a: 22, l: 342, h: 57, inv: 1, z: 4, v: 10, o: 1, lean: 40 },
  { x: 527, y: 427, a: -68.5, l: 328, h: 64, inv: 1, z: 3, v: 7, o: 3, lean: 22 },
]
const COINS: CoinSpec[] = [
  { x: 172, y: 260, a: -22, d: 108, icon: "grin", z: 7, lean: 40 },
  { x: 498, y: 128, a: -4, d: 100, icon: "smile", z: 8, lean: 30 },
  { x: 386, y: 318, a: 4, d: 108, icon: "strokes", z: 9, lean: 55 },
  { x: 372, y: 556, a: 0, d: 100, icon: "ring", z: 10, lean: 35 },
]

// Blink and wink schedule over one 10 s loop: [coin, start, kind] (kind 1 blink, 2 wink).
const BLINKS: [number, number, number][] = [
  [1, 1.7, 1], [1, 5.9, 2], [1, 8.6, 1],
  [0, 3.3, 1], [0, 7.4, 2],
  [2, 2.6, 2], [2, 6.8, 1], [2, 9.25, 1],
]

const LOOP = 10 // seconds per seamless loop at speed 1
const ROWS = 12 // dot rows across a bar, counted on the reference (about 6.3 px rows, 7 px columns)
const CAP = 10 // text rows, one blank row above and below
const LAYER_Z = 19
const BAR_DEPTH = 13
const COIN_DEPTH = 19
const BORDER = 5.5
const CAM = { x: -1150, y: -1350, d: 2600 }

/* ------------------------------------------------------------------ */
/* 5 x 7 pixel font                                                     */
/* ------------------------------------------------------------------ */

const GLYPHS: Record<string, string> = {
  A: "0E11111F111111", B: "1E11111E11111E", C: "0E11101010110E", D: "1C12111111121C",
  E: "1F10101E10101F", F: "1F10101E101010", G: "0E11101711110F", H: "1111111F111111",
  I: "0E04040404040E", J: "0702020202120C", K: "11121418141211", L: "1010101010101F",
  M: "111B1515111111", N: "11111915131111", O: "0E11111111110E", P: "1E11111E101010",
  Q: "0E11111115120D", R: "1E11111E141211", S: "0F10100E01011E", T: "1F040404040404",
  U: "1111111111110E", V: "11111111110A04", W: "1111111515150A", X: "11110A040A1111",
  Y: "1111110A040404", Z: "1F01020408101F",
  "0": "0E11131519110E", "1": "040C040404040E", "2": "0E11010204081F",
  "3": "1F02040201110E", "4": "02060A121F0202", "5": "1F101E0101110E",
  "6": "0608101E11110E", "7": "1F010204080808", "8": "0E11110E11110E", "9": "0E11110F01020C",
  " ": "00000000000000", "!": "04040404040004", "?": "0E110102040004", ".": "00000000000C0C",
  ",": "000000000C0408", ":": "000C0C000C0C00", ";": "000C0C000C0408", "-": "0000001F000000",
  "+": "0004041F040400", "/": "00010204081000", "'": "04040800000000", '"': "0A0A0000000000",
  "&": "0C12140815120D", "#": "0A0A1F0A1F0A0A", "@": "0E11171517100F",
  "*": "0004150E150400", "(": "02040808080402", ")": "08040202020408", _: "0000000000001F",
  "=": "00001F001F0000", "<": "02040810080402", ">": "08040201020408", "%": "18190204081303",
  $: "040F140E051E04",
}

function glyphRows(ch: string): number[] {
  const s = GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()] ?? GLYPHS["?"]
  const r: number[] = []
  for (let i = 0; i < 7; i++) r.push(parseInt(s.substr(i * 2, 2), 16))
  return r
}

// Columns of a message as bit masks over the CAP text rows (bit 0 = top row).
function pixelColumns(msg: string): number[] {
  const cols: number[] = []
  const chars = Array.from(msg)
  chars.forEach((ch, ci) => {
    if (ch === " ") {
      cols.push(0, 0, 0)
      return
    }
    const rows = glyphRows(ch)
    let lo = 4
    let hi = 0
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 7; y++) {
        if (rows[y] & (16 >> x)) {
          lo = Math.min(lo, x)
          hi = Math.max(hi, x)
        }
      }
    }
    if (hi < lo) {
      lo = 0
      hi = 2
    }
    // bold: each lit pixel also lights the column to its right and the dot row below
    const w = hi - lo + 2
    const at = (x: number, y: number) => (x >= lo && x <= hi && y >= 0 && y < 7 ? rows[y] & (16 >> x) : 0)
    for (let x = 0; x < w; x++) {
      let m = 0
      for (let r = 0; r < CAP; r++) {
        const y = Math.floor((r * 7) / CAP)
        if (at(x + lo, y) || at(x + lo - 1, y)) m |= 1 << r
      }
      cols.push(m)
    }
    if (ci < chars.length - 1) cols.push(0)
  })
  return cols
}

// Rasterise a message in a CSS font onto the dot grid: cap height = CAP rows, columns `aspect` rows wide.
function cssColumns(msg: string, font: string, aspect: number, stretch: number): number[] {
  if (typeof document === "undefined") return pixelColumns(msg)
  const S = 8
  const c = document.createElement("canvas")
  const ctx = c.getContext("2d", { willReadFrequently: true })
  if (!ctx) return pixelColumns(msg)
  const probe = `900 100px ${font}`
  ctx.font = probe
  const capRatio = Math.max(0.4, (ctx.measureText("H").actualBoundingBoxAscent || 72) / 100)
  const size = (CAP * S) / capRatio
  const fontStr = `900 ${size}px ${font}`
  ctx.font = fontStr
  const sx = Math.max(0.3, Math.min(2, stretch))
  const w = Math.ceil(ctx.measureText(msg).width * sx) + 8
  c.width = Math.max(8, w)
  c.height = CAP * S
  ctx.font = fontStr
  ctx.fillStyle = "#ffffff" // ls:keep
  ctx.textBaseline = "alphabetic"
  ctx.setTransform(sx, 0, 0, 1, 4, 0)
  ctx.fillText(msg, 0, CAP * S)
  const img = ctx.getImageData(0, 0, c.width, c.height).data
  const colW = S * aspect
  const n = Math.ceil(c.width / colW)
  const cols: number[] = []
  for (let i = 0; i < n; i++) {
    let m = 0
    const x0 = Math.floor(i * colW)
    const x1 = Math.min(c.width, Math.floor((i + 1) * colW))
    for (let r = 0; r < CAP; r++) {
      let sum = 0
      let cnt = 0
      for (let y = r * S; y < (r + 1) * S; y++) {
        for (let x = x0; x < x1; x++) {
          sum += img[(y * c.width + x) * 4 + 3]
          cnt++
        }
      }
      if (cnt && sum / cnt > 105) m |= 1 << r
    }
    cols.push(m)
  }
  while (cols.length && cols[0] === 0) cols.shift()
  while (cols.length && cols[cols.length - 1] === 0) cols.pop()
  return cols
}

type Strip = { data: Uint8Array; len: number; textCols: number; start: number }

function buildStrip(msg: string, font: string, visible: number, aspect: number, stretch: number, restCol: number): Strip {
  const isPixel = !font || /^\s*(5x7|pixel)\s*$/i.test(font)
  const raster = (w: string) => (isPixel ? pixelColumns(w) : cssColumns(w, font, aspect, stretch))
  const parts = msg.split(/\s+/).filter(Boolean).map(raster)
  const cols: number[] = []
  parts.forEach((p, i) => {
    if (i) cols.push(0, 0, 0, 0)
    cols.push(...p)
  })
  const textCols = Math.max(1, cols.length)
  // The message repeats with a short separator (2 dark columns, a 2 x 2 dot, 2 dark columns), so every
  // bar is filled with letters edge to edge at every frame, like a real badge marquee.
  const SEP = 6
  const len = textCols + SEP
  const data = new Uint8Array(len * ROWS)
  for (let x = 0; x < cols.length; x++) {
    for (let r = 0; r < CAP; r++) if (cols[x] & (1 << r)) data[(r + 1) * len + x] = 255
  }
  const mid = 1 + Math.floor(CAP / 2) - 1
  for (const x of [textCols + 2, textCols + 3]) for (const r of [mid, mid + 1]) data[r * len + x] = 255
  // resting frame: the message starts whole at dot column `restCol`, repeats fill the rest of the bar
  const start = -Math.max(0, restCol)
  return { data, len, textCols, start }
}

/* ------------------------------------------------------------------ */
/* Round badge icons, evaluated at every dot centre (units of radius)   */
/* ------------------------------------------------------------------ */

function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number, rot = 0) {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const dx = x - cx
  const dy = y - cy
  const u = dx * c + dy * s
  const v = -dx * s + dy * c
  return (u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1
}

// frame 0 open, 1 both eyes shut, 2 left eye shut
function iconAt(kind: IconKind, x: number, y: number, frame: number): number {
  const r = Math.hypot(x, y)
  if (kind === "ring") return r >= 0.44 && r <= 1.02 ? 1 : 0
  const shutL = frame >= 1
  const shutR = frame === 1
  const flat = (cx: number, cy: number, w: number) => Math.abs(y - cy) < 0.085 && Math.abs(x - cx) < w
  if (kind === "smile") {
    const eye = (cx: number, shut: boolean) => (shut ? flat(cx, 0.3, 0.2) : inEllipse(x, y, cx, 0.34, 0.19, 0.23))
    if (eye(-0.37, shutL) || eye(0.37, shutR)) return 1
    const d = Math.hypot(x, y - 0.1)
    return Math.abs(d - 0.7) < 0.09 && y < 0.02 ? 1 : 0
  }
  if (kind === "grin") {
    const eye = (cx: number, shut: boolean) => {
      if (shut) return flat(cx, 0.3, 0.19)
      const d = Math.hypot(x - cx, y - 0.2)
      return Math.abs(d - 0.17) < 0.075 && y > 0.22
    }
    if (eye(-0.36, shutL) || eye(0.36, shutR)) return 1
    const d = Math.hypot(x, y - 0.06)
    return d > 0.4 && d < 0.78 && y < -0.04 ? 1 : 0
  }
  // strokes: three long slanted strokes over a smile whose right end curls up
  const STROKES: [number, number, number, number][] = [
    [-0.6, 0.44, -0.3, -0.16],
    [-0.28, 0.7, 0.04, 0.04],
    [0.06, 0.7, 0.36, 0.14],
  ]
  for (let i = 0; i < 3; i++) {
    const [x0, y0, x1, y1] = STROKES[i]
    const shut = (i === 0 && shutL) || (i === 1 && (shutL || shutR)) || (i === 2 && shutR)
    if (shut) {
      // closed: a short dash where the stroke ends
      if (Math.abs(y - y1 - 0.06) < 0.07 && Math.abs(x - x1 + 0.06) < 0.13) return 1
      continue
    }
    const dx = x1 - x0
    const dy = y1 - y0
    const L = Math.hypot(dx, dy)
    const along = ((x - x0) * dx + (y - y0) * dy) / L
    const across = (-(x - x0) * dy + (y - y0) * dx) / L
    if (along > -0.04 && along < L + 0.04 && Math.abs(across) < 0.105) return 1
  }
  const d = Math.hypot(x - 0.04, y - 0.06)
  const ang = ((Math.atan2(y - 0.06, x - 0.04) * 180) / Math.PI + 360) % 360
  return Math.abs(d - 0.78) < 0.08 && (ang >= 188 || ang <= 14) ? 1 : 0
}

/* ------------------------------------------------------------------ */
/* Shared scene description                                             */
/* ------------------------------------------------------------------ */

type Badge = {
  coin: boolean
  // world placement (reference px, y up)
  px: number
  py: number
  pz: number
  rot: number
  scale: number
  // local geometry
  hw: number
  hh: number
  corner: number
  depth: number
  bevel: number
  win: [number, number, number]
  pc: number
  pr: number
  cols: number
  rows: number
  inv: number
  lean: number
  // marquee
  strip?: Strip
  speed: number
  icon?: IconKind
  iconData?: Uint8Array
  color: [number, number, number]
  phase: number
  index: number
}

function placeOnScreen(sx: number, sy: number, zFront: number) {
  const wx = sx - 360
  const wy = 360 - sy
  const k = (CAM.d - zFront) / CAM.d
  return { x: CAM.x + (wx - CAM.x) * k, y: CAM.y + (wy - CAM.y) * k, s: k }
}

function buildScene(messages: string[], font: string, stretch: number, colors: [number, number, number][], iconColors: [number, number, number][]): Badge[] {
  const out: Badge[] = []
  BARS.forEach((b, i) => {
    const pr = b.h / ROWS
    const pc0 = pr * 1.1
    const cols = Math.max(4, Math.round(b.l / pc0))
    const pc = b.l / cols
    const zf = b.z * LAYER_Z + BAR_DEPTH
    const p = placeOnScreen(b.x, b.y, zf)
    const strip = buildStrip(messages[i] ?? "", font, cols, pc / pr, stretch, b.o)
    const hw = b.l / 2 + BORDER
    const hh = b.h / 2 + BORDER
    out.push({
      coin: false, px: p.x, py: p.y, pz: b.z * LAYER_Z, rot: (-b.a * Math.PI) / 180, scale: p.s,
      hw, hh, corner: 11, depth: BAR_DEPTH, bevel: 2.6, win: [b.l / 2, b.h / 2, 4],
      pc, pr, cols, rows: ROWS, inv: b.inv, strip, lean: (b.lean * Math.PI) / 180,
      speed: b.v, color: colors[i], phase: i * 1.37 + 0.4, index: i,
    })
  })
  COINS.forEach((c, i) => {
    const zf = c.z * LAYER_Z + COIN_DEPTH
    const p = placeOnScreen(c.x, c.y, zf)
    const R = c.d / 2 - (c.icon === "ring" ? 12 : 9.5)
    const pr = c.icon === "ring" ? 6.0 : 4.5
    const pc = c.icon === "ring" ? 6.4 : 4.8
    const cols = Math.ceil((2 * R) / pc) + 1
    const rows = Math.ceil((2 * R) / pr) + 1
    const data = new Uint8Array(cols * rows * 4)
    const rIn = R - 0.45 * pr
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lx = (x + 0.5 - cols / 2) * pc
        const ly = (rows / 2 - y - 0.5) * pr
        if (Math.hypot(lx, ly) > rIn) continue
        for (let f = 0; f < 3; f++) data[(y * cols + x) * 4 + f] = iconAt(c.icon, lx / rIn, ly / rIn, f) ? 255 : 0
        data[(y * cols + x) * 4 + 3] = 255
      }
    }
    out.push({
      coin: true, px: p.x, py: p.y, pz: c.z * LAYER_Z, rot: (-c.a * Math.PI) / 180, scale: p.s,
      hw: c.d / 2, hh: c.d / 2, corner: c.d / 2, depth: COIN_DEPTH, bevel: 3, win: [R, R, R],
      pc, pr, cols, rows, inv: 0, icon: c.icon, iconData: data, lean: (c.lean * Math.PI) / 180,
      speed: 0, color: iconColors[i], phase: i * 2.1 + 1.1, index: 7 + i,
    })
  })
  return out
}

/* ------------------------------------------------------------------ */
/* Animation state shared by both renderers                             */
/* ------------------------------------------------------------------ */

type Motion = {
  t: number // design seconds since start
  tiltX: number
  tiltY: number
  flash: number
  clickAt: number
  offsets: number[]
  heads: number[]
}

const TAU = Math.PI * 2

// loop-quantised marquee speed: every bar returns to its start once per LOOP seconds
function barSpeed(b: Badge) {
  const len = b.strip ? b.strip.len : 1
  const n = Math.max(1, Math.round((b.speed * LOOP) / len))
  return (n * len) / LOOP
}

function scrollOf(b: Badge, m: Motion) {
  return (b.strip ? b.strip.start : 0) + barSpeed(b) * m.t + (m.offsets[b.index] || 0)
}

function frameWeights(i: number, t: number, sinceClick = 1e9): [number, number, number] {
  const lt = ((t % LOOP) + LOOP) % LOOP
  let blink = 0
  let wink = 0
  for (const [c, s, k] of BLINKS) {
    if (c !== i) continue
    const close = 0.07
    const hold = k === 1 ? 0.07 : 0.42
    const open = k === 1 ? 0.11 : 0.14
    let dt = lt - s
    if (dt < -LOOP / 2) dt += LOOP
    let e = 0
    if (dt >= 0 && dt < close) e = dt / close
    else if (dt >= close && dt < close + hold) e = 1
    else if (dt >= close + hold && dt < close + hold + open) e = 1 - (dt - close - hold) / open
    e = e * e * (3 - 2 * e)
    if (k === 1) blink = Math.max(blink, e)
    else wink = Math.max(wink, e)
  }
  // after a click every face winks back
  if (sinceClick > 0.3 && sinceClick < 1.1) {
    const d = sinceClick - 0.3
    const e = d < 0.08 ? d / 0.08 : d > 0.65 ? Math.max(0, 1 - (d - 0.65) / 0.15) : 1
    wink = Math.max(wink, e * e * (3 - 2 * e))
    blink = Math.min(blink, 1 - wink)
  }
  return [Math.max(0, 1 - blink - wink), blink, wink]
}

function flashAt(m: Motion) {
  const dt = m.t - m.clickAt
  if (m.clickAt < -1e8 || dt < 0) return 0
  if (dt < 0.05) return dt / 0.05
  if (dt < 0.2) return 1
  const e = Math.max(0, 1 - (dt - 0.2) / 0.55)
  return e * e * (3 - 2 * e)
}

// Model transform pieces for a badge at time t: [tx, ty, tz, rz, rx, ry]
function floatOf(b: Badge, t: number): [number, number, number, number, number, number] {
  const w = (TAU * t) / LOOP
  const ph = b.phase
  const k = b.index % 2 ? 2 : 1
  const s = (a: number) => Math.sin(a) - Math.sin(ph)
  return [
    0,
    2.2 * (Math.sin(k * w + ph) - Math.sin(ph)),
    0,
    0.012 * s(w + ph * 1.3) * (b.coin ? 1.6 : 1),
    0.028 * (Math.sin(w + ph * 0.7) - Math.sin(ph * 0.7)) * (b.coin ? 1.4 : 1),
    0.024 * (Math.sin(w * k + ph * 1.9) - Math.sin(ph * 1.9)),
  ]
}

function pileOf(m: Motion): { rx: number; ry: number; rz: number; tx: number; ty: number } {
  const w = (TAU * m.t) / LOOP
  return {
    rx: 0.045 * Math.sin(w) + m.tiltX,
    ry: 0.05 * Math.sin(w) - 0.02 * Math.sin(2 * w) + m.tiltY,
    rz: 0.012 * Math.sin(w),
    tx: 3 * Math.sin(2 * w),
    ty: 6 * Math.sin(w),
  }
}

/* ------------------------------------------------------------------ */
/* Matrices (column major)                                              */
/* ------------------------------------------------------------------ */

type M4 = Float32Array
function mIdent(): M4 {
  const m = new Float32Array(16)
  m[0] = m[5] = m[10] = m[15] = 1
  return m
}
function mMul(a: M4, b: M4): M4 {
  const o = new Float32Array(16)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
      o[c * 4 + r] = s
    }
  return o
}
function mTrans(x: number, y: number, z: number): M4 {
  const m = mIdent()
  m[12] = x
  m[13] = y
  m[14] = z
  return m
}
function mScale(s: number): M4 {
  const m = mIdent()
  m[0] = m[5] = m[10] = s
  return m
}
function mRotX(a: number): M4 {
  const m = mIdent()
  const c = Math.cos(a)
  const s = Math.sin(a)
  m[5] = c
  m[6] = s
  m[9] = -s
  m[10] = c
  return m
}
function mRotY(a: number): M4 {
  const m = mIdent()
  const c = Math.cos(a)
  const s = Math.sin(a)
  m[0] = c
  m[2] = -s
  m[8] = s
  m[10] = c
  return m
}
function mRotZ(a: number): M4 {
  const m = mIdent()
  const c = Math.cos(a)
  const s = Math.sin(a)
  m[0] = c
  m[1] = s
  m[4] = -s
  m[5] = c
  return m
}

const PIVOT = { x: -8, y: 0, z: 100 }

function modelOf(b: Badge, m: Motion): M4 {
  const p = pileOf(m)
  const f = floatOf(b, m.t)
  let M = mTrans(PIVOT.x + p.tx, PIVOT.y + p.ty, PIVOT.z)
  M = mMul(M, mRotY(p.ry))
  M = mMul(M, mRotX(p.rx))
  M = mMul(M, mRotZ(p.rz))
  M = mMul(M, mTrans(-PIVOT.x, -PIVOT.y, -PIVOT.z))
  M = mMul(M, mTrans(b.px + f[0], b.py + f[1], b.pz + f[2]))
  M = mMul(M, mRotZ(b.rot + f[3]))
  M = mMul(M, mRotX(f[4]))
  M = mMul(M, mRotY(f[5]))
  M = mMul(M, mScale(b.scale))
  return M
}

// Off-axis camera: points on z = 0 land on the reference frame 1:1, the camera sits low left.
function projOf(wpx: number, hpx: number): M4 {
  const k = Math.min(wpx, hpx) / 720
  const kx = k / (wpx / 2)
  const ky = k / (hpx / 2)
  const D = CAM.d
  const zn = 700
  const zf = -500
  // depth: z_ndc = (A z + B) / (D - z), -1 at zn, +1 at zf
  const A = (-(D - zn) - (D - zf)) / (zn - zf)
  const B = D - zf - A * zf
  const m = new Float32Array(16)
  m[0] = kx * D
  m[8] = -kx * CAM.x
  m[5] = ky * D
  m[9] = -ky * CAM.y
  m[10] = A
  m[14] = B
  m[11] = -1
  m[15] = D
  return m
}

/* ------------------------------------------------------------------ */
/* Geometry: rounded slab with a bevelled front edge                    */
/* ------------------------------------------------------------------ */

function outline(hw: number, hh: number, r: number, seg: number) {
  const pts: [number, number, number, number][] = []
  const cs: [number, number, number][] = [
    [hw - r, hh - r, 0],
    [-hw + r, hh - r, 0.5],
    [-hw + r, -hh + r, 1],
    [hw - r, -hh + r, 1.5],
  ]
  for (const [cx, cy, a0] of cs) {
    for (let i = 0; i <= seg; i++) {
      const a = (a0 + (i / seg) * 0.5) * Math.PI
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a), Math.sin(a)])
    }
  }
  return pts
}

function slabMesh(b: Badge) {
  const seg = b.coin ? 24 : 12
  const ol = outline(b.hw, b.hh, Math.min(b.corner, b.hw, b.hh), seg)
  const n = ol.length
  const prof: [number, number, number, number][] = [] // inset, z, nOut, nZ
  prof.push([0, 0, 1, 0])
  prof.push([0, b.depth - b.bevel, 1, 0])
  const BS = 6
  for (let j = 1; j <= BS; j++) {
    const ph = (j / BS) * Math.PI * 0.5
    prof.push([b.bevel * (1 - Math.cos(ph)), b.depth - b.bevel + b.bevel * Math.sin(ph), Math.cos(ph), Math.sin(ph)])
  }
  const v: number[] = []
  const idx: number[] = []
  for (let k = 0; k < prof.length; k++) {
    const [ins, z, no, nz] = prof[k]
    for (let i = 0; i < n; i++) {
      const [x, y, nx, ny] = ol[i]
      v.push(x - nx * ins, y - ny * ins, z, nx * no, ny * no, nz, 0)
    }
  }
  for (let k = 0; k < prof.length - 1; k++) {
    for (let i = 0; i < n; i++) {
      const a = k * n + i
      const b2 = k * n + ((i + 1) % n)
      const c = (k + 1) * n + i
      const d = (k + 1) * n + ((i + 1) % n)
      idx.push(a, b2, d, a, d, c)
    }
  }
  // front cap
  const base = v.length / 7
  v.push(0, 0, b.depth, 0, 0, 1, 1)
  for (let i = 0; i < n; i++) {
    const [x, y, nx, ny] = ol[i]
    v.push(x - nx * b.bevel, y - ny * b.bevel, b.depth, 0, 0, 1, 1)
  }
  for (let i = 0; i < n; i++) idx.push(base, base + 1 + i, base + 1 + ((i + 1) % n))
  return { v: new Float32Array(v), i: new Uint16Array(idx) }
}

/* ------------------------------------------------------------------ */
/* Colour parsing                                                        */
/* ------------------------------------------------------------------ */

let colorCtx: CanvasRenderingContext2D | null = null
function parseColor(c: string, fallback: [number, number, number]): [number, number, number] {
  if (typeof document === "undefined") return fallback
  if (!colorCtx) colorCtx = document.createElement("canvas").getContext("2d")
  if (!colorCtx) return fallback
  colorCtx.fillStyle = "#000000" // ls:keep
  colorCtx.fillStyle = c
  const s = String(colorCtx.fillStyle)
  if (s[0] === "#") {
    const n = parseInt(s.slice(1, 7), 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
  }
  const m = s.match(/[\d.]+/g)
  if (m && m.length >= 3) return [+m[0] / 255, +m[1] / 255, +m[2] / 255]
  return fallback
}
function isTransparent(c: string) {
  if (/^\s*transparent\s*$/i.test(c)) return true
  if (typeof document === "undefined") return false
  if (!colorCtx) colorCtx = document.createElement("canvas").getContext("2d")
  if (!colorCtx) return false
  colorCtx.fillStyle = "#000000" // ls:keep
  colorCtx.fillStyle = c
  const s = String(colorCtx.fillStyle)
  const m = s.match(/rgba\([^)]*,\s*([\d.]+)\)/)
  return !!m && parseFloat(m[1]) < 0.01
}

/* ------------------------------------------------------------------ */
/* WebGL2 renderer                                                       */
/* ------------------------------------------------------------------ */

const VS = `#version 300 es
in vec3 aPos;
in vec3 aNrm;
in float aCap;
uniform mat4 uProj;
uniform mat4 uModel;
out vec3 vLocal;
out vec3 vN;
out vec3 vW;
out float vCap;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vW = w.xyz;
  vN = mat3(uModel) * aNrm;
  vLocal = aPos;
  vCap = aCap;
  gl_Position = uProj * w;
}`

const FS = `#version 300 es
precision highp float;
precision highp int;
in vec3 vLocal;
in vec3 vN;
in vec3 vW;
in float vCap;
uniform sampler2D uTex;
uniform vec4 uWin;      // half w, half h, corner radius, coin
uniform vec4 uGrid;     // pitch x, pitch y, cols, rows
uniform float uLen;     // strip length (bars)
uniform float uScroll;
uniform float uHead;   // text columns before this are blank (re-scroll after a click)
uniform float uInvert;
uniform vec3 uFrameW;
uniform float uFlash;
uniform vec3 uLed;
uniform vec3 uMetal;
uniform vec3 uCam;
uniform float uGlowPass;
uniform float uBleed;
uniform float uLean;    // oval tilt of the LEDs
uniform float uSeed;    // per-badge seed for dead and dim dots
uniform float uSelfZ;
uniform vec4 uOccA[11]; // badges above: centre xy, cos, sin (world)
uniform vec4 uOccB[11]; // half w, half h, corner radius, layer z
out vec4 o;

float sdRR(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

// brightness of dot c, or -1 where there is no dot
float dotB(ivec2 c) {
  if (c.x < 0 || c.y < 0 || float(c.x) >= uGrid.z || float(c.y) >= uGrid.w) return -1.0;
  float b;
  if (uWin.w < 0.5) {
    float x = float(c.x) + uScroll;
    float i0 = floor(x);
    float f = x - i0;
    int a = int(mod(i0, uLen));
    int a2 = int(mod(i0 + 1.0, uLen));
    float t0 = i0 < uHead ? 0.0 : texelFetch(uTex, ivec2(a, c.y), 0).r;
    float t1 = i0 + 1.0 < uHead ? 0.0 : texelFetch(uTex, ivec2(a2, c.y), 0).r;
    b = mix(t0, t1, smoothstep(0.0, 1.0, f));
  } else {
    vec4 t = texelFetch(uTex, c, 0);
    if (t.a < 0.5) return -1.0;
    b = dot(t.rgb, uFrameW);
  }
  b = mix(b, 1.0 - b, uInvert);
  b = max(b, uFlash);
  // ragged face: a few dead and dim LEDs and a slight unevenness, fixed to the grid so nothing flickers
  vec2 cc = vec2(c) + uSeed * 17.0;
  float h = hash(cc);
  float k = h < 0.022 ? 0.05 : h < 0.06 ? 0.45 : 1.0;
  k *= 0.9 + 0.1 * sin(float(c.x) * 0.31 + uSeed * 5.0) * sin(float(c.y) * 0.83 + uSeed * 2.3);
  return b * k;
}

vec2 gridPos(vec2 p) {
  return vec2((p.x + uGrid.z * uGrid.x * 0.5) / uGrid.x, (uGrid.w * uGrid.y * 0.5 - p.y) / uGrid.y);
}

float smoothB(vec2 g) {
  vec2 gg = g - 0.5;
  ivec2 c0 = ivec2(floor(gg));
  vec2 f = gg - floor(gg);
  float b00 = max(dotB(c0), 0.0);
  float b10 = max(dotB(c0 + ivec2(1, 0)), 0.0);
  float b01 = max(dotB(c0 + ivec2(0, 1)), 0.0);
  float b11 = max(dotB(c0 + ivec2(1, 1)), 0.0);
  return mix(mix(b00, b10, f.x), mix(b01, b11, f.x), f.y);
}

vec3 metal(vec3 N, vec3 V, float lip) {
  vec3 L1 = normalize(vec3(-0.62, -0.6, 0.5));
  vec3 L2 = normalize(vec3(0.55, 0.7, 0.45));
  float d1 = max(dot(N, L1), 0.0);
  float d2 = max(dot(N, L2), 0.0);
  vec3 H1 = normalize(L1 + V);
  float s1 = pow(max(dot(N, H1), 0.0), 30.0);
  float nv = max(dot(N, V), 0.0);
  float fr = pow(1.0 - nv, 2.2);
  vec2 sd = N.xy / max(length(N.xy), 1e-4);
  float side = clamp(dot(sd, normalize(vec2(-0.75, -0.66))) * 0.5 + 0.5, 0.0, 1.0);
  side = side * side * side;
  vec3 col = uMetal * (0.35 + 0.75 * d1 + 0.25 * d2);
  col += vec3(0.75) * s1 * 0.25 * lip;
  col += vec3(0.62, 0.63, 0.66) * fr * side * lip; // ls:keep
  col += vec3(0.62, 0.63, 0.66) * fr * 0.05; // ls:keep
  // the rounded front edge catches a thin line of light all the way round
  float rim = smoothstep(0.12, 0.45, N.z) * (1.0 - smoothstep(0.8, 0.97, N.z));
  col += vec3(0.55, 0.56, 0.6) * rim * (0.25 + 0.75 * side) * 0.55; // ls:keep
  return col;
}

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  vec2 p = vLocal.xy;
  float sdw = sdRR(p, uWin.xy, uWin.z);
  float aaW = fwidth(sdw) * 0.75 + 1e-4;
  float inWin = vCap > 0.5 ? 1.0 - smoothstep(-aaW, aaW, sdw) : 0.0;

  vec2 g = gridPos(p);
  float bs = 0.0;
  if (vCap > 0.5 && sdw < 6.0) bs = smoothB(g);

  if (uGlowPass > 0.5) {
    o = vec4(uLed * bs * 0.5 * inWin, 1.0);
    return;
  }

  // bezel
  vec3 bez = metal(N, V, uWin.w > 0.5 ? 0.28 : 0.75);
  // soft contact shadow from the badges stacked above this one
  float occ = 0.0;
  for (int j = 0; j < 11; j++) {
    vec4 A = uOccA[j];
    vec4 B = uOccB[j];
    if (B.w <= uSelfZ + 0.5) continue;
    vec2 d = vW.xy - A.xy - vec2(4.0, 5.0);
    vec2 lp = vec2(d.x * A.z + d.y * A.w, -d.x * A.w + d.y * A.z);
    float sdo = sdRR(lp, B.xy, B.z);
    occ = max(occ, 1.0 - smoothstep(-3.0, 15.0, sdo));
  }
  float shade = 1.0 - 0.6 * occ;
  bez *= shade;
  if (vCap > 0.5) {
    // light from the nearest dots spills onto the border, a dark seam rings the window
    vec2 gc = clamp(g, vec2(0.5), uGrid.zw - 0.5);
    float edgeB = smoothB(gc);
    float d = max(sdw, 0.0);
    bez += uLed * edgeB * uBleed * (0.30 * exp(-d / 2.2) + 0.10 * exp(-d / 7.0));
    bez *= mix(0.45, 1.0, smoothstep(0.0, 1.4, sdw));
  } else {
    bez += uLed * uBleed * 0.03 * smoothstep(0.0, 1.0, N.z);
  }

  vec3 col = bez;
  if (inWin > 0.0) {
    ivec2 c = ivec2(floor(g));
    vec2 f = fract(g) - 0.5;
    vec2 dp = f * uGrid.xy;
    // oval LED, leaning like the lenses in the render
    vec2 er = vec2(0.53, 0.35) * min(uGrid.x, uGrid.y);
    float cl = cos(uLean);
    float sl = sin(uLean);
    vec2 rp = mat2(cl, -sl, sl, cl) * dp;
    float k = length(rp / er);
    float sd = (k - 1.0) * k / max(length(rp / (er * er)), 1e-3);
    vec2 dh = er;
    float aa = fwidth(sd) * 0.7 + 1e-4;
    float cov = 1.0 - smoothstep(-aa, aa, sd);
    float b = dotB(c);
    if (b < 0.0) cov = 0.0;
    b = max(b, 0.0);
    float jit = 0.88 + 0.24 * hash(vec2(c));
    float core = 1.0 - clamp(k, 0.0, 1.0);
    vec3 lit = mix(uLed, vec3(1.0), 0.3 * core * core + 0.02) * jit * (1.0 + 0.5 * uFlash);
    vec3 unlit = uLed * 0.06 + vec3(0.008);
    vec3 dotc = mix(unlit, lit, b);
    vec3 back = vec3(0.010, 0.010, 0.012) + uLed * (0.04 * bs + 0.010); // ls:keep
    vec3 led = mix(back, dotc, cov);
    led *= mix(1.0, shade, 0.35);
    col = mix(bez, led, inWin);
  }
  o = vec4(col, 1.0);
}`

const QUAD_VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`

const DOWN_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uHalf;
out vec4 o;
void main() {
  vec4 s = texture(uSrc, vUv) * 4.0;
  s += texture(uSrc, vUv + vec2(-uHalf.x, -uHalf.y));
  s += texture(uSrc, vUv + vec2(uHalf.x, -uHalf.y));
  s += texture(uSrc, vUv + vec2(-uHalf.x, uHalf.y));
  s += texture(uSrc, vUv + vec2(uHalf.x, uHalf.y));
  o = s / 8.0;
}`

const UP_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform sampler2D uAdd;
uniform vec2 uHalf;
uniform float uW;
out vec4 o;
void main() {
  vec2 h = uHalf;
  vec4 s = texture(uSrc, vUv + vec2(-h.x * 2.0, 0.0));
  s += texture(uSrc, vUv + vec2(-h.x, h.y)) * 2.0;
  s += texture(uSrc, vUv + vec2(0.0, h.y * 2.0));
  s += texture(uSrc, vUv + vec2(h.x, h.y)) * 2.0;
  s += texture(uSrc, vUv + vec2(h.x * 2.0, 0.0));
  s += texture(uSrc, vUv + vec2(h.x, -h.y)) * 2.0;
  s += texture(uSrc, vUv + vec2(0.0, -h.y * 2.0));
  s += texture(uSrc, vUv + vec2(-h.x, -h.y)) * 2.0;
  o = s / 12.0 + texture(uAdd, vUv) * uW;
}`

const COMP_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uBloom;
uniform sampler2D uTight;
uniform float uGlow;
out vec4 o;
void main() {
  vec3 c = texture(uBloom, vUv).rgb * 0.3 + texture(uTight, vUv).rgb * 0.3;
  c *= uGlow;
  c = 1.0 - exp(-c * 1.15);
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`

type GL = WebGL2RenderingContext

function compile(gl: GL, vs: string, fs: string) {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader")
    return s
  }
  const p = gl.createProgram()!
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs))
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link")
  const u: Record<string, WebGLUniformLocation | null> = {}
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i)
    if (info) u[info.name] = gl.getUniformLocation(p, info.name)
  }
  return { p, u }
}

const LEVELS = 7 // bloom blur levels; the deepest ones carry the wide coloured haze

type Target = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number; depth?: WebGLRenderbuffer }

type Settings = {
  bg: [number, number, number]
  bgAlpha: number
  metal: [number, number, number]
  glow: number
}

function createGL(canvas: HTMLCanvasElement, scene: Badge[]) {
  const gl = canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: false }) as GL | null
  if (!gl) return null
  const halfFloat = !!gl.getExtension("EXT_color_buffer_float")
  gl.getExtension("OES_texture_float_linear")
  const main = compile(gl, VS, FS)
  const down = compile(gl, QUAD_VS, DOWN_FS)
  const up = compile(gl, QUAD_VS, UP_FS)
  const comp = compile(gl, QUAD_VS, COMP_FS)

  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const quadVao = gl.createVertexArray()!
  gl.bindVertexArray(quadVao)
  for (const pr of [down, up, comp]) {
    const loc = gl.getAttribLocation(pr.p, "aPos")
    if (loc >= 0) {
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    }
  }

  const aPos = gl.getAttribLocation(main.p, "aPos")
  const aNrm = gl.getAttribLocation(main.p, "aNrm")
  const aCap = gl.getAttribLocation(main.p, "aCap")
  const meshes = scene.map((b) => {
    const m = slabMesh(b)
    const vao = gl.createVertexArray()!
    gl.bindVertexArray(vao)
    const vb = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vb)
    gl.bufferData(gl.ARRAY_BUFFER, m.v, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 28, 0)
    gl.enableVertexAttribArray(aNrm)
    gl.vertexAttribPointer(aNrm, 3, gl.FLOAT, false, 28, 12)
    gl.enableVertexAttribArray(aCap)
    gl.vertexAttribPointer(aCap, 1, gl.FLOAT, false, 28, 24)
    const ib = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.i, gl.STATIC_DRAW)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    if (b.strip) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, b.strip.len, ROWS, 0, gl.RED, gl.UNSIGNED_BYTE, b.strip.data)
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, b.cols, b.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, b.iconData!)
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return { vao, count: m.i.length, tex, bufs: [vb, ib] }
  })
  gl.bindVertexArray(null)

  let targets: Target[] = []
  let glowT: Target | null = null
  const mkTarget = (w: number, h: number, depth: boolean): Target => {
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    if (halfFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null)
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fb = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    let rb: WebGLRenderbuffer | undefined
    if (depth) {
      rb = gl.createRenderbuffer()!
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb)
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h)
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { fb, tex, w, h, depth: rb }
  }
  const freeTargets = () => {
    for (const t of [...targets, ...(glowT ? [glowT] : [])]) {
      gl.deleteFramebuffer(t.fb)
      gl.deleteTexture(t.tex)
      if (t.depth) gl.deleteRenderbuffer(t.depth)
    }
    targets = []
    glowT = null
  }
  let sizeKey = ""
  const ensureTargets = (w: number, h: number) => {
    const key = w + "x" + h
    if (key === sizeKey) return
    sizeKey = key
    freeTargets()
    const gw = Math.max(2, Math.round(w / 2))
    const gh = Math.max(2, Math.round(h / 2))
    glowT = mkTarget(gw, gh, true)
    let cw = gw
    let ch = gh
    for (let i = 0; i < LEVELS; i++) {
      cw = Math.max(2, Math.round(cw / 2))
      ch = Math.max(2, Math.round(ch / 2))
      targets.push(mkTarget(cw, ch, false))
    }
    // upsample targets mirror the down chain (one per level above the smallest)
    for (let i = 0; i < LEVELS - 1; i++) targets.push(mkTarget(targets[i].w, targets[i].h, false))
  }

  const drawScene = (proj: M4, m: Motion, s: Settings, glowPass: boolean) => {
    gl.useProgram(main.p)
    const u = main.u
    gl.uniformMatrix4fv(u.uProj, false, proj)
    gl.uniform3f(u.uMetal, s.metal[0], s.metal[1], s.metal[2])
    gl.uniform3f(u.uCam, CAM.x, CAM.y, CAM.d)
    gl.uniform1f(u.uGlowPass, glowPass ? 1 : 0)
    gl.uniform1f(u.uBleed, Math.min(1.5, s.glow))
    gl.uniform1f(u.uFlash, m.flash)
    gl.uniform1i(u.uTex, 0)
    gl.activeTexture(gl.TEXTURE0)
    const models = scene.map((b) => modelOf(b, m))
    const occA = new Float32Array(44)
    const occB = new Float32Array(44)
    scene.forEach((b, j) => {
      const M = models[j]
      const sc = Math.hypot(M[0], M[1])
      const c = apply(M, 0, 0, b.depth)
      occA.set([c[0], c[1], M[0] / sc, M[1] / sc], j * 4)
      occB.set([b.hw * sc, b.hh * sc, Math.min(b.corner, b.hw, b.hh) * sc, b.pz], j * 4)
    })
    gl.uniform4fv(u["uOccA[0]"], occA)
    gl.uniform4fv(u["uOccB[0]"], occB)
    scene.forEach((b, i) => {
      const me = meshes[i]
      gl.uniformMatrix4fv(u.uModel, false, models[i])
      gl.uniform1f(u.uSelfZ, b.pz)
      gl.uniform1f(u.uLean, b.lean)
      gl.uniform1f(u.uSeed, b.index * 0.731 + 0.13)
      gl.uniform4f(u.uWin, b.win[0], b.win[1], b.win[2], b.coin ? 1 : 0)
      gl.uniform4f(u.uGrid, b.pc, b.pr, b.cols, b.rows)
      gl.uniform1f(u.uLen, b.strip ? b.strip.len : 1)
      gl.uniform1f(u.uScroll, b.strip ? scrollOf(b, m) : 0)
      gl.uniform1f(u.uHead, m.heads[b.index] ?? -1e9)
      gl.uniform1f(u.uInvert, b.inv)
      const fw = b.coin ? frameWeights(b.index - 7, m.t, m.t - m.clickAt) : [1, 0, 0]
      gl.uniform3f(u.uFrameW, fw[0], fw[1], fw[2])
      gl.uniform3f(u.uLed, b.color[0], b.color[1], b.color[2])
      gl.bindTexture(gl.TEXTURE_2D, me.tex)
      gl.bindVertexArray(me.vao)
      gl.drawElements(gl.TRIANGLES, me.count, gl.UNSIGNED_SHORT, 0)
    })
    gl.bindVertexArray(null)
  }

  const quadPass = (prog: ReturnType<typeof compile>, target: Target | null, w: number, h: number) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null)
    gl.viewport(0, 0, w, h)
    gl.useProgram(prog.p)
    gl.bindVertexArray(quadVao)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  const render = (m: Motion, s: Settings) => {
    const w = canvas.width
    const h = canvas.height
    const proj = projOf(w, h)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.disable(gl.BLEND)
    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.BACK)
    const doGlow = s.glow > 0.001
    if (doGlow) {
      ensureTargets(w, h)
      const gt = glowT!
      gl.bindFramebuffer(gl.FRAMEBUFFER, gt.fb)
      gl.viewport(0, 0, gt.w, gt.h)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      drawScene(proj, m, s, true)
      gl.disable(gl.DEPTH_TEST)
      gl.disable(gl.CULL_FACE)
      // down chain
      let src = gt
      for (let i = 0; i < LEVELS; i++) {
        const t = targets[i]
        gl.useProgram(down.p)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, src.tex)
        gl.uniform1i(down.u.uSrc, 0)
        gl.uniform2f(down.u.uHalf, 0.5 / src.w, 0.5 / src.h)
        quadPass(down, t, t.w, t.h)
        src = t
      }
      // up chain: level 5 -> 4 ... -> 0, adding each level
      const weights = [0.7, 0.9, 1.15, 1.5, 2.0, 2.6]
      for (let i = LEVELS - 2; i >= 0; i--) {
        const dst = targets[LEVELS + i]
        gl.useProgram(up.p)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, src.tex)
        gl.uniform1i(up.u.uSrc, 0)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, targets[i].tex)
        gl.uniform1i(up.u.uAdd, 1)
        gl.uniform2f(up.u.uHalf, 0.5 / src.w, 0.5 / src.h)
        gl.uniform1f(up.u.uW, weights[i])
        quadPass(up, dst, dst.w, dst.h)
        src = dst
      }
      gl.activeTexture(gl.TEXTURE0)
    }
    // main pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, w, h)
    gl.clearColor(s.bg[0] * s.bgAlpha, s.bg[1] * s.bgAlpha, s.bg[2] * s.bgAlpha, s.bgAlpha)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.CULL_FACE)
    drawScene(proj, m, s, false)
    if (doGlow) {
      gl.disable(gl.DEPTH_TEST)
      gl.disable(gl.CULL_FACE)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE)
      gl.useProgram(comp.p)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, targets[LEVELS].tex)
      gl.uniform1i(comp.u.uBloom, 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, targets[0].tex)
      gl.uniform1i(comp.u.uTight, 1)
      gl.uniform1f(comp.u.uGlow, s.glow)
      quadPass(comp, null, w, h)
      gl.disable(gl.BLEND)
      gl.activeTexture(gl.TEXTURE0)
    }
  }

  const dispose = () => {
    freeTargets()
    for (const me of meshes) {
      gl.deleteVertexArray(me.vao)
      gl.deleteTexture(me.tex)
      for (const b of me.bufs) gl.deleteBuffer(b)
    }
    gl.deleteVertexArray(quadVao)
    gl.deleteBuffer(quad)
    for (const pr of [main, down, up, comp]) gl.deleteProgram(pr.p)
  }
  return { render, dispose, gl }
}

/* ------------------------------------------------------------------ */
/* Canvas 2D fallback                                                    */
/* ------------------------------------------------------------------ */

function rgbStr(c: [number, number, number], k = 1, a = 1) {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k * 255)))
  return `rgba(${f(c[0])}, ${f(c[1])}, ${f(c[2])}, ${a})`
}

function apply(M: M4, x: number, y: number, z: number) {
  return [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14], M[3] * x + M[7] * y + M[11] * z + M[15]]
}

function create2D(canvas: HTMLCanvasElement, scene: Badge[]) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const glowC = document.createElement("canvas")
  const gctx = glowC.getContext("2d")
  const render = (m: Motion, s: Settings) => {
    const w = canvas.width
    const h = canvas.height
    const proj = projOf(w, h)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w, h)
    if (s.bgAlpha > 0) {
      ctx.fillStyle = rgbStr(s.bg, 1, s.bgAlpha)
      ctx.fillRect(0, 0, w, h)
    }
    const gs = 6
    glowC.width = Math.ceil(w / gs)
    glowC.height = Math.ceil(h / gs)
    if (gctx) gctx.clearRect(0, 0, glowC.width, glowC.height)
    const toScreen = (P: M4, x: number, y: number, z: number) => {
      const c = apply(P, x, y, z)
      return [(c[0] / c[3] * 0.5 + 0.5) * w, (0.5 - (c[1] / c[3]) * 0.5) * h]
    }
    const order = scene.map((b, i) => i).sort((a, b) => scene[a].pz - scene[b].pz)
    for (const i of order) {
      const b = scene[i]
      const MV = mMul(proj, modelOf(b, m))
      const ol = outline(b.hw, b.hh, Math.min(b.corner, b.hw, b.hh), b.coin ? 16 : 6)
      const path = (z: number, inset: number) => {
        ctx.beginPath()
        ol.forEach(([x, y, nx, ny], k) => {
          const [sx, sy] = toScreen(MV, x - nx * inset, y - ny * inset, z)
          if (k) ctx.lineTo(sx, sy)
          else ctx.moveTo(sx, sy)
        })
        ctx.closePath()
      }
      // side wall: back outline then front, lit grey
      for (let k = 0; k <= 4; k++) {
        path((b.depth * k) / 4, 0)
        ctx.fillStyle = rgbStr(s.metal, 1.4 + k * 0.35)
        ctx.fill()
      }
      path(b.depth, b.bevel)
      ctx.fillStyle = rgbStr(s.metal, 0.9)
      ctx.fill()
      // dots
      const fw = b.coin ? frameWeights(b.index - 7, m.t, m.t - m.clickAt) : [1, 0, 0]
      const scroll = b.strip ? scrollOf(b, m) : 0
      const [ox, oy] = toScreen(MV, 0, 0, b.depth)
      const [ax, ay] = toScreen(MV, b.pc, 0, b.depth)
      const [bx, by] = toScreen(MV, 0, b.pr, b.depth)
      const ux = [ax - ox, ay - oy]
      const vy = [bx - ox, by - oy]
      for (let r = 0; r < b.rows; r++) {
        for (let c = 0; c < b.cols; c++) {
          let v: number
          if (b.strip) {
            const x = c + scroll
            const i0 = Math.floor(x)
            const f = x - i0
            const L = b.strip.len
            const head = m.heads[b.index] ?? -1e9
            const t0 = i0 < head ? 0 : b.strip.data[r * L + (((i0 % L) + L) % L)] / 255
            const t1 = i0 + 1 < head ? 0 : b.strip.data[r * L + ((((i0 + 1) % L) + L) % L)] / 255
            v = t0 + (t1 - t0) * f * f * (3 - 2 * f)
          } else {
            const o = (r * b.cols + c) * 4
            if (!b.iconData![o + 3]) continue
            v = (b.iconData![o] * fw[0] + b.iconData![o + 1] * fw[1] + b.iconData![o + 2] * fw[2]) / 255
          }
          if (b.inv) v = 1 - v
          v = Math.max(v, m.flash)
          const lx = (c + 0.5 - b.cols / 2) * b.pc
          const ly = (b.rows / 2 - r - 0.5) * b.pr
          const [sx, sy] = toScreen(MV, lx, ly, b.depth)
          const k = 0.13 + 0.87 * v
          ctx.setTransform(ux[0] * 0.66, ux[1] * 0.66, vy[0] * 0.74, vy[1] * 0.74, sx, sy)
          ctx.fillStyle = rgbStr(b.color, k)
          ctx.beginPath()
          ctx.arc(0, 0, 0.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          if (gctx && v > 0.3) {
            gctx.fillStyle = rgbStr(b.color, 1, 0.5 * v)
            gctx.fillRect(sx / gs - 0.6, sy / gs - 0.6, 1.2, 1.2)
          }
        }
      }
    }
    if (gctx && s.glow > 0) {
      ctx.save()
      ctx.globalCompositeOperation = "lighter"
      ctx.globalAlpha = Math.min(1, 0.9 * s.glow)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(glowC, 0, 0, w, h)
      ctx.drawImage(glowC, -w * 0.01, -h * 0.01, w * 1.02, h * 1.02)
      ctx.restore()
    }
  }
  return { render, dispose: () => {} }
}

/* ------------------------------------------------------------------ */
/* Component                                                             */
/* ------------------------------------------------------------------ */

export function LedBadges({
  messages = MESSAGES,
  colors = COLORS,
  iconColors = ICON_COLORS,
  background = BACKGROUND,
  bezel = BEZEL,
  font = FONT,
  stretch = 0.85,
  speed = 1,
  glow = 1,
  interactive = true,
  className,
  style,
  ...rest
}: LedBadgesProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const live = React.useRef({ speed, glow, interactive, background, bezel })
  live.current = { speed, glow, interactive, background, bezel }
  const input = React.useRef({ tx: 0, ty: 0, click: false })

  const msgKey = JSON.stringify(messages)
  const colKey = JSON.stringify(colors) + JSON.stringify(iconColors)

  React.useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const msgs = MESSAGES.map((d, i) => (messages[i] !== undefined ? String(messages[i]) : d))
    const cols = COLORS.map((d, i) => parseColor(colors[i] ?? d, parseColor(d, [1, 1, 1]))) // ls:keep
    const icols = ICON_COLORS.map((d, i) => parseColor(iconColors[i] ?? d, parseColor(d, [1, 1, 1]))) // ls:keep
    const scene = buildScene(msgs, font, stretch, cols, icols)

    let renderer: { render: (m: Motion, s: Settings) => void; dispose: () => void } | null = null
    try {
      renderer = createGL(canvas, scene)
    } catch {
      renderer = null
    }
    if (!renderer) renderer = create2D(canvas, scene)
    if (!renderer) return

    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    const motion: Motion = { t: 0, tiltX: 0, tiltY: 0, flash: 0, clickAt: -1e9, offsets: [], heads: [] }
    let raf = 0
    let last = -1
    let visible = true
    let onScreen = true
    let pendingReset = -1

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const r = wrap.getBoundingClientRect()
      const w = Math.max(1, Math.round(r.width * dpr))
      const h = Math.max(1, Math.round(r.height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }

    const settings = (): Settings => {
      const l = live.current
      const transparent = isTransparent(l.background)
      return {
        bg: parseColor(l.background, [0, 0, 0]), // ls:keep
        bgAlpha: transparent ? 0 : 1,
        metal: parseColor(l.bezel, [0.17, 0.17, 0.19]), // ls:keep
        glow: Math.max(0, l.glow),
      }
    }

    const draw = () => renderer!.render(motion, settings())

    const frame = (now: number) => {
      raf = 0
      const dt = last < 0 ? 0 : Math.min(0.1, Math.max(0, (now - last) / 1000))
      last = now
      const l = live.current
      if (!reduced) motion.t += dt * Math.max(0, l.speed)
      // pointer tilt, critically damped
      const k = 1 - Math.exp(-dt * 6)
      motion.tiltX += (input.current.ty - motion.tiltX) * k
      motion.tiltY += (input.current.tx - motion.tiltY) * k
      if (input.current.click) {
        input.current.click = false
        motion.clickAt = motion.t
        pendingReset = motion.t + 0.12
      }
      if (pendingReset >= 0 && motion.t >= pendingReset) {
        pendingReset = -1
        // restart every marquee: the message re-enters from the right edge
        scene.forEach((b) => {
          if (!b.strip) return
          const target = -b.cols
          const cur = scrollOf(b, motion)
          motion.offsets[b.index] = (motion.offsets[b.index] || 0) + (target - cur)
          motion.heads[b.index] = 0
        })
      }
      motion.flash = flashAt(motion)
      resize()
      draw()
      const settling = Math.abs(motion.tiltX - input.current.ty) + Math.abs(motion.tiltY - input.current.tx) > 1e-4
      const animating = (!reduced && l.speed > 0) || settling || motion.flash > 0 || pendingReset >= 0 || motion.t - motion.clickAt < 1
      if (visible && onScreen && animating) raf = requestAnimationFrame(frame)
      else last = -1
    }
    const kick = () => {
      if (!raf && visible && onScreen) raf = requestAnimationFrame(frame)
    }

    const io = new IntersectionObserver((e) => {
      onScreen = e.some((x) => x.isIntersecting)
      if (onScreen) kick()
    })
    io.observe(wrap)
    const onVis = () => {
      visible = document.visibilityState !== "hidden"
      if (visible) kick()
    }
    document.addEventListener("visibilitychange", onVis)
    const ro = new ResizeObserver(() => {
      resize()
      if (!raf) draw()
    })
    ro.observe(wrap)

    const onMove = (e: PointerEvent) => {
      if (!live.current.interactive || reduced) return
      const r = wrap.getBoundingClientRect()
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1
      input.current.tx = Math.max(-1, Math.min(1, nx)) * 0.17
      input.current.ty = Math.max(-1, Math.min(1, ny)) * 0.12
      kick()
    }
    const onLeave = () => {
      input.current.tx = 0
      input.current.ty = 0
      kick()
    }
    const onDown = () => {
      if (!live.current.interactive) return
      input.current.click = true
      kick()
    }
    wrap.addEventListener("pointermove", onMove)
    wrap.addEventListener("pointerleave", onLeave)
    wrap.addEventListener("pointerdown", onDown)

    const onLost = (e: Event) => e.preventDefault()
    canvas.addEventListener("webglcontextlost", onLost)

    resize()
    kick()
    return () => {
      if (raf) cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      document.removeEventListener("visibilitychange", onVis)
      wrap.removeEventListener("pointermove", onMove)
      wrap.removeEventListener("pointerleave", onLeave)
      wrap.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("webglcontextlost", onLost)
      renderer!.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgKey, colKey, font, stretch])

  const label = MESSAGES.map((d, i) => (messages[i] !== undefined ? messages[i] : d)).join(", ")
  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={`Letreiros de LED: ${label}`}
      className={className}
      style={{ position: "relative", overflow: "hidden", background, cursor: interactive ? "pointer" : undefined, touchAction: "pan-y", ...style }}
      {...rest}
    >
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
    </div>
  )
}

export default LedBadges
