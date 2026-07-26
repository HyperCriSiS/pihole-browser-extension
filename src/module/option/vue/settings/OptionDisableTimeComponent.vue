<template>
  <div>
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
import { defineComponent, onMounted, ref, watch } from 'vue'
import {
  GroupPauseTimeDefaults,
  StorageService,
  TemporaryAllowTimeDefaults,
} from '../../../../service/StorageService'
import useTranslation from '../../../../hooks/translation'

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
    const groupPauseTimes = ref<number[]>([...GroupPauseTimeDefaults])
    const temporaryAllowTimes = ref<number[]>([...TemporaryAllowTimeDefaults])

    const updateTimes = async () => {
      const [storedGroupPauseTimes, storedTemporaryAllowTimes] =
        await Promise.all([
          StorageService.getGroupPauseTimes(),
          StorageService.getTemporaryAllowTimes(),
        ])

      if (storedGroupPauseTimes?.length === 3) {
        groupPauseTimes.value = [...storedGroupPauseTimes]
      }
      if (storedTemporaryAllowTimes?.length === 3) {
        temporaryAllowTimes.value = [...storedTemporaryAllowTimes]
      }
    }

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

    onMounted(() => updateTimes())

    return {
      translate,
      I18NOptionKeys,
      groupPauseTimes,
      temporaryAllowTimes,
    }
  },
})
</script>
