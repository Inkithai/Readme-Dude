import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

/* Social cards resolve og:image against the page, but only if it is absolute —
   under a GitHub-Pages subpath a root-relative URL points at the org root. */
const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
if (ogImage?.content?.startsWith("/")) ogImage.content = new URL(ogImage.content, document.baseURI).href;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
