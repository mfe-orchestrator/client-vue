import * as orchestrator from "@mfe-orchestrator-hub/client"
import { configure, globalVariables, type OrchestratorConfig, remoteUrl } from "@mfe-orchestrator-hub/client"
import { getCurrentScope, type MaybeRefOrGetter, onScopeDispose, type Plugin, type Ref, ref, toValue, watchEffect } from "vue"

export type { GlobalVariable, Identities, Manifest, Microfrontend, OrchestratorConfig } from "@mfe-orchestrator-hub/client"

/**
 * Tells the core that the host configures the client through this package, so a missing or invalid
 * `backendUrl` / `projectId` is reported with the `createOrchestrator()` snippet instead of the bare
 * `configure()` one.
 *
 * Guarded and cast on purpose: older cores do not expose the hook, and a nicer error message is
 * never worth a crash. Called both at load, for composables used without the plugin, and on install,
 * in case a bundler drops a top level call it believes to be side effect free.
 */
const declareIntegration = (): void => {
    ;(orchestrator as unknown as { registerIntegration?: (integration: string) => void }).registerIntegration?.("vue")
}

declareIntegration()

/**
 * Replaces the logged in user, so a *User* canary is decided on the new one from the next resolution
 * on. Pass `undefined` on logout. It drops the memoized manifest of the core, which a second
 * `configure()` deliberately does not.
 *
 * Remotes already imported keep the version drawn for the previous user: the federation runtime holds
 * the container it loaded. Resolve your remotes behind your own auth guard, or reload after the switch.
 *
 * Guarded like `registerIntegration`: a host still on a core that predates this call gets a warning
 * naming the upgrade, not a crash on an import that resolves to undefined.
 */
export const setUserId = (userId: OrchestratorConfig["userId"]): void => {
    const call = (orchestrator as unknown as { setUserId?: (value: OrchestratorConfig["userId"]) => void }).setUserId
    if (!call) {
        console.warn(
            "[@mfe-orchestrator-hub/client-vue] setUserId() is not available in the installed @mfe-orchestrator-hub/client, so the user was not changed and the canary still sees the previous one. Upgrade that package."
        )
        return
    }
    call(userId)
}

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
 * The Vue plugin. Hands the configuration to `@mfe-orchestrator-hub/client` as the app is installed.
 *
 * `configure()` is idempotent, so installing the plugin twice is harmless. It stays a convenience:
 * the recommended place is still the very top of the entry point, since a bundler may import a
 * remote before the app is created.
 */
export const createOrchestrator = (config: OrchestratorConfig): Plugin => ({
    install: () => {
        declareIntegration()
        configure(config)
    }
})

/** The ready to use, version pinned URL of a remote. Use it verbatim. */
export const useRemoteUrl = (slug: MaybeRefOrGetter<string>): AsyncState<string> => useAsync(() => remoteUrl(toValue(slug)))

/** The global variables of the environment, as a plain object. */
export const useGlobalVariables = (): AsyncState<Record<string, string>> => useAsync(() => globalVariables())
