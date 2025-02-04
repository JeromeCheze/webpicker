<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import type { Config } from '@/types'
import { ref, watch } from 'vue'
import { md5 } from 'js-md5'

const store = useAppStore()

const config = ref(null as Config | null)
const users = ref(null as string | null)
const password = ref('')
const showPassword = ref(false)
const configStatus = ref(null as 'success' | 'error' | null)

watch(() => store.config, (value) => {
  if (value != null) {
    config.value = JSON.parse(JSON.stringify(value))
    users.value = JSON.stringify(value.access.users, null, 2)
  }
}, { immediate: true })

function handleApplyConfig() {
  config.value!.access.users = JSON.parse(users.value!)
  fetch(`/app/config?password=${md5(password.value)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config.value)
  }).then(response => {
    if (response.status === 200) {
      response.json().then(data => {
        if (data === 'ok') {
          configStatus.value = 'success'
          setTimeout(() => configStatus.value = null, 3000)
        } else {
          configStatus.value = 'error'
          setTimeout(() => configStatus.value = null, 3000)
        }
      })
    } else {
      configStatus.value = 'error'
      setTimeout(() => configStatus.value = null, 3000)
    }
  }).catch(() => {
    configStatus.value = 'error'
    setTimeout(() => configStatus.value = null, 3000)
  })
}
</script>

<template>
  <v-card max-width="1000" :style="{ marginLeft: 'auto', marginRight: 'auto', marginTop: '10vh' }" class="pa-4">
    <v-card-title class="d-flex justify-space-between align-center">
      <div class="text-h5 text-medium-emphasis">Config</div>
    </v-card-title>
    <v-card-text v-if="config != null">
      <v-row>
        <v-col cols="12">
          <h4 class="mt-2">Access</h4>
          <v-table density="compact">
            <tbody>
              <tr>
                <th>Restricted</th>
                <td><v-checkbox v-model="config.access.restricted" label="Enable" density="compact" hide-details="auto"></v-checkbox></td>
              </tr>
              <tr>
                <th>Users</th>
                <td><v-textarea v-model="users"></v-textarea></td>
              </tr>
            </tbody>
          </v-table>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <h4 class="mt-2">Detector</h4>
          <v-table density="compact">
            <tbody>
              <tr>
                <th>Enabled</th>
                <td><v-checkbox v-model="config.detector.enabled" label="Enable" density="compact" hide-details="auto"></v-checkbox></td>
              </tr>
              <tr>
                <th>URL</th>
                <td><v-text-field v-model="config.detector.url" density="compact" hide-details="auto"></v-text-field></td>
              </tr>
            </tbody>
          </v-table>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <h4 class="mt-2">Denoiser</h4>
          <v-table density="compact">
            <tbody>
              <tr>
                <th>Enabled</th>
                <td><v-checkbox v-model="config.denoiser.enabled" label="Enable" density="compact" hide-details="auto"></v-checkbox></td>
              </tr>
              <tr>
                <th>URL</th>
                <td><v-text-field v-model="config.denoiser.url" density="compact" hide-details="auto"></v-text-field></td>
              </tr>
            </tbody>
          </v-table>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <h4 class="mt-2">NLL</h4>
          <v-table density="compact">
            <tbody>
              <tr>
                <th>Enabled</th>
                <td><v-checkbox v-model="config.nll.enabled" label="Enable" density="compact" hide-details="auto"></v-checkbox></td>
              </tr>
              <tr>
                <th>URL</th>
                <td><v-text-field v-model="config.nll.url" density="compact" hide-details="auto"></v-text-field></td>
              </tr>
              <tr>
                <th>Area</th>
                <td><v-text-field v-model="config.nll.area" density="compact" hide-details="auto"></v-text-field></td>
              </tr>
            </tbody>
          </v-table>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <h4 class="mt-2">SKHASH</h4>
          <v-table density="compact">
            <tbody>
              <tr>
                <th>Enabled</th>
                <td><v-checkbox v-model="config.skhash.enabled" label="Enable" density="compact" hide-details="auto"></v-checkbox></td>
              </tr>
              <tr>
                <th>Path</th>
                <td><v-text-field v-model="config.skhash.path" density="compact" hide-details="auto"></v-text-field></td>
              </tr>
            </tbody>
          </v-table>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <h4 class="mt-2">FDSNWS</h4>
          <v-table density="compact">
            <tbody>
              <tr>
                <th>Event host</th>
                <td><v-text-field v-model="config.fdsnws.event_host" density="compact" hide-details="auto"></v-text-field></td>
              </tr>
              <tr>
                <th>Station host</th>
                <td><v-text-field v-model="config.fdsnws.station_host" density="compact" hide-details="auto"></v-text-field></td>
              </tr>
              <tr>
                <th>Dataselect host</th>
                <td><v-text-field v-model="config.fdsnws.dataselect_host" density="compact" hide-details="auto"></v-text-field></td>
              </tr>
            </tbody>
          </v-table>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <h4 class="mt-2">Commit strategy</h4>
          <v-radio-group v-model="config.commit_strategy" inline hide-details="auto">
            <v-radio label="script" value="script"></v-radio>
            <v-radio label="scdispatch" value="scdispatch"></v-radio>
          </v-radio-group>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <h4 class="mt-2">Commit script</h4>
          <v-table density="compact">
            <tbody>
              <tr>
                <th>Path</th>
                <td><v-text-field v-model="config.commit_script" density="compact" hide-details="auto"></v-text-field></td>
              </tr>
            </tbody>
          </v-table>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <h4 class="mt-2">SeisComP</h4>
          <v-table density="compact">
            <tbody>
              <tr>
                <th>Messaging host</th>
                <td><v-text-field v-model="config.seiscomp.messaging_host" density="compact" hide-details="auto"></v-text-field></td>
              </tr>
              <tr>
                <th>Root</th>
                <td><v-text-field v-model="config.seiscomp.root" density="compact" hide-details="auto"></v-text-field></td>
              </tr>
              <tr>
                <th>Schema version</th>
                <td><v-text-field v-model="config.seiscomp.schema_version" density="compact" hide-details="auto"></v-text-field></td>
              </tr>
            </tbody>
          </v-table>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12"><hr></v-col>
      </v-row>
      <v-row class="d-flex justify-center my-8">
        <v-col cols="4">
          <v-text-field
            :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
            :type="showPassword ? 'text' : 'password'"
            v-model="password"
            density="compact"
            hide-details="auto"
            label="Password"
            @click:append="showPassword = !showPassword"
          ></v-text-field>
        </v-col>
        <v-col cols="2" class="text-center">
          <v-btn v-if="configStatus === 'success'" prepend-icon="mdi-check-circle-outline" color="success">Save</v-btn>
          <v-btn v-else-if="configStatus === 'error'" prepend-icon="mdi-alert-circle-outline" color="error">Save failed: some fields are invalid</v-btn>
          <v-btn v-else color="primary" @click="handleApplyConfig">Save</v-btn>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>
