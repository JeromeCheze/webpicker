// Lib imports
import Vue from 'vue'
import Router from 'vue-router'

// Routes
import paths from './paths'

function route (path) {
  return {
    name: path.name || path.view,
    path: path.path,
    component: (resolve) => import(
      `@/views/${path.view}`
    ).then(resolve),
    props: path.props == true
  }
}

Vue.use(Router)

// Create a new router
export default new Router({
  mode: 'hash',
  routes: paths.map(path => route(path)).concat([
    { path: '*', redirect: '/form' }
  ]),
  scrollBehavior (to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    if (to.hash) {
      return { selector: to.hash }
    }
    return { x: 0, y: 0 }
  }
})
