<template>
  <v-card>
    <v-card-title class="justify-space-between">
      {{ translate(I18NPopupKeys.popup_status_card_title) }}
      <v-icon
        class="ml-auto"
        :title="translate(I18NOptionKeys.options_settings)"
        @click="openOptions"
        >{{ mdiCog }}
      </v-icon>
    </v-card-title>

    <v-card-text>
      <div class="text-subtitle-1 mb-2">
        {{ translate(I18NPopupKeys.popup_global_title) }}
      </div>
      <v-switch
        :model-value="globalBlockingActive"
        :label="translate(I18NPopupKeys.popup_global_blocking_active)"
        inset
        color="green"
        :loading="globalActionLoading"
        :disabled="globalSwitchDisabled || globalActionLoading"
        @update:model-value="changeGlobalState"
      ></v-switch>
      <v-alert
        v-if="globalActionState === 'success'"
        class="mt-2"
        density="compact"
        variant="outlined"
        type="success"
      >
        {{ translate(I18NPopupKeys.popup_global_success) }}
      </v-alert>
      <v-alert
        v-if="globalActionState === 'error'"
        class="mt-2"
        density="compact"
        variant="outlined"
        type="error"
      >
        {{ translate(I18NPopupKeys.popup_global_error) }}
      </v-alert>

      <v-divider class="my-4"></v-divider>

      <div class="text-subtitle-1 mb-2">
        {{ translate(I18NPopupKeys.popup_group_title) }}
      </div>
      <v-select
        v-model="selectedGroup"
        :items="groupItems"
        :label="translate(I18NPopupKeys.popup_group_select)"
        :loading="groupsLoading"
        :disabled="groupsLoading || groupActionLoading"
        variant="outlined"
        density="compact"
      ></v-select>

      <v-switch
        :model-value="groupBlockingActive"
        :label="translate(I18NPopupKeys.popup_group_blocking_active)"
        inset
        color="green"
        :loading="groupActionLoading && groupTimedActionLoading === null"
        :disabled="
          groupSwitchDisabled ||
          groupActionLoading ||
          groupsLoading ||
          !selectedGroup
        "
        @update:model-value="changeGroupState"
      ></v-switch>

      <div class="text-subtitle-2 mt-2 mb-2">
        {{ translate(I18NPopupKeys.popup_group_pause_times_title) }}
      </div>
      <div class="d-flex ga-2">
        <v-btn
          v-for="time in groupPauseTimes"
          :key="time"
          class="flex-grow-1"
          color="orange"
          :disabled="groupActionLoading || groupsLoading || !selectedGroup"
          :loading="groupTimedActionLoading === time"
          @click="pauseGroupFor(time)"
        >
          <v-icon class="mr-1" color="white">{{ mdiTimerOutline }}</v-icon>
          {{ time }} s
        </v-btn>
      </div>

      <div class="text-caption mt-3">
        {{ translate(I18NPopupKeys.popup_group_warning) }}
      </div>
      <v-alert
        v-if="groupActionState === 'success'"
        class="mt-3 mb-0"
        density="compact"
        variant="outlined"
        type="success"
      >
        {{ translate(I18NPopupKeys.popup_group_success) }}
      </v-alert>
      <v-alert
        v-if="groupActionState === 'error' || groupLoadError"
        class="mt-3 mb-0"
        density="compact"
        variant="outlined"
        type="error"
      >
        {{ translate(I18NPopupKeys.popup_group_error) }}
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { mdiCog, mdiTimerOutline } from '@mdi/js'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import {
  GroupPauseTimeDefaults,
  StorageService,
} from '../../../../service/StorageService'
import {
  BadgeService,
  ExtensionBadgeTextEnum,
} from '../../../../service/BadgeService'
import TabService from '../../../../service/TabService'
import PiHoleApiService from '../../../../service/PiHoleApiService'
import PiHoleApiStatusEnum from '../../../../api/enum/PiHoleApiStatusEnum'
import useTranslation from '../../../../hooks/translation'
import GroupPauseService from '../../../../service/GroupPauseService'
import { PiHoleGroup } from '../../../../api/models/PiHoleGroups'

