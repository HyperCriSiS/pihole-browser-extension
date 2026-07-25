<template>
  <v-card>
    <v-card-title class="justify-space-between">
      {{ translate(I18NPopupKeys.popup_status_card_title) }}
      <v-icon
        right
        :title="translate(I18NOptionKeys.options_settings)"
        @click="openOptions"
        >{{ mdiCog }}
      </v-icon>
    </v-card-title>
    <v-card-text>
      <v-text-field
        v-model.number="defaultDisableTime"
        :disabled="defaultDisableTimeDisabled"
        type="number"
        min="0"
        outlined
        :rules="[v => Number(v) >= 0 || '≥ 0']"
        :suffix="defaultDisableTime > 0 ? 's' : ''"
        :append-icon="timeUnitIcon"
      >
        <template #label>
          {{ translate(I18NPopupKeys.popup_status_card_info_text) }}
        </template>
      </v-text-field>
      <div class="d-flex flex justify-center">
        <v-switch
          v-model="sliderChecked"
          style="transform: scale(1.5)"
          inset
          color="green"
          :disabled="sliderDisabled"
          @change="sliderClicked()"
        ></v-switch>
      </div>

      <v-divider class="my-4"></v-divider>
      <div class="subtitle-1 mb-2">
        {{ translate(I18NPopupKeys.popup_group_title) }}
      </div>
      <v-select
        v-model="selectedGroup"
        :items="groupItems"
        :label="translate(I18NPopupKeys.popup_group_select)"
        :loading="groupsLoading"
        :disabled="groupsLoading || groupItems.length === 0"
        outlined
        dense
      ></v-select>
      <v-select
        v-model="selectedGroupDisableTime"
        :items="groupDurationItems"
        :label="translate(I18NPopupKeys.popup_temporary_allow_duration)"
        outlined
        dense
      ></v-select>
      <v-btn
        block
        color="orange"
        :loading="groupActionLoading"
        :disabled="
          groupActionLoading ||
            groupsLoading ||
            !selectedGroup ||
            selectedGroupDisableTime < 1 ||
            defaultDisableTimeDisabled
        "
        @click="disableSelectedGroup"
      >
        {{ translate(I18NPopupKeys.popup_group_disable) }}
        <span v-if="selectedGroupDisableTime > 0">
          &nbsp;({{ selectedGroupDisableTime }} s)
        </span>
      </v-btn>
      <div class="caption mt-2">
        {{ translate(I18NPopupKeys.popup_group_warning) }}
      </div>
      <v-alert
        v-if="groupActionState === 'success'"
        class="mt-3 mb-0"
        dense
        outlined
        type="success"
      >
        {{ translate(I18NPopupKeys.popup_group_success) }}
      </v-alert>
      <v-alert
        v-if="groupActionState === 'error' || groupLoadError"
        class="mt-3 mb-0"
        dense
        outlined
        type="error"
      >
        {{ translate(I18NPopupKeys.popup_group_error) }}
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { mdiAllInclusive, mdiCog, mdiTimerOutline } from '@mdi/js'
import { computed, defineComponent, onMounted, ref } from '@vue/composition-api'
import {
  PiHoleSettingsDefaults,
  StorageService,
  TemporaryAllowTimeDefaults
} from '../../../../service/StorageService'
import { PiHoleApiStatus } from '../../../../api/models/PiHoleApiStatus'
import {
  BadgeService,
  ExtensionBadgeTextEnum
} from '../../../../service/BadgeService'
import TabService from '../../../../service/TabService'
import PiHoleApiService from '../../../../service/PiHoleApiService'
import PiHoleApiStatusEnum from '../../../../api/enum/PiHoleApiStatusEnum'
import useTranslation from '../../../../hooks/translation'
import TemporaryActionService from '../../../../service/TemporaryActionService'
import { PiHoleGroup } from '../../../../api/models/PiHoleGroups'

