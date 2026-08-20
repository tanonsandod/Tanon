import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Badge,
  Button,
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  Add24Regular,
  Save24Regular,
  Checkmark24Regular,
} from "@fluentui/react-icons";
import type { SchematicSheetDto } from "../../types";
import type {
  CatalogItemDto,
  SldContent,
  SldDevice,
  SldFeeder,
  SldSymbolType,
} from "../../types/sld";
import { symbolTypeLabel } from "../../types/sld";
import { AbbFluentPanel } from "./AbbFluentPanel";
import { SldSymbol } from "./SldSymbols";

const W = 960;
const H = 560;
const GRID = 20;
const BUS_Y = 110;
const BUS_X1 = 80;
const BUS_X2 = W - 80;
const DEVICE_GAP = 68;
const FEEDER_TOP = 200;

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    height: "100%",
  },
  body: {
    display: "flex",
    gap: tokens.spacingHorizontalM,
    flex: 1,
    minHeight: 0,
  },
  canvasArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    minWidth: 0,
  },
  canvas: {
    width: "100%",
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: "#12151a",
  },
  props: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  abbTag: {
    fontSize: "10px",
    fill: "#FF000F",
    fontWeight: 600,
  },
});

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

function ratingFromCatalog(item: CatalogItemDto): string {
  if (!item.ratingJson) return "";
  try {
    const r = JSON.parse(item.ratingJson) as Record<string, string>;
    return r.current ?? r.power ?? "";
  } catch {
    return "";
  }
}

function prefixForSymbol(symbolType: SldSymbolType): string {
  const map: Record<string, string> = {
    mccb: "Q",
    mccb_ds: "Q",
    fuse: "F",
    contactor: "K",
    motor: "M",
    transformer: "T",
    load: "L",
  };
  return map[symbolType] ?? "X";
}

