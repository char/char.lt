// deno-lint-ignore-file no-explicit-any

import lume from "@lume";
import codeHighlight from "@lume/plugins/code_highlight.ts";
import feed from "@lume/plugins/feed.ts";
import katex from "@lume/plugins/katex.ts";
import pug from "@lume/plugins/pug.ts";
import toml from "@lume/plugins/toml.ts";

import ventoAutoTrim from "https://deno.land/x/vento@v1.12.10/plugins/auto_trim.ts";

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
    vento: {
      options: {},
      plugins: [ventoAutoTrim()],
    },
  },
);

site.use(toml());
site.use(
  feed({
    output: ["/blog.rss", "/blog.json"],
    query: "type=blog_post unlisted!=true",
    info: {
      title: "charlotte som's blog",
      description: "thoughts & ideas",
    },
    items: {
      title: "=title",
      description: "=excerpt",
    },
  }),
);
site.use(
  codeHighlight({
    // @ts-expect-error codeHighlight _does_ merge but doesn't let you provide a Partial<Options>
    options: {
      ignoreUnescapedHTML: true,
      cssSelector: "pre code:not(.hljs-manual)",
    },
  }),
);
site.use(katex({ options: { displayMode: false } }));

import mdAnchor from "npm:markdown-it-anchor";
import mdFootnote from "npm:markdown-it-footnote";

const customizeMarkdown = (md: any) => {
  md.use(mdAnchor, { level: 2 });
  md.use(mdFootnote);

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
