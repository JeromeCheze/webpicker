import { SettingsFormStruct } from '@/types'

const settings: SettingsFormStruct = {
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
      nll_theoretical: {
        component: 'color-picker',
        props: {
          label: 'Pick theoretical (NLL)',
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
      },
      phasenet: {
        component: 'color-picker',
        props: {
          label: 'Pick phasenet',
          format: 'hex'
        }
      }
    }
  },
  pickerProgressBar: {
    label: 'Picker progress bar',
    fields: {
      color: {
        component: 'color-picker',
        props: {
          label: 'Color',
          format: 'hex'
        }
      },
      size: {
        component: 'number-field',
        props: {
          label: 'Size [px]'
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
      listWaveformWrapperHeight: {
        component: 'number-field',
        props: {
          label: 'List waveform wrapper height [px]'
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
          label: 'Set no time uncertainty'
        }
      },
      setTimeUncertainty1: {
        component: 'keybinding-field',
        props: {
          label: 'Set time uncertainty level 1'
        }
      },
      setTimeUncertainty2: {
        component: 'keybinding-field',
        props: {
          label: 'Set time uncertainty level 2'
        }
      },
      setTimeUncertainty3: {
        component: 'keybinding-field',
        props: {
          label: 'Set time uncertainty level 3'
        }
      },
      setTimeUncertainty4: {
        component: 'keybinding-field',
        props: {
          label: 'Set time uncertainty level 4'
        }
      },
      setTimeUncertainty5: {
        component: 'keybinding-field',
        props: {
          label: 'Set time uncertainty level 5'
        }
      },
      setTimeUncertainty6: {
        component: 'keybinding-field',
        props: {
          label: 'Set time uncertainty level 6'
        }
      },
      setTimeUncertainty7: {
        component: 'keybinding-field',
        props: {
          label: 'Set time uncertainty level 7'
        }
      },
      setTimeUncertainty8: {
        component: 'keybinding-field',
        props: {
          label: 'Set time uncertainty level 8'
        }
      },
      setTimeUncertainty9: {
        component: 'keybinding-field',
        props: {
          label: 'Set time uncertainty level 9'
        }
      }
    }
  }
}

export default settings
