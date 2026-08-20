/** SLD canvas layout — shared between Konva GPU renderer and persistence */

export const SLD_LAYOUT = {
  W: 960,
  H: 560,
  GRID: 20,
  BUS_Y: 110,
  BUS_X1: 80,
  BUS_X2: 880,
  DEVICE_GAP: 68,
  FEEDER_TOP: 200,
  BOX_W: 44,
  BOX_H: 52,
} as const;

export function snapToGrid(value: number, grid: number = SLD_LAYOUT.GRID): number {
  return Math.round(value / grid) * grid;
}

export function feederX(index: number, total: number): number {
  const { BUS_X1, BUS_X2 } = SLD_LAYOUT;
  if (total === 0) return (BUS_X1 + BUS_X2) / 2;
  return BUS_X1 + ((index + 1) * (BUS_X2 - BUS_X1)) / (total + 1);
}

export function deviceRowY(row: number): number {
  return SLD_LAYOUT.FEEDER_TOP + row * SLD_LAYOUT.DEVICE_GAP;
}

export function rowFromY(y: number): number {
  const row = Math.round((y - SLD_LAYOUT.FEEDER_TOP) / SLD_LAYOUT.DEVICE_GAP);
  return Math.max(0, row);
}

export function clampZoom(scale: number): number {
  return Math.min(3, Math.max(0.35, scale));
}
