import type { Activity } from "@/types"

export default class ActivityManager {
  ws: WebSocket | null
  _author: string
  _state: string
  _event: string
  usersActivity: Activity[]
  updateCallback: (usersActivity: Activity[]) => void
  connectionCallback: (connected: boolean) => void

  constructor(
    author: string,
    updateCallback: (usersActivity: Activity[]) => void,
    connectionCallback: (connected: boolean) => void,
  ) {
    this.ws = null
    this.usersActivity = []
    this._author = author
    this._state = 'online'
    this._event = ''
    this.updateCallback = updateCallback
    this.connectionCallback = connectionCallback
    this.connect()
  }

  set author(value: string) {
    this._author = value
    this._sendActivity()
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${location.protocol.replace('http', 'ws')}//${location.host}/ws`)
      this.ws.onmessage = msg => {
        this.usersActivity = JSON.parse(msg.data)
        this.updateCallback(this.usersActivity)
      }
      this.ws.onclose = () => {
        this.connectionCallback(false)
        // try to reconnect after 1s
        setTimeout(() => {
          this.connect()
        }, 1000)
      }
      this.ws.onopen = () => {
        this._sendActivity()
        this.connectionCallback(true)
        resolve()
      }
    })
  }

  _sendActivity() {
    this.ws!.send(JSON.stringify({
      author: this._author,
      state: this._state,
      event: this._event
    }))
  }

  eventUsers(event: string) {
    return this.usersActivity.filter(x => x.event === event).map(x => x.author)
  }

  update(state: string, event='') {
    console.warn('update')
    this._state = state
    this._event = event
    if (this.ws != null && this.ws.readyState === this.ws.OPEN) {
      this._sendActivity()
    }
  }
}