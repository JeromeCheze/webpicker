<template>
  <v-card>
    <v-data-table :headers="tableHeader" :items="tableData" :pagination.sync="pagination">
      <template v-slot:items="props">
        <tr :class="tableRowClassName(props.item)" @click="handleRowClick(props.item)">
          <td><div :style="{ minWidth: '140px' }">{{ props.item.time }}</div></td>
          <td class="font-weight-bold">{{ props.item.mag }}</td>
          <td>{{ props.item.magType }}</td>
          <td class="text-xs-right">{{ props.item.phase }}</td>
          <td class="text-xs-right"><div :style="{ minWidth: '60px' }">{{ props.item.lat }}</div></td>
          <td class="text-xs-right"><div :style="{ minWidth: '60px' }">{{ props.item.lon }}</div></td>
          <td class="text-xs-right"><div :style="{ minWidth: '60px' }">{{ props.item.depth }}</div></td>
          <td><v-chip label outline small :color="props.item.modeColor">{{ props.item.mode }}</v-chip></td>
          <td>{{ props.item.eventType }}</td>
          <td><div :style="{ minWidth: '200px' }">{{ props.item.region }}</div></td>
          <td>{{ props.item.author }}</td>
          <td>{{ props.item.id }}</td>
        </tr>
      </template>
    </v-data-table>
  </v-card>
</template>

<script>
import utils from '@/utils/utils'

export default {

  props: [ 'start', 'end', 'minlat', 'maxlat', 'minlon', 'maxlon', 'mindepth', 'maxdepth', 'minmag', 'maxmag' ],

  data () {
    return {
      tableHeader: [
        { text: 'Time', value: 'time' },
        { text: 'M', value: 'mag' },
        { text: 'MT', value: 'magType' },
        { text: 'Ph.', value: 'phase', align: 'right' },
        { text: 'Lat', value: 'lat', align: 'right' },
        { text: 'Lon', value: 'lon', align: 'right' },
        { text: 'Depth', value: 'depth', align: 'right' },
        { text: 'Mode', value: 'mode', sortable: false },
        { text: 'Type', value: 'eventType' },
        { text: 'Region', value: 'region', sortable: false },
        { text: 'Author', value: 'author', sortable: false },
        { text: 'ID', value: 'id' }
      ],
      pagination: {
        descending: true,
        page: 1,
        rowsPerPage: -1,
        sortBy: 'time',
        totalItems: 0
      },
      tableData: []
      // height: 500
    }
  },

  mounted () {
    let dirty = false
    let query = Object.assign(Object.assign({}, this.$store.state.form), this.$route.query)
    for (let [k, v] of Object.entries(query)) {
      if (this.$store[k] != v) {
        dirty = true
        break
      }
    }
    if (dirty && this.$store.state.eventList.length == 0) {
      this.$store.dispatch('setFormValues', this.$route.query)
      this.$store.dispatch('setLoading', { value: true, text: 'Loading events...' })
      let args = {}
      for (let [k, v] of Object.entries(this.$store.state.form)) {
        if (v != null) {
          args[k] = v
        }
      }
      utils.ajax({
        method: 'GET',
        url: 'fdsnws/event/1/query',
        args: args,
        type: 'document'
      }).then(qml => {
        let events = utils.parseQuakeML(qml)
        this.$store.dispatch('eventList', events)
        let data = this.getTableData()
        this.pagination.totalItems = data.length
        this.tableData = data
        this.$store.dispatch('setLoading', { value: false })
      })
    } else {
      let data = this.getTableData()
      this.pagination.totalItems = data.length
      this.tableData = data
    }
  },

  methods: {
    tableRowClassName (row) {
      return this.$store.state.currentEvent != null && this.$store.state.currentEvent.public_id == row.id ? 'selected-event-row' : ''
    },

    handleRowClick (row) {
      if (row != null) {
        this.$router.push({ name: 'Event', params: { code: row.id } })
      }
    },

    getTableData () {
      return this.$store.state.eventList.map(e => ({
        time: e._po.time._pretty,
        mag: e._pm ? e._pm.mag._pretty : '--',
        magType: e._pm ? e._pm.type : '--',
        phase: e._po.quality.used_phase_count,
        lat: e._po.latitude._pretty,
        lon: e._po.longitude._pretty,
        depth: e._po.depth._pretty,
        eventType: e.type ? e.type : '',
        mode: e._po.evaluation_mode == 'manual' ? 'M' : 'A',
        modeColor: e._po.evaluation_mode == 'manual' ? 'green' : 'red',
        author: e._po.creation_info.author,
        region: e.description[0].text,
        id: e.public_id
      }))
    }
  }
}
</script>

<style lang="css">
.selected-event-row {
  background-color: #e7f9ff !important;
}
</style>
