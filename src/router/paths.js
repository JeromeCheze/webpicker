export default [
  {
    path: '/form',
    name: 'Form',
    view: 'FormView'
  },
  {
    path: '/list',
    name: 'List',
    view: 'ListView',
    props: true
  },
  {
    path: '/event/:code',
    name: 'Event',
    view: 'EventView',
    props: true
  },
  {
    path: '/picker',
    name: 'Picker',
    view: 'PickerView'
  },
  {
    path: '/settings',
    name: 'Settings',
    view: 'SettingsView'
  }
]
