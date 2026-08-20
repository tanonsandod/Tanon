import type { BusbarSectionNode } from "../types";

interface SingleLineCanvasProps {
  panelCode: string;
  sheetName: string;
  busbarSections: BusbarSectionNode[];
  gridUnitMm?: number;
}

const W = 900;
const H = 520;
const GRID = 20;

export function SingleLineCanvas({
  panelCode,
  sheetName,
  busbarSections,
  gridUnitMm = 2.5,
}: SingleLineCanvasProps) {
  const main = busbarSections.find((b) => b.sectionRole === "main");
  const feeders = busbarSections.filter((b) => b.sectionRole === "feeder");
  const busY = 120;
  const busX1 = 80;
  const busX2 = W - 80;

  return (
    <div className="sld-canvas-wrap">
      <div className="sld-toolbar">
        <span className="sld-badge">Single Line Diagram</span>
        <span>
          {panelCode} — {sheetName}
        </span>
        <span className="muted">Grid {gridUnitMm} mm</span>
      </div>

      <svg
        className="sld-canvas"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Single line diagram for ${panelCode}`}
      >
        <defs>
          <pattern
            id="grid"
            width={GRID}
            height={GRID}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${GRID} 0 L 0 0 0 ${GRID}`}
              fill="none"
              stroke="#2a3140"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        <rect
          x={0}
          y={0}
          width={W}
          height={H}
          fill="#1a1d23"
          fillOpacity={0.55}
        />

        {/* Incoming supply */}
        <line
          x1={busX1 + (busX2 - busX1) / 2}
          y1={40}
          x2={busX1 + (busX2 - busX1) / 2}
          y2={busY - 10}
          stroke="#e8eaed"
          strokeWidth={2}
        />
        <polygon
          points={`${busX1 + (busX2 - busX1) / 2 - 8},${busY - 10} ${busX1 + (busX2 - busX1) / 2 + 8},${busY - 10} ${busX1 + (busX2 - busX1) / 2},${busY}`}
          fill="#e8eaed"
        />
        <text
          x={busX1 + (busX2 - busX1) / 2}
          y={28}
          textAnchor="middle"
          fill="#9aa3b2"
          fontSize={12}
        >
          Incoming
        </text>

        {/* Main busbar */}
        <line
          x1={busX1}
          y1={busY}
          x2={busX2}
          y2={busY}
          stroke="#f59e0b"
          strokeWidth={6}
          strokeLinecap="square"
        />
        {main && (
          <text x={busX1} y={busY - 14} fill="#fbbf24" fontSize={12}>
            MAIN BUS {main.sizeLabel} ×{main.barsPerPhase} — {main.ratedCurrentA}A
            {main.icwKa ? ` / Icw ${main.icwKa}kA` : ""}
          </text>
        )}

        {/* Feeders */}
        {feeders.map((feeder, i) => {
          const x =
            busX1 +
            ((i + 1) * (busX2 - busX1)) / (feeders.length + 1);
          const tag = feeder.feederTag ?? `F${i + 1}`;
          return (
            <g key={feeder.id}>
              <line
                x1={x}
                y1={busY}
                x2={x}
                y2={280}
                stroke="#7cb8ff"
                strokeWidth={2}
              />
              <rect
                x={x - 22}
                y={290}
                width={44}
                height={56}
                fill="#252a33"
                stroke="#7cb8ff"
                strokeWidth={1.5}
              />
              <text
                x={x}
                y={314}
                textAnchor="middle"
                fill="#e8eaed"
                fontSize={11}
                fontWeight="bold"
              >
                {tag}
              </text>
              <text
                x={x}
                y={332}
                textAnchor="middle"
                fill="#9aa3b2"
                fontSize={10}
              >
                {feeder.ratedCurrentA}A
              </text>
              <text
                x={x}
                y={348}
                textAnchor="middle"
                fill="#9aa3b2"
                fontSize={9}
              >
                {feeder.sizeLabel}
              </text>
            </g>
          );
        })}

        {/* Panel outline */}
        <rect
          x={40}
          y={60}
          width={W - 80}
          height={H - 100}
          fill="none"
          stroke="#3a4150"
          strokeWidth={1}
          strokeDasharray="6 4"
        />
        <text x={52} y={78} fill="#9aa3b2" fontSize={11}>
          {panelCode} — Single Line (entry sheet)
        </text>
      </svg>

      <p className="sld-hint">
        เริ่มออกแบบ schematic จากหน้านี้ — กำหนด busbar และ feeder ก่อนไปหน้า Power /
        Control
      </p>
    </div>
  );
}
