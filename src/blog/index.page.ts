export const layout = "base-layout.vto";
export const type = undefined;
export const url = "/blog/";

const renderBlogPosts = (blogPosts: Lume.Page["data"][]): string => {
  if (blogPosts.length === 0) {
    return `<p>no blog posts :(</p>`;
  }

  return `<ul>
      ${blogPosts
        .map((post) => {
          const postDate = post.date.toISOString().split("T")[0];
          return `
            <li>
              <time datetime="${post.date.toISOString()}">${postDate}</time>
              <a href="${post.url}">${post.title}</a>
            </li>
          `;
        })
        .join("")}
    </ul>`;
};

export default (data: Lume.Data) => {
  const blogPosts = data.search
    .pages("type=blog_post", "date=desc")
    .filter((post) => !post.unlisted);

  return {
    head: `<link rel="stylesheet" href="/css/blog-archive.css" />
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
        <h1>Blog</h1>
        <p>The following is a list of every post on my blog.</p>
        <p>
          There is also an <a href="/blog.rss">RSS feed</a> available.
        </p>
      </header>

      <section id="blog-archive-list">
        ${renderBlogPosts(blogPosts)}
      </section>`,
  };
};
