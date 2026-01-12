"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Point = { x: number; y: number };
type PointT = { x: number; y: number; t: number };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function pointAt(A: Point, B: Point, t: number): Point {
  return { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
}
function dist2(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function intersectSegmentCircle(A: Point, B: Point, C: Point, r: number): PointT[] {
  const d = { x: B.x - A.x, y: B.y - A.y };
  const f = { x: A.x - C.x, y: A.y - C.y };

  const a = d.x * d.x + d.y * d.y;
  const b = 2 * (f.x * d.x + f.y * d.y);
  const c = f.x * f.x + f.y * f.y - r * r;

  if (a === 0) return [];
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];

  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);

  const pts: PointT[] = [];
  const pushIfValid = (t: number) => {
    if (t >= 0 && t <= 1) {
      const p = pointAt(A, B, t);
      pts.push({ x: p.x, y: p.y, t });
    }
  };

  pushIfValid(t1);
  if (Math.abs(t2 - t1) > 1e-6) pushIfValid(t2);

  pts.sort((p, q) => p.t - q.t);
  return pts;
}

function segmentInsideCircleInterval(A: Point, B: Point, C: Point, r: number): { tIn: number; tOut: number } | null {
  const eps = 1e-6;
  const r2 = r * r;

  const inside0 = dist2(A, C) <= r2 + 1e-3;
  const inside1 = dist2(B, C) <= r2 + 1e-3;

  const ints = intersectSegmentCircle(A, B, C, r);

  if (ints.length >= 2) return { tIn: ints[0].t, tOut: ints[ints.length - 1].t };
  if (ints.length === 1) {
    const t = ints[0].t;
    if (inside0 && !inside1) return { tIn: 0, tOut: t };
    if (!inside0 && inside1) return { tIn: t, tOut: 1 };
    if (inside0 && inside1) return { tIn: 0, tOut: 1 };
    return { tIn: t - eps, tOut: t + eps };
  }
  if (inside0 && inside1) return { tIn: 0, tOut: 1 };
  return null;
}

function earliestLandPointWithinCircle(
  A: Point,
  B: Point,
  C: Point,
  r: number,
  isLand: (p: Point) => boolean
): PointT | null {
  const interval = segmentInsideCircleInterval(A, B, C, r);
  if (!interval) return null;

  let tIn = clamp(interval.tIn, 0, 1);
  let tOut = clamp(interval.tOut, 0, 1);
  if (tOut < tIn) [tIn, tOut] = [tOut, tIn];

  const pIn = pointAt(A, B, tIn);
  if (isLand(pIn)) return { x: pIn.x, y: pIn.y, t: tIn };

  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const segLen = Math.sqrt(dx * dx + dy * dy) || 1;

  const dt = 2 / segLen;

  let prevT = tIn;
  let prevLand = false;

  for (let t = tIn; t <= tOut + 1e-9; t += dt) {
    const tt = Math.min(t, tOut);
    const p = pointAt(A, B, tt);
    const land = isLand(p);

    if (!prevLand && land) {
      let lo = prevT;
      let hi = tt;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        const pm = pointAt(A, B, mid);
        if (isLand(pm)) hi = mid;
        else lo = mid;
      }
      const pf = pointAt(A, B, hi);
      return { x: pf.x, y: pf.y, t: hi };
    }

    prevT = tt;
    prevLand = land;
    if (tt >= tOut) break;
  }

  return null;
}

function drawDot(ctx: CanvasRenderingContext2D, p: Point, fill: string, radius: number) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawArrow(ctx: CanvasRenderingContext2D, from: Point, to: Point, color = "rgba(255,80,80,0.95)") {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  const angle = Math.atan2(dy, dx);
  const headLen = 12;
  const headAngle = Math.PI / 7;

  const x1 = to.x - headLen * Math.cos(angle - headAngle);
  const y1 = to.y - headLen * Math.sin(angle - headAngle);
  const x2 = to.x - headLen * Math.cos(angle + headAngle);
  const y2 = to.y - headLen * Math.sin(angle + headAngle);

  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
  });
}

function isValidAlphaMask(data: Uint8ClampedArray) {
  let minA = 255,
    maxA = 0;
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    if (a < minA) minA = a;
    if (a > maxA) maxA = a;
    if (minA === 0 && maxA === 255) return true;
  }
  return minA !== maxA;
}

