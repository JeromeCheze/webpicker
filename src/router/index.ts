import FormView from '@/views/FormView.vue'
import ListView from '@/views/ListView.vue'
import EventView from '@/views/EventView.vue'
import PickerView from '@/views/PickerView.vue'
import SettingsView from '@/views/SettingsView.vue'
// Lib imports
import Vue from 'vue'
import VueRouter, { RouteConfig } from 'vue-router'

Vue.use(VueRouter)

const routes: RouteConfig[] = [
  {
    path: '/form',
    name: 'Form',
    component: FormView
  },
  {
    path: '/list',
    name: 'List',
    component: ListView,
    props: true
  },
  {
    path: '/event/:code',
    name: 'Event',
    component: EventView,
    props: true
  },
  {
    path: '/picker',
    name: 'Picker',
    component: PickerView
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsView
  },
  {
    path: '*',
    redirect: '/form'
  }
]

// Create a new router
export default new VueRouter({
  routes,
  scrollBehavior (to, from, savedPosition) {
    return { x: 0, y: 0 }
  }
})
