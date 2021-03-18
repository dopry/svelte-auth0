<script>
    import {  getContext } from 'svelte';
    import {
        AUTH0_CONTEXT_CLIENT_PROMISE,
        AUTH0_CONTEXT_LOGOUT_URL,
        logout,
    } from './auth0';

    const auth0Promise = getContext(AUTH0_CONTEXT_CLIENT_PROMISE)
    export let logout_url = getContext(AUTH0_CONTEXT_LOGOUT_URL)
</script>

<button class="btn" on:click|preventDefault='{() => logout(auth0Promise, logout_url) }'><slot></slot></button>
