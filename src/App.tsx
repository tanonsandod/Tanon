import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SldEditor } from "./components/sld/SldEditor";
import {
  canOpenSheet,
  findEntrySheet,
  sheetLockedReason,
  sheetTypeLabel,
  SHEET_TYPES,
} from "./lib/sheetWorkflow";
import type {
  BomLineDto,
  DrawingNode,
  PanelDesignNode,
  ProjectSummary,
  ProjectTree,
  SchematicSheetDto,
  SheetNode,
} from "./types";
import "./App.css";

type Selected =
  | { kind: "project"; project: ProjectSummary }
  | { kind: "drawing"; drawing: DrawingNode }
  | { kind: "panel"; panel: PanelDesignNode; drawingNo: string }
  | { kind: "sheet"; panel: PanelDesignNode; drawingNo: string; sheet: SheetNode }
  | null;

function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [tree, setTree] = useState<ProjectTree | null>(null);
  const [bom, setBom] = useState<BomLineDto[]>([]);
  const [selected, setSelected] = useState<Selected>(null);
  const [schematic, setSchematic] = useState<SchematicSheetDto | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refreshTree = useCallback(async () => {
    if (!tree) return;
    const data = await invoke<ProjectTree>("get_project_tree", {
      projectId: tree.project.id,
    });
    setTree(data);
    return data;
  }, [tree]);

  const openSchematic = useCallback(async (sheetId: string) => {
    const data = await invoke<SchematicSheetDto>("get_schematic_sheet", {
      sheetId,
    });
    setSchematic(data);
    return data;
  }, []);

  const handleSldSaved = useCallback(
    async (updated: SchematicSheetDto) => {
      setSchematic(updated);
      const data = await refreshTree();
      if (data && selected?.kind === "sheet") {
        const drawing = data.drawings.find((d) => d.drawingNo === selected.drawingNo);
        const panel = drawing?.panels.find((p) => p.id === selected.panel.id);
        const sheet = panel?.sheets.find((s) => s.id === updated.sheet.id);
        if (panel && sheet) {
          setSelected({ kind: "sheet", panel, drawingNo: selected.drawingNo, sheet });
        }
      }
    },
    [refreshTree, selected],
  );

  const openPanelEntry = useCallback(
    async (panel: PanelDesignNode, drawingNo: string) => {
      const entry = findEntrySheet(panel.sheets);
      if (!entry) {
        setError("Panel นี้ยังไม่มีหน้า Single Line Diagram");
        setSchematic(null);
        setSelected({ kind: "panel", panel, drawingNo });
        return;
      }
      await openSchematic(entry.id);
      setSelected({ kind: "sheet", panel, drawingNo, sheet: entry });
    },
    [openSchematic],
  );

  async function loadProjects() {
    setLoading(true);
    setError("");
    try {
      const list = await invoke<ProjectSummary[]>("list_projects");
      setProjects(list);
      if (list.length > 0) {
        await openProject(list[0].id);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function openProject(projectId: string) {
    setLoading(true);
    setError("");
    try {
      const data = await invoke<ProjectTree>("get_project_tree", { projectId });
      setTree(data);
      setSelected({ kind: "project", project: data.project });
      setSchematic(null);
      setExpanded({
        [data.project.id]: true,
        ...Object.fromEntries(data.drawings.map((d) => [d.id, true])),
      });
      if (data.drawings[0]) {
        await loadBom(data.drawings[0].id);
        const firstPanel = data.drawings[0].panels[0];
        if (firstPanel) {
          await openPanelEntry(firstPanel, data.drawings[0].drawingNo);
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadBom(drawingId: string) {
    const lines = await invoke<BomLineDto[]>("get_drawing_bom", { drawingId });
    setBom(lines);
  }

  async function resetDemo() {
    setLoading(true);
    setError("");
    try {
      await invoke("reset_demo_data");
      await loadProjects();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSheetClick(
    panel: PanelDesignNode,
    drawingNo: string,
    sheet: SheetNode,
  ) {
    const locked = sheetLockedReason(panel.sheets, sheet);
    if (locked) {
      setError(locked);
      const entry = findEntrySheet(panel.sheets);
      if (entry) {
        await openSchematic(entry.id);
        setSelected({ kind: "sheet", panel, drawingNo, sheet: entry });
      }
      return;
    }
    setError("");
    await openSchematic(sheet.id);
    setSelected({ kind: "sheet", panel, drawingNo, sheet });
  }

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const showSld =
    schematic?.sheet.sheetType === SHEET_TYPES.SINGLE_LINE && schematic;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>TANON</h1>
          <p>Electrical Panel Schematic — เริ่มจาก Single Line Diagram</p>
        </div>
        <div className="header-actions">
          <button onClick={loadProjects} disabled={loading}>
            โหลดข้อมูล
          </button>
          <button onClick={resetDemo} disabled={loading} className="secondary">
            รีเซ็ต Demo E22-111
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="workspace workspace-3col">
        <aside className="tree-panel">
          <h2>Project Tree</h2>
          {!tree && (
            <p className="muted">
              กด &quot;โหลดข้อมูล&quot; — schematic จะเปิดที่หน้า Single Line อัตโนมัติ
            </p>
          )}

          {tree && (
            <ul className="tree">
              <li>
                <button
                  className={`tree-btn ${selected?.kind === "project" ? "active" : ""}`}
                  onClick={() => {
                    setSelected({ kind: "project", project: tree.project });
                    setSchematic(null);
                  }}
                >
                  📁 {tree.project.name} ({tree.project.code})
                </button>

                {expanded[tree.project.id] !== false &&
                  tree.drawings.map((drawing) => (
                    <ul key={drawing.id}>
                      <li>
                        <button
                          className="tree-btn caret"
                          onClick={() => toggle(drawing.id)}
                        >
                          {expanded[drawing.id] ? "▾" : "▸"}
                        </button>
                        <button
                          className={`tree-btn ${selected?.kind === "drawing" && selected.drawing.id === drawing.id ? "active" : ""}`}
                          onClick={() => {
                            setSelected({ kind: "drawing", drawing });
                            setSchematic(null);
                            loadBom(drawing.id);
                          }}
                        >
                          📋 {drawing.drawingNo} Rev {drawing.revision}
                        </button>

                        {expanded[drawing.id] &&
                          drawing.panels.map((panel) => (
                            <ul key={panel.id}>
                              <li>
                                <button
                                  className={`tree-btn ${selected?.kind === "panel" && selected.panel.id === panel.id ? "active" : ""}`}
                                  onClick={() => openPanelEntry(panel, drawing.drawingNo)}
                                >
                                  🧩 {panel.panelCode}
                                  {panel.productionQty > 1
                                    ? ` × ${panel.productionQty} set`
                                    : ""}
                                </button>
                                {expanded[panel.id] !== false && (
                                  <ul>
                                    {panel.sheets.map((sheet) => {
                                      const isEntry =
                                        sheet.sheetType === SHEET_TYPES.SINGLE_LINE;
                                      const locked = !canOpenSheet(
                                        panel.sheets,
                                        sheet,
                                      );
                                      const isActive =
                                        selected?.kind === "sheet" &&
                                        selected.sheet.id === sheet.id;
                                      return (
                                        <li key={sheet.id}>
                                          <button
                                            className={`tree-btn leaf-btn ${isActive ? "active" : ""} ${locked ? "locked" : ""}`}
                                            onClick={() =>
                                              handleSheetClick(
                                                panel,
                                                drawing.drawingNo,
                                                sheet,
                                              )
                                            }
                                          >
                                            {isEntry ? "⚡" : "📄"}{" "}
                                            {sheet.displayName}
                                            {isEntry && (
                                              <span className="entry-tag">SLD</span>
                                            )}
                                            {locked && (
                                              <span className="lock-tag">🔒</span>
                                            )}
                                          </button>
                                        </li>
                                      );
                                    })}
                                    {panel.instances.length > 0 && (
                                      <li className="leaf section-label">
                                        Instances:
                                      </li>
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
                          ))}
                      </li>
                    </ul>
                  ))}
              </li>
            </ul>
          )}
        </aside>

        <section className="schematic-panel">
          <h2>Schematic</h2>
          {!schematic && (
            <div className="schematic-placeholder">
              <p>เลือก Panel เพื่อเริ่มออกแบบที่หน้า <strong>Single Line Diagram</strong></p>
            </div>
          )}
          {showSld && (
            <SldEditor
              schematic={schematic}
              onSaved={handleSldSaved}
              onCompleted={handleSldSaved}
              onError={setError}
            />
          )}
          {schematic && !showSld && (
            <div className="schematic-placeholder">
              <p>
                หน้า {sheetTypeLabel(schematic.sheet.sheetType)} — จะเปิดได้หลังออกแบบ
                Single Line เสร็จ
              </p>
            </div>
          )}
        </section>

        <aside className="detail-panel">
          <h2>รายละเอียด</h2>
          {!selected && <p className="muted">เลือกรายการจาก tree</p>}

          {selected?.kind === "sheet" && schematic && (
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
              {schematic.sheet.sheetType === SHEET_TYPES.SINGLE_LINE && (
                <p className="workflow-note">
                  หน้าแรกของ schematic — กำหนด busbar / feeder ก่อนไปหน้า Power หรือ
                  Control
                </p>
              )}
            </div>
          )}

          {selected?.kind === "project" && (
            <div className="card">
              <h3>{selected.project.name}</h3>
              <dl>
                <dt>Code</dt>
                <dd>{selected.project.code}</dd>
                <dt>Customer</dt>
                <dd>{selected.project.customer}</dd>
                <dt>Symbol Standard</dt>
                <dd>{selected.project.symbolStandard.toUpperCase()}</dd>
                <dt>Busbar Standard</dt>
                <dd>{selected.project.busbarRatingStandard}</dd>
              </dl>
            </div>
          )}

          {selected?.kind === "drawing" && (
            <div className="card">
              <h3>
                Drawing {selected.drawing.drawingNo} — Rev {selected.drawing.revision}
              </h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Panel</th>
                    <th>Qty</th>
                    <th>Entry Sheet</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.drawing.panels.map((p) => {
                    const entry = findEntrySheet(p.sheets);
                    return (
                      <tr key={p.id}>
                        <td>{p.panelCode}</td>
                        <td>{p.productionQty}</td>
                        <td>{entry?.displayName ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {selected?.kind === "panel" && (
            <div className="card">
              <h3>
                {selected.panel.panelCode} — {selected.panel.name}
              </h3>
              <p className="workflow-note">
                คลิก panel เพื่อเปิด Single Line Diagram เป็นหน้าแรก
              </p>
              <h4>Busbar</h4>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.panel.busbarSections.map((b) => (
                    <tr key={b.id}>
                      <td>
                        {b.sectionRole}
                        {b.feederTag ? ` (${b.feederTag})` : ""}
                      </td>
                      <td>
                        {b.ratedCurrentA} A — {b.sizeLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {bom.length > 0 && (
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
                  {bom.map((line, i) => (
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
          )}
        </aside>
      </div>

      <footer className="status-bar">
        {loading
          ? "กำลังโหลด..."
          : schematic
            ? `Schematic: ${schematic.sheet.displayName} (${sheetTypeLabel(schematic.sheet.sheetType)})`
            : `Projects: ${projects.length}`}
      </footer>
    </div>
  );
}

export default App;
