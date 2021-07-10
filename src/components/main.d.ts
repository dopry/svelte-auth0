import { SvelteComponentTyped } from 'svelte'
import { Readable } from 'svelte/store'
import Auth0Client from '@auth0/auth0-spa-js/dist/typings/Auth0Client'

declare type Auth0ContextProps = {
  /** The Auth0 domain. */
  domain: string
  /** The Auth0 client ID. */
  client_id: string
  /** The default audience to be used for requesting API access. */
  audience?: string
  /**
   * Redirect URL for after login.
   *
   * @default window.location.href
   */
  callback_url?: string
  /**
   * Redirect URL for after logout.
   * 
   * @default window.location.href
   */
  logout_url?: string
}

export class Auth0Context extends SvelteComponentTyped<Auth0ContextProps, {}, { default: {} }> {}

declare type Auth0LoginButtonProps = {
  /** Additional HTML classes to apply to the underlying button. */
  class?: string
  /** Override for the context's login redirect URL. */
  callback_url?: string
  /**
   * Tell the callback handler to return to the current URL after login.
   * 
   * @default true 
   */
  preserveRoute?: boolean
}

export class Auth0LoginButton extends SvelteComponentTyped<Auth0LoginButtonProps, {}, { default: {} }> {}

declare type Auth0LogoutButtonProps = {
  /** Additional HTML classes to apply to the underlying button. */
  class?: string
  /** Override for the context's logout redirect URL. */
  logout_url?: string
}

export class Auth0LogoutButton extends SvelteComponentTyped<Auth0LogoutButtonProps, {}, { default: {} }> {}

/** The Auth0 service loading status. True if Auth0 is still loading */
export const isLoading: Readable<boolean>
/** The Auth0 user authentication status. True if the user is authenticated */
export const isAuthenticated: Readable<boolean>
/** The user's Auth0 authentication token. */
export const authToken: Readable<string>
/** The user's Auth0 ID token claims, if available */
export const idToken: Readable<string>
/** The authenticated user's info, decoded from the Auth0 ID token. */
export const userInfo: Readable<any>
/** The last authentication error encountered. */
export const authError: Readable<Error | null>

/** The context key used to retrieve the Auth0 client in Svelte components. */
export const AUTH0_CONTEXT_CLIENT_PROMISE: {}
/** The context key used to retrieve the Auth0 login callback URL in Svelte components. */
export const AUTH0_CONTEXT_CALLBACK_URL: {};
/** The context key used to retrieve the Auth0 login callback URL in Svelte components. */
export const AUTH0_CONTEXT_LOGOUT_URL: {};

/**
 * Initiates the Auth0 login process.
 * 
 * @param client The Auth0 client used to initiate the login process.
 * @param preserveRoute Whether to return back to the URL of the page
 * where the login process was initiated from. Defaults to `true`.
 * @param callbackURL The URL that Auth0 will redirect back to after login.
 * Defaults to `window.location.href`.
 */
export function login(client: Promise<Auth0Client>, preserveRoute?: boolean, callbackURL?: string): Promise<void> 

/**
 * Logs out the given Auth0 client.
 * 
 * @param client The Auth0 client to logout.
 * @param logoutURL The URL that Auth0 will redirect back to after logout.
 * Defaults to `window.location.href`.
 */
export function logout(client: Promise<Auth0Client>, logoutURL?: string): Promise<void>

/**
 * Refreshes the authentication token for the given client.
 * 
 * @param client The token's holder.
 */
export function refreshToken(client: Promise<Auth0Client>): Promise<void>
