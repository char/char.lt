export const layout = "base.jsx";
export const type = undefined;
export const url = "/blog/";

export default (data) => {
  const blogPosts = data.search
    .pages("type=blog_post", "date=desc")
    .filter((page) => !page.data.unlisted);

  return {
    head: (
      <>
        <link rel="stylesheet" href="/static/blog-archive.css" />
        <link
          rel="alternate"
          type="application/rss+xml"
          href="https://char.lt/blog.rss"
        />
        <link
          rel="alternate"
          type="application/json"
          href="https://char.lt/blog.json"
        />
      </>
    ),
    body: (
      <>
        <header>
          <h1>blog</h1>
          <p>the following is a list of every post on my blog.</p>
          <p>
            there is also an <a href="/blog.rss">rss feed</a> available.
          </p>
        </header>

        {blogPosts.map((page) => {
          const postDate = page.data.date.toISOString().split("T")[0];

          if (page.data.featured) {
            return (
              <article class="featured">
                <h2>
                  <a href={page.data.url}>{page.data.title}</a>
                  {` `}
                  (featured &ndash; <time>{postDate}</time>)
                </h2>
                <p class="description">{page.data.description}</p>
              </article>
            );
          }

          return (
            <article>
              <h2>
                <a href={page.data.url}>{page.data.title}</a>
              </h2>
              <p>
                (<time>{postDate}</time>)
              </p>
            </article>
          );
        })}
      </>
    ),
  };
};
