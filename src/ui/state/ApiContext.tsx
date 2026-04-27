/**
 * ApiContext — gives any descendant access to the Vortex
 * `IExtensionApi` injected at registration time.
 *
 * Why a context (rather than passing `api` through every prop):
 *   - Most pages pass it 4-5 levels deep into wizard sub-steps and
 *     buttons; threading it explicitly bloats every signature.
 *   - We want hooks (`useApi()`) so unit-test stubs can inject a
 *     mock api without monkey-patching globals.
 *
 * Vortex feeds the `api` to the registered component via the
 * `props: () => ({ api: context.api })` option on registerMainPage,
 * and `EventHorizonMainPage` re-exposes it as the context value.
 */

import * as React from "react";
import type { types } from "vortex-api";

const ApiContext = React.createContext<types.IExtensionApi | null>(null);

export interface ApiProviderProps {
  api: types.IExtensionApi;
  children: React.ReactNode;
}

export function ApiProvider(props: ApiProviderProps): JSX.Element {
  return (
    <ApiContext.Provider value={props.api}>
      {props.children}
    </ApiContext.Provider>
  );
}

export function useApi(): types.IExtensionApi {
  const api = React.useContext(ApiContext);
  if (api === null) {
    throw new Error(
      "useApi() called outside ApiProvider — wrap your component tree in <ApiProvider api={...}>",
    );
  }
  return api;
}

/**
 * Variant that does NOT throw — useful for components that may be
 * rendered both inside the Vortex tree and in isolation (e.g. while
 * authoring docs or running storybook). Returns `undefined` if no
 * provider is mounted.
 */
export function useApiOptional(): types.IExtensionApi | undefined {
  const api = React.useContext(ApiContext);
  return api ?? undefined;
}
