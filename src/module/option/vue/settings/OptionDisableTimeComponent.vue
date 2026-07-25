<template>
  <div>
    <v-text-field
      v-model.number="disableTime"
      :label="translate(I18NOptionKeys.options_default_time_label)"
      type="number"
      min="10"
      outlined
      :rules="[v => Number(v) >= 10 || '≥ 10']"
      :suffix="translate(I18NOptionKeys.options_default_time_unit)"
    ></v-text-field>

    <div class="subtitle-1 mb-2">
      {{ translate(I18NOptionKeys.options_temporary_allow_times_title) }}
    </div>
    <v-row dense>
      <v-col
        v-for="(_, index) in temporaryAllowTimes"
        :key="index"
        cols="12"
        sm="4"
      >
        <v-text-field
          v-model.number="temporaryAllowTimes[index]"
          :label="
            `${translate(
              I18NOptionKeys.options_temporary_allow_time_label
            )} ${index + 1}`
          "
          type="number"
          min="10"
          outlined
          :rules="[v => Number(v) >= 10 || '≥ 10']"
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
  PiHoleSettingsDefaults,
  StorageService,
  TemporaryAllowTimeDefaults
} from '../../../../service/StorageService'
import useTranslation from '../../../../hooks/translation'

export default defineComponent({
  name: 'OptionDisableTimeComponent',
  setup: () => {
    const { translate, I18NOptionKeys } = useTranslation()
    const disableTime = ref(PiHoleSettingsDefaults.default_disable_time)
    const temporaryAllowTimes = ref<number[]>([...TemporaryAllowTimeDefaults])

    const updateTimes = async () => {
      const [storedDisableTime, storedTemporaryAllowTimes] = await Promise.all([
        StorageService.getDefaultDisableTime(),
        StorageService.getTemporaryAllowTimes()
      ])

      if (typeof storedDisableTime !== 'undefined') {
        disableTime.value = storedDisableTime
      }
      if (storedTemporaryAllowTimes?.length === 3) {
        temporaryAllowTimes.value = [...storedTemporaryAllowTimes]
      }
    }

    watch(disableTime, () => {
      if (Number.isInteger(disableTime.value) && disableTime.value >= 10) {
        StorageService.saveDefaultDisableTime(Number(disableTime.value))
      }
    })

    watch(
      temporaryAllowTimes,
      times => {
        const normalizedTimes = times.map(Number)
        if (
          normalizedTimes.length === 3 &&
          normalizedTimes.every(time => Number.isInteger(time) && time >= 10)
        ) {
          StorageService.saveTemporaryAllowTimes(normalizedTimes)
        }
      },
      { deep: true }
    )

    onMounted(() => updateTimes())

    return {
      translate,
      I18NOptionKeys,
      disableTime,
      temporaryAllowTimes
    }
  }
})
</script>
