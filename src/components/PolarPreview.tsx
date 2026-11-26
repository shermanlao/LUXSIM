"use client";

import type { PhotometricData } from "@luxsim/photometry";
import { polarPlane, polarToXY } from "@luxsim/photometry";

export function PolarPreview({
  photo,
  size = 180,
}: {
  photo: PhotometricData;
  size?: number;
}) {
  const typeB = (photo.verticalAngles[0] ?? 0) < -1e-6;
  const c0 = polarPlane(photo, 0, 73);
  const c90 = polarPlane(photo, 90, 73);
  const c180 = typeB ? [] : polarPlane(photo, 180, 73);
  const c270 = typeB ? [] : polarPlane(photo, 270, 73);
  const maxCd = Math.max(
    1,
    ...c0.map((s) => s.cd),
    ...c90.map((s) => s.cd),
    ...c180.map((s) => s.cd),
    ...c270.map((s) => s.cd)
  );
  const cx = size / 2;
  const cy = size / 2 + 2;
  const rMax = size * 0.38;

  const toPoints = (plane: typeof c0, flipX = false) =>
    plane
      .map((s) => {
        const p = polarToXY(s.gamma, s.cd, maxCd, rMax);
        return `${cx + (flipX ? -p.x : p.x)},${cy + p.y}`;
      })
      .join(" ");

  const rings = [0.25, 0.5, 0.75, 1].map((f) => (
    <circle key={f} cx={cx} cy={cy} r={rMax * f} fill="none" stroke="#d5dde2" strokeWidth="0.8" />
  ));
  const radials = Array.from({ length: 12 }, (_, i) => {
    const rad = (i * 30 * Math.PI) / 180;
    return (
      <line
        key={i}
        x1={cx}
        y1={cy}
        x2={cx + rMax * Math.sin(rad)}
        y2={cy + rMax * Math.cos(rad)}
        stroke="#e0e7eb"
        strokeWidth="0.7"
      />
    );
  });

  return (
    <svg
      width={size}
      height={size + 16}
      viewBox={`0 0 ${size} ${size + 16}`}
      className="bg-white border border-[var(--line)]"
    >
      {rings}
      {radials}
      <polyline fill="none" stroke="#c45c26" strokeWidth="1.4" strokeDasharray="3 2" points={toPoints(c90)} />
      {!typeB && (
        <polyline fill="none" stroke="#c45c26" strokeWidth="1.4" strokeDasharray="3 2" points={toPoints(c270, true)} />
      )}
      <polyline fill="none" stroke="#1f4e79" strokeWidth="2" points={toPoints(c0)} />
      {!typeB && <polyline fill="none" stroke="#1f4e79" strokeWidth="2" points={toPoints(c180, true)} />}
      <text x={cx} y={cy + rMax + 10} fontSize="8" fill="#5a6b76" textAnchor="middle">
        0°
      </text>
      <text x={6} y={size + 12} fontSize="9" fill="#5a6b76">
        C0–C180 / C90–C270 · Imax {Math.round(maxCd)} cd
      </text>
    </svg>
  );
}
