<template>
  <v-card>
    <v-card-title>
      {{ translate(I18NPopupKeys.popup_second_card_current_url) }}
    </v-card-title>
    <v-card-text class="text-center">
      <v-alert color="primary" outlined>
        {{ currentUrl }}
      </v-alert>
      <v-select
        v-model="selectedTemporaryAllowTime"
        :items="temporaryAllowTimeItems"
        :label="translate(I18NPopupKeys.popup_temporary_allow_duration)"
        outlined
        dense
        hide-details
      ></v-select>
    </v-card-text>
    <v-card-actions class="justify-center">
      <v-btn
        id="list_action_white"
        :disabled="buttonsDisabled"
        :title="translate(I18NPopupKeys.popup_second_card_whitelist)"
        size="sm"
        color="green"
        :loading="whitelistingActive"
        @click="whitelistUrl"
      >
        <v-icon color="white">{{ mdiCheckCircleOutline }}</v-icon>
      </v-btn>
      <v-btn
        id="list_action_temporary_white"
        :disabled="buttonsDisabled"
        :title="translate(I18NPopupKeys.popup_temporary_whitelist)"
        size="sm"
        color="orange"
        :loading="temporaryWhitelistingActive"
        @click="temporarilyWhitelistUrl"
      >
        <v-icon color="white">{{ mdiTimerOutline }}</v-icon>
      </v-btn>
      <v-btn
        id="list_action_black"
        :disabled="buttonsDisabled"
        :title="translate(I18NPopupKeys.popup_second_card_blacklist)"
        size="sm"
        color="red"
        :loading="blacklistingActive"
        @click="blackListUrl"
      >
        <v-icon color="white">{{ mdiAlphaXCircleOutline }}</v-icon>
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts">
import {
  mdiAlphaXCircleOutline,
  mdiCheckCircleOutline,
  mdiTimerOutline
} from '@mdi/js'
import { computed, defineComponent, onMounted, ref } from '@vue/composition-api'
import PiHoleApiService from '../../../../service/PiHoleApiService'
import ApiList from '../../../../api/enum/ApiList'
import useTranslation from '../../../../hooks/translation'
import TemporaryActionService from '../../../../service/TemporaryActionService'
import {
  StorageService,
  TemporaryAllowTimeDefaults
} from '../../../../service/StorageService'
import TabService from '../../../../service/TabService'
import {
  BadgeService,
  ExtensionBadgeTextEnum
} from '../../../../service/BadgeService'

export default defineComponent({
  name: 'PopupListCardComponent',
  props: {
    currentUrl: {
      type: String,
      required: true
    }
  },
  setup: ({ currentUrl }) => {
    const buttonsDisabled = ref(false)
    const whitelistingActive = ref(false)
    const temporaryWhitelistingActive = ref(false)
    const blacklistingActive = ref(false)
    const temporaryAllowTimes = ref<number[]>([...TemporaryAllowTimeDefaults])
    const selectedTemporaryAllowTime = ref(TemporaryAllowTimeDefaults[0])

    const temporaryAllowTimeItems = computed(() =>
      temporaryAllowTimes.value.map(time => ({
        text: `${time} s`,
        value: time
      }))
    )

    const setActionFinished = () => {
      setTimeout(() => {
        whitelistingActive.value = false
        temporaryWhitelistingActive.value = false
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
          currentUrl
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

    const temporarilyWhitelistUrl = async () => {
      if (!currentUrl || selectedTemporaryAllowTime.value < 1) {
        return
      }

      buttonsDisabled.value = true
      temporaryWhitelistingActive.value = true

      try {
        // Do not remove an existing deny entry. Exact allow entries have
        // higher priority in Pi-hole and removing only the temporary allow
        // entry later restores the previous blocking behavior automatically.
        await TemporaryActionService.temporarilyAllowDomain(
          currentUrl,
          selectedTemporaryAllowTime.value
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
        selectedTemporaryAllowTime.value = storedTimes[0]
      }
    })

    return {
      whitelistingActive,
      temporaryWhitelistingActive,
      blacklistingActive,
      buttonsDisabled,
      temporaryAllowTimeItems,
      selectedTemporaryAllowTime,
      mdiCheckCircleOutline,
      mdiTimerOutline,
      mdiAlphaXCircleOutline,
      whitelistUrl,
      temporarilyWhitelistUrl,
      blackListUrl,
      ...useTranslation()
    }
  }
})
</script>
