import type { ActivityData, ChatData, WebSocketMessage, WebSocketResponse } from "@/types"
import version from '@/version.json'
import { getId } from '@/utils'

export default class WebSocketManager {
  ws: WebSocket | null
  _authorId: string
  _author: string
  _state: string
  _event: string
  usersActivity: ActivityData[]
  newVersionCallback: (value: boolean) => void
  updateActivityCallback: (usersActivity: ActivityData[]) => void
  connectionCallback: (connected: boolean) => void
  chatCallback: (chatMessage: ChatData) => void
  updateEventCallback: (eventid: string) => void

  constructor(
    author: string,
    authorId: string,
    newVersionCallback: (value: boolean) => void,
    updateActivityCallback: (usersActivity: ActivityData[]) => void,
    connectionCallback: (connected: boolean) => void,
    chatCallback: (chatMessage: ChatData) => void,
    updateEventCallback: (eventid: string) => void
  ) {
    this.ws = null
    this.usersActivity = []
    this._authorId = authorId
    this._author = author
    this._state = 'online'
    this._event = ''
    this.newVersionCallback = newVersionCallback
    this.updateActivityCallback = updateActivityCallback
    this.connectionCallback = connectionCallback
    this.chatCallback = chatCallback
    this.updateEventCallback = updateEventCallback
    this.connect()
  }

  set author(value: string) {
    this._author = value
    this._sendActivity()
  }

  _sendActivity() {
    const msg: WebSocketMessage = {
      type: 'activity',
      data: {
        id: this._authorId,
        author: this._author,
        state: this._state,
        event: this._event
      }
    }
    this.ws!.send(JSON.stringify(msg))
  }

  eventUsers(event: string) {
    return this.usersActivity.filter(x => x.event === event).map(x => x.author)
  }

  update(state: string, event='') {
    this._state = state
    this._event = event
    if (this.ws != null && this.ws.readyState === this.ws.OPEN) {
      this._sendActivity()
    }
  }

  sendChatMessage(recipient: string, message: string) {
    const broadcast = recipient === '@everyone'
    const msg: WebSocketMessage = {
      type: 'chat',
      data: {
        id: getId('message'),
        time: new Date().toISOString(),
        expeditor: this._authorId,
        recipient,
        message,
        broadcast
      }
    }
    if (!broadcast) {
      this.chatCallback(msg.data as ChatData)
    }
    this.ws!.send(JSON.stringify(msg))
  }

  sendUpdateEventMessage(eventid: string) {
    const msg: WebSocketMessage = {
      type: 'updateEvent',
      data: eventid
    }
    this.ws!.send(JSON.stringify(msg))
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${location.protocol.replace('http', 'ws')}//${location.host}/ws`)
      this.ws.onmessage = msg => {
        const data = JSON.parse(msg.data) as WebSocketResponse
        if (data.type === 'version') {
          if (data.data !== version) {
            console.log(`webpicker version is invalid (${data.data} === ${version})`)
            this.newVersionCallback(true)
          } else {
            console.log(`webpicker version is valid (${data.data} === ${version})`)
            this._sendActivity()
          }
        } else if (data.type === 'activity') {
          this.usersActivity = data.data as ActivityData[]
          this.updateActivityCallback(this.usersActivity)
        } else if (data.type === 'chat') {
          const chatData = data.data as ChatData
          this.chatCallback(chatData)
        } else if (data.type === 'updateEvent') {
          const eventid = data.data as string
          this.updateEventCallback(eventid)
        }
      }
      this.ws.onclose = () => {
        this.connectionCallback(false)
        // try to reconnect after 1s
        setTimeout(() => {
          this.connect()
        }, 1000)
      }
      this.ws.onopen = () => {
        // this._sendActivity()
        this.connectionCallback(true)
        resolve()
      }
    })
  }
}