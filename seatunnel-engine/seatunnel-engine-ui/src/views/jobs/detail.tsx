/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  NTabs,
  NTabPane,
  NDivider,
  NTag,
  NDataTable,
  type DataTableColumns,
  NDrawer,
  NSpace,
  NCard,
  NDrawerContent
} from 'naive-ui'
import { computed, defineComponent, getCurrentInstance, h, reactive, ref, watch } from 'vue'
import { getJobInfo } from '@/service/job'
import { useRoute } from 'vue-router'
import type { Job, Vertex } from '@/service/job/types'
import { useI18n } from 'vue-i18n'
import { getRemainTime } from '@/utils/time'
import { parse } from 'date-fns'
import DAG from '@/components/directed-acyclic-graph'
import { getColorFromStatus } from '@/utils/getTypeFromStatus'
import './detail.scss'
import Configuration from '@/components/configuration'

export default defineComponent({
  setup() {
    const { t } = useI18n()
    const route = useRoute()

    const jobId = route.params.jobId as string
    const job = reactive({} as Job)
    const duration = ref('')
    getJobInfo(jobId).then((res) => {
      Object.assign(job, res)
      const d = parse(res.createTime, 'yyyy-MM-dd HH:mm:ss', new Date())
      duration.value = getRemainTime(Math.abs(Date.now() - d.getTime()))
      if (job.jobStatus !== 'RUNNING') {
        return
      }
      setInterval(() => {
        duration.value = getRemainTime(Math.abs(Date.now() - d.getTime()))
      }, 1000)
    })

    const select = ref('Overview')
    const change = () => {
      console.log(select.value)
    }
    watch(() => select.value, change)

    const tableData = computed(() => {
      return job.jobDag?.vertexInfoMap?.filter((v) => v.type !== 'transform') || []
    })
    const sourceCell = (
      row: Vertex,
      key:
        | 'TableSourceReceivedBytes'
        | 'TableSourceReceivedCount'
        | 'TableSourceReceivedQPS'
        | 'TableSourceReceivedBytesPerSeconds'
    ) => {
      if (row.type === 'source') {
        return row.tablePaths.reduce((s, path) => s + Number(job.metrics?.[key][path]), 0)
      }
      return 0
    }
    const sinkCell = (
      row: Vertex,
      key:
        | 'TableSinkWriteBytes'
        | 'TableSinkWriteCount'
        | 'TableSinkWriteQPS'
        | 'TableSinkWriteBytesPerSeconds'
    ) => {
      if (row.type === 'sink') {
        return row.tablePaths.reduce((s, path) => s + Number(job.metrics?.[key][path]), 0)
      }
      return 0
    }
    const columns: DataTableColumns<Vertex> = [
      {
        title: 'Name',
        key: 'vertexName'
      },
      {
        title: 'Received Bytes',
        key: 'key',
        render: (row) => sourceCell(row, 'TableSourceReceivedBytes')
      },
      {
        title: 'Write Bytes',
        key: 'key',
        render: (row) => sinkCell(row, 'TableSinkWriteBytes')
      },
      {
        title: 'Received Count',
        key: 'key',
        render: (row) => sourceCell(row, 'TableSourceReceivedCount')
      },
      {
        title: 'Write Count',
        key: 'key',
        render: (row) => sinkCell(row, 'TableSinkWriteCount')
      },
      {
        title: 'Received QPS',
        key: 'key',
        render: (row) => sourceCell(row, 'TableSourceReceivedQPS')
      },
      {
        title: 'Write QPS',
        key: 'key',
        render: (row) => sinkCell(row, 'TableSinkWriteQPS')
      },
      {
        title: 'Received Bytes PerSecond',
        key: 'key',
        render: (row) => sourceCell(row, 'TableSourceReceivedBytesPerSeconds')
      },
      {
        title: 'Write Bytes PerSecond',
        key: 'key',
        render: (row) => sinkCell(row, 'TableSinkWriteBytesPerSeconds')
      }
    ]

    const focusedId = ref(0)
    const drawerShow = ref(false)
    const onFocus = (id: number) => {
      drawerShow.value = true
      focusedId.value = id
    }
    const onDrawerClose = () => {
      drawerShow.value = false
    }
    const focusedVertex = computed(() => {
      const vertex = job.jobDag?.vertexInfoMap?.find((v) => v.vertexId === focusedId.value)
      return Object.assign({}, vertex, job.metrics)
    })
    const rowClassName = (row: Vertex) => {
      if (row.vertexId === focusedId.value) {
        return 'focused-row'
      }
      return ''
    }
    const rowProps = (row: Vertex) => {
      return { onClick: () => onFocus(row.vertexId) }
    }
    return () => (
      <div class="w-full bg-white px-12 pt-6 pb-12 border border-gray-100 rounded-xl">
        <div class="font-bold text-xl">
          {job.jobName}
          <NTag bordered={false} color={getColorFromStatus(job.jobStatus)} class="ml-3">
            {job.jobStatus}
          </NTag>
        </div>
        <div class="mt-3 flex items-center gap-3">
          <span>{t('detail.id')}:</span>
          <span class="font-bold">{job.jobId}</span>
          <NDivider vertical />
          <span>{t('detail.createTime')}:</span>
          <span class="font-bold">{job.createTime}</span>
          <NDivider vertical />
          <span>{t('detail.duration')}:</span>
          <span class="font-bold">{duration.value}</span>
        </div>
        <div class="tab-wrap relative">
          <NTabs v-model:value={select.value} type="line" animated>
            <NTabPane name="Overview" tab="Overview">
              <DAG job={job} focusedId={focusedId.value} onNodeClick={onFocus} />
              <NDataTable
                columns={columns}
                data={tableData.value}
                pagination={false}
                scrollX="auto"
                bordered
                rowClassName={rowClassName}
                rowProps={rowProps}
              />
            </NTabPane>
            <NTabPane name="Exception" tab="Exception">
              {job.errorMsg}
            </NTabPane>
            <NTabPane name="Configuration" tab="Configuration">
              <Configuration data={job.envOptions}></Configuration>
            </NTabPane>
          </NTabs>
          <NDrawer
            show={select.value === 'Overview' && !!focusedId.value && drawerShow.value}
            showMask={false}
            width={'40%'}
            to=".tab-wrap"
            style="top:42px"
            closeOnEsc={false}
            mask-closable={false}
            onUpdateShow={onDrawerClose}
          >
            <NDrawerContent title={focusedVertex.value?.vertexName} closable>
              <Configuration data={focusedVertex.value}></Configuration>
            </NDrawerContent>
          </NDrawer>
        </div>
      </div>
    )
  }
})
