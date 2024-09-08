export const layout = "blog-post.ts"
export const type = "blog_post"

export const url = (page) => {
  const date = page.data.date.toISOString().split("T")[0];
  const [year, month, _day] = date.split("-");
  return `/blog/${year}/${month}/${page.data.basename}/index.html`
}