export default defineComponent({
  name: 'PopupStatusCardComponent',
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    isActiveByBadge: {
      type: Boolean,
      required: true,
    },
  },
  emits: ['update:modelValue'],
  setup: (props, { emit }) => {
    const { translate, I18NPopupKeys, I18NOptionKeys } = useTranslation()

    const globalBlockingActive = ref(props.isActiveByBadge)
    const globalSwitchDisabled = ref(true)
    const globalActionLoading = ref(false)
    const globalActionState = ref<'success' | 'error' | null>(null)

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
      groups.value.map((group) => ({
        title: group.name,
        value: group.name,
      })),
    )

    const setGlobalStatus = (status: PiHoleApiStatusEnum) => {
      if (status === PiHoleApiStatusEnum.enabled) {
        globalBlockingActive.value = true
        globalSwitchDisabled.value = false
        BadgeService.setBadgeText(ExtensionBadgeTextEnum.enabled)
        emit('update:modelValue', true)
        return
      }

      if (status === PiHoleApiStatusEnum.disabled) {
        globalBlockingActive.value = false
        globalSwitchDisabled.value = false
        BadgeService.setBadgeText(ExtensionBadgeTextEnum.disabled)
        emit('update:modelValue', false)
        return
      }

      globalBlockingActive.value = false
      globalSwitchDisabled.value = true
      BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
      emit('update:modelValue', false)
    }

    const updateGlobalStatus = async () => {
      const status = await PiHoleApiService.getPiHoleStatusCombined()
      setGlobalStatus(status)
    }

    const reloadAfterPause = async () => {
      if (await StorageService.getReloadAfterDisable()) {
        TabService.reloadCurrentTab(1000)
      }
    }

    const changeGlobalState = async (blockingEnabled: boolean | null) => {
      if (typeof blockingEnabled !== 'boolean') {
        return
      }

      globalActionLoading.value = true
      globalActionState.value = null
      globalSwitchDisabled.value = true
      try {
        const mode = blockingEnabled
          ? PiHoleApiStatusEnum.enabled
          : PiHoleApiStatusEnum.disabled
        const responses = await PiHoleApiService.changePiHoleStatus(mode, 0)

        if (responses.some((response) => response.data.blocking !== mode)) {
          throw new Error('One Pi-hole returned an unexpected blocking state')
        }

        setGlobalStatus(mode)
        globalActionState.value = 'success'
        if (!blockingEnabled) {
          await reloadAfterPause()
        }
      } catch (reason) {
        console.warn(reason)
        globalActionState.value = 'error'
        await updateGlobalStatus()
      } finally {
        globalActionLoading.value = false
        if (globalActionState.value !== 'error') {
          globalSwitchDisabled.value = false
        }
      }
    }

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
        const storedGroupExists = groups.value.some(
          (group) => group.name === storedGroup,
        )
        selectedGroup.value = storedGroupExists
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
        await GroupPauseService.pauseGroup(
          selectedGroup.value,
          durationSeconds,
        )
        groupBlockingActive.value = false
        groupActionState.value = 'success'
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

    const openOptions = () => {
      chrome.runtime.openOptionsPage()
    }

    watch(selectedGroup, async (groupName) => {
      if (!groupName) {
        groupSwitchDisabled.value = true
        return
      }

      StorageService.savePauseTarget(groupName)
      groupActionState.value = null
      await updateSelectedGroupStatus()
    })

    onMounted(async () => {
      await Promise.all([
        updateGlobalStatus(),
        loadGroups(),
        loadGroupPauseTimes(),
      ])
    })

    return {
      mdiCog,
      mdiTimerOutline,
      globalBlockingActive,
      globalSwitchDisabled,
      globalActionLoading,
      globalActionState,
      changeGlobalState,
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
      openOptions,
      translate,
      I18NPopupKeys,
      I18NOptionKeys,
    }
  },
})
</script>
