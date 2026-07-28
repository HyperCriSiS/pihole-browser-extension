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
          :groups="groups"
          :groups-loading="groupsLoading"
          :hide-group-selector="hideGroupSelector"
          @selected-group-change="setSelectedGroup"
        />
        <v-divider v-if="isListFeatureActive"></v-divider>

        <PopupStatusCardComponent
          :selected-group="selectedGroup"
          :groups-loading="groupsLoading"
          :group-load-error="groupLoadError"
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
import PiHoleApiService from '../../../../service/PiHoleApiService'
import type { PiHoleGroup } from '../../../../api/models/PiHoleGroups'

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
    const groups = ref<PiHoleGroup[]>([])
    const groupsLoading = ref(false)
    const groupLoadError = ref(false)
    const hideGroupSelector = ref(false)
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

    const loadGroupSettings = async () => {
      groupsLoading.value = true
      groupLoadError.value = false
      const [storedGroup, hideSelector] = await Promise.all([
        StorageService.getPauseTarget(),
        StorageService.getHideGroupSelectorInPopup(),
      ])
      hideGroupSelector.value = hideSelector

      try {
        groups.value = (await PiHoleApiService.getCommonGroups()).filter(
          (group) => group.enabled,
        )
        const storedGroupExists = groups.value.some(
          (group) => group.name === storedGroup,
        )
        selectedGroup.value = storedGroupExists
          ? storedGroup!
          : groups.value[0]?.name || null

        if (selectedGroup.value && !storedGroupExists) {
          StorageService.savePauseTarget(selectedGroup.value)
        }
      } catch (reason) {
        console.warn(reason)
        groupLoadError.value = true
        selectedGroup.value = storedGroup || null
      } finally {
        groupsLoading.value = false
      }
    }

    const setSelectedGroup = async (groupName: string | null) => {
      selectedGroup.value = groupName
      if (!groupName) {
        return
      }

      StorageService.savePauseTarget(groupName)
      await DomainStatusService.refreshCurrentTabBadge(groupName)
    }

    const isListFeatureActive = computed(
      () => !listFeatureDisabled.value && currentUrl.value.length > 0,
    )

    const openOptions = () => chrome.runtime.openOptionsPage()

    onMounted(async () => {
      await Promise.all([
        updateCurrentUrl(),
        updateListFeatureDisabled(),
        loadGroupSettings(),
      ])
    })

    return {
      mdiCog,
      currentUrl,
      selectedGroup,
      groups,
      groupsLoading,
      groupLoadError,
      hideGroupSelector,
      isListFeatureActive,
      setSelectedGroup,
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
  padding: 0 10px 8px;
}
</style>
