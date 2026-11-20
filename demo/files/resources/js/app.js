import { createInertiaApp } from '@inertiajs/vue3'
import { setupPrecognitionPlus } from 'precognition-plus'
import { createApp, h } from 'vue'
import { startPlus } from './demo/requestLog'

startPlus(setupPrecognitionPlus)

createInertiaApp({
    resolve: (name) => import.meta.glob('./Pages/**/*.vue', { eager: true })[`./Pages/${name}.vue`],
    setup({ el, App, props, plugin }) {
        createApp({ render: () => h(App, props) }).use(plugin).mount(el)
    },
})
