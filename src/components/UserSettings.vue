<template>
  <div>
    <h1>Settings</h1>
    <div v-for="(form, mainKey) in formStruct">
      <h4>{{ form.label }}</h4>
      <div class="field" v-for="(field, subKey) in form.fields">
        <div class="label">{{ field.label }}</div>
        <component :is="field.component" v-model="field.value" v-bind="field.props"></component>
        <el-button
          v-if="field.value != field.default"
          type="text" size="mini"
          @click="handleResetParameter(mainKey, subKey)">reset</el-button>
      </div>
    </div>
    <div class="text-center">
      <el-button type="primary" size="medium" @click="handleSaveSettings">Save</el-button>
    </div>
  </div>
</template>

<script>
export default {
  props: ['value'],
  data () {
    let formStruct = {
      pickerColor: {
        label: 'Picker colors',
        fields: {
          amplitudeValue: {
            label: 'Text amplitude value',
            component: 'el-color-picker',
            props: {}
          },
          background: {
            label: 'Waveform background',
            component: 'el-color-picker',
            props: { 'show-alpha': true }
          },
          backgroundEven: {
            label: 'Waveform background even',
            component: 'el-color-picker',
            props: { 'show-alpha': true }
          },
          grid: {
            label: 'Grid',
            component: 'el-color-picker',
            props: { 'show-alpha': true }
          },
          selected: {
            label: 'Waveform selected',
            component: 'el-color-picker',
            props: { 'show-alpha': true }
          },
          selectedWindow: {
            label: 'Selected time window',
            component: 'el-color-picker',
            props: { 'show-alpha': true }
          },
          border: {
            label: 'Border',
            component: 'el-color-picker',
            props: {}
          },
          text: {
            label: 'X axis text',
            component: 'el-color-picker',
            props: {}
          },
          labelBackground: {
            label: 'Label background',
            component: 'el-color-picker',
            props: { 'show-alpha': true }
          },
          labelText: {
            label: 'Label text',
            component: 'el-color-picker',
            props: {}
          },
          line: {
            label: 'Line',
            component: 'el-color-picker',
            props: {}
          },
          avgLine: {
            label: 'Average line',
            component: 'el-color-picker',
            props: { 'show-alpha': true }
          },
          theoretical: {
            label: 'Pick theoretical',
            component: 'el-color-picker',
            props: {}
          },
          automatic: {
            label: 'Pick automatic',
            component: 'el-color-picker',
            props: {}
          },
          manual: {
            label: 'Pick manual',
            component: 'el-color-picker',
            props: {}
          }
        }
      },
      pickerSize: {
        label: 'Picker sizes',
        fields: {
          pickerWaveformHeight: {
            label: 'Picker waveform height [px]',
            component: 'el-input-number',
            props: { min: 0, step: 1 }
          },
          listWaveformHeight: {
            label: 'List waveform height [px]',
            component: 'el-input-number',
            props: { min: 0, step: 1 }
          }
        }
      },
      pickerKeybinding: {
        label: 'Picker key binding',
        fields: {
          nextStation: {
            label: 'Next station',
            component: 'el-input',
            props: {}
          },
          previousStation: {
            label: 'Previous station',
            component: 'el-input',
            props: {}
          },
          setPolarityPositive: {
            label: 'Set polarity positive',
            component: 'el-input',
            props: {}
          },
          setPolarityNegative: {
            label: 'Set polarity negative',
            component: 'el-input',
            props: {}
          },
          setNoPolarity: {
            label: 'Set no polarity',
            component: 'el-input',
            props: {}
          },
          setPickerPhaseP: {
            label: 'Set picker phase P',
            component: 'el-input',
            props: {}
          },
          setPickerPhaseS: {
            label: 'Set picker phase S',
            component: 'el-input',
            props: {}
          },
          deletePick: {
            label: 'Delete pick',
            component: 'el-input',
            props: {}
          },
          alignToOrigin: {
            label: 'Align waveforms to origin',
            component: 'el-input',
            props: {}
          },
          alignToP: {
            label: 'Align waveforms to P',
            component: 'el-input',
            props: {}
          },
          alignToS: {
            label: 'Align waveforms to S',
            component: 'el-input',
            props: {}
          },
          toggleFilter: {
            label: 'Toggle filter',
            component: 'el-input',
            props: {}
          },
          toggleEqualScale: {
            label: 'Toggle equal scale',
            component: 'el-input',
            props: {}
          }
        }
      }
    }
    for (let [key, field] of Object.entries(this.value)) {
      let [mainKey, subKey] = key.split('.')
      Object.assign(formStruct[mainKey].fields[subKey], field)
    }
    return {
      formStruct
    }
  },
  methods: {
    handleResetParameter (mainKey, subKey) {
      let field = this.formStruct[mainKey].fields[subKey]
      field.value = field.default
    },
    handleSaveSettings () {
      for (let [key, field] of Object.entries(this.value)) {
        let [mainKey, subKey] = key.split('.')
        field.value = this.formStruct[mainKey].fields[subKey].value
      }
      this.$emit('input', this.value)
      this.$emit('settings-updated')
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
.field .el-input {
  width: 130px;
}
</style>
