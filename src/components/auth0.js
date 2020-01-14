import { writable } from 'svelte/store';
import { getContext } from 'svelte';

export const isLoading = writable(true);
export const isAuthenticated = writable(false);
export const authToken = writable('');
export const userInfo = writable({});
export const authError = writable(null);


/**
 * using an object literal means the keys are guaranteed not to conflict in any circumstance (since an object only has
 * referential equality to itself, i.e. {} !== {} whereas "x" === "x"), even when you have multiple different contexts
 * operating across many component layers.
 */
export const AUTH0_CONTEXT_KEY = {};

export async function refreshToken() {
    const auth0 = await getContext(AUTH0_CONTEXT_KEY)
    const token = await auth0.getTokenSilently();
    authToken.set(token);
}

export async function login(preserveRoute = true) {
    const auth0 = await getContext(AUTH0_CONTEXT_KEY)
    // try to keep the user on the same page from which they triggered login. If set to false should typically
    // cause redirect to /.
    const appState = (preserveRoute) ? { pathname: window.location.pathname, search: window.location.search } : {}
    await auth0.loginWithRedirect({ redirect_uri: window.location.origin, appState });
}

export async function logout() {
    // getContext(AUTH0_CONTEXT_KEY) returns a promise.
    const auth0 = await getContext(AUTH0_CONTEXT_KEY)
    authToken.set('');
    auth0.logout({ returnTo: window.location.origin});
}