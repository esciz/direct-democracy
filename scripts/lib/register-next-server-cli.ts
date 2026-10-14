import { createRequire, registerHooks, type ModuleHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Next resolves `server-only` to its empty marker inside its server build. Plain
 * Node audits need that same server-side mapping, only for this CLI process.
 * Application imports and Next's client-build poison marker remain unchanged.
 * Register before dynamic server imports; keep the returned hook until lazy
 * imports have completed, then call deregister(). Requires Node 22.15+ / 24.
 */
export function installNextServerCliBoundary(): ModuleHooks {
  const entrypoint = process.argv[1];
  const relativeEntrypoint = entrypoint ? path.relative(path.resolve(process.cwd(), "scripts"), path.resolve(entrypoint)) : "..";
  if (!entrypoint || relativeEntrypoint === ".." || relativeEntrypoint.startsWith(`..${path.sep}`) || path.isAbsolute(relativeEntrypoint)) {
    throw new Error("The Next server CLI boundary is restricted to repository scripts.");
  }
  const requireFromProject = createRequire(path.join(process.cwd(), "package.json"));
  const markerUrl = pathToFileURL(requireFromProject.resolve("next/dist/compiled/server-only/empty.js")).href;
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "server-only") return nextResolve(markerUrl, context);
      return nextResolve(specifier, context);
    },
  });
}
