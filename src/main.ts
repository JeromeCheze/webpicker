import Vue from 'vue'

import './components'

import './plugins'

import vuetify from './plugins/vuetify'
import App from './App.vue'
import router from '@/router'
import store from '@/store'

new Vue({
  router,
  store,
  vuetify,
  render: h => h(App)
}).$mount('#app')

/* prevent back page action which would result in loosing work done on webpicker. */
// history.pushState(null, null, location.href)
// window.onpopstate = function () {
//     history.go(1)
// }
// window.onbeforeunload = function(ev) {
//   let msg = 'Are you sure you want to leave ? All your work will be lost !'
//   ev.returnValue = msg
//   return msg
// }
