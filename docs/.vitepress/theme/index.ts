import { Fragment, h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import MediaPreview from './MediaPreview.vue'
import OutlineToggle from './OutlineToggle.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, {
    'layout-bottom': () => h(Fragment, null, [
      h(MediaPreview),
      h(OutlineToggle)
    ])
  })
}
