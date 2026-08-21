// deno-lint-ignore-file no-explicit-any no-control-regex

import lume from "@lume";
import extractDate from "@lume/plugins/extract_date.ts";
import feed from "@lume/plugins/feed.ts";
import arborium from "./_lume/arborium.ts";
import katex from "@lume/plugins/katex.ts";
import pug from "@lume/plugins/pug.ts";
import toml from "@lume/plugins/toml.ts";

const site = lume(
  {
    src: "src",
    dest: "public",
    emptyDest: false,
    location: new URL("https://char.lt"),
  },
  {
    markdown: {
      options: {
        linkify: true,
        typographer: true,
      },
    },
  },
);

site.use(toml());
site.use(extractDate());
site.use(
  feed({
    output: ["/blog.rss", "/blog.json"],
    query: "type=blog_post unlisted!=true",
    info: {
      title: "charlotte's blog",
      description: "thoughts and ideas",
    },
    items: {
      title: "=title",
      description: "=excerpt",
    },
  }),
);
site.use(arborium());
// katex styles/fonts are vendored (css/vendor/katex.min.css), so the plugin
// must not emit its own /style.css
site.use(katex({ cssFile: false, options: { displayMode: false } }));

import mdAnchor from "npm:markdown-it-anchor";
import mdFootnote from "npm:markdown-it-footnote";

const ansiToHtml = (ansi: string) => {
  let color: number | undefined;
  let bold = false;
  let dim = false;
  let html = "";
  let offset = 0;

  const escape = (text: string) => text.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]!);
  const render = (text: string) => {
    if (!text) return;
    if (text.includes("\x1b")) throw new Error("unsupported ANSI escape sequence");

    let escaped = escape(text);
    if (color !== undefined) {
      escaped = `<a-${color}${bold ? " b" : ""}>${escaped}</a-${color}>`;
    } else if (bold) escaped = `<a-b>${escaped}</a-b>`;
    if (dim) escaped = `<a-dim>${escaped}</a-dim>`;
    html += escaped;
  };

  for (const match of ansi.matchAll(/\x1b\[([\d;]*)m/g)) {
    render(ansi.slice(offset, match.index));
    offset = match.index + match[0].length;

    const parameters = match[1] ? match[1].split(";").map(Number) : [0];
    for (let i = 0; i < parameters.length; i++) {
      const parameter = parameters[i];
      if (parameter === 0) {
        color = undefined;
        bold = false;
        dim = false;
      } else if (parameter === 1) bold = true;
      else if (parameter === 2) dim = true;
      else if (parameter === 22) bold = dim = false;
      else if (parameter === 39) color = undefined;
      else if (parameter >= 30 && parameter <= 37) color = parameter - 30;
      else if (parameter >= 90 && parameter <= 97) color = parameter - 82;
      else if (parameter === 38 && parameters[i + 1] === 5 && parameters[i + 2] <= 15) {
        color = parameters[i + 2];
        i += 2;
      } else {
        throw new Error(`unsupported ANSI SGR parameter: ${parameters.slice(i).join(";")}`);
      }
    }
  }

  render(ansi.slice(offset));
  return html;
};

const customizeMarkdown = (md: any) => {
  md.linkify.set({ fuzzyLink: false, fuzzyEmail: false });
  md.use(mdAnchor, { level: 2 });
  md.use(mdFootnote);

  const renderFence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens: any, idx: number, options: any, env: any, self: any) => {
    const token = tokens[idx];
    if (token.info.trim().split(/\s+/)[0] === "ansi") {
      return `<pre class="terminal"><code>${ansiToHtml(token.content)}</code></pre>\n`;
    }
    return renderFence(tokens, idx, options, env, self);
  };

  // footnote captions without surrounding square brackets
  md.renderer.rules.footnote_caption = (tokens: any, idx: any) => {
    let n = Number(tokens[idx].meta.id + 1).toString();
    if (tokens[idx].meta.subId > 0) {
      n += ":" + tokens[idx].meta.subId;
    }
    return n;
  };
};

const md: any = await new Promise((r) => site.hooks.markdownIt(r));
customizeMarkdown(md);
site.use(
  pug({
    options: {
      filters: {
        // @ts-ignore: idk what types these are supposed to be. sorry
        markdown: (text, options) => md.render(text, options),
      },
    },
  }),
);

site.copy("assets");
site.copy("css");

const cssVersions = new Map<string, string>();
site.data("stylesheet", async (href: string) => {
  let version = cssVersions.get(href);
  if (!version) {
    const digest = await crypto.subtle.digest("SHA-256", await Deno.readFile(`src${href}`));
    version = Array.from(new Uint8Array(digest.slice(0, 6)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    cssVersions.set(href, version);
  }

  return `<link rel="stylesheet" href="${href}?v=${version}" />`;
});

import prettier from "npm:prettier@3";
site.process([".html"], async (assets) => {
  for (const asset of assets) {
    asset.content = await prettier.format(asset.content as string, {
      parser: "html",
      printWidth: 160,
    });
  }
});

export default site;
