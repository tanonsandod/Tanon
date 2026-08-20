import { useState } from "react";
import { SldEditor } from "./components/sld/SldEditor";
import {
  canOpenSheet,
  sheetTypeLabel,
  SHEET_TYPES,
} from "./lib/sheetWorkflow";
import type { PanelDesignNode, SchematicSheetDto, SheetNode } from "./types";
import {
  MOCK_ABB_CATALOG,
  MOCK_BOM,
  MOCK_SCHEMATIC,
  MOCK_TREE,
} from "./demo/mockData";
import "./App.css";

/** Static preview — no Tauri backend required. Open with ?preview=1 */
export function DemoPreview() {
  const tree = MOCK_TREE;
  const [schematic, setSchematic] = useState<SchematicSheetDto>(MOCK_SCHEMATIC);
  const [expanded] = useState({
    [tree.project.id]: true,
    [tree.drawings[0].id]: true,
    [tree.drawings[0].panels[0].id]: true,
  });
  const drawing = tree.drawings[0];
  const panel = drawing.panels[0];
  const sheet = panel.sheets[0];

  function noopSave(updated: SchematicSheetDto) {
    setSchematic(updated);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>TANON</h1>
          <p>Electrical Panel Schematic — เริ่มจาก Single Line Diagram</p>
        </div>
        <div className="header-actions">
          <button disabled>โหลดข้อมูล</button>
          <button disabled className="secondary">
            รีเซ็ต Demo E22-111
          </button>
          <span
            style={{
              background: "#3b2f1a",
              color: "#fbbf24",
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            PREVIEW MODE
          </span>
        </div>
      </header>

      <div className="workspace workspace-3col">
        <aside className="tree-panel">
          <h2>Project Tree</h2>
          <ul className="tree">
            <li>
              <button className="tree-btn">📁 {tree.project.name} ({tree.project.code})</button>
              <ul>
                <li>
                  <button className="tree-btn caret">▾</button>
                  <button className="tree-btn">
                    📋 {drawing.drawingNo} Rev {drawing.revision}
                  </button>
                  <ul>
                    {drawing.panels.map((p) => (
                      <PanelTree
                        key={p.id}
                        panel={p}
                        expanded={expanded}
                        activePanelId={panel.id}
                        activeSheetId={sheet.id}
                      />
                    ))}
                  </ul>
                </li>
              </ul>
            </li>
          </ul>
        </aside>

        <section className="schematic-panel">
          <h2>Schematic</h2>
          <SldEditor
            schematic={schematic}
            onSaved={noopSave}
            onCompleted={noopSave}
            onError={() => {}}
            catalogItems={MOCK_ABB_CATALOG}
            previewMode
          />
        </section>

        <aside className="detail-panel">
          <h2>รายละเอียด</h2>
          <div className="card">
            <h3>{schematic.sheet.displayName}</h3>
            <dl>
              <dt>ประเภท</dt>
              <dd>{sheetTypeLabel(schematic.sheet.sheetType)}</dd>
              <dt>Panel</dt>
              <dd>{schematic.panelCode}</dd>
              <dt>Drawing</dt>
              <dd>{schematic.drawingNo}</dd>
              <dt>Status</dt>
              <dd>{schematic.sheet.schematicStatus}</dd>
            </dl>
            <p className="workflow-note">
              หน้าแรกของ schematic — กำหนด busbar / feeder ก่อนไปหน้า Power หรือ Control
            </p>
          </div>

          <div className="card">
            <h3>BOM — Busbar (Mass)</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_BOM.map((line, i) => (
                  <tr key={i}>
                    <td>
                      <div>{line.partNumber}</div>
                      <small>{line.panelCode}</small>
                    </td>
                    <td>
                      {line.totalQty} {line.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </aside>
      </div>

      <footer className="status-bar">
        Schematic: {schematic.sheet.displayName} ({sheetTypeLabel(schematic.sheet.sheetType)})
      </footer>
    </div>
  );
}

function PanelTree({
  panel,
  expanded,
  activePanelId,
  activeSheetId,
}: {
  panel: PanelDesignNode;
  expanded: Record<string, boolean>;
  activePanelId: string;
  activeSheetId: string;
}) {
  const isActivePanel = panel.id === activePanelId;
  return (
    <ul>
      <li>
        <button className={`tree-btn ${isActivePanel ? "active" : ""}`}>
          🧩 {panel.panelCode}
          {panel.productionQty > 1 ? ` × ${panel.productionQty} set` : ""}
        </button>
        {expanded[panel.id] !== false && (
          <ul>
            {panel.sheets.map((s) => (
              <SheetLeaf
                key={s.id}
                sheet={s}
                panel={panel}
                active={s.id === activeSheetId}
              />
            ))}
            {panel.instances.length > 0 && (
              <li className="leaf section-label">Instances:</li>
            )}
            {panel.instances.map((inst) => (
              <li key={inst.id} className="leaf">
                📦 {inst.assetTag} ({inst.serialNo})
              </li>
            ))}
          </ul>
        )}
      </li>
    </ul>
  );
}

function SheetLeaf({
  sheet,
  panel,
  active,
}: {
  sheet: SheetNode;
  panel: PanelDesignNode;
  active: boolean;
}) {
  const isEntry = sheet.sheetType === SHEET_TYPES.SINGLE_LINE;
  const locked = !canOpenSheet(panel.sheets, sheet);
  return (
    <li>
      <button
        className={`tree-btn leaf-btn ${active ? "active" : ""} ${locked ? "locked" : ""}`}
      >
        {isEntry ? "⚡" : "📄"} {sheet.displayName}
        {isEntry && <span className="entry-tag">SLD</span>}
        {locked && <span className="lock-tag">🔒</span>}
      </button>
    </li>
  );
}
