<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { pushUnique, shortcutString } from '@/utils'
import { useAppStore } from '@/stores/app'
import type { ChatData } from '@/types'

const store = useAppStore()

const model = defineModel<boolean>()

const messageContainer = ref()
const selectedAuthor = ref('')
const message = ref('')
const seen = ref([] as string[])

const contact = computed(() => {
  return store.usersActivity.filter(x => x.id !== store.authorId)
})

const messagesByDiscussion = computed(() => {
  const result: Record<string, ChatData[]> = {
    '@everyone': [],
    '': []
  }
  for (const author of contact.value) {
    result[author.id] = []
  }
  for (const message of store.chatMessages) {
    if (message.recipient === '@everyone') {
      result['@everyone'].push(message)
    } else {
      if (message.expeditor === store.authorId) {
        if (result[message.recipient] != null) {
          result[message.recipient].push(message)
        }
      } else {
        if (result[message.expeditor] != null) {
          result[message.expeditor].push(message)
        }
      }
    }
  }
  return result
})

const unseenStatusByDiscussion = computed(() => {
  const result: Record<string, boolean> = {}
  for (const [authorId, messages] of Object.entries(messagesByDiscussion.value)) {
    result[authorId] = false
    for (const message of messages) {
      if (authorId === selectedAuthor.value) {
        pushUnique(seen.value, message.id)
      } else {
        if (seen.value.indexOf(message.id) < 0) {
          result[authorId] = true
          break
        }
      }
    }
  }
  return result
})

const unseenStatusMain = computed(() => {
  return Object.values(unseenStatusByDiscussion.value).filter(x => x === true).length > 0
})

function sendMessage() {
  if (store.connected && message.value !== '') {
    store.webSocketManager.sendChatMessage(selectedAuthor.value, message.value)
    message.value = ''
  }
}

function authorFromAuthorId(authorId: string) {
  for (const author of contact.value) {
    if (author.id === authorId) {
      return author.author
    }
  }
}

function handleKeyDown(e: KeyboardEvent) {
  const key = shortcutString(e)
  if (key === 'shift+enter') {
    sendMessage()
  }
}

async function scrollBottom() {
  await nextTick()
  if (messageContainer.value != null) {
    const el = messageContainer.value.$el
    el.scrollTo(0, el.scrollHeight)
  }
}

watch([
  () => messagesByDiscussion.value,
  () => selectedAuthor.value
], () => {
  scrollBottom()
})

watch(() => messagesByDiscussion.value, () => {
  if (store.chatMessages.length > 0) {
    const lastMessage = store.chatMessages.slice(-1)[0]
    if (lastMessage.expeditor !== selectedAuthor.value && lastMessage.expeditor !== store.authorId) {
      const author = authorFromAuthorId(lastMessage.expeditor)
      store.notification.push({ type: 'info', value: `New message from @${author}` })
    }
  }
})

watch(() => model.value, () => {
  selectedAuthor.value = ''
})

onMounted(() => {
  document.body.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  document.body.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <v-menu
    :close-on-content-click="false"
    min-width="800"
    location="end center"
    origin="start top"
    attach
    v-model="model"
  >
    <template v-slot:activator="{ props }">
      <v-list-item title="Chat" v-bind="props">
        <template v-slot:prepend>
          <v-badge dot v-if="unseenStatusMain" color="red"><v-icon>mdi-message</v-icon></v-badge>
          <v-icon v-else>mdi-message</v-icon>
        </template>
      </v-list-item>
    </template>
    <v-card>
      <v-card-text>
        <v-row>
          <v-col cols="3">
            <v-list>
              <v-list-item @click="selectedAuthor = '@everyone'" :active="selectedAuthor === '@everyone'">
                <span>@everyone</span>
                <template v-slot:append>
                  <v-badge dot inline color="red" v-if="unseenStatusByDiscussion['@everyone']"></v-badge>
                </template>
              </v-list-item>
              <v-list-item
                v-for="author in contact"
                @click="selectedAuthor = author.id"
                :active="selectedAuthor === author.id"
              >
                @{{ author.author }}
                <template v-slot:append>
                  <v-badge dot inline color="red" v-if="unseenStatusByDiscussion[author.id]"></v-badge>
                </template>
              </v-list-item>
            </v-list>
          </v-col>
          <v-col cols="9" v-if="selectedAuthor !== ''">
            <v-card elevation="0">
              <v-card-text :style="{ overflowY: 'scroll', maxHeight: '500px' }" ref="messageContainer">
                <v-row :class="msg.expeditor === store.authorId ? 'd-flex justify-end' : ''" v-for="msg in messagesByDiscussion[selectedAuthor]">
                  <v-col cols="9">
                    <v-card :color="msg.expeditor === store.authorId ? 'light-blue-lighten-2' : 'blue-grey-lighten-3'" light>
                      <v-card-text v-if="selectedAuthor === '@everyone' && msg.expeditor !== store.authorId">
                        @{{ authorFromAuthorId(msg.expeditor) }}: {{ msg.message }}
                      </v-card-text>
                      <v-card-text v-else>{{ msg.message }}</v-card-text>
                    </v-card>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
            <v-card class="mt-2" elevation="0">
              <v-card-text>
                <v-row>
                  <v-col cols="10">
                    <v-textarea v-model="message" rows="1" auto-grow></v-textarea>
                  </v-col>
                  <v-col cols="2">
                    <v-btn @click="sendMessage" title="Send message (shift+enter)"><v-icon>mdi-send</v-icon></v-btn>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-menu>
</template>