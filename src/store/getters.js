export const getLink = (state) => (path) => {
  return `${state.root}${path}`
}

export const getId = (state) => (prefix) => {
  return [
    prefix,
    new Date().toISOString().replace(/[\-:]/g, '').replace('T', '.').substr(0, 18),
    (Math.random()*1000).toFixed(0)
  ].join('-')
}
