# svelte-auth0

An Auth0 Component for Svelte.

## Getting Started

Setup an [Auth0](http://auth0.com) Account. Get the domain client_id  from the Default App.

`npm install svelte-auth0`

App.svelte
```
# App.svelte
import {
  Auth0Context,
  authError,
  authToken,
  isAuthenticated,
  isLoading,
  login,
  logout,
  userInfo,
} from './components/components.module.js';
</script>

<Auth0Context domain="dev-hvw40i79.auth0.com" client_id="aOijZt2ug6Ovgzp0HXdF23B6zxwA6PaP">
  <button on:click|preventDefault='{login}'>Login</button>
  <button on:click|preventDefault='{logout}'>Logout</button><br />
  <pre>isLoading: {$isLoading}</pre>
  <pre>isAuthenticated: {$isAuthenticated}</pre>
  <pre>authToken: {$authToken}</pre>
  <pre>userInfo: {JSON.stringify($userInfo, null, 2)}</pre>
  <pre>authError: {$authError}</pre>
</Auth0Context>
```

## Docs

### Components
* Auth0Context - component to initiate the Auth0 client. You only need one instance in your DOM tree at the root.

### Functions
* login - function to begin a user login.
* logout - function to log a user user.
* refreshToken - function to refresh a token.

### Stores
* isLoading - if true auth0 is still loading.
* isAuthenticated - true if user is currently authenticated
* authToken - api token
* userInfo - the currently logged in user's info from Auth0
* authError - the last authentication error.

### Constants
* AUTH0_CONTEXT_KEY - key for the Auth0 client in setContext/getContext.