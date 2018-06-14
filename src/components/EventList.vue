<template>
  <el-table
    ref="eventListTable"
    :data="tableData"
    :default-sort="{ prop: 'time', order: 'descending' }"
    :row-class-name="tableRowClassName"
    @row-click="handleRowClick"
    :height="height"
    style="width: 100%">
    <el-table-column min-width="150" prop="time" label="Time" sortable></el-table-column>
    <el-table-column min-width="60" prop="mag" label="M" sortable>
      <template slot-scope="scope">
        <strong>{{ scope.row.mag }}</strong>
      </template>
    </el-table-column>
    <el-table-column min-width="50" prop="magType" label="MT"></el-table-column>
    <el-table-column min-width="70" prop="phase" label="Ph." align="right" sortable></el-table-column>
    <el-table-column min-width="80" prop="lat" label="Lat" align="right" sortable></el-table-column>
    <el-table-column min-width="80" prop="lon" label="Lon" align="right" sortable></el-table-column>
    <el-table-column min-width="80" prop="depth" label="Depth" align="right" sortable></el-table-column>
    <el-table-column min-width="60" prop="mode" label="Mode">
      <template slot-scope="scope">
        <el-tag :type="scope.row.modeColor">{{ scope.row.mode }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column min-width="90" prop="eventType" label="type" sortable></el-table-column>
    <el-table-column min-width="200" prop="author" label="Author"></el-table-column>
    <el-table-column min-width="200" prop="region" label="Region"></el-table-column>
    <el-table-column min-width="100" prop="id" label="ID" sortable></el-table-column>
  </el-table>
</template>

<script>
export default {
  props: ['eventList'],

  data () {
    return {
      tableData: [],
      selectEvent: null,
      height: 500
    }
  },

  activated () {
    this.height = document.body.clientHeight - this.$el.offsetTop - 20
  },

  watch: {
    eventList: function(val) {
      this.updateTableData()
    }
  },

  methods: {
    tableRowClassName ({ row, rowIndex }) {
      return row.id == this.selectEvent ? 'selected-event-row' : ''
    },

    handleRowClick (row) {
      if (row != null) {
        this.selectEvent = row.id
        this.$emit('select-event', row.id)
      }
    },

    updateTableData () {
      let data = this.eventList.map(e => ({
        time: e._po.time._pretty,
        mag: e._pm ? e._pm.mag._pretty : '--',
        magType: e._pm ? e._pm.type : '--',
        phase: e._po.quality.used_phase_count,
        lat: e._po.latitude._pretty,
        lon: e._po.longitude._pretty,
        depth: e._po.depth._pretty,
        eventType: e.type ? e.type : '',
        mode: e._po.evaluation_mode == 'manual' ? 'M' : 'A',
        modeColor: e._po.evaluation_mode == 'manual' ? 'success' : 'danger',
        author: e._po.creation_info.author,
        region: e.description[0].text,
        id: e.public_id
      }))
      this.$set(this, 'tableData', data)
    }
  }
}
</script>

<style>
.selected-event-row {
  background-color: #e7f9ff !important;
}
</style>
