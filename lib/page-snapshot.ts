import { cache } from "react";
import { loadPublishedSnapshot } from "./snapshot";

// Metadata and the page share one bounded Blob read within a server render.
export const loadPageSnapshot = cache(loadPublishedSnapshot);
