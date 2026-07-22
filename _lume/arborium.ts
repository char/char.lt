import {
  extractLanguageFromClass,
  getConfig,
  highlight,
  normalizeLanguage,
  setConfig,
} from "@arborium/arborium";

import { log } from "@lume/utils/log.ts";

// arborium's built-in resolvers call `import()`/`fetch()` from inside the npm
// package; under Deno that routes through the Node-compat ESM loader, which
// rejects `https://` specifiers. Override them with closures defined in this
// (Deno-native) module so the dynamic import uses Deno's loader.
//
// `import()` results are cached by Deno, but `fetch()` is not, and each
// grammar's wasm is 2-4 MB fetched from jsdelivr on every build. Cache wasm
// on disk; URLs embed the arborium version, so upgrades invalidate naturally.
const wasmCacheDir = new URL("./.arborium-cache/", import.meta.url);

const wasmHeaders = { "Content-Type": "application/wasm" };

async function cachedFetch(url: string): Promise<Response> {
  const key = new URL(url).pathname.split("/").slice(-2).join("_");
  const cachePath = new URL(key, wasmCacheDir);
  try {
    return new Response(await Deno.readFile(cachePath), { headers: wasmHeaders });
  } catch { /* not cached yet */ }

  const res = await fetch(url);
  if (!res.ok) return res;
  const body = new Uint8Array(await res.arrayBuffer());
  await Deno.mkdir(wasmCacheDir, { recursive: true });
  await Deno.writeFile(cachePath, body);
  return new Response(body, { headers: wasmHeaders });
}

setConfig({
  resolveJs: ({ baseUrl, path }) => import(`${baseUrl}/${path}`),
  resolveWasm: ({ baseUrl, path }) => cachedFetch(`${baseUrl}/${path}`),
  resolveHostJs: ({ baseUrl, path }) => import(`${baseUrl}/${path}`),
  resolveHostWasm: ({ baseUrl, path }) => cachedFetch(`${baseUrl}/${path}`),
});

// Highlighted snippets keyed by hash of (language, source), so a rebuild
// doesn't touch arborium at all unless a code block actually changed. The
// cache is stamped with the arborium version + theme and discarded on
// mismatch, since both affect the emitted HTML.
//
// Each build writes back only the snippets it actually used, so entries for
// deleted/edited code blocks are dropped automatically. The in-memory read
// map keeps everything loaded from disk plus fresh highlights for the
// process lifetime, so watch-mode rebuilds never re-highlight.
interface SnippetCache {
  version: string;
  entries: Record<string, string>;
}

const snippetsPath = new URL("snippets.json", wasmCacheDir);
let cacheVersion = "";
let readCache: Record<string, string> | null = null;
let persistedCount = 0;
let snippetsDirty = false;

async function loadSnippets(): Promise<Record<string, string>> {
  if (readCache) return readCache;
  const { version, theme } = getConfig();
  cacheVersion = `${version}:${theme}`;
  try {
    const parsed: SnippetCache = JSON.parse(await Deno.readTextFile(snippetsPath));
    readCache = parsed.version === cacheVersion ? parsed.entries : {};
  } catch {
    readCache = {};
  }
  persistedCount = Object.keys(readCache).length;
  return readCache;
}

async function digest(text: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface Options {
  /** extensions of pages to process. */
  extensions?: string[];
  /** highlightable code block css selector */
  cssSelector?: string;
}

export const defaults: Required<Pick<Options, "extensions" | "cssSelector">> = {
  extensions: [".html"],
  // The plugin tags every block it processes with `.arborium`, and posts that
  // ship pre-rendered markup carry the same class so they're left alone.
  cssSelector: "pre code:not(.arborium)",
};

export default function arborium(userOptions: Options = {}) {
  const options = { ...defaults, ...userOptions };

  return (site: Lume.Site) => {
    site.process(options.extensions, async (pages) => {
      const read = await loadSnippets();
      const used: Record<string, string> = {};
      const jobs: Promise<void>[] = [];

      for (const page of pages) {
        const blocks = page.document!.querySelectorAll<HTMLElement>(
          options.cssSelector,
        );

        for (const el of blocks) {
          const lang = languageOf(el);
          if (!lang) continue;

          const source = el.textContent ?? "";
          jobs.push(
            (async () => {
              const key = await digest(`${lang}\0${source}`);
              let html = used[key] ?? read[key];
              if (!html) {
                html = await highlight(lang, source);
                read[key] = html;
                snippetsDirty = true;
              }
              used[key] = html;
              el.innerHTML = html;
              el.classList.add("arborium");
            })().catch((err) => {
              log.error(
                `[arborium] highlight failed (${lang}) in ${page.sourcePath}: ${err}`,
              );
            }),
          );
        }
      }

      await Promise.all(jobs);

      if (snippetsDirty || Object.keys(used).length !== persistedCount) {
        const cache: SnippetCache = { version: cacheVersion, entries: used };
        await Deno.mkdir(wasmCacheDir, { recursive: true });
        await Deno.writeTextFile(snippetsPath, JSON.stringify(cache));
        snippetsDirty = false;
        persistedCount = Object.keys(used).length;
      }
    });
  };
}

function languageOf(el: HTMLElement): string | null {
  for (const cls of el.classList) {
    const lang = extractLanguageFromClass(cls);
    if (lang) return normalizeLanguage(lang);
  }
  return null;
}
