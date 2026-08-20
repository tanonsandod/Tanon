import React from "react";
import ReactDOM from "react-dom/client";
import { FluentProvider, webDarkTheme } from "@fluentui/react-components";
import App from "./App";
import { DemoPreview } from "./DemoPreview";

const isPreview = new URLSearchParams(window.location.search).has("preview");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <FluentProvider theme={webDarkTheme}>
      {isPreview ? <DemoPreview /> : <App />}
    </FluentProvider>
  </React.StrictMode>,
);
