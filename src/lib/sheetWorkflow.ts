import type { BusbarSectionNode, SheetNode } from "../types";

/** Schematic workflow: every panel must start on the Single Line Diagram sheet. */
export const SHEET_TYPES = {
  SINGLE_LINE: "single_line",
  POWER: "power",
  CONTROL: "control",
  TERMINAL: "terminal",
  INDEX: "index",
  DETAIL: "detail",
} as const;

export type SheetType = (typeof SHEET_TYPES)[keyof typeof SHEET_TYPES];

export function findEntrySheet(sheets: SheetNode[]): SheetNode | undefined {
  return (
    sheets.find((s) => s.sheetType === SHEET_TYPES.SINGLE_LINE) ??
    [...sheets].sort((a, b) => a.sortOrder - b.sortOrder)[0]
  );
}

export function canOpenSheet(sheets: SheetNode[], target: SheetNode): boolean {
  if (target.sheetType === SHEET_TYPES.SINGLE_LINE) return true;
  const sld = findEntrySheet(sheets);
  if (!sld) return false;
  return sld.schematicStatus === "complete";
}

export function sheetTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    single_line: "Single Line Diagram",
    power: "Power Circuit",
    control: "Control Circuit",
    terminal: "Terminal Schedule",
    index: "Drawing Index",
    detail: "Detail",
  };
  return labels[type] ?? type;
}

export function sheetLockedReason(
  sheets: SheetNode[],
  target: SheetNode,
): string | null {
  if (canOpenSheet(sheets, target)) return null;
  const sld = findEntrySheet(sheets);
  return sld
    ? `ต้องออกแบบ ${sld.displayName} (Single Line) ก่อน`
    : "ต้องสร้างหน้า Single Line Diagram ก่อน";
}

export function isBusbarOnSingleLine(section: BusbarSectionNode): boolean {
  return section.sectionRole === "main" || section.sectionRole === "feeder";
}
