import { createVuetify } from 'vuetify'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import router from './router'
import App from './App.vue'

import '@mdi/font/css/materialdesignicons.css'
import 'leaflet/dist/leaflet.css'
import 'vuetify/styles'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(createVuetify())

app.mount('#app')
