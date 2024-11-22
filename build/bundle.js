
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
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
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
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
    function set_store_value(store, ret, value) {
        store.set(value);
        return ret;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
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
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_custom_element_data(node, prop, value) {
        if (prop in node) {
            node[prop] = typeof node[prop] === 'boolean' && value === '' ? true : value;
        }
        else {
            attr(node, prop, value);
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        if (value == null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
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
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
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
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
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
        seen_callbacks.clear();
        set_current_component(saved_component);
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
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
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
        else if (callback) {
            callback();
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
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
            flush_render_callbacks($$.after_update);
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
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
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
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
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
            if (!is_function(callback)) {
                return noop;
            }
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

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=} start
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
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
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0 && stop) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const global$1 = writable({
        user: "",
        gameid: "",
        rooms: "",
        roomdata: "",
        roommax: "",
        ingame: false,
    });

    // Writable stores til at dele data
    const drawings = writable([]);
    const guesses = writable([]);

    let socket = null;

    function setupWebSocket() {
        if (!socket) { // Sørg for, at WebSocket kun oprettes én gang
            socket = new WebSocket("ws://localhost:3000");

            socket.onopen = () => {
                console.log("WebSocket connected");
            };

            socket.onmessage = (event) => {
                const message = JSON.parse(event.data);
            
                if (message.type === "newStroke") {
                    drawings.update((current) => {
                        current.push([]); // Start en ny streg
                        return current;
                    });
                } else if (message.type === "draw") {
                    drawings.update((current) => {
                        current[current.length - 1].push(message.data.point); // Tilføj punkt til den nyeste streg
                        return current;
                    });
                } else if (message.type === "drawdata") {
                    drawings.set(message.data); // Initialiser eller ryd tegnebrættet
                } else if (message.type === "guess") {
                    guesses.update((current) => [...current, message.data]); // Tilføj objektet
                } else if (message.type === "chatdata") {
                    guesses.set(message.data.filter(Boolean)); // Initialiser eller ryd chatten
                } else if (message.type === "roomcount") {
                    global$1.update((current) => {
                        return { ...current, rooms: message.data };
                    });
                } else if (message.type === "roommax") {
                    global$1.update((current) => {
                        return { ...current, roommax: message.data };
                    });
                } else if (message.type === "roomdata") {
                    global$1.update((current) => {
                        console.log("Updating roomdata with:", message.data);
                        return { ...current, roomdata: JSON.stringify(message.data) }; // Gem som array
                    });
                } else if (message.type === "start") {
                    console.log("Game started in room:", message.data.id);
                    drawings.set([]);
                    guesses.set([]);
                    global$1.update((current) => {
                        return { ...current, ingame: true };
                    });
                } else if (message.type === "currentWord") {
                    console.log("New word received:", message.data);
                }
            };
            

            socket.onclose = () => {
                console.log("WebSocket disconnected");
                socket = null; // Nulstil socket, så vi kan genoprette forbindelsen om nødvendigt
            };

            socket.onerror = (error) => {
                console.error("WebSocket error:", error);
            };
        }

        return socket;
    }

    function sendMessage(type, data) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type, data }));
        } else {
            console.warn("WebSocket is not connected");
        }
    }

    var websocketStore = /*#__PURE__*/Object.freeze({
        __proto__: null,
        drawings: drawings,
        guesses: guesses,
        sendMessage: sendMessage,
        setupWebSocket: setupWebSocket
    });

    /* src\Rooms.svelte generated by Svelte v3.59.2 */

    const { console: console_1$4 } = globals;
    const file$4 = "src\\Rooms.svelte";

    function create_fragment$4(ctx) {
    	let div1;
    	let div0;
    	let span0;
    	let t0;
    	let t1;
    	let t2;
    	let span1;
    	let t3;
    	let t4;
    	let t5_value = /*$global*/ ctx[2].roommax + "";
    	let t5;
    	let t6;
    	let button;
    	let t7;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			span0 = element("span");
    			t0 = text("Room ");
    			t1 = text(/*id*/ ctx[0]);
    			t2 = space();
    			span1 = element("span");
    			t3 = text(/*playerCount*/ ctx[1]);
    			t4 = text("/");
    			t5 = text(t5_value);
    			t6 = space();
    			button = element("button");
    			t7 = text("Join");
    			add_location(span0, file$4, 69, 8, 1904);
    			attr_dev(span1, "id", "count");
    			attr_dev(span1, "class", "svelte-mgsxg1");
    			add_location(span1, file$4, 70, 8, 1936);
    			attr_dev(div0, "id", "playercount");
    			attr_dev(div0, "class", "svelte-mgsxg1");
    			add_location(div0, file$4, 68, 4, 1872);
    			attr_dev(button, "id", "join");
    			attr_dev(button, "style", /*disabledButton*/ ctx[3]);
    			attr_dev(button, "class", "svelte-mgsxg1");
    			add_location(button, file$4, 72, 4, 2009);
    			attr_dev(div1, "id", "container");
    			attr_dev(div1, "style", /*disabledContainer*/ ctx[4]);
    			attr_dev(div1, "class", "svelte-mgsxg1");
    			add_location(div1, file$4, 67, 0, 1818);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, span0);
    			append_dev(span0, t0);
    			append_dev(span0, t1);
    			append_dev(div0, t2);
    			append_dev(div0, span1);
    			append_dev(span1, t3);
    			append_dev(span1, t4);
    			append_dev(span1, t5);
    			append_dev(div1, t6);
    			append_dev(div1, button);
    			append_dev(button, t7);

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*joinRoom*/ ctx[5](/*disabledButton*/ ctx[3]))) /*joinRoom*/ ctx[5](/*disabledButton*/ ctx[3]).apply(this, arguments);
    					},
    					false,
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			if (dirty & /*id*/ 1) set_data_dev(t1, /*id*/ ctx[0]);
    			if (dirty & /*playerCount*/ 2) set_data_dev(t3, /*playerCount*/ ctx[1]);
    			if (dirty & /*$global*/ 4 && t5_value !== (t5_value = /*$global*/ ctx[2].roommax + "")) set_data_dev(t5, t5_value);

    			if (dirty & /*disabledButton*/ 8) {
    				attr_dev(button, "style", /*disabledButton*/ ctx[3]);
    			}

    			if (dirty & /*disabledContainer*/ 16) {
    				attr_dev(div1, "style", /*disabledContainer*/ ctx[4]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let $global;
    	validate_store(global$1, 'global');
    	component_subscribe($$self, global$1, $$value => $$invalidate(2, $global = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Rooms', slots, []);
    	setupWebSocket();
    	let { id = null } = $$props;
    	let { data = null } = $$props;
    	let disabledButton = "";
    	let disabledContainer = "";

    	function joinRoom(disabled) {
    		if (disabled) return;
    		let username = prompt("Enter your name");

    		while (!username || username.length < 3) {
    			username = prompt("Enter your name (at least 3 characters):");

    			if (username === null) {
    				alert("Name input canceled.");
    				return null;
    			} else if (username.length < 3) {
    				alert("Name must be at least 3 characters long.");
    			}
    		}

    		set_store_value(global$1, $global.username = username, $global);
    		set_store_value(global$1, $global.gameid = id, $global);
    		Promise.resolve().then(function () { return websocketStore; }).then(({ sendMessage }) => sendMessage("join", { id, username }));
    	}

    	let playerCount = 0;
    	const writable_props = ['id', 'data'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$4.warn(`<Rooms> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('data' in $$props) $$invalidate(6, data = $$props.data);
    	};

    	$$self.$capture_state = () => ({
    		global: global$1,
    		setupWebSocket,
    		sendMessage,
    		id,
    		data,
    		disabledButton,
    		disabledContainer,
    		joinRoom,
    		playerCount,
    		$global
    	});

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('data' in $$props) $$invalidate(6, data = $$props.data);
    		if ('disabledButton' in $$props) $$invalidate(3, disabledButton = $$props.disabledButton);
    		if ('disabledContainer' in $$props) $$invalidate(4, disabledContainer = $$props.disabledContainer);
    		if ('playerCount' in $$props) $$invalidate(1, playerCount = $$props.playerCount);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*data*/ 64) {
    			{
    				try {
    					if (data.players.length) {
    						$$invalidate(1, playerCount = data.players.length);
    					} else {
    						$$invalidate(1, playerCount = 0);
    					}
    				} catch(error) {
    					$$invalidate(1, playerCount = 0);
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*data, playerCount, $global*/ 70) {
    			{
    				if (data) {
    					console.log(data);

    					if (playerCount >= $global.roommax || data.status !== 'open') {
    						$$invalidate(3, disabledButton = "background-color: grey; cursor: not-allowed;");
    						$$invalidate(4, disabledContainer = "border-color: grey;");
    					} else {
    						$$invalidate(3, disabledButton = "");
    						$$invalidate(4, disabledContainer = "");
    					}
    				} else {
    					$$invalidate(3, disabledButton = "");
    					$$invalidate(4, disabledContainer = "");
    				}
    			}
    		}
    	};

    	return [id, playerCount, $global, disabledButton, disabledContainer, joinRoom, data];
    }

    class Rooms extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { id: 0, data: 6 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Rooms",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get id() {
    		throw new Error("<Rooms>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Rooms>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get data() {
    		throw new Error("<Rooms>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<Rooms>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Home.svelte generated by Svelte v3.59.2 */

    const { console: console_1$3 } = globals;
    const file$3 = "src\\Home.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	return child_ctx;
    }

    // (23:8) {#each Array.from({ length: parseInt($global.rooms) }, (_, i) => i + 1) as room}
    function create_each_block$2(ctx) {
    	let rooms;
    	let current;

    	rooms = new Rooms({
    			props: {
    				id: /*room*/ ctx[2],
    				data: /*roomdata*/ ctx[1][/*room*/ ctx[2] - 1]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(rooms.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(rooms, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const rooms_changes = {};
    			if (dirty & /*$global*/ 1) rooms_changes.id = /*room*/ ctx[2];
    			if (dirty & /*roomdata, $global*/ 3) rooms_changes.data = /*roomdata*/ ctx[1][/*room*/ ctx[2] - 1];
    			rooms.$set(rooms_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(rooms.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(rooms.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(rooms, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(23:8) {#each Array.from({ length: parseInt($global.rooms) }, (_, i) => i + 1) as room}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let home;
    	let img;
    	let img_src_value;
    	let t;
    	let room_container;
    	let current;

    	let each_value = Array.from(
    		{
    			length: parseInt(/*$global*/ ctx[0].rooms)
    		},
    		func
    	);

    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			home = element("home");
    			img = element("img");
    			t = space();
    			room_container = element("room-container");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			if (!src_url_equal(img.src, img_src_value = "/uploads/logo.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "id", "home-logo");
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "svelte-1ibi2b7");
    			add_location(img, file$3, 19, 4, 417);
    			set_custom_element_data(room_container, "class", "svelte-1ibi2b7");
    			add_location(room_container, file$3, 21, 4, 473);
    			attr_dev(home, "class", "svelte-1ibi2b7");
    			add_location(home, file$3, 18, 0, 405);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, home, anchor);
    			append_dev(home, img);
    			append_dev(home, t);
    			append_dev(home, room_container);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(room_container, null);
    				}
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*Array, parseInt, $global, roomdata*/ 3) {
    				each_value = Array.from(
    					{
    						length: parseInt(/*$global*/ ctx[0].rooms)
    					},
    					func
    				);

    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(room_container, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(home);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const func = (_, i) => i + 1;

    function instance$3($$self, $$props, $$invalidate) {
    	let $global;
    	validate_store(global$1, 'global');
    	component_subscribe($$self, global$1, $$value => $$invalidate(0, $global = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Home', slots, []);
    	let roomdata = Array.from({ length: $global.roommax }, () => []);
    	console.log(roomdata);
    	$global.roomdata;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$3.warn(`<Home> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ global: global$1, Rooms, roomdata, $global });

    	$$self.$inject_state = $$props => {
    		if ('roomdata' in $$props) $$invalidate(1, roomdata = $$props.roomdata);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$global*/ 1) {
    			{
    				if ($global.roomdata.length > 0) {
    					$$invalidate(1, roomdata = JSON.parse($global.roomdata));
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*$global*/ 1) {
    			console.log($global.roomdata);
    		}
    	};

    	return [$global, roomdata];
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\Game.svelte generated by Svelte v3.59.2 */

    const { console: console_1$2 } = globals;
    const file$2 = "src\\Game.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[17] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[20] = list[i];
    	return child_ctx;
    }

    // (135:12) {#if currentUser?.brush}
    function create_if_block_3(ctx) {
    	let div;
    	let strong;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			strong = element("strong");
    			t = text(/*currentWord*/ ctx[3]);
    			attr_dev(strong, "class", "svelte-u6oqw5");
    			add_location(strong, file$2, 136, 20, 3642);
    			attr_dev(div, "id", "word");
    			attr_dev(div, "class", "svelte-u6oqw5");
    			add_location(div, file$2, 135, 16, 3605);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, strong);
    			append_dev(strong, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*currentWord*/ 8) set_data_dev(t, /*currentWord*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(135:12) {#if currentUser?.brush}",
    		ctx
    	});

    	return block;
    }

    // (142:8) {#if data}
    function create_if_block_1$1(ctx) {
    	let each_1_anchor;
    	let each_value_1 = /*data*/ ctx[1]?.players;
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data*/ 2) {
    				each_value_1 = /*data*/ ctx[1]?.players;
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(142:8) {#if data}",
    		ctx
    	});

    	return block;
    }

    // (147:20) {#if player.brush === true}
    function create_if_block_2(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "/skribble/uploads/brush.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "id", "brush");
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "svelte-u6oqw5");
    			add_location(img, file$2, 147, 20, 4073);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(147:20) {#if player.brush === true}",
    		ctx
    	});

    	return block;
    }

    // (143:12) {#each data?.players as player}
    function create_each_block_1(ctx) {
    	let div2;
    	let div0;
    	let t0_value = /*player*/ ctx[20].username + "";
    	let t0;
    	let t1;
    	let div1;
    	let t2;
    	let t3_value = /*player*/ ctx[20].score + "";
    	let t3;
    	let t4;
    	let t5;
    	let if_block = /*player*/ ctx[20].brush === true && create_if_block_2(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			t2 = text("Score: ");
    			t3 = text(t3_value);
    			t4 = space();
    			if (if_block) if_block.c();
    			t5 = space();
    			attr_dev(div0, "id", "player-name");
    			attr_dev(div0, "class", "svelte-u6oqw5");
    			add_location(div0, file$2, 144, 20, 3885);
    			attr_dev(div1, "id", "player-score");
    			attr_dev(div1, "class", "svelte-u6oqw5");
    			add_location(div1, file$2, 145, 20, 3952);
    			attr_dev(div2, "id", "player-container");
    			attr_dev(div2, "class", "svelte-u6oqw5");
    			add_location(div2, file$2, 143, 16, 3836);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, t0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, t2);
    			append_dev(div1, t3);
    			append_dev(div2, t4);
    			if (if_block) if_block.m(div2, null);
    			append_dev(div2, t5);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data*/ 2 && t0_value !== (t0_value = /*player*/ ctx[20].username + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*data*/ 2 && t3_value !== (t3_value = /*player*/ ctx[20].score + "")) set_data_dev(t3, t3_value);

    			if (/*player*/ ctx[20].brush === true) {
    				if (if_block) ; else {
    					if_block = create_if_block_2(ctx);
    					if_block.c();
    					if_block.m(div2, t5);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(143:12) {#each data?.players as player}",
    		ctx
    	});

    	return block;
    }

    // (164:12) {#if $guesses.length}
    function create_if_block$2(ctx) {
    	let each_1_anchor;
    	let each_value = /*$guesses*/ ctx[4];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$guesses*/ 16) {
    				each_value = /*$guesses*/ ctx[4];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(164:12) {#if $guesses.length}",
    		ctx
    	});

    	return block;
    }

    // (165:16) {#each $guesses as guess}
    function create_each_block$1(ctx) {
    	let div;
    	let strong;
    	let t0_value = /*guess*/ ctx[17].username + "";
    	let t0;
    	let t1;
    	let t2;
    	let t3_value = /*guess*/ ctx[17].guess + "";
    	let t3;

    	const block = {
    		c: function create() {
    			div = element("div");
    			strong = element("strong");
    			t0 = text(t0_value);
    			t1 = text(":");
    			t2 = text("  ");
    			t3 = text(t3_value);
    			attr_dev(strong, "class", "svelte-u6oqw5");
    			add_location(strong, file$2, 165, 36, 4651);
    			attr_dev(div, "id", "guess");
    			attr_dev(div, "class", "svelte-u6oqw5");
    			add_location(div, file$2, 165, 20, 4635);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, strong);
    			append_dev(strong, t0);
    			append_dev(strong, t1);
    			append_dev(div, t2);
    			append_dev(div, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$guesses*/ 16 && t0_value !== (t0_value = /*guess*/ ctx[17].username + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*$guesses*/ 16 && t3_value !== (t3_value = /*guess*/ ctx[17].guess + "")) set_data_dev(t3, t3_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(165:16) {#each $guesses as guess}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let main;
    	let div1;
    	let header;
    	let t0;
    	let players;
    	let t1;
    	let canvas_1;
    	let t2;
    	let div0;
    	let t3;
    	let input;
    	let input_disabled_value;
    	let mounted;
    	let dispose;
    	let if_block0 = /*currentUser*/ ctx[0]?.brush && create_if_block_3(ctx);
    	let if_block1 = /*data*/ ctx[1] && create_if_block_1$1(ctx);
    	let if_block2 = /*$guesses*/ ctx[4].length && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div1 = element("div");
    			header = element("header");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			players = element("players");
    			if (if_block1) if_block1.c();
    			t1 = space();
    			canvas_1 = element("canvas");
    			t2 = space();
    			div0 = element("div");
    			if (if_block2) if_block2.c();
    			t3 = space();
    			input = element("input");
    			attr_dev(header, "class", "svelte-u6oqw5");
    			add_location(header, file$2, 133, 8, 3541);
    			attr_dev(players, "class", "svelte-u6oqw5");
    			add_location(players, file$2, 140, 8, 3744);
    			attr_dev(canvas_1, "width", "500");
    			attr_dev(canvas_1, "height", "450");
    			attr_dev(canvas_1, "class", "svelte-u6oqw5");
    			add_location(canvas_1, file$2, 153, 8, 4244);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "Enter your guess");
    			attr_dev(input, "id", "guess-input");
    			input.disabled = input_disabled_value = /*currentUser*/ ctx[0]?.brush;
    			set_style(input, "cursor", !/*currentUser*/ ctx[0]?.brush ? 'text' : 'not-allowed');
    			attr_dev(input, "class", "svelte-u6oqw5");
    			add_location(input, file$2, 169, 12, 4770);
    			attr_dev(div0, "id", "guesses");
    			attr_dev(div0, "class", "svelte-u6oqw5");
    			add_location(div0, file$2, 162, 8, 4517);
    			attr_dev(div1, "id", "game");
    			attr_dev(div1, "class", "svelte-u6oqw5");
    			add_location(div1, file$2, 132, 4, 3516);
    			attr_dev(main, "class", "svelte-u6oqw5");
    			add_location(main, file$2, 131, 0, 3504);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div1);
    			append_dev(div1, header);
    			if (if_block0) if_block0.m(header, null);
    			append_dev(div1, t0);
    			append_dev(div1, players);
    			if (if_block1) if_block1.m(players, null);
    			append_dev(div1, t1);
    			append_dev(div1, canvas_1);
    			/*canvas_1_binding*/ ctx[12](canvas_1);
    			append_dev(div1, t2);
    			append_dev(div1, div0);
    			if (if_block2) if_block2.m(div0, null);
    			append_dev(div0, t3);
    			append_dev(div0, input);

    			if (!mounted) {
    				dispose = [
    					listen_dev(canvas_1, "mousedown", /*startDrawing*/ ctx[5], false, false, false, false),
    					listen_dev(canvas_1, "mousemove", /*draw*/ ctx[6], false, false, false, false),
    					listen_dev(canvas_1, "mouseup", /*stopDrawing*/ ctx[7], false, false, false, false),
    					listen_dev(canvas_1, "mouseleave", /*stopDrawing*/ ctx[7], false, false, false, false),
    					listen_dev(input, "keydown", /*keydown_handler*/ ctx[13], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*currentUser*/ ctx[0]?.brush) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_3(ctx);
    					if_block0.c();
    					if_block0.m(header, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*data*/ ctx[1]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1$1(ctx);
    					if_block1.c();
    					if_block1.m(players, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*$guesses*/ ctx[4].length) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block$2(ctx);
    					if_block2.c();
    					if_block2.m(div0, t3);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (dirty & /*currentUser*/ 1 && input_disabled_value !== (input_disabled_value = /*currentUser*/ ctx[0]?.brush)) {
    				prop_dev(input, "disabled", input_disabled_value);
    			}

    			if (dirty & /*currentUser*/ 1) {
    				set_style(input, "cursor", !/*currentUser*/ ctx[0]?.brush ? 'text' : 'not-allowed');
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			/*canvas_1_binding*/ ctx[12](null);
    			if (if_block2) if_block2.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $global;
    	let $drawings;
    	let $guesses;
    	validate_store(global$1, 'global');
    	component_subscribe($$self, global$1, $$value => $$invalidate(10, $global = $$value));
    	validate_store(drawings, 'drawings');
    	component_subscribe($$self, drawings, $$value => $$invalidate(11, $drawings = $$value));
    	validate_store(guesses, 'guesses');
    	component_subscribe($$self, guesses, $$value => $$invalidate(4, $guesses = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Game', slots, []);
    	let canvas;
    	let ctx;
    	let drawing = false;
    	let currentUser = null;
    	let currentWord = null;
    	let roomdata = Array.from({ length: $global.rooms }, () => []);
    	let data = [];

    	function drawOnCanvas(strokes) {
    		if (!ctx) return;
    		ctx.clearRect(0, 0, canvas.width, canvas.height);

    		strokes.forEach(stroke => {
    			if (stroke.length > 0) {
    				ctx.beginPath();
    				ctx.moveTo(stroke[0].x, stroke[0].y);

    				for (let i = 1; i < stroke.length; i++) {
    					ctx.lineTo(stroke[i].x, stroke[i].y);
    				}

    				ctx.stroke();
    			}
    		});
    	}

    	function startDrawing(event) {
    		if (!data) {
    			console.error("Room data or players are undefined. Cannot draw.");
    			return;
    		}

    		if (!currentUser) {
    			console.error("Current user not found in room data. Cannot draw.");
    			return;
    		}

    		if (!currentUser.brush) {
    			console.error("You are not allowed to draw.");
    			return; // Stop, hvis brugeren ikke har børsterettigheder
    		}

    		drawing = true;

    		drawings.update(current => {
    			current.push([]); // Start en ny streg
    			return current;
    		});

    		Promise.resolve().then(function () { return websocketStore; }).then(({ sendMessage }) => sendMessage('newStroke', { id: $global.gameid }));
    	}

    	function draw(event) {
    		if (!drawing) return;
    		const data = { x: event.offsetX, y: event.offsetY };

    		drawings.update(current => {
    			current[current.length - 1].push(data); // Tilføj punkt til den nyeste streg
    			return current;
    		});

    		Promise.resolve().then(function () { return websocketStore; }).then(({ sendMessage }) => sendMessage('draw', { id: $global.gameid, point: data }));
    	}

    	function stopDrawing() {
    		drawing = false;
    	}

    	function sendGuess(guess) {
    		if (guess.trim()) {
    			Promise.resolve().then(function () { return websocketStore; }).then(({ sendMessage }) => sendMessage('guess', {
    				id: $global.gameid,
    				username: $global.username, // Send brugernavnet
    				guess: guess.trim(), // Send gættet
    				
    			}));
    		} else {
    			console.error('Invalid guess input:', guess);
    		}
    	}

    	onMount(() => {
    		const canvasElement = canvas;
    		ctx = canvasElement.getContext("2d");
    		ctx.lineWidth = 2;
    		ctx.strokeStyle = "black";
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$2.warn(`<Game> was created with unknown prop '${key}'`);
    	});

    	function canvas_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			canvas = $$value;
    			$$invalidate(2, canvas);
    		});
    	}

    	const keydown_handler = e => {
    		if (e.key === "Enter") {
    			sendGuess(e.target.value);
    			e.target.value = "";
    		}
    	};

    	$$self.$capture_state = () => ({
    		drawings,
    		guesses,
    		onMount,
    		global: global$1,
    		canvas,
    		ctx,
    		drawing,
    		currentUser,
    		currentWord,
    		roomdata,
    		data,
    		drawOnCanvas,
    		startDrawing,
    		draw,
    		stopDrawing,
    		sendGuess,
    		$global,
    		$drawings,
    		$guesses
    	});

    	$$self.$inject_state = $$props => {
    		if ('canvas' in $$props) $$invalidate(2, canvas = $$props.canvas);
    		if ('ctx' in $$props) ctx = $$props.ctx;
    		if ('drawing' in $$props) drawing = $$props.drawing;
    		if ('currentUser' in $$props) $$invalidate(0, currentUser = $$props.currentUser);
    		if ('currentWord' in $$props) $$invalidate(3, currentWord = $$props.currentWord);
    		if ('roomdata' in $$props) $$invalidate(9, roomdata = $$props.roomdata);
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$global, roomdata, data, currentUser*/ 1539) {
    			{
    				if ($global.roomdata) {
    					$$invalidate(9, roomdata = JSON.parse($global.roomdata));
    				}

    				console.log("Changed roomdata from", roomdata);

    				if (roomdata.players) {
    					$$invalidate(1, data = roomdata);
    				} else {
    					$$invalidate(1, data = roomdata[$global.gameid - 1] || { players: [] });
    				}

    				console.log("Changed roomdata to", data);
    				$$invalidate(0, currentUser = data.players.find(player => player.username === $global.username));
    				$$invalidate(3, currentWord = data.currentWord);
    				console.log(currentUser);
    			}
    		}

    		if ($$self.$$.dirty & /*$drawings*/ 2048) {
    			{
    				drawOnCanvas($drawings);
    			}
    		}
    	};

    	return [
    		currentUser,
    		data,
    		canvas,
    		currentWord,
    		$guesses,
    		startDrawing,
    		draw,
    		stopDrawing,
    		sendGuess,
    		roomdata,
    		$global,
    		$drawings,
    		canvas_1_binding,
    		keydown_handler
    	];
    }

    class Game extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Game",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\Lobby.svelte generated by Svelte v3.59.2 */

    const { console: console_1$1 } = globals;
    const file$1 = "src\\Lobby.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    // (39:8) {#if data?.players}
    function create_if_block$1(ctx) {
    	let each_1_anchor;
    	let each_value = /*data*/ ctx[1].players;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data*/ 2) {
    				each_value = /*data*/ ctx[1].players;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(39:8) {#if data?.players}",
    		ctx
    	});

    	return block;
    }

    // (40:12) {#each data.players as player}
    function create_each_block(ctx) {
    	let div1;
    	let div0;
    	let t0_value = /*player*/ ctx[6].username + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(div0, "id", "player-name");
    			attr_dev(div0, "class", "svelte-ukwai1");
    			add_location(div0, file$1, 41, 20, 1146);
    			attr_dev(div1, "id", "player-container");
    			attr_dev(div1, "class", "svelte-ukwai1");
    			add_location(div1, file$1, 40, 16, 1097);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div1, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data*/ 2 && t0_value !== (t0_value = /*player*/ ctx[6].username + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(40:12) {#each data.players as player}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let lobby;
    	let players;
    	let t0;
    	let header;
    	let t1;
    	let t2;
    	let t3;
    	let div;
    	let button0;
    	let t5;
    	let button1;
    	let mounted;
    	let dispose;
    	let if_block = /*data*/ ctx[1]?.players && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			lobby = element("lobby");
    			players = element("players");
    			if (if_block) if_block.c();
    			t0 = space();
    			header = element("header");
    			t1 = text("Room ");
    			t2 = text(/*id*/ ctx[0]);
    			t3 = space();
    			div = element("div");
    			button0 = element("button");
    			button0.textContent = "Start game";
    			t5 = space();
    			button1 = element("button");
    			button1.textContent = "✖";
    			attr_dev(players, "class", "svelte-ukwai1");
    			add_location(players, file$1, 37, 4, 997);
    			attr_dev(header, "class", "svelte-ukwai1");
    			add_location(header, file$1, 46, 4, 1273);
    			add_location(button0, file$1, 50, 8, 1349);
    			attr_dev(div, "id", "buttons");
    			attr_dev(div, "class", "svelte-ukwai1");
    			add_location(div, file$1, 49, 4, 1321);
    			attr_dev(button1, "id", "exit");
    			attr_dev(button1, "class", "svelte-ukwai1");
    			add_location(button1, file$1, 53, 4, 1417);
    			attr_dev(lobby, "class", "svelte-ukwai1");
    			add_location(lobby, file$1, 36, 0, 984);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, lobby, anchor);
    			append_dev(lobby, players);
    			if (if_block) if_block.m(players, null);
    			append_dev(lobby, t0);
    			append_dev(lobby, header);
    			append_dev(header, t1);
    			append_dev(header, t2);
    			append_dev(lobby, t3);
    			append_dev(lobby, div);
    			append_dev(div, button0);
    			append_dev(lobby, t5);
    			append_dev(lobby, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*startGame*/ ctx[3], false, false, false, false),
    					listen_dev(button1, "click", /*exit*/ ctx[2], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*data*/ ctx[1]?.players) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(players, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*id*/ 1) set_data_dev(t2, /*id*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(lobby);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $global;
    	validate_store(global$1, 'global');
    	component_subscribe($$self, global$1, $$value => $$invalidate(5, $global = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Lobby', slots, []);
    	setupWebSocket();
    	let { id = null } = $$props;
    	let roomdata = Array.from({ length: $global.rooms }, () => ({ players: [], status: 'open' }));
    	let data = [];

    	function exit() {
    		let username = $global.username;
    		console.log({ id, username });
    		Promise.resolve().then(function () { return websocketStore; }).then(({ sendMessage }) => sendMessage("leave", { id, username }));
    		set_store_value(global$1, $global.gameid = null, $global);
    		set_store_value(global$1, $global.username = null, $global);
    	}

    	function startGame() {
    		Promise.resolve().then(function () { return websocketStore; }).then(({ sendMessage }) => sendMessage("start", { id }));
    	}

    	const writable_props = ['id'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Lobby> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    	};

    	$$self.$capture_state = () => ({
    		global: global$1,
    		setupWebSocket,
    		sendMessage,
    		id,
    		roomdata,
    		data,
    		exit,
    		startGame,
    		$global
    	});

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('roomdata' in $$props) $$invalidate(4, roomdata = $$props.roomdata);
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$global, roomdata, id*/ 49) {
    			{
    				if ($global.roomdata) {
    					$$invalidate(4, roomdata = JSON.parse($global.roomdata));
    				}

    				$$invalidate(1, data = roomdata[id - 1]);
    			}
    		}
    	};

    	return [id, data, exit, startGame, roomdata, $global];
    }

    class Lobby extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { id: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Lobby",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get id() {
    		throw new Error("<Lobby>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Lobby>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.59.2 */

    const { console: console_1 } = globals;
    const file = "src\\App.svelte";

    // (40:0) {:else}
    function create_else_block_1(ctx) {
    	let home;
    	let current;
    	home = new Home({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(home.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(home, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(home.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(home.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(home, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(40:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (34:0) {#if $global.gameid}
    function create_if_block(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1, create_else_block];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (/*$global*/ ctx[0].ingame) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_1(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(34:0) {#if $global.gameid}",
    		ctx
    	});

    	return block;
    }

    // (37:1) {:else}
    function create_else_block(ctx) {
    	let lobby;
    	let current;

    	lobby = new Lobby({
    			props: { id: /*$global*/ ctx[0].gameid },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(lobby.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(lobby, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const lobby_changes = {};
    			if (dirty & /*$global*/ 1) lobby_changes.id = /*$global*/ ctx[0].gameid;
    			lobby.$set(lobby_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(lobby.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(lobby.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(lobby, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(37:1) {:else}",
    		ctx
    	});

    	return block;
    }

    // (35:1) {#if $global.ingame}
    function create_if_block_1(ctx) {
    	let game;
    	let current;

    	game = new Game({
    			props: { id: /*$global*/ ctx[0].gameid },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(game.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(game, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const game_changes = {};
    			if (dirty & /*$global*/ 1) game_changes.id = /*$global*/ ctx[0].gameid;
    			game.$set(game_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(game.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(game.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(game, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(35:1) {#if $global.ingame}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block_1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*$global*/ ctx[0].gameid) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			if_block.c();
    			attr_dev(main, "class", "svelte-1bfyd23");
    			add_location(main, file, 32, 0, 750);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			if_blocks[current_block_type_index].m(main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(main, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let $global;
    	validate_store(global$1, 'global');
    	component_subscribe($$self, global$1, $$value => $$invalidate(0, $global = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	$global.user;
    	setupWebSocket();

    	function handleBeforeUnload(event) {
    		if ($global.gameid) {
    			Promise.resolve().then(function () { return websocketStore; }).then(({ sendMessage }) => sendMessage("leave", {
    				'id': $global.gameid,
    				'username': $global.username
    			}));

    			event.returnValue = "";
    		}
    	}

    	onMount(() => {
    		window.addEventListener("beforeunload", handleBeforeUnload);

    		return () => {
    			window.removeEventListener("beforeunload", handleBeforeUnload);
    		};
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		onMount,
    		global: global$1,
    		Home,
    		Game,
    		Lobby,
    		setupWebSocket,
    		handleBeforeUnload,
    		$global
    	});

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$global*/ 1) {
    			console.log($global.ingame, "SIUIIII");
    		}
    	};

    	return [$global];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
