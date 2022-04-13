<template>
  <div>
    <h1>Settings</h1>
    <div class="my-3">
      <v-switch v-model="themeDarkValue" label="General dark theme"></v-switch>
    </div>
    <div class="my-3">
      Picker color mode
      <v-btn @click="handleLightModeClick" light small>light</v-btn>
      <v-btn @click="handleDarkModeClick" dark small>dark</v-btn>
      <v-btn @click="handleSolirizedModeClick" color="blue-grey darken-4" small>solirized</v-btn>
    </div>
    <div v-for="(form, mainKey) in formStruct" class="my-3" :key="mainKey">
      <h3>{{ form.label }}</h3>
      <div class="setting-view__field" v-for="(field, subKey) in form.fields" :key="subKey">
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
    <div class="my-3">
      <h3>Filters</h3>
      <table class="settings-view__filter-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Order</th>
            <th>Cutoff frequencies</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(f, i) in filterList" :key="i">
            <td>{{ f.name }}</td>
            <td>{{ f.type }}</td>
            <td>{{ f.order }}</td>
            <td>{{ f.type == 'bandpass' ? `${f.fc[0]} - ${f.fc[1]}` : f.fc }}</td>
            <td>
              <v-btn @click="editFilter(i)" icon small><v-icon>mdi-pencil</v-icon></v-btn>
              <v-btn @click="deleteFilter(i)" icon small><v-icon>mdi-delete</v-icon></v-btn>
              <v-btn @click="moveFilterUp(i)" icon small v-if="i > 0"><v-icon>mdi-chevron-up</v-icon></v-btn>
              <v-btn @click="moveFilterDown(i)" icon small v-if="i < (filterList.length - 1)"><v-icon>mdi-chevron-down</v-icon></v-btn>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="text-xs-right">
        <v-btn @click="addFilter">Add filter</v-btn>
      </div>
    </div>
    <v-dialog v-model="filterDialog" max-width="600px">
      <v-card>
        <v-card-title>
          <span class="headline">{{ filterForm.filterIndex != null ? 'Edit' : 'Add' }} filter</span>
        </v-card-title>
        <v-card-text>
          <v-layout wrap>
            <v-flex xs12>
              <v-text-field label="Name" v-model="filterForm.name"></v-text-field>
            </v-flex>
            <v-flex xs12>
              <v-select label="Type" :items="filterForm.typeItems" v-model="filterForm.type"></v-select>
            </v-flex>
            <template v-if="filterForm.type == 'bandpass'">
              <v-flex xs6 class="pr-1">
                <number-field label="Cuttoff 1" v-model="filterForm.fc1"></number-field>
              </v-flex>
              <v-flex xs6 class="pl-1">
                <number-field label="Cuttoff 2" v-model="filterForm.fc2"></number-field>
              </v-flex>
            </template>
            <v-flex xs12 v-else>
              <number-field label="Cuttoff" v-model="filterForm.fc1"></number-field>
            </v-flex>
            <v-flex xs12>
              <number-field label="Order" v-model="filterForm.order"></number-field>
            </v-flex>
          </v-layout>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            @click="handleFilterFormSubmit"
            color="primary"
            :disabled="!isfilterFormValid"
            small flat>Submit</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-btn
      class="mt-5"
      fab fixed top right color="primary"
      title="Save settings"
      @click="handleSaveSettings">
      <v-icon>mdi-floppy</v-icon>
    </v-btn>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import * as utils from '@/utils/utils'
import formStruct from '@/utils/settingsFormStruct'

