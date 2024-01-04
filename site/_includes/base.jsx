export const layout = "html.njk";

const SITE_NAME = "charlotte som";

const Nav = (data) => {
  const { url } = data;

  const NavLink = ({ href, children }) => (
    <>
      <a href={href}>{children}</a>
      {`\n`}
    </>
  );

  return (
    <nav>
      <NavLink href="/">home</NavLink>
      <NavLink href="/blog/">blog</NavLink>
    </nav>
  );
};

export default (data) => {
  const { url, lang, title, children } = data;
  const pageTitle = title ? `${title} - ${SITE_NAME}` : SITE_NAME;

  return (
    <html lang={lang || "en"} prefix="og: https://ogp.me/ns#">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width" />

        <title>{pageTitle}</title>
        <meta property="og:title" content={pageTitle} />
        <meta property="twitter:title" content={pageTitle} />
        <meta itemprop="name" content={pageTitle} />

        <link rel="canonical" href={`https://char.lt/${url}`} />

        <link rel="stylesheet" href="/static/fonts.css" />
        <link rel="stylesheet" href="/static/styles.css" />

        {children.head}
      </head>

      <body>
        <Nav data={data} />
        <main>{children.body}</main>
        <footer>
          <p>charlotte athena som</p>
          <p>
            <a href="https://github.com/char/char.lt">source code</a>
          </p>
        </footer>
      </body>
    </html>
  );
};
