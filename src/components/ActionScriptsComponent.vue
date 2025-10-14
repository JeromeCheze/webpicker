<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import { toQuakeML } from '@/utils'
import { ref, watch } from 'vue'

interface ScriptOutput {
  return_code: number | null
  message: string | null
  minified: boolean
}

const store = useAppStore()

const dialog = ref(false)

const status = ref(store.config?.action_scripts.map(x => ({
  return_code: null,
  message: null
})) as ScriptOutput[])

function handleActionScript(index: number) {
  fetch(`../api/script/${index}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/xml'},
    body: toQuakeML(store.eventManager.current.event!.desc)
  }).then(response => {
    if (response.status === 200) {
      response.json().then(statusResponse => {
        console.log(`[ActionScriptsComponent] result: ${JSON.stringify(statusResponse)}`)
        status.value[index].message = statusResponse.message
        status.value[index].return_code = statusResponse.return_code
      })
    }
  })
}

function clearOuputs(index: number) {
  status.value[index].message = null
  status.value[index].return_code = null
}

watch(() => store.config, () => {
  status.value = store.config?.action_scripts.map(x => ({
    return_code: null,
    message: null,
    minified: true
  })) as ScriptOutput[]
})

</script>

<template>
  <v-dialog v-model="dialog" width="800">
    <template #activator="{ props: activatorProps }">
      <v-btn v-bind="activatorProps" title="Action scripts">
        <v-icon>mdi-script-text-play-outline</v-icon>
      </v-btn>
    </template>
    <v-card>
      <v-card-title>Action scripts</v-card-title>
      <v-card-text>
        <v-row v-for="(item, i) in store.config?.action_scripts" :key="i">
          <v-col cols="2">
            <bv-btn-group>
              <v-btn icon="mdi-play-outline" variant="plain" @click="() => handleActionScript(i)" title="Run script"></v-btn>
              <v-menu>
                <template #activator="{ props: menuProps }">
                  <v-btn icon="mdi-dots-vertical" variant="plain" v-bind="menuProps" title="More actions"></v-btn>
                </template>
                <v-list>
                  <v-list-item @click="() => clearOuputs(i)">
                    <v-list-item-title >Clear outputs</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </bv-btn-group>
          </v-col>
          <v-col cols="10">
            <h4>
              <v-btn
                variant="plain"
                :icon="status[i].minified ? 'mdi-eye-outline' : 'mdi-eye-off-outline'"
                title="Toggle script"
                @click="status[i].minified = !status[i].minified"/>
              {{ item.label }}
            </h4>
            <v-textarea v-model="item.script" readonly v-if="!status[i].minified"></v-textarea>
          </v-col>
          <v-col cols="2" v-if="status[i].return_code != null">[{{ status[i].return_code }}]</v-col>
          <v-col cols="10" v-if="status[i].return_code != null" :style="{ maxHeight: 400, overflow: 'auto' }">
            <pre>{{ status[i].message }}</pre>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
