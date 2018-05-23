function ajax(opt) {
  return new Promise((resolve, reject) => {
    opt = Object.assign({
      method: 'GET', url: null, type: 'text', args: null, data: null
    }, opt)
    if (opt.url == null) {
      throw new Error('"url" option is not defined')
    }
    opt.args = (
      opt.args == null ? '' :
      '?' + Object.entries(opt.args).map(x => `${x[0]}=${x[1]}`).join('&')
    )
    const xhr = new XMLHttpRequest()
    xhr.open(opt.method, opt.url+opt.args)
    xhr.responseType = opt.type
    xhr.onload = () => resolve(xhr.response)
    xhr.onerror = () => reject(xhr.statusText)
    xhr.send(opt.data)
  });
}

function xmlNodeToJson(x, path, rules) {
  path = `${path}/${x.tagName}`
  let obj = {}
  for (let a of x.attributes) {
    let key = `$${a.name}`
    let currentPath = `${path}/${key}`
    // console.log(currentPath);
    let conv = rules[currentPath]
    obj[key] = conv ? conv(a.value) : a.value
  }
  if (x.children.length == 0) {
    // console.log(path);
    let conv = rules[path]
    return conv ? conv(x.textContent) : x.textContent
  } else {
    for (let c of x.children) {
      if (obj[c.tagName] == null) {
        obj[c.tagName] = []
      }
      obj[c.tagName].push(xmlNodeToJson(c, path, rules))
    }
    for (let [k, v] of Object.entries(obj)) {
      let currentPath = `${path}/${k}`
      // console.log(currentPath);
      if (rules[currentPath] != true &&
          v instanceof Array &&
          v.length == 1) {
        obj[k] = v[0]
      }
    }
  }
  return obj
}

export default {
  ajax,
  xmlNodeToJson
}
