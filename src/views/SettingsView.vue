<template>
  <div>
    <h1>Settings</h1>
    <div class="my-3">
      Picker color mode
      <v-btn @click="handleDarkModeClick" dark small>dark</v-btn>
      <v-btn @click="handleLightModeClick" light small>light</v-btn>
    </div>
    <div v-for="(form, mainKey) in formStruct" class="my-3">
      <h3>{{ form.label }}</h3>
      <div class="setting-view__field" v-for="(field, subKey) in form.fields">
        <div class="setting-view__field--input">
          <keybinding-field
            v-if="field.component == 'keybinding-field'"
            v-model="field.value"
            :key-value="currentShortcut"
            v-bind="field.props"></keybinding-field>
          <component
            v-else
            :is="field.component"
            v-model="field.value"
            v-bind="field.props"></component>
        </div>
        <div class="setting-view__field--reset">
          <v-btn
            v-if="field.value != field.default"
            @click="handleResetParameter(mainKey, subKey)"
            color="primary" small flat>reset</v-btn>
        </div>
      </div>
    </div>
    <div class="text-center">
      <v-btn color="primary" @click="handleSaveSettings">Save</v-btn>
    </div>
  </div>
</template>

<script>
import utils from '@/utils/utils'

export default {

  props: ['value'],

  data () {
    let formStruct = {
      pickerColor: {
        label: 'Picker colors',
        fields: {
          amplitudeValue: {
            component: 'color-picker',
            props: {
              label: 'Text amplitude value',
              format: 'hex'
            }
          },
          background: {
            component: 'color-picker',
            props: {
              label: 'Waveform background',
              format: 'rgba'
            }
          },
          backgroundEven: {
            component: 'color-picker',
            props: {
              label: 'Waveform background even',
              format: 'rgba'
            }
          },
          grid: {
            component: 'color-picker',
            props: {
              label: 'Grid',
              format: 'rgba'
            }

          },
          selected: {
            component: 'color-picker',
            props: {
              label: 'Waveform selected',
              format: 'rgba'
            }
          },
          selectedWindow: {
            component: 'color-picker',
            props: {
              label: 'Selected time window',
              format: 'rgba'
            }
          },
          border: {
            component: 'color-picker',
            props: {
              label: 'Border',
              format: 'hex'
            }
          },
          text: {
            component: 'color-picker',
            props: {
              label: 'X axis text',
              format: 'hex'
            }
          },
          labelBackground: {
            component: 'color-picker',
            props: {
              label: 'Label background',
              format: 'rgba'
            }
          },
          labelText: {
            component: 'color-picker',
            props: {
              label: 'Label text',
              format: 'hex'
            }
          },
          line: {
            component: 'color-picker',
            props: {
              label: 'Line',
              format: 'hex'
            }
          },
          lineBar: {
            component: 'color-picker',
            props: {
              label: 'Line bar',
              format: 'hex'
            }
          },
          avgLine: {
            component: 'color-picker',
            props: {
              label: 'Average line',
              format: 'rgba'
            }
          },
          theoretical: {
            component: 'color-picker',
            props: {
              label: 'Pick theoretical',
              format: 'hex'
            }
          },
          automatic: {
            component: 'color-picker',
            props: {
              label: 'Pick automatic',
              format: 'hex'
            }
          },
          manual: {
            component: 'color-picker',
            props: {
              label: 'Pick manual',
              format: 'hex'
            }
          }
        }
      },
      pickerSize: {
        label: 'Picker sizes',
        fields: {
          pickerWaveformHeight: {
            component: 'number-field',
            props: {
              label: 'Picker waveform height [px]'
            }
          },
          listWaveformHeight: {
            component: 'number-field',
            props: {
              label: 'List waveform height [px]'
            }
          }
        }
      },
      pickerKeybinding: {
        label: 'Picker key binding',
        fields: {
          nextStation: {
            component: 'keybinding-field',
            props: {
              label: 'Next station'
            }
          },
          previousStation: {
            component: 'keybinding-field',
            props: {
              label: 'Previous station'
            }
          },
          setPolarityPositive: {
            component: 'keybinding-field',
            props: {
              label: 'Set polarity positive'
            }
          },
          setPolarityNegative: {
            component: 'keybinding-field',
            props: {
              label: 'Set polarity negative'
            }
          },
          setNoPolarity: {
            component: 'keybinding-field',
            props: {
              label: 'Set no polarity'
            }
          },
          leavePickingMode: {
            component: 'keybinding-field',
            props: {
              label: 'Leave picking mode'
            }
          },
          setPickerPhaseP: {
            component: 'keybinding-field',
            props: {
              label: 'Set picker phase P'
            }
          },
          setPickerPhaseS: {
            component: 'keybinding-field',
            props: {
              label: 'Set picker phase S'
            }
          },
          deletePick: {
            component: 'keybinding-field',
            props: {
              label: 'Delete pick'
            }
          },
          alignToOrigin: {
            component: 'keybinding-field',
            props: {
              label: 'Align waveforms to origin'
            }
          },
          alignToP: {
            component: 'keybinding-field',
            props: {
              label: 'Align waveforms to P'
            }
          },
          alignToS: {
            component: 'keybinding-field',
            props: {
              label: 'Align waveforms to S'
            }
          },
          toggleFilter: {
            component: 'keybinding-field',
            props: {
              label: 'Toggle filter'
            }
          },
          toggleEqualScale: {
            component: 'keybinding-field',
            props: {
              label: 'Toggle equal scale'
            }
          },
          createPick: {
            component: 'keybinding-field',
            props: {
              label: 'Create pick'
            }
          },
          movePickLineRight: {
            component: 'keybinding-field',
            props: {
              label: 'Move pickline to the right'
            }
          },
          moveFastPickLineRight: {
            component: 'keybinding-field',
            props: {
              label: 'Move fast the pickline to the right'
            }
          },
          movePickLineLeft: {
            component: 'keybinding-field',
            props: {
              label: 'Move pickline to the left'
            }
          },
          moveFastPickLineLeft: {
            component: 'keybinding-field',
            props: {
              label: 'Move fast the pickline to the left'
            }
          },
          xZoomIn: {
            component: 'keybinding-field',
            props: {
              label: 'X zoom in '
            }
          },
          xZoomOut: {
            component: 'keybinding-field',
            props: {
              label: 'X zoom out'
            }
          },
          yZoomIn: {
            component: 'keybinding-field',
            props: {
              label: 'Y zoom in'
            }
          },
          yZoomOut: {
            component: 'keybinding-field',
            props: {
              label: 'Y zoom out'
            }
          },
          setFocusComponentZ: {
            component: 'keybinding-field',
            props: {
              label: 'Select component Z'
            }
          },
          setFocusComponentN: {
            component: 'keybinding-field',
            props: {
              label: 'Select component N'
            }
          },
          setFocusComponentE: {
            component: 'keybinding-field',
            props: {
              label: 'Select component E'
            }
          },
          setTimeUncertainty0: {
            component: 'keybinding-field',
            props: {
              label: 'Set no time unvertainty'
            }
          },
          setTimeUncertainty1: {
            component: 'keybinding-field',
            props: {
              label: 'Set time unvertainty level 1'
            }
          },
          setTimeUncertainty2: {
            component: 'keybinding-field',
            props: {
              label: 'Set time unvertainty level 2'
            }
          },
          setTimeUncertainty3: {
            component: 'keybinding-field',
            props: {
              label: 'Set time unvertainty level 3'
            }
          },
          setTimeUncertainty4: {
            component: 'keybinding-field',
            props: {
              label: 'Set time unvertainty level 4'
            }
          },
          setTimeUncertainty5: {
            component: 'keybinding-field',
            props: {
              label: 'Set time unvertainty level 5'
            }
          },
          setTimeUncertainty6: {
            component: 'keybinding-field',
            props: {
              label: 'Set time unvertainty level 6'
            }
          },
          setTimeUncertainty7: {
            component: 'keybinding-field',
            props: {
              label: 'Set time unvertainty level 7'
            }
          },
          setTimeUncertainty8: {
            component: 'keybinding-field',
            props: {
              label: 'Set time unvertainty level 8'
            }
          },
          setTimeUncertainty9: {
            component: 'keybinding-field',
            props: {
              label: 'Set time unvertainty level 9'
            }
          }
        }
      }
    }
    for (let [mainKey, form] of Object.entries(formStruct)) {
      for (let [subKey, field] of Object.entries(form.fields)) {
        let key = `${mainKey}.${subKey}`
        field.value = this.$store.state.settings[key]
        field.default = this.$store.state.defaultSettings[key]
      }
    }
    return {
      formStruct,
      currentShortcut: ''
    }
  },

  mounted () {
    document.body.addEventListener('keydown', this.handleKeyDown)
  },

  beforeDestroy () {
    document.body.removeEventListener('keydown', this.handleKeyDown)
  },

  methods: {

    handleKeyDown (ev) {
      this.currentShortcut = utils.shortcutString(ev)
      console.log(this.currentShortcut);
    },

    handleDarkModeClick () {
      for (let [k, v] of Object.entries(this.$store.state.defaultSettings)) {
        let [mainKey, subKey] = k.split('.')
        if (mainKey == 'darkPickerColor') {
          this.formStruct['pickerColor'].fields[subKey].value = v
        }
      }
    },

    handleLightModeClick () {
      let defaultSettings = this.$store.state.defaultSettings
      for (let [k, v] of Object.entries(defaultSettings)) {
        let [mainKey, subKey] = k.split('.')
        if (mainKey == 'darkPickerColor') {
          let key = `pickerColor.${subKey}`
          this.formStruct['pickerColor'].fields[subKey].value = defaultSettings[key]
        }
      }
    },

    handleResetParameter (mainKey, subKey) {
      let field = this.formStruct[mainKey].fields[subKey]
      field.value = field.default
    },

    handleSaveSettings () {
      let result = {}
      for (let [mainKey, form] of Object.entries(this.formStruct)) {
        for (let [subKey, field] of Object.entries(form.fields)) {
          let key = `${mainKey}.${subKey}`
          result[key] = field.value
        }
      }
      this.$store.dispatch('setSettings', result)
    }

  }
}
</script>

<style>
.setting-view__field {
  display: inline-block;
  padding-right: 20px;
  width: 30%;
}
.setting-view__field--input {
  display: inline-block;
  min-width: 100px;
}
.setting-view__field--reset {
  display: inline-block;
  width: 100px;
}
/*.field, .field > * {
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
.field .v-text-field {
  width: 130px;
}*/
</style>
