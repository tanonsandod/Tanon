import { Group, Rect, Line, Circle, Text, RegularPolygon } from "react-konva";
import type { SldSymbolType } from "../../types/sld";
import { SLD_LAYOUT } from "../../lib/sldLayout";

const { BOX_W, BOX_H } = SLD_LAYOUT;

interface DeviceShapeProps {
  x: number;
  y: number;
  tag: string;
  rating?: string;
  selected: boolean;
  symbolType: SldSymbolType;
  manufacturer?: string;
  draggable?: boolean;
  onSelect?: () => void;
  onDragEnd?: (y: number) => void;
}

function SymbolGraphic({ symbolType }: { symbolType: SldSymbolType }) {
  const cx = BOX_W / 2;
  switch (symbolType) {
    case "mccb":
      return (
        <>
          <Rect x={10} y={20} width={24} height={18} stroke="#7cb8ff" strokeWidth={1.5} />
          <Line points={[14, 24, 30, 34]} stroke="#7cb8ff" strokeWidth={1.5} />
          <Line points={[14, 34, 30, 24]} stroke="#7cb8ff" strokeWidth={1.5} />
        </>
      );
    case "mccb_ds":
      return (
        <>
          <Line points={[8, 22, 36, 22]} stroke="#7cb8ff" strokeWidth={2} />
          <Line points={[12, 18, 12, 26]} stroke="#7cb8ff" strokeWidth={2} />
          <Line points={[32, 18, 32, 26]} stroke="#7cb8ff" strokeWidth={2} />
          <Rect x={10} y={28} width={24} height={14} stroke="#7cb8ff" strokeWidth={1.5} />
        </>
      );
    case "fuse":
      return (
        <>
          <Rect x={16} y={20} width={12} height={20} stroke="#f59e0b" strokeWidth={1.5} />
          <Line points={[12, 24, 32, 24]} stroke="#f59e0b" strokeWidth={1} />
          <Line points={[12, 36, 32, 36]} stroke="#f59e0b" strokeWidth={1} />
        </>
      );
    case "contactor":
      return (
        <>
          <Circle x={cx} y={30} radius={10} stroke="#22c55e" strokeWidth={1.5} />
          <Text x={cx} y={26} text="K" fontSize={12} fill="#22c55e" fontStyle="bold" align="center" width={BOX_W} />
        </>
      );
    case "motor":
      return (
        <>
          <Circle x={cx} y={30} radius={14} stroke="#a78bfa" strokeWidth={1.5} />
          <Text x={cx} y={24} text="M" fontSize={14} fill="#a78bfa" fontStyle="bold" align="center" width={BOX_W} />
        </>
      );
    case "transformer":
      return (
        <>
          <Circle x={18} y={30} radius={10} stroke="#f472b6" strokeWidth={1.5} />
          <Circle x={26} y={30} radius={10} stroke="#f472b6" strokeWidth={1.5} />
        </>
      );
    case "load":
      return (
        <RegularPolygon
          x={cx}
          y={30}
          sides={3}
          radius={14}
          stroke="#fb923c"
          strokeWidth={1.5}
          rotation={180}
        />
      );
    default:
      return null;
  }
}

export function KonvaDeviceShape({
  x,
  y,
  tag,
  rating,
  selected,
  symbolType,
  manufacturer,
  draggable,
  onSelect,
  onDragEnd,
}: DeviceShapeProps) {
  return (
    <Group
      x={x - BOX_W / 2}
      y={y}
      draggable={draggable}
      dragBoundFunc={(pos) => ({
        x: x - BOX_W / 2,
        y: pos.y,
      })}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect?.();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect?.();
      }}
      onDragEnd={(e) => {
        onDragEnd?.(e.target.y());
      }}
      perfectDrawEnabled={false}
    >
      <Rect
        width={BOX_W}
        height={BOX_H}
        fill={selected ? "#2d3f5e" : "#252a33"}
        stroke={selected ? "#7cb8ff" : "#4a5366"}
        strokeWidth={selected ? 2 : 1.5}
        cornerRadius={3}
        shadowColor={selected ? "#0f6cbd" : undefined}
        shadowBlur={selected ? 12 : 0}
        shadowOpacity={selected ? 0.45 : 0}
      />
      <SymbolGraphic symbolType={symbolType} />
      <Text
        x={0}
        y={BOX_H - 14}
        width={BOX_W}
        text={rating ?? ""}
        fontSize={9}
        fill="#9aa3b2"
        align="center"
      />
      <Text
        x={0}
        y={4}
        width={BOX_W}
        text={tag}
        fontSize={11}
        fill="#e8eaed"
        fontStyle="bold"
        align="center"
      />
      {manufacturer === "ABB" && (
        <Text x={BOX_W + 2} y={18} text="ABB" fontSize={9} fill="#FF000F" fontStyle="bold" />
      )}
    </Group>
  );
}
