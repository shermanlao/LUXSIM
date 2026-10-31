"use client";

import type { PhotometricData } from "@luxsim/photometry";
import { sampleIntensityCd } from "@luxsim/photometry";

function curve(
  photo: PhotometricData,
  phi: number,
  samples: number
): { theta: number; cd: number }[] {
  const out: { theta: number; cd: number }[] = [];
  for (let i = 0; i < samples; i += 1) {
    const theta = (180 * i) / (samples - 1);
    out.push({ theta, cd: sampleIntensityCd(photo, theta, phi) });
  }
  return out;
}

export function PolarPreview({
  photo,
  size = 180,
}: {
  photo: PhotometricData;
  size?: number;
}) {
  const c0 = curve(photo, 0, 49);
  const c90 = curve(photo, 90, 49);
  const maxCd = Math.max(...c0.map((s) => s.cd), ...c90.map((s) => s.cd), 1);
  const cx = size / 2;
  const cy = size / 2;
  const rMax = size * 0.4;

  const toPoints = (samples: { theta: number; cd: number }[]) =>
    samples
      .map((s) => {
        const r = (s.cd / maxCd) * rMax;
        const rad = (s.theta * Math.PI) / 180;
        const x = cx + r * Math.sin(rad);
        const y = cy + r * Math.cos(rad);
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="bg-white border border-[var(--line)]"
    >
      <circle cx={cx} cy={cy} r={rMax} fill="none" stroke="#c5d0d6" />
      <circle cx={cx} cy={cy} r={rMax * 0.5} fill="none" stroke="#e0e7eb" />
      <line x1={cx} y1={cy - rMax} x2={cx} y2={cy + rMax} stroke="#e0e7eb" />
      <line x1={cx - rMax} y1={cy} x2={cx + rMax} y2={cy} stroke="#e0e7eb" />
      <polyline
        fill="rgba(196,180,80,0.18)"
        stroke="#8a7a20"
        strokeWidth="1.5"
        points={toPoints(c90)}
      />
      <polyline
        fill="rgba(31,111,139,0.12)"
        stroke="#1f6f8b"
        strokeWidth="2"
        points={toPoints(c0)}
      />
      <text x={6} y={14} fontSize="10" fill="#5a6b76">
        C0 / C90 · max {Math.round(maxCd)} cd
      </text>
    </svg>
  );
}
