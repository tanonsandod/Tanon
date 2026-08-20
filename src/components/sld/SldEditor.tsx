import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SchematicSheetDto } from "../../types";
import type {
  SldContent,
  SldDevice,
  SldFeeder,
  SldPaletteItem,
  SldSymbolType,
} from "../../types/sld";
import { SLD_PALETTE, symbolTypeLabel } from "../../types/sld";
import { SldSymbol } from "./SldSymbols";

const W = 960;
const H = 560;
const GRID = 20;
const BUS_Y = 110;
const BUS_X1 = 80;
const BUS_X2 = W - 80;
const DEVICE_GAP = 68;
const FEEDER_TOP = 200;

interface SldEditorProps {
  schematic: SchematicSheetDto;
  onSaved: (updated: SchematicSheetDto) => void;
  onCompleted: (updated: SchematicSheetDto) => void;
  onError: (msg: string) => void;
}

function feederX(index: number, total: number): number {
  if (total === 0) return (BUS_X1 + BUS_X2) / 2;
  return BUS_X1 + ((index + 1) * (BUS_X2 - BUS_X1)) / (total + 1);
}

function nextTag(feeders: SldFeeder[], prefix: string): string {
  const nums = feeders
    .flatMap((f) => f.devices)
    .map((d) => d.tag)
    .filter((t) => t.startsWith(prefix))
    .map((t) => parseInt(t.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${next}`;
}

function newId(): string {
  return `dev-${crypto.randomUUID().slice(0, 8)}`;
}

export function SldEditor({
  schematic,
  onSaved,
  onCompleted,
  onError,
}: SldEditorProps) {
  const [content, setContent] = useState<SldContent>(schematic.sldContent);
  const [selectedFeederId, setSelectedFeederId] = useState<string | null>(
    schematic.sldContent.feeders[0]?.id ?? null,
  );
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [paletteItem, setPaletteItem] = useState<SldPaletteItem | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setContent(schematic.sldContent);
    setSelectedFeederId(schematic.sldContent.feeders[0]?.id ?? null);
    setSelectedDeviceId(null);
  }, [schematic]);

  const main = schematic.busbarSections.find((b) => b.sectionRole === "main");
  const feeders = content.feeders;

  const selectedFeeder = feeders.find((f) => f.id === selectedFeederId);
  const selectedDevice = selectedFeeder?.devices.find((d) => d.id === selectedDeviceId);

  const addDevice = useCallback(
    (symbolType: SldSymbolType, palette: SldPaletteItem) => {
      if (!selectedFeederId) {
        onError("เลือก Feeder ก่อนเพิ่มอุปกรณ์");
        return;
      }
      setContent((prev) => ({
        ...prev,
        feeders: prev.feeders.map((f) => {
          if (f.id !== selectedFeederId) return f;
          const tag = nextTag(prev.feeders, palette.defaultTagPrefix);
          const device: SldDevice = {
            id: newId(),
            symbolType,
            tag,
            rating: "",
          };
          return { ...f, devices: [...f.devices, device] };
        }),
      }));
      setPaletteItem(null);
    },
    [selectedFeederId, onError],
  );

  const removeDevice = (feederId: string, deviceId: string) => {
    setContent((prev) => ({
      ...prev,
      feeders: prev.feeders.map((f) =>
        f.id === feederId
          ? { ...f, devices: f.devices.filter((d) => d.id !== deviceId) }
          : f,
      ),
    }));
    if (selectedDeviceId === deviceId) setSelectedDeviceId(null);
  };

  const updateDevice = (
    feederId: string,
    deviceId: string,
    patch: Partial<SldDevice>,
  ) => {
    setContent((prev) => ({
      ...prev,
      feeders: prev.feeders.map((f) =>
        f.id === feederId
          ? {
              ...f,
              devices: f.devices.map((d) =>
                d.id === deviceId ? { ...d, ...patch } : d,
              ),
            }
          : f,
      ),
    }));
  };

  const addFeeder = () => {
    const n = feeders.length + 1;
    const feeder: SldFeeder = {
      id: newId(),
      tag: `F${n}`,
      devices: [],
    };
    setContent((prev) => ({ ...prev, feeders: [...prev.feeders, feeder] }));
    setSelectedFeederId(feeder.id);
  };

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await invoke<SchematicSheetDto>("save_sld_content", {
        sheetId: schematic.sheet.id,
        content,
      });
      onSaved(updated);
    } catch (e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    setSaving(true);
    try {
      await invoke<SchematicSheetDto>("save_sld_content", {
        sheetId: schematic.sheet.id,
        content,
      });
      const updated = await invoke<SchematicSheetDto>("complete_sld", {
        sheetId: schematic.sheet.id,
      });
      onCompleted(updated);
    } catch (e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const status = schematic.sheet.schematicStatus;

  return (
    <div className="sld-editor">
      <div className="sld-toolbar">
        <span className="sld-badge">Single Line Diagram</span>
        <span>
          {schematic.panelCode} — {schematic.sheet.displayName}
        </span>
        <span className={`status-chip status-${status}`}>{status}</span>
        <div className="sld-toolbar-spacer" />
        <button type="button" className="secondary" onClick={addFeeder}>
          + Feeder
        </button>
        <button type="button" onClick={handleSave} disabled={saving}>
          บันทึก
        </button>
        <button
          type="button"
          className="primary-complete"
          onClick={handleComplete}
          disabled={saving || status === "complete"}
        >
          เสร็จ SLD
        </button>
      </div>

      <div className="sld-palette">
        <span className="palette-label">เพิ่มอุปกรณ์ →</span>
        {SLD_PALETTE.map((item) => (
          <button
            key={item.symbolType}
            type="button"
            className={`palette-btn ${paletteItem?.symbolType === item.symbolType ? "active" : ""}`}
            title={item.labelTh}
            onClick={() => {
              setPaletteItem(item);
              addDevice(item.symbolType, item);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <svg
        className="sld-canvas"
        viewBox={`0 0 ${W} ${H}`}
        onClick={() => {
          setSelectedDeviceId(null);
        }}
      >
        <defs>
          <pattern id="sld-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
            <path
              d={`M ${GRID} 0 L 0 0 0 ${GRID}`}
              fill="none"
              stroke="#2a3140"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#sld-grid)" />
        <rect width={W} height={H} fill="#1a1d23" fillOpacity={0.55} />

        {/* Incoming */}
        <g>
          <line
            x1={(BUS_X1 + BUS_X2) / 2}
            y1={36}
            x2={(BUS_X1 + BUS_X2) / 2}
            y2={BUS_Y - 8}
            stroke="#e8eaed"
            strokeWidth={2}
          />
          <polygon
            points={`${(BUS_X1 + BUS_X2) / 2 - 7},${BUS_Y - 8} ${(BUS_X1 + BUS_X2) / 2 + 7},${BUS_Y - 8} ${(BUS_X1 + BUS_X2) / 2},${BUS_Y}`}
            fill="#e8eaed"
          />
          <text
            x={(BUS_X1 + BUS_X2) / 2}
            y={24}
            textAnchor="middle"
            fill="#9aa3b2"
            fontSize={11}
          >
            {content.incomingLabel ?? "Incoming"}
          </text>
          {content.incomingVoltage && (
            <text
              x={(BUS_X1 + BUS_X2) / 2}
              y={52}
              textAnchor="middle"
              fill="#6b7280"
              fontSize={9}
            >
              {content.incomingVoltage}
            </text>
          )}
        </g>

        {/* Main bus */}
        <line
          x1={BUS_X1}
          y1={BUS_Y}
          x2={BUS_X2}
          y2={BUS_Y}
          stroke="#f59e0b"
          strokeWidth={7}
          strokeLinecap="square"
        />
        {main && (
          <text x={BUS_X1} y={BUS_Y - 12} fill="#fbbf24" fontSize={11}>
            MAIN BUS {main.sizeLabel} ×{main.barsPerPhase} — {main.ratedCurrentA}A
          </text>
        )}

        {/* Feeders */}
        {feeders.map((feeder, fi) => {
          const x = feederX(fi, feeders.length);
          const isSelected = feeder.id === selectedFeederId;
          return (
            <g key={feeder.id}>
              <line
                x1={x}
                y1={BUS_Y}
                x2={x}
                y2={FEEDER_TOP - 10}
                stroke={isSelected ? "#7cb8ff" : "#5a6a80"}
                strokeWidth={isSelected ? 2.5 : 2}
              />
              <g
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFeederId(feeder.id);
                  setSelectedDeviceId(null);
                }}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={x - 28}
                  y={BUS_Y + 6}
                  width={56}
                  height={22}
                  fill={isSelected ? "#2d3f5e" : "#252a33"}
                  stroke={isSelected ? "#7cb8ff" : "#4a5366"}
                  rx={3}
                />
                <text
                  x={x}
                  y={BUS_Y + 21}
                  textAnchor="middle"
                  fill="#e8eaed"
                  fontSize={10}
                  fontWeight="bold"
                >
                  {feeder.tag}
                  {feeder.ratedCurrentA ? ` ${feeder.ratedCurrentA}A` : ""}
                </text>
              </g>

              {feeder.devices.map((device, di) => {
                const dy = FEEDER_TOP + di * DEVICE_GAP;
                return (
                  <g key={device.id}>
                    <line
                      x1={x}
                      y1={di === 0 ? FEEDER_TOP - 10 : FEEDER_TOP + (di - 1) * DEVICE_GAP + BOX_H()}
                      x2={x}
                      y2={dy}
                      stroke="#5a6a80"
                      strokeWidth={1.5}
                    />
                    <SldSymbol
                      symbolType={device.symbolType}
                      x={x}
                      y={dy}
                      tag={device.tag}
                      rating={device.rating}
                      selected={device.id === selectedDeviceId}
                      onClick={() => {
                        setSelectedFeederId(feeder.id);
                        setSelectedDeviceId(device.id);
                      }}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {selectedDevice && selectedFeeder && (
        <div className="sld-props">
          <strong>
            {symbolTypeLabel(selectedDevice.symbolType)} — {selectedDevice.tag}
          </strong>
          <label>
            Tag
            <input
              value={selectedDevice.tag}
              onChange={(e) =>
                updateDevice(selectedFeeder.id, selectedDevice.id, {
                  tag: e.target.value,
                })
              }
            />
          </label>
          <label>
            Rating
            <input
              value={selectedDevice.rating ?? ""}
              placeholder="เช่น 800A, 75kW"
              onChange={(e) =>
                updateDevice(selectedFeeder.id, selectedDevice.id, {
                  rating: e.target.value,
                })
              }
            />
          </label>
          <button
            type="button"
            className="danger"
            onClick={() => removeDevice(selectedFeeder.id, selectedDevice.id)}
          >
            ลบอุปกรณ์
          </button>
        </div>
      )}

      <p className="sld-hint">
        1) เลือก Feeder → 2) กดสัญลักษณ์เพื่อเพิ่มอุปกรณ์ → 3) บันทึก → 4) กด
        &quot;เสร็จ SLD&quot; เพื่อไปหน้า Power/Control
      </p>
    </div>
  );
}

function BOX_H() {
  return 52;
}
