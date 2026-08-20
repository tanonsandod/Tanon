import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
} from "@fluentui/react-components";

export interface DatabaseConfigDto {
  host: string;
  port: number;
  database: string;
  username: string;
  passwordSet: boolean;
  urlOverride: boolean;
}

export interface DatabaseStatusDto {
  connected: boolean;
  serverVersion: string | null;
  projectCount: number | null;
  error: string | null;
}

interface DatabaseSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}

export function DatabaseSettings({
  open,
  onOpenChange,
  onConnected,
}: DatabaseSettingsProps) {
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("tanon");
  const [username, setUsername] = useState("tanon");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<DatabaseStatusDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await invoke<DatabaseConfigDto>("get_database_config");
      setHost(cfg.host);
      setPort(String(cfg.port));
      setDatabase(cfg.database);
      setUsername(cfg.username);
      if (!cfg.passwordSet) setPassword("");
    } catch {
      /* preview mode */
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await invoke<DatabaseStatusDto>("get_database_status");
      setStatus(s);
    } catch (e) {
      setStatus({ connected: false, serverVersion: null, projectCount: null, error: String(e) });
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadConfig();
      refreshStatus();
      setMessage("");
    }
  }, [open, loadConfig, refreshStatus]);

  async function handleTest() {
    setLoading(true);
    setMessage("");
    try {
      const s = await invoke<DatabaseStatusDto>("test_database_connection", {
        input: {
          host,
          port: Number(port),
          database,
          username,
          password: password || null,
        },
      });
      setStatus(s);
      setMessage(s.connected ? "เชื่อมต่อสำเร็จ" : (s.error ?? "เชื่อมต่อไม่ได้"));
    } catch (e) {
      setMessage(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setLoading(true);
    setMessage("");
    try {
      const s = await invoke<DatabaseStatusDto>("save_database_config", {
        input: {
          host,
          port: Number(port),
          database,
          username,
          password: password || null,
        },
      });
      setStatus(s);
      setMessage("บันทึกแล้ว — รีสตาร์ทแอปเพื่อใช้การตั้งค่าใหม่");
      if (s.connected) onConnected?.();
    } catch (e) {
      setMessage(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>ตั้งค่า Database Server กลาง</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, color: "#9aa3b2", fontSize: 13 }}>
              Tanon.exe รันบน Windows แต่ละเครื่อง — ต่อ PostgreSQL กลางเท่านั้น (ไม่มี app server)
            </p>

            {status?.connected && (
              <MessageBar intent="success">
                <MessageBarBody>
                  เชื่อมต่อแล้ว
                  {status.serverVersion ? ` — ${status.serverVersion.split(" ")[0]}` : ""}
                  {status.projectCount != null ? ` · Projects: ${status.projectCount}` : ""}
                </MessageBarBody>
              </MessageBar>
            )}

            {status && !status.connected && status.error && (
              <MessageBar intent="error">
                <MessageBarBody>{status.error}</MessageBarBody>
              </MessageBar>
            )}

            <Field label="Host / IP">
              <Input value={host} onChange={(_, d) => setHost(d.value)} />
            </Field>
            <Field label="Port">
              <Input value={port} onChange={(_, d) => setPort(d.value)} />
            </Field>
            <Field label="Database">
              <Input value={database} onChange={(_, d) => setDatabase(d.value)} />
            </Field>
            <Field label="Username">
              <Input value={username} onChange={(_, d) => setUsername(d.value)} />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                placeholder="เว้นว่างถ้าไม่เปลี่ยน"
                onChange={(_, d) => setPassword(d.value)}
              />
            </Field>

            {message && <MessageBar intent="info"><MessageBarBody>{message}</MessageBarBody></MessageBar>}
          </DialogContent>
          <DialogActions>
            {loading && <Spinner size="tiny" />}
            <Button appearance="secondary" onClick={handleTest} disabled={loading}>
              ทดสอบ
            </Button>
            <Button appearance="primary" onClick={handleSave} disabled={loading}>
              บันทึก
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export function DatabaseStatusChip() {
  const [status, setStatus] = useState<DatabaseStatusDto | null>(null);

  useEffect(() => {
    invoke<DatabaseStatusDto>("get_database_status")
      .then(setStatus)
      .catch(() =>
        setStatus({ connected: false, serverVersion: null, projectCount: null, error: "offline" }),
      );
  }, []);

  if (!status) return null;

  return (
    <span
      style={{
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: 6,
        background: status.connected ? "#14532d" : "#5c1f1f",
        color: status.connected ? "#86efac" : "#ffb4b4",
      }}
    >
      DB {status.connected ? "เชื่อมต่อ" : "ไม่เชื่อมต่อ"}
    </span>
  );
}
