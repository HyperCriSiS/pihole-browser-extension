<template>
  <div>
    <v-tabs v-model="currentTab">
      <v-tab
        v-for="(_, index) in tabs"
        :key="`dyn-tab-${index}`"
        :value="index"
        @click="resetConnectionCheckAndCheck"
      >
        PiHole {{ index + 1 }}
      </v-tab>
    </v-tabs>
    <v-window v-model="currentTab">
      <v-window-item
        v-for="(pi_hole_setting, index) in tabs"
        :key="index"
        :value="index"
        class="mt-5"
      >
        <v-text-field
          v-model="pi_hole_setting.pi_uri_base"
          v-debounce:500ms="connectionCheck"
          variant="outlined"
          debounce-events="input"
          :placeholder="PiHoleSettingsDefaults.pi_uri_base"
          :rules="[
            (v) =>
              isValidUrlSchema(v) ||
              translate(I18NOptionKeys.options_url_invalid_warning),
          ]"
          :label="translate(I18NOptionKeys.options_pi_hole_address)"
          required
          @update:model-value="markDirty"
        ></v-text-field>
        <v-text-field
          v-model="pi_hole_setting.api_key"
          v-debounce:500ms="connectionCheck"
          variant="outlined"
          :type="passwordInputType"
          :append-inner-icon="
            passwordInputType === 'password' ? mdiEyeOutline : mdiEyeOffOutline
          "
          :label="translate(I18NOptionKeys.options_api_key)"
          @click:append-inner="toggleApiKeyVisibility"
          @update:model-value="markDirty"
        ></v-text-field>

        <div class="mb-5 d-flex flex-wrap ga-2">
          <v-btn
            color="primary"
            :loading="saving"
            :disabled="!canSave || saving"
            @click.prevent="saveSettings"
          >
            {{ translate(I18NOptionKeys.options_save_button) }}
          </v-btn>
          <v-btn v-if="tabs.length < 4" @click.prevent="addNewPiHole">
            {{ translate(I18NOptionKeys.options_add_button) }}
          </v-btn>
          <v-btn
            v-if="tabs.length > 1"
            @click.prevent="removePiHole(currentTab)"
          >
            {{
              translate(I18NOptionKeys.options_remove_button, [
                String(currentTab + 1),
              ])
            }}
          </v-btn>
        </div>

        <v-alert
          v-if="saveState === 'success'"
          class="mb-4"
          type="success"
          variant="outlined"
        >
          {{ translate(I18NOptionKeys.options_save_success) }}
        </v-alert>
        <v-alert
          v-if="saveState === 'error'"
          class="mb-4"
          type="error"
          variant="outlined"
        >
          {{ translate(I18NOptionKeys.options_save_error) }}
        </v-alert>

        <v-alert v-if="tabs.length > 1" type="info" variant="outlined">
          {{ translate(I18NOptionKeys.option_multiple_connections) }}
        </v-alert>
        <v-alert
          v-if="connectionCheckStatus === 'IDLE'"
          variant="outlined"
          type="info"
        >
          {{ translate(I18NOptionKeys.option_connection_check_idle) }}
          <v-progress-circular
            color="primary"
            indeterminate
            :size="25"
            :width="2"
          />
        </v-alert>
        <v-alert
          v-if="connectionCheckStatus === 'OK'"
          type="success"
          variant="outlined"
        >
          {{ translate(I18NOptionKeys.option_connection_check_ok) }}<br />
          {{ connectionCheckVersionText }}
        </v-alert>
        <v-alert
          v-if="connectionCheckStatus === 'ERROR'"
          variant="outlined"
          type="error"
        >
          {{ translate(I18NOptionKeys.option_connection_check_error) }}
        </v-alert>
        <v-alert
          v-if="
            connectionCheckStatus === 'OK' &&
            connectionCheckData !== null &&
            (connectionCheckData.core_update ||
              connectionCheckData.web_update ||
              connectionCheckData.FTL_update)
          "
          variant="outlined"
          type="info"
        >
          {{
            translate(I18NOptionKeys.option_connection_check_update_available)
          }}
        </v-alert>
      </v-window-item>
    </v-window>
  </div>
</template>

<script lang="ts">
import { debounce } from 'vue-debounce'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { mdiEyeOffOutline, mdiEyeOutline } from '@mdi/js'
import {
  PiHoleSettingsDefaults,
  PiHoleSettingsStorage,
  StorageService,
} from '../../../../service/StorageService'
import { PiHoleVersionsV6 } from '../../../../api/models/PiHoleVersions'
import PiHoleApiService from '../../../../service/PiHoleApiService'
import useTranslation from '../../../../hooks/translation'

enum ConnectionCheckStatus {
  OK = 'OK',
  ERROR = 'ERROR',
  IDLE = 'IDLE',
}

enum PasswordInputType {
  password = 'password',
  text = 'text',
}

type SaveState = 'success' | 'error' | null

