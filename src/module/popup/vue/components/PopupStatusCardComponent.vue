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
      <v-select
        v-model="selectedPauseTarget"
        :items="pauseTargetItems"
        :label="translate(I18NPopupKeys.popup_group_select)"
        :loading="groupsLoading"
        :disabled="groupsLoading || pauseActionLoading"
        variant="outlined"
        density="compact"
      ></v-select>

      <v-text-field
        v-model.number="defaultDisableTime"
        :disabled="pauseActionLoading"
        type="number"
        min="0"
        variant="outlined"
        :rules="[(v) => Number(v) >= 0 || '≥ 0']"
        :suffix="defaultDisableTime > 0 ? 's' : ''"
        :append-inner-icon="timeUnitIcon"
      >
        <template #label>
          {{ translate(I18NPopupKeys.popup_status_card_info_text) }}
        </template>
      </v-text-field>

      <div class="d-flex flex justify-center">
        <v-switch
          :model-value="sliderChecked"
          :label="translate(I18NPopupKeys.popup_blocking_active)"
          style="transform: scale(1.15)"
          inset
          color="green"
          :loading="pauseActionLoading"
          :disabled="sliderDisabled || pauseActionLoading"
          @update:model-value="changePauseState"
        ></v-switch>
      </div>

      <div v-if="!isEntirePiHole" class="text-caption mt-2">
        {{ translate(I18NPopupKeys.popup_group_warning) }}
      </div>
      <v-alert
        v-if="pauseActionState === 'success'"
        class="mt-3 mb-0"
        density="compact"
        variant="outlined"
        type="success"
      >
        {{ translate(I18NPopupKeys.popup_group_success) }}
      </v-alert>
      <v-alert
        v-if="pauseActionState === 'error' || groupLoadError"
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
import { mdiAllInclusive, mdiCog, mdiTimerOutline } from '@mdi/js'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import {
  PiHoleSettingsDefaults,
  StorageService,
} from '../../../../service/StorageService'
import { PiHoleApiStatus } from '../../../../api/models/PiHoleApiStatus'
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

