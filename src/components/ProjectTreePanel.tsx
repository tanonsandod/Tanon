import {
  Tree,
  TreeItem,
  TreeItemLayout,
  TreeItemPersonaLayout,
  Badge,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  Folder24Regular,
  DocumentBulletList24Regular,
  PanelLeft24Regular,
  Flash24Regular,
  Document24Regular,
  Box24Regular,
} from "@fluentui/react-icons";
import {
  canOpenSheet,
  SHEET_TYPES,
} from "../lib/sheetWorkflow";
import type { ProjectTree, PanelDesignNode, SheetNode } from "../types";

const useStyles = makeStyles({
  root: {
    height: "100%",
    overflow: "auto",
    padding: tokens.spacingHorizontalS,
  },
});

interface ProjectTreePanelProps {
  tree: ProjectTree | null;
  activeSheetId: string | null;
  onSelectProject: () => void;
  onSelectDrawing: (drawingId: string) => void;
  onSelectPanel: (panel: PanelDesignNode, drawingNo: string) => void;
  onSelectSheet: (panel: PanelDesignNode, drawingNo: string, sheet: SheetNode) => void;
}

export function ProjectTreePanel({
  tree,
  activeSheetId,
  onSelectProject,
  onSelectDrawing,
  onSelectPanel,
  onSelectSheet,
}: ProjectTreePanelProps) {
  const styles = useStyles();

  if (!tree) {
    return (
      <div className={styles.root}>
        <p style={{ color: tokens.colorNeutralForeground3, fontSize: 13 }}>
          กำลังเชื่อมต่อ…
        </p>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Tree aria-label="Project tree" defaultOpenItems={[tree.project.id]}>
        <TreeItem itemType="branch" value={tree.project.id}>
          <TreeItemLayout
            iconBefore={<Folder24Regular />}
            onClick={onSelectProject}
          >
            {tree.project.name}
            {tree.project.code ? ` (${tree.project.code})` : ""}
          </TreeItemLayout>

          <Tree defaultOpenItems={tree.drawings.map((d) => d.id)}>
            {tree.drawings.map((drawing) => (
              <TreeItem key={drawing.id} itemType="branch" value={drawing.id}>
                <TreeItemLayout
                  iconBefore={<DocumentBulletList24Regular />}
                  onClick={() => onSelectDrawing(drawing.id)}
                >
                  {drawing.drawingNo} Rev {drawing.revision}
                </TreeItemLayout>

                <Tree>
                  {drawing.panels.map((panel) => (
                    <TreeItem key={panel.id} itemType="branch" value={panel.id}>
                      <TreeItemLayout
                        iconBefore={<PanelLeft24Regular />}
                        onClick={() => onSelectPanel(panel, drawing.drawingNo)}
                      >
                        {panel.panelCode}
                        {panel.productionQty > 1 ? ` × ${panel.productionQty}` : ""}
                      </TreeItemLayout>

                      <Tree>
                        {panel.sheets.map((sheet) => {
                          const locked = !canOpenSheet(panel.sheets, sheet);
                          const isSld = sheet.sheetType === SHEET_TYPES.SINGLE_LINE;
                          return (
                            <TreeItem key={sheet.id} itemType="leaf" value={sheet.id}>
                              <TreeItemLayout
                                iconBefore={
                                  isSld ? <Flash24Regular /> : <Document24Regular />
                                }
                                onClick={() =>
                                  onSelectSheet(panel, drawing.drawingNo, sheet)
                                }
                                aside={
                                  <span style={{ display: "flex", gap: 4 }}>
                                    {isSld && (
                                      <Badge size="small" appearance="outline" color="warning">
                                        SLD
                                      </Badge>
                                    )}
                                    {locked && (
                                      <Badge size="small" appearance="outline">
                                        🔒
                                      </Badge>
                                    )}
                                    {sheet.id === activeSheetId && (
                                      <Badge size="small" appearance="filled" color="brand">
                                        ●
                                      </Badge>
                                    )}
                                  </span>
                                }
                              >
                                {sheet.displayName}
                              </TreeItemLayout>
                            </TreeItem>
                          );
                        })}
                        {panel.instances.map((inst) => (
                          <TreeItem key={inst.id} itemType="leaf" value={inst.id}>
                            <TreeItemPersonaLayout
                              media={<Box24Regular />}
                              description={inst.serialNo ?? undefined}
                            >
                              {inst.assetTag}
                            </TreeItemPersonaLayout>
                          </TreeItem>
                        ))}
                      </Tree>
                    </TreeItem>
                  ))}
                </Tree>
              </TreeItem>
            ))}
          </Tree>
        </TreeItem>
      </Tree>
    </div>
  );
}
