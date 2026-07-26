import Vue from 'vue'
import { Initializer } from '../../general/Initializer'
import PopupComponent from '../vue/view/PopupComponent.vue'
import vuetify from '../../../plugins/vuetify'

export default class PopupInitializer implements Initializer {
  init(): void {
    const vueComponent = {
      vuetify,
      el: '#main',
      render: (h: any) => h(PopupComponent)
    }
    // eslint-disable-next-line no-new
    new Vue(vueComponent)
  }
}
