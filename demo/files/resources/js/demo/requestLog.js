import { reactive, ref } from 'vue'

export const log = reactive([])
export const serverRequests = ref(0)
export const plusEnabled = ref(false)

let id = 0
let install
let uninstall

const add = (entry) => {
    const reactiveEntry = reactive({ id: ++id, ...entry })
    log.push(reactiveEntry)
    return reactiveEntry
}

export const logCheck = (label) => add({ type: 'check', label, result: null })
export const removeEntry = (entry) => log.splice(log.indexOf(entry), 1)

export function clearLog() {
    log.splice(0)
    serverRequests.value = 0
}

export function startPlus(setupPrecognitionPlus) {
    install = setupPrecognitionPlus
    uninstall = install()
    plusEnabled.value = true
}

export function togglePlus() {
    if (uninstall) {
        uninstall()
        uninstall = null
    } else {
        uninstall = install()
    }
    plusEnabled.value = Boolean(uninstall)
    add({ type: 'note', text: plusEnabled.value ? 'Precognition Plus turned on' : 'Precognition Plus turned off: every check goes to the server' })
}

const originalFetch = window.fetch.bind(window)

// True while the latest request is the one that fetches the rules, which no
// browser check came before.
export const fetchingRules = ref(false)

window.fetch = (input, init = {}) => {
    const headers = new Headers(init.headers)

    if (headers.get('Precognition') === 'true') {
        serverRequests.value++
        fetchingRules.value = headers.has('Precognition-Rules')
    }

    return originalFetch(input, init)
}
