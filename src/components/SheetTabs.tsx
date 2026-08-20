import {
  Tab,
  TabList,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  Flash24Regular,
  Document24Regular,
  LockClosed16Regular,
} from "@fluentui/react-icons";
import {
  canOpenSheet,
  sheetLockedReason,
  sheetTypeLabel,
  SHEET_TYPES,
} from "../lib/sheetWorkflow";
import type { PanelDesignNode, SheetNode } from "../types";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    marginBottom: tokens.spacingVerticalS,
  },
  tab: {
    minHeight: "36px",
  },
});

interface SheetTabsProps {
  panel: PanelDesignNode;
  activeSheetId: string | null;
  onSelectSheet: (sheet: SheetNode) => void;
  onLockedSheet: (reason: string) => void;
}

export function SheetTabs({
  panel,
  activeSheetId,
  onSelectSheet,
  onLockedSheet,
}: SheetTabsProps) {
  const styles = useStyles();
  const sheets = [...panel.sheets].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <TabList
      className={styles.root}
      selectedValue={activeSheetId ?? undefined}
      onTabSelect={(_, data) => {
        const sheet = sheets.find((s) => s.id === data.value);
        if (!sheet) return;
        const locked = sheetLockedReason(panel.sheets, sheet);
        if (locked) {
          onLockedSheet(locked);
          return;
        }
        onSelectSheet(sheet);
      }}
      size="small"
    >
      {sheets.map((sheet) => {
        const locked = !canOpenSheet(panel.sheets, sheet);
        const isSld = sheet.sheetType === SHEET_TYPES.SINGLE_LINE;
        const icon = locked ? (
          <LockClosed16Regular />
        ) : isSld ? (
          <Flash24Regular />
        ) : (
          <Document24Regular />
        );
        const label = `${sheet.sheetNo} ${sheetTypeLabel(sheet.sheetType).replace(" Diagram", "").replace(" Circuit", "")}`;
        return (
          <Tab
            key={sheet.id}
            value={sheet.id}
            icon={icon}
            className={styles.tab}
            disabled={locked}
          >
            {label}
            {sheet.schematicStatus === "complete" ? " ✓" : ""}
          </Tab>
        );
      })}
    </TabList>
  );
}
