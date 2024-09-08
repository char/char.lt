export const layout = "base-layout.vto";
export default (data: Lume.Data) => {
  return {
    head: "",
    body: data.content,
  };
};
