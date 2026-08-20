import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  BomLineDto,
  DrawingNode,
  PanelDesignNode,
  ProjectSummary,
  ProjectTree,
} from "./types";
import "./App.css";

type Selected =
  | { kind: "project"; project: ProjectSummary }
  | { kind: "drawing"; drawing: DrawingNode }
  | { kind: "panel"; panel: PanelDesignNode; drawingNo: string }
  | null;

function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [tree, setTree] = useState<ProjectTree | null>(null);
  const [bom, setBom] = useState<BomLineDto[]>([]);
  const [selected, setSelected] = useState<Selected>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      setExpanded({
        [data.project.id]: true,
        ...Object.fromEntries(data.drawings.map((d) => [d.id, true])),
      });
      if (data.drawings[0]) {
        await loadBom(data.drawings[0].id);
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

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>TANON</h1>
          <p>Electrical Panel Schematic &amp; Production</p>
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

      <div className="workspace">
        <aside className="tree-panel">
          <h2>Project Tree</h2>
          {!tree && (
            <p className="muted">
              กด &quot;โหลดข้อมูล&quot; เพื่อดูตัวอย่าง Project E22 → Drawing E22-111
            </p>
          )}

          {tree && (
            <ul className="tree">
              <li>
                <button
                  className={`tree-btn ${selected?.kind === "project" ? "active" : ""}`}
                  onClick={() => {
                    setSelected({ kind: "project", project: tree.project });
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
                                  onClick={() =>
                                    setSelected({
                                      kind: "panel",
                                      panel,
                                      drawingNo: drawing.drawingNo,
                                    })
                                  }
                                >
                                  🧩 {panel.panelCode}
                                  {panel.productionQty > 1
                                    ? ` × ${panel.productionQty} set`
                                    : ""}
                                </button>
                                {expanded[panel.id] !== false && (
                                  <ul>
                                    {panel.sheets.map((sheet) => (
                                      <li key={sheet.id} className="leaf">
                                        📄 {sheet.displayName} — {sheet.title}
                                      </li>
                                    ))}
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

        <main className="detail-panel">
          <h2>รายละเอียด</h2>
          {!selected && <p className="muted">เลือกรายการจาก tree</p>}

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
                <dt>Status</dt>
                <dd>{selected.project.status}</dd>
              </dl>
            </div>
          )}

          {selected?.kind === "drawing" && (
            <div className="card">
              <h3>
                Drawing {selected.drawing.drawingNo} — Rev {selected.drawing.revision}
              </h3>
              <p>{selected.drawing.title}</p>
              <p>Panels: {selected.drawing.panels.length}</p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Panel</th>
                    <th>Qty</th>
                    <th>Sheets</th>
                    <th>Busbar Sections</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.drawing.panels.map((p) => (
                    <tr key={p.id}>
                      <td>{p.panelCode}</td>
                      <td>{p.productionQty}</td>
                      <td>{p.sheets.length}</td>
                      <td>{p.busbarSections.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selected?.kind === "panel" && (
            <div className="card">
              <h3>
                {selected.panel.panelCode} — {selected.panel.name}
              </h3>
              <p>
                Drawing {selected.drawingNo} | Production Qty:{" "}
                <strong>{selected.panel.productionQty}</strong>
              </p>

              <h4>Sheets</h4>
              <ul>
                {selected.panel.sheets.map((s) => (
                  <li key={s.id}>
                    {s.displayName}: {s.title}
                  </li>
                ))}
              </ul>

              <h4>Busbar (DIN EN 61439)</h4>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Size</th>
                    <th>Rating</th>
                    <th>Icw</th>
                    <th>Length</th>
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
                        {b.sizeLabel} ×{b.barsPerPhase}
                      </td>
                      <td>{b.ratedCurrentA} A</td>
                      <td>{b.icwKa ?? "—"} kA</td>
                      <td>{b.lengthMm} mm</td>
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
                    <th>Panel</th>
                    <th>Qty/Panel</th>
                    <th>×Panel Qty</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bom.map((line, i) => (
                    <tr key={i}>
                      <td>
                        <div>{line.partNumber}</div>
                        <small>{line.description}</small>
                      </td>
                      <td>{line.panelCode}</td>
                      <td>
                        {line.qtyPerPanel} {line.unit}
                      </td>
                      <td>{line.panelQty}</td>
                      <td>
                        <strong>
                          {line.totalQty} {line.unit}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      <footer className="status-bar">
        {loading ? "กำลังโหลด..." : `Projects: ${projects.length}`}
      </footer>
    </div>
  );
}

export default App;
