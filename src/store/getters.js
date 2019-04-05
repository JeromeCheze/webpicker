export const getLink = (state) => (path) => {
  return `${state.root}${path}`
}
