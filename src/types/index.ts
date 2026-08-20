export interface ProjectSummary {
  id: string;
  name: string;
  code: string | null;
  customer: string | null;
  status: string;
  symbolStandard: string;
  busbarRatingStandard: string;
}

export interface SheetNode {
  id: string;
  sheetNo: string;
  displayName: string;
  title: string | null;
}

export interface PanelInstanceNode {
  id: string;
  instanceNo: number;
  assetTag: string | null;
  serialNo: string | null;
  status: string;
}

export interface BusbarSectionNode {
  id: string;
  sectionRole: string;
  feederTag: string | null;
  sizeLabel: string;
  ratedCurrentA: number;
  icwKa: number | null;
  barsPerPhase: number;
  lengthMm: number;
}

export interface PanelDesignNode {
  id: string;
  panelCode: string;
  name: string | null;
  productionQty: number;
  sheetPrefix: string | null;
  sheets: SheetNode[];
  instances: PanelInstanceNode[];
  busbarSections: BusbarSectionNode[];
}

export interface DrawingNode {
  id: string;
  drawingNo: string;
  title: string | null;
  revision: string;
  status: string;
  panels: PanelDesignNode[];
}

export interface ProjectTree {
  project: ProjectSummary;
  drawings: DrawingNode[];
}

export interface BomLineDto {
  partNumber: string;
  description: string | null;
  panelCode: string;
  qtyPerPanel: number;
  panelQty: number;
  totalQty: number;
  unit: string;
}