export default defineComponent({
  name: 'OptionTabComponent',
  setup: () => {
    const tabs = ref<PiHoleSettingsStorage[]>([
      {
        pi_uri_base: '',
        api_key: '',
      },
    ])
    const currentTab = ref(0)
    const passwordInputType = ref<PasswordInputType>(PasswordInputType.password)
    const connectionCheckStatus = ref<ConnectionCheckStatus>(
      ConnectionCheckStatus.IDLE,
    )
    const connectionCheckData = ref<PiHoleVersionsV6 | null>(null)
    const saving = ref(false)
    const saveState = ref<SaveState>(null)
    const settingsDirty = ref(false)

    const currentSelectedSettings = computed(() => tabs.value[currentTab.value])

    const normalizeSettings = (): PiHoleSettingsStorage[] =>
      tabs.value.map((setting) => ({
        pi_uri_base: String(setting.pi_uri_base ?? '').replace(/\s+/g, ''),
        api_key: String(setting.api_key ?? '').replace(/\s+/g, ''),
      }))

    const isValidUrlSchema = (piHoleUrl: string) =>
      /^(http|https):\/\/[^ "]+$/.test(String(piHoleUrl ?? ''))

    const canSave = computed(() => {
      const normalizedSettings = normalizeSettings()
      return (
        normalizedSettings.length > 0 &&
        normalizedSettings.every((setting) =>
          isValidUrlSchema(setting.pi_uri_base ?? ''),
        )
      )
    })

    const connectionCheck = () => {
      connectionCheckStatus.value = ConnectionCheckStatus.IDLE
      PiHoleApiService.getPiHoleVersion(currentSelectedSettings.value)
        .then((result) => {
          if (typeof result.data === 'object') {
            connectionCheckStatus.value = ConnectionCheckStatus.OK
            connectionCheckData.value = result.data
          } else {
            connectionCheckStatus.value = ConnectionCheckStatus.ERROR
          }
        })
        .catch(() => {
          connectionCheckStatus.value = ConnectionCheckStatus.ERROR
        })
    }

    const resetConnectionCheckAndCheck = () => {
      connectionCheckStatus.value = ConnectionCheckStatus.IDLE
      connectionCheckData.value = null
      debounce(() => {
        connectionCheck()
      }, '300ms')()
    }

    const updateTabsSettings = async () => {
      const results = await StorageService.getPiHoleSettingsArray()
      if (typeof results !== 'undefined' && results.length > 0) {
        tabs.value = results.map((setting) => ({ ...setting }))
      }
      settingsDirty.value = false
    }

    const markDirty = () => {
      settingsDirty.value = true
      saveState.value = null
    }

    const saveSettings = async () => {
      if (!canSave.value) {
        saveState.value = 'error'
        return
      }

      saving.value = true
      saveState.value = null
      try {
        const normalizedSettings = normalizeSettings()
        await StorageService.savePiHoleSettingsArray(normalizedSettings)
        tabs.value = normalizedSettings
        settingsDirty.value = false
        saveState.value = 'success'
        resetConnectionCheckAndCheck()
      } catch (reason) {
        console.warn(reason)
        saveState.value = 'error'
      } finally {
        saving.value = false
      }
    }

    onMounted(() => {
      updateTabsSettings().then(() => resetConnectionCheckAndCheck())
    })

    watch(currentTab, () => {
      passwordInputType.value = PasswordInputType.password
      saveState.value = null
    })

    const connectionCheckVersionText = computed(() => {
      const data = connectionCheckData.value
      return `Core: ${data?.version.core.local.version} FTL: ${data?.version.ftl.local.version} Web: ${data?.version.web.local.version}`
    })

    const toggleApiKeyVisibility = () => {
      if (passwordInputType.value === PasswordInputType.password) {
        passwordInputType.value = PasswordInputType.text
      } else {
        passwordInputType.value = PasswordInputType.password
      }
    }

    const addNewPiHole = () => {
      tabs.value.push({ pi_uri_base: '', api_key: '' })
      currentTab.value = tabs.value.length - 1
      connectionCheckStatus.value = ConnectionCheckStatus.IDLE
      connectionCheckData.value = null
      markDirty()
    }

    const removePiHole = (index: number) => {
      tabs.value.splice(index, 1)
      currentTab.value = Math.min(index, tabs.value.length - 1)
      markDirty()
      resetConnectionCheckAndCheck()
    }

    return {
      PiHoleSettingsDefaults,
      mdiEyeOutline,
      mdiEyeOffOutline,
      currentTab,
      tabs,
      passwordInputType,
      connectionCheck,
      resetConnectionCheckAndCheck,
      isValidUrlSchema,
      removePiHole,
      addNewPiHole,
      toggleApiKeyVisibility,
      connectionCheckVersionText,
      connectionCheckStatus,
      connectionCheckData,
      canSave,
      saving,
      saveState,
      settingsDirty,
      saveSettings,
      markDirty,
      ...useTranslation(),
    }
  },
})
</script>
