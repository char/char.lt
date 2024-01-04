export const layout = "base.jsx";

export default ({ title, description, children, date }) => {
  return {
    head: (
      <>
        <link rel="stylesheet" href="/static/blog-post.css" />
        <link rel="stylesheet" href="/static/vendor/katex.min.css" />
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
        <meta name="description" content={description} />
        <meta itemprop="description" content={description} />
        <meta property="og:description" content={description} />
      </>
    ),
    body: (
      <>
        <header>
          <h1>{title}</h1>
          <p>{description}</p>
          <p>
            <time>{date.toISOString().split("T")[0]}</time>
          </p>
        </header>

        {children}
      </>
    ),
  };
};
