import { configure, globalVariables, type OrchestratorConfig, remoteUrl } from "@mfe-orchestrator/client"
import { getCurrentScope, type MaybeRefOrGetter, onScopeDispose, type Plugin, type Ref, ref, toValue, watchEffect } from "vue"

export type { GlobalVariable, Identities, Manifest, Microfrontend, OrchestratorConfig } from "@mfe-orchestrator/client"

/** The state of one asynchronous read from the core, as refs. */
export interface AsyncState<TValue> {
    data: Ref<TValue | undefined>
    error: Ref<Error | undefined>
    loading: Ref<boolean>
}

const toError = (thrown: unknown): Error => (thrown instanceof Error ? thrown : new Error(String(thrown)))

/**
 * Runs `task` whenever its reactive inputs change and tracks the outcome. Late results of a
 * superseded run are dropped, so a slug that changes mid flight cannot overwrite the newer answer.
 */
const useAsync = <TValue>(task: () => Promise<TValue>): AsyncState<TValue> => {
    const data = ref<TValue | undefined>(undefined) as Ref<TValue | undefined>
    const error = ref<Error | undefined>(undefined)
    const loading = ref(true)
    let current = 0

    const run = () => {
        const generation = ++current
        loading.value = true
        task().then(
            resolved => {
                if (generation === current) {
                    data.value = resolved
                    error.value = undefined
                    loading.value = false
                }
            },
            thrown => {
                if (generation === current) {
                    data.value = undefined
                    error.value = toError(thrown)
                    loading.value = false
                }
            }
        )
    }

    watchEffect(run)
    if (getCurrentScope()) {
        onScopeDispose(() => {
            // Invalidates whatever is still in flight when the component goes away.
            current++
        })
    }

    return { data, error, loading }
}

/**
 * The Vue plugin. Hands the configuration to `@mfe-orchestrator/client` as the app is installed.
 *
 * `configure()` is idempotent, so installing the plugin twice is harmless. It stays a convenience:
 * the recommended place is still the very top of the entry point, since a bundler may import a
 * remote before the app is created.
 */
export const createOrchestrator = (config: OrchestratorConfig): Plugin => ({
    install: () => {
        configure(config)
    }
})

/** The ready to use, version pinned URL of a remote. Use it verbatim. */
export const useRemoteUrl = (slug: MaybeRefOrGetter<string>): AsyncState<string> => useAsync(() => remoteUrl(toValue(slug)))

/** The global variables of the environment, as a plain object. */
export const useGlobalVariables = (): AsyncState<Record<string, string>> => useAsync(() => globalVariables())
