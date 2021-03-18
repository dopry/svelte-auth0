# svelte-auth0

An Auth0 Component for Svelte.

[Try out the demo](https://darrelopry.com/svelte-auth0/)

## Getting Started

Setup an [Auth0](http://auth0.com) Account. Get the domain client_id  from the Default App.

`npm install @dopry/svelte-auth0`

### App.svelte

```svelte
<script>
import {
  Auth0Context,
  Auth0LoginButton,
  Auth0LogoutButton,
  authError,
  authToken,
  idToken,
  isAuthenticated,
  isLoading,
  login,
  logout,
  userInfo,
} from '@dopry/svelte-auth0';
</script>

<Auth0Context domain="dev-hvw40i79.auth0.com" client_id="aOijZt2ug6Ovgzp0HXdF23B6zxwA6PaP">
  <Auth0LoginButton>Login</Auth0LoginButton>
  <Auth0LogoutButton>Logout</Auth0LogoutButton>
  <pre>isLoading: {$isLoading}</pre>
  <pre>isAuthenticated: {$isAuthenticated}</pre>
  <pre>authToken: {$authToken}</pre>
  <pre>idToken: {$idToken}</pre>
  <pre>userInfo: {JSON.stringify($userInfo, null, 2)}</pre>
  <pre>authError: {$authError}</pre>
</Auth0Context>
```

## Docs

### Components

* Auth0Context - component to initiate the Auth0 client. You only need one instance in your DOM tree at the root

  Attributes:
  * domain - Auth0 domain
  * client_id - Auth0 ClientId
  * audience - The default audience to be used for requesting API access
  * callback_url - override the default url that Auth0 will redirect to after login. default: window.location.href
  * logout_url - override the default url that Auth0 will redirect to after logout. default: window.location.href

* Auth0LoginButton - log out the current context

  Attributes:
  * preserve_route - tell the callback handler to return to the current url after login. default: true
  * callback_url - override the context callback_url

* Auth0LogoutButton - log in the current context
  
  Attributes:
  * logout_url - override the context logout_url

### Functions

* login(auth0Promise, preseveRoute = true, callback_url = null) - begin a user login.
* logout(auth0Promise, logout_url = null) - logout a user.
* refreshToken(auth0Promise) - function to refresh a token.

### Stores

* isLoading - if true auth0 is still loading.
* isAuthenticated - true if user is currently authenticated
* authToken - api token
* userInfo - the currently logged in user's info from Auth0
* authError - the last authentication error.

### Constants

* AUTH0_CONTEXT_CALLBACK_URL,
* AUTH0_CONTEXT_CLIENT_PROMISE - key for the Auth0 client in setContext/getContext.
* AUTH0_CONTEXT_LOGOUT_URL,

## Release

**use semver**
npm publish
npm run showcase:build
npm run showcase:publish
