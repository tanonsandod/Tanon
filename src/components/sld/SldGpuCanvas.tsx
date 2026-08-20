import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Layer, Line, Stage, Text } from "react-konva";
import type Konva from "konva";
import type { BusbarSectionNode } from "../../types";
import type { SldContent, SldFeeder } from "../../types/sld";
import {
  SLD_LAYOUT,
  clampZoom,
  deviceRowY,
  feederX,
  rowFromY,
  snapToGrid,
} from "../../lib/sldLayout";
import { KonvaDeviceShape } from "./sldKonvaShapes";

const { W, H, GRID, BUS_Y, BUS_X1, BUS_X2, FEEDER_TOP } = SLD_LAYOUT;

interface SldGpuCanvasProps {
  content: SldContent;
  busbarMain?: BusbarSectionNode;
  selectedFeederId: string | null;
  selectedDeviceId: string | null;
  onSelectFeeder: (feederId: string) => void;
  onSelectDevice: (feederId: string, deviceId: string) => void;
  onClearSelection: () => void;
  onReorderDevices: (feederId: string, deviceIds: string[]) => void;
}

export function SldGpuCanvas({
  content,
  busbarMain,
  selectedFeederId,
  selectedDeviceId,
  onSelectFeeder,
  onSelectDevice,
  onClearSelection,
  onReorderDevices,
}: SldGpuCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridLayerRef = useRef<Konva.Layer>(null);
  const [size, setSize] = useState({ w: 800, h: 480 });
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [spacePan, setSpacePan] = useState(false);
  const feeders = content.feeders;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setSize({ w: cr.width, h: Math.max(400, cr.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const layer = gridLayerRef.current;
    if (!layer) return;
    layer.cache();
    layer.getLayer()?.batchDraw();
  }, [size.w, size.h]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) setSpacePan(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpacePan(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const scaleBy = 1.08;
      const oldScale = scale;
      const newScale = clampZoom(e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy);
      const mousePointTo = {
        x: (pointer.x - stagePos.x) / oldScale,
        y: (pointer.y - stagePos.y) / oldScale,
      };
      setScale(newScale);
      setStagePos({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    },
    [scale, stagePos],
  );

  function handleDeviceDragEnd(feeder: SldFeeder, deviceId: string, rawY: number) {
    const snappedY = snapToGrid(rawY, SLD_LAYOUT.DEVICE_GAP);
    const targetRow = rowFromY(snappedY);
    const ids = feeder.devices.map((d) => d.id);
    const fromIdx = ids.indexOf(deviceId);
    if (fromIdx < 0) return;
    ids.splice(fromIdx, 1);
    ids.splice(Math.min(targetRow, ids.length), 0, deviceId);
    onReorderDevices(feeder.id, ids);
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 400,
        position: "relative",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid #3a4150",
        background: "#0d0f12",
        cursor: spacePan ? "grab" : "default",
        touchAction: "none",
      }}
    >
      <Stage
        width={size.w}
        height={size.h}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        draggable={spacePan}
        onWheel={handleWheel}
        onDragEnd={(e) => {
          if (spacePan) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) onClearSelection();
        }}
      >
        <Layer ref={gridLayerRef} listening={false} perfectDrawEnabled={false}>
          {Array.from({ length: Math.ceil(W / GRID) + 1 }, (_, i) => (
            <Line
              key={`gv-${i}`}
              points={[i * GRID, 0, i * GRID, H]}
              stroke="#1e2430"
              strokeWidth={0.5}
            />
          ))}
          {Array.from({ length: Math.ceil(H / GRID) + 1 }, (_, i) => (
            <Line
              key={`gh-${i}`}
              points={[0, i * GRID, W, i * GRID]}
              stroke="#1e2430"
              strokeWidth={0.5}
            />
          ))}
        </Layer>

        <Layer listening={false} perfectDrawEnabled={false}>
          <Line
            points={[(BUS_X1 + BUS_X2) / 2, 36, (BUS_X1 + BUS_X2) / 2, BUS_Y - 8]}
            stroke="#e8eaed"
            strokeWidth={2}
          />
          <Text
            x={(BUS_X1 + BUS_X2) / 2 - 80}
            y={12}
            width={160}
            text={content.incomingLabel ?? "Incoming"}
            fontSize={11}
            fill="#9aa3b2"
            align="center"
          />
          <Line points={[BUS_X1, BUS_Y, BUS_X2, BUS_Y]} stroke="#f59e0b" strokeWidth={7} lineCap="round" />
          {busbarMain && (
            <Text
              x={BUS_X1}
              y={BUS_Y - 18}
              text={`MAIN BUS ${busbarMain.sizeLabel} — ${busbarMain.ratedCurrentA}A`}
              fontSize={11}
              fill="#fbbf24"
            />
          )}
        </Layer>

        <Layer perfectDrawEnabled={false}>
          {feeders.map((feeder, fi) => {
            const x = feederX(fi, feeders.length);
            const isSelected = feeder.id === selectedFeederId;
            return (
              <Group key={feeder.id}>
                <Line
                  points={[x, BUS_Y, x, FEEDER_TOP - 10]}
                  stroke={isSelected ? "#0f6cbd" : "#5a6a80"}
                  strokeWidth={isSelected ? 2.5 : 2}
                />
                <Line
                  points={[x - 28, BUS_Y + 6, x + 28, BUS_Y + 6, x + 28, BUS_Y + 28, x - 28, BUS_Y + 28]}
                  closed
                  fill={isSelected ? "rgba(15,108,189,0.2)" : "#252a33"}
                  stroke={isSelected ? "#0f6cbd" : "#4a5366"}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    onSelectFeeder(feeder.id);
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true;
                    onSelectFeeder(feeder.id);
                  }}
                />
                <Text
                  x={x - 28}
                  y={BUS_Y + 12}
                  width={56}
                  text={feeder.tag}
                  fontSize={10}
                  fill="#e8eaed"
                  fontStyle="bold"
                  align="center"
                />

                {feeder.devices.map((device, di) => {
                  const dy = deviceRowY(di);
                  const prevBottom =
                    di === 0 ? FEEDER_TOP - 10 : deviceRowY(di - 1) + SLD_LAYOUT.BOX_H;
                  return (
                    <Group key={device.id}>
                      <Line points={[x, prevBottom, x, dy]} stroke="#5a6a80" strokeWidth={1.5} />
                      <KonvaDeviceShape
                        x={x}
                        y={dy}
                        tag={device.tag}
                        rating={device.rating}
                        symbolType={device.symbolType}
                        manufacturer={device.manufacturer}
                        selected={device.id === selectedDeviceId}
                        draggable
                        onSelect={() => onSelectDevice(feeder.id, device.id)}
                        onDragEnd={(y) => handleDeviceDragEnd(feeder, device.id, y)}
                      />
                    </Group>
                  );
                })}
              </Group>
            );
          })}
        </Layer>
      </Stage>

      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 12,
          fontSize: 11,
          color: "#6b7280",
          pointerEvents: "none",
        }}
      >
        Scroll = zoom · ลากอุปกรณ์ = จัดลำดับ · Space+ลาก = เลื่อน · GPU Canvas
      </div>

      <button
        type="button"
        onClick={() => {
          setScale(1);
          setStagePos({ x: 0, y: 0 });
        }}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "#252a33",
          border: "1px solid #3a4150",
          color: "#9aa3b2",
          borderRadius: 6,
          padding: "4px 10px",
          fontSize: 11,
          cursor: "pointer",
        }}
      >
        {Math.round(scale * 100)}% · รีเซ็ตมุมมอง
      </button>
    </div>
  );
}
