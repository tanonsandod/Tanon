import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Button,
  Card,
  CardHeader,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import {
  ArrowClockwise24Regular,
  Database24Regular,
  FolderOpen24Regular,
} from "@fluentui/react-icons";
import { SldEditor } from "./components/sld/SldEditor";
import { DatabaseSettings, DatabaseStatusChip } from "./components/DatabaseSettings";
import { ProjectTreePanel } from "./components/ProjectTreePanel";
import { SheetTabs } from "./components/SheetTabs";
import { useAppToast } from "./components/AppToaster";
import {
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

const useStyles = makeStyles({
  shell: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  title: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  workspace: {
    display: "grid",
    gridTemplateColumns: "260px 1fr 280px",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  sidebar: {
    borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground2,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },
  sidebarTitle: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  center: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    overflow: "hidden",
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
  },
  detail: {
    borderLeft: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground2,
    overflow: "auto",
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
  },
  placeholder: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: tokens.colorNeutralForeground3,
    textAlign: "center",
    ...shorthands.padding("48px"),
  },
  footer: {
    ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalL),
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  card: {
    marginBottom: tokens.spacingVerticalM,
  },
  workflow: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorBrandForeground1,
  },
});

type Selected =
  | { kind: "project"; project: ProjectSummary }
  | { kind: "drawing"; drawing: DrawingNode }
  | { kind: "panel"; panel: PanelDesignNode; drawingNo: string }
  | { kind: "sheet"; panel: PanelDesignNode; drawingNo: string; sheet: SheetNode }
  | null;

