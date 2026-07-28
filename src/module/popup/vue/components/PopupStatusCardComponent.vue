<template>
  <section class="popup-section group-control">
    <div class="section-title">
      {{ translate(I18NPopupKeys.popup_group_title) }}
    </div>

    <v-select
      v-model="selectedGroup"
      class="group-select"
      :items="groupItems"
      :label="translate(I18NPopupKeys.popup_group_select)"
      :loading="groupsLoading"
      :disabled="groupsLoading || groupActionLoading"
      variant="outlined"
      density="compact"
      hide-details
    ></v-select>

    <div class="control-row">
      <span class="control-label">{{
        translate(I18NPopupKeys.popup_group_manual)
      }}</span>
      <v-switch
        :model-value="groupBlockingActive"
        color="green"
        density="compact"
        hide-details
        inset
        :loading="groupActionLoading && groupTimedActionLoading === null"
        :disabled="
          groupSwitchDisabled ||
          groupActionLoading ||
          groupsLoading ||
          !selectedGroup
        "
        @update:model-value="changeGroupState"
      ></v-switch>
    </div>

    <div class="timer-label">
      {{ translate(I18NPopupKeys.popup_group_pause_times_title) }}
    </div>
    <div class="timer-row">
      <v-btn
        v-for="time in groupPauseTimes"
        :key="time"
        class="timer-button"
        color="orange-darken-2"
        size="small"
        variant="flat"
        :disabled="groupActionLoading || groupsLoading || !selectedGroup"
        :loading="groupTimedActionLoading === time"
        @click="pauseGroupFor(time)"
      >
        <v-icon size="16" start>{{ mdiTimerOutline }}</v-icon>
        {{ time }} s
      </v-btn>
    </div>

    <div
      v-if="groupActionState === 'error' || groupLoadError"
      class="inline-error"
    >
      {{ translate(I18NPopupKeys.popup_group_error) }}
    </div>
  </section>
</template>

<script lang="ts">
import { mdiTimerOutline } from '@mdi/js'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import {
  GroupPauseTimeDefaults,
  StorageService,
} from '../../../../service/StorageService'
import TabService from '../../../../service/TabService'
import PiHoleApiService from '../../../../service/PiHoleApiService'
import useTranslation from '../../../../hooks/translation'
import GroupPauseService from '../../../../service/GroupPauseService'
import { PiHoleGroup } from '../../../../api/models/PiHoleGroups'
import DomainStatusService from '../../../../service/DomainStatusService'

