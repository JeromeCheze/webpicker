<script setup lang="ts">
import { deepCopy, getLocalStorageDefault, parseFilter, setLocalStorage, shortcutString } from '@/utils'
import defaultSettings from '@/utils/defaultSettings'
import type { FilterOptions } from '@/types'
import NumberField from './NumberField.vue'
import { useAppStore } from '@/stores/app'
import { ref, onMounted, onBeforeUnmount } from 'vue'

interface StructItemField {
  label: string
  key: string
  type: 'select' | 'text' | 'number' | 'color' | 'boolean'
  items?: string[]
  mode?: 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'hex' | 'hexa'
}

interface StructItem {
  title: string
  fields: StructItemField[]
}

const emit = defineEmits(['update:modelValue'])

const store = useAppStore()

const props = defineProps<{
  modelValue: boolean
}>()

const values = ref(deepCopy(store.settings))
const filtersDirty = ref(false)
const form = ref()
const settingsStatus = ref(null as 'success' | 'error' | null)
const captureKeybindingKey = ref('')

const struct: StructItem[] = [
  {
    title: 'Appearance',
    fields: [
      { label: 'Theme', key: 'color.theme', type: 'select', items: ['light', 'dark'] },
      { label: 'Background', key: 'color.background', type: 'text' },
      { label: 'Surface [R,G,B]', key: 'color.surface', type: 'text' },
      { label: 'Active Row Color', key: 'color.activeRowColor', type: 'color', mode: 'hex' },
      { label: 'Color Waveform', key: 'color.waveform', type: 'color', mode: 'rgb' },
      { label: 'Color Active Waveform', key: 'color.activeWaveform', type: 'color', mode: 'hex' },
      { label: 'Color Active TimeWindow', key: 'color.activeTimeWindow', type: 'color', mode: 'hex' },
      { label: 'Spectrogram Colormap', key: 'color.spectrogram', type: 'select', items: ['PARULA' ,'VIRIDIS' ,'PLASMA' ,'INFERNO' ,'MAGMA' ,'CIVIDIS'] },
      { label: 'Spectrogram Height', key: 'picker.spectrogramHeight', type: 'number' },
      { label: 'Color T0', key: 'color.T0', type: 'text' },
      { label: 'Color TTT', key: 'color.TTT', type: 'color', mode: 'hex' },
      { label: 'Color TTT (NLL)', key: 'color.TTTNLL', type: 'color', mode: 'hex' },
      { label: 'Color Pick Automatic', key: 'color.pickAutomatic', type: 'color', mode: 'hex' },
      { label: 'Color Pick Manual', key: 'color.pickManual', type: 'color', mode: 'hex' },
      { label: 'Color Pick Status Defined', key: 'color.pickStatusDefined', type: 'color', mode: 'hex' },
      { label: 'Color Pick Automatic (other)', key: 'color.additionalPickAutomatic', type: 'color', mode: 'hex' },
      { label: 'Color Pick Manual (other)', key: 'color.additionalPickManual', type: 'color', mode: 'hex' },
      { label: 'Color Detector', key: 'color.detector', type: 'color', mode: 'hex' },
      { label: 'Tick Font Size', key: 'picker.tickFontSize', type: 'number' },
      { label: 'Picker Waveform Height', key: 'picker.pickerWaveformHeight', type: 'number' },
      { label: 'List Waveform Height', key: 'picker.listWaveformHeight', type: 'number' },
      { label: 'List Mode', key: 'picker.listMode', type: 'select', items: ['line', 'heatmap2d'] }
    ]
  },
  {
    title: 'Detector',
    fields: [
      { label: 'Model', key: 'detector.model', type: 'select', items: ['phasenet', 'eqt'] },
      { label: 'Dataset', key: 'detector.dataset', type: 'select', items: ['original', 'instance', 'obs'] },
      { label: 'P Threshold', key: 'detector.pThreshold', type: 'number' },
      { label: 'S Threshold', key: 'detector.sThreshold', type: 'number' },

    ]
  },
  {
    title: 'Miscellaneous',
    fields: [
      { label: 'Longitude Reference', key: 'miscellaneous.longitudeReference', type: 'number' },
      { label: 'Default Radius', key: 'miscellaneous.defaultRadius', type: 'number' },
      { label: 'Max Trace', key: 'miscellaneous.maxTrace', type: 'number' },
      { label: 'Time window 1 [s]', key: 'miscellaneous.timewindow1', type: 'number' },
      { label: 'Time window 2 [s]', key: 'miscellaneous.timewindow2', type: 'number' },
      { label: 'Auto add hydrophone', key: 'miscellaneous.autoAddHydrophone', type: 'boolean' }
    ]
  },
  {
    title: 'Keybindings',
    fields: [
      { label: 'Picker X Zoom In', key: 'keybinding.xZoomIn', type: 'text' },
      { label: 'Picker X Zoom Out', key: 'keybinding.xZoomOut', type: 'text' },
      { label: 'Picker Y Zoom In', key: 'keybinding.yZoomIn', type: 'text' },
      { label: 'Picker Y Zoom Out', key: 'keybinding.yZoomOut', type: 'text' },
      { label: 'Toggle Picker', key: 'keybinding.togglePicker', type: 'text' },
      { label: 'Set Phase P', key: 'keybinding.setPhaseP', type: 'text' },
      { label: 'Set Phase S', key: 'keybinding.setPhaseS', type: 'text' },
      { label: 'Align To Origin', key: 'keybinding.alignToOrigin', type: 'text' },
      { label: 'Align To P', key: 'keybinding.alignToP', type: 'text' },
      { label: 'Align To S', key: 'keybinding.alignToS', type: 'text' },
      { label: 'Toggle Filter', key: 'keybinding.toggleFilter', type: 'text' },
      { label: 'Toggle Denoiser', key: 'keybinding.toggleDenoiser', type: 'text' },
      { label: 'Toggle Interpolate', key: 'keybinding.toggleInterpolate', type: 'text' },
      { label: 'Toggle Integration', key: 'keybinding.toggleIntegration', type: 'text' },
      { label: 'Toggle Spectrogram', key: 'keybinding.toggleSpectrogram', type: 'text' },
      { label: 'Toggle Rotation (ZNE/ZRT)', key: 'keybinding.toggleRotation', type: 'text' },
      { label: 'Toggle Detector', key: 'keybinding.toggleDetector', type: 'text' },
      { label: 'Toggle Common Scale', key: 'keybinding.toggleCommonScale', type: 'text' },
      { label: 'Toggle TTT', key: 'keybinding.toggleTTT', type: 'text' },
      { label: 'Toggle Event Info', key: 'keybinding.toggleEventInfo', type: 'text' },
      { label: 'Toggle Map', key: 'keybinding.toggleMap', type: 'text' },
      { label: 'Create Pick', key: 'keybinding.createPick', type: 'text' },
      { label: 'Delete Pick', key: 'keybinding.deletePick', type: 'text' },
      { label: 'Set Polarity Positive', key: 'keybinding.polarityPositive', type: 'text' },
      { label: 'Set Polarity Negative', key: 'keybinding.polarityNegative', type: 'text' },
      { label: 'Reset Polarity', key: 'keybinding.resetPolarity', type: 'text' },
      { label: 'Next Station', key: 'keybinding.nextStation', type: 'text' },
      { label: 'Prev Station', key: 'keybinding.prevStation', type: 'text' },
      { label: 'Relocate', key: 'keybinding.relocate', type: 'text' },
      { label: 'Compute Magnitudes', key: 'keybinding.computeMagnitudes', type: 'text' },
      { label: 'Commit', key: 'keybinding.commit', type: 'text' }
    ]
  }
]

