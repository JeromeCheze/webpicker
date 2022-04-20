import { ActivityObject, State } from '@/types'

export const getLink = (state: State) => (path: string) => {
  return `${state.root}${path}`
}

export const getId = (state: State) => (prefix: string) => {
  const now = new Date().toISOString()
  return prefix === 'Event'
    ? now.replace(/[-:]/g, '').replace(/[T.]/g, '_').slice(0, 19)
    : [
        prefix,
        now.replace(/[-:]/g, '').replace('T', '.').slice(0, 18),
        (Math.random() * 1000).toFixed(0)
      ].join('-')
}

export const getEventActivity = (state: State) => {
  const now = new Date().getTime()
  const activity: ActivityObject = {}
  for (const [uid, authorStatus] of Object.entries(state.authorStatus)) {
    if (authorStatus.author === state.author) {
      continue
    }
    const t = new Date(authorStatus.time).getTime()
    const delta = Math.floor((now - t) / 1e3)
    const msg = `User ${authorStatus.author} was ${authorStatus.action} this event ${delta}s ago.`
    if (activity[authorStatus.eventid] == null) {
      activity[authorStatus.eventid] = []
    }
    activity[authorStatus.eventid].push(msg)
  }
  return activity
}

export const getCurrentEventId = (state: State) => {
  if (state.currentEvent != null) {
    return state.currentEvent.public_id
  }
  return null
}

export const getAcknowledgedMsgIds = (state: State) => {
  return state.acknowledgedMsgIds
}

export const getEventListIds = (state: State) => {
  return state.eventList.map(x => x.public_id)
}
