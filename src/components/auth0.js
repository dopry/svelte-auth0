import { writable } from 'svelte/store';

/**
 * Stores
 */
export const isLoading = writable(true);
export const isAuthenticated = writable(false);
export const authToken = writable('');
export const idToken = writable('');
export const userInfo = writable({});
export const authError = writable(null);

/**
 * Context Keys
 *
 * using an object literal means the keys are guaranteed not to conflict in any circumstance (since an object only has
 * referential equality to itself, i.e. {} !== {} whereas "x" === "x"), even when you have multiple different contexts
 * operating across many component layers.
 */
export let AUTH0_CONTEXT_CLIENT_PROMISE = {value:null};
export let AUTH0_CONTEXT_CALLBACK_URL = {value:null};
export let AUTH0_CONTEXT_LOGOUT_URL = {value:null};

/**
 * Refresh the authToken store.
 */
export async function refreshToken() {
    const auth0 = await AUTH0_CONTEXT_CLIENT_PROMISE.value;
    const token = await auth0.getTokenSilently();
    authToken.set(token);
}

/**
 * Initiate Register/Login flow.
 *
 * @param {boolean} preserveRoute - store current location so callback handler will navigate back to it.
 * @param {string} callback_url - explicit path to use for the callback.
 */
export async function login(preserveRoute = true, callback_url = null) {
    const auth0 = await AUTH0_CONTEXT_CLIENT_PROMISE.value;
    const redirect_uri =  callback_url || AUTH0_CONTEXT_CALLBACK_URL.value || window.location.href;

    // try to keep the user on the same page from which they triggered login. If set to false should typically
    // cause redirect to /.
    const appState = (preserveRoute) ? { pathname: window.location.pathname, search: window.location.search } : {}
    await auth0.loginWithRedirect({ redirect_uri, appState });
}

/**
 * Log out the current user.
 *
 * @param {string} logout_url - specify the url to return to after login.
 */
export async function logout(logout_url = null) {
    const auth0 = await AUTH0_CONTEXT_CLIENT_PROMISE.value;
    const returnTo = logout_url || AUTH0_CONTEXT_LOGOUT_URL.value || window.location.href;
    authToken.set('');
    auth0.logout({ returnTo });
}