export function SldEditor({
  schematic,
  onSaved,
  onCompleted,
  onError,
}: SldEditorProps) {
  const styles = useStyles();
  const [content, setContent] = useState<SldContent>(schematic.sldContent);
  const [selectedFeederId, setSelectedFeederId] = useState<string | null>(
    schematic.sldContent.feeders[0]?.id ?? null,
  );
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
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
  const status = schematic.sheet.schematicStatus;

  const placeAbbDevice = useCallback(
    (item: CatalogItemDto, symbolType: SldSymbolType) => {
      if (!selectedFeederId) {
        onError("เลือก Feeder ก่อน");
        return;
      }
      const prefix = prefixForSymbol(symbolType);
      setContent((prev) => ({
        ...prev,
        manufacturerDefault: "ABB",
        feeders: prev.feeders.map((f) => {
          if (f.id !== selectedFeederId) return f;
          const device: SldDevice = {
            id: newId(),
            symbolType,
            tag: nextTag(prev.feeders, prefix),
            rating: ratingFromCatalog(item),
            catalogItemId: item.id,
            manufacturer: "ABB",
            partNumber: item.partNumber,
            description: item.description ?? undefined,
          };
          return { ...f, devices: [...f.devices, device] };
        }),
      }));
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

  return (
    <div className={styles.root}>
      <Toolbar>
        <Badge appearance="outline" color="warning">
          Single Line
        </Badge>
        <ToolbarDivider />
        <span style={{ fontSize: 13 }}>
          {schematic.panelCode} — {schematic.sheet.displayName}
        </span>
        <Badge appearance="filled" color={status === "complete" ? "success" : "informative"}>
          {status}
        </Badge>
        <ToolbarDivider />
        <ToolbarButton icon={<Add24Regular />} onClick={addFeeder}>
          Feeder
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton icon={<Save24Regular />} onClick={handleSave} disabled={saving}>
          บันทึก
        </ToolbarButton>
        <ToolbarButton
          icon={<Checkmark24Regular />}
          appearance="primary"
          onClick={handleComplete}
          disabled={saving || status === "complete"}
        >
          เสร็จ SLD
        </ToolbarButton>
      </Toolbar>

      <div className={styles.body}>
        <div className={styles.canvasArea}>
          <svg
            className={styles.canvas}
            viewBox={`0 0 ${W} ${H}`}
            onClick={() => setSelectedDeviceId(null)}
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

            <g>
              <line
                x1={(BUS_X1 + BUS_X2) / 2}
                y1={36}
                x2={(BUS_X1 + BUS_X2) / 2}
                y2={BUS_Y - 8}
                stroke="#e8eaed"
                strokeWidth={2}
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
            </g>

            <line
              x1={BUS_X1}
              y1={BUS_Y}
              x2={BUS_X2}
              y2={BUS_Y}
              stroke="#f59e0b"
              strokeWidth={7}
            />
            {main && (
              <text x={BUS_X1} y={BUS_Y - 12} fill="#fbbf24" fontSize={11}>
                MAIN BUS {main.sizeLabel} — {main.ratedCurrentA}A
              </text>
            )}

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
                    stroke={isSelected ? "#0f6cbd" : "#5a6a80"}
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
                      fill={isSelected ? "#0f6cbd33" : "#252a33"}
                      stroke={isSelected ? "#0f6cbd" : "#4a5366"}
                      rx={4}
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
                    </text>
                  </g>

                  {feeder.devices.map((device, di) => {
                    const dy = FEEDER_TOP + di * DEVICE_GAP;
                    return (
                      <g key={device.id}>
                        <line
                          x1={x}
                          y1={di === 0 ? FEEDER_TOP - 10 : FEEDER_TOP + (di - 1) * DEVICE_GAP + 52}
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
                        {device.manufacturer === "ABB" && (
                          <text x={x + 26} y={dy + 18} className={styles.abbTag}>
                            ABB
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>

          {selectedDevice && selectedFeeder && (
            <div className={styles.props}>
              <DeviceProps
                device={selectedDevice}
                onUpdate={(patch) =>
                  updateDevice(selectedFeeder.id, selectedDevice.id, patch)
                }
                onRemove={() => removeDevice(selectedFeeder.id, selectedDevice.id)}
              />
            </div>
          )}
        </div>

        <AbbFluentPanel
          selectedFeederTag={selectedFeeder?.tag ?? null}
          onPlace={placeAbbDevice}
          disabled={saving}
        />
      </div>
    </div>
  );
}

function DeviceProps({
  device,
  onUpdate,
  onRemove,
}: {
  device: SldDevice;
  onUpdate: (p: Partial<SldDevice>) => void;
  onRemove: () => void;
}) {
  return (
    <>
      <div>
        <strong>
          {symbolTypeLabel(device.symbolType)} — {device.tag}
        </strong>
        {device.manufacturer && (
          <Badge
            appearance="filled"
            style={{ marginLeft: 8, background: "#FF000F", color: "#fff" }}
          >
            {device.manufacturer}
          </Badge>
        )}
        {device.partNumber && (
          <div style={{ fontSize: 12, color: "#9aa3b2", marginTop: 4 }}>
            {device.partNumber}
          </div>
        )}
        {device.description && (
          <div style={{ fontSize: 11, color: "#6b7280" }}>{device.description}</div>
        )}
      </div>
      <label style={{ fontSize: 12 }}>
        Tag
        <input
          value={device.tag}
          onChange={(e) => onUpdate({ tag: e.target.value })}
          style={{ display: "block", marginTop: 4, padding: 4 }}
        />
      </label>
      <label style={{ fontSize: 12 }}>
        Rating
        <input
          value={device.rating ?? ""}
          onChange={(e) => onUpdate({ rating: e.target.value })}
          style={{ display: "block", marginTop: 4, padding: 4 }}
        />
      </label>
      <Button appearance="secondary" onClick={onRemove}>
        ลบ
      </Button>
    </>
  );
}
