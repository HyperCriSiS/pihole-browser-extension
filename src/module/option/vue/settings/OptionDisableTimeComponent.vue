<template>
  <div>
    <div class="text-subtitle-1 mb-2">
      {{ translate(I18NOptionKeys.options_client_group_title) }}
    </div>
    <v-select
      v-model="selectedGroup"
      :items="groupItems"
      :label="translate(I18NOptionKeys.options_default_client_group)"
      :loading="groupsLoading"
      :disabled="groupsLoading || groupItems.length === 0"
      :error-messages="
        groupLoadError
          ? [translate(I18NOptionKeys.options_client_group_load_error)]
          : []
      "
      variant="outlined"
      density="compact"
    ></v-select>
    <v-checkbox
      v-model="hideGroupSelectorInPopup"
      class="mt-n3 mb-2"
      :label="translate(I18NOptionKeys.options_hide_group_selector_in_popup)"
      hide-details
    ></v-checkbox>

    <v-divider class="mb-4"></v-divider>

    <div class="text-subtitle-1 mb-2">
      {{ translate(I18NOptionKeys.options_group_pause_times_title) }}
    </div>
    <v-row>
      <v-col
        v-for="(_, index) in groupPauseTimes"
        :key="`group-${index}`"
        cols="12"
        sm="4"
      >
        <v-text-field
          v-model.number="groupPauseTimes[index]"
          :label="`${translate(
            I18NOptionKeys.options_group_pause_time_label,
          )} ${index + 1}`"
          type="number"
          min="10"
          variant="outlined"
          :rules="[(v) => Number(v) >= 10 || '≥ 10']"
          :suffix="translate(I18NOptionKeys.options_default_time_unit)"
          :hint="translate(I18NOptionKeys.options_group_pause_time_hint)"
          persistent-hint
        ></v-text-field>
      </v-col>
    </v-row>

    <div class="text-subtitle-1 mt-4 mb-2">
      {{ translate(I18NOptionKeys.options_temporary_allow_times_title) }}
    </div>
    <v-row>
      <v-col
        v-for="(_, index) in temporaryAllowTimes"
        :key="`domain-${index}`"
        cols="12"
        sm="4"
      >
        <v-text-field
          v-model.number="temporaryAllowTimes[index]"
          :label="`${translate(
            I18NOptionKeys.options_temporary_allow_time_label,
          )} ${index + 1}`"
          type="number"
          min="10"
          variant="outlined"
          :rules="[(v) => Number(v) >= 10 || '≥ 10']"
          :suffix="translate(I18NOptionKeys.options_default_time_unit)"
          :hint="translate(I18NOptionKeys.options_temporary_allow_time_hint)"
          persistent-hint
        ></v-text-field>
      </v-col>
    </v-row>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import {
  GroupPauseTimeDefaults,
  StorageService,
  TemporaryAllowTimeDefaults,
} from '../../../../service/StorageService'
import useTranslation from '../../../../hooks/translation'
import PiHoleApiService from '../../../../service/PiHoleApiService'
import type { PiHoleGroup } from '../../../../api/models/PiHoleGroups'

const areValidPresetTimes = (times: number[]): boolean => {
  const normalizedTimes = times.map(Number)
  return (
    normalizedTimes.length === 3 &&
    normalizedTimes.every((time) => Number.isInteger(time) && time >= 10)
  )
}

export default defineComponent({
  name: 'OptionActionTimesComponent',
  setup: () => {
    const { translate, I18NOptionKeys } = useTranslation()
    const groups = ref<PiHoleGroup[]>([])
    const groupsLoading = ref(false)
    const groupLoadError = ref(false)
    const selectedGroup = ref<string | null>(null)
    const hideGroupSelectorInPopup = ref(false)
    const groupPauseTimes = ref<number[]>([...GroupPauseTimeDefaults])
    const temporaryAllowTimes = ref<number[]>([...TemporaryAllowTimeDefaults])

    const groupItems = computed(() =>
      groups.value.map((group) => ({ title: group.name, value: group.name })),
    )

    const updateSettings = async () => {
      groupsLoading.value = true
      groupLoadError.value = false

      const [
        storedGroupPauseTimes,
        storedTemporaryAllowTimes,
        storedGroup,
        hideSelector,
      ] = await Promise.all([
        StorageService.getGroupPauseTimes(),
        StorageService.getTemporaryAllowTimes(),
        StorageService.getPauseTarget(),
        StorageService.getHideGroupSelectorInPopup(),
      ])

      if (storedGroupPauseTimes?.length === 3) {
        groupPauseTimes.value = [...storedGroupPauseTimes]
      }
      if (storedTemporaryAllowTimes?.length === 3) {
        temporaryAllowTimes.value = [...storedTemporaryAllowTimes]
      }
      hideGroupSelectorInPopup.value = hideSelector

      try {
        groups.value = (await PiHoleApiService.getCommonGroups()).filter(
          (group) => group.enabled,
        )
        const validStoredGroup = groups.value.some(
          (group) => group.name === storedGroup,
        )
        selectedGroup.value = validStoredGroup
          ? storedGroup!
          : groups.value[0]?.name || null

        if (selectedGroup.value && !validStoredGroup) {
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

    watch(selectedGroup, (groupName) => {
      if (groupName) {
        StorageService.savePauseTarget(groupName)
      }
    })

    watch(hideGroupSelectorInPopup, (state) => {
      StorageService.saveHideGroupSelectorInPopup(state)
    })

    watch(
      groupPauseTimes,
      (times) => {
        if (areValidPresetTimes(times)) {
          StorageService.saveGroupPauseTimes(times.map(Number))
        }
      },
      { deep: true },
    )

    watch(
      temporaryAllowTimes,
      (times) => {
        if (areValidPresetTimes(times)) {
          StorageService.saveTemporaryAllowTimes(times.map(Number))
        }
      },
      { deep: true },
    )

    onMounted(() => updateSettings())

    return {
      translate,
      I18NOptionKeys,
      groupItems,
      groupsLoading,
      groupLoadError,
      selectedGroup,
      hideGroupSelectorInPopup,
      groupPauseTimes,
      temporaryAllowTimes,
    }
  },
})
</script>