export default defineComponent({
  name: 'PopupStatusCardComponent',
  emits: ['selected-group-change'],
  setup: (_props, { emit }) => {
    const { translate, I18NPopupKeys } = useTranslation()
    const groups = ref<PiHoleGroup[]>([])
    const selectedGroup = ref<string | null>(null)
    const groupPauseTimes = ref<number[]>([...GroupPauseTimeDefaults])
    const groupBlockingActive = ref(true)
    const groupSwitchDisabled = ref(true)
    const groupsLoading = ref(false)
    const groupLoadError = ref(false)
    const groupActionLoading = ref(false)
    const groupTimedActionLoading = ref<number | null>(null)
    const groupActionState = ref<'success' | 'error' | null>(null)

    const groupItems = computed(() =>
      groups.value.map((group) => ({ title: group.name, value: group.name })),
    )

    const updateSelectedGroupStatus = async () => {
      if (!selectedGroup.value) {
        groupSwitchDisabled.value = true
        return
      }

      groupSwitchDisabled.value = true
      groupLoadError.value = false
      try {
        groupBlockingActive.value = !(await GroupPauseService.isGroupPaused(
          selectedGroup.value,
        ))
        groupSwitchDisabled.value = false
      } catch (reason) {
        console.warn(reason)
        groupBlockingActive.value = false
        groupLoadError.value = true
      }
    }

    const loadGroups = async () => {
      groupsLoading.value = true
      groupLoadError.value = false
      try {
        groups.value = (await PiHoleApiService.getCommonGroups()).filter(
          (group) => group.enabled,
        )
        const storedGroup = await StorageService.getPauseTarget()
        selectedGroup.value = groups.value.some(
          (group) => group.name === storedGroup,
        )
          ? storedGroup!
          : groups.value[0]?.name || null
      } catch (reason) {
        console.warn(reason)
        groupLoadError.value = true
        selectedGroup.value = null
      } finally {
        groupsLoading.value = false
      }
    }

    const loadGroupPauseTimes = async () => {
      const storedTimes = await StorageService.getGroupPauseTimes()
      if (storedTimes?.length === 3) {
        groupPauseTimes.value = storedTimes
      }
    }

    const reloadAfterPause = async () => {
      if (await StorageService.getReloadAfterDisable()) {
        TabService.reloadCurrentTab(1000)
      }
    }

    const changeGroupState = async (blockingEnabled: boolean | null) => {
      if (typeof blockingEnabled !== 'boolean' || !selectedGroup.value) {
        return
      }

      groupActionLoading.value = true
      groupTimedActionLoading.value = null
      groupActionState.value = null
      groupSwitchDisabled.value = true
      try {
        if (blockingEnabled) {
          await GroupPauseService.resumeGroup(selectedGroup.value)
        } else {
          await GroupPauseService.pauseGroup(selectedGroup.value, 0)
        }

        groupBlockingActive.value = blockingEnabled
        groupActionState.value = 'success'
        await DomainStatusService.refreshCurrentTabBadge(selectedGroup.value)
        if (!blockingEnabled) {
          await reloadAfterPause()
        }
      } catch (reason) {
        console.warn(reason)
        groupActionState.value = 'error'
        await updateSelectedGroupStatus()
      } finally {
        groupActionLoading.value = false
        groupSwitchDisabled.value = groupLoadError.value
      }
    }

    const pauseGroupFor = async (durationSeconds: number) => {
      if (!selectedGroup.value || durationSeconds < 1) {
        return
      }

      groupActionLoading.value = true
      groupTimedActionLoading.value = durationSeconds
      groupActionState.value = null
      groupSwitchDisabled.value = true
      try {
        await GroupPauseService.pauseGroup(selectedGroup.value, durationSeconds)
        groupBlockingActive.value = false
        groupActionState.value = 'success'
        await DomainStatusService.refreshCurrentTabBadge(selectedGroup.value)
        await reloadAfterPause()
      } catch (reason) {
        console.warn(reason)
        groupActionState.value = 'error'
        await updateSelectedGroupStatus()
      } finally {
        groupTimedActionLoading.value = null
        groupActionLoading.value = false
        groupSwitchDisabled.value = groupLoadError.value
      }
    }

    watch(selectedGroup, async (groupName) => {
      emit('selected-group-change', groupName)
      if (!groupName) {
        groupSwitchDisabled.value = true
        return
      }

      StorageService.savePauseTarget(groupName)
      groupActionState.value = null
      await Promise.all([
        updateSelectedGroupStatus(),
        DomainStatusService.refreshCurrentTabBadge(groupName),
      ])
    })

    onMounted(async () => {
      await Promise.all([loadGroups(), loadGroupPauseTimes()])
    })

    return {
      mdiTimerOutline,
      selectedGroup,
      groupItems,
      groupPauseTimes,
      groupBlockingActive,
      groupSwitchDisabled,
      groupsLoading,
      groupLoadError,
      groupActionLoading,
      groupTimedActionLoading,
      groupActionState,
      changeGroupState,
      pauseGroupFor,
      translate,
      I18NPopupKeys,
    }
  },
})
</script>

<style scoped lang="scss">
.popup-section {
  padding: 10px 0 4px;
}

.section-title {
  margin-bottom: 7px;
  font-size: 14px;
  font-weight: 600;
}

.group-select {
  margin-bottom: 5px;
}

.control-row {
  display: flex;
  min-height: 35px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.control-label,
.timer-label {
  font-size: 12px;
  font-weight: 500;
}

.timer-label {
  margin: 3px 0 6px;
}

.timer-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.timer-button {
  min-width: 0;
  padding-inline: 5px;
  text-transform: none;
}

.inline-error {
  margin-top: 6px;
  color: rgb(var(--v-theme-error));
  font-size: 11px;
  line-height: 1.3;
}
</style>