export default defineComponent({
  name: 'PopupStatusCardComponent',
  model: { prop: 'isActiveByStatus', event: 'updateStatus' },
  props: {
    isActiveByStatus: {
      type: Boolean,
      required: true
    },
    isActiveByBadge: {
      type: Boolean,
      required: true
    }
  },
  setup: (props, { emit }) => {
    const sliderChecked = ref(props.isActiveByBadge)
    const sliderDisabled = ref(!props.isActiveByBadge)
    const defaultDisableTimeDisabled = ref(!props.isActiveByBadge)
    const defaultDisableTime = ref<number>(
      PiHoleSettingsDefaults.default_disable_time
    )
    const groups = ref<PiHoleGroup[]>([])
    const selectedGroup = ref<string | null>(null)
    const groupDisableTimes = ref<number[]>([...TemporaryAllowTimeDefaults])
    const selectedGroupDisableTime = ref(TemporaryAllowTimeDefaults[0])
    const groupsLoading = ref(false)
    const groupLoadError = ref(false)
    const groupActionLoading = ref(false)
    const groupActionState = ref<'success' | 'error' | null>(null)

    const timeUnitIcon = computed(() =>
      defaultDisableTime.value < 1 ? mdiAllInclusive : mdiTimerOutline
    )
    const groupItems = computed(() =>
      groups.value.map(group => ({
        text: group.name,
        value: group.name
      }))
    )
    const groupDurationItems = computed(() =>
      groupDisableTimes.value.map(time => ({
        text: `${time} s`,
        value: time
      }))
    )

    const updateDefaultDisableTime = () => {
      StorageService.getDefaultDisableTime().then(time => {
        if (typeof time !== 'undefined') {
          defaultDisableTime.value = time
        }
      })
    }

    const updateGroupDisableTimes = async () => {
      const storedTimes = await StorageService.getTemporaryAllowTimes()
      if (storedTimes?.length === 3) {
        groupDisableTimes.value = storedTimes
        selectedGroupDisableTime.value = storedTimes[0]
      }
    }

    const loadGroups = async () => {
      groupsLoading.value = true
      groupLoadError.value = false
      try {
        groups.value = (await PiHoleApiService.getCommonGroups()).filter(
          group => group.enabled
        )
        const preferredGroup =
          groups.value.find(group => group.name !== 'Default') ||
          groups.value[0]
        selectedGroup.value = preferredGroup?.name || null
      } catch (reason) {
        console.warn(reason)
        groupLoadError.value = true
      } finally {
        groupsLoading.value = false
      }
    }

    const updateComponentsByData = (data: PiHoleApiStatus) => {
      if (data.blocking === PiHoleApiStatusEnum.disabled) {
        defaultDisableTimeDisabled.value = true
        sliderChecked.value = false
        sliderDisabled.value = false
        BadgeService.setBadgeText(ExtensionBadgeTextEnum.disabled)
        emit('updateStatus', false)
      } else if (data.blocking === PiHoleApiStatusEnum.enabled) {
        defaultDisableTimeDisabled.value = false
        sliderDisabled.value = false
        sliderChecked.value = true
        BadgeService.setBadgeText(ExtensionBadgeTextEnum.enabled)
        emit('updateStatus', true)
      } else {
        defaultDisableTimeDisabled.value = true
        sliderDisabled.value = true
        sliderChecked.value = false
        BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
        emit('updateStatus', false)
      }
    }

    const updateStatus = async () => {
      const isEnabledByBadge =
        (await BadgeService.getBadgeText()) === ExtensionBadgeTextEnum.enabled

      if (isEnabledByBadge) {
        sliderChecked.value = true
        sliderDisabled.value = false
        defaultDisableTimeDisabled.value = false
      }

      PiHoleApiService.getPiHoleStatusCombined()
        .then(value => {
          updateComponentsByData({ blocking: value })
        })
        .catch(() =>
          updateComponentsByData({ blocking: PiHoleApiStatusEnum.error })
        )
    }

    const onSliderClickSuccessHandler = (data: PiHoleApiStatus) => {
      updateComponentsByData(data)
      if (data.blocking === PiHoleApiStatusEnum.disabled) {
        const reloadAfterDisableCallback = (
          is_enabled: boolean | undefined
        ) => {
          if (typeof is_enabled !== 'undefined' && is_enabled) {
            TabService.reloadCurrentTab(1000)
          }
        }
        StorageService.getReloadAfterDisable().then(reloadAfterDisableCallback)
      }
    }

    const throwConsoleBadgeError = (
      error_message: unknown,
      refresh_status: boolean = false
    ) => {
      console.warn(error_message)

      updateComponentsByData({ blocking: PiHoleApiStatusEnum.error })
      if (refresh_status) {
        setTimeout(() => {
          PiHoleApiService.getPiHoleStatusCombined()
            .then(data => updateComponentsByData({ blocking: data }))
            .catch(() =>
              updateComponentsByData({
                blocking: PiHoleApiStatusEnum.error
              })
            )
        }, 1500)
      }
    }

    const openOptions = () => {
      chrome.runtime.openOptionsPage()
    }

    const sliderClicked = () => {
      const currentMode = sliderChecked.value
        ? PiHoleApiStatusEnum.enabled
        : PiHoleApiStatusEnum.disabled

      const time: number = defaultDisableTime.value

      if (time >= 0) {
        PiHoleApiService.changePiHoleStatus(currentMode, time)
          .then(value => {
            for (const piHoleStatus of value) {
              if (
                piHoleStatus.data.blocking === PiHoleApiStatusEnum.error ||
                piHoleStatus.data.blocking !== currentMode
              ) {
                throwConsoleBadgeError(
                  'One PiHole returned Error from its request. Please check the password.',
                  true
                )
                return
              }
            }
            onSliderClickSuccessHandler(value[0].data)
          })
          .catch(reason => {
            throwConsoleBadgeError(reason)
          })
      } else {
        throwConsoleBadgeError(
          'Time cannot be smaller than 0. Canceling API request.',
          true
        )
      }
    }

    const disableSelectedGroup = async () => {
      if (!selectedGroup.value || selectedGroupDisableTime.value < 1) {
        return
      }

      groupActionLoading.value = true
      groupActionState.value = null
      try {
        await TemporaryActionService.temporarilyDisableGroup(
          selectedGroup.value,
          selectedGroupDisableTime.value
        )
        groupActionState.value = 'success'
        await loadGroups()
      } catch (reason) {
        console.warn(reason)
        groupActionState.value = 'error'
      } finally {
        groupActionLoading.value = false
      }
    }

    onMounted(() => {
      updateDefaultDisableTime()
      updateGroupDisableTimes()
      updateStatus()
      loadGroups()
    })

    return {
      defaultDisableTime,
      defaultDisableTimeDisabled,
      sliderChecked,
      sliderDisabled,
      timeUnitIcon,
      mdiCog,
      sliderClicked,
      openOptions,
      groupItems,
      groupDurationItems,
      selectedGroup,
      selectedGroupDisableTime,
      groupsLoading,
      groupLoadError,
      groupActionLoading,
      groupActionState,
      disableSelectedGroup,
      ...useTranslation()
    }
  }
})
</script>