const ENTIRE_PIHOLE_TARGET = '__entire_pihole__'

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
    const sliderChecked = ref(props.isActiveByBadge)
    const sliderDisabled = ref(true)
    const defaultDisableTime = ref<number>(
      PiHoleSettingsDefaults.default_disable_time,
    )
    const groups = ref<PiHoleGroup[]>([])
    const selectedPauseTarget = ref<string | null>(null)
    const groupsLoading = ref(false)
    const groupLoadError = ref(false)
    const pauseActionLoading = ref(false)
    const pauseActionState = ref<'success' | 'error' | null>(null)

    const timeUnitIcon = computed(() =>
      defaultDisableTime.value < 1 ? mdiAllInclusive : mdiTimerOutline,
    )
    const isEntirePiHole = computed(
      () => selectedPauseTarget.value === ENTIRE_PIHOLE_TARGET,
    )
    const pauseTargetItems = computed(() => [
      ...groups.value.map((group) => ({
        title: group.name,
        value: group.name,
      })),
      {
        title: translate(I18NPopupKeys.popup_entire_pihole),
        value: ENTIRE_PIHOLE_TARGET,
      },
    ])

    const updateDefaultDisableTime = async () => {
      const time = await StorageService.getDefaultDisableTime()
      if (typeof time !== 'undefined') {
        defaultDisableTime.value = time
      }
    }

    const applyGlobalStatus = (data: PiHoleApiStatus) => {
      if (data.blocking === PiHoleApiStatusEnum.disabled) {
        BadgeService.setBadgeText(ExtensionBadgeTextEnum.disabled)
        emit('update:modelValue', false)
        if (isEntirePiHole.value) {
          sliderChecked.value = false
          sliderDisabled.value = false
        }
        return
      }

      if (data.blocking === PiHoleApiStatusEnum.enabled) {
        BadgeService.setBadgeText(ExtensionBadgeTextEnum.enabled)
        emit('update:modelValue', true)
        if (isEntirePiHole.value) {
          sliderChecked.value = true
          sliderDisabled.value = false
        }
        return
      }

      BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
      emit('update:modelValue', false)
      if (isEntirePiHole.value) {
        sliderChecked.value = false
        sliderDisabled.value = true
      }
    }

    const updateGlobalStatus = async () => {
      const blocking = await PiHoleApiService.getPiHoleStatusCombined()
      applyGlobalStatus({ blocking })
    }

    const updateSelectedTargetStatus = async () => {
      const target = selectedPauseTarget.value
      if (!target) {
        sliderDisabled.value = true
        return
      }

      sliderDisabled.value = true
      groupLoadError.value = false
      try {
        if (target === ENTIRE_PIHOLE_TARGET) {
          await updateGlobalStatus()
        } else {
          sliderChecked.value = !(await GroupPauseService.isGroupPaused(target))
          sliderDisabled.value = false
        }
      } catch (reason) {
        console.warn(reason)
        sliderChecked.value = false
        sliderDisabled.value = true
        groupLoadError.value = true
      }
    }

    const loadPauseTargets = async () => {
      groupsLoading.value = true
      groupLoadError.value = false
      try {
        groups.value = await PiHoleApiService.getCommonGroups()
        const storedTarget = await StorageService.getPauseTarget()
        const storedGroupExists = groups.value.some(
          (group) => group.name === storedTarget,
        )

        if (storedTarget === ENTIRE_PIHOLE_TARGET || storedGroupExists) {
          selectedPauseTarget.value = storedTarget!
          return
        }

        const preferredGroup =
          groups.value.find((group) => group.name !== 'Default') ||
          groups.value[0]
        selectedPauseTarget.value = preferredGroup?.name || ENTIRE_PIHOLE_TARGET
      } catch (reason) {
        console.warn(reason)
        groupLoadError.value = true
        selectedPauseTarget.value = ENTIRE_PIHOLE_TARGET
      } finally {
        groupsLoading.value = false
      }
    }

    const reloadAfterPause = async () => {
      if (await StorageService.getReloadAfterDisable()) {
        TabService.reloadCurrentTab(1000)
      }
    }

    const changeEntirePiHoleState = async (
      blockingEnabled: boolean,
      durationSeconds: number,
    ) => {
      const mode = blockingEnabled
        ? PiHoleApiStatusEnum.enabled
        : PiHoleApiStatusEnum.disabled
      const responses = await PiHoleApiService.changePiHoleStatus(
        mode,
        durationSeconds,
      )

      for (const response of responses) {
        if (response.data.blocking !== mode) {
          throw new Error('One Pi-hole returned an unexpected blocking state')
        }
      }

      applyGlobalStatus(responses[0].data)
    }

    const changeGroupState = async (
      groupName: string,
      blockingEnabled: boolean,
      durationSeconds: number,
    ) => {
      if (blockingEnabled) {
        await GroupPauseService.resumeGroup(groupName)
        return
      }

      await GroupPauseService.pauseGroup(groupName, durationSeconds)
    }

    const changePauseState = async (blockingEnabled: boolean | null) => {
      const target = selectedPauseTarget.value
      const durationSeconds = Number(defaultDisableTime.value)
      if (
        typeof blockingEnabled !== 'boolean' ||
        !target ||
        !Number.isFinite(durationSeconds) ||
        durationSeconds < 0
      ) {
        pauseActionState.value = 'error'
        return
      }

      pauseActionLoading.value = true
      pauseActionState.value = null
      sliderDisabled.value = true
      try {
        if (target === ENTIRE_PIHOLE_TARGET) {
          await changeEntirePiHoleState(blockingEnabled, durationSeconds)
        } else {
          await changeGroupState(target, blockingEnabled, durationSeconds)
          sliderChecked.value = blockingEnabled
        }

        pauseActionState.value = 'success'
        if (!blockingEnabled) {
          await reloadAfterPause()
        }
      } catch (reason) {
        console.warn(reason)
        pauseActionState.value = 'error'
        await updateSelectedTargetStatus()
      } finally {
        pauseActionLoading.value = false
        if (!groupLoadError.value) {
          sliderDisabled.value = false
        }
      }
    }

    const openOptions = () => {
      chrome.runtime.openOptionsPage()
    }

    watch(selectedPauseTarget, async (target) => {
      if (!target) {
        return
      }

      StorageService.savePauseTarget(target)
      pauseActionState.value = null
      await updateSelectedTargetStatus()
    })

    onMounted(async () => {
      await Promise.all([updateDefaultDisableTime(), updateGlobalStatus()])
      await loadPauseTargets()
    })

    return {
      defaultDisableTime,
      sliderChecked,
      sliderDisabled,
      timeUnitIcon,
      mdiCog,
      openOptions,
      selectedPauseTarget,
      pauseTargetItems,
      groupsLoading,
      groupLoadError,
      pauseActionLoading,
      pauseActionState,
      isEntirePiHole,
      changePauseState,
      translate,
      I18NPopupKeys,
      I18NOptionKeys,
    }
  },
})
</script>
