<template>
  <section class="popup-section domain-control">
    <div class="section-heading-row">
      <div class="section-title">
        {{ translate(I18NPopupKeys.popup_second_card_current_url) }}
      </div>
      <v-chip
        class="domain-status"
        :color="domainStatusColor"
        size="x-small"
        variant="flat"
      >
        <v-progress-circular
          v-if="statusLoading"
          class="mr-1"
          indeterminate
          size="11"
          width="2"
        ></v-progress-circular>
        {{ domainStatusText }}
      </v-chip>
    </div>

    <div class="domain-display" :title="currentUrl">{{ currentUrl }}</div>

    <div class="permanent-actions">
      <v-btn
        id="list_action_white"
        class="domain-action"
        color="green"
        size="small"
        variant="flat"
        :disabled="buttonsDisabled"
        :loading="whitelistingActive"
        @click="whitelistUrl"
      >
        <v-icon size="17" start>{{ mdiCheck }}</v-icon>
        {{ translate(I18NPopupKeys.popup_second_card_whitelist) }}
      </v-btn>
      <v-btn
        id="list_action_black"
        class="domain-action"
        color="red"
        size="small"
        variant="flat"
        :disabled="buttonsDisabled"
        :loading="blacklistingActive"
        @click="blackListUrl"
      >
        <v-icon size="17" start>{{ mdiClose }}</v-icon>
        {{ translate(I18NPopupKeys.popup_second_card_blacklist) }}
      </v-btn>
    </div>

    <div class="temporary-heading">
      {{ translate(I18NPopupKeys.popup_temporary_whitelist) }}
    </div>
    <div class="selected-group">
      {{ translate(I18NPopupKeys.popup_temporary_whitelist_group) }}:
      <strong>{{ selectedGroup || '—' }}</strong>
    </div>
    <div class="timer-row">
      <v-btn
        v-for="time in temporaryAllowTimes"
        :key="time"
        class="timer-button"
        color="orange-darken-2"
        size="small"
        variant="flat"
        :disabled="buttonsDisabled || !selectedGroup"
        :loading="temporaryWhitelistingActive === time"
        @click="temporarilyWhitelistUrl(time)"
      >
        <v-icon size="16" start>{{ mdiTimerOutline }}</v-icon>
        {{ time }} s
      </v-btn>
    </div>

    <div v-if="actionError" class="inline-error">
      {{ translate(I18NPopupKeys.popup_domain_action_error) }}
    </div>
  </section>
</template>

<script lang="ts">
import { mdiCheck, mdiClose, mdiTimerOutline } from '@mdi/js'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import PiHoleApiService from '../../../../service/PiHoleApiService'
import ApiList from '../../../../api/enum/ApiList'
import useTranslation from '../../../../hooks/translation'
import TemporaryActionService from '../../../../service/TemporaryActionService'
import {
  StorageService,
  TemporaryAllowTimeDefaults,
} from '../../../../service/StorageService'
import TabService from '../../../../service/TabService'
import DomainStatusService from '../../../../service/DomainStatusService'
import type { DomainBlockingState } from '../../../../service/DomainStatusEvaluator'

