export const getLink = (state) => (path) => {
  return `${state.root}${path}`
}

export const getId = (state) => (prefix) => {
  let now = new Date().toISOString()
  return prefix == 'Event' ? now.replace(/[-:]/g, '').replace(/[T\.]/g, '_').slice(0, 19) : [
    prefix,
    now.replace(/[\-:]/g, '').replace('T', '.').substr(0, 18),
    (Math.random()*1000).toFixed(0)
  ].join('-')
}

export const getEventActivity = (state) => {
  let now = new Date().getTime()
  let activity = {}
  for (let [uid, authorStatus] of Object.entries(state.authorStatus)) {
    if (authorStatus.author == state.author) {
      continue
    }
    let t = new Date(authorStatus.time).getTime()
    let delta = Math.floor((now - t) / 1e3)
    let msg = `User ${authorStatus.author} was ${authorStatus.action} this event ${delta}s ago.`
    if (activity[authorStatus.eventid] == null) {
      activity[authorStatus.eventid] = []
    }
    activity[authorStatus.eventid].push(msg)
  }
  return activity
}

export const getCurrentEventId = (state) => {
  if (state.currentEvent != null) {
    return state.currentEvent.public_id
  }
  return null
}
