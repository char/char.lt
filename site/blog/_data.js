export const layout = "blog-post.jsx"
export const type = "blog_post"

export const url = (page) => {
  const date = page.data.date.toISOString().split("T")[0];
  const [year, month, _day] = date.split("-");
  return `/blog/${year}/${month}/${page.src.slug}/index.html`
}
