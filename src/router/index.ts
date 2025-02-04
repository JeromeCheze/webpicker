import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import QueryView from '@/views/QueryView.vue'
import EventView from '@/views/EventView.vue'
import PlotView from '@/views/PlotView.vue'
import ConfigView from '@/views/ConfigView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/query',
      name: 'query',
      component: QueryView
    },
    {
      path: '/plot',
      name: 'plot',
      component: PlotView
    },
    {
      path: '/config',
      name: 'config',
      component: ConfigView
    },
    {
      path: '/event/:eventid',
      name: 'event',
      component: EventView,
      props: true
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFound.vue')
    }
  ]
})

export default router
