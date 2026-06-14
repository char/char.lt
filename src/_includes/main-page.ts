export const layout = "base-layout.vto";
export default (data: Lume.Data) => {
  return {
    stylesheets: ["/css/main-page.css"],
    body: data.content,
    head: `<script async defer type="module" src="/assets/js/char-skrunkle.mjs"></script>`
  };
};
