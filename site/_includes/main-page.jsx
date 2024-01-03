export const layout = "base.jsx";

export default ({ children }) => {
  return {
    head: (
      <>
        <link rel="stylesheet" href="/static/main-page.css" />
      </>
    ),
    body: <>{children}</>,
  };
};
