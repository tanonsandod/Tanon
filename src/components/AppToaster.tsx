import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  Toaster,
  useId,
  useToastController,
  Toast,
  ToastTitle,
  ToastBody,
} from "@fluentui/react-components";

type ToastIntent = "success" | "error" | "info" | "warning";

interface ToastApi {
  notify: (title: string, body?: string, intent?: ToastIntent) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function AppToasterProvider({ children }: { children: ReactNode }) {
  const toasterId = useId("tanon-toaster");
  const { dispatchToast } = useToastController(toasterId);

  const notify = useCallback(
    (title: string, body?: string, intent: ToastIntent = "info") => {
      dispatchToast(
        <Toast>
          <ToastTitle>{title}</ToastTitle>
          {body ? <ToastBody>{body}</ToastBody> : null}
        </Toast>,
        { intent, timeout: intent === "error" ? 8000 : 4000 },
      );
    },
    [dispatchToast],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasterId={toasterId} />
    </ToastContext.Provider>
  );
}

export function useAppToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      notify: () => {},
    };
  }
  return ctx;
}
