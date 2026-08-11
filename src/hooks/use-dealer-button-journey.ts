import {
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useLayoutEffect, useState, type RefObject } from 'react';

const CHIP_SIZE = 48;
const VIEW_W = 100;
const VIEW_H = 1000;

/** Original journey curve after the move-to; start `M` is rewritten to the Dealer anchor. */
const PATH_STEM_AFTER_M =
  'C63 108 87 168 70 238 C58 286 28 306 31 370 C34 438 77 482 72 558 C68 626 32 692 40 756';

const DEFAULT_PATH_D = `M50 36 ${PATH_STEM_AFTER_M} C44 814 62 870 70 962`;

function samplePathPoint(
  path: SVGPathElement,
  page: HTMLElement,
  progress: number,
): { x: number; y: number } | null {
  const svg = path.ownerSVGElement;
  if (!svg) return null;

  const length = path.getTotalLength();
  if (length <= 0) return null;

  const clamped = Math.min(1, Math.max(0, progress));
  const point = path.getPointAtLength(clamped * length);
  const svgRect = svg.getBoundingClientRect();
  const pageRect = page.getBoundingClientRect();

  const screenX = svgRect.left + (point.x / VIEW_W) * svgRect.width;
  const screenY = svgRect.top + (point.y / VIEW_H) * svgRect.height;

  return {
    x: screenX - pageRect.left - CHIP_SIZE / 2,
    y: screenY - pageRect.top - CHIP_SIZE / 2,
  };
}

function elementViewPoint(
  page: HTMLElement,
  svg: SVGSVGElement,
  el: HTMLElement,
): { viewX: number; viewY: number } | null {
  const elRect = el.getBoundingClientRect();
  const svgRect = svg.getBoundingClientRect();
  if (svgRect.width <= 0 || svgRect.height <= 0) return null;

  const centerX = elRect.left + elRect.width / 2;
  const centerY = elRect.top + elRect.height / 2;

  return {
    viewX: ((centerX - svgRect.left) / svgRect.width) * VIEW_W,
    viewY: ((centerY - svgRect.top) / svgRect.height) * VIEW_H,
  };
}

/** Keep the previous stem + end landing; only the start point changes. */
function buildPathD(
  start: { viewX: number; viewY: number },
  end: { viewX: number; viewY: number },
) {
  const c1x = 44;
  const c1y = 814;
  const c2x = end.viewX * 0.85 + 12;
  const c2y = (756 + end.viewY) / 2;
  return `M${start.viewX.toFixed(2)} ${start.viewY.toFixed(2)} ${PATH_STEM_AFTER_M} C${c1x} ${c1y} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${end.viewX.toFixed(2)} ${end.viewY.toFixed(2)}`;
}

export function useDealerButtonJourney(
  pageRef: RefObject<HTMLElement | null>,
  pathRef: RefObject<SVGPathElement | null>,
  startSlotRef: RefObject<HTMLElement | null>,
  endSlotRef: RefObject<HTMLElement | null>,
): {
  x: MotionValue<number>;
  y: MotionValue<number>;
  rotate: MotionValue<number>;
  opacity: MotionValue<number>;
  routeProgress: MotionValue<number>;
  pathD: string;
} {
  const { scrollYProgress } = useScroll({
    target: pageRef,
    offset: ['start start', 'end end'],
  });

  const progress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 28,
    restDelta: 0.001,
  });

  const x = useMotionValue(0);
  const y = useMotionValue(120);
  const [pathD, setPathD] = useState(DEFAULT_PATH_D);

  useLayoutEffect(() => {
    const syncPathToSlots = () => {
      const page = pageRef.current;
      const path = pathRef.current;
      const start = startSlotRef.current;
      const end = endSlotRef.current;
      if (!page || !path || !start || !end) return;

      const svg = path.ownerSVGElement;
      if (!svg) return;

      const startPoint = elementViewPoint(page, svg, start);
      const endPoint = elementViewPoint(page, svg, end);
      if (!startPoint || !endPoint) return;

      const nextD = buildPathD(startPoint, endPoint);
      setPathD((prev) => (prev === nextD ? prev : nextD));
      path.setAttribute('d', nextD);
    };

    const syncChip = (latest: number) => {
      const page = pageRef.current;
      const path = pathRef.current;
      if (!page || !path) return;
      const point = samplePathPoint(path, page, latest);
      if (!point) return;
      x.set(point.x);
      y.set(point.y);
    };

    const measure = () => {
      syncPathToSlots();
      syncChip(progress.get());
    };

    measure();

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (pageRef.current) resizeObserver?.observe(pageRef.current);
    if (startSlotRef.current) resizeObserver?.observe(startSlotRef.current);
    if (endSlotRef.current) resizeObserver?.observe(endSlotRef.current);

    const unsub = progress.on('change', syncChip);

    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
      resizeObserver?.disconnect();
      unsub();
    };
  }, [pageRef, pathRef, startSlotRef, endSlotRef, progress, x, y]);

  useLayoutEffect(() => {
    pathRef.current?.setAttribute('d', pathD);
    const page = pageRef.current;
    const path = pathRef.current;
    if (!page || !path) return;
    const point = samplePathPoint(path, page, progress.get());
    if (point) {
      x.set(point.x);
      y.set(point.y);
    }
  }, [pathD, pageRef, pathRef, progress, x, y]);

  const rotate = useTransform(progress, [0, 1], [-12, 400]);
  // Strong at hero + final CTA; quieter through the middle of the page
  const opacity = useTransform(progress, [0, 0.12, 0.45, 0.78, 1], [0.95, 0.42, 0.28, 0.5, 0.98]);
  const routeProgress = progress;

  return { x, y, rotate, opacity, routeProgress, pathD };
}