const MAPS = [
  { id: "erangel", label: "에란겔", file: "/maps/erangel.png", sizeKm: 8 },
  { id: "miramar", label: "미라마", file: "/maps/miramar.png", sizeKm: 8 },
  { id: "taego", label: "테이고", file: "/maps/taego.png", sizeKm: 8 },
  { id: "deston", label: "데스턴", file: "/maps/deston.png", sizeKm: 8 },
  { id: "vikendi", label: "비켄디", file: "/maps/vikendi.png", sizeKm: 8 },
  { id: "rondo", label: "론도", file: "/maps/rondo.png", sizeKm: 8 },
  { id: "sanhok", label: "사녹", file: "/maps/sanhok.png", sizeKm: 4 },
  { id: "paramo", label: "파라모", file: "/maps/paramo.png", sizeKm: 3 },
  { id: "karakin", label: "카라킨", file: "/maps/karakin.png", sizeKm: 2 },
] as const;

type MapId = (typeof MAPS)[number]["id"];
const RADIUS_OPTIONS_M: number[] = Array.from({ length: 25 }, (_, i) => (i + 1) * 50);

/** 마스크는 “월드 좌표(보정 전)” 기준으로 저장되어 있고,
 *  start/end/target도 월드 좌표로 저장하므로 여기 샘플링은 월드 좌표 그대로 사용 */
function makeIsLandFromMask(maskCtx: CanvasRenderingContext2D | null, hasMask: boolean, W: number, H: number) {
  return (p: Point): boolean => {
    if (!maskCtx || !hasMask) return true;
    const x = Math.round(clamp(p.x, 0, W - 1));
    const y = Math.round(clamp(p.y, 0, H - 1));
    const a = maskCtx.getImageData(x, y, 1, 1).data[3];
    return a > 10;
  };
}

/** ✅ 보정값 타입 */
type Calib = { s: number; dx: number; dy: number };
const DEFAULT_CALIB: Calib = { s: 1, dx: 0, dy: 0 };

/** ✅ 배포용(고정) 프리셋: 여기 값 넣으면 모든 사용자에게 동일 적용 */
const CALIB_PRESETS: Partial<Record<MapId, Calib>> = { 
sanhok: { s: 1.000, dx: 4, dy: 4   },
erangel: { s: 1.000, dx: 1, dy: 1 },
miramar: { s: 1.000, dx: -1, dy: 0 },
};

const getPreset = (id: MapId): Calib => CALIB_PRESETS[id] ?? DEFAULT_CALIB;

/** ✅ 개발 중에는 슬라이더로 맞추고 localStorage에 저장하도록 (원하면 true 유지) */
const ENABLE_CALIB_UI = true; // 배포에서 완전히 숨기고 싶으면 false
const USE_LOCAL_STORAGE_CALIB = true; // 배포에서 “고정값만” 쓰려면 false