function checkKeybinding(key: string, value: string) {
  const conflicts: string[] = []
  for (const [k, v] of Object.entries(values.value)) {
    if (k !== key && k.indexOf('keybinding.') === 0 && v === value) {
      conflicts.push(k)
    }
  }
  if (conflicts.length > 0) {
    return `Conflict with ${conflicts.join(', ')}`
  }
  return true
}

function captureKeybinding(key: string) {
  if (key === captureKeybindingKey.value) {
    captureKeybindingKey.value = ''
  } else {
    captureKeybindingKey.value = key
  }
}

function resetDefault(key: string) {
  values.value[key] = deepCopy(defaultSettings[key])
}

function isDefaultValue(key: string) {
  return values.value[key] === defaultSettings[key]
}

function cancelDefault(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  return false
}

function handleDragStart(e: DragEvent, i: number) {
  if (e.dataTransfer != null) {
    e.dataTransfer.dropEffect = 'move'
    e.dataTransfer.setData('text/plain', `${i}`)
  }
}

function handleDrop(e: DragEvent, i: number) {
  cancelDefault(e)
  const items = values.value['filter']
  if (e.dataTransfer != null) {
    filtersDirty.value = true
    const oldIndex = parseInt(e.dataTransfer.getData('text/plain'))
    const target = items[i]
    const item = items.splice(oldIndex, 1)[0]
    if (oldIndex > i) {
      items.splice(items.indexOf(target), 0, item)
    } else {
      items.splice(items.indexOf(target) + 1, 0, item)
    }
  }
}

