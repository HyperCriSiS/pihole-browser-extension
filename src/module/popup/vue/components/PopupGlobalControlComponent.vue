<template>
  <section class="popup-section global-control">
    <div class="control-row">
      <span class="control-label">{{
        translate(I18NPopupKeys.popup_global_title)
      }}</span>
      <v-switch
        class="control-switch"
        :model-value="blockingActive"
        color="green"
        density="compact"
        hide-details
        size="small"
        :loading="loading"
        :disabled="disabled || loading"
        @update:model-value="changeGlobalState"
      ></v-switch>
    </div>
    <div v-if="error" class="inline-error">
      {{ translate(I18NPopupKeys.popup_global_error) }}
    </div>
  </section>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue'
import PiHoleApiStatusEnum from '../../../../api/enum/PiHoleApiStatusEnum'
import useTranslation from '../../../../hooks/translation'
import { BadgeService } from '../../../../service/BadgeService'
import DomainStatusService from '../../../../service/DomainStatusService'
import PiHoleApiService from '../../../../service/PiHoleApiService'
import { StorageService } from '../../../../service/StorageService'
import TabService from '../../../../service/TabService'

export default defineComponent({
  name: 'PopupGlobalControlComponent',
  emits: ['icon-state-change'],
  setup: (_props, { emit }) => {
    const { translate, I18NPopupKeys } = useTranslation()
    const blockingActive = ref(false)
    const disabled = ref(true)
    const loading = ref(false)
    const error = ref(false)

    const refreshStatus = async () => {
      const status = await PiHoleApiService.getPiHoleStatusCombined()
      BadgeService.setGlobalStatus(status)
      error.value = status === PiHoleApiStatusEnum.error
      disabled.value = error.value
      blockingActive.value = status === PiHoleApiStatusEnum.enabled
      await DomainStatusService.refreshActiveTabBadges()
      emit('icon-state-change')
    }

    const changeGlobalState = async (enabled: boolean | null) => {
      if (typeof enabled !== 'boolean') {
        return
      }

      loading.value = true
      disabled.value = true
      error.value = false
      try {
        const mode = enabled
          ? PiHoleApiStatusEnum.enabled
          : PiHoleApiStatusEnum.disabled
        const responses = await PiHoleApiService.changePiHoleStatus(mode, 0)
        if (responses.some((response) => response.data.blocking !== mode)) {
          throw new Error('One Pi-hole returned an unexpected blocking state')
        }

        blockingActive.value = enabled
        BadgeService.setGlobalStatus(mode)
        await DomainStatusService.refreshActiveTabBadges()
        emit('icon-state-change')
        if (!enabled && (await StorageService.getReloadAfterDisable())) {
          TabService.reloadCurrentTab(1000)
        }
      } catch (reason) {
        console.warn(reason)
        error.value = true
        await refreshStatus()
      } finally {
        loading.value = false
        disabled.value = error.value
      }
    }

    onMounted(refreshStatus)

    return {
      blockingActive,
      disabled,
      loading,
      error,
      changeGlobalState,
      translate,
      I18NPopupKeys,
    }
  },
})
</script>

<style scoped lang="scss">
.global-control {
  padding: 3px 0 6px;
}

.control-row {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.control-label {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
}

.control-switch {
  flex: 0 0 auto;
  margin-inline-end: -2px;
}

.control-switch :deep(.v-selection-control) {
  min-height: 32px;
}

.inline-error {
  margin-top: 2px;
  color: rgb(var(--v-theme-error));
  font-size: 11px;
  line-height: 1.3;
}
</style>
