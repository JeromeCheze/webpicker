import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'

import App from './App.vue'

// install Element-UI
Vue.use(ElementUI, { size: 'small' })

new Vue({
  el: '#app',
  template: '<App/>',
  components: { App }
})

// prevent back page action which would result in loosing work done on meteor.
history.pushState(null, null, location.href)
window.onpopstate = function () {
    history.go(1)
}
window.onbeforeunload = function(ev) {
  let msg = 'Are you sure you want to leave ? All your work will be lost !'
  ev.returnValue = msg
  return msg
}
