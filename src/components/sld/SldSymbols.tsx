import type { ReactNode } from "react";
import type { SldSymbolType } from "../../types/sld";

interface SldSymbolProps {
  x: number;
  y: number;
  tag: string;
  rating?: string;
  selected?: boolean;
  onClick?: () => void;
}

const BOX_W = 44;
const BOX_H = 52;

function DeviceFrame({
  x,
  y,
  tag,
  rating,
  selected,
  onClick,
  children,
}: SldSymbolProps & { children: ReactNode }) {
  return (
    <g
      transform={`translate(${x - BOX_W / 2}, ${y})`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{ cursor: "pointer" }}
    >
      <rect
        width={BOX_W}
        height={BOX_H}
        fill={selected ? "#2d3f5e" : "#252a33"}
        stroke={selected ? "#7cb8ff" : "#4a5366"}
        strokeWidth={selected ? 2 : 1.5}
        rx={3}
      />
      {children}
      <text x={BOX_W / 2} y={BOX_H - 8} textAnchor="middle" fill="#9aa3b2" fontSize={9}>
        {rating ?? ""}
      </text>
      <text
        x={BOX_W / 2}
        y={14}
        textAnchor="middle"
        fill="#e8eaed"
        fontSize={11}
        fontWeight="bold"
      >
        {tag}
      </text>
    </g>
  );
}

export function SldMccb(props: SldSymbolProps) {
  return (
    <DeviceFrame {...props}>
      <rect x={10} y={20} width={24} height={18} fill="none" stroke="#7cb8ff" strokeWidth={1.5} />
      <line x1={14} y1={24} x2={30} y2={34} stroke="#7cb8ff" strokeWidth={1.5} />
      <line x1={14} y1={34} x2={30} y2={24} stroke="#7cb8ff" strokeWidth={1.5} />
    </DeviceFrame>
  );
}

export function SldMccbDs(props: SldSymbolProps) {
  return (
    <DeviceFrame {...props}>
      <line x1={8} y1={22} x2={36} y2={22} stroke="#7cb8ff" strokeWidth={2} />
      <line x1={12} y1={18} x2={12} y2={26} stroke="#7cb8ff" strokeWidth={2} />
      <line x1={32} y1={18} x2={32} y2={26} stroke="#7cb8ff" strokeWidth={2} />
      <rect x={10} y={28} width={24} height={14} fill="none" stroke="#7cb8ff" strokeWidth={1.5} />
    </DeviceFrame>
  );
}

export function SldFuse(props: SldSymbolProps) {
  return (
    <DeviceFrame {...props}>
      <rect x={16} y={20} width={12} height={20} fill="none" stroke="#f59e0b" strokeWidth={1.5} />
      <line x1={12} y1={24} x2={32} y2={24} stroke="#f59e0b" strokeWidth={1} />
      <line x1={12} y1={36} x2={32} y2={36} stroke="#f59e0b" strokeWidth={1} />
    </DeviceFrame>
  );
}

export function SldContactor(props: SldSymbolProps) {
  return (
    <DeviceFrame {...props}>
      <circle cx={BOX_W / 2} cy={30} r={10} fill="none" stroke="#22c55e" strokeWidth={1.5} />
      <text x={BOX_W / 2} y={34} textAnchor="middle" fill="#22c55e" fontSize={12} fontWeight="bold">
        K
      </text>
    </DeviceFrame>
  );
}

export function SldMotor(props: SldSymbolProps) {
  return (
    <DeviceFrame {...props}>
      <circle cx={BOX_W / 2} cy={30} r={14} fill="none" stroke="#a78bfa" strokeWidth={1.5} />
      <text x={BOX_W / 2} y={35} textAnchor="middle" fill="#a78bfa" fontSize={14} fontWeight="bold">
        M
      </text>
    </DeviceFrame>
  );
}

export function SldTransformer(props: SldSymbolProps) {
  return (
    <DeviceFrame {...props}>
      <circle cx={18} cy={30} r={10} fill="none" stroke="#f472b6" strokeWidth={1.5} />
      <circle cx={26} cy={30} r={10} fill="none" stroke="#f472b6" strokeWidth={1.5} />
    </DeviceFrame>
  );
}

export function SldLoad(props: SldSymbolProps) {
  return (
    <DeviceFrame {...props}>
      <polyline
        points={`10,38 16,22 22,38 28,22 34,38`}
        fill="none"
        stroke="#fb923c"
        strokeWidth={1.5}
      />
    </DeviceFrame>
  );
}

export function SldSymbol({
  symbolType,
  ...props
}: SldSymbolProps & { symbolType: SldSymbolType }) {
  switch (symbolType) {
    case "mccb":
      return <SldMccb {...props} />;
    case "mccb_ds":
      return <SldMccbDs {...props} />;
    case "fuse":
      return <SldFuse {...props} />;
    case "contactor":
      return <SldContactor {...props} />;
    case "motor":
      return <SldMotor {...props} />;
    case "transformer":
      return <SldTransformer {...props} />;
    case "load":
      return <SldLoad {...props} />;
    default:
      return <SldLoad {...props} />;
  }
}
