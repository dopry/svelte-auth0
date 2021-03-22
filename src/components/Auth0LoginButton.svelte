<script>
    import {  getContext } from 'svelte';
    import {
        AUTH0_CONTEXT_CALLBACK_URL,
        AUTH0_CONTEXT_CLIENT_PROMISE,
        login,
    } from './auth0';

    const auth0Promise = getContext(AUTH0_CONTEXT_CLIENT_PROMISE)
    export let callback_url = getContext(AUTH0_CONTEXT_CALLBACK_URL)
    export let preserveRoute

	let clazz;
	export { clazz as class };
</script>

<button class="{clazz}" on:click|preventDefault='{() => login(auth0Promise,preserveRoute, callback_url) }'><slot></slot></button>
