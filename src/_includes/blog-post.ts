import { DOMParser } from "@lume/deps/dom.ts";

export const layout = "base-layout.vto";

export default (data: Lume.Data) => {
  const { title, description, children, date } = data;
  data.title = title + " - Charlotte Som";

  let postContent = children;
  let footnotes: string | undefined;

  try {
    const fragment = new DOMParser().parseFromString(
      `<article>${children}</article>`,
      "text/html",
    );
    const article = fragment.querySelector(":root > body > article")!;
    const footnotesElem = article.querySelector(".footnotes");
    footnotesElem?.remove();
    footnotes = footnotesElem?.innerHTML;

    article.querySelector(".footnotes-sep")?.remove();

    postContent = article.innerHTML;
  } catch (err) {
    console.warn(err);
  }

  return {
    head: `
      <link rel="stylesheet" href="/css/blog-post.css">
      <link rel="stylesheet" href="/css/syntax-highlighting.css">
      <link rel="stylesheet" href="/css/wide-elements.css" />
      <link rel="stylesheet" href="/css/vendor/katex.min.css">
      <link
        rel="alternate"
        type="application/rss+xml"
        href="https://char.lt/blog.rss"
      >
      <link
        rel="alternate"
        type="application/json"
        href="https://char.lt/blog.json"
      >`,
    body: `
      <header>
        <div>
          <h1>${title}</h1>
          <p>${description}</p>
          <p>
            <time>${date.toISOString().split("T")[0]}</time>
          </p>
        </div>
      </header>

      <article>
        ${postContent}
      </article>
      ${footnotes ? `<aside>${footnotes}</aside>` : ""}`,
  };
};
