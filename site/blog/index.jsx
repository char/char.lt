export const layout = "base.jsx";
export const type = undefined;
export const url = "/blog/";

export default (data) => {
  const blogPosts = data.search
    .pages("type=blog_post", "date=desc")
    .filter((post) => !post.unlisted);

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

        {blogPosts.map((post) => {
          const postDate = post.date.toISOString().split("T")[0];

          if (post.featured) {
            return (
              <article class="featured">
                <h2>
                  <a href={post.url}>{post.title}</a>
                  {` `}
                  (featured &ndash; <time>{postDate}</time>)
                </h2>
                <p class="description">{post.description}</p>
              </article>
            );
          }

          return (
            <article>
              <h2>
                <a href={post.url}>{post.title}</a>
              </h2>
              <span>&ndash;</span>
              <p class="description">{post.description}</p>
            </article>
          );
        })}
      </>
    ),
  };
};
