<template>
  <v-card class="mt-5">
    <v-card-title>
      {{ translate(I18NOptionKeys.options_data_management_title) }}
    </v-card-title>
    <v-card-text>
      <p class="mb-4">
        {{ translate(I18NOptionKeys.options_data_management_info) }}
      </p>

      <v-checkbox
        v-model="includeCredentials"
        :label="translate(I18NOptionKeys.options_backup_include_credentials)"
        hide-details
      />
      <v-btn class="mb-6" @click="exportSettings">
        {{ translate(I18NOptionKeys.options_backup_export) }}
      </v-btn>

      <v-file-input
        accept="application/json,.json"
        variant="outlined"
        :label="translate(I18NOptionKeys.options_backup_import_select)"
        @update:model-value="readImportFile"
      />

      <v-alert
        v-if="importPreview"
        class="mb-4"
        type="info"
        variant="outlined"
      >
        {{
          translate(I18NOptionKeys.options_backup_import_preview, [
            String(importPreview.connectionCount),
            String(importPreview.preferenceCount),
            importPreview.includesCredentials
              ? translate(I18NOptionKeys.options_yes)
              : translate(I18NOptionKeys.options_no),
          ])
        }}
      </v-alert>
      <v-alert
        v-if="state === 'error'"
        class="mb-4"
        type="error"
        variant="outlined"
      >
        {{ translate(I18NOptionKeys.options_backup_error) }}
      </v-alert>
      <v-alert
        v-if="state === 'success'"
        class="mb-4"
        type="success"
        variant="outlined"
      >
        {{ translate(I18NOptionKeys.options_backup_success) }}
      </v-alert>

      <v-btn
        v-if="importPreview"
        class="mb-6"
        color="primary"
        :loading="applyingImport"
        @click="applyImport"
      >
        {{ translate(I18NOptionKeys.options_backup_import_apply) }}
      </v-btn>

      <v-divider class="mb-4" />
      <v-switch
        v-model="syncEnabled"
        color="primary"
        :label="translate(I18NOptionKeys.options_safe_sync)"
        :hint="translate(I18NOptionKeys.options_safe_sync_hint)"
        persistent-hint
        @update:model-value="toggleSync"
      />
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue'
import { I18NOptionKeys } from '../../../../service/i18NService'
import SettingsTransferService, {
  SettingsImportPreview,
} from '../../../../service/SettingsTransferService'
import { StorageService } from '../../../../service/StorageService'
import useTranslation from '../../../../hooks/translation'

type TransferState = 'success' | 'error' | null

export default defineComponent({
  name: 'OptionDataManagementComponent',
  setup: () => {
    const { translate } = useTranslation()
    const includeCredentials = ref(false)
    const syncEnabled = ref(false)
    const importPreview = ref<SettingsImportPreview | null>(null)
    const applyingImport = ref(false)
    const state = ref<TransferState>(null)

    onMounted(async () => {
      syncEnabled.value = await StorageService.getSettingsSyncEnabled()
    })

    const exportSettings = async () => {
      state.value = null
      try {
        const content = await SettingsTransferService.serializeBackup(
          includeCredentials.value,
        )
        const blob = new Blob([content], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `wormhole-connector-settings-${new Date()
          .toISOString()
          .slice(0, 10)}.json`
        link.click()
        URL.revokeObjectURL(url)
        state.value = 'success'
      } catch (reason) {
        console.warn(reason)
        state.value = 'error'
      }
    }

    const readImportFile = async (value: File | File[] | null) => {
      state.value = null
      importPreview.value = null
      const file = Array.isArray(value) ? value[0] : value
      if (!file) {
        return
      }

      try {
        importPreview.value = SettingsTransferService.previewImport(
          await file.text(),
        )
      } catch (reason) {
        console.warn(reason)
        state.value = 'error'
      }
    }

    const applyImport = async () => {
      if (!importPreview.value) {
        return
      }

      applyingImport.value = true
      state.value = null
      try {
        await SettingsTransferService.applyImport(importPreview.value)
        if (syncEnabled.value) {
          await SettingsTransferService.publishSafeSyncSnapshot()
        }
        state.value = 'success'
      } catch (reason) {
        console.warn(reason)
        state.value = 'error'
      } finally {
        applyingImport.value = false
      }
    }

    const toggleSync = async (enabled: boolean | null) => {
      try {
        await SettingsTransferService.setSyncEnabled(enabled === true)
        syncEnabled.value = enabled === true
      } catch (reason) {
        console.warn(reason)
        syncEnabled.value = false
        state.value = 'error'
      }
    }

    return {
      I18NOptionKeys,
      translate,
      includeCredentials,
      syncEnabled,
      importPreview,
      applyingImport,
      state,
      exportSettings,
      readImportFile,
      applyImport,
      toggleSync,
    }
  },
})
</script>