export default Vue.extend({

  data () {
    for (let [mainKey, form] of Object.entries(formStruct)) {
      for (let [subKey, field] of Object.entries(form.fields)) {
        let key = `${mainKey}.${subKey}`
        field.value = this.$store.state.settings[key]
        field.default = this.$store.state.defaultSettings[key]
      }
    }
    return {
      formStruct,
      themeDarkValue: this.$store.state.settings.themeDark,
      currentShortcut: '',
      filterDialog: false,
      filterList: JSON.parse(JSON.stringify(this.$store.state.settings['picker.filters'])),
      filterForm: {
        filterIndex: null,
        type: 'lowpass',
        typeItems: ['lowpass', 'bandpass', 'highpass'],
        name: null,
        order: 4,
        fc1: null,
        fc2: null
      }
    }
  },

  mounted () {
    document.body.addEventListener('keydown', this.handleKeyDown)
  },

  beforeDestroy () {
    document.body.removeEventListener('keydown', this.handleKeyDown)
  },

  computed: {
    isfilterFormValid () {
      let f = this.filterForm
      if (f.type == 'bandpass') {
        if (f.fc1 == null || f.fc2 == null) {
          return false
        }
        if (f.fc1 >= f.fc2) {
          return false
        }
      } else {
        if (f.fc1 == null) {
          return false
        }
      }
      return true
    }
  },

  methods: {

    addFilter () {
      let f = this.filterForm
      f.filterIndex = null
      Object.assign(f, { name: null, order: 4, type: 'lowpass', fc1: null, fc2: null })
      this.filterDialog = true
    },

    editFilter (i) {
      let f = this.filterForm
      f.name = this.filterList[i].name
      f.type = this.filterList[i].type
      f.order = this.filterList[i].order
      if (f.type == 'bandpass') {
        f.fc1 = this.filterList[i].fc[0]
        f.fc2 = this.filterList[i].fc[1]
      } else {
        f.fc1 = this.filterList[i].fc
      }
      this.filterDialog = true
    },

    deleteFilter (i) {
      this.filterList.splice(i, 1)
    },

    moveFilterUp (i) {
      const f = this.filterList.splice(i, 1)[0]
      this.filterList.splice(i - 1, 0, f)
    },

    moveFilterDown (i) {
      const f = this.filterList.splice(i, 1)[0]
      this.filterList.splice(i + 1, 0, f)
    },

    handleFilterFormSubmit () {
      let f = this.filterForm
      let result = { type: f.type, name: f.name, order: f.order }
      if (f.type == 'bandpass') {
        result.fc = [f.fc1, f.fc2]
      } else {
        result.fc = f.fc1
      }
      if (f.filterIndex != null) {
        this.filterList.splice(f.filterIndex, 1, result)
      } else {
        this.filterList.push(result)
      }
      this.filterDialog = false
    },

    handleKeyDown (ev) {
      this.currentShortcut = utils.shortcutString(ev)
      // console.log(this.currentShortcut);
    },

    handleDarkModeClick () {
      for (let [k, v] of Object.entries(this.$store.state.defaultSettings)) {
        let [mainKey, subKey] = k.split('.')
        if (mainKey == 'darkPickerColor') {
          this.formStruct['pickerColor'].fields[subKey].value = v
        }
      }
    },

    handleSolirizedModeClick () {
      for (let [k, v] of Object.entries(this.$store.state.defaultSettings)) {
        let [mainKey, subKey] = k.split('.')
        if (mainKey == 'solirizedPickerColor') {
          this.formStruct['pickerColor'].fields[subKey].value = v
        }
      }
    },

    handleLightModeClick () {
      let defaultSettings = this.$store.state.defaultSettings
      for (let [k, v] of Object.entries(defaultSettings)) {
        let [mainKey, subKey] = k.split('.')
        if (mainKey == 'darkPickerColor' || mainKey == 'solirizedPickerColor') {
          let key = `pickerColor.${subKey}`
          this.formStruct['pickerColor'].fields[subKey].value = defaultSettings[key]
        }
      }
    },

    handleResetParameter (mainKey, subKey) {
      let field = this.formStruct[mainKey].fields[subKey]
      field.value = field.default
    },

    getSettingsFromForm () {
      let result = {}
      for (let [mainKey, form] of Object.entries(this.formStruct)) {
        for (let [subKey, field] of Object.entries(form.fields)) {
          let key = `${mainKey}.${subKey}`
          result[key] = field.value
        }
      }
      result['picker.filters'] = this.filterList
      result['themeDark'] = this.themeDarkValue
      return result
    },

    handleSaveSettings () {
      this.$store.dispatch('setSettings', this.getSettingsFromForm())
    }

  }
})
</script>

<style>
.setting-view__field {
  display: inline-block;
  vertical-align: top;
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
.settings-view__filter-table {
  width: 100%;
  border-collapse: collapse;
}
.settings-view__filter-table th,
.settings-view__filter-table td {
  padding: 5px;
  border: 1px solid #ddd;
  text-align: center;
}
</style>
