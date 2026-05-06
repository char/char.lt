import {
  extractLanguageFromClass,
  highlight,
  loadGrammar,
  normalizeLanguage,
  setConfig,
} from "@arborium/arborium";

import { log } from "@lume/utils/log.ts";

// arborium's built-in resolvers call `import()`/`fetch()` from inside the npm
// package; under Deno that routes through the Node-compat ESM loader, which
// rejects `https://` specifiers. Override them with closures defined in this
// (Deno-native) module so the dynamic import uses Deno's loader.
setConfig({
  resolveJs: ({ baseUrl, path }) => import(`${baseUrl}/${path}`),
  resolveWasm: ({ baseUrl, path }) => fetch(`${baseUrl}/${path}`),
  resolveHostJs: ({ baseUrl, path }) => import(`${baseUrl}/${path}`),
  resolveHostWasm: ({ baseUrl, path }) => fetch(`${baseUrl}/${path}`),
});

export interface Options {
  /** extensions of pages to process. */
  extensions?: string[];
  /** highlightable code block css selector */
  cssSelector?: string;
  /** languages to preload. omitted grammars are fetched lazily anyways */
  languages?: string[];
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
    if (options.languages?.length) {
      // Kick off grammar loads eagerly; arborium caches them internally.
      for (const lang of options.languages) {
        loadGrammar(normalizeLanguage(lang)).catch((err) => {
          log.warn(`[arborium] failed to preload '${lang}': ${err}`);
        });
      }
    }

    site.process(options.extensions, async (pages) => {
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
            highlight(lang, source).then(
              (html) => {
                el.innerHTML = html;
                el.classList.add("arborium");
              },
              (err) => {
                log.error(
                  `[arborium] highlight failed (${lang}) in ${page.sourcePath}: ${err}`,
                );
              },
            ),
          );
        }
      }

      await Promise.all(jobs);
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
