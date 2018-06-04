<template>
  <el-table
    ref="eventListTable"
    :data="tableData"
    :default-sort="{ prop: 'time', order: 'descending' }"
    :row-class-name="tableRowClassName"
    @row-click="handleRowClick"
    :height="height"
    style="width: 100%">
    <el-table-column width="150" prop="time" label="Time" sortable></el-table-column>
    <el-table-column width="60" prop="mag" label="M" sortable>
      <template slot-scope="scope">
        <strong>{{ scope.row.mag }}</strong>
      </template>
    </el-table-column>
    <el-table-column width="40" prop="magType" label="MT"></el-table-column>
    <el-table-column width="70" prop="phase" label="Ph." align="right" sortable></el-table-column>
    <el-table-column width="80" prop="lat" label="Lat" align="right" sortable></el-table-column>
    <el-table-column width="80" prop="lon" label="Lon" align="right" sortable></el-table-column>
    <el-table-column width="80" prop="depth" label="Depth" align="right" sortable></el-table-column>
    <el-table-column width="60" prop="mode" label="Mode">
      <template slot-scope="scope">
        <el-tag :type="scope.row.modeColor">{{ scope.row.mode }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column width="90" prop="eventType" label="type" sortable></el-table-column>
    <el-table-column width="200" prop="author" label="Author"></el-table-column>
    <el-table-column width="200" prop="region" label="Region"></el-table-column>
    <el-table-column width="100" prop="id" label="ID" sortable></el-table-column>
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
        time: e.po.time.pretty,
        mag: e.pm ? e.pm.mag.pretty : '--',
        magType: e.pm ? e.pm.type : '--',
        phase: e.po.quality.usedPhaseCount,
        lat: e.po.latitude.pretty,
        lon: e.po.longitude.pretty,
        depth: e.po.depth.pretty,
        eventType: e.type ? e.type : '',
        mode: e.po.evaluationMode == 'manual' ? 'M' : 'A',
        modeColor: e.po.evaluationMode == 'manual' ? 'success' : 'danger',
        author: e.po.creationInfo.author,
        region: e.description.text,
        id: e.$publicID
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
