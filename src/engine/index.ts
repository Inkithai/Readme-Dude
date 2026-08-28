export * from "./compile";
export * from "./escape";
export * from "./inspect";
export * from "./io";
export * from "./schema";
/*
 * `./templates` is deliberately NOT re-exported here.
 *
 * Twelve hand-written presets plus the generated brand table are ~20 kB gzip
 * of *content*, and every editor surface imports this barrel. Imported through
 * it, they land in the boot chunk no matter how the UI is split up, because
 * `templates/index.ts` builds a Map at module scope. So the gallery and the
 * roadmap's prerendered marketing site import `engine/templates` directly, and
 * the editor keeps booting at its Phase 2 size. (Measured: 153 kB → 132 kB
 * gzip on the boot chunk.)
 */
export * from "./validate";
