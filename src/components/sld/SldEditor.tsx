import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Badge,
  Button,
  Field,
  Input,
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
import { SldGpuCanvas } from "./SldGpuCanvas";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    height: "100%",
    minHeight: 0,
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
    minHeight: 0,
  },
  props: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  hint: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
});

interface SldEditorProps {
  schematic: SchematicSheetDto;
  onSaved: (updated: SchematicSheetDto) => void;
  onCompleted: (updated: SchematicSheetDto) => void;
  onError: (msg: string) => void;
  onNotify?: (title: string, body?: string) => void;
  catalogItems?: CatalogItemDto[];
  previewMode?: boolean;
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
  onNotify,
  catalogItems,
  previewMode,
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
      onNotify?.("วางอุปกรณ์แล้ว", `${item.partNumber} บน ${selectedFeeder?.tag ?? "feeder"}`);
    },
    [selectedFeederId, selectedFeeder?.tag, onError, onNotify],
  );

  const reorderDevices = useCallback((feederId: string, deviceIds: string[]) => {
    setContent((prev) => ({
      ...prev,
      feeders: prev.feeders.map((f) => {
        if (f.id !== feederId) return f;
        const byId = new Map(f.devices.map((d) => [d.id, d]));
        return {
          ...f,
          devices: deviceIds.map((id) => byId.get(id)).filter((d): d is SldDevice => !!d),
        };
      }),
    }));
  }, []);

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
    if (previewMode) {
      onSaved({ ...schematic, sldContent: content });
      onNotify?.("บันทึกแล้ว (preview)");
      return;
    }
    setSaving(true);
    try {
      const updated = await invoke<SchematicSheetDto>("save_sld_content", {
        sheetId: schematic.sheet.id,
        content,
      });
      onSaved(updated);
      onNotify?.("บันทึก SLD แล้ว", schematic.sheet.displayName);
    } catch (e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    if (previewMode) {
      onCompleted({
        ...schematic,
        sldContent: content,
        sheet: { ...schematic.sheet, schematicStatus: "complete" },
      });
      onNotify?.("เสร็จ SLD", "หน้า Power/Control ปลดล็อกแล้ว");
      return;
    }
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
      onNotify?.("เสร็จ SLD", "หน้า Power/Control ปลดล็อกแล้ว");
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
        <span className={styles.hint}>GPU Canvas</span>
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
          <SldGpuCanvas
            content={content}
            busbarMain={main}
            selectedFeederId={selectedFeederId}
            selectedDeviceId={selectedDeviceId}
            onSelectFeeder={setSelectedFeederId}
            onSelectDevice={(feederId, deviceId) => {
              setSelectedFeederId(feederId);
              setSelectedDeviceId(deviceId);
            }}
            onClearSelection={() => setSelectedDeviceId(null)}
            onReorderDevices={reorderDevices}
          />

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
          catalogItems={catalogItems}
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
      </div>
      <Field label="Tag">
        <Input
          value={device.tag}
          onChange={(_, d) => onUpdate({ tag: d.value })}
          size="small"
        />
      </Field>
      <Field label="Rating">
        <Input
          value={device.rating ?? ""}
          onChange={(_, d) => onUpdate({ rating: d.value })}
          size="small"
        />
      </Field>
      <Button appearance="secondary" onClick={onRemove}>
        ลบ
      </Button>
    </>
  );
}
