import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import NumberField from '@/components/NumberField.vue'
import DateField from '@/components/DateField.vue'
import SmartTable from '@/components/SmartTable.vue'
import OriginMap from '@/components/OriginMap.vue'
import OriginPanel from '@/components/OriginPanel.vue'
import MagnitudePanel from '@/components/MagnitudePanel.vue'
import ArrivalPanel from '@/components/ArrivalPanel.vue'
import ResVsDistChart from '@/components/ResVsDistChart.vue'
import TraveltimeChart from '@/components/TraveltimeChart.vue'
import PickerPanel from '@/components/PickerPanel.vue'
import RelocateComponent from '@/components/RelocateComponent.vue'
import ComputeMagnitudesComponent from '@/components/ComputeMagnitudesComponent.vue'
import CommitComponent from '@/components/CommitComponent.vue'
import MapEvents from '@/components/MapEvents.vue'
import ListEvents from '@/components/ListEvents.vue'
import PickerToolbar from '@/components/PickerToolbar.vue'
import PickerWaveforms from '@/components/PickerWaveforms.vue'
import PickerWaveformList from '@/components/PickerWaveformList.vue'
import StationRadius from '@/components/StationRadius.vue'
import FirstMotion from '@/components/FirstMotion.vue'
import EventOriginsMap from '@/components/EventOriginsMap.vue'
import EventInspector from '@/components/EventInspector.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import CreateEvent from '@/components/CreateEvent.vue'
import StationMagnitudeChart from '@/components/StationMagnitudeChart.vue'
import AdditionalChannels from '@/components/AdditionalChannels.vue'
import EventsStats from '@/components/EventsStats.vue'
import CatalogForm from '@/components/CatalogForm.vue'
import WaveformSlider from '@/components/WaveformSlider.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import 'leaflet/dist/leaflet.css'

const vuetify = createVuetify({
  components: {
    ...components,
    NumberField,
    DateField,
    SmartTable,
    OriginMap,
    OriginPanel,
    MagnitudePanel,
    ArrivalPanel,
    ResVsDistChart,
    TraveltimeChart,
    PickerPanel,
    RelocateComponent,
    ComputeMagnitudesComponent,
    CommitComponent,
    MapEvents,
    ListEvents,
    PickerToolbar,
    PickerWaveforms,
    PickerWaveformList,
    StationRadius,
    FirstMotion,
    EventOriginsMap,
    EventInspector,
    SettingsPanel,
    CreateEvent,
    StationMagnitudeChart,
    AdditionalChannels,
    EventsStats,
    CatalogForm,
    WaveformSlider,
    ChatPanel
  },
  theme: { defaultTheme: 'dark' },
  directives
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)

app.mount('#app')
