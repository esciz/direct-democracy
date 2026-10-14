import { createPlaceholderAdapter } from "@/lib/civic-data/adapters/base";

export const arcgisBoundariesAdapter = createPlaceholderAdapter({
  key: "arcgis-boundaries",
  displayName: "ArcGIS district boundary",
});
