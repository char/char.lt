import lume from "lume/mod.ts";
import jsx from "lume/plugins/jsx_preact.ts";
import pug from "lume/plugins/pug.ts";
import feed from "lume/plugins/feed.ts";
import codeHighlight from "lume/plugins/code_highlight.ts";
import katex from "lume/plugins/katex.ts";

import mdAnchor from "npm:markdown-it-anchor";
import mdFootnote from "npm:markdown-it-footnote";

const site = lume(
  {
    emptyDest: false,
    src: "./site",
    dest: "./public",
    location: new URL("https://char.lt"),
  },
  {
    markdown: { options: { linkify: true, typographer: true } },
  }
);

site.copy("static");
site.copy("assets");
site.use(jsx());
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
  })
);
site.use(
  codeHighlight({
    // @ts-ignore codeHighlight _does_ merge but doesn't let you provide a Partial<Options>
    options: {
      ignoreUnescapedHTML: true,
      cssSelector: "pre code:not(.hljs-manual)",
    },
  })
);
site.use(katex({ options: { displayMode: false } }));

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

  // insert .non-footnote-content around markdown so that we can flexbox expand it
  // (and push the footnotes section to the bottom of the body)
  md.core.ruler.before("block", "content-wrapper-open", (state: any) => {
    state.tokens.push(new state.Token("non_footnote_content_open"));
  });
  md.core.ruler.before(
    "footnote_tail",
    "content-wrapper-close",
    (state: any) => {
      state.tokens.push(new state.Token("non_footnote_content_close"));
    }
  );
  md.renderer.rules.non_footnote_content_open = (_tokens: any, _idx: any) => {
    return `<div class="non-footnote-content">`;
  };
  md.renderer.rules.non_footnote_content_close = (_tokens: any, _idx: any) => {
    return `</div>`;
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
  })
);

site.process([".html"], (pages) =>
  pages.forEach((p) => {
    if (typeof p.content === "string") {
      p.content =
        "<!-- this site is generated by a static site generator. view the real source code: https://github.com/char/char.lt -->" +
        "\n" +
        p.content;
    }
  })
);

export default site;
