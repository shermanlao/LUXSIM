import type { PhotometricData } from "@luxsim/photometry";
import { officialLightConeGeom, type OfficialLightConeGeom } from "@/lib/fixture-beam-cone";
import type { RoomV2 } from "@luxsim/project-io";

export function FixtureLightConePreview({
  photo,
  fixtureZ,
  room,
}: {
  photo?: PhotometricData | null;
  fixtureZ: number;
  room?: Pick<RoomV2, "workplaneHeightM"> | null;
}) {
  const geom = officialLightConeGeom({ photo, fixtureZ, room });
  return (
    <div className="fixture-light-cone-preview" data-fixture-light-cone="">
      <p className="label">Light cone / 光束錐</p>
      <LightConeElevationSvg geom={geom} />
    </div>
  );
}

function LightConeElevationSvg({ geom }: { geom: OfficialLightConeGeom }) {
  const width = 220;
  const height = 118;
  const padX = 16;
  const padTop = 10;
  const padBottom = 22;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const rMax = Math.max(geom.endRadiusC0M, geom.endRadiusC90M, 0.05);
  const spanX = rMax * 2.2;
  const spanY = Math.max(geom.lengthM, 0.2);
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const cx = width / 2;
  const apexY = padTop;
  const endY = apexY + geom.lengthM * scale;
  const r0 = geom.endRadiusC0M * scale;
  const r90 = geom.endRadiusC90M * scale;
  const workY = endY;

  const coneC0 = `M ${cx} ${apexY} L ${cx + r0} ${endY} L ${cx - r0} ${endY} Z`;
  const left90 = cx - r90;
  const right90 = cx + r90;

  return (
    <svg
      className="fixture-light-cone-svg"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="Light cone / 光束錐"
    >
      {geom.elliptic && (
        <path
          d={`M ${cx} ${apexY} L ${right90} ${endY} L ${left90} ${endY} Z`}
          fill="rgba(80, 170, 220, 0.12)"
          stroke="#6aa8c4"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
      )}
      <path
        d={coneC0}
        fill="rgba(80, 200, 255, 0.18)"
        stroke="#7ec8e8"
        strokeWidth={1.2}
      />
      <line
        x1={cx}
        y1={apexY}
        x2={cx}
        y2={endY}
        stroke="#d8eef8"
        strokeWidth={1.6}
        markerEnd="url(#fixture-cone-arrow)"
      />
      <line
        x1={cx - Math.max(r0, r90) - 8}
        y1={workY}
        x2={cx + Math.max(r0, r90) + 8}
        y2={workY}
        stroke="#9fb0bb"
        strokeWidth={1}
      />
      <circle cx={cx} cy={apexY} r={2.4} fill="#f0f4f6" />
      <defs>
        <marker
          id="fixture-cone-arrow"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="#d8eef8" />
        </marker>
      </defs>
    </svg>
  );
}