export default function Page() {
  const CANVAS = 900;
  const FS_SAFE_PAD = 0;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgTick, setImgTick] = useState(0); // ✅ 이미지 로드/교체를 React가 알게 해주는 트리거

  const fsRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const viewportSyncRef = useRef<() => void>(() => {});

  // ✅ mapId 먼저
  const [mapId, setMapId] = useState<MapId>("sanhok");

  // ✅ calib 초기값을 “처음부터 프리셋”으로 (초기 1프레임 어긋남 방지)
  const [calib, setCalib] = useState<Calib>(() => getPreset("sanhok"));
  const [calibMode, setCalibMode] = useState(false);

  // 마스크
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [hasMask, setHasMask] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [editMask, setEditMask] = useState(false);
  const BRUSH_PX = 18;

  const drawingRef = useRef(false);
  const lastPtRef = useRef<Point | null>(null);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const [target, setTarget] = useState<Point | null>(null);

  const [imgError, setImgError] = useState<string | null>(null);
  const [radiusM, setRadiusM] = useState<number>(700);

  const mapInfo = useMemo(() => MAPS.find((m) => m.id === mapId)!, [mapId]);
  const metersPerPixel = useMemo(() => (mapInfo.sizeKm * 1000) / CANVAS, [mapInfo.sizeKm]);
  const radiusPx = useMemo(() => radiusM / metersPerPixel, [radiusM, metersPerPixel]);

  /** ✅ 맵 바뀔 때 보정값 적용: (1) localStorage 우선(옵션) → (2) preset */
  useEffect(() => {
    if (USE_LOCAL_STORAGE_CALIB) {
      try {
        const saved = localStorage.getItem(`calib:${mapId}`);
        if (saved) {
          setCalib(JSON.parse(saved));
          return;
        }
      } catch {}
    }
    setCalib(getPreset(mapId));
  }, [mapId]);

  /** ✅ 보정값 저장(옵션) */
  useEffect(() => {
    if (!USE_LOCAL_STORAGE_CALIB) return;
    try {
      localStorage.setItem(`calib:${mapId}`, JSON.stringify(calib));
    } catch {}
  }, [calib, mapId]);

  /** ✅ Ctrl+K 보정 패널 토글 */
  useEffect(() => {
    if (!ENABLE_CALIB_UI) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCalibMode((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /** ✅ 보정 행렬(렌더용) */
  const getCalibTransform = () => {
    const { s, dx, dy } = calib;
    const cx = CANVAS / 2;
    const cy = CANVAS / 2;
    const tx = (1 - s) * cx + dx;
    const ty = (1 - s) * cy + dy;
    return { s, tx, ty };
  };

  /** ✅ 화면좌표(display 0..CANVAS) -> 월드좌표(world) */
  const toWorld = (pDisplay: Point): Point => {
    const { s, tx, ty } = getCalibTransform();
    return { x: (pDisplay.x - tx) / s, y: (pDisplay.y - ty) / s };
  };

  /** ✅ 보정 적용해서 이미지/오버레이 그리기 */
  const drawWithCalib = (ctx: CanvasRenderingContext2D, source: CanvasImageSource) => {
    const { s, tx, ty } = getCalibTransform();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS, CANVAS);
    ctx.clip();

    ctx.setTransform(s, 0, 0, s, tx, ty);
    ctx.drawImage(source, 0, 0, CANVAS, CANVAS);

    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  const withCalibTransform = (ctx: CanvasRenderingContext2D, fn: () => void) => {
    const { s, tx, ty } = getCalibTransform();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS, CANVAS);
    ctx.clip();
    ctx.setTransform(s, 0, 0, s, tx, ty);
    fn();
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  /** ✅ viewport sync */
  useEffect(() => {
    const syncViewport = () => {
      const vv = window.visualViewport;
      const w = Math.round(vv?.width ?? window.innerWidth);
      const h = Math.round(vv?.height ?? window.innerHeight);
      setViewport({ w, h });
    };
    viewportSyncRef.current = syncViewport;

    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      syncViewport();
      requestAnimationFrame(syncViewport);
      setTimeout(syncViewport, 60);
    };

    document.addEventListener("fullscreenchange", onFsChange);
    window.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("resize", syncViewport);

    syncViewport();

    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      window.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("resize", syncViewport);
    };
  }, []);

  const enterFullscreen = async () => {
    if (!fsRef.current) return;
    try {
      await fsRef.current.requestFullscreen();
      viewportSyncRef.current?.();
      requestAnimationFrame(() => viewportSyncRef.current?.());
    } catch (e) {
      console.error(e);
    }
  };

  const exitFullscreen = async () => {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch (e) {
      console.error(e);
    }
  };

  /** ✅ fullscreen display size */
  const displaySize = useMemo(() => {
    if (!isFullscreen) return CANVAS;
    const size = Math.min(viewport.w, viewport.h) - FS_SAFE_PAD * 2;
    return Math.max(200, Math.floor(size));
  }, [isFullscreen, viewport.w, viewport.h]);

  /** ✅ mask setup */
  const ensureMaskCanvas = () => {
    if (!maskCanvasRef.current || !maskCtxRef.current) {
      const mc = document.createElement("canvas");
      mc.width = CANVAS;
      mc.height = CANVAS;
      maskCanvasRef.current = mc;
      maskCtxRef.current = mc.getContext("2d", { willReadFrequently: true });
      maskCtxRef.current?.clearRect(0, 0, CANVAS, CANVAS);
    }
  };

  const autoApplyMaskForMap = async (mapIdForMask: MapId) => {
    ensureMaskCanvas();
    const mctx = maskCtxRef.current;
    if (!mctx) return;

    const maskFile = `/masks/${mapIdForMask}_mask.png`;

    mctx.clearRect(0, 0, CANVAS, CANVAS);
    setHasMask(false);

    try {
      const img = await loadImage(maskFile);
      mctx.clearRect(0, 0, CANVAS, CANVAS);
      mctx.drawImage(img, 0, 0, CANVAS, CANVAS);

      const data = mctx.getImageData(0, 0, CANVAS, CANVAS).data;
      const ok = isValidAlphaMask(data);
      if (!ok) console.warn("Mask alpha may be invalid (no transparency):", maskFile);

      setHasMask(true);
    } catch (e) {
      setHasMask(false);
      console.warn("Auto mask load failed:", maskFile, e);
    }
  };

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const importMaskPNG = async (file: File) => {
    ensureMaskCanvas();
    const mctx = maskCtxRef.current;
    if (!mctx) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      mctx.clearRect(0, 0, CANVAS, CANVAS);
      mctx.drawImage(img, 0, 0, CANVAS, CANVAS);
      URL.revokeObjectURL(url);
      setHasMask(true);
      redraw();
    };
    img.src = url;
  };

  const brushStroke = (fromWorld: Point, toWorldPt: Point, erase: boolean) => {
    ensureMaskCanvas();
    const mctx = maskCtxRef.current;
    if (!mctx) return;

    mctx.save();
    mctx.lineCap = "round";
    mctx.lineJoin = "round";
    mctx.lineWidth = BRUSH_PX;

    if (erase) {
      mctx.globalCompositeOperation = "destination-out";
      mctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      mctx.globalCompositeOperation = "source-over";
      mctx.strokeStyle = "rgba(255,255,255,1)";
    }

    mctx.beginPath();
    mctx.moveTo(fromWorld.x, fromWorld.y);
    mctx.lineTo(toWorldPt.x, toWorldPt.y);
    mctx.stroke();
    mctx.restore();

    if (!hasMask) setHasMask(true);
  };

  /** ✅ 캔버스 그리기 */
  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, CANVAS, CANVAS);

    const img = imgRef.current;
    if (img) drawWithCalib(ctx, img);
    else {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, CANVAS, CANVAS);
    }

    if (showMask && hasMask && maskCanvasRef.current) {
      ctx.save();
      ctx.globalAlpha = editMask ? 0.35 : 0.22;
      drawWithCalib(ctx, maskCanvasRef.current);
      ctx.restore();
    }

    let drop: PointT | null = null;
    if (start && end && target) {
      const isLand = makeIsLandFromMask(maskCtxRef.current, hasMask, CANVAS, CANVAS);
      drop = earliestLandPointWithinCircle(start, end, target, radiusPx, isLand);
    }

    withCalibTransform(ctx, () => {
      if (start && end) {
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        const pA = pointAt(start, end, 0.85);
        const pB = pointAt(start, end, 0.92);
        ctx.strokeStyle = "rgba(255,255,255,0.30)";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
      }

      if (target) {
        ctx.strokeStyle = "rgba(0,0,0,0.95)";
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(target.x, target.y, radiusPx, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (drop && target) drawArrow(ctx, { x: drop.x, y: drop.y }, target);

      if (drop) drawDot(ctx, drop, "red", 5);
      if (start) drawDot(ctx, start, "red", 6);
      if (end) drawDot(ctx, end, "lime", 6);
      if (target) drawDot(ctx, target, "black", 4);
    });
  };

  /** ✅ (중요) calib 포함해서 상태 바뀌면 즉시 redraw */
  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, target, mapId, radiusPx, showMask, editMask, hasMask, calib, imgTick]);

  /** ✅ 클릭/드래그는 “월드좌표”로 저장 */
  const getCanvasPointWorld = (evt: React.MouseEvent<HTMLCanvasElement, MouseEvent>): Point => {
    const rect = evt.currentTarget.getBoundingClientRect();
    const xDisplay = ((evt.clientX - rect.left) / rect.width) * CANVAS;
    const yDisplay = ((evt.clientY - rect.top) / rect.height) * CANVAS;
    return toWorld({ x: xDisplay, y: yDisplay });
  };

  const onCanvasMouseDown = (evt: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
    if (!editMask) return;
    drawingRef.current = true;

    const p = getCanvasPointWorld(evt);
    lastPtRef.current = p;

    brushStroke(p, { x: p.x + 0.01, y: p.y + 0.01 }, evt.shiftKey);
    redraw();
  };

  const onCanvasMouseMove = (evt: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
    if (!editMask || !drawingRef.current) return;

    const p = getCanvasPointWorld(evt);
    const last = lastPtRef.current;
    if (!last) {
      lastPtRef.current = p;
      return;
    }

    brushStroke(last, p, evt.shiftKey);
    lastPtRef.current = p;
    redraw();
  };

  const onCanvasMouseUp = () => {
    if (!editMask) return;
    drawingRef.current = false;
    lastPtRef.current = null;
  };

  const onCanvasClick = (evt: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
    if (editMask) return;
    const p = getCanvasPointWorld(evt);

    if (step === 0) {
      setStart(p);
      setEnd(null);
      setTarget(null);
      setStep(1);
      return;
    }
    if (step === 1) {
      setEnd(p);
      setStep(2);
      return;
    }
    setTarget(p);
    setStep(0);
  };

  const onReset = () => {
    setStart(null);
    setEnd(null);
    setTarget(null);
    setStep(0);
  };

  /** ✅ ` 단축키 초기화 */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.code === "Backquote") {
        e.preventDefault();
        onReset();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ✅ 맵 변경 시 지도 로드 + 마스크 적용 */
  useEffect(() => {
    let cancelled = false;

    ensureMaskCanvas();
    setImgError(null);
    imgRef.current = null;

    const img = new Image();
    img.src = mapInfo.file;

   img.onload = async () => {
  if (cancelled) return;

  // decode()가 지원되면 디코딩까지 끝난 후 그리기 (첫 프레임 찢김/지연 방지)
  try {
    // @ts-ignore
    if (img.decode) await img.decode();
  } catch {}

  imgRef.current = img;

  // ✅ ref 변경만으로는 redraw 이펙트가 안 돌기 때문에 state를 한번 건드려서 트리거
  setImgTick((t) => t + 1);
};

    img.onerror = () => {
      if (cancelled) return;
      setImgError(
        `지도 이미지를 불러오지 못했어요: ${mapInfo.file}\npublic/maps 폴더에 파일이 있는지, 파일명이 정확한지 확인해줘.`
      );
      imgRef.current = null;
      setImgTick((t) => t + 1); // (선택) 로딩 중 화면 갱신
      redraw();
    };

    onReset();
    setShowMask(false);
    setEditMask(false);

    (async () => {
      await autoApplyMaskForMap(mapId);
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInfo.file, mapId]);

  /** ✅ Ctrl+M → ( , / . / V ) */
  const maskChordRef = useRef<{ armed: boolean; expires: number }>({ armed: false, expires: 0 });
  useEffect(() => {
    const ARM_MS = 1500;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = e.key;
      const lower = key.toLowerCase();
      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && lower === "m") {
        e.preventDefault();
        maskChordRef.current.armed = true;
        maskChordRef.current.expires = Date.now() + ARM_MS;
        return;
      }

      if (maskChordRef.current.armed && Date.now() > maskChordRef.current.expires) {
        maskChordRef.current.armed = false;
      }
      if (!maskChordRef.current.armed) return;

      if (key === "," || key === "<") {
        e.preventDefault();
        setShowMask((v) => !v);
        maskChordRef.current.armed = false;
        return;
      }

      if (key === "." || key === ">") {
        e.preventDefault();
        setEditMask((v) => !v);
        maskChordRef.current.armed = false;
        return;
      }

      if (lower === "v") {
        e.preventDefault();
        importInputRef.current?.click();
        maskChordRef.current.armed = false;
        return;
      }

      maskChordRef.current.armed = false;
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const stepText = step === 0 ? "비행기 시작점 선택" : step === 1 ? "비행기 끝점 선택" : "도착지점 선택";

  return (
    <div className="pubg-shell">
      <header className="pubg-topbar">
        <div className="pubg-tabs">
          <div className="pubg-tab">배그 낙하산 도우미</div>
        </div>
      </header>

      <button className="pubg-fs-btn" onClick={isFullscreen ? exitFullscreen : enterFullscreen}>
        {isFullscreen ? "전체화면 종료" : "전체화면"}
      </button>

      <div className="pubg-body">
        <aside className="pubg-side">
          <div className="pubg-field">
            <span className="pubg-label">맵 선택</span>
            <select className="pubg-select" value={mapId} onChange={(e) => setMapId(e.target.value as MapId)}>
              {MAPS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="pubg-field">
            <span className="pubg-label">반경</span>
            <select className="pubg-select" value={radiusM} onChange={(e) => setRadiusM(Number(e.target.value))}>
              {RADIUS_OPTIONS_M.map((m) => (
                <option key={m} value={m}>
                  {m}m
                </option>
              ))}
            </select>
          </div>

          <div className="pubg-help">
            현재 단계: <b style={{ color: "rgba(255,255,255,0.9)" }}>{stepText}</b>
            <br />
            {editMask ? <>마스크 편집 중 (Shift+드래그=지우기)</> : <></>}
            <br />
            {ENABLE_CALIB_UI ? <span style={{ opacity: 0.8 }}></span> : null}
          </div>

          <button className="pubg-primary" onClick={onReset}>
            초기화
          </button>

          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              lineHeight: 1.5,
              color: "rgba(255,255,255,0.7)",
              whiteSpace: "pre-line",
            }}
          >
            {`※ 지도에 비행기 시작점과 끝점을 찍어 비행기 경로를 표시한 후, 도착지점을 찍어 낙하지점을 확인하세요.
초기화 단축키는 \` 입니다.`
}
          </div>

          {imgError && (
            <div style={{ marginTop: 12, whiteSpace: "pre-wrap", color: "#ff6b6b", fontSize: 12 }}>
              {imgError}
            </div>
          )}
        </aside>

        <main className="pubg-main">
          <div
            ref={fsRef}
            className="pubg-fs-host"
            style={{
              width: isFullscreen ? "100vw" : "auto",
              height: isFullscreen ? "100vh" : "auto",
              display: "grid",
              placeItems: "center",
              position: "relative",
              overflow: "hidden",
              background: isFullscreen ? "black" : "transparent",
              margin: 0,
              padding: 0,
            }}
          >
            {isFullscreen && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${mapInfo.file})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "blur(18px) brightness(0.6)",
                  transform: "scale(1.08)",
                  pointerEvents: "none",
                }}
              />
            )}

            <div
              className="pubg-map-frame"
              style={
                isFullscreen
                  ? {
                      width: displaySize,
                      height: displaySize,
                      borderRadius: 0,
                      border: "none",
                      position: "relative",
                      zIndex: 1,
                      boxSizing: "border-box",
                      padding: 0,
                    }
                  : undefined
              }
            >
              <canvas
                ref={canvasRef}
                width={CANVAS}
                height={CANVAS}
                className="pubg-canvas"
                onClick={onCanvasClick}
                onMouseDown={onCanvasMouseDown}
                onMouseMove={onCanvasMouseMove}
                onMouseUp={onCanvasMouseUp}
                onMouseLeave={onCanvasMouseUp}
                style={isFullscreen ? { width: "100%", height: "100%", display: "block" } : undefined}
              />

              <div className="pubg-right-note">
                전체화면 후 낙하 지점에 커서를 올리고 배틀그라운드 창을 켜면 동일한 지점을 찍을 수 있습니다.
              </div>

              <input
                ref={importInputRef}
                type="file"
                accept="image/png"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importMaskPNG(f);
                  e.currentTarget.value = "";
                }}
              />

              {/* ✅ 보정 패널 */}
              {ENABLE_CALIB_UI && calibMode && (
                <div
                  style={{
                    position: "fixed",
                    right: 16,
                    bottom: 16,
                    zIndex: 2147483647,
                    background: "rgba(0,0,0,0.70)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    padding: 12,
                    borderRadius: 12,
                    width: 300,
                    color: "rgba(255,255,255,0.92)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>지도 보정 (Ctrl+K)</div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
                    팁: 먼저 <b>Scale</b> 맞추고, 그 다음 <b>dx/dy</b>로 위치 조정
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.8 }}>Scale: {calib.s.toFixed(3)}</div>
                  <input
                    type="range"
                    min="0.95"
                    max="1.05"
                    step="0.001"
                    value={calib.s}
                    onChange={(e) => setCalib((c) => ({ ...c, s: Number(e.target.value) }))}
                    style={{ width: "100%" }}
                  />

                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>dx: {calib.dx.toFixed(0)}px</div>
                  <input
                    type="range"
                    min="-80"
                    max="80"
                    step="1"
                    value={calib.dx}
                    onChange={(e) => setCalib((c) => ({ ...c, dx: Number(e.target.value) }))}
                    style={{ width: "100%" }}
                  />

                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>dy: {calib.dy.toFixed(0)}px</div>
                  <input
                    type="range"
                    min="-80"
                    max="80"
                    step="1"
                    value={calib.dy}
                    onChange={(e) => setCalib((c) => ({ ...c, dy: Number(e.target.value) }))}
                    style={{ width: "100%" }}
                  />

                  <button
                    onClick={() => setCalib(getPreset(mapId))}
                    style={{
                      marginTop: 10,
                      width: "100%",
                      height: 36,
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.92)",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    (프리셋으로) 초기화
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}