function App() {
  const styles = useStyles();
  const toast = useAppToast();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [tree, setTree] = useState<ProjectTree | null>(null);
  const [bom, setBom] = useState<BomLineDto[]>([]);
  const [selected, setSelected] = useState<Selected>(null);
  const [schematic, setSchematic] = useState<SchematicSheetDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbSettingsOpen, setDbSettingsOpen] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  const notifyError = useCallback(
    (msg: string) => {
      toast.notify("เกิดข้อผิดพลาด", msg, "error");
    },
    [toast],
  );

  const openSchematic = useCallback(async (sheetId: string) => {
    const data = await invoke<SchematicSheetDto>("get_schematic_sheet", {
      sheetId,
    });
    setSchematic(data);
    return data;
  }, []);

  const refreshTree = useCallback(async () => {
    if (!tree) return;
    const data = await invoke<ProjectTree>("get_project_tree", {
      projectId: tree.project.id,
    });
    setTree(data);
    return data;
  }, [tree]);

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
        notifyError("Panel นี้ยังไม่มีหน้า Single Line Diagram");
        setSchematic(null);
        setSelected({ kind: "panel", panel, drawingNo });
        return;
      }
      await openSchematic(entry.id);
      setSelected({ kind: "sheet", panel, drawingNo, sheet: entry });
    },
    [openSchematic, notifyError],
  );

  const loadBom = useCallback(async (drawingId: string) => {
    const lines = await invoke<BomLineDto[]>("get_drawing_bom", { drawingId });
    setBom(lines);
  }, []);

  const openProject = useCallback(
    async (projectId: string) => {
      setLoading(true);
      try {
        const data = await invoke<ProjectTree>("get_project_tree", { projectId });
        setTree(data);
        setSelected({ kind: "project", project: data.project });
        setSchematic(null);
        if (data.drawings[0]) {
          await loadBom(data.drawings[0].id);
          const firstPanel = data.drawings[0].panels[0];
          if (firstPanel) {
            await openPanelEntry(firstPanel, data.drawings[0].drawingNo);
          }
        }
      } catch (e) {
        notifyError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [loadBom, openPanelEntry, notifyError],
  );

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const list = await invoke<ProjectSummary[]>("list_projects");
      setProjects(list);
      if (list.length > 0) {
        await openProject(list[0].id);
        toast.notify("โหลดโปรเจกต์แล้ว", list[0].name, "success");
      }
    } catch (e) {
      notifyError(String(e));
      setDbSettingsOpen(true);
    } finally {
      setLoading(false);
    }
  }, [openProject, notifyError, toast]);

  useEffect(() => {
    if (bootstrapped) return;
    setBootstrapped(true);
    loadProjects();
  }, [bootstrapped, loadProjects]);

  async function resetDemo() {
    setLoading(true);
    try {
      await invoke("reset_demo_data");
      await loadProjects();
      toast.notify("รีเซ็ต Demo แล้ว", "E22-111", "success");
    } catch (e) {
      notifyError(String(e));
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
      toast.notify("Sheet ถูกล็อก", locked, "warning");
      const entry = findEntrySheet(panel.sheets);
      if (entry) {
        await openSchematic(entry.id);
        setSelected({ kind: "sheet", panel, drawingNo, sheet: entry });
      }
      return;
    }
    await openSchematic(sheet.id);
    setSelected({ kind: "sheet", panel, drawingNo, sheet });
  }

  const activePanel =
    selected?.kind === "sheet" || selected?.kind === "panel"
      ? selected.panel
      : null;
  const activeDrawingNo =
    selected?.kind === "sheet" || selected?.kind === "panel"
      ? selected.drawingNo
      : null;
  const activeSheetId = selected?.kind === "sheet" ? selected.sheet.id : null;

  const showSld =
    schematic?.sheet.sheetType === SHEET_TYPES.SINGLE_LINE && schematic;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.title}>
          <Text size={500} weight="semibold">
            TANON
          </Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Electrical Panel Schematic — เริ่มจาก Single Line Diagram
          </Text>
        </div>
        <div className={styles.actions}>
          <DatabaseStatusChip />
          <Button
            appearance="subtle"
            icon={<Database24Regular />}
            onClick={() => setDbSettingsOpen(true)}
          >
            ตั้งค่า DB
          </Button>
          <Button
            appearance="secondary"
            icon={<FolderOpen24Regular />}
            onClick={loadProjects}
            disabled={loading}
          >
            โหลดข้อมูล
          </Button>
          <Button
            appearance="subtle"
            icon={<ArrowClockwise24Regular />}
            onClick={resetDemo}
            disabled={loading}
          >
            รีเซ็ต Demo
          </Button>
          {loading && <Spinner size="tiny" />}
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Project Tree</div>
          <ProjectTreePanel
            tree={tree}
            activeSheetId={activeSheetId}
            onSelectProject={() => {
              if (tree) {
                setSelected({ kind: "project", project: tree.project });
                setSchematic(null);
              }
            }}
            onSelectDrawing={(drawingId) => {
              const drawing = tree?.drawings.find((d) => d.id === drawingId);
              if (drawing) {
                setSelected({ kind: "drawing", drawing });
                setSchematic(null);
                loadBom(drawing.id);
              }
            }}
            onSelectPanel={(panel, drawingNo) => openPanelEntry(panel, drawingNo)}
            onSelectSheet={handleSheetClick}
          />
        </aside>

        <section className={styles.center}>
          {activePanel && activeDrawingNo && (
            <SheetTabs
              panel={activePanel}
              activeSheetId={activeSheetId}
              onSelectSheet={(sheet) =>
                handleSheetClick(activePanel, activeDrawingNo, sheet)
              }
              onLockedSheet={(reason) => toast.notify("Sheet ถูกล็อก", reason, "warning")}
            />
          )}

          {!schematic && !loading && (
            <div className={styles.placeholder}>
              <Text>เลือก Panel เพื่อเริ่มออกแบบที่หน้า Single Line Diagram</Text>
            </div>
          )}

          {loading && !schematic && (
            <div className={styles.placeholder}>
              <Spinner label="กำลังโหลดจาก Database…" />
            </div>
          )}

          {showSld && (
            <SldEditor
              schematic={schematic}
              onSaved={handleSldSaved}
              onCompleted={handleSldSaved}
              onError={notifyError}
              onNotify={(title, body) => toast.notify(title, body, "success")}
            />
          )}

          {schematic && !showSld && (
            <div className={styles.placeholder}>
              <Text>
                หน้า {sheetTypeLabel(schematic.sheet.sheetType)} — จะเปิดได้หลังออกแบบ
                Single Line เสร็จ
              </Text>
            </div>
          )}
        </section>

        <aside className={styles.detail}>
          <Text
            weight="semibold"
            size={200}
            style={{
              color: tokens.colorNeutralForeground3,
              textTransform: "uppercase",
              marginBottom: 12,
              display: "block",
            }}
          >
            รายละเอียด
          </Text>

          {!selected && (
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              เลือกรายการจาก tree
            </Text>
          )}

          {selected?.kind === "sheet" && schematic && (
            <Card className={styles.card}>
              <CardHeader header={<Text weight="semibold">{schematic.sheet.displayName}</Text>} />
              <dl style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 8, margin: 0 }}>
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
                <p className={styles.workflow}>
                  หน้าแรก — กำหนด busbar / feeder ก่อนไปหน้า Power หรือ Control
                </p>
              )}
            </Card>
          )}

          {selected?.kind === "project" && (
            <Card className={styles.card}>
              <CardHeader header={<Text weight="semibold">{selected.project.name}</Text>} />
              <dl style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 8 }}>
                <dt>Customer</dt>
                <dd>{selected.project.customer}</dd>
                <dt>Standard</dt>
                <dd>{selected.project.symbolStandard.toUpperCase()}</dd>
              </dl>
            </Card>
          )}

          {bom.length > 0 && (
            <Card className={styles.card}>
              <CardHeader header={<Text weight="semibold">BOM — Busbar (Mass)</Text>} />
              <Table size="small">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Part</TableHeaderCell>
                    <TableHeaderCell>Total</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bom.map((line, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div>{line.partNumber}</div>
                        <Text size={100}>{line.panelCode}</Text>
                      </TableCell>
                      <TableCell>
                        {line.totalQty} {line.unit}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </aside>
      </div>

      <footer className={styles.footer}>
        {schematic
          ? `Schematic: ${schematic.sheet.displayName} (${sheetTypeLabel(schematic.sheet.sheetType)})`
          : `Projects: ${projects.length}`}
      </footer>

      <DatabaseSettings
        open={dbSettingsOpen}
        onOpenChange={setDbSettingsOpen}
        onConnected={loadProjects}
      />
    </div>
  );
}

export default App;
