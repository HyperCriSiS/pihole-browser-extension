<template>
  <v-app id="popup">
    <main class="popup-shell">
      <header class="popup-header">
        <span>{{ translate(I18NPopupKeys.popup_status_card_title) }}</span>
        <v-btn
          class="settings-button"
          :title="translate(I18NOptionKeys.options_settings)"
          icon
          size="x-small"
          variant="text"
          @click="openOptions"
        >
          <v-icon size="21">{{ mdiCog }}</v-icon>
        </v-btn>
      </header>

      <div class="popup-content">
        <PopupGlobalControlComponent />
        <v-divider></v-divider>

        <PopupListCardComponent
          v-if="isListFeatureActive"
          :current-url="currentUrl"
          :selected-group="selectedGroup"
        />
        <v-divider v-if="isListFeatureActive"></v-divider>

        <PopupStatusCardComponent
          @selected-group-change="selectedGroup = $event"
        />
      </div>
    </main>
  </v-app>
</template>

<script lang="ts">
import { mdiCog } from '@mdi/js'
import { computed, defineComponent, onMounted, ref } from 'vue'
import PopupStatusCardComponent from '../components/PopupStatusCardComponent.vue'
import PopupListCardComponent from '../components/PopupListCardComponent.vue'
import PopupGlobalControlComponent from '../components/PopupGlobalControlComponent.vue'
import { StorageService } from '../../../../service/StorageService'
import TabService from '../../../../service/TabService'
import useTranslation from '../../../../hooks/translation'
import DomainStatusService from '../../../../service/DomainStatusService'

export default defineComponent({
  name: 'PopupComponent',
  components: {
    PopupGlobalControlComponent,
    PopupListCardComponent,
    PopupStatusCardComponent,
  },
  setup: () => {
    const { translate, I18NPopupKeys, I18NOptionKeys } = useTranslation()
    const currentUrl = ref('')
    const selectedGroup = ref<string | null>(null)
    const listFeatureDisabled = ref(false)

    const updateCurrentUrl = async () => {
      currentUrl.value = await TabService.getCurrentTabUrlCleaned()
      if (!currentUrl.value) {
        await DomainStatusService.refreshCurrentTabBadge()
      }
    }

    const updateListFeatureDisabled = async () => {
      listFeatureDisabled.value =
        (await StorageService.getDisableListFeature()) ?? false
    }

    const isListFeatureActive = computed(
      () => !listFeatureDisabled.value && currentUrl.value.length > 0,
    )

    const openOptions = () => chrome.runtime.openOptionsPage()

    onMounted(async () => {
      await Promise.all([updateCurrentUrl(), updateListFeatureDisabled()])
    })

    return {
      mdiCog,
      currentUrl,
      selectedGroup,
      isListFeatureActive,
      openOptions,
      translate,
      I18NPopupKeys,
      I18NOptionKeys,
    }
  },
})
</script>

<style lang="scss">
html,
body {
  min-width: 320px;
  background: rgb(var(--v-theme-surface));
}

#popup {
  width: 320px;
  min-height: 0;
  background: rgb(var(--v-theme-surface));
}

.popup-shell {
  width: 100%;
}

.popup-header {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px 5px 12px;
  font-size: 17px;
  font-weight: 600;
}

.settings-button {
  flex: 0 0 auto;
}

.popup-content {
  padding: 0 12px 9px;
}

.v-switch .v-selection-control {
  min-height: 32px;
}
</style>
