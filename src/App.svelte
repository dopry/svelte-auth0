<script>
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

<style></style>

<Auth0Context
  domain="dev-hvw40i79.auth0.com"
  client_id="aOijZt2ug6Ovgzp0HXdF23B6zxwA6PaP"
  callback_url="process.env.AUTH0_DEFAULT_CALLBACK_URL"
  logout_url="process.env.AUTH0_DEFAULT_CALLBACK_URL"
>
  <button on:click|preventDefault='{() => login() }'>Login</button>
  <button on:click|preventDefault='{() => logout() }'>Logout</button><br />
  <pre>isLoading: {$isLoading}</pre>
  <pre>isAuthenticated: {$isAuthenticated}</pre>
  <pre>authToken: {$authToken}</pre>
  <pre>userInfo: {JSON.stringify($userInfo, null, 2)}</pre>
  <pre>authError: {$authError}</pre>
</Auth0Context>

<p>
If social login is not persisting across page reloads, you are most likely using Universal Login classic with Auth0 Dev
keys for the social provider. There are two ways to resolve the issue:
</p>
<ol>
  <li><a href="https://auth0.com/docs/universal-login/new">Switch to the New Universal Login Experience]()</a></li>
  <li><a href="https://auth0.com/docs/connections/social/google">Use your own keys for the Social connection</a></li>
</ol>