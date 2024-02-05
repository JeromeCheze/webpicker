<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const authorDialog = ref(store.author == null)
const authorValue = ref(store.author || '')
const drawer = ref(true)
const rail = ref(false)
const logDialog = ref(false)

function handleCreateEventClick() {
  // TODO
}

function handleSetAuthor() {
  localStorage.setItem('author', authorValue.value)
  store.author = authorValue.value
  authorDialog.value = false
}

onMounted(() => {
  const appDiv = document.body.querySelector('.v-application') as HTMLElement | null
  if (appDiv != null) {
    appDiv.style.background = 'linear-gradient(153deg, rgba(255,133,0,1) 0%, rgba(79,21,120,1) 100%)'
    // appDiv.style.background = '#E3E9F0'
  }
  document.body.addEventListener('keydown', ev => {
    store.keydownEvent = ev
  })
  document.body.addEventListener('keyup', ev => {
    store.keydownEvent = null
  })
  document.body.addEventListener('wheel', ev => {
    if (ev.ctrlKey) {
      ev.preventDefault()
    }
  }, { passive: false })
})
</script>

<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" :rail="rail" permanent>
      <v-list nav>
        <v-list-item prepend-avatar="@/assets/webpicker_icon.png" class="font-weight-bold" @click.stop="rail = !rail">
          WebPicker
          <template v-slot:append>
            <v-btn variant="text" icon="mdi-chevron-left" @click.stop="rail = !rail"></v-btn>
          </template>
        </v-list-item>
        <v-divider></v-divider>
        <v-list-item :to="{ name: 'form' }" title="Form" prepend-icon="mdi-pencil"></v-list-item>
        <v-list-item :to="{ name: 'query' }" title="Result" prepend-icon="mdi-database"></v-list-item>
        <v-list-item
          :to="{ name: 'event', params: { eventid: store.currentEvent.public_id } }"
          :title="store.currentEvent.public_id"
          prepend-icon="mdi-bullseye"
          v-if="store.currentEvent != null"
        ></v-list-item>
        <v-divider></v-divider>
        <v-list-item title="Settings" prepend-icon="mdi-cog"></v-list-item>
        <v-list-item title="Logs" prepend-icon="mdi-console"></v-list-item>
        <v-divider></v-divider>
        <v-list-item :title="store.author || 'undefined'" prepend-icon="mdi-account" @click="authorDialog = true"></v-list-item>
      </v-list>
    </v-navigation-drawer>
    <v-main>
      <v-container fluid>
        <RouterView />
      </v-container>
    </v-main>
    <v-dialog v-model="authorDialog" persistent width="500">
      <v-card>
        <v-card-title>Set author</v-card-title>
        <v-card-text>
          <v-text-field label="Author" required v-model="authorValue"></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="handleSetAuthor" :disabled="authorValue == ''">OK</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<style>
.circle {
  width: 10px;
  height: 10px;
  background: white;
  border: 1px solid black;
  border-radius: 6px;
}

.c-move {
  cursor: move;
}

.c-ns-resize {
  cursor: ns-resize;
}
</style>