export default defineComponent({
  name: 'PopupListCardComponent',
  props: {
    currentUrl: {
      type: String,
      required: true,
    },
    selectedGroup: {
      type: String,
      default: null,
    },
  },
  setup: (props) => {
    const { translate, I18NPopupKeys } = useTranslation()
    const buttonsDisabled = ref(false)
    const whitelistingActive = ref(false)
    const temporaryWhitelistingActive = ref<number | null>(null)
    const blacklistingActive = ref(false)
    const temporaryAllowTimes = ref<number[]>([...TemporaryAllowTimeDefaults])
    const domainStatus = ref<DomainBlockingState>('unknown')
    const statusLoading = ref(false)
    const actionError = ref(false)

    const domainStatusText = computed(() => {
      if (statusLoading.value) {
        return translate(I18NPopupKeys.popup_domain_status_checking)
      }
      if (domainStatus.value === 'blocked') {
        return translate(I18NPopupKeys.popup_domain_status_blocked)
      }
      if (domainStatus.value === 'allowed') {
        return translate(I18NPopupKeys.popup_domain_status_allowed)
      }
      return translate(I18NPopupKeys.popup_domain_status_unknown)
    })

    const domainStatusColor = computed(() => {
      if (statusLoading.value || domainStatus.value === 'unknown') {
        return 'grey-darken-1'
      }
      return domainStatus.value === 'blocked' ? 'red' : 'green'
    })

    const refreshDomainStatus = async () => {
      statusLoading.value = true
      try {
        const result = await DomainStatusService.refreshCurrentTabBadge(
          props.selectedGroup,
        )
        domainStatus.value = result.state
      } catch (reason) {
        console.warn(reason)
        domainStatus.value = 'unknown'
      } finally {
        statusLoading.value = false
      }
    }

    const finishAction = () => {
      whitelistingActive.value = false
      temporaryWhitelistingActive.value = null
      blacklistingActive.value = false
      buttonsDisabled.value = false
    }

    const reloadAfterWhitelist = async () => {
      if (await StorageService.getReloadAfterWhitelist()) {
        TabService.reloadCurrentTab(500)
      }
    }

    const listDomain = async (mode: ApiList) => {
      if (!props.currentUrl) {
        return
      }

      buttonsDisabled.value = true
      actionError.value = false
      if (mode === ApiList.whitelist) {
        whitelistingActive.value = true
      } else {
        blacklistingActive.value = true
      }

      try {
        await PiHoleApiService.subDomainFromList(
          mode === ApiList.whitelist ? ApiList.blacklist : ApiList.whitelist,
          props.currentUrl,
        )
        await PiHoleApiService.addDomainToList(mode, props.currentUrl)
        await refreshDomainStatus()

        if (mode === ApiList.whitelist) {
          await reloadAfterWhitelist()
        }
      } catch (reason) {
        console.warn(reason)
        actionError.value = true
      } finally {
        finishAction()
      }
    }

    const temporarilyWhitelistUrl = async (durationSeconds: number) => {
      if (!props.currentUrl || !props.selectedGroup || durationSeconds < 1) {
        return
      }

      buttonsDisabled.value = true
      actionError.value = false
      temporaryWhitelistingActive.value = durationSeconds

      try {
        await TemporaryActionService.temporarilyAllowDomainForGroup(
          props.currentUrl,
          props.selectedGroup,
          durationSeconds,
        )
        await refreshDomainStatus()
        await reloadAfterWhitelist()
      } catch (reason) {
        console.warn(reason)
        actionError.value = true
      } finally {
        finishAction()
      }
    }

    const whitelistUrl = () => listDomain(ApiList.whitelist)
    const blackListUrl = () => listDomain(ApiList.blacklist)

    watch(
      () => [props.currentUrl, props.selectedGroup],
      refreshDomainStatus,
    )

    onMounted(async () => {
      const storedTimes = await StorageService.getTemporaryAllowTimes()
      if (storedTimes?.length === 3) {
        temporaryAllowTimes.value = storedTimes
      }
      await refreshDomainStatus()
    })

    return {
      whitelistingActive,
      temporaryWhitelistingActive,
      blacklistingActive,
      buttonsDisabled,
      temporaryAllowTimes,
      domainStatusText,
      domainStatusColor,
      statusLoading,
      actionError,
      mdiCheck,
      mdiClose,
      mdiTimerOutline,
      whitelistUrl,
      temporarilyWhitelistUrl,
      blackListUrl,
      translate,
      I18NPopupKeys,
    }
  },
})
</script>

<style scoped lang="scss">
.popup-section {
  padding: 10px 0;
}

.section-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 7px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
}

.domain-status {
  flex: 0 0 auto;
  font-size: 10px;
}

.domain-display {
  overflow: hidden;
  margin-bottom: 8px;
  padding: 7px 9px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 5px;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.permanent-actions,
.timer-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.domain-action,
.timer-button {
  min-width: 0;
  text-transform: none;
}

.temporary-heading {
  margin-top: 10px;
  font-size: 12px;
  font-weight: 600;
}

.selected-group {
  overflow: hidden;
  margin: 1px 0 6px;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timer-row {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.timer-button {
  padding-inline: 5px;
}

.inline-error {
  margin-top: 6px;
  color: rgb(var(--v-theme-error));
  font-size: 11px;
  line-height: 1.3;
}
</style>
