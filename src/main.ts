import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import { VDatePicker } from 'vuetify/labs/VDatePicker'
import NumberField from '@/components/NumberField.vue'
import SmartTable from '@/components/SmartTable.vue'
import OriginMap from '@/components/OriginMap.vue'
import OriginPanel from '@/components/OriginPanel.vue'
import MagnitudePanel from '@/components/MagnitudePanel.vue'
import ArrivalPanel from '@/components/ArrivalPanel.vue'
import ResVsDistChart from '@/components/ResVsDistChart.vue'
import TraveltimeChart from '@/components/TraveltimeChart.vue'
import PickerPanel from '@/components/PickerPanel.vue'
import RelocateComponent from '@/components/RelocateComponent.vue'
import ComputeMagnitudeComponent from '@/components/ComputeMagnitudeComponent.vue'
import CommitComponent from '@/components/CommitComponent.vue'
import MapEvents from '@/components/MapEvents.vue'
import ListEvents from '@/components/ListEvents.vue'
import PickerToolbar from '@/components/PickerToolbar.vue'
import PickerWaveforms from '@/components/PickerWaveforms.vue'
import PickerWaveformList from '@/components/PickerWaveformList.vue'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import 'leaflet/dist/leaflet.css'

const vuetify = createVuetify({
  components: {
    ...components,
    VDatePicker,
    NumberField,
    SmartTable,
    OriginMap,
    OriginPanel,
    MagnitudePanel,
    ArrivalPanel,
    ResVsDistChart,
    TraveltimeChart,
    PickerPanel,
    RelocateComponent,
    ComputeMagnitudeComponent,
    CommitComponent,
    MapEvents,
    ListEvents,
    PickerToolbar,
    PickerWaveforms,
    PickerWaveformList
  },
  theme: { defaultTheme: 'dark' },
  directives
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)

app.mount('#app')
