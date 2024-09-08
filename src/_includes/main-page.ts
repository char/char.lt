export const layout = "base-layout.vto";
export default (data: Lume.Data) => {
  return {
    head: `<link rel="stylesheet" href="/css/main-page.css">`,
    body: data.content,
  };
};
