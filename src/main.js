import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'

import EventForm from './components/EventForm.vue'
import EventList from './components/EventList.vue'
import EventPage from './components/EventPage.vue'
import EventPicker from './components/EventPicker.vue'
import UserSettings from './components/UserSettings.vue'

import App from './App.vue'

// install Element-UI
Vue.use(ElementUI, { size: 'mini' })

Vue.component('event-form', EventForm)
Vue.component('event-list', EventList)
Vue.component('event-page', EventPage)
Vue.component('event-picker', EventPicker)
Vue.component('user-settings', UserSettings)

new Vue({
  el: '#app',
  template: '<App/>',
  components: { App }
})

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