function handleDeleteFilter(i: number) {
  filtersDirty.value = true
  values.value['filter'].splice(i, 1)
}

function handleAddFilter() {
  filtersDirty.value = true
  values.value['filter'].push({ name: '', expression: '' })
}

function validateFilterName(v: string) {
  const filterNames = values.value['filter'].map((x: FilterOptions) => x.name)
  filterNames.splice(filterNames.indexOf(v), 1)
  const result = !!v && filterNames.indexOf(v) < 0 || 'Filter name is required and must be unique'
  return result
}

function validateFilterExpression(v: string) {
  return parseFilter(v) != null || 'Invalid expression'
}

async function handleSave() {
  const { valid } = await form.value.validate()
  if (valid) {
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(values.value)) {
      if (!isDefaultValue(key)) {
        result[key] = value
      }
    }
    store.settings = deepCopy(values.value)
    setLocalStorage('settings', result)
    settingsStatus.value = 'success'
    setTimeout(() => settingsStatus.value = null, 3000)
  } else {
    settingsStatus.value = 'error'
    setTimeout(() => settingsStatus.value = null, 3000)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (captureKeybindingKey.value !== '') {
    values.value[captureKeybindingKey.value] = shortcutString(e)
  }
}

onMounted(() => {
  const settings = getLocalStorageDefault('settings', {})
  filtersDirty.value = settings.filter != null
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <v-dialog
    width="600px"
    :model-value="props.modelValue"
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
    scrollable
    attach
  >
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <div class="text-h5 text-medium-emphasis">Settings</div>
        <v-btn icon="mdi-close" variant="text" @click="emit('update:modelValue', false)"></v-btn>
      </v-card-title>
      <v-card-text :style="{ height: '80vh' }">
        <v-form ref="form">
          <template v-for="section in struct">
            <v-row>
              <v-col cols="12">
                <h4 class="mt-2">{{ section.title }}</h4>
                <v-table density="compact" class="my-6" :style="{ background: store.settings['color.surface'] }">
                  <tbody>
                    <tr v-for="field in section.fields">
                      <th>{{ field.label }}</th>
                      <td>
                        <v-menu v-if="field.type === 'color'" :close-on-content-click="false">
                          <template #activator="{ props }">
                            <v-text-field readonly hide-details="auto" v-model="values[field.key]" density="compact" v-bind="props">
                              <template #prepend-inner>
                                <div class="color-picker__box-color" :style="{ background: values[field.key] }"></div>
                              </template>
                            </v-text-field>
                          </template>
                          <v-color-picker v-model="values[field.key]" :mode="field.mode" :modes="[field.mode!]"></v-color-picker>
                        </v-menu>
                        <v-select
                          v-else-if="field.type === 'select'"
                          density="compact"
                          hide-details="auto"
                          :items="field.items"
                          v-model="values[field.key]"/>
                        <v-text-field
                          v-else-if="section.title === 'Keybindings'"
                          readonly
                          density="compact"
                          hide-details="auto"
                          v-model="values[field.key]"
                          :rules="[checkKeybinding(field.key, values[field.key])]">
                          <template #append>
                            <v-icon
                              title="click to capture keybinding"
                              :color="field.key === captureKeybindingKey ? 'red' : ''"
                              @click="captureKeybinding(field.key)">mdi-record</v-icon>
                          </template>
                        </v-text-field>
                        <v-text-field
                          v-else-if="field.type === 'text'"
                          density="compact"
                          hide-details="auto"
                          v-model="values[field.key]"/>
                        <NumberField
                          v-else-if="field.type === 'number'"
                          density="compact"
                          hide-details="auto"
                          v-model="values[field.key]"
                          required/>
                        <v-checkbox
                          v-else-if="field.type === 'boolean'"
                          density="compact"
                          hide-details="auto"
                          v-model="values[field.key]"
                        />
                      </td>
                      <td><v-btn variant="plain" v-if="!isDefaultValue(field.key)" @click="resetDefault(field.key)"><v-icon>mdi-backup-restore</v-icon></v-btn></td>
                    </tr>
                  </tbody>
                </v-table>
              </v-col>
            </v-row>
          </template>
          <v-row>
            <v-col cols="12">
              <h4 class="mt-2">Filters <v-btn variant="plain" v-if="filtersDirty" @click="resetDefault('filter')"><v-icon>mdi-backup-restore</v-icon></v-btn></h4>
              <v-table density="compact" class="my-6" :style="{ background: store.settings['color.surface'] }">
                <tbody>
                  <tr
                    v-for="(filter, i) in values['filter']"
                    draggable="true"
                    @dragstart="(e) => handleDragStart(e, i as number)"
                    @dragenter="cancelDefault"
                    @dragover="cancelDefault"
                    @drop="(e) => handleDrop(e, i as number)"
                  >
                    <td class="draggable-row"><v-icon>mdi-drag-vertical</v-icon></td>
                    <td>
                      <v-text-field label="Name" density="compact" v-model="filter.name" :rules="[validateFilterName]"/>
                    </td>
                    <td>
                      <v-text-field label="Expression" density="compact" v-model="filter.expression" :rules="[validateFilterExpression]"/>
                    </td>
                    <td class="del">
                      <v-btn variant="plain" @click="handleDeleteFilter(i as number)"><v-icon>mdi-delete</v-icon></v-btn>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="4" class="text-right">
                      <v-btn @click="handleAddFilter"><v-icon>mdi-plus</v-icon> Add filter</v-btn>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn v-if="settingsStatus === 'success'" prepend-icon="mdi-check-circle-outline" color="success">Save</v-btn>
        <v-btn v-else-if="settingsStatus === 'error'" prepend-icon="mdi-alert-circle-outline" color="error">Save failed: some fields are invalid</v-btn>
        <v-btn v-else color="primary" @click="handleSave">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style>
/*.settings-table,
.filter-table {
  width: 100%;
  margin-bottom: 30px;
}
.settings-table th {
  text-align: right;
}
.settings-table th,
.settings-table td {
  padding: 4px 10px;
  min-width: 70px;
}
.filter-table td {
  padding: 4px 10px;
}
.filter-table td.del {
  width: 64px;
}
.draggable-row {
  cursor: move;
  width: 40px;
}*/
.color-picker__box-color {
  display: inline-block;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid gray;
  margin: 4px;
  cursor: pointer;
}
</style>