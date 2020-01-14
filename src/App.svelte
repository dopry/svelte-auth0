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

<div class="container">
<Auth0Context
  domain="dev-hvw40i79.auth0.com"
  client_id="aOijZt2ug6Ovgzp0HXdF23B6zxwA6PaP"
  callback_url="process.env.AUTH0_DEFAULT_CALLBACK_URL"
  logout_url="process.env.AUTH0_DEFAULT_CALLBACK_URL"
>

  <button class="btn" on:click|preventDefault='{() => login() }'>Login</button>
  <button class="btn" on:click|preventDefault='{() => logout() }'>Logout</button>
  <table>
    <thead>
      <tr><th>store</th><th>value</th></tr>
    </thead>
    <tbody>
      <tr><td>isLoading</td><td>{$isLoading}</td></tr>
      <tr><td>isAuthenticated</td><td>{$isAuthenticated}</td></tr>
      <tr><td>authToken</td><td>{$authToken}</td></tr>
      <tr><td>userInfo</td><td><pre>{JSON.stringify($userInfo, null, 2)}<pre></td></tr>
      <tr><td>authError</td><td>{$authError}</td></tr>
    </tbody>
  </table>
</Auth0Context>

<p>If social login is not persisting across page reloads, you are most likely using Universal Login classic with Auth0
Dev keys for the social provider. There are two ways to resolve the issue:</p>
<ol>
  <li><a href="https://auth0.com/docs/universal-login/new">Switch to the New Universal Login Experience</a></li>
  <li><a href="https://auth0.com/docs/connections/social/google">Use your own keys for the Social connection</a></li>
</ol>
</div>