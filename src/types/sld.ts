/** Single Line Diagram content model (stored in panel_sheets.content_json) */

export const SLD_SYMBOL_TYPES = {
  MCCB: "mccb",
  MCCB_DS: "mccb_ds",
  FUSE: "fuse",
  CONTACTOR: "contactor",
  MOTOR: "motor",
  TRANSFORMER: "transformer",
  LOAD: "load",
} as const;

export type SldSymbolType =
  (typeof SLD_SYMBOL_TYPES)[keyof typeof SLD_SYMBOL_TYPES];

export interface SldDevice {
  id: string;
  symbolType: SldSymbolType;
  tag: string;
  rating?: string;
  catalogItemId?: string;
  manufacturer?: string;
  partNumber?: string;
  description?: string;
}

export interface SldContent {
  version: number;
  incomingLabel?: string;
  incomingVoltage?: string;
  manufacturerDefault?: string;
  feeders: SldFeeder[];
}

export interface SldPaletteItem {
  symbolType: SldSymbolType;
  label: string;
  labelTh: string;
  defaultTagPrefix: string;
  iecRef?: string;
}

export const SLD_PALETTE: SldPaletteItem[] = [
  {
    symbolType: SLD_SYMBOL_TYPES.MCCB,
    label: "MCCB",
    labelTh: "เมนเบรกเกอร์",
    defaultTagPrefix: "Q",
    iecRef: "IEC 60617",
  },
  {
    symbolType: SLD_SYMBOL_TYPES.MCCB_DS,
    label: "MCCB + DS",
    labelTh: "MCCB + Isolator",
    defaultTagPrefix: "Q",
  },
  {
    symbolType: SLD_SYMBOL_TYPES.FUSE,
    label: "Fuse",
    labelTh: "ฟิวส์",
    defaultTagPrefix: "F",
  },
  {
    symbolType: SLD_SYMBOL_TYPES.CONTACTOR,
    label: "Contactor",
    labelTh: "คอนแทคเตอร์",
    defaultTagPrefix: "K",
  },
  {
    symbolType: SLD_SYMBOL_TYPES.MOTOR,
    label: "Motor",
    labelTh: "มอเตอร์",
    defaultTagPrefix: "M",
  },
  {
    symbolType: SLD_SYMBOL_TYPES.TRANSFORMER,
    label: "Transformer",
    labelTh: "หม้อแปลง",
    defaultTagPrefix: "T",
  },
  {
    symbolType: SLD_SYMBOL_TYPES.LOAD,
    label: "Load",
    labelTh: "โหลดทั่วไป",
    defaultTagPrefix: "L",
  },
];

export interface SldFeeder {
  id: string;
  busbarSectionId?: string;
  tag: string;
  ratedCurrentA?: number;
  sizeLabel?: string;
  devices: SldDevice[];
}

export interface CatalogItemDto {
  id: string;
  manufacturer: string;
  partNumber: string;
  description: string | null;
  ratingJson: string | null;
  listPrice: number | null;
  categoryCode: string;
  symbolType: string | null;
}

export function emptySldContent(): SldContent {
  return { version: 1, feeders: [], manufacturerDefault: "ABB" };
}

export function symbolTypeLabel(type: SldSymbolType): string {
  return SLD_PALETTE.find((p) => p.symbolType === type)?.label ?? type;
}
