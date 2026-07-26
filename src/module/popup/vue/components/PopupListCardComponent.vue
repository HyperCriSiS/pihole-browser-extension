<template>
  <v-card>
    <v-card-title>
      {{ translate(I18NPopupKeys.popup_second_card_current_url) }}
    </v-card-title>
    <v-card-text>
      <v-alert color="primary" variant="outlined" class="mb-4">
        {{ currentUrl }}
      </v-alert>

      <v-btn
        id="list_action_white"
        block
        color="green"
        :disabled="buttonsDisabled"
        :loading="whitelistingActive"
        @click="whitelistUrl"
      >
        <v-icon class="mr-2" color="white">{{
          mdiCheckCircleOutline
        }}</v-icon>
        {{ translate(I18NPopupKeys.popup_second_card_whitelist) }}
      </v-btn>

      <div class="text-subtitle-2 mt-4 mb-2">
        {{ translate(I18NPopupKeys.popup_temporary_whitelist) }}
      </div>
      <div class="d-flex ga-2">
        <v-btn
          v-for="time in temporaryAllowTimes"
          :key="time"
          class="flex-grow-1"
          color="orange"
          :disabled="buttonsDisabled"
          :loading="temporaryWhitelistingActive === time"
          @click="temporarilyWhitelistUrl(time)"
        >
          <v-icon class="mr-1" color="white">{{ mdiTimerOutline }}</v-icon>
          {{ time }} s
        </v-btn>
      </div>

      <v-btn
        id="list_action_black"
        block
        class="mt-4"
        color="red"
        :disabled="buttonsDisabled"
        :loading="blacklistingActive"
        @click="blackListUrl"
      >
        <v-icon class="mr-2" color="white">{{
          mdiAlphaXCircleOutline
        }}</v-icon>
        {{ translate(I18NPopupKeys.popup_second_card_blacklist) }}
      </v-btn>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import {
  mdiAlphaXCircleOutline,
  mdiCheckCircleOutline,
  mdiTimerOutline,
} from '@mdi/js'
import { defineComponent, onMounted, ref } from 'vue'
import PiHoleApiService from '../../../../service/PiHoleApiService'
import ApiList from '../../../../api/enum/ApiList'
import useTranslation from '../../../../hooks/translation'
import TemporaryActionService from '../../../../service/TemporaryActionService'
import {
  StorageService,
  TemporaryAllowTimeDefaults,
} from '../../../../service/StorageService'
import TabService from '../../../../service/TabService'
import {
  BadgeService,
  ExtensionBadgeTextEnum,
} from '../../../../service/BadgeService'

export default defineComponent({
  name: 'PopupListCardComponent',
  props: {
    currentUrl: {
      type: String,
      required: true,
    },
  },
  setup: ({ currentUrl }) => {
    const buttonsDisabled = ref(false)
    const whitelistingActive = ref(false)
    const temporaryWhitelistingActive = ref<number | null>(null)
    const blacklistingActive = ref(false)
    const temporaryAllowTimes = ref<number[]>([...TemporaryAllowTimeDefaults])

    const setActionFinished = () => {
      setTimeout(() => {
        whitelistingActive.value = false
        temporaryWhitelistingActive.value = null
        blacklistingActive.value = false
        buttonsDisabled.value = false
      }, 500)
    }

    const reloadAfterWhitelist = async () => {
      if (await StorageService.getReloadAfterWhitelist()) {
        TabService.reloadCurrentTab(500)
      }
    }

    const listDomain = async (mode: ApiList) => {
      if (!currentUrl) {
        return
      }

      buttonsDisabled.value = true
      if (mode === ApiList.whitelist) {
        whitelistingActive.value = true
      } else {
        blacklistingActive.value = true
      }

      try {
        // Permanent list changes keep the existing behavior: remove the
        // opposite exact entry before adding the requested one.
        await PiHoleApiService.subDomainFromList(
          mode === ApiList.whitelist ? ApiList.blacklist : ApiList.whitelist,
          currentUrl,
        )
        await PiHoleApiService.addDomainToList(mode, currentUrl)
        BadgeService.setBadgeText(ExtensionBadgeTextEnum.ok)

        if (mode === ApiList.whitelist) {
          await reloadAfterWhitelist()
        }
      } catch (reason) {
        console.warn(reason)
        BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
      } finally {
        setActionFinished()
      }
    }

    const temporarilyWhitelistUrl = async (durationSeconds: number) => {
      if (!currentUrl || durationSeconds < 1) {
        return
      }

      buttonsDisabled.value = true
      temporaryWhitelistingActive.value = durationSeconds

      try {
        // Do not remove an existing deny entry. Exact allow entries have
        // higher priority in Pi-hole and removing only the temporary allow
        // entry later restores the previous blocking behavior automatically.
        await TemporaryActionService.temporarilyAllowDomain(
          currentUrl,
          durationSeconds,
        )
        BadgeService.setBadgeText(ExtensionBadgeTextEnum.ok)
        await reloadAfterWhitelist()
      } catch (reason) {
        console.warn(reason)
        BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
      } finally {
        setActionFinished()
      }
    }

    const whitelistUrl = () => listDomain(ApiList.whitelist)
    const blackListUrl = () => listDomain(ApiList.blacklist)

    onMounted(async () => {
      const storedTimes = await StorageService.getTemporaryAllowTimes()
      if (storedTimes?.length === 3) {
        temporaryAllowTimes.value = storedTimes
      }
    })

    return {
      whitelistingActive,
      temporaryWhitelistingActive,
      blacklistingActive,
      buttonsDisabled,
      temporaryAllowTimes,
      mdiCheckCircleOutline,
      mdiTimerOutline,
      mdiAlphaXCircleOutline,
      whitelistUrl,
      temporarilyWhitelistUrl,
      blackListUrl,
      ...useTranslation(),
    }
  },
})
</script>
