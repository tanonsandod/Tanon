import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Combobox,
  Field,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  Add24Regular,
  ArrowRight24Regular,
  BuildingFactory24Regular,
  Checkmark24Regular,
} from "@fluentui/react-icons";
import { invoke } from "@tauri-apps/api/core";
import type { CatalogItemDto } from "../../types/sld";
import type { SldPaletteItem, SldSymbolType } from "../../types/sld";
import { SLD_PALETTE, symbolTypeLabel } from "../../types/sld";

const useStyles = makeStyles({
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    minWidth: "280px",
  },
  steps: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
  },
  step: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  stepActive: {
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  stepDone: {
    color: tokens.colorPaletteGreenForeground1,
  },
  abbBadge: {
    backgroundColor: "#FF000F",
    color: "white",
    fontWeight: tokens.fontWeightBold,
  },
  productCard: {
    cursor: "pointer",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  productSelected: {
    outline: `2px solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1Selected,
  },
  price: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
});

type FlowStep = 1 | 2 | 3;

interface AbbFluentPanelProps {
  selectedFeederTag: string | null;
  onPlace: (item: CatalogItemDto, symbolType: SldSymbolType) => void;
  disabled?: boolean;
}

function ratingFromJson(json: string | null): string {
  if (!json) return "";
  try {
    const r = JSON.parse(json) as Record<string, string>;
    return r.current ?? r.power ?? r.voltage ?? "";
  } catch {
    return "";
  }
}

function paletteFromSymbolType(sym: string | null): SldSymbolType | null {
  if (!sym) return null;
  if (sym.includes("mccb_ds")) return "mccb_ds";
  if (sym.includes("mccb")) return "mccb";
  if (sym.includes("contactor")) return "contactor";
  if (sym.includes("motor")) return "motor";
  if (sym.includes("fuse")) return "fuse";
  if (sym.includes("transformer")) return "transformer";
  if (sym.includes("load")) return "load";
  return null;
}

export function AbbFluentPanel({
  selectedFeederTag,
  onPlace,
  disabled,
}: AbbFluentPanelProps) {
  const styles = useStyles();
  const [step, setStep] = useState<FlowStep>(1);
  const [symbolType, setSymbolType] = useState<SldSymbolType | null>(null);
  const [catalog, setCatalog] = useState<CatalogItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CatalogItemDto | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!selectedFeederTag) {
      setStep(1);
      setSymbolType(null);
      setSelected(null);
    } else if (step === 1) {
      setStep(2);
    }
  }, [selectedFeederTag, step]);

  useEffect(() => {
    if (!symbolType) {
      setCatalog([]);
      return;
    }
    setLoading(true);
    invoke<CatalogItemDto[]>("list_catalog_items", {
      manufacturer: "ABB",
      symbolType,
    })
      .then(setCatalog)
      .catch(() => setCatalog([]))
      .finally(() => setLoading(false));
  }, [symbolType]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (c) =>
        c.partNumber.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false),
    );
  }, [catalog, search]);

  function pickType(item: SldPaletteItem) {
    setSymbolType(item.symbolType);
    setSelected(null);
    setStep(3);
  }

  function confirmPlace() {
    if (!selected || !symbolType) return;
    onPlace(selected, symbolType);
    setSelected(null);
    setSearch("");
    setStep(2);
  }

  return (
    <div className={styles.panel}>
      <CardHeader
        header={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BuildingFactory24Regular />
            <Text weight="semibold">ABB Catalog</Text>
            <Badge appearance="filled" className={styles.abbBadge} size="small">
              ABB
            </Badge>
          </div>
        }
        description="Fluent flow — เลือกอุปกรณ์ ABB วางบน Single Line"
      />

      <div className={styles.steps}>
        <span className={`${styles.step} ${selectedFeederTag ? styles.stepDone : styles.stepActive}`}>
          {selectedFeederTag ? <Checkmark24Regular /> : "①"}
          Feeder {selectedFeederTag ?? "—"}
        </span>
        <ArrowRight24Regular />
        <span className={`${styles.step} ${step >= 2 ? (symbolType ? styles.stepDone : styles.stepActive) : ""}`}>
          {symbolType ? <Checkmark24Regular /> : "②"}
          ประเภท
        </span>
        <ArrowRight24Regular />
        <span className={`${styles.step} ${step >= 3 ? styles.stepActive : ""}`}>
          ③ รุ่น ABB
        </span>
      </div>

      {!selectedFeederTag && (
        <MessageBar intent="warning">
          <MessageBarBody>เลือก Feeder บนแผนผังก่อน (คลิก F1, F2…)</MessageBarBody>
        </MessageBar>
      )}

      {selectedFeederTag && step >= 2 && (
        <>
          <Text size={200} weight="semibold">
            ② เลือกประเภทอุปกรณ์
          </Text>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SLD_PALETTE.filter((p) =>
              ["mccb", "mccb_ds", "contactor", "motor", "fuse"].includes(p.symbolType),
            ).map((item) => (
              <Button
                key={item.symbolType}
                appearance={symbolType === item.symbolType ? "primary" : "secondary"}
                size="small"
                disabled={disabled}
                onClick={() => pickType(item)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </>
      )}

      {symbolType && step >= 3 && (
        <>
          <Field label={`③ ค้นหา ABB ${symbolTypeLabel(symbolType)}`}>
            <Combobox
              placeholder="พิมพ์ part no. หรือรุ่น…"
              value={search}
              onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
              onOptionSelect={(_, data) => {
                const item = catalog.find((c) => c.id === data.optionValue);
                if (item) setSelected(item);
              }}
            >
              {filtered.map((c) => (
                <Option key={c.id} value={c.id} text={c.partNumber}>
                  {c.partNumber} — {c.description}
                </Option>
              ))}
            </Combobox>
          </Field>

          {loading && <Spinner size="tiny" label="โหลด ABB catalog…" />}

          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflow: "auto" }}>
            {filtered.map((c) => {
              const sym = paletteFromSymbolType(c.symbolType);
              if (!sym) return null;
              return (
                <Card
                  key={c.id}
                  className={`${styles.productCard} ${selected?.id === c.id ? styles.productSelected : ""}`}
                  onClick={() => setSelected(c)}
                >
                  <Text weight="semibold" size={300}>
                    {c.partNumber}
                  </Text>
                  <Text size={200}>{c.description}</Text>
                  <Text className={styles.price}>
                    {ratingFromJson(c.ratingJson)}
                    {c.listPrice != null ? ` · ฿${c.listPrice.toLocaleString()}` : ""}
                  </Text>
                </Card>
              );
            })}
          </div>

          <Button
            appearance="primary"
            icon={<Add24Regular />}
            disabled={!selected || disabled}
            onClick={confirmPlace}
          >
            วาง {selected?.partNumber ?? "…"} บน {selectedFeederTag}
          </Button>
        </>
      )}
    </div>
  );
}
