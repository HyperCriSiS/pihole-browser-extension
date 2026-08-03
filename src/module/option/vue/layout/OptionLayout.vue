<template>
  <v-app>
    <v-navigation-drawer>
      <div class="navigation-header">
        <img
          class="navigation-logo"
          src="icon/icon-128.png"
          alt=""
          width="44"
          height="44"
        />
        <div class="navigation-title text-h6">
          PiHole<br />Browser<br />Extension
        </div>
      </div>

      <v-divider></v-divider>

      <v-list density="compact" nav>
        <v-list-item
          link
          to="/"
          :prepend-icon="mdiCog"
          :title="translate(I18NOptionKeys.options_settings)"
        />
        <v-list-item
          link
          to="/about"
          :prepend-icon="mdiInformationOutline"
          :title="translate(I18NOptionKeys.options_about)"
        />
        <v-divider />
        <v-list-item
          link
          :href="LinkConfig.paypal_donation_link"
          target="_blank"
          :prepend-icon="mdiGift"
          :title="translate(I18NOptionKeys.option_donation)"
        />
        <v-list-item
          link
          :href="LinkConfig.github_issue"
          target="_blank"
          :prepend-icon="mdiFire"
          :title="translate(I18NOptionKeys.option_troubleshooting)"
        />
      </v-list>
      <template #append>
        <v-alert color="primary" variant="outlined" class="mx-5">
          <div>(C) {{ copyrightYear }} - Pascal Glaser</div>
          <div>(C) {{ copyrightYear }} - HyperCriSiS</div>
        </v-alert>
      </template>
    </v-navigation-drawer>
    <v-main>
      <v-container fluid style="max-width: 1440px">
        <router-view></router-view>
      </v-container>
    </v-main>
  </v-app>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { mdiCog, mdiFire, mdiGift, mdiInformationOutline } from '@mdi/js'
import useTranslation from '../../../../hooks/translation'

export default defineComponent({
  name: 'OptionComponent',
  setup: () => {
    const { translate, LinkConfig, I18NOptionKeys } = useTranslation()

    const copyrightYear = computed(() => new Date().getFullYear())

    return {
      copyrightYear,
      translate,
      LinkConfig,
      I18NOptionKeys,
      mdiCog,
      mdiInformationOutline,
      mdiGift,
      mdiFire,
    }
  },
})
</script>

<style scoped lang="scss">
.navigation-logo {
  display: block;
  width: 44px;
  height: 44px;
  object-fit: contain;
}

.navigation-header {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  min-height: 76px;
  padding: 12px 12px 12px 16px;
}

.navigation-title {
  line-height: 1.15;
}
</style>
