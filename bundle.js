var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    /**
     * Stores
     */
    const isLoading = writable(true);
    const isAuthenticated = writable(false);
    const authToken = writable('');
    const idToken = writable('');
    const userInfo = writable({});
    const authError = writable(null);

    /**
     * Context Keys
     *
     * using an object literal means the keys are guaranteed not to conflict in any circumstance (since an object only has
     * referential equality to itself, i.e. {} !== {} whereas "x" === "x"), even when you have multiple different contexts
     * operating across many component layers.
     */
    const AUTH0_CONTEXT_CLIENT_PROMISE = {};
    const AUTH0_CONTEXT_CALLBACK_URL = {};
    const AUTH0_CONTEXT_LOGOUT_URL = {};

    /**
     * Refresh the authToken store.
     * 
     * @param {Promise<Auth0Client>} - auth0Promise
     */
    async function refreshToken(auth0Promise) {
        const auth0 = await auth0Promise;
        const token = await auth0.getTokenSilently();
        authToken.set(token);
    }

    /**
     * Initiate Register/Login flow.
     *
     * @param {Promise<Auth0Client>} - auth0Promise
     * @param {boolean} preserveRoute - store current location so callback handler will navigate back to it.
     * @param {string} callback_url - explicit path to use for the callback.
     */
    async function login(auth0Promise, preserveRoute = true, callback_url) {
        console.log('login', { preserveRoute, callback_url });
        const auth0 = await auth0Promise;
        const redirect_uri =  callback_url || window.location.href;

        // try to keep the user on the same page from which they triggered login. If set to false should typically
        // cause redirect to /.
        const appState = (preserveRoute) ? { pathname: window.location.pathname, search: window.location.search } : {};
        await auth0.loginWithRedirect({ redirect_uri, appState });
    }

    /**
     * Log out the current user.
     *
     * @param {Promise<Auth0Client>} - auth0Promise
     * @param {string} logout_url - specify the url to return to after login.
     */
    async function logout(auth0Promise, logout_url) {
        console.log('logout', {logout_url});
        const auth0 = await auth0Promise;
        const returnTo = logout_url || window.location.href;
        authToken.set('');
        auth0.logout({ returnTo });
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function unwrapExports (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var auth0SpaJs_production = createCommonjsModule(function (module, exports) {
    !function(e,t){module.exports=t();}(commonjsGlobal,function(){var e=function(t,n){return (e=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t;}||function(e,t){for(var n in t)t.hasOwnProperty(n)&&(e[n]=t[n]);})(t,n)};var t=function(){return (t=Object.assign||function(e){for(var t,n=1,r=arguments.length;n<r;n++)for(var o in t=arguments[n])Object.prototype.hasOwnProperty.call(t,o)&&(e[o]=t[o]);return e}).apply(this,arguments)};function n(e,t){var n={};for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&t.indexOf(r)<0&&(n[r]=e[r]);if(null!=e&&"function"==typeof Object.getOwnPropertySymbols){var o=0;for(r=Object.getOwnPropertySymbols(e);o<r.length;o++)t.indexOf(r[o])<0&&Object.prototype.propertyIsEnumerable.call(e,r[o])&&(n[r[o]]=e[r[o]]);}return n}function r(e,t,n,r){return new(n||(n=Promise))(function(o,i){function a(e){try{u(r.next(e));}catch(e){i(e);}}function c(e){try{u(r.throw(e));}catch(e){i(e);}}function u(e){e.done?o(e.value):new n(function(t){t(e.value);}).then(a,c);}u((r=r.apply(e,t||[])).next());})}function o(e,t){var n,r,o,i,a={label:0,sent:function(){if(1&o[0])throw o[1];return o[1]},trys:[],ops:[]};return i={next:c(0),throw:c(1),return:c(2)},"function"==typeof Symbol&&(i[Symbol.iterator]=function(){return this}),i;function c(i){return function(c){return function(i){if(n)throw new TypeError("Generator is already executing.");for(;a;)try{if(n=1,r&&(o=2&i[0]?r.return:i[0]?r.throw||((o=r.return)&&o.call(r),0):r.next)&&!(o=o.call(r,i[1])).done)return o;switch(r=0,o&&(i=[2&i[0],o.value]),i[0]){case 0:case 1:o=i;break;case 4:return a.label++,{value:i[1],done:!1};case 5:a.label++,r=i[1],i=[0];continue;case 7:i=a.ops.pop(),a.trys.pop();continue;default:if(!(o=(o=a.trys).length>0&&o[o.length-1])&&(6===i[0]||2===i[0])){a=0;continue}if(3===i[0]&&(!o||i[1]>o[0]&&i[1]<o[3])){a.label=i[1];break}if(6===i[0]&&a.label<o[1]){a.label=o[1],o=i;break}if(o&&a.label<o[2]){a.label=o[2],a.ops.push(i);break}o[2]&&a.ops.pop(),a.trys.pop();continue}i=t.call(e,a);}catch(e){i=[6,e],r=0;}finally{n=o=0;}if(5&i[0])throw i[1];return {value:i[0]?i[1]:void 0,done:!0}}([i,c])}}}var i="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof window?window:"undefined"!=typeof commonjsGlobal?commonjsGlobal:"undefined"!=typeof self?self:{};function a(e){return e&&e.__esModule&&Object.prototype.hasOwnProperty.call(e,"default")?e.default:e}function c(e,t){return e(t={exports:{}},t.exports),t.exports}var u,s,f,l="object",d=function(e){return e&&e.Math==Math&&e},p=d(typeof globalThis==l&&globalThis)||d(typeof window==l&&window)||d(typeof self==l&&self)||d(typeof i==l&&i)||Function("return this")(),h=function(e){try{return !!e()}catch(e){return !0}},v=!h(function(){return 7!=Object.defineProperty({},"a",{get:function(){return 7}}).a}),y={}.propertyIsEnumerable,m=Object.getOwnPropertyDescriptor,w={f:m&&!y.call({1:2},1)?function(e){var t=m(this,e);return !!t&&t.enumerable}:y},g=function(e,t){return {enumerable:!(1&e),configurable:!(2&e),writable:!(4&e),value:t}},b={}.toString,_=function(e){return b.call(e).slice(8,-1)},k="".split,S=h(function(){return !Object("z").propertyIsEnumerable(0)})?function(e){return "String"==_(e)?k.call(e,""):Object(e)}:Object,T=function(e){if(null==e)throw TypeError("Can't call method on "+e);return e},O=function(e){return S(T(e))},E=function(e){return "object"==typeof e?null!==e:"function"==typeof e},A=function(e,t){if(!E(e))return e;var n,r;if(t&&"function"==typeof(n=e.toString)&&!E(r=n.call(e)))return r;if("function"==typeof(n=e.valueOf)&&!E(r=n.call(e)))return r;if(!t&&"function"==typeof(n=e.toString)&&!E(r=n.call(e)))return r;throw TypeError("Can't convert object to primitive value")},x={}.hasOwnProperty,I=function(e,t){return x.call(e,t)},j=p.document,P=E(j)&&E(j.createElement),C=function(e){return P?j.createElement(e):{}},U=!v&&!h(function(){return 7!=Object.defineProperty(C("div"),"a",{get:function(){return 7}}).a}),D=Object.getOwnPropertyDescriptor,L={f:v?D:function(e,t){if(e=O(e),t=A(t,!0),U)try{return D(e,t)}catch(e){}if(I(e,t))return g(!w.f.call(e,t),e[t])}},F=function(e){if(!E(e))throw TypeError(String(e)+" is not an object");return e},R=Object.defineProperty,M={f:v?R:function(e,t,n){if(F(e),t=A(t,!0),F(n),U)try{return R(e,t,n)}catch(e){}if("get"in n||"set"in n)throw TypeError("Accessors not supported");return "value"in n&&(e[t]=n.value),e}},W=v?function(e,t,n){return M.f(e,t,g(1,n))}:function(e,t,n){return e[t]=n,e},q=function(e,t){try{W(p,e,t);}catch(n){p[e]=t;}return t},N=c(function(e){var t=p["__core-js_shared__"]||q("__core-js_shared__",{});(e.exports=function(e,n){return t[e]||(t[e]=void 0!==n?n:{})})("versions",[]).push({version:"3.2.1",mode:"global",copyright:"© 2019 Denis Pushkarev (zloirock.ru)"});}),z=N("native-function-to-string",Function.toString),J=p.WeakMap,B="function"==typeof J&&/native code/.test(z.call(J)),G=0,H=Math.random(),Y=function(e){return "Symbol("+String(void 0===e?"":e)+")_"+(++G+H).toString(36)},V=N("keys"),K=function(e){return V[e]||(V[e]=Y(e))},Q={},X=p.WeakMap;if(B){var Z=new X,$=Z.get,ee=Z.has,te=Z.set;u=function(e,t){return te.call(Z,e,t),t},s=function(e){return $.call(Z,e)||{}},f=function(e){return ee.call(Z,e)};}else {var ne=K("state");Q[ne]=!0,u=function(e,t){return W(e,ne,t),t},s=function(e){return I(e,ne)?e[ne]:{}},f=function(e){return I(e,ne)};}var re={set:u,get:s,has:f,enforce:function(e){return f(e)?s(e):u(e,{})},getterFor:function(e){return function(t){var n;if(!E(t)||(n=s(t)).type!==e)throw TypeError("Incompatible receiver, "+e+" required");return n}}},oe=c(function(e){var t=re.get,n=re.enforce,r=String(z).split("toString");N("inspectSource",function(e){return z.call(e)}),(e.exports=function(e,t,o,i){var a=!!i&&!!i.unsafe,c=!!i&&!!i.enumerable,u=!!i&&!!i.noTargetGet;"function"==typeof o&&("string"!=typeof t||I(o,"name")||W(o,"name",t),n(o).source=r.join("string"==typeof t?t:"")),e!==p?(a?!u&&e[t]&&(c=!0):delete e[t],c?e[t]=o:W(e,t,o)):c?e[t]=o:q(t,o);})(Function.prototype,"toString",function(){return "function"==typeof this&&t(this).source||z.call(this)});}),ie=p,ae=function(e){return "function"==typeof e?e:void 0},ce=function(e,t){return arguments.length<2?ae(ie[e])||ae(p[e]):ie[e]&&ie[e][t]||p[e]&&p[e][t]},ue=Math.ceil,se=Math.floor,fe=function(e){return isNaN(e=+e)?0:(e>0?se:ue)(e)},le=Math.min,de=function(e){return e>0?le(fe(e),9007199254740991):0},pe=Math.max,he=Math.min,ve=function(e){return function(t,n,r){var o,i=O(t),a=de(i.length),c=function(e,t){var n=fe(e);return n<0?pe(n+t,0):he(n,t)}(r,a);if(e&&n!=n){for(;a>c;)if((o=i[c++])!=o)return !0}else for(;a>c;c++)if((e||c in i)&&i[c]===n)return e||c||0;return !e&&-1}},ye={includes:ve(!0),indexOf:ve(!1)},me=ye.indexOf,we=function(e,t){var n,r=O(e),o=0,i=[];for(n in r)!I(Q,n)&&I(r,n)&&i.push(n);for(;t.length>o;)I(r,n=t[o++])&&(~me(i,n)||i.push(n));return i},ge=["constructor","hasOwnProperty","isPrototypeOf","propertyIsEnumerable","toLocaleString","toString","valueOf"],be=ge.concat("length","prototype"),_e={f:Object.getOwnPropertyNames||function(e){return we(e,be)}},ke={f:Object.getOwnPropertySymbols},Se=ce("Reflect","ownKeys")||function(e){var t=_e.f(F(e)),n=ke.f;return n?t.concat(n(e)):t},Te=function(e,t){for(var n=Se(t),r=M.f,o=L.f,i=0;i<n.length;i++){var a=n[i];I(e,a)||r(e,a,o(t,a));}},Oe=/#|\.prototype\./,Ee=function(e,t){var n=xe[Ae(e)];return n==je||n!=Ie&&("function"==typeof t?h(t):!!t)},Ae=Ee.normalize=function(e){return String(e).replace(Oe,".").toLowerCase()},xe=Ee.data={},Ie=Ee.NATIVE="N",je=Ee.POLYFILL="P",Pe=Ee,Ce=L.f,Ue=function(e,t){var n,r,o,i,a,c=e.target,u=e.global,s=e.stat;if(n=u?p:s?p[c]||q(c,{}):(p[c]||{}).prototype)for(r in t){if(i=t[r],o=e.noTargetGet?(a=Ce(n,r))&&a.value:n[r],!Pe(u?r:c+(s?".":"#")+r,e.forced)&&void 0!==o){if(typeof i==typeof o)continue;Te(i,o);}(e.sham||o&&o.sham)&&W(i,"sham",!0),oe(n,r,i,e);}},De=!!Object.getOwnPropertySymbols&&!h(function(){return !String(Symbol())}),Le=p.Symbol,Fe=N("wks"),Re=function(e){return Fe[e]||(Fe[e]=De&&Le[e]||(De?Le:Y)("Symbol."+e))},Me=Re("match"),We=function(e){if(function(e){var t;return E(e)&&(void 0!==(t=e[Me])?!!t:"RegExp"==_(e))}(e))throw TypeError("The method doesn't accept regular expressions");return e},qe=Re("match"),Ne=function(e){var t=/./;try{"/./"[e](t);}catch(n){try{return t[qe]=!1,"/./"[e](t)}catch(e){}}return !1},ze="".startsWith,Je=Math.min;Ue({target:"String",proto:!0,forced:!Ne("startsWith")},{startsWith:function(e){var t=String(T(this));We(e);var n=de(Je(arguments.length>1?arguments[1]:void 0,t.length)),r=String(e);return ze?ze.call(t,r,n):t.slice(n,n+r.length)===r}});var Be,Ge,He,Ye=function(e){if("function"!=typeof e)throw TypeError(String(e)+" is not a function");return e},Ve=function(e,t,n){if(Ye(e),void 0===t)return e;switch(n){case 0:return function(){return e.call(t)};case 1:return function(n){return e.call(t,n)};case 2:return function(n,r){return e.call(t,n,r)};case 3:return function(n,r,o){return e.call(t,n,r,o)}}return function(){return e.apply(t,arguments)}},Ke=Function.call,Qe=function(e,t,n){return Ve(Ke,p[e].prototype[t],n)},Xe=(Qe("String","startsWith"),function(e){return function(t,n){var r,o,i=String(T(t)),a=fe(n),c=i.length;return a<0||a>=c?e?"":void 0:(r=i.charCodeAt(a))<55296||r>56319||a+1===c||(o=i.charCodeAt(a+1))<56320||o>57343?e?i.charAt(a):r:e?i.slice(a,a+2):o-56320+(r-55296<<10)+65536}}),Ze={codeAt:Xe(!1),charAt:Xe(!0)},$e=function(e){return Object(T(e))},et=!h(function(){function e(){}return e.prototype.constructor=null,Object.getPrototypeOf(new e)!==e.prototype}),tt=K("IE_PROTO"),nt=Object.prototype,rt=et?Object.getPrototypeOf:function(e){return e=$e(e),I(e,tt)?e[tt]:"function"==typeof e.constructor&&e instanceof e.constructor?e.constructor.prototype:e instanceof Object?nt:null},ot=Re("iterator"),it=!1;[].keys&&("next"in(He=[].keys())?(Ge=rt(rt(He)))!==Object.prototype&&(Be=Ge):it=!0),null==Be&&(Be={}),I(Be,ot)||W(Be,ot,function(){return this});var at={IteratorPrototype:Be,BUGGY_SAFARI_ITERATORS:it},ct=Object.keys||function(e){return we(e,ge)},ut=v?Object.defineProperties:function(e,t){F(e);for(var n,r=ct(t),o=r.length,i=0;o>i;)M.f(e,n=r[i++],t[n]);return e},st=ce("document","documentElement"),ft=K("IE_PROTO"),lt=function(){},dt=function(){var e,t=C("iframe"),n=ge.length;for(t.style.display="none",st.appendChild(t),t.src=String("javascript:"),(e=t.contentWindow.document).open(),e.write("<script>document.F=Object<\/script>"),e.close(),dt=e.F;n--;)delete dt.prototype[ge[n]];return dt()},pt=Object.create||function(e,t){var n;return null!==e?(lt.prototype=F(e),n=new lt,lt.prototype=null,n[ft]=e):n=dt(),void 0===t?n:ut(n,t)};Q[ft]=!0;var ht=M.f,vt=Re("toStringTag"),yt=function(e,t,n){e&&!I(e=n?e:e.prototype,vt)&&ht(e,vt,{configurable:!0,value:t});},mt={},wt=at.IteratorPrototype,gt=function(){return this},bt=Object.setPrototypeOf||("__proto__"in{}?function(){var e,t=!1,n={};try{(e=Object.getOwnPropertyDescriptor(Object.prototype,"__proto__").set).call(n,[]),t=n instanceof Array;}catch(e){}return function(n,r){return F(n),function(e){if(!E(e)&&null!==e)throw TypeError("Can't set "+String(e)+" as a prototype")}(r),t?e.call(n,r):n.__proto__=r,n}}():void 0),_t=at.IteratorPrototype,kt=at.BUGGY_SAFARI_ITERATORS,St=Re("iterator"),Tt=function(){return this},Ot=Ze.charAt,Et=re.set,At=re.getterFor("String Iterator");!function(e,t,n,r,o,i,a){!function(e,t,n){var r=t+" Iterator";e.prototype=pt(wt,{next:g(1,n)}),yt(e,r,!1),mt[r]=gt;}(n,t,r);var c,u,s,f=function(e){if(e===o&&v)return v;if(!kt&&e in p)return p[e];switch(e){case"keys":case"values":case"entries":return function(){return new n(this,e)}}return function(){return new n(this)}},l=t+" Iterator",d=!1,p=e.prototype,h=p[St]||p["@@iterator"]||o&&p[o],v=!kt&&h||f(o),y="Array"==t&&p.entries||h;if(y&&(c=rt(y.call(new e)),_t!==Object.prototype&&c.next&&(rt(c)!==_t&&(bt?bt(c,_t):"function"!=typeof c[St]&&W(c,St,Tt)),yt(c,l,!0))),"values"==o&&h&&"values"!==h.name&&(d=!0,v=function(){return h.call(this)}),p[St]!==v&&W(p,St,v),mt[t]=v,o)if(u={values:f("values"),keys:i?v:f("keys"),entries:f("entries")},a)for(s in u)!kt&&!d&&s in p||oe(p,s,u[s]);else Ue({target:t,proto:!0,forced:kt||d},u);}(String,"String",function(e){Et(this,{type:"String Iterator",string:String(e),index:0});},function(){var e,t=At(this),n=t.string,r=t.index;return r>=n.length?{value:void 0,done:!0}:(e=Ot(n,r),t.index+=e.length,{value:e,done:!1})});var xt=function(e,t,n,r){try{return r?t(F(n)[0],n[1]):t(n)}catch(t){var o=e.return;throw void 0!==o&&F(o.call(e)),t}},It=Re("iterator"),jt=Array.prototype,Pt=function(e){return void 0!==e&&(mt.Array===e||jt[It]===e)},Ct=function(e,t,n){var r=A(t);r in e?M.f(e,r,g(0,n)):e[r]=n;},Ut=Re("toStringTag"),Dt="Arguments"==_(function(){return arguments}()),Lt=function(e){var t,n,r;return void 0===e?"Undefined":null===e?"Null":"string"==typeof(n=function(e,t){try{return e[t]}catch(e){}}(t=Object(e),Ut))?n:Dt?_(t):"Object"==(r=_(t))&&"function"==typeof t.callee?"Arguments":r},Ft=Re("iterator"),Rt=function(e){if(null!=e)return e[Ft]||e["@@iterator"]||mt[Lt(e)]},Mt=Re("iterator"),Wt=!1;try{var qt=0,Nt={next:function(){return {done:!!qt++}},return:function(){Wt=!0;}};Nt[Mt]=function(){return this},Array.from(Nt,function(){throw 2});}catch(e){}var zt=!function(e,t){if(!t&&!Wt)return !1;var n=!1;try{var r={};r[Mt]=function(){return {next:function(){return {done:n=!0}}}},e(r);}catch(e){}return n}(function(e){Array.from(e);});Ue({target:"Array",stat:!0,forced:zt},{from:function(e){var t,n,r,o,i=$e(e),a="function"==typeof this?this:Array,c=arguments.length,u=c>1?arguments[1]:void 0,s=void 0!==u,f=0,l=Rt(i);if(s&&(u=Ve(u,c>2?arguments[2]:void 0,2)),null==l||a==Array&&Pt(l))for(n=new a(t=de(i.length));t>f;f++)Ct(n,f,s?u(i[f],f):i[f]);else for(o=l.call(i),n=new a;!(r=o.next()).done;f++)Ct(n,f,s?xt(o,u,[r.value,f],!0):r.value);return n.length=f,n}});ie.Array.from;var Jt,Bt=M.f,Gt=p.DataView,Ht=Gt&&Gt.prototype,Yt=p.Int8Array,Vt=Yt&&Yt.prototype,Kt=p.Uint8ClampedArray,Qt=Kt&&Kt.prototype,Xt=Yt&&rt(Yt),Zt=Vt&&rt(Vt),$t=Object.prototype,en=$t.isPrototypeOf,tn=Re("toStringTag"),nn=Y("TYPED_ARRAY_TAG"),rn=!(!p.ArrayBuffer||!Gt),on=rn&&!!bt&&"Opera"!==Lt(p.opera),an={Int8Array:1,Uint8Array:1,Uint8ClampedArray:1,Int16Array:2,Uint16Array:2,Int32Array:4,Uint32Array:4,Float32Array:4,Float64Array:8},cn=function(e){return E(e)&&I(an,Lt(e))};for(Jt in an)p[Jt]||(on=!1);if((!on||"function"!=typeof Xt||Xt===Function.prototype)&&(Xt=function(){throw TypeError("Incorrect invocation")},on))for(Jt in an)p[Jt]&&bt(p[Jt],Xt);if((!on||!Zt||Zt===$t)&&(Zt=Xt.prototype,on))for(Jt in an)p[Jt]&&bt(p[Jt].prototype,Zt);if(on&&rt(Qt)!==Zt&&bt(Qt,Zt),v&&!I(Zt,tn))for(Jt in Bt(Zt,tn,{get:function(){return E(this)?this[nn]:void 0}}),an)p[Jt]&&W(p[Jt],nn,Jt);rn&&bt&&rt(Ht)!==$t&&bt(Ht,$t);var un=function(e){if(cn(e))return e;throw TypeError("Target is not a typed array")},sn=function(e){if(bt){if(en.call(Xt,e))return e}else for(var t in an)if(I(an,Jt)){var n=p[t];if(n&&(e===n||en.call(n,e)))return e}throw TypeError("Target is not a typed array constructor")},fn=function(e,t,n){if(v){if(n)for(var r in an){var o=p[r];o&&I(o.prototype,e)&&delete o.prototype[e];}Zt[e]&&!n||oe(Zt,e,n?t:on&&Vt[e]||t);}},ln=Re("species"),dn=un,pn=sn,hn=[].slice;fn("slice",function(e,t){for(var n=hn.call(dn(this),e,t),r=function(e,t){var n,r=F(e).constructor;return void 0===r||null==(n=F(r)[ln])?t:Ye(n)}(this,this.constructor),o=0,i=n.length,a=new(pn(r))(i);i>o;)a[o]=n[o++];return a},h(function(){new Int8Array(1).slice();}));var vn=Re("unscopables"),yn=Array.prototype;null==yn[vn]&&W(yn,vn,pt(null));var mn,wn=ye.includes;Ue({target:"Array",proto:!0},{includes:function(e){return wn(this,e,arguments.length>1?arguments[1]:void 0)}}),mn="includes",yn[vn][mn]=!0;Qe("Array","includes");Ue({target:"String",proto:!0,forced:!Ne("includes")},{includes:function(e){return !!~String(T(this)).indexOf(We(e),arguments.length>1?arguments[1]:void 0)}});Qe("String","includes");function gn(e){var t=this.constructor;return this.then(function(n){return t.resolve(e()).then(function(){return n})},function(n){return t.resolve(e()).then(function(){return t.reject(n)})})}var bn=setTimeout;function _n(e){return Boolean(e&&void 0!==e.length)}function kn(){}function Sn(e){if(!(this instanceof Sn))throw new TypeError("Promises must be constructed via new");if("function"!=typeof e)throw new TypeError("not a function");this._state=0,this._handled=!1,this._value=void 0,this._deferreds=[],In(e,this);}function Tn(e,t){for(;3===e._state;)e=e._value;0!==e._state?(e._handled=!0,Sn._immediateFn(function(){var n=1===e._state?t.onFulfilled:t.onRejected;if(null!==n){var r;try{r=n(e._value);}catch(e){return void En(t.promise,e)}On(t.promise,r);}else (1===e._state?On:En)(t.promise,e._value);})):e._deferreds.push(t);}function On(e,t){try{if(t===e)throw new TypeError("A promise cannot be resolved with itself.");if(t&&("object"==typeof t||"function"==typeof t)){var n=t.then;if(t instanceof Sn)return e._state=3,e._value=t,void An(e);if("function"==typeof n)return void In((r=n,o=t,function(){r.apply(o,arguments);}),e)}e._state=1,e._value=t,An(e);}catch(t){En(e,t);}var r,o;}function En(e,t){e._state=2,e._value=t,An(e);}function An(e){2===e._state&&0===e._deferreds.length&&Sn._immediateFn(function(){e._handled||Sn._unhandledRejectionFn(e._value);});for(var t=0,n=e._deferreds.length;t<n;t++)Tn(e,e._deferreds[t]);e._deferreds=null;}function xn(e,t,n){this.onFulfilled="function"==typeof e?e:null,this.onRejected="function"==typeof t?t:null,this.promise=n;}function In(e,t){var n=!1;try{e(function(e){n||(n=!0,On(t,e));},function(e){n||(n=!0,En(t,e));});}catch(e){if(n)return;n=!0,En(t,e);}}Sn.prototype.catch=function(e){return this.then(null,e)},Sn.prototype.then=function(e,t){var n=new this.constructor(kn);return Tn(this,new xn(e,t,n)),n},Sn.prototype.finally=gn,Sn.all=function(e){return new Sn(function(t,n){if(!_n(e))return n(new TypeError("Promise.all accepts an array"));var r=Array.prototype.slice.call(e);if(0===r.length)return t([]);var o=r.length;function i(e,a){try{if(a&&("object"==typeof a||"function"==typeof a)){var c=a.then;if("function"==typeof c)return void c.call(a,function(t){i(e,t);},n)}r[e]=a,0==--o&&t(r);}catch(e){n(e);}}for(var a=0;a<r.length;a++)i(a,r[a]);})},Sn.resolve=function(e){return e&&"object"==typeof e&&e.constructor===Sn?e:new Sn(function(t){t(e);})},Sn.reject=function(e){return new Sn(function(t,n){n(e);})},Sn.race=function(e){return new Sn(function(t,n){if(!_n(e))return n(new TypeError("Promise.race accepts an array"));for(var r=0,o=e.length;r<o;r++)Sn.resolve(e[r]).then(t,n);})},Sn._immediateFn="function"==typeof setImmediate&&function(e){setImmediate(e);}||function(e){bn(e,0);},Sn._unhandledRejectionFn=function(e){"undefined"!=typeof console&&console&&console.warn("Possible Unhandled Promise Rejection:",e);};var jn=function(){if("undefined"!=typeof self)return self;if("undefined"!=typeof window)return window;if("undefined"!=typeof commonjsGlobal)return commonjsGlobal;throw new Error("unable to locate global object")}();"Promise"in jn?jn.Promise.prototype.finally||(jn.Promise.prototype.finally=gn):jn.Promise=Sn,function(e){function t(e){if("utf-8"!==(e=void 0===e?"utf-8":e))throw new RangeError("Failed to construct 'TextEncoder': The encoding label provided ('"+e+"') is invalid.")}function n(e,t){if(t=void 0===t?{fatal:!1}:t,"utf-8"!==(e=void 0===e?"utf-8":e))throw new RangeError("Failed to construct 'TextDecoder': The encoding label provided ('"+e+"') is invalid.");if(t.fatal)throw Error("Failed to construct 'TextDecoder': the 'fatal' option is unsupported.")}if(e.TextEncoder&&e.TextDecoder)return !1;Object.defineProperty(t.prototype,"encoding",{value:"utf-8"}),t.prototype.encode=function(e,t){if((t=void 0===t?{stream:!1}:t).stream)throw Error("Failed to encode: the 'stream' option is unsupported.");t=0;for(var n=e.length,r=0,o=Math.max(32,n+(n>>1)+7),i=new Uint8Array(o>>3<<3);t<n;){var a=e.charCodeAt(t++);if(55296<=a&&56319>=a){if(t<n){var c=e.charCodeAt(t);56320==(64512&c)&&(++t,a=((1023&a)<<10)+(1023&c)+65536);}if(55296<=a&&56319>=a)continue}if(r+4>i.length&&(o+=8,o=(o*=1+t/e.length*2)>>3<<3,(c=new Uint8Array(o)).set(i),i=c),0==(4294967168&a))i[r++]=a;else {if(0==(4294965248&a))i[r++]=a>>6&31|192;else if(0==(4294901760&a))i[r++]=a>>12&15|224,i[r++]=a>>6&63|128;else {if(0!=(4292870144&a))continue;i[r++]=a>>18&7|240,i[r++]=a>>12&63|128,i[r++]=a>>6&63|128;}i[r++]=63&a|128;}}return i.slice(0,r)},Object.defineProperty(n.prototype,"encoding",{value:"utf-8"}),Object.defineProperty(n.prototype,"fatal",{value:!1}),Object.defineProperty(n.prototype,"ignoreBOM",{value:!1}),n.prototype.decode=function(e,t){if((t=void 0===t?{stream:!1}:t).stream)throw Error("Failed to decode: the 'stream' option is unsupported.");t=0;for(var n=(e=new Uint8Array(e)).length,r=[];t<n;){var o=e[t++];if(0===o)break;if(0==(128&o))r.push(o);else if(192==(224&o)){var i=63&e[t++];r.push((31&o)<<6|i);}else if(224==(240&o)){i=63&e[t++];var a=63&e[t++];r.push((31&o)<<12|i<<6|a);}else if(240==(248&o)){65535<(o=(7&o)<<18|(i=63&e[t++])<<12|(a=63&e[t++])<<6|63&e[t++])&&(o-=65536,r.push(o>>>10&1023|55296),o=56320|1023&o),r.push(o);}}return String.fromCharCode.apply(null,r)},e.TextEncoder=t,e.TextDecoder=n;}("undefined"!=typeof window?window:i);var Pn=c(function(e,t){Object.defineProperty(t,"__esModule",{value:!0});var n=function(){function e(){var e=this;this.locked=new Map,this.addToLocked=function(t,n){var r=e.locked.get(t);void 0===r?void 0===n?e.locked.set(t,[]):e.locked.set(t,[n]):void 0!==n&&(r.unshift(n),e.locked.set(t,r));},this.isLocked=function(t){return e.locked.has(t)},this.lock=function(t){return new Promise(function(n,r){e.isLocked(t)?e.addToLocked(t,n):(e.addToLocked(t),n());})},this.unlock=function(t){var n=e.locked.get(t);if(void 0!==n&&0!==n.length){var r=n.pop();e.locked.set(t,n),void 0!==r&&setTimeout(r,0);}else e.locked.delete(t);};}return e.getInstance=function(){return void 0===e.instance&&(e.instance=new e),e.instance},e}();t.default=function(){return n.getInstance()};});a(Pn);var Cn=a(c(function(e,t){var n=i&&i.__awaiter||function(e,t,n,r){return new(n||(n=Promise))(function(o,i){function a(e){try{u(r.next(e));}catch(e){i(e);}}function c(e){try{u(r.throw(e));}catch(e){i(e);}}function u(e){e.done?o(e.value):new n(function(t){t(e.value);}).then(a,c);}u((r=r.apply(e,t||[])).next());})},r=i&&i.__generator||function(e,t){var n,r,o,i,a={label:0,sent:function(){if(1&o[0])throw o[1];return o[1]},trys:[],ops:[]};return i={next:c(0),throw:c(1),return:c(2)},"function"==typeof Symbol&&(i[Symbol.iterator]=function(){return this}),i;function c(i){return function(c){return function(i){if(n)throw new TypeError("Generator is already executing.");for(;a;)try{if(n=1,r&&(o=2&i[0]?r.return:i[0]?r.throw||((o=r.return)&&o.call(r),0):r.next)&&!(o=o.call(r,i[1])).done)return o;switch(r=0,o&&(i=[2&i[0],o.value]),i[0]){case 0:case 1:o=i;break;case 4:return a.label++,{value:i[1],done:!1};case 5:a.label++,r=i[1],i=[0];continue;case 7:i=a.ops.pop(),a.trys.pop();continue;default:if(!(o=(o=a.trys).length>0&&o[o.length-1])&&(6===i[0]||2===i[0])){a=0;continue}if(3===i[0]&&(!o||i[1]>o[0]&&i[1]<o[3])){a.label=i[1];break}if(6===i[0]&&a.label<o[1]){a.label=o[1],o=i;break}if(o&&a.label<o[2]){a.label=o[2],a.ops.push(i);break}o[2]&&a.ops.pop(),a.trys.pop();continue}i=t.call(e,a);}catch(e){i=[6,e],r=0;}finally{n=o=0;}if(5&i[0])throw i[1];return {value:i[0]?i[1]:void 0,done:!0}}([i,c])}}};Object.defineProperty(t,"__esModule",{value:!0});var o="browser-tabs-lock-key";function a(e){return new Promise(function(t){return setTimeout(t,e)})}function c(e){for(var t="0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz",n="",r=0;r<e;r++){n+=t[Math.floor(Math.random()*t.length)];}return n}var u=function(){function e(){this.acquiredIatSet=new Set,this.id=Date.now().toString()+c(15),this.acquireLock=this.acquireLock.bind(this),this.releaseLock=this.releaseLock.bind(this),this.releaseLock__private__=this.releaseLock__private__.bind(this),this.waitForSomethingToChange=this.waitForSomethingToChange.bind(this),this.refreshLockWhileAcquired=this.refreshLockWhileAcquired.bind(this),void 0===e.waiters&&(e.waiters=[]);}return e.prototype.acquireLock=function(e,t){return void 0===t&&(t=5e3),n(this,void 0,void 0,function(){var n,i,u,f,l,d;return r(this,function(r){switch(r.label){case 0:n=Date.now()+c(4),i=Date.now()+t,u=o+"-"+e,f=window.localStorage,r.label=1;case 1:return Date.now()<i?null!==f.getItem(u)?[3,4]:(l=this.id+"-"+e+"-"+n,[4,a(Math.floor(25*Math.random()))]):[3,7];case 2:return r.sent(),f.setItem(u,JSON.stringify({id:this.id,iat:n,timeoutKey:l,timeAcquired:Date.now(),timeRefreshed:Date.now()})),[4,a(30)];case 3:return r.sent(),null!==(d=f.getItem(u))&&(d=JSON.parse(d)).id===this.id&&d.iat===n?(this.acquiredIatSet.add(n),this.refreshLockWhileAcquired(u,n),[2,!0]):[3,6];case 4:return s(),[4,this.waitForSomethingToChange(i)];case 5:r.sent(),r.label=6;case 6:return n=Date.now()+c(4),[3,1];case 7:return [2,!1]}})})},e.prototype.refreshLockWhileAcquired=function(e,t){return n(this,void 0,void 0,function(){var o=this;return r(this,function(i){return setTimeout(function(){return n(o,void 0,void 0,function(){var n,o;return r(this,function(r){switch(r.label){case 0:return [4,Pn.default().lock(t)];case 1:return r.sent(),this.acquiredIatSet.has(t)?(n=window.localStorage,null===(o=n.getItem(e))?(Pn.default().unlock(t),[2]):((o=JSON.parse(o)).timeRefreshed=Date.now(),n.setItem(e,JSON.stringify(o)),Pn.default().unlock(t),this.refreshLockWhileAcquired(e,t),[2])):(Pn.default().unlock(t),[2])}})})},1e3),[2]})})},e.prototype.waitForSomethingToChange=function(t){return n(this,void 0,void 0,function(){return r(this,function(n){switch(n.label){case 0:return [4,new Promise(function(n){var r=!1,o=Date.now(),i=50,a=!1;function c(){if(a||(window.removeEventListener("storage",c),e.removeFromWaiting(c),clearTimeout(u),a=!0),!r){r=!0;var t=i-(Date.now()-o);t>0?setTimeout(n,t):n();}}window.addEventListener("storage",c),e.addToWaiting(c);var u=setTimeout(c,Math.max(0,t-Date.now()));})];case 1:return n.sent(),[2]}})})},e.addToWaiting=function(t){this.removeFromWaiting(t),void 0!==e.waiters&&e.waiters.push(t);},e.removeFromWaiting=function(t){void 0!==e.waiters&&(e.waiters=e.waiters.filter(function(e){return e!==t}));},e.notifyWaiters=function(){void 0!==e.waiters&&e.waiters.slice().forEach(function(e){return e()});},e.prototype.releaseLock=function(e){return n(this,void 0,void 0,function(){return r(this,function(t){switch(t.label){case 0:return [4,this.releaseLock__private__(e)];case 1:return [2,t.sent()]}})})},e.prototype.releaseLock__private__=function(t){return n(this,void 0,void 0,function(){var n,i,a;return r(this,function(r){switch(r.label){case 0:return n=window.localStorage,i=o+"-"+t,null===(a=n.getItem(i))?[2]:(a=JSON.parse(a)).id!==this.id?[3,2]:[4,Pn.default().lock(a.iat)];case 1:r.sent(),this.acquiredIatSet.delete(a.iat),n.removeItem(i),Pn.default().unlock(a.iat),e.notifyWaiters(),r.label=2;case 2:return [2]}})})},e.waiters=void 0,e}();function s(){for(var e=Date.now()-5e3,t=window.localStorage,n=Object.keys(t),r=!1,i=0;i<n.length;i++){var a=n[i];if(a.includes(o)){var c=t.getItem(a);null!==c&&(void 0===(c=JSON.parse(c)).timeRefreshed&&c.timeAcquired<e||void 0!==c.timeRefreshed&&c.timeRefreshed<e)&&(t.removeItem(a),r=!0);}}r&&u.notifyWaiters();}t.default=u;}));function Un(e,t){return t=t||{},new Promise(function(n,r){var o=new XMLHttpRequest,i=[],a=[],c={},u=function(){return {ok:2==(o.status/100|0),statusText:o.statusText,status:o.status,url:o.responseURL,text:function(){return Promise.resolve(o.responseText)},json:function(){return Promise.resolve(JSON.parse(o.responseText))},blob:function(){return Promise.resolve(new Blob([o.response]))},clone:u,headers:{keys:function(){return i},entries:function(){return a},get:function(e){return c[e.toLowerCase()]},has:function(e){return e.toLowerCase()in c}}}};for(var s in o.open(t.method||"get",e,!0),o.onload=function(){o.getAllResponseHeaders().replace(/^(.*?):[^\S\n]*([\s\S]*?)$/gm,function(e,t,n){i.push(t=t.toLowerCase()),a.push([t,n]),c[t]=c[t]?c[t]+","+n:n;}),n(u());},o.onerror=r,o.withCredentials="include"==t.credentials,t.headers)o.setRequestHeader(s,t.headers[s]);o.send(t.body||null);})}var Dn={timeoutInSeconds:60},Ln=function(e){return e.filter(function(t,n){return e.indexOf(t)===n})},Fn={error:"timeout",error_description:"Timeout"},Rn=function(){for(var e=[],t=0;t<arguments.length;t++)e[t]=arguments[t];var n=e.filter(Boolean).join();return Ln(n.replace(/\s/g,",").split(",")).join(" ").trim()},Mn=function(){var e=window.open("","auth0:authorize:popup","left=100,top=100,width=400,height=600,resizable,scrollbars=yes,status=1");if(!e)throw new Error("Could not open popup");return e},Wn=function(e,n,r){return e.location.href=n,new Promise(function(n,o){var i=setTimeout(function(){o(t(t({},Fn),{popup:e}));},1e3*(r.timeoutInSeconds||60));window.addEventListener("message",function(t){if(t.data&&"authorization_response"===t.data.type){if(clearTimeout(i),e.close(),t.data.response.error)return o(t.data.response);n(t.data.response);}});})},qn=function(){var e="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_~.",t="";return Array.from(Vn().getRandomValues(new Uint8Array(43))).forEach(function(n){return t+=e[n%e.length]}),t},Nn=function(e){return btoa(e)},zn=function(e){return Object.keys(e).filter(function(t){return void 0!==e[t]}).map(function(t){return encodeURIComponent(t)+"="+encodeURIComponent(e[t])}).join("&")},Jn=function(e){return r(void 0,void 0,void 0,function(){var t;return o(this,function(n){switch(n.label){case 0:return t=Kn().digest({name:"SHA-256"},(new TextEncoder).encode(e)),window.msCrypto?[2,new Promise(function(e,n){t.oncomplete=function(t){e(t.target.result);},t.onerror=function(e){n(e.error);},t.onabort=function(){n("The digest operation was aborted");};})]:[4,t];case 1:return [2,n.sent()]}})})},Bn=function(e){return function(e){return decodeURIComponent(atob(e).split("").map(function(e){return "%"+("00"+e.charCodeAt(0).toString(16)).slice(-2)}).join(""))}(e.replace(/_/g,"/").replace(/-/g,"+"))},Gn=function(e){var t=new Uint8Array(e);return function(e){var t={"+":"-","/":"_","=":""};return e.replace(/[\+\/=]/g,function(e){return t[e]})}(window.btoa(String.fromCharCode.apply(String,Array.from(t))))},Hn=function(e,t){return r(void 0,void 0,void 0,function(){var r,i,a,c,u,s,f;return o(this,function(o){switch(o.label){case 0:return [4,Un(e,t)];case 1:return [4,(r=o.sent()).json()];case 2:if(i=o.sent(),a=i.error,c=i.error_description,u=n(i,["error","error_description"]),!r.ok)throw s=c||"HTTP error. Unable to fetch "+e,(f=new Error(s)).error=a||"request_error",f.error_description=s,f;return [2,u]}})})},Yn=function(e){return r(void 0,void 0,void 0,function(){var r=e.baseUrl,i=n(e,["baseUrl"]);return o(this,function(e){switch(e.label){case 0:return [4,Hn(r+"/oauth/token",{method:"POST",body:JSON.stringify(t({grant_type:"authorization_code",redirect_uri:window.location.origin},i)),headers:{"Content-type":"application/json"}})];case 1:return [2,e.sent()]}})})},Vn=function(){return window.crypto||window.msCrypto},Kn=function(){var e=Vn();return e.subtle||e.webkitSubtle},Qn=function(){if(!Vn())throw new Error("For security reasons, `window.crypto` is required to run `auth0-spa-js`.");if(void 0===Kn())throw new Error("\n      auth0-spa-js must run on a secure origin.\n      See https://github.com/auth0/auth0-spa-js/blob/master/FAQ.md#why-do-i-get-auth0-spa-js-must-run-on-a-secure-origin \n      for more information.\n    ")},Xn=function(e){return e.audience+"::"+e.scope},Zn=function(){function e(){this.cache={};}return e.prototype.save=function(e){var t=this,n=Xn(e);this.cache[n]=e;var r,o,i,a=(r=e.expires_in,o=e.decodedToken.claims.exp,i=(new Date(1e3*o).getTime()-(new Date).getTime())/1e3,1e3*Math.min(r,i)*.8);setTimeout(function(){delete t.cache[n];},a);},e.prototype.get=function(e){return this.cache[Xn(e)]},e}(),$n=c(function(e,t){var n=i&&i.__assign||Object.assign||function(e){for(var t,n=1,r=arguments.length;n<r;n++)for(var o in t=arguments[n])Object.prototype.hasOwnProperty.call(t,o)&&(e[o]=t[o]);return e};function r(e,t){if(!t)return "";var n="; "+e;return !0===t?n:n+"="+t}function o(e,t,n){return encodeURIComponent(e).replace(/%(23|24|26|2B|5E|60|7C)/g,decodeURIComponent).replace(/\(/g,"%28").replace(/\)/g,"%29")+"="+encodeURIComponent(t).replace(/%(23|24|26|2B|3A|3C|3E|3D|2F|3F|40|5B|5D|5E|60|7B|7D|7C)/g,decodeURIComponent)+function(e){if("number"==typeof e.expires){var t=new Date;t.setMilliseconds(t.getMilliseconds()+864e5*e.expires),e.expires=t;}return r("Expires",e.expires?e.expires.toUTCString():"")+r("Domain",e.domain)+r("Path",e.path)+r("Secure",e.secure)+r("SameSite",e.sameSite)}(n)}function a(e){for(var t={},n=e?e.split("; "):[],r=/(%[0-9A-Z]{2})+/g,o=0;o<n.length;o++){var i=n[o].split("="),a=i.slice(1).join("=");'"'===a.charAt(0)&&(a=a.slice(1,-1));try{t[i[0].replace(r,decodeURIComponent)]=a.replace(r,decodeURIComponent);}catch(e){}}return t}function c(){return a(document.cookie)}function u(e,t,r){document.cookie=o(e,t,n({path:"/"},r));}t.__esModule=!0,t.encode=o,t.parse=a,t.getAll=c,t.get=function(e){return c()[e]},t.set=u,t.remove=function(e,t){u(e,"",n({},t,{expires:-1}));};});a($n);$n.encode,$n.parse;var er=$n.getAll,tr=$n.get,nr=$n.set,rr=$n.remove,or=function(){return Object.keys(er()||{})},ir=function(e){var t=tr(e);if(void 0!==t)return JSON.parse(t)},ar=function(e,t,n){nr(e,JSON.stringify(t),{expires:n.daysUntilExpire});},cr=function(e){rr(e);},ur="a0.spajs.txs.",sr=function(e){return ""+ur+e},fr=function(){function e(){var e=this;this.transactions={},or().filter(function(e){return e.startsWith(ur)}).forEach(function(t){var n=t.replace(ur,"");e.transactions[n]=ir(t);});}return e.prototype.create=function(e,t){this.transactions[e]=t,ar(sr(e),t,{daysUntilExpire:1});},e.prototype.get=function(e){return this.transactions[e]},e.prototype.remove=function(e){delete this.transactions[e],cr(sr(e));},e}(),lr=function(e){return "number"==typeof e},dr=["iss","aud","exp","nbf","iat","jti","azp","nonce","auth_time","at_hash","c_hash","acr","amr","sub_jwk","cnf","sip_from_tag","sip_date","sip_callid","sip_cseq_num","sip_via_branch","orig","dest","mky","events","toe","txn","rph","sid","vot","vtm"],pr=function(e){if(!e.id_token)throw new Error("ID token is required but missing");var t=function(e){var t=e.split("."),n=t[0],r=t[1],o=t[2];if(3!==t.length||!n||!r||!o)throw new Error("ID token could not be decoded");var i=JSON.parse(Bn(r)),a={__raw:e},c={};return Object.keys(i).forEach(function(e){a[e]=i[e],dr.includes(e)||(c[e]=i[e]);}),{encoded:{header:n,payload:r,signature:o},header:JSON.parse(Bn(n)),claims:a,user:c}}(e.id_token);if(!t.claims.iss)throw new Error("Issuer (iss) claim must be a string present in the ID token");if(t.claims.iss!==e.iss)throw new Error('Issuer (iss) claim mismatch in the ID token; expected "'+e.iss+'", found "'+t.claims.iss+'"');if(!t.user.sub)throw new Error("Subject (sub) claim must be a string present in the ID token");if("RS256"!==t.header.alg)throw new Error('Signature algorithm of "'+t.header.alg+'" is not supported. Expected the ID token to be signed with "RS256".');if(!t.claims.aud||"string"!=typeof t.claims.aud&&!Array.isArray(t.claims.aud))throw new Error("Audience (aud) claim must be a string or array of strings present in the ID token");if(Array.isArray(t.claims.aud)){if(!t.claims.aud.includes(e.aud))throw new Error('Audience (aud) claim mismatch in the ID token; expected "'+e.aud+'" but was not one of "'+t.claims.aud.join(", ")+'"');if(t.claims.aud.length>1){if(!t.claims.azp)throw new Error("Authorized Party (azp) claim must be a string present in the ID token when Audience (aud) claim has multiple values");if(t.claims.azp!==e.aud)throw new Error('Authorized Party (azp) claim mismatch in the ID token; expected "'+e.aud+'", found "'+t.claims.azp+'"')}}else if(t.claims.aud!==e.aud)throw new Error('Audience (aud) claim mismatch in the ID token; expected "'+e.aud+'" but found "'+t.claims.aud+'"');if(e.nonce){if(!t.claims.nonce)throw new Error("Nonce (nonce) claim must be a string present in the ID token");if(t.claims.nonce!==e.nonce)throw new Error('Nonce (nonce) claim mismatch in the ID token; expected "'+e.nonce+'", found "'+t.claims.nonce+'"')}if(e.max_age&&!lr(t.claims.auth_time))throw new Error("Authentication Time (auth_time) claim must be a number present in the ID token when Max Age (max_age) is specified");if(!lr(t.claims.exp))throw new Error("Expiration Time (exp) claim must be a number present in the ID token");if(!lr(t.claims.iat))throw new Error("Issued At (iat) claim must be a number present in the ID token");var n=e.leeway||60,r=new Date,o=new Date(0),i=new Date(0),a=new Date(0);if(a.setUTCSeconds((parseInt(t.claims.auth_time)+e.max_age)/1e3+n),o.setUTCSeconds(t.claims.exp+n),i.setUTCSeconds(t.claims.nbf-n),r>o)throw new Error("Expiration Time (exp) claim error in the ID token; current time ("+r+") is after expiration time ("+o+")");if(lr(t.claims.nbf)&&r<i)throw new Error("Not Before time (nbf) claim in the ID token indicates that this token can't be used just yet. Currrent time ("+r+") is before "+i);if(lr(t.claims.auth_time)&&r>a)throw new Error("Authentication Time (auth_time) claim in the ID token indicates that too much time has passed since the last end-user authentication. Currrent time ("+r+") is after last auth at "+a);return t},hr=function(t){function n(e,r,o){var i=t.call(this,r)||this;return i.error=e,i.error_description=r,i.state=o,Object.setPrototypeOf(i,n.prototype),i}return function(t,n){function r(){this.constructor=t;}e(t,n),t.prototype=null===n?Object.create(n):(r.prototype=n.prototype,new r);}(n,t),n}(Error),vr=new Cn,yr=function(){function e(e){this.options=e,this.DEFAULT_SCOPE="openid profile email",this.cache=new Zn,this.transactionManager=new fr,this.domainUrl="https://"+this.options.domain,this.tokenIssuer=this.options.issuer?"https://"+this.options.issuer+"/":this.domainUrl+"/";}return e.prototype._url=function(e){var t=encodeURIComponent(btoa(JSON.stringify({name:"auth0-spa-js",version:"1.6.2"})));return ""+this.domainUrl+e+"&auth0Client="+t},e.prototype._getParams=function(e,r,o,i,a){var c=this.options,u=(c.domain,c.leeway,n(c,["domain","leeway"]));return t(t(t({},u),e),{scope:Rn(this.DEFAULT_SCOPE,this.options.scope,e.scope),response_type:"code",response_mode:"query",state:r,nonce:o,redirect_uri:a||this.options.redirect_uri,code_challenge:i,code_challenge_method:"S256"})},e.prototype._authorizeUrl=function(e){return this._url("/authorize?"+zn(e))},e.prototype._verifyIdToken=function(e,t){return pr({iss:this.tokenIssuer,aud:this.options.client_id,id_token:e,nonce:t,leeway:this.options.leeway,max_age:this._parseNumber(this.options.max_age)})},e.prototype._parseNumber=function(e){return "string"!=typeof e?e:parseInt(e,10)||void 0},e.prototype.buildAuthorizeUrl=function(e){return void 0===e&&(e={}),r(this,void 0,void 0,function(){var t,r,i,a,c,u,s,f,l,d,p;return o(this,function(o){switch(o.label){case 0:return t=e.redirect_uri,r=e.appState,i=n(e,["redirect_uri","appState"]),a=Nn(qn()),c=qn(),u=qn(),[4,Jn(u)];case 1:return s=o.sent(),f=Gn(s),l=e.fragment?"#"+e.fragment:"",d=this._getParams(i,a,c,f,t),p=this._authorizeUrl(d),this.transactionManager.create(a,{nonce:c,code_verifier:u,appState:r,scope:d.scope,audience:d.audience||"default"}),[2,p+l]}})})},e.prototype.loginWithPopup=function(e,i){return void 0===e&&(e={}),void 0===i&&(i=Dn),r(this,void 0,void 0,function(){var r,a,c,u,s,f,l,d,p,h,v,y,m;return o(this,function(o){switch(o.label){case 0:return [4,Mn()];case 1:return r=o.sent(),a=n(e,[]),c=Nn(qn()),u=qn(),s=qn(),[4,Jn(s)];case 2:return f=o.sent(),l=Gn(f),d=this._getParams(a,c,u,l,this.options.redirect_uri||window.location.origin),p=this._authorizeUrl(t(t({},d),{response_mode:"web_message"})),[4,Wn(r,p,i)];case 3:if(h=o.sent(),c!==h.state)throw new Error("Invalid state");return [4,Yn({baseUrl:this.domainUrl,audience:e.audience||this.options.audience,client_id:this.options.client_id,code_verifier:s,code:h.code})];case 4:return v=o.sent(),y=this._verifyIdToken(v.id_token,u),m=t(t({},v),{decodedToken:y,scope:d.scope,audience:d.audience||"default"}),this.cache.save(m),ar("auth0.is.authenticated",!0,{daysUntilExpire:1}),[2]}})})},e.prototype.getUser=function(e){return void 0===e&&(e={audience:this.options.audience||"default",scope:this.options.scope||this.DEFAULT_SCOPE}),r(this,void 0,void 0,function(){var t;return o(this,function(n){return e.scope=Rn(this.DEFAULT_SCOPE,e.scope),[2,(t=this.cache.get(e))&&t.decodedToken.user]})})},e.prototype.getIdTokenClaims=function(e){return void 0===e&&(e={audience:this.options.audience||"default",scope:this.options.scope||this.DEFAULT_SCOPE}),r(this,void 0,void 0,function(){var t;return o(this,function(n){return e.scope=Rn(this.DEFAULT_SCOPE,e.scope),[2,(t=this.cache.get(e))&&t.decodedToken.claims]})})},e.prototype.loginWithRedirect=function(e){return void 0===e&&(e={}),r(this,void 0,void 0,function(){var t;return o(this,function(n){switch(n.label){case 0:return [4,this.buildAuthorizeUrl(e)];case 1:return t=n.sent(),window.location.assign(t),[2]}})})},e.prototype.handleRedirectCallback=function(e){return void 0===e&&(e=window.location.href),r(this,void 0,void 0,function(){var n,r,i,a,c,u,s,f,l,d;return o(this,function(o){switch(o.label){case 0:if(0===(n=e.split("?").slice(1)).length)throw new Error("There are no query params available for parsing.");if(r=function(e){e.indexOf("#")>-1&&(e=e.substr(0,e.indexOf("#")));var n=e.split("&"),r={};return n.forEach(function(e){var t=e.split("="),n=t[0],o=t[1];r[n]=decodeURIComponent(o);}),t(t({},r),{expires_in:parseInt(r.expires_in)})}(n.join("")),i=r.state,a=r.code,c=r.error,u=r.error_description,c)throw this.transactionManager.remove(i),new hr(c,u,i);if(!(s=this.transactionManager.get(i)))throw new Error("Invalid state");return this.transactionManager.remove(i),[4,Yn({baseUrl:this.domainUrl,audience:this.options.audience,client_id:this.options.client_id,code_verifier:s.code_verifier,code:a})];case 1:return f=o.sent(),l=this._verifyIdToken(f.id_token,s.nonce),d=t(t({},f),{decodedToken:l,audience:s.audience,scope:s.scope}),this.cache.save(d),ar("auth0.is.authenticated",!0,{daysUntilExpire:1}),[2,{appState:s.appState}]}})})},e.prototype.getTokenSilently=function(e){return void 0===e&&(e={audience:this.options.audience,scope:this.options.scope||this.DEFAULT_SCOPE,ignoreCache:!1}),r(this,void 0,void 0,function(){var n,r,i,a,c,u,s,f,l,d,p,h,v;return o(this,function(o){switch(o.label){case 0:e.scope=Rn(this.DEFAULT_SCOPE,e.scope),o.label=1;case 1:return o.trys.push([1,8,9,11]),[4,vr.acquireLock("auth0.lock.getTokenSilently",5e3)];case 2:return o.sent(),e.ignoreCache?[3,4]:(n=this.cache.get({scope:e.scope,audience:e.audience||"default"}))?[4,vr.releaseLock("auth0.lock.getTokenSilently")]:[3,4];case 3:return o.sent(),[2,n.access_token];case 4:return r=Nn(qn()),i=qn(),a=qn(),[4,Jn(a)];case 5:return c=o.sent(),u=Gn(c),s={audience:e.audience,scope:e.scope},f=this._getParams(s,r,i,u,this.options.redirect_uri||window.location.origin),l=this._authorizeUrl(t(t({},f),{prompt:"none",response_mode:"web_message"})),[4,(y=l,m=this.domainUrl,new Promise(function(e,t){var n=window.document.createElement("iframe");n.setAttribute("width","0"),n.setAttribute("height","0"),n.style.display="none";var r=setTimeout(function(){t(Fn),window.document.body.removeChild(n);},6e4),o=function(i){i.origin==m&&i.data&&"authorization_response"===i.data.type&&(i.source.close(),i.data.response.error?t(i.data.response):e(i.data.response),clearTimeout(r),window.removeEventListener("message",o,!1),window.document.body.removeChild(n));};window.addEventListener("message",o,!1),window.document.body.appendChild(n),n.setAttribute("src",y);}))];case 6:if(d=o.sent(),r!==d.state)throw new Error("Invalid state");return [4,Yn({baseUrl:this.domainUrl,audience:e.audience||this.options.audience,client_id:this.options.client_id,code_verifier:a,code:d.code})];case 7:return p=o.sent(),h=this._verifyIdToken(p.id_token,i),v=t(t({},p),{decodedToken:h,scope:f.scope,audience:f.audience||"default"}),this.cache.save(v),ar("auth0.is.authenticated",!0,{daysUntilExpire:1}),[2,p.access_token];case 8:throw o.sent();case 9:return [4,vr.releaseLock("auth0.lock.getTokenSilently")];case 10:return o.sent(),[7];case 11:return [2]}var y,m;})})},e.prototype.getTokenWithPopup=function(e,t){return void 0===e&&(e={audience:this.options.audience,scope:this.options.scope||this.DEFAULT_SCOPE}),void 0===t&&(t=Dn),r(this,void 0,void 0,function(){return o(this,function(n){switch(n.label){case 0:return e.scope=Rn(this.DEFAULT_SCOPE,this.options.scope,e.scope),[4,this.loginWithPopup(e,t)];case 1:return n.sent(),[2,this.cache.get({scope:e.scope,audience:e.audience||"default"}).access_token]}})})},e.prototype.isAuthenticated=function(){return r(this,void 0,void 0,function(){return o(this,function(e){switch(e.label){case 0:return [4,this.getUser()];case 1:return [2,!!e.sent()]}})})},e.prototype.logout=function(e){void 0===e&&(e={}),null!==e.client_id?e.client_id=e.client_id||this.options.client_id:delete e.client_id,cr("auth0.is.authenticated");var t=e.federated,r=n(e,["federated"]),o=t?"&federated":"",i=this._url("/v2/logout?"+zn(r));window.location.assign(""+i+o);},e}();return function(e){return r(this,void 0,void 0,function(){var t;return o(this,function(n){switch(n.label){case 0:if(Qn(),t=new yr(e),!ir("auth0.is.authenticated"))return [2,t];n.label=1;case 1:return n.trys.push([1,3,,4]),[4,t.getTokenSilently({audience:e.audience,scope:e.scope,ignoreCache:!0})];case 2:case 3:return n.sent(),[3,4];case 4:return [2,t]}})})}});
    //# sourceMappingURL=auth0-spa-js.production.js.map
    });

    var createAuth0Client = unwrapExports(auth0SpaJs_production);

    /* src\components\Auth0Context.svelte generated by Svelte v3.35.0 */

    function create_fragment$3(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[6].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[5], null);

    	return {
    		c() {
    			if (default_slot) default_slot.c();
    		},
    		m(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 32) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[5], dirty, null, null);
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { domain } = $$props;
    	let { client_id } = $$props;
    	let { audience } = $$props;
    	let { callback_url } = $$props;
    	let { logout_url } = $$props;
    	setContext(AUTH0_CONTEXT_CALLBACK_URL, callback_url);
    	setContext(AUTH0_CONTEXT_LOGOUT_URL, logout_url);

    	// constants
    	// TODO: parse JWT token and get token's actual expiration time.
    	const refreshRate = 10 * 60 * 60 * 1000;

    	// locals
    	let tokenRefreshIntervalId;

    	// getContext doesn't seem to return a value in OnMount, so we'll pass the auth0Promise around by reference.
    	let auth0Promise = createAuth0Client({ domain, client_id, audience });

    	setContext(AUTH0_CONTEXT_CLIENT_PROMISE, auth0Promise);

    	async function handleOnMount() {
    		// on run onMount after auth0
    		const auth0 = await auth0Promise;

    		// Not all browsers support this, please program defensively!
    		const params = new URLSearchParams(window.location.search);

    		// Check if something went wrong during login redirect
    		// and extract the error message
    		if (params.has("error")) {
    			authError.set(new Error(params.get("error_description")));
    		}

    		// if code then login success
    		if (params.has("code")) {
    			// Let the Auth0 SDK do it's stuff - save some state, etc.
    			const { appState } = await auth0.handleRedirectCallback();

    			// Can be smart here and redirect to original path instead of root
    			const url = appState.pathname || appState.search
    			? `${appState.pathname}${appState.search}`
    			: "";

    			// redirect to the last page we were on when login was configured if it was passed.
    			history.replaceState({}, "", url);

    			// location.href = url;
    			// clear errors on login.
    			authError.set(null);
    		}

    		const _isAuthenticated = await auth0.isAuthenticated();
    		isAuthenticated.set(_isAuthenticated);

    		if (_isAuthenticated) {
    			// fetch the user info
    			const user = await auth0.getUser();

    			userInfo.set(user);

    			// fetch the token claims
    			const idTokenClaims = await auth0.getIdTokenClaims();

    			idToken.set(idTokenClaims.__raw);

    			// automatically keep a curent token.
    			refreshToken(auth0Promise);

    			tokenRefreshIntervalId = setInterval(refreshToken, refreshRate);
    		}

    		isLoading.set(false);
    	}

    	// clear token refresh on Destroy so we're not leaking intervals.
    	async function handleOnDestroy() {
    		clearInterval(tokenRefreshIntervalId);
    	}

    	onMount(handleOnMount);
    	onDestroy(handleOnDestroy);

    	$$self.$$set = $$props => {
    		if ("domain" in $$props) $$invalidate(0, domain = $$props.domain);
    		if ("client_id" in $$props) $$invalidate(1, client_id = $$props.client_id);
    		if ("audience" in $$props) $$invalidate(2, audience = $$props.audience);
    		if ("callback_url" in $$props) $$invalidate(3, callback_url = $$props.callback_url);
    		if ("logout_url" in $$props) $$invalidate(4, logout_url = $$props.logout_url);
    		if ("$$scope" in $$props) $$invalidate(5, $$scope = $$props.$$scope);
    	};

    	return [domain, client_id, audience, callback_url, logout_url, $$scope, slots];
    }

    class Auth0Context extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			domain: 0,
    			client_id: 1,
    			audience: 2,
    			callback_url: 3,
    			logout_url: 4
    		});
    	}
    }

    /* src\components\Auth0LoginButton.svelte generated by Svelte v3.35.0 */

    function create_fragment$2(ctx) {
    	let button;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[5].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[4], null);

    	return {
    		c() {
    			button = element("button");
    			if (default_slot) default_slot.c();
    			attr(button, "class", /*clazz*/ ctx[2]);
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);

    			if (default_slot) {
    				default_slot.m(button, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen(button, "click", prevent_default(/*click_handler*/ ctx[6]));
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 16) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[4], dirty, null, null);
    				}
    			}

    			if (!current || dirty & /*clazz*/ 4) {
    				attr(button, "class", /*clazz*/ ctx[2]);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	const auth0Promise = getContext(AUTH0_CONTEXT_CLIENT_PROMISE);
    	let { callback_url = getContext(AUTH0_CONTEXT_CALLBACK_URL) } = $$props;
    	let { preserveRoute } = $$props;
    	let { class: clazz } = $$props;
    	const click_handler = () => login(auth0Promise, preserveRoute, callback_url);

    	$$self.$$set = $$props => {
    		if ("callback_url" in $$props) $$invalidate(0, callback_url = $$props.callback_url);
    		if ("preserveRoute" in $$props) $$invalidate(1, preserveRoute = $$props.preserveRoute);
    		if ("class" in $$props) $$invalidate(2, clazz = $$props.class);
    		if ("$$scope" in $$props) $$invalidate(4, $$scope = $$props.$$scope);
    	};

    	return [
    		callback_url,
    		preserveRoute,
    		clazz,
    		auth0Promise,
    		$$scope,
    		slots,
    		click_handler
    	];
    }

    class Auth0LoginButton extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			callback_url: 0,
    			preserveRoute: 1,
    			class: 2
    		});
    	}
    }

    /* src\components\Auth0LogoutButton.svelte generated by Svelte v3.35.0 */

    function create_fragment$1(ctx) {
    	let button;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[4].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);

    	return {
    		c() {
    			button = element("button");
    			if (default_slot) default_slot.c();
    			attr(button, "class", /*clazz*/ ctx[1]);
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);

    			if (default_slot) {
    				default_slot.m(button, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen(button, "click", prevent_default(/*click_handler*/ ctx[5]));
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 8) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[3], dirty, null, null);
    				}
    			}

    			if (!current || dirty & /*clazz*/ 2) {
    				attr(button, "class", /*clazz*/ ctx[1]);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	const auth0Promise = getContext(AUTH0_CONTEXT_CLIENT_PROMISE);
    	let { logout_url = getContext(AUTH0_CONTEXT_LOGOUT_URL) } = $$props;
    	let { class: clazz } = $$props;
    	const click_handler = () => logout(auth0Promise, logout_url);

    	$$self.$$set = $$props => {
    		if ("logout_url" in $$props) $$invalidate(0, logout_url = $$props.logout_url);
    		if ("class" in $$props) $$invalidate(1, clazz = $$props.class);
    		if ("$$scope" in $$props) $$invalidate(3, $$scope = $$props.$$scope);
    	};

    	return [logout_url, clazz, auth0Promise, $$scope, slots, click_handler];
    }

    class Auth0LogoutButton extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { logout_url: 0, class: 1 });
    	}
    }

    /* src\App.svelte generated by Svelte v3.35.0 */

    function create_default_slot_2(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Login");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (25:2) <Auth0LogoutButton class="btn">
    function create_default_slot_1(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Logout");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (16:0) <Auth0Context   domain="dev-hvw40i79.auth0.com"   client_id="aOijZt2ug6Ovgzp0HXdF23B6zxwA6PaP"   audience="https://darrelopry.com/svelte-auth0"   callback_url="https://darrelopry.com/svelte-auth0"   logout_url="https://darrelopry.com/svelte-auth0" >
    function create_default_slot(ctx) {
    	let auth0loginbutton;
    	let t0;
    	let auth0logoutbutton;
    	let t1;
    	let table;
    	let thead;
    	let t4;
    	let tbody;
    	let tr1;
    	let td0;
    	let td1;
    	let t6;
    	let t7;
    	let tr2;
    	let td2;
    	let td3;
    	let t9;
    	let t10;
    	let tr3;
    	let td4;
    	let td5;
    	let t12;
    	let t13;
    	let tr4;
    	let td6;
    	let td7;
    	let t15;
    	let t16;
    	let tr5;
    	let td8;
    	let td9;
    	let pre;
    	let t18_value = JSON.stringify(/*$userInfo*/ ctx[4], null, 2) + "";
    	let t18;
    	let t19;
    	let tr6;
    	let td10;
    	let td11;
    	let t21;
    	let current;

    	auth0loginbutton = new Auth0LoginButton({
    			props: {
    				class: "btn",
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			}
    		});

    	auth0logoutbutton = new Auth0LogoutButton({
    			props: {
    				class: "btn",
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(auth0loginbutton.$$.fragment);
    			t0 = space();
    			create_component(auth0logoutbutton.$$.fragment);
    			t1 = space();
    			table = element("table");
    			thead = element("thead");
    			thead.innerHTML = `<tr><th>store</th><th>value</th></tr>`;
    			t4 = space();
    			tbody = element("tbody");
    			tr1 = element("tr");
    			td0 = element("td");
    			td0.textContent = "isLoading";
    			td1 = element("td");
    			t6 = text(/*$isLoading*/ ctx[0]);
    			t7 = space();
    			tr2 = element("tr");
    			td2 = element("td");
    			td2.textContent = "isAuthenticated";
    			td3 = element("td");
    			t9 = text(/*$isAuthenticated*/ ctx[1]);
    			t10 = space();
    			tr3 = element("tr");
    			td4 = element("td");
    			td4.textContent = "authToken";
    			td5 = element("td");
    			t12 = text(/*$authToken*/ ctx[2]);
    			t13 = space();
    			tr4 = element("tr");
    			td6 = element("td");
    			td6.textContent = "idToken";
    			td7 = element("td");
    			t15 = text(/*$idToken*/ ctx[3]);
    			t16 = space();
    			tr5 = element("tr");
    			td8 = element("td");
    			td8.textContent = "userInfo";
    			td9 = element("td");
    			pre = element("pre");
    			t18 = text(t18_value);
    			t19 = space();
    			tr6 = element("tr");
    			td10 = element("td");
    			td10.textContent = "authError";
    			td11 = element("td");
    			t21 = text(/*$authError*/ ctx[5]);
    		},
    		m(target, anchor) {
    			mount_component(auth0loginbutton, target, anchor);
    			insert(target, t0, anchor);
    			mount_component(auth0logoutbutton, target, anchor);
    			insert(target, t1, anchor);
    			insert(target, table, anchor);
    			append(table, thead);
    			append(table, t4);
    			append(table, tbody);
    			append(tbody, tr1);
    			append(tr1, td0);
    			append(tr1, td1);
    			append(td1, t6);
    			append(tbody, t7);
    			append(tbody, tr2);
    			append(tr2, td2);
    			append(tr2, td3);
    			append(td3, t9);
    			append(tbody, t10);
    			append(tbody, tr3);
    			append(tr3, td4);
    			append(tr3, td5);
    			append(td5, t12);
    			append(tbody, t13);
    			append(tbody, tr4);
    			append(tr4, td6);
    			append(tr4, td7);
    			append(td7, t15);
    			append(tbody, t16);
    			append(tbody, tr5);
    			append(tr5, td8);
    			append(tr5, td9);
    			append(td9, pre);
    			append(pre, t18);
    			append(tbody, t19);
    			append(tbody, tr6);
    			append(tr6, td10);
    			append(tr6, td11);
    			append(td11, t21);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const auth0loginbutton_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				auth0loginbutton_changes.$$scope = { dirty, ctx };
    			}

    			auth0loginbutton.$set(auth0loginbutton_changes);
    			const auth0logoutbutton_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				auth0logoutbutton_changes.$$scope = { dirty, ctx };
    			}

    			auth0logoutbutton.$set(auth0logoutbutton_changes);
    			if (!current || dirty & /*$isLoading*/ 1) set_data(t6, /*$isLoading*/ ctx[0]);
    			if (!current || dirty & /*$isAuthenticated*/ 2) set_data(t9, /*$isAuthenticated*/ ctx[1]);
    			if (!current || dirty & /*$authToken*/ 4) set_data(t12, /*$authToken*/ ctx[2]);
    			if (!current || dirty & /*$idToken*/ 8) set_data(t15, /*$idToken*/ ctx[3]);
    			if ((!current || dirty & /*$userInfo*/ 16) && t18_value !== (t18_value = JSON.stringify(/*$userInfo*/ ctx[4], null, 2) + "")) set_data(t18, t18_value);
    			if (!current || dirty & /*$authError*/ 32) set_data(t21, /*$authError*/ ctx[5]);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(auth0loginbutton.$$.fragment, local);
    			transition_in(auth0logoutbutton.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(auth0loginbutton.$$.fragment, local);
    			transition_out(auth0logoutbutton.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(auth0loginbutton, detaching);
    			if (detaching) detach(t0);
    			destroy_component(auth0logoutbutton, detaching);
    			if (detaching) detach(t1);
    			if (detaching) detach(table);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div;
    	let auth0context;
    	let t0;
    	let p;
    	let t2;
    	let ol;
    	let current;

    	auth0context = new Auth0Context({
    			props: {
    				domain: "dev-hvw40i79.auth0.com",
    				client_id: "aOijZt2ug6Ovgzp0HXdF23B6zxwA6PaP",
    				audience: "https://darrelopry.com/svelte-auth0",
    				callback_url: "https://darrelopry.com/svelte-auth0",
    				logout_url: "https://darrelopry.com/svelte-auth0",
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			div = element("div");
    			create_component(auth0context.$$.fragment);
    			t0 = space();
    			p = element("p");
    			p.textContent = "If social login is not persisting across page reloads, you are most likely using Universal Login classic with Auth0\nDev keys for the social provider. There are two ways to resolve the issue:";
    			t2 = space();
    			ol = element("ol");

    			ol.innerHTML = `<li><a href="https://auth0.com/docs/universal-login/new">Switch to the New Universal Login Experience</a></li> 
  <li><a href="https://auth0.com/docs/connections/social/google">Use your own keys for the Social connection</a></li>`;

    			attr(div, "class", "container");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(auth0context, div, null);
    			append(div, t0);
    			append(div, p);
    			append(div, t2);
    			append(div, ol);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const auth0context_changes = {};

    			if (dirty & /*$$scope, $authError, $userInfo, $idToken, $authToken, $isAuthenticated, $isLoading*/ 127) {
    				auth0context_changes.$$scope = { dirty, ctx };
    			}

    			auth0context.$set(auth0context_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(auth0context.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(auth0context.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(auth0context);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let $isLoading;
    	let $isAuthenticated;
    	let $authToken;
    	let $idToken;
    	let $userInfo;
    	let $authError;
    	component_subscribe($$self, isLoading, $$value => $$invalidate(0, $isLoading = $$value));
    	component_subscribe($$self, isAuthenticated, $$value => $$invalidate(1, $isAuthenticated = $$value));
    	component_subscribe($$self, authToken, $$value => $$invalidate(2, $authToken = $$value));
    	component_subscribe($$self, idToken, $$value => $$invalidate(3, $idToken = $$value));
    	component_subscribe($$self, userInfo, $$value => $$invalidate(4, $userInfo = $$value));
    	component_subscribe($$self, authError, $$value => $$invalidate(5, $authError = $$value));
    	return [$isLoading, $isAuthenticated, $authToken, $idToken, $userInfo, $authError];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {},
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
