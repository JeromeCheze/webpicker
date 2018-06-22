<template>
  <div>
    <h1>Settings</h1>
    <div v-for="(form, formKey) in formStruct">
      <h4>{{ form.label }}</h4>
      <div class="field" v-for="(field, key) in form.fields">
        <div class="label">{{ field.label }}</div>
        <component :is="field.component" v-model="field.value" v-bind="field.props"></component>
        <el-button
          v-if="field.value != field.default"
          type="text" size="mini"
          @click="handleResetParameter(formKey, key)">reset</el-button>
      </div>
    </div>
    <el-button type="primary" size="medium" @click="handleSaveSettings">Save</el-button>
  </div>
</template>

<script>
const STORAGE_KEY = 'settings'

export default {
  data () {
    let formStruct = {
      pickerColor: {
        label: 'Picker colors',
        fields: {
          amplitudeValue: {
            default: '#808080',
            label: 'Text amplitude value',
            component: 'el-color-picker',
            props: {}
          },
          background: {
            default: 'rgba(255, 255, 255, 1)',
            label: 'Waveform background',
            component: 'el-color-picker',
            props: { 'show-alpha': true }
          },
          backgroundEven: {
            default: 'rgba(229, 238, 241, 1)',
            label: 'Waveform background even',
            component: 'el-color-picker',
            props: { 'show-alpha': true }
          },
          grid: {
            default: 'rgba(180,180,180,.3)',
            label: 'Grid',
            component: 'el-color-picker',
            props: { 'show-alpha': true }
          },
          selected: {
            default: 'rgba(200, 231, 249, 1)',
            label: 'Waveform selected',
            component: 'el-color-picker',
            props: { 'show-alpha': true }
          },
          selectedWindow: {
            default: 'rgba(0, 0, 0, 0.1)',
            label: 'Selected time window',
            component: 'el-color-picker',
            props: { 'show-alpha': true }
          },
          border: {
            default: '#000000',
            label: 'Border',
            component: 'el-color-picker',
            props: {}
          },
          text: {
            default: '#000000',
            label: 'X axis text',
            component: 'el-color-picker',
            props: {}
          },
          labelBackground: {
            default: 'rgba(75, 75, 75, 0.8)',
            label: 'Label background',
            component: 'el-color-picker',
            props: { 'show-alpha': true }
          },
          labelText: {
            default: '#ffffff',
            label: 'Label text',
            component: 'el-color-picker',
            props: {}
          },
          line: {
            default: '#9cb9c9',
            label: 'Line',
            component: 'el-color-picker',
            props: {}
          },
          avgLine: {
            default: 'rgba(180,180,180,.3)',//'#a6dfea',
            label: 'Average line',
            component: 'el-color-picker',
            props: { 'show-alpha': true }
          },
          theoretical: {
            default: '#0000ff',
            label: 'Pick theoretical',
            component: 'el-color-picker',
            props: {}
          },
          automatic: {
            default: '#ff0000',
            label: 'Pick automatic',
            component: 'el-color-picker',
            props: {}
          },
          manual: {
            default: '#1ab11b',
            label: 'Pick manual',
            component: 'el-color-picker',
            props: {}
          }
        }
      },
      pickerSizes: {
        label: 'Picker sizes',
        fields: {
          pickerWaveformHeight: {
            default: 120,
            label: 'Picker waveform height [px]',
            component: 'el-input-number',
            props: { min: 0, step: 1 }
          },
          listWaveformHeight: {
            default: 40,
            label: 'List waveform height [px]',
            component: 'el-input-number',
            props: { min: 0, step: 1 }
          }
        }
      }
    }
    let storedSettings = localStorage.getItem(STORAGE_KEY)
    storedSettings = storedSettings != null ? JSON.parse(storedSettings) : {}
    for (let [formKey, form] of Object.entries(formStruct)) {
      for (let [key, field] of Object.entries(form.fields)) {
        let k = `${formKey}.${key}`
        field.value = storedSettings[k] != null ? storedSettings[k] : field.default
      }
    }
    return {
      formStruct
    }
  },
  methods: {
    handleResetParameter (formKey, key) {
      let field = this.formStruct[formKey].fields[key]
      field.value = field.default
    },
    handleSaveSettings () {
      let toStore = {}
      for (let [formKey, form] of Object.entries(formStruct)) {
        for (let [key, field] of Object.entries(form.fields)) {
          let k = `${formKey}.${key}`
          if (v.value != v.default) {
            toStore[k] = v.value
          }
        }
      }
      this.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
    }
  }
}
</script>

<style>
.field, .field > * {
  display: inline-block;
  vertical-align: middle;
}
.field {
  font-size: .9em;
  padding: 10px 0;
  width: 400px;
}
.field .label {
  padding-right: 10px;
  width: 200px;
  text-align: right;
}
</style>
