import React from "react";
import ReactDOM from "react-dom/client";
import { FluentProvider, webDarkTheme } from "@fluentui/react-components";
import { AppToasterProvider } from "./components/AppToaster";
import App from "./App";
import { DemoPreview } from "./DemoPreview";

const isPreview = new URLSearchParams(window.location.search).has("preview");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <FluentProvider theme={webDarkTheme}>
      <AppToasterProvider>
        {isPreview ? <DemoPreview /> : <App />}
      </AppToasterProvider>
    </FluentProvider>
  </React.StrictMode>,
);
