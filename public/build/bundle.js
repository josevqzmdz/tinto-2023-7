
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
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
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }
    function compute_rest_props(props, keys) {
        const rest = {};
        keys = new Set(keys);
        for (const k in props)
            if (!keys.has(k) && k[0] !== '$')
                rest[k] = props[k];
        return rest;
    }
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
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
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
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_svg_attributes(node, attributes) {
        for (const key in attributes) {
            attr(node, key, attributes[key]);
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
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
        else if (callback) {
            callback();
        }
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
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
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.55.1' }, detail), { bubbles: true }));
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
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
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

    /* node_modules/svelte-bootstrap-icons/lib/EnvelopeFill.svelte generated by Svelte v3.55.1 */

    const file$g = "node_modules/svelte-bootstrap-icons/lib/EnvelopeFill.svelte";

    function create_fragment$g(ctx) {
    	let svg;
    	let path;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	let svg_levels = [
    		{ xmlns: "http://www.w3.org/2000/svg" },
    		{ width: "16" },
    		{ height: "16" },
    		{ fill: "currentColor" },
    		{ viewBox: "0 0 16 16" },
    		/*$$restProps*/ ctx[0]
    	];

    	let svg_data = {};

    	for (let i = 0; i < svg_levels.length; i += 1) {
    		svg_data = assign(svg_data, svg_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			if (default_slot) default_slot.c();
    			path = svg_element("path");
    			attr_dev(path, "d", "M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414.05 3.555ZM0 4.697v7.104l5.803-3.558L0 4.697ZM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586l-1.239-.757Zm3.436-.586L16 11.801V4.697l-5.803 3.546Z");
    			add_location(path, file$g, 0, 174, 174);
    			set_svg_attributes(svg, svg_data);
    			toggle_class(svg, "bi", true);
    			toggle_class(svg, "bi-envelope-fill", true);
    			add_location(svg, file$g, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);

    			if (default_slot) {
    				default_slot.m(svg, null);
    			}

    			append_dev(svg, path);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
    						null
    					);
    				}
    			}

    			set_svg_attributes(svg, svg_data = get_spread_update(svg_levels, [
    				{ xmlns: "http://www.w3.org/2000/svg" },
    				{ width: "16" },
    				{ height: "16" },
    				{ fill: "currentColor" },
    				{ viewBox: "0 0 16 16" },
    				dirty & /*$$restProps*/ 1 && /*$$restProps*/ ctx[0]
    			]));

    			toggle_class(svg, "bi", true);
    			toggle_class(svg, "bi-envelope-fill", true);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$g.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$g($$self, $$props, $$invalidate) {
    	const omit_props_names = [];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('EnvelopeFill', slots, ['default']);

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(0, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ('$$scope' in $$new_props) $$invalidate(1, $$scope = $$new_props.$$scope);
    	};

    	return [$$restProps, $$scope, slots];
    }

    class EnvelopeFill extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$g, create_fragment$g, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "EnvelopeFill",
    			options,
    			id: create_fragment$g.name
    		});
    	}
    }

    /* node_modules/svelte-bootstrap-icons/lib/Facebook.svelte generated by Svelte v3.55.1 */

    const file$f = "node_modules/svelte-bootstrap-icons/lib/Facebook.svelte";

    function create_fragment$f(ctx) {
    	let svg;
    	let path;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	let svg_levels = [
    		{ xmlns: "http://www.w3.org/2000/svg" },
    		{ width: "16" },
    		{ height: "16" },
    		{ fill: "currentColor" },
    		{ viewBox: "0 0 16 16" },
    		/*$$restProps*/ ctx[0]
    	];

    	let svg_data = {};

    	for (let i = 0; i < svg_levels.length; i += 1) {
    		svg_data = assign(svg_data, svg_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			if (default_slot) default_slot.c();
    			path = svg_element("path");
    			attr_dev(path, "d", "M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951z");
    			add_location(path, file$f, 0, 169, 169);
    			set_svg_attributes(svg, svg_data);
    			toggle_class(svg, "bi", true);
    			toggle_class(svg, "bi-facebook", true);
    			add_location(svg, file$f, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);

    			if (default_slot) {
    				default_slot.m(svg, null);
    			}

    			append_dev(svg, path);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
    						null
    					);
    				}
    			}

    			set_svg_attributes(svg, svg_data = get_spread_update(svg_levels, [
    				{ xmlns: "http://www.w3.org/2000/svg" },
    				{ width: "16" },
    				{ height: "16" },
    				{ fill: "currentColor" },
    				{ viewBox: "0 0 16 16" },
    				dirty & /*$$restProps*/ 1 && /*$$restProps*/ ctx[0]
    			]));

    			toggle_class(svg, "bi", true);
    			toggle_class(svg, "bi-facebook", true);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$f.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$f($$self, $$props, $$invalidate) {
    	const omit_props_names = [];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Facebook', slots, ['default']);

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(0, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ('$$scope' in $$new_props) $$invalidate(1, $$scope = $$new_props.$$scope);
    	};

    	return [$$restProps, $$scope, slots];
    }

    class Facebook extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$f, create_fragment$f, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Facebook",
    			options,
    			id: create_fragment$f.name
    		});
    	}
    }

    /* node_modules/svelte-bootstrap-icons/lib/GeoAltFill.svelte generated by Svelte v3.55.1 */

    const file$e = "node_modules/svelte-bootstrap-icons/lib/GeoAltFill.svelte";

    function create_fragment$e(ctx) {
    	let svg;
    	let path;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	let svg_levels = [
    		{ xmlns: "http://www.w3.org/2000/svg" },
    		{ width: "16" },
    		{ height: "16" },
    		{ fill: "currentColor" },
    		{ viewBox: "0 0 16 16" },
    		/*$$restProps*/ ctx[0]
    	];

    	let svg_data = {};

    	for (let i = 0; i < svg_levels.length; i += 1) {
    		svg_data = assign(svg_data, svg_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			if (default_slot) default_slot.c();
    			path = svg_element("path");
    			attr_dev(path, "d", "M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z");
    			add_location(path, file$e, 0, 173, 173);
    			set_svg_attributes(svg, svg_data);
    			toggle_class(svg, "bi", true);
    			toggle_class(svg, "bi-geo-alt-fill", true);
    			add_location(svg, file$e, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);

    			if (default_slot) {
    				default_slot.m(svg, null);
    			}

    			append_dev(svg, path);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
    						null
    					);
    				}
    			}

    			set_svg_attributes(svg, svg_data = get_spread_update(svg_levels, [
    				{ xmlns: "http://www.w3.org/2000/svg" },
    				{ width: "16" },
    				{ height: "16" },
    				{ fill: "currentColor" },
    				{ viewBox: "0 0 16 16" },
    				dirty & /*$$restProps*/ 1 && /*$$restProps*/ ctx[0]
    			]));

    			toggle_class(svg, "bi", true);
    			toggle_class(svg, "bi-geo-alt-fill", true);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$e($$self, $$props, $$invalidate) {
    	const omit_props_names = [];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('GeoAltFill', slots, ['default']);

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(0, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ('$$scope' in $$new_props) $$invalidate(1, $$scope = $$new_props.$$scope);
    	};

    	return [$$restProps, $$scope, slots];
    }

    class GeoAltFill extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "GeoAltFill",
    			options,
    			id: create_fragment$e.name
    		});
    	}
    }

    /* node_modules/svelte-bootstrap-icons/lib/Google.svelte generated by Svelte v3.55.1 */

    const file$d = "node_modules/svelte-bootstrap-icons/lib/Google.svelte";

    function create_fragment$d(ctx) {
    	let svg;
    	let path;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	let svg_levels = [
    		{ xmlns: "http://www.w3.org/2000/svg" },
    		{ width: "16" },
    		{ height: "16" },
    		{ fill: "currentColor" },
    		{ viewBox: "0 0 16 16" },
    		/*$$restProps*/ ctx[0]
    	];

    	let svg_data = {};

    	for (let i = 0; i < svg_levels.length; i += 1) {
    		svg_data = assign(svg_data, svg_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			if (default_slot) default_slot.c();
    			path = svg_element("path");
    			attr_dev(path, "d", "M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.689 7.689 0 0 1 5.352 2.082l-2.284 2.284A4.347 4.347 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.792 4.792 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.702 3.702 0 0 0 1.599-2.431H8v-3.08h7.545z");
    			add_location(path, file$d, 0, 167, 167);
    			set_svg_attributes(svg, svg_data);
    			toggle_class(svg, "bi", true);
    			toggle_class(svg, "bi-google", true);
    			add_location(svg, file$d, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);

    			if (default_slot) {
    				default_slot.m(svg, null);
    			}

    			append_dev(svg, path);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
    						null
    					);
    				}
    			}

    			set_svg_attributes(svg, svg_data = get_spread_update(svg_levels, [
    				{ xmlns: "http://www.w3.org/2000/svg" },
    				{ width: "16" },
    				{ height: "16" },
    				{ fill: "currentColor" },
    				{ viewBox: "0 0 16 16" },
    				dirty & /*$$restProps*/ 1 && /*$$restProps*/ ctx[0]
    			]));

    			toggle_class(svg, "bi", true);
    			toggle_class(svg, "bi-google", true);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$d($$self, $$props, $$invalidate) {
    	const omit_props_names = [];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Google', slots, ['default']);

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(0, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ('$$scope' in $$new_props) $$invalidate(1, $$scope = $$new_props.$$scope);
    	};

    	return [$$restProps, $$scope, slots];
    }

    class Google extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$d, create_fragment$d, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Google",
    			options,
    			id: create_fragment$d.name
    		});
    	}
    }

    /* node_modules/svelte-bootstrap-icons/lib/Instagram.svelte generated by Svelte v3.55.1 */

    const file$c = "node_modules/svelte-bootstrap-icons/lib/Instagram.svelte";

    function create_fragment$c(ctx) {
    	let svg;
    	let path;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	let svg_levels = [
    		{ xmlns: "http://www.w3.org/2000/svg" },
    		{ width: "16" },
    		{ height: "16" },
    		{ fill: "currentColor" },
    		{ viewBox: "0 0 16 16" },
    		/*$$restProps*/ ctx[0]
    	];

    	let svg_data = {};

    	for (let i = 0; i < svg_levels.length; i += 1) {
    		svg_data = assign(svg_data, svg_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			if (default_slot) default_slot.c();
    			path = svg_element("path");
    			attr_dev(path, "d", "M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.927 3.927 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 0 0-.923-1.417A3.911 3.911 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z");
    			add_location(path, file$c, 0, 170, 170);
    			set_svg_attributes(svg, svg_data);
    			toggle_class(svg, "bi", true);
    			toggle_class(svg, "bi-instagram", true);
    			add_location(svg, file$c, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);

    			if (default_slot) {
    				default_slot.m(svg, null);
    			}

    			append_dev(svg, path);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
    						null
    					);
    				}
    			}

    			set_svg_attributes(svg, svg_data = get_spread_update(svg_levels, [
    				{ xmlns: "http://www.w3.org/2000/svg" },
    				{ width: "16" },
    				{ height: "16" },
    				{ fill: "currentColor" },
    				{ viewBox: "0 0 16 16" },
    				dirty & /*$$restProps*/ 1 && /*$$restProps*/ ctx[0]
    			]));

    			toggle_class(svg, "bi", true);
    			toggle_class(svg, "bi-instagram", true);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	const omit_props_names = [];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Instagram', slots, ['default']);

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(0, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ('$$scope' in $$new_props) $$invalidate(1, $$scope = $$new_props.$$scope);
    	};

    	return [$$restProps, $$scope, slots];
    }

    class Instagram extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$c, create_fragment$c, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Instagram",
    			options,
    			id: create_fragment$c.name
    		});
    	}
    }

    /* node_modules/svelte-bootstrap-icons/lib/List.svelte generated by Svelte v3.55.1 */

    const file$b = "node_modules/svelte-bootstrap-icons/lib/List.svelte";

    function create_fragment$b(ctx) {
    	let svg;
    	let path;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	let svg_levels = [
    		{ xmlns: "http://www.w3.org/2000/svg" },
    		{ width: "16" },
    		{ height: "16" },
    		{ fill: "currentColor" },
    		{ viewBox: "0 0 16 16" },
    		/*$$restProps*/ ctx[0]
    	];

    	let svg_data = {};

    	for (let i = 0; i < svg_levels.length; i += 1) {
    		svg_data = assign(svg_data, svg_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			if (default_slot) default_slot.c();
    			path = svg_element("path");
    			attr_dev(path, "fill-rule", "evenodd");
    			attr_dev(path, "d", "M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z");
    			add_location(path, file$b, 0, 165, 165);
    			set_svg_attributes(svg, svg_data);
    			toggle_class(svg, "bi", true);
    			toggle_class(svg, "bi-list", true);
    			add_location(svg, file$b, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);

    			if (default_slot) {
    				default_slot.m(svg, null);
    			}

    			append_dev(svg, path);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
    						null
    					);
    				}
    			}

    			set_svg_attributes(svg, svg_data = get_spread_update(svg_levels, [
    				{ xmlns: "http://www.w3.org/2000/svg" },
    				{ width: "16" },
    				{ height: "16" },
    				{ fill: "currentColor" },
    				{ viewBox: "0 0 16 16" },
    				dirty & /*$$restProps*/ 1 && /*$$restProps*/ ctx[0]
    			]));

    			toggle_class(svg, "bi", true);
    			toggle_class(svg, "bi-list", true);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	const omit_props_names = [];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('List', slots, ['default']);

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(0, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ('$$scope' in $$new_props) $$invalidate(1, $$scope = $$new_props.$$scope);
    	};

    	return [$$restProps, $$scope, slots];
    }

    class List extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "List",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    /* node_modules/svelte-bootstrap-icons/lib/TelephoneFill.svelte generated by Svelte v3.55.1 */

    const file$a = "node_modules/svelte-bootstrap-icons/lib/TelephoneFill.svelte";

    function create_fragment$a(ctx) {
    	let svg;
    	let path;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	let svg_levels = [
    		{ xmlns: "http://www.w3.org/2000/svg" },
    		{ width: "16" },
    		{ height: "16" },
    		{ fill: "currentColor" },
    		{ viewBox: "0 0 16 16" },
    		/*$$restProps*/ ctx[0]
    	];

    	let svg_data = {};

    	for (let i = 0; i < svg_levels.length; i += 1) {
    		svg_data = assign(svg_data, svg_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			if (default_slot) default_slot.c();
    			path = svg_element("path");
    			attr_dev(path, "fill-rule", "evenodd");
    			attr_dev(path, "d", "M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z");
    			add_location(path, file$a, 0, 175, 175);
    			set_svg_attributes(svg, svg_data);
    			toggle_class(svg, "bi", true);
    			toggle_class(svg, "bi-telephone-fill", true);
    			add_location(svg, file$a, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);

    			if (default_slot) {
    				default_slot.m(svg, null);
    			}

    			append_dev(svg, path);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
    						null
    					);
    				}
    			}

    			set_svg_attributes(svg, svg_data = get_spread_update(svg_levels, [
    				{ xmlns: "http://www.w3.org/2000/svg" },
    				{ width: "16" },
    				{ height: "16" },
    				{ fill: "currentColor" },
    				{ viewBox: "0 0 16 16" },
    				dirty & /*$$restProps*/ 1 && /*$$restProps*/ ctx[0]
    			]));

    			toggle_class(svg, "bi", true);
    			toggle_class(svg, "bi-telephone-fill", true);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	const omit_props_names = [];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TelephoneFill', slots, ['default']);

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(0, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ('$$scope' in $$new_props) $$invalidate(1, $$scope = $$new_props.$$scope);
    	};

    	return [$$restProps, $$scope, slots];
    }

    class TelephoneFill extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TelephoneFill",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    /* node_modules/svelte-bootstrap-icons/lib/Whatsapp.svelte generated by Svelte v3.55.1 */

    const file$9 = "node_modules/svelte-bootstrap-icons/lib/Whatsapp.svelte";

    function create_fragment$9(ctx) {
    	let svg;
    	let path;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	let svg_levels = [
    		{ xmlns: "http://www.w3.org/2000/svg" },
    		{ width: "16" },
    		{ height: "16" },
    		{ fill: "currentColor" },
    		{ viewBox: "0 0 16 16" },
    		/*$$restProps*/ ctx[0]
    	];

    	let svg_data = {};

    	for (let i = 0; i < svg_levels.length; i += 1) {
    		svg_data = assign(svg_data, svg_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			if (default_slot) default_slot.c();
    			path = svg_element("path");
    			attr_dev(path, "d", "M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z");
    			add_location(path, file$9, 0, 169, 169);
    			set_svg_attributes(svg, svg_data);
    			toggle_class(svg, "bi", true);
    			toggle_class(svg, "bi-whatsapp", true);
    			add_location(svg, file$9, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);

    			if (default_slot) {
    				default_slot.m(svg, null);
    			}

    			append_dev(svg, path);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
    						null
    					);
    				}
    			}

    			set_svg_attributes(svg, svg_data = get_spread_update(svg_levels, [
    				{ xmlns: "http://www.w3.org/2000/svg" },
    				{ width: "16" },
    				{ height: "16" },
    				{ fill: "currentColor" },
    				{ viewBox: "0 0 16 16" },
    				dirty & /*$$restProps*/ 1 && /*$$restProps*/ ctx[0]
    			]));

    			toggle_class(svg, "bi", true);
    			toggle_class(svg, "bi-whatsapp", true);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	const omit_props_names = [];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Whatsapp', slots, ['default']);

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(0, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ('$$scope' in $$new_props) $$invalidate(1, $$scope = $$new_props.$$scope);
    	};

    	return [$$restProps, $$scope, slots];
    }

    class Whatsapp extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Whatsapp",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* src/components/Header.svelte generated by Svelte v3.55.1 */
    const file$8 = "src/components/Header.svelte";

    function create_fragment$8(ctx) {
    	let header;
    	let div3;
    	let nav;
    	let button;
    	let list;
    	let t0;
    	let ul;
    	let li0;
    	let a0;
    	let t2;
    	let li1;
    	let a1;
    	let t4;
    	let li2;
    	let a2;
    	let t6;
    	let li3;
    	let a3;
    	let ul_class_value;
    	let t8;
    	let div2;
    	let div0;
    	let img;
    	let img_src_value;
    	let t9;
    	let div1;
    	let p;
    	let current;
    	let mounted;
    	let dispose;

    	list = new List({
    			props: {
    				style: "color: white",
    				width: 36,
    				height: 36
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			header = element("header");
    			div3 = element("div");
    			nav = element("nav");
    			button = element("button");
    			create_component(list.$$.fragment);
    			t0 = space();
    			ul = element("ul");
    			li0 = element("li");
    			a0 = element("a");
    			a0.textContent = "Home";
    			t2 = space();
    			li1 = element("li");
    			a1 = element("a");
    			a1.textContent = "About Us";
    			t4 = space();
    			li2 = element("li");
    			a2 = element("a");
    			a2.textContent = "Features";
    			t6 = space();
    			li3 = element("li");
    			a3 = element("a");
    			a3.textContent = "Contact Us";
    			t8 = space();
    			div2 = element("div");
    			div0 = element("div");
    			img = element("img");
    			t9 = space();
    			div1 = element("div");
    			p = element("p");
    			p.textContent = "La tinto Mendez";
    			attr_dev(button, "class", "dropdown_toggle svelte-idnhy3");
    			attr_dev(button, "type", "button");
    			add_location(button, file$8, 17, 12, 472);
    			attr_dev(a0, "class", "dropdown_item svelte-idnhy3");
    			attr_dev(a0, "href", "#home");
    			add_location(a0, file$8, 31, 20, 1004);
    			add_location(li0, file$8, 31, 16, 1000);
    			attr_dev(a1, "class", "dropdown_item svelte-idnhy3");
    			attr_dev(a1, "href", "#about");
    			add_location(a1, file$8, 32, 20, 1076);
    			add_location(li1, file$8, 32, 16, 1072);
    			attr_dev(a2, "class", "dropdown_item svelte-idnhy3");
    			attr_dev(a2, "href", "#features");
    			add_location(a2, file$8, 33, 20, 1153);
    			add_location(li2, file$8, 33, 16, 1149);
    			attr_dev(a3, "class", "dropdown_item svelte-idnhy3");
    			attr_dev(a3, "href", "#contact");
    			add_location(a3, file$8, 34, 20, 1233);
    			add_location(li3, file$8, 34, 16, 1229);

    			attr_dev(ul, "class", ul_class_value = "dropdown_menu " + (/*dropdown_visible*/ ctx[0]
    			? 'dropdown_visible'
    			: 'dropdown_invisible') + " svelte-idnhy3");

    			add_location(ul, file$8, 24, 12, 711);
    			attr_dev(nav, "class", "svelte-idnhy3");
    			add_location(nav, file$8, 16, 8, 454);
    			if (!src_url_equal(img.src, img_src_value = "/static/logo.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "logo");
    			attr_dev(img, "class", "rounded svelte-idnhy3");
    			add_location(img, file$8, 40, 16, 1418);
    			attr_dev(div0, "class", "company-logo svelte-idnhy3");
    			add_location(div0, file$8, 39, 12, 1375);
    			attr_dev(p, "class", "svelte-idnhy3");
    			add_location(p, file$8, 43, 16, 1551);
    			attr_dev(div1, "class", "company-title svelte-idnhy3");
    			add_location(div1, file$8, 42, 12, 1507);
    			attr_dev(div2, "class", "company-name svelte-idnhy3");
    			add_location(div2, file$8, 38, 8, 1336);
    			attr_dev(div3, "class", "container-fluid svelte-idnhy3");
    			add_location(div3, file$8, 15, 4, 416);
    			attr_dev(header, "id", "header");
    			attr_dev(header, "class", "svelte-idnhy3");
    			add_location(header, file$8, 14, 0, 391);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, div3);
    			append_dev(div3, nav);
    			append_dev(nav, button);
    			mount_component(list, button, null);
    			append_dev(nav, t0);
    			append_dev(nav, ul);
    			append_dev(ul, li0);
    			append_dev(li0, a0);
    			append_dev(ul, t2);
    			append_dev(ul, li1);
    			append_dev(li1, a1);
    			append_dev(ul, t4);
    			append_dev(ul, li2);
    			append_dev(li2, a2);
    			append_dev(ul, t6);
    			append_dev(ul, li3);
    			append_dev(li3, a3);
    			append_dev(div3, t8);
    			append_dev(div3, div2);
    			append_dev(div2, div0);
    			append_dev(div0, img);
    			append_dev(div2, t9);
    			append_dev(div2, div1);
    			append_dev(div1, p);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*handleMouseClick*/ ctx[1], false, false, false),
    					listen_dev(ul, "click", /*handleBackgroundMouseClick*/ ctx[2], false, false, false),
    					listen_dev(ul, "keypress", /*handleBackgroundKeyboardClick*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*dropdown_visible*/ 1 && ul_class_value !== (ul_class_value = "dropdown_menu " + (/*dropdown_visible*/ ctx[0]
    			? 'dropdown_visible'
    			: 'dropdown_invisible') + " svelte-idnhy3")) {
    				attr_dev(ul, "class", ul_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(list.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(list.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			destroy_component(list);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Header', slots, []);
    	let dropdown_visible = false;

    	function handleMouseClick(event) {
    		$$invalidate(0, dropdown_visible = true);
    	}

    	function handleBackgroundMouseClick(event) {
    		$$invalidate(0, dropdown_visible = false);
    	}

    	function handleBackgroundKeyboardClick(event) {
    		if (event.key == "Escape") $$invalidate(0, dropdown_visible = false);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		List,
    		dropdown_visible,
    		handleMouseClick,
    		handleBackgroundMouseClick,
    		handleBackgroundKeyboardClick
    	});

    	$$self.$inject_state = $$props => {
    		if ('dropdown_visible' in $$props) $$invalidate(0, dropdown_visible = $$props.dropdown_visible);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		dropdown_visible,
    		handleMouseClick,
    		handleBackgroundMouseClick,
    		handleBackgroundKeyboardClick
    	];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src/components/HomeAnimation.svelte generated by Svelte v3.55.1 */

    const file$7 = "src/components/HomeAnimation.svelte";

    function create_fragment$7(ctx) {
    	let svg;
    	let g;
    	let path0;
    	let path1;
    	let path2;
    	let path3;
    	let path4;
    	let path5;
    	let path6;
    	let path7;
    	let path8;
    	let path9;
    	let path10;
    	let path11;
    	let path12;
    	let path13;
    	let path14;
    	let path15;
    	let path16;
    	let path17;
    	let path18;
    	let path19;
    	let path20;
    	let path21;
    	let path22;
    	let path23;
    	let path24;
    	let path25;
    	let path26;
    	let path27;
    	let path28;
    	let path29;
    	let path30;
    	let path31;
    	let path32;
    	let path33;
    	let path34;
    	let path35;
    	let path36;
    	let path37;
    	let path38;
    	let path39;
    	let path40;
    	let path41;
    	let path42;
    	let path43;
    	let path44;
    	let path45;
    	let path46;
    	let path47;
    	let path48;
    	let path49;
    	let path50;
    	let path51;
    	let path52;
    	let path53;
    	let path54;
    	let path55;
    	let path56;
    	let path57;
    	let path58;
    	let path59;
    	let path60;
    	let path61;
    	let path62;
    	let path63;
    	let path64;
    	let path65;
    	let path66;
    	let path67;
    	let path68;
    	let path69;
    	let path70;
    	let path71;
    	let path72;
    	let path73;
    	let path74;
    	let path75;
    	let path76;
    	let path77;
    	let path78;
    	let path79;
    	let path80;
    	let path81;
    	let path82;
    	let path83;
    	let path84;
    	let path85;
    	let path86;
    	let path87;
    	let path88;
    	let path89;
    	let path90;
    	let path91;
    	let path92;
    	let path93;
    	let path94;
    	let path95;
    	let path96;
    	let path97;
    	let path98;
    	let path99;
    	let path100;
    	let path101;
    	let path102;
    	let path103;
    	let path104;
    	let path105;
    	let path106;
    	let path107;
    	let path108;
    	let path109;
    	let path110;
    	let path111;
    	let path112;
    	let path113;
    	let path114;
    	let path115;
    	let path116;
    	let path117;
    	let path118;
    	let path119;
    	let path120;
    	let path121;
    	let path122;
    	let path123;
    	let path124;
    	let path125;
    	let path126;
    	let path127;
    	let path128;
    	let path129;
    	let path130;
    	let path131;
    	let path132;
    	let path133;
    	let path134;
    	let path135;
    	let path136;
    	let path137;
    	let path138;
    	let path139;
    	let path140;
    	let path141;
    	let path142;
    	let path143;
    	let path144;
    	let path145;
    	let path146;
    	let path147;
    	let path148;
    	let path149;
    	let path150;
    	let path151;
    	let path152;
    	let path153;
    	let path154;
    	let path155;
    	let path156;
    	let path157;
    	let path158;
    	let path159;
    	let path160;
    	let path161;
    	let path162;
    	let path163;
    	let path164;
    	let path165;
    	let path166;
    	let path167;
    	let path168;
    	let path169;
    	let path170;
    	let path171;
    	let path172;
    	let path173;
    	let path174;
    	let path175;
    	let path176;
    	let path177;
    	let path178;
    	let path179;
    	let path180;
    	let path181;
    	let path182;
    	let path183;
    	let path184;
    	let path185;
    	let path186;
    	let path187;
    	let path188;
    	let path189;
    	let path190;
    	let path191;
    	let path192;
    	let path193;
    	let path194;
    	let path195;
    	let path196;
    	let path197;
    	let path198;
    	let path199;
    	let path200;
    	let path201;
    	let path202;
    	let path203;
    	let path204;
    	let path205;
    	let path206;
    	let path207;
    	let path208;
    	let path209;
    	let path210;
    	let path211;
    	let path212;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			g = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			path5 = svg_element("path");
    			path6 = svg_element("path");
    			path7 = svg_element("path");
    			path8 = svg_element("path");
    			path9 = svg_element("path");
    			path10 = svg_element("path");
    			path11 = svg_element("path");
    			path12 = svg_element("path");
    			path13 = svg_element("path");
    			path14 = svg_element("path");
    			path15 = svg_element("path");
    			path16 = svg_element("path");
    			path17 = svg_element("path");
    			path18 = svg_element("path");
    			path19 = svg_element("path");
    			path20 = svg_element("path");
    			path21 = svg_element("path");
    			path22 = svg_element("path");
    			path23 = svg_element("path");
    			path24 = svg_element("path");
    			path25 = svg_element("path");
    			path26 = svg_element("path");
    			path27 = svg_element("path");
    			path28 = svg_element("path");
    			path29 = svg_element("path");
    			path30 = svg_element("path");
    			path31 = svg_element("path");
    			path32 = svg_element("path");
    			path33 = svg_element("path");
    			path34 = svg_element("path");
    			path35 = svg_element("path");
    			path36 = svg_element("path");
    			path37 = svg_element("path");
    			path38 = svg_element("path");
    			path39 = svg_element("path");
    			path40 = svg_element("path");
    			path41 = svg_element("path");
    			path42 = svg_element("path");
    			path43 = svg_element("path");
    			path44 = svg_element("path");
    			path45 = svg_element("path");
    			path46 = svg_element("path");
    			path47 = svg_element("path");
    			path48 = svg_element("path");
    			path49 = svg_element("path");
    			path50 = svg_element("path");
    			path51 = svg_element("path");
    			path52 = svg_element("path");
    			path53 = svg_element("path");
    			path54 = svg_element("path");
    			path55 = svg_element("path");
    			path56 = svg_element("path");
    			path57 = svg_element("path");
    			path58 = svg_element("path");
    			path59 = svg_element("path");
    			path60 = svg_element("path");
    			path61 = svg_element("path");
    			path62 = svg_element("path");
    			path63 = svg_element("path");
    			path64 = svg_element("path");
    			path65 = svg_element("path");
    			path66 = svg_element("path");
    			path67 = svg_element("path");
    			path68 = svg_element("path");
    			path69 = svg_element("path");
    			path70 = svg_element("path");
    			path71 = svg_element("path");
    			path72 = svg_element("path");
    			path73 = svg_element("path");
    			path74 = svg_element("path");
    			path75 = svg_element("path");
    			path76 = svg_element("path");
    			path77 = svg_element("path");
    			path78 = svg_element("path");
    			path79 = svg_element("path");
    			path80 = svg_element("path");
    			path81 = svg_element("path");
    			path82 = svg_element("path");
    			path83 = svg_element("path");
    			path84 = svg_element("path");
    			path85 = svg_element("path");
    			path86 = svg_element("path");
    			path87 = svg_element("path");
    			path88 = svg_element("path");
    			path89 = svg_element("path");
    			path90 = svg_element("path");
    			path91 = svg_element("path");
    			path92 = svg_element("path");
    			path93 = svg_element("path");
    			path94 = svg_element("path");
    			path95 = svg_element("path");
    			path96 = svg_element("path");
    			path97 = svg_element("path");
    			path98 = svg_element("path");
    			path99 = svg_element("path");
    			path100 = svg_element("path");
    			path101 = svg_element("path");
    			path102 = svg_element("path");
    			path103 = svg_element("path");
    			path104 = svg_element("path");
    			path105 = svg_element("path");
    			path106 = svg_element("path");
    			path107 = svg_element("path");
    			path108 = svg_element("path");
    			path109 = svg_element("path");
    			path110 = svg_element("path");
    			path111 = svg_element("path");
    			path112 = svg_element("path");
    			path113 = svg_element("path");
    			path114 = svg_element("path");
    			path115 = svg_element("path");
    			path116 = svg_element("path");
    			path117 = svg_element("path");
    			path118 = svg_element("path");
    			path119 = svg_element("path");
    			path120 = svg_element("path");
    			path121 = svg_element("path");
    			path122 = svg_element("path");
    			path123 = svg_element("path");
    			path124 = svg_element("path");
    			path125 = svg_element("path");
    			path126 = svg_element("path");
    			path127 = svg_element("path");
    			path128 = svg_element("path");
    			path129 = svg_element("path");
    			path130 = svg_element("path");
    			path131 = svg_element("path");
    			path132 = svg_element("path");
    			path133 = svg_element("path");
    			path134 = svg_element("path");
    			path135 = svg_element("path");
    			path136 = svg_element("path");
    			path137 = svg_element("path");
    			path138 = svg_element("path");
    			path139 = svg_element("path");
    			path140 = svg_element("path");
    			path141 = svg_element("path");
    			path142 = svg_element("path");
    			path143 = svg_element("path");
    			path144 = svg_element("path");
    			path145 = svg_element("path");
    			path146 = svg_element("path");
    			path147 = svg_element("path");
    			path148 = svg_element("path");
    			path149 = svg_element("path");
    			path150 = svg_element("path");
    			path151 = svg_element("path");
    			path152 = svg_element("path");
    			path153 = svg_element("path");
    			path154 = svg_element("path");
    			path155 = svg_element("path");
    			path156 = svg_element("path");
    			path157 = svg_element("path");
    			path158 = svg_element("path");
    			path159 = svg_element("path");
    			path160 = svg_element("path");
    			path161 = svg_element("path");
    			path162 = svg_element("path");
    			path163 = svg_element("path");
    			path164 = svg_element("path");
    			path165 = svg_element("path");
    			path166 = svg_element("path");
    			path167 = svg_element("path");
    			path168 = svg_element("path");
    			path169 = svg_element("path");
    			path170 = svg_element("path");
    			path171 = svg_element("path");
    			path172 = svg_element("path");
    			path173 = svg_element("path");
    			path174 = svg_element("path");
    			path175 = svg_element("path");
    			path176 = svg_element("path");
    			path177 = svg_element("path");
    			path178 = svg_element("path");
    			path179 = svg_element("path");
    			path180 = svg_element("path");
    			path181 = svg_element("path");
    			path182 = svg_element("path");
    			path183 = svg_element("path");
    			path184 = svg_element("path");
    			path185 = svg_element("path");
    			path186 = svg_element("path");
    			path187 = svg_element("path");
    			path188 = svg_element("path");
    			path189 = svg_element("path");
    			path190 = svg_element("path");
    			path191 = svg_element("path");
    			path192 = svg_element("path");
    			path193 = svg_element("path");
    			path194 = svg_element("path");
    			path195 = svg_element("path");
    			path196 = svg_element("path");
    			path197 = svg_element("path");
    			path198 = svg_element("path");
    			path199 = svg_element("path");
    			path200 = svg_element("path");
    			path201 = svg_element("path");
    			path202 = svg_element("path");
    			path203 = svg_element("path");
    			path204 = svg_element("path");
    			path205 = svg_element("path");
    			path206 = svg_element("path");
    			path207 = svg_element("path");
    			path208 = svg_element("path");
    			path209 = svg_element("path");
    			path210 = svg_element("path");
    			path211 = svg_element("path");
    			path212 = svg_element("path");
    			attr_dev(path0, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path0, "d", "M12745 13623 c-77 -2 -1011 -4 -2075 -6 l-1935 -2 -730 -123 c-401\n    -67 -908 -152 -1125 -188 -264 -43 -400 -70 -410 -80 -13 -13 -15 -172 -11\n    -1337 l4 -1321 -104 98 c-526 502 -1133 787 -1854 871 -185 22 -523 22 -710 0\n    -729 -84 -1387 -399 -1896 -905 -465 -463 -756 -1043 -855 -1705 -21 -144 -29\n    -494 -15 -651 63 -671 364 -1314 841 -1793 621 -626 1497 -958 2397 -910 589\n    31 1122 206 1605 529 180 119 309 224 480 389 l113 109 6 -87 c4 -47 7 -646 8\n    -1331 1 -685 4 -1289 8 -1342 l6 -98 36 -10 c42 -12 485 -68 1421 -179 371\n    -44 1445 -173 2385 -286 941 -113 1879 -226 2085 -250 206 -25 396 -48 421\n    -51 62 -8 51 -18 369 316 97 102 297 313 445 470 262 278 335 356 520 550 289\n    304 447 471 488 515 l47 50 1 1145 c4 4553 3 7495 -4 7553 l-9 67 -906 -2\n    c-499 -1 -970 -4 -1047 -5z m1665 -73 c-62 -21 -1279 -367 -1410 -401 -71 -18\n    -109 -22 -235 -20 -161 1 -1400 22 -2810 46 -478 8 -1142 19 -1475 25 -491 9\n    -1443 27 -1625 31 -39 1 -39 1 -10 9 17 5 347 61 735 125 388 64 800 133 915\n    153 l210 36 875 6 c481 3 1777 6 2880 7 1963 1 2004 1 1950 -17z m250 -85 c0\n    -52 -3 -95 -6 -95 -3 0 -42 26 -87 58 -44 31 -85 60 -91 64 -6 4 -8 10 -4 13\n    5 6 161 52 181 54 4 1 7 -42 7 -94z m-122 -61 l122 -85 0 -74 c0 -41 -3 -76\n    -7 -78 -9 -4 -396 259 -401 272 -2 7 123 48 154 50 5 1 65 -38 132 -85z m-113\n    -132 l230 -158 3 -78 c3 -94 9 -94 -120 2 -51 38 -176 131 -278 206 -102 76\n    -186 141 -188 146 -2 6 81 33 118 39 3 0 109 -71 235 -157z m-143 -88 c145\n    -108 289 -216 321 -240 l57 -44 0 -66 c0 -51 -3 -65 -13 -61 -8 3 -110 79\n    -228 169 -118 90 -226 173 -240 183 -15 11 -84 65 -155 120 l-128 99 54 17\n    c30 9 58 17 62 18 4 1 125 -87 270 -195z m-273 28 c84 -64 217 -166 296 -227\n    79 -60 191 -146 249 -190 l105 -80 1 -87 c0 -49 -2 -88 -4 -88 -8 0 -162 119\n    -177 136 -8 9 -16 51 -19 98 -4 62 -9 81 -20 84 -13 2 -15 -9 -12 -68 2 -38 1\n    -70 -3 -70 -4 0 -73 51 -153 113 -81 62 -159 122 -173 133 -15 10 -85 64 -155\n    119 -71 55 -155 120 -186 143 -32 24 -58 48 -58 52 0 9 112 48 140 49 8 1 84\n    -52 169 -117z m-137 -115 c122 -95 298 -231 391 -302 l167 -130 0 -87 c0 -57\n    -4 -88 -11 -88 -9 0 -200 145 -679 515 -63 49 -150 116 -192 149 -43 32 -78\n    62 -78 66 0 7 130 46 162 49 9 0 117 -77 240 -172z m-176 -103 c148 -114 298\n    -230 334 -258 55 -42 319 -248 381 -296 18 -14 19 -24 13 -98 -4 -45 -10 -82\n    -13 -82 -3 0 -157 117 -341 260 -184 144 -444 345 -576 448 -183 141 -238 189\n    -227 196 24 13 137 45 149 41 6 -2 132 -97 280 -211z m-5866 166 c327 -6 603\n    -13 613 -16 16 -5 17 -30 15 -392 l-3 -387 -115 2 c-381 8 -1774 61 -1807 69\n    l-23 6 0 371 0 370 363 -7 c199 -3 630 -11 957 -16z m1650 -30 c371 -6 916\n    -15 1210 -20 294 -5 821 -14 1170 -20 619 -9 1002 -19 1007 -24 2 -1 3 -299 3\n    -662 l1 -659 -25 -9 c-17 -6 -213 -4 -543 7 -1227 41 -1757 58 -2728 87 -566\n    17 -1035 33 -1041 35 -8 2 -13 190 -18 635 -6 523 -5 634 6 641 7 5 74 7 148\n    4 74 -3 439 -10 810 -15z m3841 -73 c193 -154 422 -332 724 -561 165 -126 317\n    -245 338 -264 37 -36 37 -37 37 -113 0 -43 -3 -80 -7 -82 -6 -4 -442 331 -818\n    627 -50 40 -375 297 -462 366 -45 36 -82 68 -82 71 -1 9 99 37 135 38 24 1 53\n    -17 135 -82z m-279 -4 c57 -40 378 -290 888 -693 168 -133 344 -271 393 -308\n    l87 -66 0 -78 c0 -43 -4 -78 -9 -78 -13 0 -144 102 -733 572 -299 239 -587\n    469 -640 511 -95 75 -98 79 -98 118 0 32 4 41 23 49 32 13 29 13 89 -27z m133\n    -302 c805 -640 1221 -975 1228 -987 4 -7 4 -47 0 -89 l-8 -75 -145 117 c-300\n    243 -557 451 -669 544 -128 105 -453 367 -573 463 l-77 61 -1 78 c0 60 3 76\n    13 71 6 -5 111 -87 232 -183z m170 -346 c209 -170 532 -432 718 -583 l337\n    -274 0 -83 c0 -46 -4 -86 -8 -89 -4 -2 -87 59 -184 137 -358 289 -559 452\n    -1037 840 -35 29 -104 85 -152 125 l-89 73 0 96 c0 91 1 95 18 81 9 -8 188\n    -154 397 -323z m1233 146 l82 -64 0 -94 c0 -73 -3 -93 -12 -87 -7 4 -53 39\n    -101 77 l-88 70 2 81 c1 44 4 84 6 89 6 10 12 5 111 -72z m-1474 -188 c93 -76\n    270 -219 392 -318 121 -99 297 -242 390 -317 437 -354 502 -408 505 -420 2 -7\n    2 -47 -1 -90 l-5 -76 -101 81 c-56 45 -121 98 -145 118 -24 20 -222 182 -439\n    359 -217 178 -413 338 -435 356 -22 18 -98 81 -170 140 -71 58 -139 112 -149\n    120 -17 11 -20 26 -20 99 -1 47 1 85 3 85 2 0 81 -62 175 -137z m1462 -39 c47\n    -37 88 -72 90 -79 3 -6 4 -49 2 -94 l-3 -83 -87 66 c-47 36 -92 74 -100 84\n    -15 22 -13 172 3 172 5 0 47 -30 95 -66z m-7959 -16 c40 -40 75 -70 77 -67 3\n    3 -15 31 -40 62 -25 32 -42 61 -40 66 14 22 66 -7 137 -75 109 -105 116 -101\n    22 12 -24 28 -40 54 -36 57 17 18 44 1 120 -75 45 -45 84 -80 87 -77 3 2 -20\n    33 -49 69 -30 36 -55 68 -55 71 0 10 34 17 52 10 9 -3 53 -41 98 -84 45 -44\n    84 -76 87 -73 3 3 -16 31 -43 63 -83 97 -81 93 -48 93 22 -1 52 -22 127 -91\n    55 -50 102 -88 105 -84 3 3 -26 38 -66 78 -40 40 -72 78 -72 85 0 7 13 12 29\n    12 20 0 45 -16 90 -57 155 -140 208 -166 81 -38 l-85 85 39 0 c33 0 48 -9 105\n    -58 124 -110 167 -122 61 -17 -32 32 -57 62 -54 67 16 26 60 2 176 -97 68 -58\n    127 -105 133 -105 5 0 -34 44 -88 98 l-99 97 47 3 c46 3 48 2 125 -71 43 -42\n    88 -81 101 -87 l24 -13 -25 29 c-13 16 -47 52 -74 81 -41 43 -47 53 -33 59 33\n    12 66 -7 163 -96 112 -101 146 -119 63 -32 -30 31 -68 72 -84 90 l-29 32 62 0\n    c61 0 61 0 129 -62 122 -112 127 -115 115 -93 -11 21 -29 42 -91 108 -35 37\n    -35 37 -10 37 16 0 61 -29 129 -85 58 -47 110 -85 115 -84 6 0 -27 35 -73 77\n    -45 42 -82 80 -82 85 0 4 17 7 37 7 29 0 52 -11 107 -53 157 -119 184 -128 71\n    -25 -41 36 -71 69 -68 72 17 17 58 2 101 -37 144 -131 199 -160 82 -42 -73 73\n    -74 75 -45 75 23 0 45 -14 88 -52 l57 -53 0 -167 0 -168 -97 0 c-262 -1 -1839\n    54 -1845 64 -10 14 -10 430 -1 439 11 12 16 9 90 -65z m1851 -37 l3 -33 -24\n    18 c-14 11 -30 27 -37 37 -10 17 -8 18 22 15 29 -3 33 -7 36 -37z m4832 -282\n    c309 -253 281 -230 716 -584 432 -351 384 -300 384 -412 0 -52 -4 -93 -9 -91\n    -7 2 -492 408 -795 665 -34 28 -195 164 -358 303 l-298 251 0 80 0 81 42 -34\n    c24 -18 167 -134 318 -259z m1283 97 l87 -67 0 -90 c0 -49 -2 -89 -5 -89 -8 0\n    -134 98 -172 134 -32 29 -33 33 -33 106 0 79 5 96 24 81 6 -4 50 -39 99 -75z\n    m-1353 -257 c140 -118 314 -264 385 -324 72 -60 200 -168 285 -240 85 -72 229\n    -193 320 -269 91 -76 169 -148 173 -160 9 -23 -1 -156 -12 -156 -4 0 -59 44\n    -122 98 -63 53 -167 140 -230 193 -63 53 -208 176 -324 274 -115 97 -244 205\n    -285 240 -41 35 -140 118 -220 185 -80 67 -172 149 -206 182 -61 59 -61 60\n    -58 111 2 29 3 65 4 81 0 27 1 28 18 14 9 -8 132 -111 272 -229z m1343 35 l97\n    -75 0 -81 c0 -65 -3 -79 -14 -75 -27 11 -194 148 -201 165 -7 19 4 142 14 142\n    3 0 50 -34 104 -76z m-7217 -19 c1355 -43 4322 -135 4929 -153 l580 -17 7 -40\n    c4 -22 7 -1969 7 -4327 1 -4077 0 -4288 -16 -4288 -17 0 -282 32 -2013 240\n    -415 50 -865 104 -1000 120 -135 16 -452 54 -705 85 -773 93 -1678 202 -2123\n    255 -233 27 -435 53 -448 56 l-24 6 0 577 c0 318 -3 969 -6 1447 l-7 869 46\n    58 45 58 6 -63 c3 -35 10 -207 16 -383 11 -330 25 -522 41 -559 6 -15 8 -4 4\n    34 -8 90 -24 578 -26 808 l-2 212 34 50 c31 46 35 48 41 28 3 -13 7 -102 8\n    -198 2 -96 6 -224 10 -285 6 -107 7 -104 11 90 2 110 2 257 0 327 -3 123 -2\n    129 23 173 15 25 31 45 36 45 6 0 10 -40 10 -92 0 -51 5 -100 10 -108 7 -10\n    10 32 10 128 l0 143 38 67 c21 37 60 117 87 179 34 76 53 109 61 103 6 -5 34\n    -56 64 -112 226 -437 420 -710 697 -978 307 -298 641 -507 1040 -650 51 -18\n    91 -36 88 -40 -2 -3 -54 -29 -114 -55 -61 -27 -108 -51 -106 -53 2 -3 58 18\n    124 47 66 28 128 51 139 51 23 0 242 -57 250 -64 6 -6 12 -4 -273 -122 -110\n    -46 -193 -84 -185 -84 8 0 87 30 175 66 88 36 202 81 254 100 l93 34 102 -15\n    c146 -23 435 -30 596 -16 337 30 657 119 940 261 353 177 634 412 949 793 102\n    124 130 152 169 168 85 36 312 154 312 162 0 4 -21 -4 -48 -17 -52 -26 -286\n    -126 -296 -126 -3 0 37 85 89 189 187 375 261 596 315 946 28 179 38 515 21\n    717 -47 557 -220 1057 -524 1513 -120 180 -215 294 -391 470 -243 242 -485\n    415 -791 566 -495 244 -997 335 -1535 278 -629 -67 -1270 -416 -1697 -924\n    -174 -207 -356 -513 -453 -760 -17 -44 -35 -84 -39 -88 -4 -4 -25 31 -47 79\n    -81 183 -193 362 -342 548 -35 44 -69 91 -76 105 -10 20 -15 176 -20 682 -4\n    360 -4 667 -1 682 5 17 14 27 25 27 10 0 372 -11 806 -25z m5787 -167 c106\n    -90 224 -190 262 -223 39 -33 169 -143 289 -245 121 -102 326 -276 457 -388\n    l239 -203 0 -74 c0 -41 -4 -76 -9 -80 -8 -5 -335 264 -542 445 -10 8 -215 184\n    -457 390 -331 282 -441 381 -444 400 -4 32 2 140 9 140 2 0 91 -73 196 -162z\n    m1398 -4 c133 -102 129 -96 129 -191 0 -52 -4 -83 -11 -83 -6 0 -33 19 -60 42\n    -47 40 -49 43 -50 97 l-1 56 -11 -42 c-5 -24 -14 -43 -19 -43 -6 0 -25 15 -43\n    33 -22 22 -32 40 -30 57 1 14 3 49 4 78 0 28 5 52 10 52 5 0 42 -25 82 -56z\n    m-1345 -260 c122 -104 295 -252 385 -329 90 -77 258 -220 374 -319 115 -98\n    237 -202 270 -230 33 -28 82 -71 108 -96 l48 -45 -3 -74 -3 -74 -130 112\n    c-133 116 -301 261 -550 476 -77 66 -194 167 -260 225 -128 111 -435 374 -472\n    406 -20 16 -23 28 -23 93 0 70 1 73 18 59 9 -9 116 -101 238 -204z m1299 65\n    c35 -31 35 -32 35 -113 0 -46 -3 -86 -6 -89 -4 -4 -24 7 -45 24 l-39 31 0 89\n    c0 50 4 89 10 89 5 0 25 -14 45 -31z m-4805 -112 c63 -61 186 -181 273 -264\n    86 -84 157 -154 157 -156 0 -3 -33 4 -72 13 -40 10 -107 23 -148 30 l-75 13\n    -232 231 c-128 127 -233 234 -233 238 0 5 48 8 108 8 l107 0 115 -113z m159\n    92 c62 -8 81 -15 115 -43 38 -30 308 -280 661 -610 155 -145 247 -231 345\n    -322 36 -33 108 -100 160 -149 52 -49 122 -114 155 -145 33 -30 152 -141 265\n    -246 113 -104 219 -202 235 -218 17 -15 135 -125 263 -244 263 -244 240 -209\n    286 -437 34 -169 41 -218 28 -214 -5 2 -144 134 -309 294 -164 159 -336 326\n    -382 370 -101 97 -114 116 -229 327 -148 273 -239 398 -421 578 -218 216 -452\n    370 -730 480 -82 33 -88 37 -275 221 -105 102 -233 226 -283 274 -51 49 -93\n    92 -93 97 0 9 75 4 209 -13z m-322 -211 c123 -122 223 -225 223 -228 0 -3 -53\n    -4 -117 -2 l-118 3 -120 122 c-207 210 -289 297 -283 302 6 7 110 22 157 24\n    33 1 50 -14 258 -221z m-270 -15 c111 -114 201 -208 199 -210 -9 -9 -223 -30\n    -236 -23 -9 5 -36 30 -60 57 -24 26 -104 111 -177 187 -74 77 -130 143 -126\n    147 7 7 152 44 188 48 6 1 101 -92 212 -206z m884 172 c163 -42 262 -76 300\n    -104 43 -31 99 -82 314 -285 87 -83 195 -185 239 -226 44 -41 116 -109 161\n    -151 131 -124 650 -604 798 -739 122 -111 142 -133 171 -195 42 -88 128 -324\n    123 -338 -4 -13 -1 -15 -482 428 -779 719 -1727 1604 -1740 1625 -9 15 6 13\n    116 -15z m3025 -160 c108 -93 214 -183 233 -200 39 -33 741 -641 888 -769 l93\n    -81 0 -78 c0 -60 -3 -76 -12 -71 -7 5 -200 168 -428 363 -228 195 -523 447\n    -655 560 -132 112 -264 227 -292 255 l-53 50 0 79 c0 64 3 77 14 70 8 -4 103\n    -84 212 -178z m1455 133 l49 -41 0 -89 c0 -48 -3 -88 -6 -88 -4 0 -28 16 -54\n    35 -53 39 -60 58 -60 161 0 39 4 64 11 64 6 0 33 -19 60 -42z m-5690 -130\n    c211 -223 242 -259 233 -267 -13 -11 -157 -44 -175 -40 -17 4 -359 363 -359\n    377 0 7 140 59 165 61 6 1 67 -59 136 -131z m-251 -45 c182 -187 260 -271 260\n    -280 0 -11 -148 -74 -170 -72 -13 1 -99 90 -303 315 l-59 64 74 35 c40 18 80\n    34 88 34 9 1 58 -43 110 -96z m5817 38 c33 -26 33 -27 33 -113 0 -49 -3 -88\n    -6 -88 -3 0 -24 14 -45 31 l-39 31 0 89 c0 98 -2 96 57 50z m-3789 -45 c450\n    -226 799 -524 1109 -951 98 -135 218 -336 211 -355 -2 -4 -95 78 -208 184\n    -113 105 -323 299 -465 431 -143 131 -289 267 -325 300 -36 34 -99 93 -140\n    130 -180 165 -340 319 -340 326 0 12 30 -1 158 -65z m-2296 -25 c18 -21 98\n    -107 177 -190 l144 -153 -78 -44 c-45 -26 -85 -42 -94 -38 -9 3 -91 87 -183\n    187 -131 143 -164 185 -155 194 13 13 137 82 149 83 3 0 21 -17 40 -39z m5256\n    -575 c759 -650 722 -614 722 -708 0 -46 -7 -44 -89 29 -50 45 -54 52 -61 108\n    l-7 60 -2 -47 c0 -27 -4 -48 -7 -48 -7 0 -66 50 -508 425 -175 148 -337 286\n    -361 305 -245 203 -414 354 -417 373 -5 37 3 118 12 115 5 -2 328 -277 718\n    -612z m955 543 l47 -41 0 -84 c0 -46 -4 -84 -8 -84 -5 0 -30 16 -55 36 l-47\n    37 0 88 c0 49 3 89 8 89 4 0 28 -18 55 -41z m-6282 -216 c90 -97 170 -184 177\n    -194 11 -16 3 -24 -64 -73 -42 -31 -80 -56 -84 -56 -4 0 -87 86 -185 191 -154\n    166 -175 193 -163 206 17 16 140 102 149 102 3 1 79 -79 170 -176z m6156 88\n    l33 -26 0 -98 c0 -109 -1 -110 -67 -48 -32 29 -33 32 -33 114 0 46 3 87 6 90\n    8 8 17 3 61 -32z m-1392 -124 c77 -66 223 -190 325 -275 102 -86 244 -206 315\n    -267 72 -61 175 -149 230 -195 55 -46 137 -117 183 -158 l82 -74 0 -79 c0 -43\n    -3 -79 -7 -79 -5 0 -82 63 -172 141 -90 77 -261 222 -379 322 -445 377 -716\n    613 -732 637 -20 30 -17 166 3 153 6 -4 74 -60 152 -126z m-4948 -118 c98\n    -104 179 -193 179 -197 1 -4 -29 -35 -66 -70 l-68 -63 -183 197 c-101 108\n    -184 202 -184 208 0 10 124 115 137 116 4 0 87 -86 185 -191z m6464 140 l49\n    -41 0 -99 c0 -54 -3 -99 -6 -99 -3 0 -27 19 -55 43 l-49 42 0 98 c0 53 3 97 6\n    97 3 0 28 -18 55 -41z m-6620 -306 c93 -99 169 -185 169 -190 0 -11 -107 -137\n    -120 -141 -9 -3 -49 37 -264 272 l-128 139 68 68 c65 66 69 68 87 51 11 -9 95\n    -99 188 -199z m-2020 160 c313 -246 399 -328 530 -503 132 -177 220 -331 273\n    -478 26 -73 34 -125 17 -106 -5 5 -29 59 -54 119 -127 311 -365 621 -658 857\n    -113 91 -187 157 -176 158 4 0 35 -21 68 -47z m7115 -84 c66 -57 253 -216 414\n    -354 161 -137 390 -333 509 -435 l216 -185 3 -83 c2 -45 -1 -82 -5 -82 -7 0\n    -121 96 -528 445 -66 57 -174 150 -241 207 -66 56 -195 166 -285 243 -243 208\n    -238 202 -240 255 -1 25 -1 63 0 84 1 36 2 38 19 24 9 -8 71 -62 138 -119z\n    m1393 91 l44 -40 -1 -81 c-1 -45 -4 -84 -7 -87 -2 -3 -25 12 -50 32 l-45 37 0\n    90 c0 49 3 89 8 89 4 -1 27 -19 51 -40z m132 -112 l49 -41 0 -89 c0 -48 -3\n    -88 -7 -88 -15 1 -102 85 -104 100 -4 35 1 160 7 160 3 0 28 -19 55 -42z\n    m-5102 -50 c39 -34 67 -65 63 -69 -4 -4 -23 -10 -42 -14 -32 -5 -41 0 -113 60\n    -42 37 -75 70 -72 76 4 5 26 9 50 9 39 0 51 -6 114 -62z m199 10 c35 -28 59\n    -54 55 -58 -4 -4 -38 -10 -75 -14 l-67 -6 -58 51 c-32 28 -65 58 -73 65 -12\n    12 -2 14 70 14 l85 0 63 -52z m-5313 27 c439 -55 817 -237 1143 -549 286 -275\n    472 -617 557 -1026 33 -155 45 -449 26 -607 -88 -711 -535 -1327 -1187 -1634\n    -137 -65 -307 -121 -464 -154 -153 -32 -463 -45 -626 -26 -312 37 -640 153\n    -871 308 -330 222 -595 542 -736 888 -224 548 -207 1119 47 1640 247 507 685\n    893 1211 1068 297 98 602 129 900 92z m657 -42 c149 -63 217 -103 363 -210\n    216 -160 442 -417 559 -637 64 -121 38 -104 -52 34 -248 380 -493 601 -878\n    795 -82 41 -144 74 -137 75 6 0 71 -26 145 -57z m4307 3 c37 -30 75 -64 85\n    -75 17 -19 17 -20 -23 -32 -37 -11 -43 -10 -78 14 -21 14 -63 48 -93 75 l-55\n    50 35 10 c56 16 59 15 129 -42z m444 45 c34 -8 124 -75 126 -93 1 -11 -58 -10\n    -99 2 -19 6 -57 31 -85 55 l-50 45 35 0 c19 0 52 -4 73 -9z m-4403 -71 c124\n    -71 228 -149 265 -197 54 -71 42 -71 -35 0 -38 35 -133 108 -210 162 -77 53\n    -140 99 -140 102 0 3 10 -1 23 -9 12 -8 56 -34 97 -58z m2311 -18 c111 -116\n    271 -290 288 -314 11 -17 9 -26 -23 -74 -43 -64 -42 -64 -131 37 -33 37 -118\n    128 -188 203 l-129 135 43 51 c23 27 45 50 49 50 4 0 45 -39 91 -88z m1542 -4\n    c47 -40 86 -76 86 -79 1 -3 -18 -13 -41 -22 -45 -18 -44 -19 -99 33 -9 8 -42\n    35 -73 59 -60 47 -65 61 -25 72 51 15 67 8 152 -63z m788 37 c47 -16 126 -83\n    84 -72 -11 3 -42 8 -70 12 -60 8 -91 23 -128 63 l-29 30 49 -9 c26 -5 69 -16\n    94 -24z m-948 -51 c31 -25 57 -49 57 -52 0 -4 -16 -17 -36 -30 l-36 -23 -61\n    53 c-78 67 -81 70 -54 85 40 22 70 14 130 -33z m4182 -245 c171 -146 427 -364\n    570 -484 143 -121 290 -249 328 -285 l67 -66 0 -72 c0 -40 -4 -72 -8 -72 -5 0\n    -62 46 -128 103 -516 445 -553 477 -885 762 -96 82 -200 174 -231 204 l-58 54\n    0 75 c0 71 1 74 18 60 9 -8 157 -134 327 -279z m1209 234 l36 -32 0 -86 c0\n    -47 -3 -85 -6 -85 -3 0 -27 19 -55 43 l-49 42 0 76 c0 103 3 104 74 42z\n    m-5504 -38 c36 -31 66 -60 68 -64 4 -10 -46 -51 -62 -51 -13 0 -156 128 -156\n    139 0 8 47 28 70 30 8 0 44 -24 80 -54z m1269 20 c41 -20 72 -37 69 -40 -8 -8\n    -119 32 -146 53 -42 33 -6 27 77 -13z m-3947 -192 c39 -45 90 -108 114 -140\n    48 -64 120 -193 107 -193 -4 0 -28 31 -53 68 -71 105 -165 228 -261 339 -49\n    56 -89 106 -89 110 0 12 104 -93 182 -184z m1411 -22 c108 -115 197 -215 197\n    -222 0 -11 -78 -159 -84 -159 -3 0 -94 101 -324 359 -58 65 -91 109 -87 119 9\n    24 79 111 90 112 6 0 99 -94 208 -209z m1130 158 c127 -101 130 -106 79 -133\n    -27 -14 -30 -12 -116 61 l-88 75 29 19 c15 10 32 19 36 19 4 0 31 -19 60 -41z\n    m1023 30 c3 -6 -3 -20 -15 -32 l-21 -21 -45 22 c-25 12 -45 26 -45 32 0 14\n    117 13 126 -1z m226 -15 c9 -2 128 -66 265 -140 136 -75 280 -154 319 -175\n    218 -119 230 -127 272 -179 24 -28 41 -54 39 -57 -3 -2 -171 87 -373 198 -203\n    111 -435 238 -516 282 -82 44 -148 84 -148 87 0 7 110 -6 142 -16z m-369 -20\n    c70 -37 75 -42 55 -62 -15 -15 -3 -15 21 0 16 10 51 -7 242 -111 123 -68 228\n    -127 233 -132 11 -10 -9 -59 -24 -59 -14 0 -473 249 -485 263 -5 7 -18 13 -28\n    15 -31 5 -188 95 -180 103 8 8 42 15 78 18 12 0 51 -15 88 -35z m-521 1 l29\n    -25 -46 -22 -45 -22 -21 20 -20 21 31 27 c17 14 34 26 37 26 3 0 18 -11 35\n    -25z m896 -90 c97 -53 188 -104 201 -114 21 -16 22 -20 9 -44 l-13 -27 -220\n    120 c-121 66 -221 124 -223 130 -6 16 30 41 51 36 9 -2 97 -48 195 -101z\n    m4504 68 c24 -21 46 -42 50 -48 9 -12 11 -175 2 -175 -3 0 -30 21 -60 46 l-54\n    46 0 84 c0 49 4 84 10 84 5 0 29 -17 52 -37z m-4995 -40 c98 -54 102 -57 87\n    -75 -10 -10 -24 -18 -32 -18 -13 0 -201 100 -229 123 -20 15 -5 27 34 27 25 0\n    68 -17 140 -57z m-822 -24 c71 -59 84 -73 74 -85 -34 -41 -46 -38 -139 37 -50\n    40 -90 77 -90 82 0 14 32 36 52 37 9 0 55 -32 103 -71z m710 -20 c71 -39 132\n    -73 134 -75 3 -3 -4 -13 -15 -24 -22 -23 -15 -25 -218 88 -96 53 -98 55 -75\n    68 13 7 28 13 34 14 5 0 68 -32 140 -71z m882 40 c140 -55 397 -208 380 -225\n    -3 -3 -29 7 -59 22 -59 30 -411 224 -417 230 -12 12 27 1 96 -27z m-1267 -9\n    c0 -6 -14 -19 -32 -30 -25 -15 -36 -17 -52 -8 -19 11 -19 12 13 39 27 22 38\n    26 53 18 10 -5 18 -14 18 -19z m-402 -84 l83 -69 -23 -24 c-48 -51 -51 -51\n    -153 34 -51 43 -94 83 -94 89 -1 6 16 23 36 37 30 21 40 24 52 14 9 -6 53 -43\n    99 -81z m4331 2 c53 -45 135 -116 182 -158 47 -41 127 -111 178 -155 52 -44\n    182 -157 290 -250 108 -94 276 -239 374 -323 l177 -154 0 -62 c0 -35 -3 -65\n    -6 -69 -3 -3 -59 40 -123 96 -65 56 -214 185 -331 287 -117 102 -356 310 -532\n    463 l-318 277 0 65 c0 36 3 65 6 65 3 0 49 -37 103 -82z m-3634 -4 c77 -42\n    144 -80 149 -85 13 -12 -13 -39 -37 -39 -18 0 -232 111 -306 159 -22 14 -22\n    15 -5 28 31 23 55 15 199 -63z m5068 21 c40 -38 47 -50 47 -83 0 -52 -11 -104\n    -21 -100 -4 2 -28 22 -53 46 -34 31 -45 49 -42 65 3 12 5 43 5 70 1 26 4 47 9\n    47 4 0 28 -20 55 -45z m-8176 -157 c25 -36 43 -72 41 -79 -2 -7 -24 16 -48 51\n    -24 36 -70 101 -102 145 l-59 80 61 -65 c33 -36 81 -95 107 -132z m1346 -90\n    c90 -101 157 -185 157 -196 0 -11 -17 -59 -37 -108 l-36 -87 -28 33 c-15 18\n    -29 45 -31 59 -2 18 -13 31 -38 42 -33 16 -324 328 -344 369 -6 13 2 34 29 76\n    66 105 62 103 120 42 28 -29 121 -133 208 -230z m1367 248 c0 -20 -60 -50 -73\n    -37 -9 9 -4 18 18 35 29 24 55 24 55 2z m310 -84 c149 -83 183 -114 135 -119\n    -16 -2 -197 93 -329 173 -23 14 -13 34 17 33 12 0 92 -39 177 -87z m659 -38\n    c130 -70 244 -132 253 -138 18 -10 16 -40 -2 -60 -7 -7 -381 190 -508 266 -32\n    19 -32 21 -16 39 9 11 22 19 27 19 6 0 116 -57 246 -126z m-1375 21 c47 -38\n    86 -75 86 -81 0 -6 -11 -21 -24 -33 -20 -19 -28 -21 -45 -12 -25 14 -26 20 -5\n    49 18 26 8 29 -18 6 -17 -16 -20 -15 -55 10 -21 15 -56 42 -77 61 l-40 35 29\n    30 c33 34 18 41 149 -65z m312 43 c10 -16 -45 -63 -59 -49 -8 8 -4 18 13 36\n    26 28 35 31 46 13z m328 -78 c183 -103 185 -104 166 -124 -14 -14 -30 -8 -160\n    65 -156 88 -180 105 -180 126 0 25 33 13 174 -67z m698 -77 c226 -124 268\n    -151 268 -170 0 -12 -4 -24 -9 -27 -9 -6 -533 275 -560 300 -12 11 -12 16 -1\n    28 7 9 17 16 23 16 6 0 132 -66 279 -147z m4686 80 c33 -28 33 -29 30 -107\n    l-3 -79 -62 52 c-68 57 -72 69 -57 163 l7 38 26 -20 c14 -11 41 -32 59 -47z\n    m-11958 44 c0 -1 -37 -40 -82 -87 -44 -47 -107 -117 -139 -157 -185 -232 -362\n    -623 -438 -969 -42 -190 -52 -275 -52 -439 1 -166 19 -281 91 -575 27 -112 50\n    -211 49 -220 0 -25 -97 306 -124 425 -84 380 -53 716 107 1160 101 279 250\n    533 432 738 70 78 156 147 156 124z m5812 -65 l68 -54 -32 -44 c-17 -24 -36\n    -44 -41 -44 -10 0 -143 106 -153 121 -7 13 67 90 80 82 6 -3 41 -31 78 -61z\n    m501 26 c-9 -24 -17 -44 -19 -46 -1 -2 -14 3 -29 11 l-27 14 43 31 c24 18 44\n    32 46 32 2 0 -5 -19 -14 -42z m1709 -148 c182 -100 339 -187 350 -194 25 -18\n    81 -106 67 -106 -6 0 -113 56 -238 124 -124 68 -293 161 -376 206 -82 45 -154\n    86 -159 90 -11 11 1 60 15 60 5 0 159 -81 341 -180z m-1856 148 c8 -13 -49\n    -68 -71 -68 -25 0 -17 22 18 51 36 32 43 34 53 17z m4249 -118 c66 -58 346\n    -302 622 -543 276 -240 509 -444 517 -453 16 -15 23 -123 10 -137 -5 -4 -408\n    335 -619 522 -23 20 -67 59 -100 86 -33 28 -116 100 -186 160 -69 61 -187 162\n    -262 225 l-135 115 -1 79 c-1 73 0 78 17 65 9 -8 71 -61 137 -119z m-3891 46\n    c72 -41 139 -81 150 -89 18 -13 18 -14 -4 -35 -19 -17 -27 -19 -44 -10 -24 12\n    -259 149 -265 154 -8 7 10 54 20 54 6 0 71 -33 143 -74z m706 -94 c260 -144\n    285 -160 282 -182 -1 -14 -6 -28 -10 -32 -4 -4 -113 52 -242 123 -392 217\n    -380 209 -369 231 5 10 20 18 32 18 12 0 150 -71 307 -158z m4610 -16 c0 -40\n    -3 -75 -6 -79 -4 -3 -28 13 -55 36 l-49 42 0 71 c0 39 3 74 6 77 4 4 29 -12\n    55 -34 l49 -41 0 -72z m-7119 -4 c68 -75 129 -144 136 -153 12 -15 1 -16 -130\n    -14 l-144 2 -44 47 c-60 66 -62 71 -43 108 48 95 87 157 94 153 5 -3 64 -67\n    131 -143z m1515 132 c-1 -12 27 -39 41 -39 1 0 -9 -45 -23 -100 -38 -159 -55\n    -296 -55 -456 0 -124 6 -204 34 -444 1 -15 -4 -19 -23 -20 -18 0 -26 -6 -28\n    -21 -4 -26 22 -38 38 -18 21 24 26 17 38 -49 17 -89 74 -274 126 -403 210\n    -525 556 -939 951 -1137 169 -84 397 -129 559 -110 89 11 87 2 -13 -43 -64\n    -29 -61 -29 -61 -5 0 24 -13 33 -35 25 -13 -5 -15 -14 -11 -36 5 -26 2 -31\n    -29 -44 -43 -18 -222 -62 -287 -70 -40 -5 -48 -4 -48 9 0 9 -7 23 -16 32 -19\n    19 -44 4 -44 -25 0 -28 -89 -38 -129 -14 -25 14 -32 15 -45 5 -24 -20 -103 -5\n    -128 25 -25 28 -35 30 -59 8 -28 -25 -102 -11 -141 27 -32 30 -52 36 -63 19\n    -10 -16 -37 1 -32 22 6 20 -16 48 -37 48 -7 0 -19 11 -26 24 -26 50 -65 43\n    -57 -10 3 -19 3 -34 0 -34 -16 0 -125 66 -133 80 -5 10 -23 20 -41 24 -27 5\n    -30 9 -25 30 3 14 3 32 0 40 -8 21 -54 21 -54 1 0 -8 -3 -15 -7 -15 -17 0\n    -103 83 -103 99 0 9 -5 22 -12 29 -9 9 -8 12 4 12 22 0 40 24 32 44 -10 25\n    -47 16 -54 -13 -5 -21 -7 -22 -19 -7 -7 9 -24 16 -37 16 -20 0 -24 5 -24 28 0\n    34 -16 52 -47 52 -25 0 -29 10 -13 26 8 8 7 19 -2 38 -10 23 -17 27 -39 22\n    -34 -7 -57 15 -34 34 17 14 19 29 6 49 -8 12 -15 13 -35 3 -34 -15 -47 5 -16\n    28 16 12 20 23 16 38 -9 29 -34 35 -48 12 -9 -14 -16 -16 -25 -8 -19 15 -16\n    28 6 28 25 0 33 33 14 59 -19 27 -37 27 -50 -1 -9 -21 -14 -15 -50 62 -40 84\n    -109 286 -133 388 -12 50 -11 55 9 74 16 14 21 29 19 51 -3 28 -6 32 -30 30\n    -33 -2 -39 22 -8 30 29 7 26 45 -5 59 -14 6 -25 14 -25 17 0 9 56 32 72 30 28\n    -3 38 2 38 21 0 25 -25 37 -44 21 -8 -7 -25 -9 -40 -5 -20 5 -26 12 -26 34 0\n    15 7 33 15 40 19 16 19 34 -1 51 -13 11 -15 26 -9 93 8 87 18 116 39 116 22 0\n    26 26 8 51 -18 27 -18 35 5 129 17 71 72 230 80 230 2 0 13 -4 23 -10 13 -7\n    21 -6 30 5 15 18 6 45 -15 45 -25 0 -7 48 62 163 25 42 38 56 46 48 17 -17 44\n    -13 51 6 4 11 1 22 -8 29 -9 6 -16 16 -16 22 0 25 225 272 248 272 5 0 9 -7 8\n    -16z m1654 -137 c464 -251 463 -250 487 -298 12 -24 20 -45 19 -46 -3 -3 -759\n    400 -774 412 -1 1 3 16 9 33 10 28 13 31 32 21 12 -7 114 -61 227 -122z\n    m-2172 51 c76 -62 76 -63 39 -112 -13 -18 -16 -17 -68 22 -30 22 -69 53 -87\n    69 l-32 28 26 33 c29 37 24 38 122 -40z m357 52 c3 -5 -7 -23 -22 -40 -20 -21\n    -32 -27 -42 -21 -12 7 -10 15 10 39 25 32 43 39 54 22z m839 -16 c25 -14 46\n    -30 46 -35 0 -5 8 -9 17 -9 16 0 426 -222 485 -262 18 -13 25 -24 21 -38 -3\n    -11 -10 -20 -15 -20 -5 0 -60 29 -121 64 -62 35 -159 89 -217 121 -58 32 -118\n    67 -133 78 -16 11 -54 32 -85 47 -74 36 -97 54 -88 68 11 19 40 14 90 -14z\n    m-437 -55 c68 -40 126 -76 129 -81 4 -6 -4 -21 -18 -34 l-24 -25 -118 67 c-65\n    37 -120 73 -122 79 -6 13 12 65 22 65 4 0 63 -32 131 -71z m-537 36 c10 -12 5\n    -23 -25 -59 -31 -38 -40 -44 -56 -35 -26 13 -24 25 12 70 33 42 49 48 69 24z\n    m960 -80 c0 -27 -30 -29 -73 -5 -62 34 -73 46 -58 64 11 14 20 12 72 -14 33\n    -17 59 -37 59 -45z m5033 12 l58 -52 -3 -78 -3 -78 -67 56 c-62 51 -68 60 -68\n    93 0 48 11 112 19 112 3 -1 32 -24 64 -53z m-5933 11 c0 -17 -61 -88 -76 -88\n    -24 0 -16 24 22 68 33 39 54 47 54 20z m2055 -215 c394 -211 371 -196 391\n    -249 9 -24 15 -46 13 -49 -3 -2 -146 74 -319 169 -246 135 -316 177 -318 194\n    -3 17 -7 19 -20 11 -13 -8 -35 0 -102 36 -109 60 -114 64 -100 99 l10 28 88\n    -48 c48 -26 209 -112 357 -191z m-2429 172 c97 -75 99 -77 80 -112 -33 -60\n    -28 -60 -120 11 -47 37 -88 71 -90 75 -5 8 43 81 52 81 3 0 38 -25 78 -55z\n    m1214 -41 c0 -6 -9 -19 -19 -29 -19 -16 -22 -16 -81 20 l-61 37 22 24 22 24\n    59 -32 c32 -18 58 -38 58 -44z m3675 -140 c324 -279 637 -549 834 -719 95 -82\n    184 -159 198 -170 22 -18 24 -26 21 -90 l-3 -69 -315 278 c-173 154 -463 410\n    -644 570 -181 160 -332 293 -336 296 -8 5 -13 60 -11 104 1 17 3 18 19 4 9 -8\n    116 -100 237 -204z m-4090 147 c76 -45 100 -64 100 -80 0 -24 3 -26 32 -17 15\n    5 38 -3 77 -24 67 -38 71 -43 48 -63 -18 -16 -40 -6 -299 147 -77 45 -97 69\n    -76 89 10 11 11 10 118 -52z m770 -99 c143 -81 261 -154 262 -162 5 -27 -14\n    -46 -34 -34 -10 6 -126 73 -258 149 -132 75 -246 143 -254 150 -16 15 -8 45\n    11 45 7 -1 130 -67 273 -148z m-1361 122 c22 -9 20 -34 -7 -67 -22 -28 -23\n    -28 -39 -10 -16 17 -16 20 4 51 22 36 20 34 42 26z m5997 -128 c2 -46 2 -48 8\n    -16 8 45 19 42 93 -22 l58 -50 0 -59 c0 -32 -4 -59 -10 -59 -5 0 -60 43 -122\n    97 -120 103 -129 117 -119 200 l3 33 44 -36 c41 -34 44 -40 45 -88z m-4056 -2\n    c19 -14 13 -54 -9 -54 -7 0 -37 15 -67 33 -30 18 -68 39 -86 46 -43 18 -53 31\n    -42 59 l9 23 89 -47 c48 -26 96 -53 106 -60z m-1059 65 c59 -33 65 -46 34 -74\n    -23 -20 -36 -17 -111 30 l-41 27 23 24 c12 13 27 24 32 24 5 0 34 -14 63 -31z\n    m-2160 -84 c-3 -5 -21 -48 -40 -95 -19 -47 -39 -86 -43 -87 -4 -1 -27 21 -50\n    48 l-43 49 19 48 c11 26 29 69 40 96 l22 49 50 -49 c27 -27 47 -53 45 -59z\n    m1017 26 c81 -65 90 -83 59 -121 l-18 -22 -92 73 c-51 40 -92 77 -92 82 0 21\n    42 68 53 59 7 -5 47 -37 90 -71z m333 65 c3 -7 -5 -30 -17 -50 -19 -33 -24\n    -36 -37 -23 -13 14 -12 19 7 51 24 38 38 45 47 22z m997 -2 c49 -25 447 -253\n    490 -280 36 -24 45 -46 28 -73 -7 -11 -24 -5 -87 30 -117 64 -488 280 -498\n    290 -6 5 -2 17 9 29 22 24 18 24 58 4z m-460 -74 c76 -44 152 -89 168 -101 29\n    -20 29 -22 13 -40 -9 -10 -22 -19 -28 -19 -26 2 -311 176 -314 193 -4 22 4 47\n    15 47 5 0 71 -36 146 -80z m5206 28 l61 -51 0 -84 c0 -45 -3 -83 -7 -83 -5 0\n    -34 24 -65 53 l-57 52 -3 83 c-2 45 0 82 3 82 4 0 34 -23 68 -52z m-5870 -2\n    c17 -20 -23 -99 -47 -94 -25 5 -26 34 -2 73 24 39 32 42 49 21z m1873 -57\n    c114 -63 121 -69 113 -102 -7 -24 -9 -25 -34 -14 -57 25 -191 102 -195 112 -4\n    11 11 55 19 55 3 0 47 -23 97 -51z m2713 -39 c28 -25 82 -72 120 -106 39 -33\n    167 -146 285 -250 118 -104 325 -286 460 -405 135 -119 266 -237 293 -264 47\n    -48 47 -48 47 -117 l0 -70 -24 19 c-13 10 -104 90 -202 178 -97 88 -241 217\n    -318 286 -633 565 -762 683 -768 705 -3 13 -5 32 -3 41 2 10 4 31 4 47 l1 30\n    28 -25 c15 -14 50 -45 77 -69z m-3309 -59 c131 -76 262 -152 289 -168 36 -21\n    51 -36 53 -54 5 -47 -10 -52 -64 -22 -135 74 -551 317 -563 329 -13 12 -12 16\n    4 34 10 11 23 20 30 20 6 0 119 -62 251 -139z m-1228 50 c-25 -44 -26 -45 -46\n    -32 -11 7 -11 14 3 42 29 56 36 62 53 46 12 -13 11 -20 -10 -56z m-360 19 c28\n    -21 52 -43 55 -47 6 -10 -30 -93 -40 -93 -4 0 -34 20 -65 45 l-58 45 22 45\n    c12 25 25 45 29 45 4 0 30 -18 57 -40z m989 -62 c57 -33 106 -64 109 -70 3 -5\n    -1 -17 -11 -28 -15 -17 -21 -15 -138 52 -144 83 -158 95 -151 125 l6 22 42\n    -21 c22 -11 87 -47 143 -80z m1683 -73 c118 -64 223 -126 233 -137 17 -20 24\n    -58 10 -58 -23 0 -568 311 -571 325 -2 9 -1 23 2 31 5 13 15 11 58 -14 29 -16\n    150 -82 268 -147z m-3383 144 c10 -7 44 -36 76 -63 51 -43 58 -53 52 -75 -4\n    -14 -9 -28 -11 -30 -5 -6 -184 170 -184 180 0 12 48 3 67 -12z m-4 -95 c65\n    -58 117 -110 117 -117 0 -7 -4 -18 -9 -26 -7 -11 -39 11 -140 94 -72 59 -131\n    113 -131 119 0 15 21 36 35 36 7 0 64 -47 128 -106z m150 78 c15 -15 16 -23 7\n    -46 l-10 -28 -50 42 c-27 23 -53 47 -57 52 -11 19 90 0 110 -20z m6968 -93\n    l119 -100 0 -78 c0 -43 -3 -80 -6 -84 -4 -3 -60 39 -125 94 l-119 100 0 85 c0\n    46 3 84 6 84 3 0 59 -45 125 -101z m-4813 -94 c259 -150 312 -184 312 -202 0\n    -12 -4 -24 -9 -27 -7 -5 -632 352 -655 374 -11 11 12 42 29 38 7 -2 152 -84\n    323 -183z m584 116 c99 -57 122 -81 100 -103 -13 -13 -219 100 -228 124 -6 19\n    2 38 16 38 5 0 55 -27 112 -59z m-1932 39 c12 -8 12 -13 -3 -44 -17 -37 -43\n    -47 -53 -22 -6 15 21 76 34 76 4 0 14 -4 22 -10z m-912 -188 c28 -24 52 -50\n    52 -58 0 -20 -13 -17 -28 6 -8 13 -23 20 -45 20 -42 0 -71 16 -153 85 -38 32\n    -71 59 -73 61 -2 2 2 17 9 34 l12 30 87 -67 c47 -36 110 -86 139 -111z m1583\n    102 c63 -36 123 -74 135 -85 11 -10 26 -19 34 -19 12 0 175 -92 613 -348 105\n    -61 127 -79 127 -98 0 -12 -4 -25 -8 -28 -5 -3 -157 81 -338 186 -181 105\n    -403 233 -494 286 -189 108 -202 118 -194 150 4 12 7 22 9 22 1 0 54 -30 116\n    -66z m1508 25 c222 -121 497 -273 504 -279 13 -11 26 -80 16 -80 -8 0 -85 42\n    -384 208 -225 125 -235 132 -235 156 0 21 7 36 18 36 3 0 39 -19 81 -41z m575\n    22 c28 -19 66 -67 66 -86 0 -5 -23 13 -52 40 l-51 50 32 -42 c18 -24 28 -43\n    23 -43 -14 0 -52 54 -57 80 -5 25 2 25 39 1z m-2865 -40 c0 -9 -8 -33 -17 -54\n    -16 -36 -18 -37 -39 -22 -27 19 -29 42 -8 91 14 34 15 35 40 18 14 -9 25 -24\n    24 -33z m-570 16 c10 -20 8 -38 -12 -113 -14 -49 -28 -102 -32 -118 -6 -29 -6\n    -29 -26 -9 -20 19 -20 20 7 141 28 124 40 143 63 99z m441 -81 c0 -23 -13 -56\n    -21 -56 -5 0 -34 19 -63 43 -55 43 -64 63 -46 98 10 18 14 17 70 -27 33 -26\n    60 -52 60 -58z m306 90 c6 -17 -21 -86 -34 -86 -5 0 -15 6 -21 14 -9 11 -8 22\n    6 50 17 37 39 47 49 22z m1130 -118 c115 -69 260 -153 321 -187 62 -35 115\n    -66 117 -70 7 -11 -5 -51 -16 -51 -8 0 -158 85 -550 312 -76 44 -138 85 -138\n    92 0 19 23 37 41 33 9 -2 110 -60 225 -129z m-2486 76 c45 -49 46 -60 20 -129\n    -12 -30 -12 -29 -46 64 -19 51 -34 97 -34 102 0 19 19 7 60 -37z m7253 -17\n    l47 -45 0 -81 c0 -45 -3 -81 -6 -81 -4 0 -33 23 -65 51 l-59 51 0 84 c0 98 0\n    98 83 21z m-3952 -73 c17 -15 15 -64 -2 -64 -14 0 -202 109 -223 130 -12 12\n    -16 25 -11 39 6 21 10 20 113 -35 59 -31 114 -63 123 -70z m2680 0 c162 -146\n    697 -625 918 -823 96 -86 193 -172 215 -192 40 -35 41 -38 44 -113 2 -42 1\n    -76 -3 -76 -4 0 -26 17 -49 37 -48 42 -214 193 -230 208 -15 15 -373 346 -734\n    679 l-302 279 0 59 c0 33 4 58 9 56 5 -1 64 -53 132 -114z m-4743 59 c5 -34\n    -24 -94 -42 -87 -20 8 -20 32 -1 78 17 39 38 44 43 9z m-1048 -33 l55 -49 -54\n    -1 c-75 0 -106 30 -85 84 10 25 25 19 84 -34z m2365 -160 c176 -101 326 -189\n    334 -196 12 -11 12 -18 3 -38 l-11 -25 -158 91 c-418 242 -557 325 -560 335\n    -2 6 4 18 13 27 14 15 19 15 38 3 11 -8 165 -96 341 -197z m946 126 c341 -187\n    485 -268 497 -280 8 -7 12 -25 10 -40 -3 -26 -4 -25 -193 80 -360 201 -455\n    255 -460 265 -6 8 2 49 9 49 2 0 63 -33 137 -74z m-1428 -63 c375 -214 751\n    -434 765 -447 10 -9 10 -19 2 -40 l-10 -28 -68 38 c-177 98 -861 489 -894 510\n    -32 20 -38 30 -38 59 0 19 5 35 11 35 6 0 110 -57 232 -127z m-1099 53 l49\n    -43 -13 -62 c-7 -33 -16 -61 -19 -61 -8 0 -141 108 -141 114 0 3 20 64 35 104\n    6 17 25 6 89 -52z m326 39 c9 -11 8 -25 -5 -65 -15 -44 -19 -49 -36 -40 -23\n    13 -24 35 -4 84 17 39 26 44 45 21z m1865 -50 c126 -69 151 -95 126 -133 -7\n    -11 -14 -11 -42 3 -72 37 -219 128 -219 136 0 4 5 20 10 34 10 25 12 26 33 13\n    12 -8 54 -32 92 -53z m982 3 c14 -18 44 -98 37 -98 -3 0 -25 11 -49 25 -34 21\n    -47 36 -59 72 -9 26 -16 48 -16 50 0 7 77 -36 87 -49z m-3035 25 c19 -17 23\n    -49 9 -72 -6 -10 -13 -10 -29 -2 -26 14 -34 36 -22 66 11 29 17 31 42 8z\n    m6358 -112 c101 -83 100 -82 100 -172 0 -43 -3 -79 -7 -79 -16 1 -228 193\n    -236 213 -8 22 -8 135 1 150 2 5 21 -6 41 -25 20 -19 65 -58 101 -87z m-2784\n    -86 c6 -5 141 -137 301 -293 l291 -283 6 -62 c16 -180 18 -277 5 -277 -7 0\n    -74 62 -148 138 -74 75 -229 234 -346 352 l-212 215 -17 85 c-10 47 -31 130\n    -48 185 -16 55 -32 109 -35 120 -3 11 39 -23 93 -75 54 -52 103 -99 110 -105z\n    m-4582 167 c3 -5 -3 -25 -12 -45 -28 -59 -44 -43 -21 22 11 31 23 39 33 23z\n    m3405 -83 c390 -218 494 -278 503 -293 10 -15 10 -66 0 -66 -7 0 -99 52 -519\n    294 -142 81 -153 90 -153 117 0 16 5 29 12 29 6 0 77 -37 157 -81z m-2281 19\n    c33 -28 40 -55 21 -89 -10 -19 -13 -18 -60 21 -50 42 -58 64 -39 101 12 22 16\n    20 78 -33z m4867 -189 c116 -107 377 -347 580 -534 204 -187 396 -365 428\n    -395 l58 -55 -3 -67 -3 -68 -35 32 c-160 147 -287 264 -350 323 -42 38 -100\n    93 -130 120 -30 28 -192 176 -360 330 -463 426 -439 401 -441 460 -2 93 -2 92\n    24 68 12 -11 117 -107 232 -214z m-3852 -6 c468 -265 569 -325 574 -338 2 -6\n    -2 -18 -9 -27 -12 -15 -51 4 -383 193 -203 116 -377 219 -386 229 -9 11 -19\n    17 -22 13 -3 -3 -47 18 -96 47 -83 47 -91 54 -91 82 0 23 4 29 16 24 8 -3 187\n    -103 397 -223z m1793 208 c29 -17 53 -66 39 -79 -10 -10 -57 22 -71 50 -26 51\n    -17 59 32 29z m-968 -11 c17 -11 32 -22 32 -26 0 -5 -19 -45 -25 -52 -6 -7\n    -75 33 -75 42 0 26 13 56 24 56 6 0 26 -9 44 -20z m-2748 4 c0 -3 -5 -14 -10\n    -25 -12 -22 -11 -23 24 -9 25 9 26 8 20 -18 -15 -67 -11 -66 -75 -11 -32 28\n    -59 55 -59 60 0 5 23 9 50 9 28 0 50 -3 50 -6z m765 -24 c16 -18 16 -25 5 -67\n    -16 -60 -25 -70 -46 -52 -13 10 -15 25 -11 66 8 77 19 89 52 53z m6175 -40\n    l45 -40 4 -87 3 -88 -23 20 c-13 10 -43 37 -66 59 l-43 40 0 78 c0 90 -1 90\n    80 18z m-7555 41 c-10 -10 -294 -36 -302 -28 -2 3 36 10 84 17 48 6 95 13 103\n    15 38 7 123 4 115 -4z m568 -66 c58 -49 59 -50 52 -90 -8 -50 -19 -62 -41 -45\n    -12 11 -14 24 -10 53 9 52 -4 65 -75 73 -64 7 -84 22 -74 54 7 22 20 26 30 10\n    10 -16 25 -12 25 6 0 19 0 19 93 -61z m620 30 c34 -30 38 -38 32 -64 -4 -17\n    -10 -33 -15 -36 -4 -3 -26 12 -48 33 -37 34 -39 39 -31 70 5 17 13 32 17 32 4\n    -1 24 -16 45 -35z m2284 -8 c102 -58 103 -59 103 -94 0 -20 -5 -33 -13 -33 -7\n    0 -48 21 -91 46 -56 33 -76 50 -72 61 3 8 6 23 6 34 0 10 2 19 4 19 2 0 30\n    -15 63 -33z m1043 -50 c5 -17 8 -33 5 -36 -11 -11 -97 43 -106 67 -19 50 -12\n    55 40 26 35 -18 53 -36 61 -57z m-745 -4 c72 -42 166 -96 210 -119 44 -24 139\n    -78 210 -121 126 -76 130 -80 133 -116 2 -20 -1 -37 -7 -37 -9 0 -82 41 -310\n    176 -84 50 -108 63 -289 168 -90 51 -102 61 -102 85 0 27 7 41 19 41 4 0 65\n    -35 136 -77z m-3570 58 l20 -8 -20 -6 c-30 -9 -287 -26 -485 -31 -229 -6 -169\n    7 125 28 127 9 246 18 265 20 61 5 74 5 95 -3z m165 -22 c0 -5 -7 -9 -15 -9\n    -15 0 -20 12 -9 23 8 8 24 -1 24 -14z m473 -3 c3 -7 -2 -68 -11 -136 -15 -108\n    -19 -121 -31 -106 -11 13 -12 37 -7 111 8 124 15 155 31 148 8 -2 16 -10 18\n    -17z m642 -21 l52 -44 -10 -58 c-5 -32 -11 -60 -13 -62 -7 -8 -54 30 -54 44 0\n    8 -8 15 -18 15 -30 0 -55 35 -49 67 8 40 25 83 33 83 4 0 30 -20 59 -45z\n    m-6324 -60 c-115 -298 -138 -529 -100 -1025 5 -69 12 -147 15 -175 4 -27 4\n    -48 0 -44 -9 9 -34 195 -52 399 -15 167 -16 215 -6 339 20 236 72 450 134 547\n    16 26 31 44 34 42 2 -3 -9 -40 -25 -83z m5540 39 c-7 -31 -9 -34 -10 -12 -1\n    27 9 62 15 55 3 -2 0 -22 -5 -43z m1540 -4 c67 -40 69 -42 69 -82 0 -47 1 -47\n    -101 12 -67 40 -69 42 -69 82 0 47 -1 47 101 -12z m1116 -1 c2 -7 -1 -20 -6\n    -27 -14 -22 -71 12 -71 42 0 12 3 26 7 29 9 10 67 -26 70 -44z m1045 -28 c12\n    -44 4 -49 -37 -26 -31 16 -35 23 -35 57 l0 40 32 -19 c21 -12 35 -30 40 -52z\n    m-3112 1 c0 -41 -15 -59 -34 -43 -16 13 -22 71 -10 84 14 14 44 -14 44 -41z\n    m-88 -82 c-2 -17 -6 -30 -8 -30 -2 0 -22 16 -44 36 -28 25 -40 44 -40 63 0 44\n    11 44 55 1 34 -34 41 -46 37 -70z m6554 13 l114 -98 0 -77 c0 -50 -4 -78 -11\n    -78 -11 0 -109 81 -186 154 l-43 40 0 78 c0 43 3 78 6 78 3 0 57 -44 120 -97z\n    m-7228 25 c65 -56 72 -65 72 -99 0 -53 -33 -60 -77 -17 -18 18 -33 37 -33 43\n    0 7 -11 18 -25 25 -32 17 -106 96 -98 104 4 3 25 6 48 6 36 0 50 -8 113 -62z\n    m2945 21 c40 -22 78 -46 86 -54 14 -14 7 -55 -11 -55 -5 0 -45 21 -89 47 -58\n    35 -79 53 -79 69 0 19 8 34 17 34 2 0 36 -18 76 -41z m-3118 -10 c25 -23 42\n    -45 39 -50 -3 -5 -22 -9 -43 -9 -30 0 -44 8 -80 44 -45 46 -43 54 12 55 19 1\n    41 -12 72 -40z m3405 -36 c63 -36 123 -72 133 -81 19 -17 23 -72 5 -72 -7 0\n    -76 37 -155 82 -127 73 -143 85 -143 109 0 53 2 52 160 -38z m2860 -362 c201\n    -184 372 -342 381 -350 9 -9 115 -108 237 -220 l222 -204 0 -63 c0 -35 -4 -64\n    -8 -64 -4 0 -127 111 -272 246 -506 471 -600 559 -745 695 -38 36 -120 112\n    -182 169 -62 56 -113 109 -115 118 -2 8 -1 37 0 64 l4 48 57 -52 c31 -29 221\n    -203 421 -387z m-6402 386 c23 -24 39 -46 36 -50 -4 -4 -25 -7 -47 -7 -33 0\n    -46 7 -81 42 l-41 42 25 7 c49 14 66 9 108 -34z m1178 -19 c25 -14 29 -23 32\n    -67 2 -29 -1 -51 -7 -51 -5 0 -35 23 -66 51 -51 47 -55 55 -49 83 10 48 15 51\n    39 25 12 -13 34 -32 51 -41z m3109 36 c34 -19 47 -35 54 -62 6 -20 8 -38 5\n    -41 -3 -3 -29 8 -59 23 -51 28 -65 47 -65 89 0 23 14 22 65 -9z m-4451 -25\n    c13 -31 20 -39 28 -31 8 8 15 9 25 1 23 -20 14 -29 -26 -29 -31 0 -48 8 -80\n    37 -47 42 -50 50 -18 56 50 10 55 7 71 -34z m3249 22 c27 -14 32 -26 21 -55\n    -8 -21 -23 -20 -53 3 -19 14 -22 24 -17 45 4 15 10 26 14 24 4 -2 19 -10 35\n    -17z m-3349 -32 c25 -22 44 -44 42 -48 -3 -4 -20 -8 -38 -9 -27 -2 -43 6 -81\n    41 -26 24 -45 46 -41 50 4 4 22 7 39 7 23 0 45 -11 79 -41z m736 -20 c0 -44\n    -3 -59 -12 -56 -19 6 -12 117 7 117 3 0 5 -27 5 -61z m-852 6 l47 -45 -39 0\n    c-30 0 -49 8 -82 36 -24 19 -44 40 -44 45 0 5 16 9 36 9 28 0 45 -9 82 -45z\n    m2767 -103 c121 -68 280 -158 353 -199 134 -76 147 -89 120 -126 -12 -15 -28\n    -8 -173 71 -316 175 -540 304 -552 320 -7 9 -13 31 -13 49 0 32 1 33 23 22 12\n    -7 121 -68 242 -137z m-2883 101 c21 -20 38 -41 38 -45 0 -4 -16 -8 -35 -8\n    -39 0 -75 28 -75 58 0 44 24 42 72 -5z m2518 -18 c64 -38 80 -51 85 -76 4 -17\n    5 -33 2 -36 -5 -5 -117 54 -149 79 -16 13 -36 78 -23 78 3 0 41 -20 85 -45z\n    m2146 16 c22 -13 33 -29 36 -50 5 -36 -3 -38 -48 -10 -26 16 -34 27 -34 50 0\n    34 5 35 46 10z m3173 -38 l62 -58 -3 -69 -3 -69 -67 57 -68 57 0 70 c0 38 4\n    69 9 69 4 0 36 -26 70 -57z m-6289 -8 c0 -38 -10 -44 -34 -19 -18 17 -18 20\n    -10 51 10 37 44 11 44 -32z m2191 3 c78 -46 89 -55 89 -80 0 -16 -5 -28 -12\n    -28 -17 0 -161 85 -177 104 -11 13 -7 56 5 56 3 0 46 -23 95 -52z m-2292 -12\n    c18 -19 31 -41 29 -48 -3 -7 -2 -22 3 -33 7 -17 8 -16 8 8 1 32 11 34 36 7 14\n    -16 16 -29 11 -67 -4 -33 -3 -43 4 -33 5 8 10 25 10 37 0 12 3 24 8 26 4 3 35\n    -17 70 -45 l62 -50 0 -59 c0 -32 -4 -59 -8 -59 -11 0 -37 30 -45 53 -4 9 -14\n    17 -24 17 -10 0 -69 41 -130 91 -113 90 -113 90 -113 134 0 85 14 89 79 21z\n    m2546 -27 c173 -95 185 -104 185 -140 0 -24 -4 -30 -15 -25 -44 17 -294 168\n    -299 181 -6 16 2 45 13 45 3 0 56 -27 116 -61z m-435 33 c18 -15 22 -25 16\n    -45 -6 -27 -7 -27 -36 -12 -36 19 -43 30 -35 55 8 25 26 25 55 2z m-1787 -7\n    c16 -12 18 -21 10 -67 l-8 -53 -23 23 c-13 13 -21 30 -18 39 3 8 6 28 6 44 0\n    32 6 35 33 14z m3091 -68 c15 -58 10 -61 -51 -26 -67 38 -73 44 -73 82 l0 28\n    59 -31 c36 -20 61 -40 65 -53z m-4081 22 l52 -50 -55 6 c-43 5 -61 13 -82 36\n    -40 42 -38 47 25 58 5 0 32 -22 60 -50z m860 4 c50 -41 58 -51 55 -78 -2 -16\n    -8 -30 -14 -30 -7 0 -37 23 -67 50 -47 43 -54 55 -50 78 3 15 8 27 12 27 3 0\n    32 -21 64 -47z m-1093 18 c0 -12 -54 -19 -250 -30 -293 -17 -396 -20 -374 -11\n    53 21 624 59 624 41z m410 -75 c0 -34 -3 -66 -7 -69 -13 -13 -32 15 -28 41 2\n    15 7 44 10 65 9 57 25 34 25 -37z m2812 -14 c39 -22 48 -32 48 -54 0 -15 -4\n    -29 -9 -32 -7 -5 -211 109 -211 119 0 2 4 15 10 30 l10 26 52 -31 c29 -17 74\n    -43 100 -58z m-1227 30 c65 -39 82 -54 91 -82 7 -19 8 -36 3 -38 -9 -4 -128\n    61 -159 86 -20 17 -40 82 -24 82 5 -1 45 -22 89 -48z m279 -49 c496 -281 511\n    -290 508 -314 -1 -13 -6 -27 -10 -31 -7 -7 -417 219 -507 280 -22 14 -60 36\n    -85 48 -25 12 -52 28 -62 35 -17 15 -35 79 -22 79 4 0 84 -44 178 -97z m1616\n    -33 c166 -97 180 -107 180 -133 1 -20 2 -20 11 -5 9 16 13 17 39 3 43 -22 60\n    -44 60 -76 0 -16 -2 -29 -4 -29 -4 0 -454 256 -498 284 -12 7 -18 23 -18 49\n    l0 39 53 -30 c28 -15 108 -62 177 -102z m236 109 c24 -14 35 -30 40 -55 3 -19\n    4 -37 1 -40 -11 -11 -88 40 -92 61 -6 31 -3 55 8 55 5 0 25 -9 43 -21z m1775\n    -2 c24 -21 470 -435 659 -612 47 -44 110 -103 140 -130 30 -28 155 -144 278\n    -258 l222 -209 0 -54 c0 -31 -4 -54 -10 -54 -6 0 -63 50 -128 112 -64 61 -164\n    157 -222 212 -243 232 -330 315 -410 391 -415 390 -560 529 -561 539 -8 99 -8\n    98 32 63z m1607 -111 l92 -80 0 -74 0 -73 -23 18 c-90 71 -196 166 -201 179\n    -3 9 -6 45 -6 81 l0 64 23 -18 c13 -10 65 -54 115 -97z m-4526 81 c22 -18 25\n    -26 17 -45 -8 -22 -10 -22 -38 -7 -37 19 -44 30 -36 55 8 26 24 25 57 -3z\n    m493 -65 c129 -76 150 -92 153 -115 2 -15 -2 -27 -8 -27 -6 0 -80 39 -165 88\n    -141 79 -155 89 -155 115 0 15 6 27 13 27 6 0 80 -40 162 -88z m-2933 -93 c3\n    -85 9 -183 13 -218 5 -51 4 -62 -7 -59 -31 11 -38 52 -38 246 0 151 3 193 13\n    190 8 -3 14 -49 19 -159z m4737 -502 l44 -47 -3 -88 c-3 -116 -13 -187 -25\n    -187 -6 0 -82 74 -169 165 -88 91 -230 237 -317 325 l-157 160 -6 100 c-4 55\n    -9 129 -12 165 l-6 65 304 -305 c167 -168 323 -326 347 -353z m-4334 543 c50\n    -40 96 -80 103 -88 13 -17 17 -102 5 -102 -10 0 -180 125 -215 158 -23 21 -28\n    34 -28 72 0 54 7 65 29 47 9 -8 57 -47 106 -87z m3325 68 c33 -19 61 -42 64\n    -53 8 -27 7 -65 0 -65 -17 0 -115 64 -124 80 -11 20 -14 70 -4 70 3 0 32 -15\n    64 -32z m-3055 -12 c10 -15 14 -33 9 -50 -5 -21 -9 -24 -25 -15 -14 7 -19 21\n    -19 49 0 45 12 51 35 16z m1935 -33 c98 -56 119 -78 103 -107 -7 -12 -28 -4\n    -113 45 -58 33 -108 64 -112 67 -10 9 2 52 13 52 5 0 54 -26 109 -57z m4125\n    17 c79 -64 85 -75 85 -141 0 -32 -3 -59 -6 -59 -8 0 -89 65 -121 97 -19 18\n    -23 33 -23 83 0 33 3 60 8 60 4 0 30 -18 57 -40z m-6994 -64 c114 -106 132\n    -128 127 -158 -3 -18 -20 -7 -130 86 -110 93 -128 112 -128 137 0 19 5 29 15\n    29 8 0 60 -42 116 -94z m84 58 c30 -19 50 -80 38 -111 l-8 -23 -25 23 c-14 13\n    -47 46 -75 75 l-49 52 47 0 c27 0 58 -7 72 -16z m2584 -1 c33 -19 39 -39 19\n    -66 -12 -15 -15 -15 -45 4 -33 21 -38 34 -27 63 8 20 15 20 53 -1z m534 -90\n    c144 -83 147 -85 147 -119 0 -19 -3 -34 -6 -34 -9 0 -318 181 -333 195 -9 8\n    -11 23 -7 39 8 31 -12 39 199 -81z m459 -52 c236 -135 238 -136 238 -170 0\n    -26 -3 -32 -16 -27 -14 5 -428 244 -483 278 -14 9 -21 23 -21 46 0 40 -31 53\n    282 -127z m-1913 98 c64 -36 92 -58 101 -79 7 -16 10 -33 9 -39 -5 -11 -167\n    83 -191 111 -17 18 -25 58 -13 58 3 0 45 -23 94 -51z m141 31 c42 -21 65 -53\n    56 -76 -14 -36 -80 8 -95 64 -5 17 -7 32 -5 32 3 0 22 -9 44 -20z m1966 -1\n    c19 -11 34 -26 35 -32 0 -7 2 -24 3 -39 2 -34 -4 -35 -54 -3 -34 22 -40 30\n    -40 60 0 40 10 43 56 14z m2090 -329 c181 -174 408 -390 504 -480 96 -90 211\n    -199 255 -240 44 -42 110 -104 146 -139 57 -53 68 -69 73 -106 4 -23 4 -55 0\n    -69 l-6 -26 -32 26 c-17 14 -69 63 -116 108 -76 73 -297 283 -820 776 -90 85\n    -209 198 -264 251 l-99 95 -3 60 c-2 66 1 78 20 67 8 -5 162 -150 342 -323z\n    m-3085 232 c63 -37 152 -90 199 -116 263 -150 290 -168 290 -198 0 -15 -5 -28\n    -10 -28 -8 0 -282 153 -566 315 -22 13 -45 30 -51 37 -12 14 0 58 15 58 5 0\n    61 -31 123 -68z m-1915 -44 c5 -47 4 -58 -8 -58 -28 0 -38 24 -38 89 0 65 0\n    65 20 46 12 -13 22 -41 26 -77z m1304 -63 c113 -64 210 -122 217 -129 14 -13\n    6 -56 -11 -56 -6 0 -107 55 -225 122 -214 123 -251 153 -251 201 0 18 2 18 33\n    -1 17 -11 124 -73 237 -137z m1768 112 c48 -29 52 -34 52 -69 0 -21 -3 -38 -7\n    -38 -12 0 -118 62 -125 74 -4 6 -8 26 -8 45 0 39 5 38 88 -12z m-3981 -100\n    c67 -58 92 -86 97 -109 16 -79 10 -76 -124 57 -106 105 -130 135 -130 158 l0\n    28 33 -28 c19 -15 74 -63 124 -106z m2604 106 c29 -18 34 -29 23 -57 -5 -14\n    -11 -13 -45 4 -40 21 -43 27 -33 54 8 20 19 20 55 -1z m-1845 -242 c6 -33 10\n    -61 8 -61 -2 0 -59 41 -126 92 -68 50 -125 93 -127 95 -7 5 -20 106 -15 115 3\n    4 60 -34 127 -85 l122 -94 11 -62z m2343 177 c182 -103 211 -124 211 -153 0\n    -14 -5 -25 -11 -25 -7 0 -87 44 -180 98 -154 88 -169 99 -169 125 0 15 5 27\n    11 27 7 0 68 -32 138 -72z m503 -76 c223 -130 253 -151 256 -175 2 -15 -1 -27\n    -7 -27 -5 0 -121 65 -258 143 -235 136 -248 145 -251 175 -2 18 -1 32 1 32 3\n    0 119 -67 259 -148z m3572 57 l106 -91 0 -64 c0 -35 -2 -64 -5 -64 -7 0 -175\n    142 -198 167 -20 23 -36 143 -19 143 6 0 58 -41 116 -91z m-5420 11 c70 -40\n    100 -63 111 -87 26 -54 17 -57 -27 -8 -34 38 -43 44 -50 30 -8 -14 -15 -12\n    -58 11 -59 32 -76 50 -86 88 -8 35 -11 36 110 -34z m147 19 c27 -13 45 -32 55\n    -56 8 -19 13 -37 10 -40 -2 -3 -25 7 -49 22 -30 17 -49 37 -56 57 -17 47 -17\n    47 40 17z m5078 -47 c42 -37 118 -103 170 -147 140 -119 131 -106 131 -178 0\n    -35 -3 -66 -6 -70 -4 -3 -60 42 -126 101 -66 59 -146 128 -178 155 -32 26 -63\n    60 -69 75 -11 26 -13 132 -3 132 3 0 39 -30 81 -68z m-3987 -120 c277 -158\n    313 -182 316 -205 4 -34 -5 -34 -76 2 -113 58 -577 330 -580 341 -5 15 5 40\n    17 40 5 0 151 -80 323 -178z m-2188 145 c20 -15 36 -117 19 -117 -21 0 -46 41\n    -50 85 -6 47 1 54 31 32z m1772 -16 c26 -16 31 -24 27 -45 -7 -37 -19 -40 -58\n    -16 -38 23 -38 24 -29 58 8 27 20 28 60 3z m1417 -48 c29 -18 37 -29 37 -53 0\n    -38 -12 -38 -80 3 -49 30 -55 37 -58 71 l-3 37 33 -17 c18 -9 50 -28 71 -41z\n    m-4003 -75 c111 -105 114 -109 121 -160 3 -29 6 -54 5 -55 -1 -1 -61 56 -134\n    127 -127 124 -132 130 -132 170 0 52 -2 53 140 -82z m3616 -31 l249 -143 3\n    -37 c2 -20 0 -37 -3 -37 -7 0 -416 237 -477 276 -30 19 -38 31 -38 54 0 17 4\n    30 9 30 5 0 121 -64 257 -143z m2224 -116 c197 -188 337 -321 793 -753 138\n    -131 254 -243 258 -250 12 -22 15 -143 4 -145 -10 -1 -170 150 -765 723 -69\n    66 -172 165 -230 220 -58 54 -160 153 -227 220 l-123 121 0 55 c0 30 3 58 6\n    61 9 8 43 -22 284 -252z m-3624 135 c109 -63 200 -121 202 -128 1 -7 -3 -21\n    -10 -30 -12 -15 -30 -6 -179 80 -91 54 -178 106 -192 117 -26 20 -48 75 -30\n    75 5 0 99 -51 209 -114z m771 -91 c310 -176 332 -190 336 -219 3 -17 2 -34 -2\n    -38 -8 -9 -221 109 -221 122 0 6 -8 10 -17 10 -9 0 -115 55 -235 122 -180 101\n    -218 127 -218 145 0 27 10 54 19 50 3 -2 155 -88 338 -192z m-2082 165 c19\n    -21 34 -110 18 -110 -20 0 -41 36 -48 83 -8 51 1 59 30 27z m876 -36 c44 -25\n    99 -69 124 -97 43 -47 71 -87 62 -87 -6 0 -198 112 -224 131 -19 13 -53 74\n    -53 94 0 11 15 4 91 -41z m-1135 -60 c62 -47 120 -94 129 -104 16 -17 49 -134\n    43 -152 -3 -8 -36 14 -204 139 -72 53 -72 53 -83 116 -13 74 -13 87 -4 87 3 0\n    57 -39 119 -86z m1377 1 c10 -21 16 -40 13 -42 -12 -12 -95 49 -110 81 -9 19\n    -16 37 -16 40 0 4 21 -5 48 -18 33 -17 53 -35 65 -61z m526 55 c33 -16 38 -23\n    34 -45 -7 -36 -19 -39 -58 -15 -35 22 -40 34 -29 64 8 20 7 20 53 -4z m1416\n    -39 c63 -36 76 -51 68 -79 -7 -29 -15 -28 -79 10 -48 29 -54 36 -54 65 0 18 3\n    33 8 33 4 0 30 -13 57 -29z m823 -429 c156 -163 192 -206 192 -229 0 -37 -29\n    -196 -39 -211 -7 -12 -195 172 -447 438 -186 197 -177 183 -170 253 3 34 9 96\n    12 137 l7 74 126 -130 c69 -72 213 -221 319 -332z m-1168 298 c135 -79 273\n    -159 308 -179 57 -32 62 -38 57 -61 -4 -14 -8 -26 -10 -28 -3 -3 -435 245\n    -500 287 -22 14 -58 35 -80 47 -33 17 -41 26 -43 54 -3 24 0 31 10 28 7 -3\n    123 -70 258 -148z m-3550 -45 l45 -48 -40 7 c-22 3 -53 6 -68 6 -21 0 -44 15\n    -88 58 -55 54 -59 62 -59 104 0 24 3 48 6 51 7 7 129 -100 204 -178z m763 170\n    c16 -15 34 -112 23 -123 -15 -15 -47 37 -53 86 -6 54 2 65 30 37z m1953 -85\n    c196 -110 262 -149 269 -160 9 -14 -13 -50 -30 -50 -8 0 -65 31 -127 68 -62\n    38 -155 90 -205 117 -81 43 -93 53 -93 76 0 31 9 42 29 34 8 -3 78 -41 157\n    -85z m4297 -52 c229 -203 207 -175 207 -258 0 -41 -4 -70 -9 -68 -11 4 -229\n    195 -313 275 l-58 55 0 69 c0 38 3 69 6 69 3 0 78 -64 167 -142z m-4848 28\n    c145 -85 157 -94 149 -119 -4 -12 -8 -24 -10 -26 -5 -6 -279 157 -297 177 -8\n    9 -19 30 -23 46 l-7 29 44 -25 c24 -13 89 -50 144 -82z m293 54 c34 -21 35\n    -23 26 -57 l-6 -22 -44 22 c-32 15 -44 27 -44 42 0 41 19 45 68 15z m-2234\n    -185 c19 -82 52 -201 75 -262 22 -62 37 -113 33 -113 -13 0 -117 122 -130 152\n    -12 28 -62 345 -62 396 l0 27 25 -25 c19 -20 32 -57 59 -175z m655 126 c5 -20\n    12 -51 16 -69 6 -31 5 -33 -12 -24 -36 20 -52 49 -59 106 l-7 58 26 -17 c16\n    -10 31 -32 36 -54z m858 31 c27 -16 81 -48 121 -72 54 -32 78 -53 93 -81 12\n    -25 15 -39 8 -39 -7 0 -64 30 -127 67 -108 64 -152 104 -152 141 0 17 3 16 57\n    -16z m4113 -312 c129 -124 304 -292 389 -375 241 -233 408 -393 509 -490 l92\n    -88 0 -74 c0 -40 -3 -73 -7 -73 -5 0 -68 58 -140 128 -130 124 -133 128 -135\n    172 -1 38 -2 40 -5 12 -3 -18 -8 -32 -13 -30 -10 3 -244 224 -475 447 -185\n    178 -482 461 -534 508 -43 39 -45 43 -49 107 -2 36 -1 73 2 82 7 19 -2 27 366\n    -326z m-3837 254 c10 -13 24 -21 32 -18 18 7 244 -127 245 -144 0 -7 -4 -22\n    -10 -32 -9 -17 -23 -11 -167 72 -87 50 -163 95 -169 102 -6 6 -14 28 -17 49\n    l-6 38 37 -22 c20 -12 45 -32 55 -45z m1879 35 c29 -17 56 -36 59 -41 6 -10 0\n    -48 -7 -48 -3 0 -29 14 -59 31 -52 29 -73 57 -60 79 8 14 7 14 67 -21z m-567\n    5 c17 -11 25 -26 25 -45 0 -34 -1 -34 -40 -14 -23 12 -30 22 -30 45 0 34 10\n    37 45 14z m-596 -112 c113 -64 206 -121 207 -127 2 -5 -3 -18 -10 -28 -13 -16\n    -28 -9 -220 100 -167 95 -206 121 -206 138 0 21 8 35 19 35 3 0 98 -53 210\n    -118z m-308 66 c28 -16 39 -28 39 -45 0 -33 -21 -37 -64 -13 -34 21 -48 55\n    -29 73 9 10 11 9 54 -15z m-1779 -96 c70 -52 130 -102 133 -113 3 -10 12 -16\n    19 -13 24 9 59 -32 82 -96 13 -36 21 -66 19 -68 -2 -2 -85 59 -186 135 -185\n    140 -197 154 -214 232 -9 41 -19 46 147 -77z m2993 -37 c116 -67 220 -128 233\n    -136 21 -13 30 -53 14 -62 -4 -3 -81 38 -172 90 -91 52 -202 115 -247 140 -79\n    43 -83 46 -83 79 0 41 -31 55 255 -111z m-3805 110 c13 -14 22 -26 19 -28 -2\n    -2 -16 -8 -31 -15 -28 -12 -28 -11 -28 28 0 46 8 49 40 15z m954 -4 c17 -19\n    50 -135 43 -155 -8 -25 -54 42 -61 90 -4 27 -9 57 -12 67 -7 23 9 22 30 -2z\n    m3106 -30 c45 -27 58 -53 41 -81 -8 -12 -17 -10 -58 12 -42 23 -48 31 -51 62\n    -4 44 6 45 68 7z m-1162 -118 c89 -52 162 -100 162 -107 0 -7 -6 -20 -13 -31\n    -13 -17 -25 -11 -193 88 -228 135 -219 127 -210 160 l6 27 43 -21 c23 -12 115\n    -64 205 -116z m-827 34 c54 -31 106 -69 118 -84 11 -15 21 -22 21 -15 0 14 49\n    -9 136 -64 46 -30 54 -39 48 -57 -3 -12 -10 -26 -14 -31 -5 -5 -99 45 -212\n    111 -191 112 -205 122 -230 169 -36 63 -35 70 5 46 17 -10 75 -44 128 -75z\n    m1424 81 c18 -8 25 -19 25 -40 0 -33 -1 -33 -40 -13 -21 11 -30 23 -30 40 0\n    28 8 30 45 13z m3652 -98 c65 -58 146 -132 181 -164 l62 -59 0 -79 c0 -43 -4\n    -78 -9 -78 -14 0 -91 88 -91 104 0 10 -6 13 -15 10 -16 -6 -47 19 -187 153\n    l-78 74 0 75 c0 42 4 74 9 72 5 -1 62 -50 128 -108z m-6084 52 c23 -24 83\n    -169 74 -179 -2 -2 -22 10 -45 27 -41 30 -54 56 -68 143 -8 44 3 47 39 9z\n    m1161 -14 c126 -74 171 -101 187 -115 19 -16 14 -53 -6 -53 -7 0 -59 26 -116\n    59 -82 46 -109 67 -126 97 -39 67 -34 68 61 12z m347 18 c30 -20 36 -30 32\n    -50 -3 -15 -8 -26 -12 -26 -4 0 -28 14 -54 30 -42 26 -46 32 -37 50 14 26 28\n    25 71 -4z m1035 -22 c36 -21 44 -31 44 -55 0 -16 -2 -29 -4 -29 -2 0 -24 12\n    -50 26 -38 21 -46 31 -46 55 0 16 3 29 6 29 3 0 25 -12 50 -26z m-3496 -4 c11\n    -11 20 -24 20 -29 0 -5 9 -13 21 -16 18 -6 20 -12 14 -43 -4 -21 -10 -41 -14\n    -45 -8 -8 -141 127 -141 143 0 19 79 11 100 -10z m3190 -45 c117 -65 130 -77\n    130 -117 0 -16 -5 -28 -12 -28 -7 1 -69 34 -138 74 -98 58 -124 78 -122 92 5\n    23 22 45 31 40 3 -2 53 -29 111 -61z m2396 24 c19 -22 269 -261 644 -619 113\n    -107 245 -233 293 -280 l88 -85 -3 -72 -3 -71 -70 65 c-38 36 -230 222 -425\n    412 -195 190 -397 386 -448 436 -111 107 -122 124 -115 188 6 53 12 56 39 26z\n    m-2941 -58 c55 -32 132 -77 172 -100 40 -23 75 -46 78 -51 12 -19 -6 -52 -25\n    -47 -14 3 -349 197 -369 213 -2 2 0 15 3 29 8 33 9 32 141 -44z m2028 -316\n    c268 -283 255 -257 210 -390 l-26 -79 -131 135 c-228 236 -442 463 -458 487\n    -12 17 -14 31 -8 50 5 15 16 63 26 106 l17 79 66 -69 c36 -38 173 -181 304\n    -319z m-1288 359 c19 -12 25 -25 25 -50 0 -39 -1 -39 -40 -19 -25 13 -30 22\n    -30 50 0 39 9 43 45 19z m-3419 -93 c-10 -16 -48 -14 -74 5 -22 15 -31 71 -15\n    88 10 10 97 -80 89 -93z m2481 53 c17 -13 35 -24 38 -24 6 0 363 -206 374\n    -216 6 -6 -17 -54 -26 -54 -9 0 -463 267 -476 279 -4 4 -3 20 4 34 13 29 24\n    27 86 -19z m1325 -78 c75 -43 142 -83 147 -90 8 -9 7 -18 -2 -30 -13 -17 -19\n    -15 -98 30 -253 144 -244 138 -247 174 l-3 33 33 -20 c18 -10 95 -54 170 -97z\n    m-4262 94 c0 -6 -42 -9 -107 -9 -78 1 -97 4 -68 9 63 11 175 11 175 0z m627\n    -27 c-3 -10 -5 -4 -5 12 0 17 2 24 5 18 2 -7 2 -21 0 -30z m538 -5 c29 -24\n    114 -90 189 -146 108 -83 141 -114 162 -153 29 -52 41 -60 25 -15 -6 14 -8 26\n    -5 26 3 0 41 -27 84 -60 49 -37 95 -83 119 -118 21 -31 78 -101 125 -154 48\n    -54 84 -98 81 -98 -11 0 -247 185 -264 207 -11 12 -27 23 -37 23 -11 0 -121\n    76 -245 169 l-225 169 -32 70 c-35 79 -48 122 -37 122 5 0 31 -19 60 -42z\n    m2502 -66 c128 -73 138 -81 141 -110 2 -18 -1 -32 -6 -32 -8 0 -300 165 -310\n    175 -9 8 11 45 23 45 8 0 76 -35 152 -78z m323 57 c43 -26 50 -36 50 -71 0\n    -33 -1 -33 -43 -12 -50 25 -67 45 -67 76 0 34 13 35 60 7z m-3812 -9 c-17 -10\n    -376 -30 -503 -29 l-70 1 62 9 c162 24 543 37 511 19z m2417 -110 c181 -106\n    168 -99 395 -230 107 -61 201 -117 208 -122 16 -13 15 -30 -2 -53 -13 -18 -26\n    -11 -230 111 -119 71 -236 140 -259 153 -118 66 -234 136 -251 150 -22 19 -66\n    86 -66 102 0 6 14 2 33 -9 17 -11 95 -57 172 -102z m-2250 90 c3 -5 2 -10 -4\n    -10 -5 0 -13 5 -16 10 -3 6 -2 10 4 10 5 0 13 -4 16 -10z m315 -87 c9 -37 15\n    -70 13 -72 -2 -3 -17 8 -33 24 -25 24 -30 37 -30 75 0 88 25 74 50 -27z m2250\n    44 c272 -156 381 -221 389 -231 8 -9 6 -18 -4 -32 -14 -19 -16 -18 -67 10 -88\n    47 -408 238 -413 246 -5 9 6 50 14 50 4 0 40 -19 81 -43z m4605 -62 c60 -55\n    114 -106 122 -113 13 -14 19 -142 6 -142 -3 0 -34 26 -67 57 -34 31 -88 82\n    -121 112 l-59 56 -4 69 c-3 43 -1 67 6 65 5 -2 58 -49 117 -104z m-3634 74\n    c22 -16 29 -28 29 -55 0 -40 -4 -41 -47 -14 -27 16 -33 26 -33 55 0 40 10 43\n    51 14z m344 -72 c77 -45 141 -89 143 -97 1 -9 -3 -23 -10 -32 -12 -16 -25 -11\n    -151 58 -105 58 -139 82 -143 100 -7 26 1 55 13 53 4 0 71 -37 148 -82z\n    m-3705 17 c0 -24 -4 -44 -10 -44 -12 0 -21 38 -16 65 3 11 5 24 5 28 1 5 6 5\n    11 2 6 -3 10 -26 10 -51z m3118 -35 c86 -50 161 -94 165 -98 5 -5 7 -25 5 -45\n    l-3 -36 -170 100 c-93 55 -176 104 -183 108 -15 10 0 62 18 62 7 0 82 -41 168\n    -91z m-3188 71 c0 -5 -2 -10 -4 -10 -3 0 -8 5 -11 10 -3 6 -1 10 4 10 6 0 11\n    -4 11 -10z m1063 -25 c35 -27 56 -54 83 -111 20 -41 34 -77 32 -79 -7 -8 -135\n    93 -141 111 -3 11 -12 40 -21 67 -8 26 -11 47 -7 47 4 0 29 -16 54 -35z\n    m-1055 -44 c53 -59 62 -75 62 -107 l0 -38 -40 39 c-22 21 -40 47 -40 57 0 10\n    -7 18 -15 18 -23 0 -97 83 -82 92 30 19 55 6 115 -61z m6052 -381 c200 -195\n    417 -407 482 -470 l118 -115 0 -79 0 -79 -82 78 c-82 78 -376 366 -756 740\n    -254 249 -242 234 -242 304 0 32 3 61 7 64 8 9 39 -20 473 -443z m-6187 400\n    l42 -39 -44 -1 c-35 0 -51 6 -73 27 -40 38 -38 41 25 52 4 0 27 -17 50 -39z\n    m-132 2 c36 -32 32 -52 -10 -52 -27 0 -81 47 -81 70 0 22 60 10 91 -18z m3792\n    12 c52 -26 67 -45 67 -81 0 -18 -2 -33 -5 -33 -12 0 -84 40 -99 55 -18 18 -22\n    75 -6 75 6 0 25 -7 43 -16z m-3899 -26 c27 -35 26 -48 -5 -48 -25 0 -59 34\n    -59 60 0 31 35 24 64 -12z m-128 14 c6 -4 17 -18 24 -31 15 -28 -3 -46 -31\n    -30 -19 10 -49 48 -49 61 0 10 41 10 56 0z m3076 -124 c137 -80 227 -139 227\n    -148 0 -8 -5 -23 -13 -32 -15 -21 0 -28 -267 129 -137 80 -199 122 -199 134 0\n    21 10 49 18 49 3 0 108 -60 234 -132z m-3150 95 c36 -35 35 -43 -5 -43 -23 0\n    -41 8 -60 28 -35 36 -34 42 5 42 21 0 41 -9 60 -27z m-109 -11 c33 -34 34 -42\n    4 -42 -21 0 -77 46 -77 63 0 18 49 4 73 -21z m-86 -4 c30 -28 29 -38 -4 -38\n    -31 0 -40 5 -67 38 l-19 22 33 0 c21 0 43 -8 57 -22z m3933 -89 c118 -69 194\n    -119 199 -132 5 -13 10 -16 15 -9 4 7 58 -19 154 -74 81 -47 151 -89 155 -93\n    11 -11 -2 -39 -22 -46 -11 -3 -67 25 -152 76 -74 45 -152 91 -174 103 -164 92\n    -285 166 -285 177 0 5 -7 9 -16 9 -21 0 -94 41 -94 52 0 11 19 48 25 48 2 0\n    90 -50 195 -111z m261 78 c37 -24 54 -77 25 -77 -26 0 -76 50 -76 76 0 30 8\n    30 51 1z m-3204 -47 c14 -17 29 -64 38 -125 l6 -40 -55 58 c-54 56 -56 60 -56\n    114 l0 56 27 -24 c15 -13 33 -31 40 -39z m3529 -11 c68 -39 124 -72 124 -74 0\n    -18 -26 -55 -39 -55 -9 0 -61 26 -116 58 -100 58 -100 58 -103 100 -2 23 0 42\n    4 42 4 0 62 -32 130 -71z m-4606 46 c10 -12 10 -15 -4 -15 -9 0 -16 7 -16 15\n    0 8 2 15 4 15 2 0 9 -7 16 -15z m1371 -220 c122 -230 237 -391 402 -561 130\n    -136 228 -218 382 -320 114 -75 167 -126 365 -344 137 -151 285 -312 443 -482\n    68 -73 117 -134 114 -141 -3 -7 -46 -31 -96 -52 l-92 -38 -30 29 c-61 58 -267\n    273 -429 449 -36 38 -95 101 -131 140 -36 38 -124 133 -195 210 -70 77 -185\n    201 -254 275 -69 75 -177 191 -240 260 -63 68 -179 191 -258 274 l-142 151 5\n    50 c3 33 -3 90 -20 170 -39 185 -39 185 60 80 46 -49 99 -117 116 -150z m3884\n    116 c50 -53 177 -187 283 -299 105 -112 192 -209 192 -216 0 -17 -69 -189 -81\n    -201 -6 -6 -23 5 -47 32 -20 22 -149 161 -287 308 -137 147 -251 273 -253 280\n    -3 11 33 122 63 197 9 23 21 14 130 -101z m-2060 -55 c393 -234 374 -221 368\n    -246 -4 -14 -11 -19 -21 -15 -20 8 -450 256 -516 299 -55 35 -128 116 -104\n    116 7 0 130 -70 273 -154z m-2346 87 c28 -31 51 -61 51 -65 0 -4 -14 -8 -32\n    -8 -25 0 -43 11 -80 47 -56 55 -62 83 -19 83 23 0 40 -12 80 -57z m928 -70\n    c88 -67 112 -92 173 -181 39 -57 65 -100 58 -96 -65 37 -265 185 -283 209 -29\n    37 -105 167 -105 178 0 10 19 -3 157 -110z m2688 49 c211 -118 224 -129 185\n    -154 -12 -8 -52 11 -160 74 -136 79 -145 86 -148 116 l-3 33 48 -26 c26 -14\n    62 -34 78 -43z m3473 -60 l122 -117 0 -70 0 -69 -52 49 c-29 28 -88 84 -130\n    125 l-78 75 0 62 c0 35 3 63 8 63 4 0 62 -53 130 -118z m-7228 50 c0 -34 -3\n    -43 -10 -32 -13 20 -13 93 0 85 6 -3 10 -27 10 -53z m3123 33 c31 -22 36 -29\n    27 -45 -6 -10 -14 -21 -18 -24 -10 -6 -94 43 -89 52 2 4 7 15 10 25 9 23 26\n    21 70 -8z m-3343 -15 c-38 -8 -312 -22 -295 -14 20 9 162 21 245 22 64 0 76\n    -2 50 -8z m3791 -10 c22 -12 42 -27 46 -35 3 -8 9 -13 14 -10 7 5 251 -125\n    273 -146 12 -10 -20 -59 -38 -59 -8 0 -72 34 -142 76 -213 126 -204 120 -204\n    159 0 19 2 35 5 35 3 0 24 -9 46 -20z m2275 -102 l103 -101 -6 -76 c-3 -42 -7\n    -78 -9 -80 -2 -2 -49 42 -106 97 l-103 101 -3 80 c-3 60 -1 81 8 81 7 0 59\n    -46 116 -102z m1614 -45 c0 -35 -4 -63 -9 -63 -5 0 -25 18 -45 40 -34 38 -36\n    44 -36 107 l0 67 45 -44 c44 -43 45 -46 45 -107z m-4007 -21 c139 -82 267\n    -157 285 -166 35 -18 39 -41 11 -59 -12 -7 -78 27 -287 148 -150 86 -282 165\n    -293 174 -19 15 -20 21 -10 40 7 13 18 20 27 17 7 -3 128 -72 267 -154z\n    m-3377 121 c-7 -7 -26 7 -26 19 0 6 6 6 15 -2 9 -7 13 -15 11 -17z m296 -40\n    c43 -46 78 -99 78 -123 0 -25 -48 -7 -86 33 -78 82 -79 84 -64 112 7 14 16 25\n    20 25 3 0 26 -21 52 -47z m2705 27 c30 -18 32 -22 21 -45 -14 -31 -19 -31 -63\n    -2 -37 24 -42 36 -23 55 16 16 28 15 65 -8z m-2869 -103 l57 -57 -60 0 -59 0\n    -53 58 c-29 31 -53 59 -53 63 0 3 25 2 55 -1 51 -6 61 -11 113 -63z m120 0\n    l54 -54 -28 -6 c-15 -3 -37 -1 -48 3 -22 8 -116 99 -116 112 0 10 52 15 70 7\n    8 -4 39 -32 68 -62z m-267 11 c48 -52 49 -53 24 -56 -32 -4 -52 11 -71 56 -28\n    68 -18 68 47 0z m2571 -99 c265 -153 362 -211 473 -281 53 -33 57 -38 33 -38\n    -46 0 -110 27 -229 96 -63 36 -172 100 -244 141 -144 84 -200 120 -251 165\n    -32 28 -61 68 -50 68 2 0 123 -68 268 -151z m603 99 c49 -28 122 -70 160 -93\n    39 -23 125 -75 193 -114 l123 -72 -25 -20 c-14 -11 -29 -18 -33 -16 -111 59\n    -536 314 -540 324 -7 18 4 43 19 43 7 0 53 -23 103 -52z m-4387 -105 c-98\n    -188 -167 -298 -262 -417 -103 -129 -328 -359 -431 -443 -80 -65 -172 -119\n    -183 -109 -3 3 -3 8 -1 9 2 2 58 45 124 95 134 101 363 328 467 462 70 91 193\n    277 248 375 44 79 99 165 104 165 3 0 -27 -62 -66 -137z m4176 116 c40 -23 44\n    -34 20 -60 -15 -17 -18 -17 -50 -2 -36 17 -41 31 -24 64 13 23 11 24 54 -2z\n    m-3012 -103 c14 -9 52 -19 87 -22 l62 -7 108 -116 c235 -253 572 -621 720\n    -785 35 -39 91 -100 125 -136 34 -36 212 -229 395 -430 184 -201 350 -382 369\n    -402 l35 -37 -45 -22 -45 -22 -95 32 c-111 37 -86 14 -413 381 -115 129 -215\n    241 -222 248 -11 11 -249 276 -937 1042 -239 266 -247 276 -241 309 4 18 11\n    45 17 60 10 26 10 26 33 -26 13 -28 34 -58 47 -67z m7216 -3 l120 -113 4 -56\n    c1 -31 -1 -58 -5 -61 -7 -4 -75 57 -209 188 -46 45 -48 49 -48 104 0 31 4 55\n    9 53 5 -1 63 -54 129 -115z m-2613 -204 c99 -106 208 -223 243 -260 l63 -68\n    -46 -92 c-45 -89 -47 -91 -64 -73 -515 551 -566 606 -569 614 -3 9 63 146 81\n    168 8 11 21 2 61 -41 28 -30 132 -141 231 -248z m-3247 184 c25 -18 102 -90\n    171 -161 141 -144 152 -153 265 -229 89 -59 194 -113 331 -171 91 -39 205\n    -106 205 -121 0 -8 -33 -4 -148 20 -60 12 -183 91 -549 353 -218 155 -224 160\n    -318 277 -52 65 -95 121 -95 124 0 3 21 -9 46 -27 25 -18 67 -47 92 -65z\n    m1795 46 c205 -118 457 -272 457 -279 0 -5 -14 -13 -31 -19 -30 -10 -43 -4\n    -276 130 -135 78 -247 148 -250 155 -5 12 13 54 23 54 3 0 38 -19 77 -41z\n    m4295 -122 l-3 -67 -37 36 c-37 34 -38 37 -38 107 l0 72 40 -41 c41 -40 41\n    -41 38 -107z m-4484 112 c20 -12 36 -23 36 -25 0 -12 -25 -54 -33 -54 -13 0\n    -67 33 -67 42 0 9 22 58 26 58 2 0 19 -9 38 -21z m2939 -161 c23 -24 27 -36\n    27 -85 0 -31 -2 -54 -5 -52 -2 2 -52 51 -110 109 -102 101 -106 106 -104 145\n    1 22 4 44 7 48 3 7 88 -69 185 -165z m442 -209 c121 -119 271 -265 334 -326\n    l114 -110 5 -89 5 -89 -64 60 c-35 33 -227 219 -426 414 l-363 355 0 85 0 86\n    88 -86 c48 -46 186 -182 307 -300z m-5085 252 c58 -41 143 -114 190 -162 117\n    -119 222 -201 237 -185 6 5 -27 39 -71 74 -16 12 -27 24 -25 27 3 2 103 -61\n    223 -141 120 -80 216 -147 213 -150 -9 -9 -153 49 -268 107 -207 105 -400 248\n    -549 407 -51 53 -96 106 -102 117 -11 19 -11 19 18 1 16 -10 76 -53 134 -95z\n    m-802 57 c9 -8 67 -68 127 -134 61 -65 175 -189 255 -274 132 -141 357 -384\n    670 -720 64 -69 204 -219 312 -335 309 -332 299 -321 285 -333 -15 -12 -152\n    -72 -165 -72 -5 0 -27 19 -47 43 -21 23 -63 69 -94 103 -31 33 -101 109 -156\n    169 -93 101 -213 233 -455 495 -633 688 -970 1059 -970 1069 0 3 50 6 111 5\n    83 -1 115 -5 127 -16z m-713 -50 c-51 -140 -45 -128 -260 -459 -46 -70 -88\n    -130 -95 -134 -9 -6 -11 -4 -5 6 5 8 59 95 121 194 61 99 142 239 179 310 75\n    144 75 145 79 145 2 0 -7 -28 -19 -62z m3538 -73 c225 -133 225 -133 152 -149\n    -25 -5 -50 5 -150 62 -128 74 -277 162 -284 168 -2 2 1 16 8 30 9 20 17 25 34\n    22 12 -2 120 -62 240 -133z m-3088 -215 c142 -157 279 -307 304 -335 54 -58\n    753 -840 915 -1023 59 -68 107 -125 104 -127 -5 -6 -266 121 -322 157 -34 22\n    -203 208 -570 627 -744 851 -690 785 -731 880 -39 92 -40 99 -23 136 l12 26\n    27 -28 c15 -15 143 -156 284 -313z m2726 303 c16 -10 29 -26 29 -36 0 -14 5\n    -17 20 -12 14 4 63 -20 170 -82 82 -48 160 -96 172 -105 23 -17 23 -18 -20\n    -18 -36 0 -69 16 -225 106 -203 119 -212 126 -204 148 8 20 22 20 58 -1z\n    m4310 -107 l113 -109 4 -59 c3 -33 1 -63 -4 -68 -5 -5 -62 42 -132 108 l-122\n    117 0 68 c0 55 3 66 14 60 8 -4 65 -57 127 -117z m-2960 6 c63 -67 405 -434\n    472 -507 26 -27 47 -57 47 -65 0 -18 -96 -170 -108 -170 -19 0 -582 608 -582\n    629 0 13 102 170 111 171 3 0 30 -26 60 -58z m1559 -59 l100 -96 0 -63 c0 -35\n    -4 -65 -8 -68 -5 -3 -53 41 -107 96 l-99 101 -2 64 c-1 35 2 63 7 63 5 0 54\n    -43 109 -97z m1620 -35 c0 -32 -4 -58 -8 -58 -5 0 -20 12 -34 28 -20 20 -27\n    39 -28 72 -3 88 -4 88 35 50 32 -31 35 -39 35 -92z m-5581 -112 c63 -44 109\n    -82 103 -84 -16 -5 -75 31 -202 121 -111 80 -180 138 -180 151 0 7 43 -22 279\n    -188z m4601 -313 c118 -116 243 -237 278 -270 l62 -59 0 -63 c0 -35 -4 -61 -9\n    -59 -5 2 -197 189 -425 416 l-416 412 0 62 0 63 148 -146 c81 -79 244 -240\n    362 -356z m-6983 354 c-41 -62 -92 -130 -112 -152 -20 -22 12 33 72 122 59 90\n    110 158 112 152 2 -6 -31 -61 -72 -122z m7743 -33 l120 -116 0 -75 c0 -41 -4\n    -73 -8 -71 -19 7 -232 213 -237 228 -11 35 -16 150 -6 150 6 0 64 -52 131\n    -116z m-3067 -51 c132 -138 462 -496 470 -510 5 -7 -25 -24 -87 -48 -110 -44\n    -98 -48 -205 70 -57 61 -200 216 -354 382 l-48 51 63 76 c35 42 64 76 66 76 1\n    0 44 -44 95 -97z m1664 -6 l93 -92 0 -67 c0 -38 -4 -68 -8 -68 -5 0 -52 44\n    -105 99 l-97 98 0 60 c0 57 6 79 19 68 3 -3 48 -47 98 -98z m1623 -24 c0 -72\n    -15 -82 -49 -34 -16 23 -21 44 -21 97 l0 68 35 -34 c33 -32 35 -38 35 -97z\n    m-1052 -345 l419 -417 7 -72 c3 -40 4 -74 1 -78 -8 -7 -831 816 -854 854 -13\n    22 -16 44 -13 83 2 29 8 52 13 50 4 -2 197 -191 427 -420z m-11066 251 c342\n    -333 853 -587 1283 -638 245 -29 390 -23 764 30 117 16 218 28 224 26 16 -5\n    -178 -45 -324 -67 -446 -66 -738 -41 -1119 97 -352 127 -744 389 -925 618 -70\n    88 -72 120 -3 40 29 -33 73 -81 100 -106z m8187 148 c-2 -2 -17 -13 -33 -25\n    -15 -12 -33 -19 -38 -16 -5 4 8 17 29 29 21 13 40 22 42 19 2 -2 2 -5 0 -7z\n    m3444 -135 c59 -58 110 -115 113 -127 3 -11 4 -48 2 -80 l-3 -60 -133 130\n    -133 130 -6 79 -6 80 29 -23 c16 -12 77 -70 137 -129z m-4816 102 c-3 -3 -12\n    -4 -19 -1 -8 3 -5 6 6 6 11 1 17 -2 13 -5z m-1796 -385 c410 -466 668 -764\n    664 -767 -6 -7 -84 48 -195 139 -205 166 -409 382 -561 594 -118 164 -250 382\n    -249 411 1 11 -10 23 341 -377z m3060 348 c-21 -26 -80 -52 -91 -41 -8 8 1 17\n    32 33 50 25 76 28 59 8z m-1264 -31 c43 -18 121 -45 173 -60 84 -25 158 -61\n    147 -72 -5 -6 -116 20 -203 47 -38 12 -99 42 -136 66 -97 65 -94 68 19 19z\n    m5081 -75 c61 -58 115 -115 121 -128 14 -30 14 -143 1 -143 -6 0 -64 52 -130\n    116 l-120 117 0 74 c0 41 4 73 8 71 5 -1 59 -50 120 -107z m-8546 27 c-54 -70\n    -170 -184 -178 -175 -7 6 208 238 215 231 2 -2 -15 -27 -37 -56z m5531 -277\n    c125 -134 186 -206 179 -213 -11 -11 -171 -78 -186 -78 -5 0 -21 13 -35 29\n    -14 16 -71 78 -127 137 -219 237 -274 298 -274 305 0 3 32 37 72 74 l71 68 56\n    -59 c31 -33 141 -151 244 -263z m-918 299 c8 -14 -92 -62 -123 -58 -45 5 -35\n    25 25 46 66 23 89 26 98 12z m2622 -261 c-3 -33 -7 -63 -9 -65 -4 -4 -175 164\n    -188 186 -11 18 -13 123 -3 134 4 4 52 -38 106 -93 l99 -100 -5 -62z m1533\n    124 l0 -78 -29 30 c-26 26 -30 39 -33 102 -3 40 -2 76 1 79 3 3 18 -8 33 -25\n    25 -28 28 -38 28 -108z m-614 -798 c3 -17 4 -52 2 -78 l-3 -48 -440 441 -440\n    440 -3 47 c-2 26 0 58 3 72 6 23 43 -12 441 -410 332 -332 435 -441 440 -464z\n    m-3731 873 c14 -6 25 -14 25 -18 0 -8 -100 -40 -124 -40 -22 0 -80 30 -72 37\n    5 5 107 30 133 32 7 1 24 -4 38 -11z m-401 -50 c23 -12 52 -28 65 -36 22 -15\n    22 -16 5 -23 -11 -4 -44 -8 -75 -8 -47 -1 -59 3 -79 24 -13 14 -29 25 -36 25\n    -7 0 -26 12 -41 26 l-28 25 74 -6 c44 -4 92 -15 115 -27z m4347 -190 c30 -29\n    43 -84 37 -152 l-3 -40 -133 130 -132 129 0 79 0 80 102 -100 c56 -54 114\n    -111 129 -126z m-4131 188 l44 -24 -57 -12 c-54 -13 -60 -12 -100 10 -79 43\n    -80 50 -2 50 53 -1 81 -7 115 -24z m-455 -26 c115 -22 135 -28 135 -42 0 -6\n    -36 -9 -93 -6 -85 3 -97 6 -143 35 -42 28 -46 33 -24 33 14 0 70 -9 125 -20z\n    m1307 -39 c13 -16 97 -109 187 -207 91 -99 174 -189 184 -201 l20 -23 -68 -31\n    c-38 -17 -79 -35 -92 -40 -20 -7 -40 11 -195 183 -95 105 -183 203 -196 219\n    l-23 28 67 50 c37 28 73 51 80 51 7 0 23 -13 36 -29z m3582 -208 c3 -8 6 -49\n    6 -91 l0 -77 -125 125 -125 125 0 78 0 79 119 -112 c66 -62 122 -119 125 -127z\n    m-1444 -77 l0 -80 -30 29 c-22 21 -30 38 -30 64 0 20 -3 54 -7 76 -6 36 -7 38\n    -14 15 -4 -14 -8 -41 -8 -60 l-1 -35 -55 57 -55 56 0 64 c0 36 3 68 7 72 4 3\n    49 -35 100 -86 l93 -93 0 -79z m1517 222 c20 -19 23 -31 23 -95 0 -40 -4 -73\n    -9 -73 -5 0 -18 11 -29 25 -14 18 -20 42 -21 95 -1 38 2 70 5 70 4 0 18 -10\n    31 -22z m-1024 -436 c336 -336 439 -445 447 -472 12 -43 13 -130 1 -130 -5 0\n    -210 203 -455 452 l-446 451 0 69 c0 37 3 68 8 68 4 0 204 -197 445 -438z\n    m-2816 374 c11 -13 53 -61 94 -106 41 -46 79 -88 84 -94 6 -6 47 -52 93 -102\n    45 -51 82 -94 82 -97 0 -2 -39 -22 -86 -43 -65 -29 -90 -35 -102 -28 -19 12\n    -362 394 -362 403 0 10 143 90 162 90 9 1 25 -10 35 -23z m3426 -169 c72 -70\n    77 -77 78 -118 1 -24 3 -63 5 -86 2 -24 0 -43 -4 -43 -4 0 -63 56 -131 124\n    l-125 125 -4 88 -4 88 53 -52 c30 -28 89 -85 132 -126z m-5208 54 c74 -30 162\n    -59 258 -86 48 -13 67 -25 106 -68 230 -251 451 -498 451 -505 0 -12 -183 -92\n    -207 -91 -10 0 -47 33 -83 73 -88 98 -260 286 -334 366 -100 107 -300 323\n    -321 349 l-20 23 40 -17 c22 -9 72 -29 110 -44z m5445 -74 l120 -119 0 -74 c0\n    -41 -4 -74 -8 -74 -4 0 -63 56 -130 123 l-122 124 0 72 c0 42 4 71 10 69 5 -1\n    63 -56 130 -121z m-3778 -29 c64 -73 146 -164 182 -203 36 -38 65 -73 66 -76\n    0 -11 -166 -81 -182 -77 -13 2 -328 346 -366 397 -11 16 -4 21 70 53 46 20 90\n    36 98 37 9 1 68 -59 132 -131z m2346 -76 l-3 -92 -52 51 -53 52 0 82 c0 45 3\n    85 7 89 4 4 29 -15 55 -42 l49 -48 -3 -92z m1632 46 c0 -81 -8 -94 -34 -56\n    -11 16 -16 46 -16 102 l0 79 25 -23 c23 -21 25 -31 25 -102z m-1040 -339 c245\n    -248 448 -456 451 -462 9 -15 23 -167 16 -167 -6 0 -810 808 -873 879 -27 29\n    -51 59 -54 67 -7 18 0 134 8 134 4 0 207 -203 452 -451z m-1803 384 c-19 -27\n    -44 -56 -54 -66 -18 -16 -21 -15 -53 18 -19 19 -32 35 -29 35 2 0 40 16 84 35\n    43 19 81 32 83 30 3 -2 -12 -26 -31 -52z m-1298 -181 c100 -112 181 -208 181\n    -213 0 -8 -105 -61 -177 -90 -20 -7 -43 14 -225 217 -112 124 -202 228 -201\n    232 2 9 203 61 225 59 9 -1 98 -94 197 -205z m-5229 178 c-14 -10 -72 -46\n    -130 -79 -321 -184 -695 -262 -1185 -248 -228 7 -447 39 -424 61 2 3 61 -2\n    129 -11 158 -20 552 -22 705 -4 328 39 596 120 820 249 91 53 131 67 85 32z\n    m4310 -46 c153 -9 129 6 319 -209 95 -106 173 -197 173 -202 1 -9 -179 -91\n    -202 -92 -18 -1 -85 67 -280 284 -79 88 -159 177 -179 199 l-36 39 60 -7 c33\n    -3 98 -9 145 -12z m2084 -25 c30 -35 33 -44 23 -59 -26 -37 -116 -130 -126\n    -130 -11 0 -130 130 -132 145 -1 9 164 84 188 85 6 0 27 -19 47 -41z m2505\n    -82 l121 -118 0 -66 0 -66 -22 19 c-13 10 -69 64 -125 120 -92 90 -103 105\n    -103 136 0 20 -3 50 -7 68 -4 22 -2 31 5 29 6 -2 65 -57 131 -122z m-3974 -68\n    c213 -239 247 -281 238 -289 -4 -4 -48 -24 -97 -45 l-88 -39 -54 59 c-29 33\n    -52 64 -51 69 2 5 23 17 47 27 54 22 42 24 -22 4 l-48 -14 -170 190 c-93 104\n    -170 193 -170 199 0 8 63 14 200 17 l55 2 160 -180z m2884 155 c18 -23 21 -41\n    21 -115 0 -49 -2 -89 -5 -89 -3 0 -17 12 -30 26 -23 24 -25 35 -25 115 0 49 4\n    89 9 89 5 0 19 -12 30 -26z m1479 -332 l-3 -82 -122 120 -123 119 0 88 0 88\n    125 -126 126 -125 -3 -82z m-3102 191 c38 -42 71 -80 73 -85 4 -11 -119 -127\n    -134 -128 -10 0 -171 176 -187 204 -5 9 18 24 75 49 45 20 87 36 93 37 6 0 42\n    -34 80 -77z m2121 -365 c237 -238 447 -450 466 -472 29 -33 35 -48 41 -105 13\n    -144 54 -174 -445 324 -248 248 -463 466 -478 485 -24 33 -26 42 -23 118 2 45\n    5 82 6 82 1 0 196 -195 433 -432z m-608 377 l41 -45 0 -82 0 -83 -55 57 -55\n    56 0 71 c0 86 10 90 69 26z m1661 26 c12 -24 14 -161 1 -161 -20 0 -31 31 -37\n    104 -6 66 -5 76 9 76 9 0 21 -9 27 -19z m-3368 -166 c51 -58 93 -109 93 -114\n    0 -13 -131 -111 -147 -110 -15 1 -223 235 -223 250 0 12 141 77 167 78 9 1 58\n    -46 110 -104z m2926 -20 c46 -44 91 -94 98 -112 15 -34 19 -143 6 -143 -4 0\n    -59 52 -122 115 l-115 115 -3 77 -4 78 28 -25 c15 -14 66 -61 112 -105z\n    m-1111 53 c20 -19 23 -31 23 -100 0 -43 -4 -78 -10 -78 -5 0 -18 10 -30 22\n    -17 18 -20 35 -20 100 0 43 3 78 7 78 4 0 17 -10 30 -22z m1401 -151 l92 -94\n    0 -69 0 -68 -52 49 c-28 28 -57 55 -63 60 -36 34 -55 71 -57 114 -1 43 -2 44\n    -5 9 -2 -21 -7 -38 -11 -38 -3 0 -21 14 -39 32 -31 30 -33 37 -33 96 l0 64 38\n    -30 c20 -17 79 -73 130 -125z m-9510 123 c-32 -19 -334 -101 -480 -131 -162\n    -32 -319 -46 -358 -32 -19 8 -3 11 75 17 110 8 417 67 620 120 139 37 172 42\n    143 26z m6086 -120 c64 -71 116 -134 116 -139 0 -10 -141 -101 -157 -101 -8 0\n    -181 188 -240 260 l-23 28 93 41 c50 22 93 41 93 41 1 0 54 -58 118 -130z\n    m1911 40 c45 -46 49 -53 53 -109 7 -101 -1 -105 -64 -37 l-54 60 0 68 c0 37 4\n    68 8 68 4 0 30 -22 57 -50z m1665 31 c13 -25 13 -171 0 -171 -19 0 -30 41 -30\n    114 0 76 10 94 30 57z m-990 -492 c386 -392 456 -467 462 -498 8 -43 10 -141\n    3 -141 -5 0 -458 457 -853 860 l-123 125 5 70 c3 39 5 71 6 73 1 13 106 -90\n    500 -489z m-2873 394 c28 -32 85 -96 127 -143 41 -47 76 -88 76 -92 0 -10\n    -175 -98 -193 -98 -16 0 -262 275 -262 293 0 9 172 94 196 96 3 1 28 -25 56\n    -56z m3533 -273 l0 -73 -22 19 c-13 10 -64 61 -114 113 -97 99 -104 114 -104\n    220 l0 36 120 -121 120 -121 0 -73z m-4141 203 c27 -32 47 -61 43 -65 -11 -10\n    -194 -88 -208 -88 -13 0 -104 103 -104 118 0 11 176 92 202 92 9 0 39 -26 67\n    -57z m4232 -81 c3 -42 4 -79 2 -81 -2 -3 -20 11 -40 31 -32 33 -37 44 -41 97\n    -2 33 -1 68 2 78 6 14 11 12 39 -15 29 -29 33 -40 38 -110z m-1312 102 c16\n    -21 21 -41 21 -90 0 -34 -4 -65 -9 -68 -19 -12 -49 39 -51 89 -5 103 2 116 39\n    69z m-2504 -126 c60 -68 120 -135 133 -150 l24 -26 -33 -17 c-18 -10 -63 -28\n    -100 -40 -53 -18 -71 -21 -82 -12 -24 20 -248 279 -244 283 5 5 180 83 188 83\n    3 1 55 -54 114 -121z m2395 31 l50 -52 0 -86 0 -86 -60 62 -60 61 0 76 c0 46\n    4 76 10 76 6 0 33 -23 60 -51z m540 -341 c478 -486 604 -616 611 -637 12 -32\n    21 -173 11 -170 -6 2 -86 83 -178 179 -92 96 -242 252 -333 345 -92 94 -239\n    246 -329 339 l-162 168 0 74 c0 41 3 74 6 74 4 0 172 -168 374 -372z m990 297\n    l75 -75 3 -80 c2 -44 2 -80 -1 -80 -12 0 -143 144 -148 163 -11 42 -20 147\n    -12 147 5 0 42 -34 83 -75z m128 63 c7 -7 12 -41 12 -82 0 -68 0 -69 -20 -51\n    -16 14 -20 31 -20 82 0 63 6 73 28 51z m-4729 -55 c28 -31 51 -60 51 -63 0 -9\n    -191 -90 -210 -90 -8 0 -39 27 -68 60 l-54 60 44 19 c115 50 164 70 175 71 6\n    0 34 -26 62 -57z m459 -113 c61 -71 114 -135 117 -142 4 -10 -22 -21 -99 -41\n    -57 -15 -111 -27 -119 -27 -18 0 -239 239 -234 253 4 13 198 96 211 90 6 -3\n    62 -63 124 -133z m3845 -8 c53 -54 97 -105 98 -113 0 -8 1 -35 1 -61 0 -27 4\n    -48 9 -48 4 0 9 21 11 48 l3 47 41 -42 c42 -44 54 -82 54 -172 l0 -36 -55 57\n    c-37 37 -53 62 -49 72 3 9 2 16 -4 16 -6 0 -12 -5 -14 -10 -2 -6 -52 38 -111\n    98 -93 95 -107 113 -108 143 0 19 -3 54 -6 77 -5 40 -4 43 13 34 11 -6 63 -55\n    117 -110z m201 -69 c4 -41 5 -77 2 -80 -3 -3 -23 14 -45 36 -41 42 -41 42 -41\n    118 l0 77 39 -38 c36 -35 39 -42 45 -113z m-4765 80 c28 -31 51 -61 51 -65 0\n    -8 -99 -55 -165 -79 -33 -12 -36 -11 -66 17 -17 16 -44 45 -60 65 l-29 37 98\n    40 c53 23 102 41 109 42 6 0 34 -26 62 -57z m3433 40 c15 -13 18 -31 18 -100\n    0 -45 -4 -83 -9 -83 -26 0 -41 47 -41 122 0 43 3 78 7 78 3 0 15 -7 25 -17z\n    m-2921 -211 c21 -25 35 -50 30 -55 -13 -13 -234 -36 -252 -26 -17 8 -161 164\n    -167 179 -2 4 46 28 105 53 l108 46 69 -75 c38 -42 86 -96 107 -122z m4479\n    139 c5 -11 10 -52 10 -92 0 -63 -2 -71 -14 -59 -17 19 -33 170 -17 170 6 0 15\n    -9 21 -19z m-1653 -56 c51 -53 53 -58 55 -113 l2 -57 3 49 4 48 25 -23 c22\n    -20 24 -30 24 -108 l0 -86 -95 96 -95 96 0 77 c0 51 4 76 12 76 6 0 35 -25 65\n    -55z m202 18 c46 -51 517 -538 722 -748 227 -231 248 -256 249 -285 0 -20 2\n    -22 11 -10 8 12 28 -4 109 -88 l99 -104 -36 -39 c-20 -21 -42 -39 -48 -39 -7\n    0 -31 21 -55 48 -23 26 -187 196 -364 377 -634 651 -614 628 -607 684 2 7 -2\n    10 -8 6 -6 -3 -11 -14 -11 -23 0 -11 -19 2 -55 38 l-55 54 0 83 c0 46 3 83 8\n    83 4 0 22 -17 41 -37z m-3786 -39 c64 -69 64 -67 -22 -103 -79 -33 -127 -24\n    -181 35 -23 26 -38 50 -34 54 11 11 167 79 175 76 3 0 31 -29 62 -62z m5197\n    -163 c0 -39 -2 -71 -5 -71 -3 0 -36 32 -74 71 l-69 71 -4 66 c-2 37 -2 71 1\n    76 2 5 37 -25 77 -66 l74 -75 0 -72z m-4792 100 c40 -44 72 -82 72 -85 0 -3\n    -65 -6 -144 -6 l-144 0 -36 42 c-20 23 -33 45 -29 49 14 14 168 78 189 78 13\n    1 45 -26 92 -78z m4629 -350 c3 -45 2 -81 -3 -81 -16 0 -313 304 -322 330 -5\n    14 -10 57 -11 95 l-2 70 166 -167 167 -166 5 -81z m-5300 357 c41 -38 29 -42\n    -56 -16 l-34 11 24 13 c33 18 39 17 66 -8z m371 -59 l24 -29 -54 1 c-29 1 -64\n    4 -78 9 -24 7 -23 8 20 28 57 27 60 27 88 -9z m5136 -25 c9 -25 7 -144 -3\n    -144 -15 0 -21 28 -21 96 0 61 11 83 24 48z m-1544 -254 l0 -75 -95 96 -95 96\n    0 60 c0 33 3 63 7 67 4 3 47 -33 95 -81 l88 -88 0 -75z m150 59 l0 -82 -22 19\n    c-12 10 -37 35 -55 54 -31 34 -33 38 -33 120 l0 85 55 -57 55 -56 0 -83z\n    m1286 104 l69 -68 5 -78 c3 -42 2 -77 -2 -77 -16 0 -127 113 -142 144 -16 35\n    -22 146 -8 146 5 0 40 -30 78 -67z m-208 -301 c4 -51 5 -92 2 -92 -3 0 -50 44\n    -104 99 l-98 98 -7 87 c-4 48 -4 89 -2 92 3 3 49 -40 104 -94 l98 -98 7 -92z\n    m-886 81 c201 -206 777 -801 806 -834 l22 -25 -33 -37 c-18 -20 -37 -37 -43\n    -37 -6 0 -55 46 -109 103 -98 102 -338 348 -642 658 l-163 165 0 82 c0 45 2\n    82 4 82 2 0 73 -71 158 -157z m1208 31 c0 -48 -4 -73 -10 -69 -5 3 -10 40 -10\n    81 0 48 4 73 10 69 6 -3 10 -40 10 -81z m-1637 -12 l87 -87 0 -63 c0 -34 -4\n    -62 -9 -62 -8 0 -155 155 -172 182 -11 16 -12 118 -1 118 4 0 47 -39 95 -88z\n    m188 6 c48 -51 49 -53 49 -115 0 -35 -3 -63 -7 -63 -4 0 -29 21 -55 47 -48 47\n    -48 47 -48 115 0 37 3 68 6 68 3 0 28 -23 55 -52z m1361 -39 l88 -91 0 -74 c0\n    -41 -4 -74 -8 -74 -5 0 -47 40 -95 89 l-87 88 0 77 c0 42 3 76 7 76 4 0 47\n    -41 95 -91z m-163 -53 l43 -44 6 -93 5 -93 -30 24 c-17 14 -37 34 -44 45 -14\n    21 -40 205 -29 205 3 0 25 -20 49 -44z m-152 -78 l101 -103 6 -70 c4 -38 9\n    -80 12 -92 2 -13 1 -23 -3 -23 -5 0 -54 46 -110 103 -73 73 -104 111 -107 132\n    -11 68 -15 155 -8 155 5 0 54 -46 109 -102z m-281 -614 c107 -111 194 -206\n    194 -211 0 -5 -14 -22 -31 -39 l-31 -29 -408 415 -409 415 0 75 0 75 245 -250\n    c135 -137 333 -341 440 -451z m-866 434 c0 -51 -3 -66 -12 -61 -7 3 -50 45\n    -95 93 l-83 88 0 59 c0 33 3 63 7 67 4 4 47 -35 95 -86 l87 -93 1 -67z m117\n    134 c31 -31 33 -38 33 -100 l0 -66 -55 54 -55 54 0 65 0 64 22 -19 c13 -10 38\n    -34 55 -52z m1346 -40 l87 -87 0 -72 c0 -109 -14 -108 -118 8 l-72 80 0 80 c0\n    43 3 79 8 79 4 0 47 -39 95 -88z m-1567 -114 c39 -40 79 -84 88 -98 16 -25 22\n    -105 9 -113 -5 -3 -46 36 -92 85 -81 86 -85 92 -89 144 -2 30 0 54 5 54 4 0\n    40 -33 79 -72z m917 -555 l159 -162 -23 -30 c-13 -16 -32 -33 -42 -36 -18 -7\n    -22 -3 -511 508 l-209 218 1 57 c0 31 1 62 1 67 1 6 106 -96 233 -225 127\n    -129 303 -308 391 -397z m534 229 l-48 -47 -114 120 c-122 128 -120 124 -129\n    250 l-6 70 172 -173 172 -172 -47 -48z m-30 356 c18 -18 33 -42 33 -55 0 -15\n    5 -21 13 -17 14 5 110 -75 127 -105 7 -13 0 -28 -30 -62 l-38 -44 -66 65 c-36\n    35 -68 71 -70 80 -9 34 -17 170 -10 170 5 0 23 -14 41 -32z m-1155 -177 c1\n    -39 0 -71 -3 -71 -3 0 -34 29 -67 64 -59 61 -62 67 -62 114 0 91 7 93 71 24\n    l57 -61 4 -70z m-210 -85 c46 -55 49 -61 44 -105 -2 -25 -5 -47 -5 -49 -2 -8\n    -27 16 -101 98 -67 75 -80 95 -80 124 0 67 9 71 53 29 21 -21 62 -64 89 -97z\n    m462 -116 c161 -164 265 -272 416 -433 l44 -47 -37 -38 -38 -37 -82 85 c-190\n    196 -513 543 -519 558 -4 10 -7 44 -7 76 l-1 59 21 -19 c12 -10 103 -102 203\n    -204z m-307 125 c53 -59 58 -69 63 -120 3 -31 3 -59 0 -61 -2 -3 -35 28 -72\n    68 -65 71 -67 75 -68 126 0 28 4 52 9 52 5 0 36 -29 68 -65z m-115 -263 c2\n    -24 1 -48 -3 -53 -3 -5 -45 31 -92 80 -82 85 -87 93 -87 134 0 24 3 47 8 51 4\n    5 44 -32 89 -80 72 -78 82 -93 85 -132z m74 135 c109 -117 114 -125 114 -185\n    l-1 -57 -74 80 c-73 78 -75 81 -75 133 0 28 3 52 8 52 4 0 16 -10 28 -23z\n    m443 -297 c85 -91 180 -191 210 -223 l55 -57 -30 -31 -30 -30 -165 173 c-354\n    371 -349 365 -349 442 l1 51 76 -80 c42 -44 146 -154 232 -245z m-519 -16 l-1\n    -59 -89 95 c-74 78 -90 101 -90 127 0 72 8 71 97 -19 l83 -85 0 -59z m66 148\n    c10 -9 45 -45 77 -79 56 -60 57 -63 57 -119 l0 -57 -80 84 c-78 83 -79 85 -80\n    137 0 28 2 52 3 52 2 0 13 -8 23 -18z m212 -53 c28 -32 32 -44 32 -95 l-1 -59\n    -44 50 c-41 45 -45 54 -45 103 0 60 6 61 58 1z m-277 -213 c9 -15 16 -146 9\n    -146 -6 0 -31 26 -142 147 -46 50 -48 55 -48 111 0 32 3 61 6 65 6 5 160 -150\n    175 -177z m437 42 c49 -51 128 -135 176 -187 l87 -94 -28 -29 -27 -28 -136\n    141 c-74 78 -143 154 -152 168 -16 23 -26 121 -14 121 3 0 45 -42 94 -92z\n    m-229 -148 l0 -55 -84 89 -85 90 0 55 1 56 84 -90 85 -90 -1 -55z m104 63 c3\n    -29 3 -53 -1 -53 -5 0 -25 17 -46 39 -32 33 -38 46 -43 97 l-5 59 45 -45 c39\n    -39 45 -52 50 -97z m-385 -74 c96 -100 100 -107 101 -161 1 -45 -7 -47 -39\n    -10 -12 15 -56 61 -96 103 -68 70 -74 80 -74 118 0 22 5 41 11 41 5 0 49 -41\n    97 -91z m522 -24 c117 -123 160 -172 160 -180 0 -13 -32 -45 -45 -45 -6 0 -59\n    52 -118 115 l-107 115 0 52 0 51 22 -19 c12 -10 51 -50 88 -89z m-230 -140 c0\n    -32 3 -55 7 -51 4 4 6 23 4 42 -2 27 1 35 12 32 16 -4 97 -94 97 -109 0 -6 4\n    -8 9 -5 9 6 111 -97 111 -112 0 -4 -14 -21 -30 -37 l-31 -29 -97 99 c-54 55\n    -132 136 -174 180 l-76 80 -7 75 -6 75 90 -91 91 -91 0 -58z m100 56 l0 -55\n    -45 49 c-41 46 -44 54 -44 105 l0 55 44 -49 c42 -46 45 -54 45 -105z m-381\n    -57 c99 -105 101 -108 101 -155 0 -26 3 -55 7 -65 14 -36 -24 -4 -124 104\n    l-103 111 0 56 c0 30 4 55 9 55 5 0 54 -48 110 -106z m471 19 c31 -32 73 -77\n    95 -101 l39 -42 -25 -25 -25 -26 -77 80 c-73 75 -77 81 -77 125 0 25 4 46 8\n    46 4 0 32 -26 62 -57z m-192 -152 c83 -88 152 -163 152 -167 0 -13 -32 -44\n    -45 -44 -7 0 -69 60 -137 133 -120 126 -126 134 -133 185 -4 28 -3 52 2 52 4\n    0 77 -72 161 -159z m-231 -102 c70 -74 73 -79 73 -125 l0 -49 -120 121 c-113\n    114 -120 123 -120 161 0 22 3 43 7 47 4 4 25 -12 47 -36 22 -24 73 -77 113\n    -119z m196 -23 c59 -63 107 -118 107 -123 0 -5 -11 -20 -25 -33 l-26 -24 -83\n    84 c-84 84 -84 85 -91 148 -4 36 -3 62 2 62 5 0 57 -51 116 -114z m-193 -131\n    l153 -156 -24 -25 -24 -26 -137 142 c-130 133 -138 143 -138 181 0 21 4 39 8\n    39 5 0 77 -70 162 -155z m159 -10 c53 -55 61 -67 51 -84 -19 -36 -32 -34 -77\n    12 -40 40 -46 51 -47 91 -1 25 1 46 5 46 3 0 34 -29 68 -65z m-194 -103 c55\n    -57 101 -110 103 -117 2 -8 -7 -24 -19 -36 l-22 -22 -98 100 -99 100 0 53 c0\n    63 -7 67 135 -78z m-40 -122 l79 -80 -21 -21 c-26 -26 -42 -19 -106 50 -40 43\n    -47 56 -47 91 0 22 3 40 8 40 4 0 43 -36 87 -80z m-36 -112 c40 -43 40 -43 21\n    -63 -19 -19 -20 -19 -50 10 -22 21 -30 38 -30 62 0 18 4 33 10 33 5 0 27 -19\n    49 -42z m-34 -108 c0 -7 -6 -15 -12 -17 -8 -3 -13 4 -13 17 0 13 5 20 13 18 6\n    -3 12 -11 12 -18z");
    			add_location(path0, file$7, 11, 9, 337);
    			attr_dev(path1, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path1, "d", "M13295 13524 c-33 -1 -874 -8 -1870 -13 -1771 -11 -2075 -15 -2075\n    -31 0 -17 467 -20 1535 -10 627 6 1553 14 2057 18 504 4 920 11 924 15 4 4 4\n    10 0 14 -7 7 -459 13 -571 7z");
    			add_location(path1, file$7, 1050, 10, 81808);
    			attr_dev(path2, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path2, "d", "M8565 13450 c-371 -67 -619 -117 -690 -139 -74 -24 -61 -25 41 -6 44\n    8 183 31 309 51 376 59 655 118 655 139 0 9 -49 2 -315 -45z");
    			add_location(path2, file$7, 1055, 10, 82046);
    			attr_dev(path3, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path3, "d", "M10794 13421 c3 -5 43 -13 88 -17 103 -10 2064 -12 2037 -2 -59 22\n    -2138 41 -2125 19z");
    			add_location(path3, file$7, 1059, 10, 82237);
    			attr_dev(path4, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path4, "d", "M11917 13342 c-5 -6 31 -12 106 -16 156 -9 557 -12 557 -5 0 16 -654\n    37 -663 21z");
    			add_location(path4, file$7, 1063, 10, 82386);
    			attr_dev(path5, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path5, "d", "M6607 13067 c-4 -10 -7 -141 -6 -290 1 -304 14 -313 24 -17 6 185 -3\n    343 -18 307z");
    			add_location(path5, file$7, 1067, 10, 82530);
    			attr_dev(path6, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path6, "d", "M7088 13041 c-42 -3 -80 -10 -85 -15 -9 -10 1079 2 1177 13 76 9\n    -977 11 -1092 2z");
    			add_location(path6, file$7, 1071, 10, 82675);
    			attr_dev(path7, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path7, "d", "M6706 12853 c3 -93 10 -172 15 -177 10 -11 12 227 3 298 -4 25 -11\n    46 -16 46 -6 0 -7 -66 -2 -167z");
    			add_location(path7, file$7, 1075, 10, 82820);
    			attr_dev(path8, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path8, "d", "M7232 12899 c-74 -5 -141 -14 -150 -19 -15 -10 -14 -10 3 -6 11 3\n    157 10 325 16 168 7 307 14 309 16 7 7 -346 2 -487 -7z");
    			add_location(path8, file$7, 1079, 10, 82981);
    			attr_dev(path9, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path9, "d", "M8740 13060 c-69 -4 -127 -8 -130 -10 -3 -1 11 -6 30 -10 20 -5 171\n    -4 345 3 264 10 295 13 210 18 -124 8 -292 8 -455 -1z");
    			add_location(path9, file$7, 1083, 10, 83164);
    			attr_dev(path10, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path10, "d", "M10893 12981 c-76 -4 -127 -11 -135 -19 -9 -9 -15 -82 -20 -250 -11\n    -344 -14 -589 -6 -597 7 -8 992 -24 1486 -25 319 0 342 1 342 18 0 9 3 168 7\n    352 9 487 9 498 -2 509 -12 12 -1485 23 -1672 12z m1630 -65 c4 -6 5 -29 3\n    -51 -3 -22 -9 -195 -13 -384 l-6 -344 -416 7 c-229 3 -618 9 -865 12 l-449 7\n    7 251 c3 138 9 310 13 383 l6 132 91 3 c50 2 435 1 856 -1 541 -3 767 -7 773\n    -15z");
    			add_location(path10, file$7, 1087, 10, 83348);
    			attr_dev(path11, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path11, "d", "M10943 12860 c-23 -9 -23 -12 -23 -183 0 -130 3 -178 14 -192 12 -17\n    28 -18 205 -16 105 1 191 -2 191 -6 -1 -4 -41 -34 -89 -66 -113 -75 -231 -161\n    -209 -154 9 3 83 49 165 103 178 116 204 130 228 117 16 -9 -2 -25 -174 -150\n    -2 -2 -2 -5 0 -8 3 -2 59 32 124 75 l120 80 140 0 c77 0 147 5 155 10 12 7 16\n    37 18 139 l4 130 64 42 c35 23 64 45 64 50 0 5 -27 -4 -60 -21 -71 -36 -80\n    -37 -80 -7 0 12 -4 27 -8 33 -5 8 -93 14 -277 18 -148 3 -333 8 -410 11 -78 3\n    -150 1 -162 -5z m455 -57 c61 -3 112 -9 112 -13 0 -4 -58 -42 -129 -84 -144\n    -88 -230 -152 -126 -95 33 18 116 67 185 108 l125 75 90 1 c89 0 90 0 93 -26\n    4 -32 -1 -36 -173 -151 l-140 -93 -232 -3 -233 -2 0 145 0 145 158 0 c86 0\n    208 -3 270 -7z m352 -132 c0 -12 -17 -29 -47 -47 -27 -15 -74 -45 -106 -66\n    -43 -29 -66 -38 -89 -36 -30 3 -23 9 97 85 72 45 133 83 138 83 4 0 7 -9 7\n    -19z m-4 -147 c-6 -16 -150 -21 -144 -4 2 5 35 29 73 54 l70 45 3 -41 c2 -22\n    1 -47 -2 -54z");
    			add_location(path11, file$7, 1095, 10, 83798);
    			attr_dev(path12, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path12, "d", "M12420 12840 c-30 -15 -77 -30 -105 -33 -84 -9 -105 -21 -105 -60 0\n    -25 -7 -38 -30 -55 -40 -30 -50 -28 -50 12 0 84 -51 126 -126 104 -57 -17 -64\n    -25 -64 -77 0 -60 20 -87 77 -104 l45 -13 -258 -174 c-296 -198 -269 -179\n    -263 -184 3 -3 63 33 134 79 72 46 213 137 314 202 225 145 218 141 235 117\n    11 -14 31 -20 75 -24 l61 -5 -97 -64 -98 -65 -97 0 c-53 -1 -99 -4 -103 -8 -4\n    -4 -8 -41 -9 -83 -1 -66 2 -78 19 -88 39 -23 67 -26 105 -11 42 17 70 67 70\n    124 0 37 16 52 129 119 90 55 160 107 131 98 -13 -4 -16 8 -15 74 l1 79 39 27\n    c50 33 49 32 44 37 -2 2 -29 -8 -59 -24z m-352 -98 c6 -9 12 -26 12 -39 0 -19\n    -5 -23 -33 -23 -42 0 -57 15 -57 57 0 31 1 32 33 27 17 -4 38 -14 45 -22z\n    m280 -15 c5 -26 -16 -47 -48 -47 -39 0 -45 25 -12 49 32 24 55 23 60 -2z\n    m-265 -286 c25 -24 6 -78 -31 -88 -28 -7 -52 16 -47 45 2 9 4 30 4 46 1 26 3\n    28 29 21 15 -3 35 -14 45 -24z");
    			add_location(path12, file$7, 1110, 10, 84807);
    			attr_dev(path13, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path13, "d", "M12299 12493 c-46 -7 -62 -35 -63 -111 l-1 -67 42 -14 c81 -29 123\n    10 131 121 3 43 1 59 -9 62 -26 8 -74 12 -100 9z m36 -35 c27 -12 31 -29 14\n    -76 -12 -35 -37 -48 -56 -30 -9 9 -11 29 -6 66 6 56 9 58 48 40z");
    			add_location(path13, file$7, 1124, 10, 85750);
    			attr_dev(path14, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path14, "d", "M9454 12963 c-38 -13 -130 -80 -121 -89 4 -4 152 55 175 69 6 5 12\n    12 12 17 0 16 -25 17 -66 3z");
    			add_location(path14, file$7, 1129, 10, 86021);
    			attr_dev(path15, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path15, "d", "M8811 12960 c-34 -3 -56 -10 -59 -19 -4 -11 3 -13 34 -8 22 4 88 7\n    148 7 60 0 107 3 103 6 -10 10 -167 19 -226 14z");
    			add_location(path15, file$7, 1133, 10, 86179);
    			attr_dev(path16, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path16, "d", "M9765 12899 c-7 -10 1 -21 53 -79 13 -14 37 -55 55 -92 18 -37 36\n    -67 41 -67 13 -1 -3 88 -26 142 -31 71 -104 128 -123 96z");
    			add_location(path16, file$7, 1137, 10, 86356);
    			attr_dev(path17, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path17, "d", "M12788 12860 c-12 -61 -19 -538 -11 -710 8 -162 8 -158 20 245 6 226\n    8 430 4 455 l-7 45 -6 -35z");
    			add_location(path17, file$7, 1141, 10, 86541);
    			attr_dev(path18, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path18, "d", "M9595 12871 c-3 -6 4 -19 15 -29 l21 -20 -35 -6 c-21 -4 -45 -2 -58\n    5 -21 11 -21 12 -3 25 37 27 3 27 -79 1 -103 -34 -153 -69 -188 -133 -58 -106\n    -46 -226 31 -327 46 -60 121 -127 143 -127 6 0 8 10 4 25 -5 21 -3 25 18 25\n    28 0 49 -21 40 -43 -8 -21 60 -40 102 -28 91 26 182 100 216 177 32 74 -4 91\n    -45 22 -28 -47 -74 -95 -83 -86 -3 4 2 18 12 32 19 30 12 45 -11 26 -9 -7 -18\n    -10 -22 -7 -3 4 -14 2 -24 -4 -25 -13 -24 -4 3 40 17 27 24 32 26 19 4 -19 22\n    -25 22 -8 0 6 11 10 23 10 32 0 57 30 57 66 0 23 -2 26 -11 14 -7 -12 -9 -8\n    -7 15 2 24 8 31 30 33 22 3 29 -2 34 -22 11 -46 24 -28 24 34 0 66 -20 116\n    -73 184 -55 69 -161 120 -182 87z m125 -105 c13 -17 11 -19 -40 -30 -27 -6\n    -37 -1 -59 26 -12 16 -10 20 10 37 23 19 24 19 50 0 14 -10 32 -25 39 -33z\n    m-165 -20 c137 -104 83 -355 -80 -374 -58 -6 -97 11 -140 60 -114 134 -25 359\n    137 345 31 -3 59 -13 83 -31z m208 -34 c19 -21 42 -80 34 -88 -3 -3 -19 -3\n    -35 1 -22 4 -32 14 -38 36 -11 37 -30 35 -28 -3 2 -38 -12 -35 -20 4 -3 17 -5\n    32 -4 33 8 6 64 34 69 35 3 0 13 -8 22 -18z m-36 -199 c-3 -10 -5 -4 -5 12 0\n    17 2 24 5 18 2 -7 2 -21 0 -30z m-121 -172 c-9 -14 -66 -34 -74 -27 -10 11 28\n    36 56 36 13 0 21 -4 18 -9z");
    			add_location(path18, file$7, 1145, 10, 86700);
    			attr_dev(path19, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path19, "d", "M9546 12658 c5 -30 4 -39 -4 -34 -16 10 -16 -44 0 -81 6 -15 10 -34\n    9 -40 -1 -7 2 -13 7 -13 11 0 32 76 32 115 0 33 -26 95 -40 95 -6 0 -8 -15 -4\n    -42z");
    			add_location(path19, file$7, 1163, 10, 87960);
    			attr_dev(path20, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path20, "d", "M9458 12473 c-10 -2 -18 -9 -18 -14 0 -15 36 -10 50 6 13 16 5 18\n    -32 8z");
    			add_location(path20, file$7, 1168, 10, 88176);
    			attr_dev(path21, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path21, "d", "M9496 12439 c-10 -6 -43 -9 -73 -7 -48 4 -52 3 -39 -10 8 -8 37 -17\n    66 -20 39 -4 55 -1 70 13 35 31 18 48 -24 24z");
    			add_location(path21, file$7, 1172, 10, 88312);
    			attr_dev(path22, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path22, "d", "M9163 12698 c-13 -26 -17 -59 -17 -153 -1 -139 11 -170 88 -245 40\n    -39 86 -68 86 -55 0 3 -20 30 -44 59 -74 91 -95 198 -72 364 7 54 6 62 -7 62\n    -9 0 -24 -15 -34 -32z");
    			add_location(path22, file$7, 1176, 10, 88488);
    			attr_dev(path23, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path23, "d", "M8890 12643 c-46 -17 -100 -111 -100 -174 0 -102 146 -114 196 -17\n    34 65 15 157 -37 183 -30 16 -35 17 -59 8z m45 -75 c18 -44 11 -47 -25 -13\n    -35 34 -38 45 -10 45 14 0 26 -11 35 -32z m-10 -68 c10 -11 14 -20 8 -20 -5 0\n    -18 9 -28 20 -10 11 -14 20 -8 20 5 0 18 -9 28 -20z");
    			add_location(path23, file$7, 1181, 10, 88719);
    			attr_dev(path24, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path24, "d", "M10153 12610 c-133 -81 -62 -297 83 -250 76 25 111 114 76 194 -32\n    72 -96 95 -159 56z m103 -65 c25 -38 11 -41 -28 -6 -31 28 -31 30 -11 31 13 0\n    29 -11 39 -25z m-26 -110 c21 -26 -4 -17 -48 17 -23 18 -42 38 -42 46 0 14 63\n    -30 90 -63z");
    			add_location(path24, file$7, 1187, 10, 89057);
    			attr_dev(path25, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path25, "d", "M9864 12398 c-53 -99 -117 -162 -209 -204 -40 -19 -78 -34 -84 -34\n    -6 0 -11 -5 -11 -11 0 -28 177 22 234 66 67 51 146 197 130 240 -10 26 -20 17\n    -60 -57z");
    			add_location(path25, file$7, 1193, 10, 89359);
    			attr_dev(path26, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path26, "d", "M8843 12273 c-62 -12 -112 -106 -93 -173 14 -47 31 -67 72 -84 75\n    -32 158 36 158 129 0 79 -67 141 -137 128z m59 -70 c10 -9 18 -23 18 -31 0\n    -12 -6 -10 -25 8 -38 35 -31 58 7 23z m3 -73 c10 -11 14 -20 8 -20 -5 0 -18 9\n    -28 20 -10 11 -14 20 -8 20 5 0 18 -9 28 -20z");
    			add_location(path26, file$7, 1198, 10, 89578);
    			attr_dev(path27, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path27, "d", "M10160 12243 c-122 -62 -96 -263 35 -263 67 0 124 69 125 152 0 94\n    -81 151 -160 111z m95 -73 c19 -38 10 -38 -35 0 l-35 29 27 1 c21 0 31 -8 43\n    -30z m-59 -72 c24 -17 44 -35 44 -40 0 -10 -85 46 -95 62 -11 18 6 11 51 -22z\n    m-11 -56 c-7 -8 -35 7 -35 18 0 6 7 6 20 -2 10 -7 17 -14 15 -16z");
    			add_location(path27, file$7, 1204, 10, 89909);
    			attr_dev(path28, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path28, "d", "M6625 11991 c23 -10 201 -26 435 -41 354 -22 991 -38 978 -25 -2 2\n    -290 18 -639 35 -349 16 -670 32 -714 35 -48 3 -72 1 -60 -4z");
    			add_location(path28, file$7, 1210, 10, 90262);
    			attr_dev(path29, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path29, "d", "M6768 11761 c-86 -3 -160 -9 -164 -13 -9 -10 982 -8 1166 1 l135 8\n    -161 1 c-88 1 -309 4 -490 6 -181 2 -400 1 -486 -3z");
    			add_location(path29, file$7, 1214, 10, 90452);
    			attr_dev(path30, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path30, "d", "M6755 11649 c125 -10 390 -9 315 1 -30 5 -134 8 -230 7 -152 0 -163\n    -1 -85 -8z");
    			add_location(path30, file$7, 1218, 10, 90633);
    			attr_dev(path31, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path31, "d", "M11210 11612 c32 -21 732 -53 1095 -51 260 2 175 12 -280 33 -454 21\n    -834 30 -815 18z");
    			add_location(path31, file$7, 1222, 10, 90775);
    			attr_dev(path32, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path32, "d", "M12750 11480 c-28 -104 -77 -348 -170 -850 -28 -151 -65 -350 -84\n    -442 -18 -93 -30 -168 -27 -168 16 0 251 1143 291 1413 13 87 8 112 -10 47z");
    			add_location(path32, file$7, 1226, 10, 90924);
    			attr_dev(path33, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path33, "d", "M11688 11493 c-103 -9 -39 -20 155 -26 276 -9 407 -9 407 2 0 12\n    -470 33 -562 24z");
    			add_location(path33, file$7, 1230, 10, 91127);
    			attr_dev(path34, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path34, "d", "M8210 11393 c-542 -303 -1275 -731 -1267 -740 6 -6 187 85 317 160\n    155 89 1003 598 1015 608 16 16 1 9 -65 -28z");
    			add_location(path34, file$7, 1234, 10, 91272);
    			attr_dev(path35, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path35, "d", "M11776 11371 c13 -13 244 -26 244 -14 0 6 -41 13 -92 17 -126 9 -164\n    8 -152 -3z");
    			add_location(path35, file$7, 1238, 10, 91446);
    			attr_dev(path36, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path36, "d", "M7396 11145 c-225 -117 -245 -129 -232 -142 10 -11 340 168 456 246\n    50 34 -33 -4 -224 -104z");
    			add_location(path36, file$7, 1242, 10, 91589);
    			attr_dev(path37, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path37, "d", "M12734 9905 c3 -417 13 -712 53 -1545 13 -282 15 -112 4 325 -6 237\n    -18 702 -26 1035 -9 333 -20 619 -25 635 -6 19 -8 -150 -6 -450z");
    			add_location(path37, file$7, 1246, 10, 91744);
    			attr_dev(path38, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path38, "d", "M6776 5795 c-9 -238 1 -1220 13 -1335 9 -86 12 1336 2 1465 -6 95 -7\n    88 -15 -130z");
    			add_location(path38, file$7, 1250, 10, 91938);
    			attr_dev(path39, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path39, "d", "M12110 5833 c-74 -30 -331 -134 -570 -230 -456 -184 -974 -398 -1000\n    -413 -29 -18 -2 -10 71 21 41 17 238 93 439 171 564 216 1055 420 1189 493 50\n    27 4 12 -129 -42z");
    			add_location(path39, file$7, 1254, 10, 92083);
    			attr_dev(path40, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path40, "d", "M12660 5593 c1 -674 39 -2157 57 -2173 6 -5 -2 707 -17 1475 -15 762\n    -22 995 -31 995 -5 0 -9 -134 -9 -297z");
    			add_location(path40, file$7, 1259, 10, 92313);
    			attr_dev(path41, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path41, "d", "M6686 5428 c-14 -56 -28 -638 -22 -955 5 -315 24 -679 33 -669 3 2 3\n    152 2 333 -2 180 -2 550 0 821 2 270 1 492 -1 492 -3 0 -8 -10 -12 -22z");
    			add_location(path41, file$7, 1263, 10, 92483);
    			attr_dev(path42, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path42, "d", "M11713 5336 c-165 -69 -387 -175 -381 -182 5 -5 520 224 533 237 14\n    14 9 12 -152 -55z");
    			add_location(path42, file$7, 1267, 10, 92685);
    			attr_dev(path43, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path43, "d", "M10470 5160 c-8 -5 -10 -10 -5 -10 6 0 17 5 25 10 8 5 11 10 5 10 -5\n    0 -17 -5 -25 -10z");
    			add_location(path43, file$7, 1271, 10, 92834);
    			attr_dev(path44, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path44, "d", "M9255 4854 c-391 -116 -644 -193 -905 -276 -391 -123 -1324 -434\n    -1365 -454 l-30 -14 39 6 c71 10 262 70 826 259 642 215 1023 339 1305 425\n    231 70 226 68 200 69 -11 0 -42 -7 -70 -15z");
    			add_location(path44, file$7, 1275, 10, 92984);
    			attr_dev(path45, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path45, "d", "M12074 4363 c-131 -136 -314 -324 -406 -418 -91 -93 -165 -172 -163\n    -174 14 -14 244 207 505 484 138 147 313 346 308 351 -3 2 -113 -107 -244\n    -243z");
    			add_location(path45, file$7, 1280, 10, 93232);
    			attr_dev(path46, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path46, "d", "M8435 4353 c-163 -40 -851 -260 -841 -270 2 -3 71 14 153 37 249 71\n    834 268 688 233z");
    			add_location(path46, file$7, 1285, 10, 93445);
    			attr_dev(path47, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path47, "d", "M11958 3942 c-57 -49 -121 -106 -143 -127 -61 -58 -25 -55 43 3 71\n    63 219 212 209 212 -3 0 -53 -40 -109 -88z");
    			add_location(path47, file$7, 1289, 10, 93593);
    			attr_dev(path48, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path48, "d", "M8800 3863 c0 -26 259 -60 1090 -143 333 -33 685 -70 784 -81 98 -11\n    180 -18 182 -16 10 10 -489 72 -1046 132 -755 80 -979 105 -994 111 -9 3 -16\n    2 -16 -3z");
    			add_location(path48, file$7, 1293, 10, 93765);
    			attr_dev(path49, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path49, "d", "M7321 3846 c9 -9 343 -53 1574 -206 1219 -152 1476 -183 2415 -295\n    908 -108 1169 -137 1188 -133 9 2 -129 22 -308 46 -179 23 -444 58 -590 77\n    -1833 242 -3489 445 -3990 489 -96 9 -202 18 -235 22 -33 3 -57 3 -54 0z");
    			add_location(path49, file$7, 1298, 10, 93986);
    			attr_dev(path50, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path50, "d", "M12543 3203 c9 -2 23 -2 30 0 6 3 -1 5 -18 5 -16 0 -22 -2 -12 -5z");
    			add_location(path50, file$7, 1303, 10, 94264);
    			attr_dev(path51, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path51, "d", "M3853 10605 c-193 -52 -608 -251 -626 -300 -4 -8 -4 -15 0 -15 3 0\n    85 43 183 95 264 142 434 215 497 215 14 0 21 4 18 10 -7 12 -7 12 -72 -5z");
    			add_location(path51, file$7, 1306, 10, 94390);
    			attr_dev(path52, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path52, "d", "M5120 10285 c0 -15 85 -60 151 -80 24 -8 24 -8 5 14 -29 32 -110 81\n    -134 81 -13 0 -22 -6 -22 -15z");
    			add_location(path52, file$7, 1310, 10, 94593);
    			attr_dev(path53, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path53, "d", "M4232 10123 c-140 -159 -272 -320 -272 -331 0 -8 17 10 253 267 150\n    164 185 211 158 211 -5 0 -67 -66 -139 -147z");
    			add_location(path53, file$7, 1314, 10, 94754);
    			attr_dev(path54, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path54, "d", "M3032 10193 c-148 -76 -421 -350 -570 -570 -76 -113 -172 -329 -241\n    -547 -36 -113 -38 -164 -2 -66 111 304 266 576 455 797 107 125 167 182 324\n    306 61 49 110 93 106 98 -8 13 -15 12 -72 -18z");
    			add_location(path54, file$7, 1318, 10, 94929);
    			attr_dev(path55, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path55, "d", "M4268 10078 c-52 -64 -88 -121 -88 -138 0 -9 6 -5 17 10 9 14 41 53\n    70 88 29 35 53 67 53 73 0 19 -19 7 -52 -33z");
    			add_location(path55, file$7, 1323, 10, 95184);
    			attr_dev(path56, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path56, "d", "M5540 9956 c0 -3 29 -50 65 -105 72 -109 177 -314 236 -461 44 -109\n    51 -105 14 7 -80 239 -229 518 -295 553 -11 6 -20 8 -20 6z");
    			add_location(path56, file$7, 1327, 10, 95359);
    			attr_dev(path57, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path57, "d", "M3175 9868 c-2 -7 -11 -56 -20 -108 -28 -168 -85 -361 -180 -615 l-7\n    -20 14 20 c8 11 35 72 60 135 114 286 185 572 148 595 -6 3 -12 0 -15 -7z");
    			add_location(path57, file$7, 1331, 10, 95548);
    			attr_dev(path58, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path58, "d", "M3427 9823 c-3 -5 -19 -66 -37 -138 -48 -193 -145 -475 -289 -832\n    -28 -71 -16 -67 16 5 169 378 309 772 320 905 5 61 2 80 -10 60z");
    			add_location(path58, file$7, 1335, 10, 95752);
    			attr_dev(path59, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path59, "d", "M5294 9625 c29 -166 122 -483 193 -652 32 -77 20 -19 -28 132 -27 88\n    -70 243 -95 345 -25 102 -52 192 -61 200 -14 14 -15 11 -9 -25z");
    			add_location(path59, file$7, 1339, 10, 95944);
    			attr_dev(path60, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path60, "d", "M3000 9458 c-53 -190 -57 -209 -30 -145 25 61 82 273 78 292 -2 8\n    -23 -58 -48 -147z");
    			add_location(path60, file$7, 1343, 10, 96138);
    			attr_dev(path61, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path61, "d", "M4977 9530 c-16 -36 -23 -159 -15 -253 16 -190 65 -353 239 -796 59\n    -150 41 -69 -32 145 -146 426 -169 520 -178 754 -4 91 -10 158 -14 150z");
    			add_location(path61, file$7, 1347, 10, 96285);
    			attr_dev(path62, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path62, "d", "M4602 9323 c-71 -97 -190 -293 -374 -613 -147 -255 -406 -697 -449\n    -766 -22 -33 -39 -65 -39 -70 0 -24 283 430 553 886 77 130 375 637 384 653 2\n    4 2 7 0 7 -2 0 -36 -44 -75 -97z");
    			add_location(path62, file$7, 1351, 10, 96486);
    			attr_dev(path63, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path63, "d", "M5440 9363 c0 -45 86 -360 96 -350 5 5 -38 210 -63 300 -16 58 -33\n    84 -33 50z");
    			add_location(path63, file$7, 1356, 10, 96728);
    			attr_dev(path64, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path64, "d", "M4269 9192 c-172 -241 -462 -729 -484 -812 -3 -14 20 22 53 80 105\n    187 312 525 440 718 41 62 73 114 71 117 -2 2 -38 -44 -80 -103z");
    			add_location(path64, file$7, 1360, 10, 96869);
    			attr_dev(path65, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path65, "d", "M5956 9193 c-4 -9 6 -80 21 -157 48 -247 35 -568 -36 -896 -11 -47\n    -17 -87 -15 -89 19 -19 107 305 124 459 17 140 7 405 -19 531 -29 142 -57 199\n    -75 152z");
    			add_location(path65, file$7, 1364, 10, 97062);
    			attr_dev(path66, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path66, "d", "M5877 8945 c8 -158 -35 -606 -82 -851 -16 -85 -15 -106 3 -45 68 225\n    126 732 103 894 -18 126 -31 127 -24 2z");
    			add_location(path66, file$7, 1369, 10, 97281);
    			attr_dev(path67, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path67, "d", "M5130 8960 c0 -24 70 -237 103 -310 27 -60 18 -12 -18 105 -46 146\n    -84 239 -85 205z");
    			add_location(path67, file$7, 1373, 10, 97452);
    			attr_dev(path68, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path68, "d", "M2811 8811 c-62 -144 -88 -386 -71 -654 13 -206 49 -599 55 -606 7\n    -6 6 22 -10 334 -17 327 -19 562 -5 660 8 58 46 226 66 298 11 38 -15 14 -35\n    -32z");
    			add_location(path68, file$7, 1377, 10, 97599);
    			attr_dev(path69, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path69, "d", "M5741 8528 c-7 -144 -15 -267 -18 -275 -3 -7 -1 -13 5 -13 22 0 57\n    530 35 543 -6 4 -14 -92 -22 -255z");
    			add_location(path69, file$7, 1382, 10, 97813);
    			attr_dev(path70, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path70, "d", "M2172 8743 c-11 -28 -8 -361 3 -372 7 -7 10 32 10 117 0 70 4 160 8\n    200 6 50 5 72 -3 72 -6 0 -14 -8 -18 -17z");
    			add_location(path70, file$7, 1386, 10, 97977);
    			attr_dev(path71, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path71, "d", "M4302 8563 c-173 -293 -364 -644 -377 -693 -4 -14 31 43 78 125 46\n    83 132 231 191 330 115 194 193 342 184 351 -3 3 -37 -48 -76 -113z");
    			add_location(path71, file$7, 1390, 10, 98149);
    			attr_dev(path72, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path72, "d", "M2451 8587 c-37 -97 -4 -548 48 -667 l12 -25 -6 25 c-23 110 -38 300\n    -39 482 -1 115 -2 208 -4 208 -1 0 -6 -10 -11 -23z");
    			add_location(path72, file$7, 1394, 10, 98345);
    			attr_dev(path73, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path73, "d", "M3175 8502 c-14 -122 46 -424 129 -655 33 -92 65 -161 66 -144 0 5\n    -18 66 -40 135 -75 242 -112 423 -126 625 -4 53 -10 97 -14 97 -5 0 -11 -26\n    -15 -58z");
    			add_location(path73, file$7, 1398, 10, 98527);
    			attr_dev(path74, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path74, "d", "M2646 8427 c-8 -74 -7 -240 4 -322 15 -121 75 -425 83 -425 5 0 6 8\n    3 18 -25 81 -66 503 -66 674 0 106 -14 138 -24 55z");
    			add_location(path74, file$7, 1403, 10, 98744);
    			attr_dev(path75, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path75, "d", "M3315 8330 c-19 -88 75 -410 136 -466 14 -13 12 -3 -11 42 -37 75\n    -86 265 -95 372 -8 85 -19 104 -30 52z");
    			add_location(path75, file$7, 1407, 10, 98925);
    			attr_dev(path76, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path76, "d", "M5197 7770 c-58 -121 -229 -370 -319 -465 -141 -150 -265 -214 -503\n    -262 -137 -27 -373 -25 -485 5 -147 39 -294 118 -396 213 -49 45 -125 127\n    -147 158 -25 37 -31 18 -9 -31 26 -58 141 -175 229 -232 165 -107 326 -155\n    543 -163 229 -8 413 31 594 125 100 53 186 134 286 267 90 122 216 342 249\n    435 19 57 -4 28 -42 -50z");
    			add_location(path76, file$7, 1411, 10, 99092);
    			attr_dev(path77, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path77, "d", "M5743 7697 c-50 -78 -135 -205 -188 -282 -114 -165 -113 -164 -93\n    -147 24 19 177 224 241 323 64 98 141 238 135 244 -2 3 -45 -60 -95 -138z");
    			add_location(path77, file$7, 1418, 10, 99478);
    			attr_dev(path78, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path78, "d", "M4844 7557 c-53 -82 -152 -191 -233 -258 -49 -41 -88 -76 -86 -77 2\n    -2 24 6 50 17 80 35 227 197 289 319 21 42 7 41 -20 -1z");
    			add_location(path78, file$7, 1422, 10, 99679);
    			attr_dev(path79, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path79, "d", "M8828 10038 c-8 -21 2 -38 24 -38 14 0 19 6 16 22 -3 25 -33 36 -40\n    16z");
    			add_location(path79, file$7, 1426, 10, 99865);
    			attr_dev(path80, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path80, "d", "M8737 9963 c-11 -10 -8 -41 4 -49 17 -10 32 12 24 35 -6 21 -16 26\n    -28 14z");
    			add_location(path80, file$7, 1430, 10, 100000);
    			attr_dev(path81, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path81, "d", "M8813 9944 c-3 -9 0 -20 8 -24 18 -12 50 7 43 25 -8 20 -43 19 -51\n    -1z");
    			add_location(path81, file$7, 1434, 10, 100138);
    			attr_dev(path82, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path82, "d", "M8790 9865 c-10 -11 -10 -19 -2 -27 15 -15 44 -2 40 19 -4 23 -22 27\n    -38 8z");
    			add_location(path82, file$7, 1438, 10, 100272);
    			attr_dev(path83, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path83, "d", "M8690 9775 c-11 -13 -11 -19 2 -32 17 -16 38 -10 38 11 0 8 -6 19\n    -14 25 -10 9 -16 8 -26 -4z");
    			add_location(path83, file$7, 1442, 10, 100411);
    			attr_dev(path84, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path84, "d", "M8780 9699 c-10 -17 -9 -24 4 -37 15 -15 17 -15 33 1 13 13 15 21 7\n    34 -16 26 -31 26 -44 2z");
    			add_location(path84, file$7, 1446, 10, 100567);
    			attr_dev(path85, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path85, "d", "M8585 9700 c-8 -14 13 -40 32 -40 20 0 12 44 -9 48 -9 2 -19 -2 -23\n    -8z");
    			add_location(path85, file$7, 1450, 10, 100722);
    			attr_dev(path86, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path86, "d", "M8701 9677 c-14 -17 -4 -47 15 -47 22 0 29 29 12 46 -13 13 -16 13\n    -27 1z");
    			add_location(path86, file$7, 1454, 10, 100857);
    			attr_dev(path87, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path87, "d", "M8592 9598 c5 -34 38 -37 38 -4 0 20 -5 26 -21 26 -15 0 -20 -5 -17\n    -22z");
    			add_location(path87, file$7, 1458, 10, 100994);
    			attr_dev(path88, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path88, "d", "M8782 9568 c-16 -16 -15 -33 2 -47 21 -18 41 11 26 38 -13 25 -12 25\n    -28 9z");
    			add_location(path88, file$7, 1462, 10, 101130);
    			attr_dev(path89, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path89, "d", "M8602 9551 c-21 -13 -11 -56 13 -56 15 0 20 7 20 29 0 31 -12 41 -33\n    27z");
    			add_location(path89, file$7, 1466, 10, 101269);
    			attr_dev(path90, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path90, "d", "M8701 9496 c-9 -10 -8 -16 4 -26 13 -11 19 -10 33 4 15 15 15 18 2\n    26 -20 13 -26 12 -39 -4z");
    			add_location(path90, file$7, 1470, 10, 101405);
    			attr_dev(path91, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path91, "d", "M8781 9446 c-17 -20 13 -43 34 -26 8 7 15 19 15 26 0 18 -34 18 -49\n    0z");
    			add_location(path91, file$7, 1474, 10, 101560);
    			attr_dev(path92, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path92, "d", "M8492 9438 c-15 -15 3 -48 27 -48 25 0 34 26 15 45 -18 18 -26 19\n    -42 3z");
    			add_location(path92, file$7, 1478, 10, 101694);
    			attr_dev(path93, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path93, "d", "M8707 9403 c-11 -10 -8 -38 4 -50 18 -18 39 -3 39 28 0 21 -5 29 -18\n    29 -10 0 -22 -3 -25 -7z");
    			add_location(path93, file$7, 1482, 10, 101830);
    			attr_dev(path94, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path94, "d", "M8605 9379 c-10 -30 18 -58 40 -39 22 18 15 54 -12 58 -15 2 -23 -3\n    -28 -19z");
    			add_location(path94, file$7, 1486, 10, 101986);
    			attr_dev(path95, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path95, "d", "M8431 9381 c-19 -12 -6 -43 16 -39 10 2 18 12 18 22 0 22 -14 29 -34\n    17z");
    			add_location(path95, file$7, 1490, 10, 102126);
    			attr_dev(path96, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path96, "d", "M8797 9384 c-4 -4 -7 -18 -7 -31 0 -17 6 -23 21 -23 16 0 20 5 17 27\n    -3 26 -18 39 -31 27z");
    			add_location(path96, file$7, 1494, 10, 102262);
    			attr_dev(path97, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path97, "d", "M8527 9302 c-13 -14 -14 -21 -5 -30 18 -18 36 -14 43 8 12 38 -11 52\n    -38 22z");
    			add_location(path97, file$7, 1498, 10, 102415);
    			attr_dev(path98, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path98, "d", "M8705 9269 c-10 -30 18 -58 40 -39 22 18 15 54 -12 58 -15 2 -23 -3\n    -28 -19z");
    			add_location(path98, file$7, 1502, 10, 102555);
    			attr_dev(path99, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path99, "d", "M8633 9273 c-17 -6 -17 -60 0 -66 23 -9 39 9 35 38 -3 29 -13 37 -35\n    28z");
    			add_location(path99, file$7, 1506, 10, 102695);
    			attr_dev(path100, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path100, "d", "M8430 9206 c0 -27 22 -40 38 -24 8 8 8 17 1 30 -14 26 -39 23 -39 -6z");
    			add_location(path100, file$7, 1510, 10, 102831);
    			attr_dev(path101, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path101, "d", "M8530 9201 c-12 -23 -5 -47 17 -55 23 -9 33 2 33 40 0 27 -4 34 -20\n    34 -10 0 -24 -9 -30 -19z");
    			add_location(path101, file$7, 1513, 10, 102960);
    			attr_dev(path102, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path102, "d", "M8793 9174 c-8 -20 9 -49 28 -49 8 0 15 13 17 33 3 27 0 32 -18 32\n    -11 0 -23 -7 -27 -16z");
    			add_location(path102, file$7, 1517, 10, 103116);
    			attr_dev(path103, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path103, "d", "M8725 9164 c-11 -12 -12 -20 -5 -35 18 -33 63 -16 53 21 -7 26 -29\n    32 -48 14z");
    			add_location(path103, file$7, 1521, 10, 103268);
    			attr_dev(path104, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path104, "d", "M8450 9135 c-15 -18 -6 -45 13 -45 8 0 20 7 27 15 10 12 10 18 0 30\n    -16 19 -24 19 -40 0z");
    			add_location(path104, file$7, 1525, 10, 103409);
    			attr_dev(path105, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path105, "d", "M8634 9125 c-9 -23 3 -45 26 -45 20 0 25 15 14 44 -8 20 -33 21 -40\n    1z");
    			add_location(path105, file$7, 1529, 10, 103561);
    			attr_dev(path106, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path106, "d", "M8377 9073 c-12 -12 -7 -51 7 -56 20 -8 39 18 31 43 -6 20 -25 26\n    -38 13z");
    			add_location(path106, file$7, 1533, 10, 103695);
    			attr_dev(path107, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path107, "d", "M8752 9038 c-16 -16 -15 -33 4 -48 22 -19 54 12 38 37 -14 22 -27 26\n    -42 11z");
    			add_location(path107, file$7, 1537, 10, 103832);
    			attr_dev(path108, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path108, "d", "M8476 9018 c-11 -15 -12 -26 -5 -40 19 -36 63 -9 52 33 -7 27 -31 31\n    -47 7z");
    			add_location(path108, file$7, 1541, 10, 103972);
    			attr_dev(path109, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path109, "d", "M8547 8998 c-6 -18 11 -48 28 -48 19 0 25 12 18 38 -6 24 -38 30 -46\n    10z");
    			add_location(path109, file$7, 1545, 10, 104111);
    			attr_dev(path110, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path110, "d", "M8647 8966 c-7 -18 3 -56 14 -56 14 0 41 48 34 60 -9 15 -42 12 -48\n    -4z");
    			add_location(path110, file$7, 1549, 10, 104247);
    			attr_dev(path111, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path111, "d", "M8391 8951 c-7 -13 -6 -24 3 -36 16 -22 36 -12 36 20 0 29 -26 40\n    -39 16z");
    			add_location(path111, file$7, 1553, 10, 104382);
    			attr_dev(path112, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path112, "d", "M8852 8933 c2 -10 13 -19 26 -21 17 -3 22 2 22 17 0 16 -6 21 -26 21\n    -19 0 -25 -5 -22 -17z");
    			add_location(path112, file$7, 1557, 10, 104519);
    			attr_dev(path113, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path113, "d", "M8487 8913 c-10 -9 -9 -43 1 -43 18 0 45 28 38 38 -8 13 -29 16 -39\n    5z");
    			add_location(path113, file$7, 1561, 10, 104673);
    			attr_dev(path114, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path114, "d", "M8584 8907 c-11 -29 0 -62 22 -65 27 -4 36 18 21 48 -15 29 -35 37\n    -43 17z");
    			add_location(path114, file$7, 1565, 10, 104807);
    			attr_dev(path115, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path115, "d", "M8773 8854 c-3 -8 2 -23 11 -32 15 -15 17 -15 33 0 13 14 14 20 3 32\n    -16 20 -39 20 -47 0z");
    			add_location(path115, file$7, 1569, 10, 104945);
    			attr_dev(path116, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path116, "d", "M8863 8814 c-4 -11 1 -22 12 -31 16 -11 21 -11 33 1 8 8 12 22 9 30\n    -8 21 -46 21 -54 0z");
    			add_location(path116, file$7, 1573, 10, 105098);
    			attr_dev(path117, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path117, "d", "M8694 8795 c-7 -18 3 -35 21 -35 18 0 26 15 19 34 -8 20 -33 21 -40\n    1z");
    			add_location(path117, file$7, 1577, 10, 105249);
    			attr_dev(path118, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path118, "d", "M8522 8788 c-16 -16 -15 -33 4 -48 12 -11 18 -11 30 2 13 12 14 20 5\n    37 -13 24 -22 26 -39 9z");
    			add_location(path118, file$7, 1581, 10, 105383);
    			attr_dev(path119, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path119, "d", "M8605 8780 c-8 -24 11 -60 31 -60 19 0 28 24 20 55 -8 30 -42 34 -51\n    5z");
    			add_location(path119, file$7, 1585, 10, 105539);
    			attr_dev(path120, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path120, "d", "M8764 8729 c-3 -6 1 -18 10 -27 15 -15 17 -15 32 0 19 19 11 38 -16\n    38 -10 0 -22 -5 -26 -11z");
    			add_location(path120, file$7, 1589, 10, 105674);
    			attr_dev(path121, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path121, "d", "M8440 8715 c-22 -27 12 -49 38 -23 8 8 9 15 1 25 -15 17 -24 16 -39\n    -2z");
    			add_location(path121, file$7, 1593, 10, 105830);
    			attr_dev(path122, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path122, "d", "M8920 8706 c0 -20 5 -26 21 -26 15 0 20 5 17 22 -5 34 -38 37 -38 4z");
    			add_location(path122, file$7, 1597, 10, 105965);
    			attr_dev(path123, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path123, "d", "M8550 8675 c-15 -17 -5 -35 20 -35 19 0 30 17 23 38 -6 16 -28 15\n    -43 -3z");
    			add_location(path123, file$7, 1600, 10, 106093);
    			attr_dev(path124, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path124, "d", "M8825 8680 c-4 -7 -3 -16 3 -22 14 -14 47 -6 47 12 0 18 -40 26 -50\n    10z");
    			add_location(path124, file$7, 1604, 10, 106230);
    			attr_dev(path125, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path125, "d", "M8641 8666 c-15 -18 2 -56 24 -56 19 0 29 38 15 55 -16 19 -24 19\n    -39 1z");
    			add_location(path125, file$7, 1608, 10, 106365);
    			attr_dev(path126, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path126, "d", "M8734 8646 c-8 -21 13 -46 32 -39 20 8 13 47 -9 51 -9 2 -20 -4 -23\n    -12z");
    			add_location(path126, file$7, 1612, 10, 106501);
    			attr_dev(path127, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path127, "d", "M8866 8574 c-7 -19 10 -44 30 -44 15 0 18 18 8 44 -8 21 -30 20 -38\n    0z");
    			add_location(path127, file$7, 1616, 10, 106637);
    			attr_dev(path128, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path128, "d", "M8983 8583 c-18 -6 -16 -48 2 -63 11 -9 18 -10 29 -1 24 20 -2 74\n    -31 64z");
    			add_location(path128, file$7, 1620, 10, 106771);
    			attr_dev(path129, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path129, "d", "M8475 8570 c-8 -13 13 -50 29 -50 17 0 27 25 20 45 -7 17 -40 20 -49\n    5z");
    			add_location(path129, file$7, 1624, 10, 106908);
    			attr_dev(path130, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path130, "d", "M8587 8566 c-18 -18 -12 -52 10 -60 21 -9 33 2 33 28 0 34 -24 51\n    -43 32z");
    			add_location(path130, file$7, 1628, 10, 107043);
    			attr_dev(path131, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path131, "d", "M8756 8532 c-7 -11 4 -52 14 -52 15 0 32 30 26 45 -6 16 -31 20 -40\n    7z");
    			add_location(path131, file$7, 1632, 10, 107180);
    			attr_dev(path132, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path132, "d", "M8666 8505 c-8 -22 4 -45 24 -45 10 0 20 7 24 15 8 22 -4 45 -24 45\n    -10 0 -20 -7 -24 -15z");
    			add_location(path132, file$7, 1636, 10, 107314);
    			attr_dev(path133, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path133, "d", "M8914 8475 c-8 -21 3 -45 20 -45 20 0 29 16 21 40 -7 23 -33 27 -41\n    5z");
    			add_location(path133, file$7, 1640, 10, 107467);
    			attr_dev(path134, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path134, "d", "M8421 8462 c-7 -14 -6 -25 4 -38 7 -11 15 -33 17 -49 2 -22 8 -30 23\n    -30 22 0 32 34 19 63 -4 9 -6 21 -5 25 3 15 -20 47 -34 47 -8 0 -19 -8 -24\n    -18z");
    			add_location(path134, file$7, 1644, 10, 107601);
    			attr_dev(path135, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path135, "d", "M8514 8445 c-7 -17 12 -45 31 -45 16 0 26 25 19 45 -8 19 -43 19 -50\n    0z");
    			add_location(path135, file$7, 1649, 10, 107815);
    			attr_dev(path136, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path136, "d", "M8624 8446 c-11 -28 1 -61 22 -64 29 -4 39 25 19 54 -18 27 -33 31\n    -41 10z");
    			add_location(path136, file$7, 1653, 10, 107950);
    			attr_dev(path137, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path137, "d", "M8809 8428 c-4 -42 17 -66 40 -44 18 19 5 56 -20 56 -10 0 -20 -6\n    -20 -12z");
    			add_location(path137, file$7, 1657, 10, 108088);
    			attr_dev(path138, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path138, "d", "M9043 8399 c-19 -19 4 -58 33 -59 18 0 25 29 14 51 -12 21 -30 25\n    -47 8z");
    			add_location(path138, file$7, 1661, 10, 108226);
    			attr_dev(path139, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path139, "d", "M8716 8384 c-9 -23 19 -53 35 -37 15 15 7 47 -12 51 -9 2 -19 -5 -23\n    -14z");
    			add_location(path139, file$7, 1665, 10, 108362);
    			attr_dev(path140, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path140, "d", "M8645 8350 c-8 -24 11 -60 31 -60 19 0 28 24 20 55 -8 30 -42 34 -51\n    5z");
    			add_location(path140, file$7, 1669, 10, 108499);
    			attr_dev(path141, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path141, "d", "M8887 8356 c-9 -22 19 -41 38 -26 8 7 15 19 15 26 0 19 -46 18 -53 0z");
    			add_location(path141, file$7, 1673, 10, 108634);
    			attr_dev(path142, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path142, "d", "M8987 8323 c-12 -11 -8 -40 8 -53 12 -10 18 -10 30 0 19 16 19 25 -1\n    44 -17 17 -27 20 -37 9z");
    			add_location(path142, file$7, 1676, 10, 108763);
    			attr_dev(path143, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path143, "d", "M8759 8299 c-9 -17 -8 -25 4 -37 19 -18 47 -9 47 16 0 18 -18 42 -32\n    42 -4 0 -12 -10 -19 -21z");
    			add_location(path143, file$7, 1680, 10, 108919);
    			attr_dev(path144, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path144, "d", "M9097 8286 c-7 -19 17 -51 31 -42 20 12 15 56 -7 56 -10 0 -21 -6\n    -24 -14z");
    			add_location(path144, file$7, 1684, 10, 109076);
    			attr_dev(path145, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path145, "d", "M8564 8275 c-4 -10 0 -24 10 -33 16 -16 18 -16 32 3 18 24 13 39 -14\n    43 -14 2 -25 -3 -28 -13z");
    			add_location(path145, file$7, 1688, 10, 109214);
    			attr_dev(path146, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path146, "d", "M8884 8276 c-8 -21 13 -46 32 -39 20 8 13 47 -9 51 -9 2 -20 -4 -23\n    -12z");
    			add_location(path146, file$7, 1692, 10, 109371);
    			attr_dev(path147, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path147, "d", "M8497 8264 c-4 -4 -7 -18 -7 -31 0 -20 5 -24 23 -21 16 2 22 10 22\n    28 0 24 -23 39 -38 24z");
    			add_location(path147, file$7, 1696, 10, 109507);
    			attr_dev(path148, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path148, "d", "M8690 8250 c-13 -8 -13 -11 2 -27 21 -20 45 -5 35 21 -7 18 -16 20\n    -37 6z");
    			add_location(path148, file$7, 1700, 10, 109660);
    			attr_dev(path149, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path149, "d", "M8961 8221 c-17 -11 -5 -51 15 -51 8 0 17 7 21 16 8 21 -18 46 -36\n    35z");
    			add_location(path149, file$7, 1704, 10, 109797);
    			attr_dev(path150, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path150, "d", "M8720 8175 c-6 -8 -9 -23 -5 -35 7 -23 40 -27 49 -5 13 34 -23 66\n    -44 40z");
    			add_location(path150, file$7, 1708, 10, 109931);
    			attr_dev(path151, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path151, "d", "M9046 8175 c-9 -25 5 -45 31 -45 13 0 31 -7 39 -15 20 -19 46 -8 42\n    19 -2 14 -12 22 -28 24 -14 2 -29 10 -33 18 -11 19 -43 18 -51 -1z");
    			add_location(path151, file$7, 1712, 10, 110068);
    			attr_dev(path152, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path152, "d", "M8820 8155 c0 -18 5 -25 20 -25 15 0 20 7 20 25 0 18 -5 25 -20 25\n    -15 0 -20 -7 -20 -25z");
    			add_location(path152, file$7, 1716, 10, 110264);
    			attr_dev(path153, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path153, "d", "M8530 8155 c-16 -19 2 -65 25 -65 22 0 30 27 17 56 -13 28 -24 30\n    -42 9z");
    			add_location(path153, file$7, 1720, 10, 110416);
    			attr_dev(path154, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path154, "d", "M8637 8143 c-13 -13 -7 -51 10 -57 23 -9 35 7 27 38 -6 25 -23 34\n    -37 19z");
    			add_location(path154, file$7, 1724, 10, 110552);
    			attr_dev(path155, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path155, "d", "M9186 8141 c-10 -16 5 -41 26 -41 14 0 19 6 16 22 -3 24 -32 36 -42\n    19z");
    			add_location(path155, file$7, 1728, 10, 110689);
    			attr_dev(path156, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path156, "d", "M8957 8123 c-12 -11 -7 -40 9 -53 21 -18 46 6 38 38 -6 21 -33 30\n    -47 15z");
    			add_location(path156, file$7, 1732, 10, 110824);
    			attr_dev(path157, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path157, "d", "M8762 8088 c-23 -23 -7 -68 24 -68 18 0 27 36 14 60 -12 23 -21 25\n    -38 8z");
    			add_location(path157, file$7, 1736, 10, 110961);
    			attr_dev(path158, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path158, "d", "M8860 8075 c-16 -19 3 -45 31 -45 22 0 26 29 7 48 -16 16 -23 15 -38\n    -3z");
    			add_location(path158, file$7, 1740, 10, 111098);
    			attr_dev(path159, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path159, "d", "M9140 8035 c-11 -13 -11 -19 2 -32 17 -16 38 -10 38 11 0 8 -6 19\n    -14 25 -10 9 -16 8 -26 -4z");
    			add_location(path159, file$7, 1744, 10, 111234);
    			attr_dev(path160, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path160, "d", "M8718 8006 c-30 -30 6 -82 38 -55 18 15 18 22 -4 49 -17 21 -19 21\n    -34 6z");
    			add_location(path160, file$7, 1748, 10, 111390);
    			attr_dev(path161, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path161, "d", "M9031 8006 c-15 -17 -7 -52 14 -59 19 -8 37 17 33 45 -4 27 -30 35\n    -47 14z");
    			add_location(path161, file$7, 1752, 10, 111527);
    			attr_dev(path162, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path162, "d", "M8905 7990 c-8 -25 1 -40 25 -40 22 0 30 19 18 43 -12 23 -35 22 -43\n    -3z");
    			add_location(path162, file$7, 1756, 10, 111665);
    			attr_dev(path163, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path163, "d", "M9210 7985 c-11 -13 -11 -19 3 -33 20 -19 41 -5 35 24 -4 24 -22 28\n    -38 9z");
    			add_location(path163, file$7, 1760, 10, 111801);
    			attr_dev(path164, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path164, "d", "M8821 7946 c-6 -7 -9 -21 -5 -30 4 -10 1 -16 -9 -16 -22 0 -32 -39\n    -14 -57 12 -13 16 -12 31 2 9 10 15 22 13 29 -2 6 5 15 16 21 27 14 31 29 12\n    49 -20 20 -29 20 -44 2z");
    			add_location(path164, file$7, 1764, 10, 111939);
    			attr_dev(path165, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path165, "d", "M9120 7940 c-13 -8 -13 -11 3 -27 16 -16 18 -16 33 -1 28 27 -1 50\n    -36 28z");
    			add_location(path165, file$7, 1769, 10, 112172);
    			attr_dev(path166, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path166, "d", "M9312 7938 c-17 -17 -15 -36 6 -46 23 -12 42 -4 42 17 0 16 -18 41\n    -30 41 -3 0 -11 -5 -18 -12z");
    			add_location(path166, file$7, 1773, 10, 112310);
    			attr_dev(path167, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path167, "d", "M8956 7915 c-9 -10 -15 -24 -12 -32 3 -8 6 -17 6 -19 0 -2 8 -4 19\n    -4 23 0 33 33 17 56 -11 15 -14 15 -30 -1z");
    			add_location(path167, file$7, 1777, 10, 112468);
    			attr_dev(path168, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path168, "d", "M8879 7868 c-4 -42 17 -66 40 -44 18 19 5 56 -20 56 -10 0 -20 -6\n    -20 -12z");
    			add_location(path168, file$7, 1781, 10, 112640);
    			attr_dev(path169, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path169, "d", "M9095 7870 c-8 -13 13 -50 28 -50 23 0 37 22 26 42 -10 19 -44 25\n    -54 8z");
    			add_location(path169, file$7, 1785, 10, 112778);
    			attr_dev(path170, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path170, "d", "M9231 7866 c-23 -27 17 -68 45 -45 13 11 8 39 -10 51 -16 11 -22 10\n    -35 -6z");
    			add_location(path170, file$7, 1789, 10, 112914);
    			attr_dev(path171, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path171, "d", "M9395 7824 c-8 -9 -22 -14 -30 -11 -18 7 -39 -18 -31 -38 7 -19 20\n    -19 38 -1 10 9 20 11 30 5 25 -14 51 16 38 42 -13 23 -24 24 -45 3z");
    			add_location(path171, file$7, 1793, 10, 113053);
    			attr_dev(path172, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path172, "d", "M9030 7805 c-10 -12 -10 -18 0 -30 21 -25 42 -18 38 12 -4 32 -20 40\n    -38 18z");
    			add_location(path172, file$7, 1797, 10, 113249);
    			attr_dev(path173, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path173, "d", "M8940 7756 c0 -28 24 -51 45 -42 19 7 19 30 -1 50 -23 24 -44 20 -44\n    -8z");
    			add_location(path173, file$7, 1801, 10, 113389);
    			attr_dev(path174, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path174, "d", "M9180 7765 c-16 -19 3 -45 31 -45 24 0 26 45 3 54 -21 8 -20 8 -34\n    -9z");
    			add_location(path174, file$7, 1805, 10, 113525);
    			attr_dev(path175, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path175, "d", "M8845 7760 c-11 -18 6 -50 25 -50 24 0 33 15 25 40 -7 21 -39 27 -50\n    10z");
    			add_location(path175, file$7, 1809, 10, 113659);
    			attr_dev(path176, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path176, "d", "M9509 7734 c-11 -14 -10 -18 5 -29 21 -16 46 -9 46 11 0 23 -36 36\n    -51 18z");
    			add_location(path176, file$7, 1813, 10, 113795);
    			attr_dev(path177, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path177, "d", "M9091 7731 c-19 -12 -6 -43 16 -39 10 2 18 12 18 22 0 22 -14 29 -34\n    17z");
    			add_location(path177, file$7, 1817, 10, 113933);
    			attr_dev(path178, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path178, "d", "M9260 7716 c0 -20 5 -26 21 -26 15 0 20 5 17 22 -5 34 -38 37 -38 4z");
    			add_location(path178, file$7, 1821, 10, 114069);
    			attr_dev(path179, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path179, "d", "M9340 7700 c0 -23 26 -38 41 -23 14 14 0 43 -22 43 -12 0 -19 -7 -19\n    -20z");
    			add_location(path179, file$7, 1824, 10, 114197);
    			attr_dev(path180, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path180, "d", "M9013 7673 c-18 -6 -16 -49 3 -67 30 -30 49 -13 39 33 -6 30 -21 41\n    -42 34z");
    			add_location(path180, file$7, 1828, 10, 114334);
    			attr_dev(path181, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path181, "d", "M9113 7654 c-7 -20 11 -38 31 -31 9 4 12 13 9 26 -6 25 -31 28 -40 5z");
    			add_location(path181, file$7, 1832, 10, 114473);
    			attr_dev(path182, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path182, "d", "M9433 7653 c-17 -6 -16 -28 0 -42 10 -8 19 -7 32 3 16 12 17 16 6 30\n    -14 17 -18 18 -38 9z");
    			add_location(path182, file$7, 1835, 10, 114602);
    			attr_dev(path183, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path183, "d", "M9286 7635 c-19 -20 -20 -27 -4 -43 21 -21 48 -14 48 12 0 34 -24 51\n    -44 31z");
    			add_location(path183, file$7, 1839, 10, 114755);
    			attr_dev(path184, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path184, "d", "M9621 7640 c-19 -11 -9 -54 13 -58 25 -5 39 12 32 36 -8 24 -28 33\n    -45 22z");
    			add_location(path184, file$7, 1843, 10, 114895);
    			attr_dev(path185, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path185, "d", "M9530 7625 c-10 -12 -10 -19 -2 -27 7 -7 12 -25 12 -40 0 -38 42 -60\n    67 -36 14 15 13 19 -12 42 -15 14 -24 30 -20 36 7 11 -11 40 -25 40 -4 0 -13\n    -7 -20 -15z");
    			add_location(path185, file$7, 1847, 10, 115033);
    			attr_dev(path186, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path186, "d", "M9080 7565 c-10 -12 -9 -20 4 -40 18 -28 44 -33 52 -10 6 16 -20 65\n    -35 65 -5 0 -14 -7 -21 -15z");
    			add_location(path186, file$7, 1852, 10, 115256);
    			attr_dev(path187, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path187, "d", "M9200 7556 c0 -21 5 -26 26 -26 21 0 25 4 22 23 -2 14 -11 23 -25 25\n    -19 3 -23 -1 -23 -22z");
    			add_location(path187, file$7, 1856, 10, 115415);
    			attr_dev(path188, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path188, "d", "M9004 7545 c-9 -23 3 -45 26 -45 22 0 25 12 10 41 -13 23 -28 25 -36\n    4z");
    			add_location(path188, file$7, 1860, 10, 115569);
    			attr_dev(path189, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path189, "d", "M9720 7551 c0 -23 14 -41 30 -41 19 0 30 17 23 38 -5 14 -53 17 -53\n    3z");
    			add_location(path189, file$7, 1864, 10, 115704);
    			attr_dev(path190, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path190, "d", "M9646 7525 c-21 -22 -17 -50 8 -50 29 0 44 31 25 51 -15 14 -18 14\n    -33 -1z");
    			add_location(path190, file$7, 1868, 10, 115838);
    			attr_dev(path191, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path191, "d", "M9466 7517 c-16 -12 -17 -14 -1 -27 14 -11 18 -11 32 2 8 9 12 21 9\n    27 -9 14 -18 14 -40 -2z");
    			add_location(path191, file$7, 1872, 10, 115976);
    			attr_dev(path192, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path192, "d", "M9264 7505 c-9 -23 3 -45 26 -45 23 0 27 29 8 48 -16 16 -27 15 -34\n    -3z");
    			add_location(path192, file$7, 1876, 10, 116131);
    			attr_dev(path193, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path193, "d", "M9350 7501 c0 -10 7 -24 16 -31 12 -11 18 -11 30 2 20 20 7 48 -22\n    48 -17 0 -24 -6 -24 -19z");
    			add_location(path193, file$7, 1880, 10, 116266);
    			attr_dev(path194, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path194, "d", "M9146 7484 c-8 -21 19 -64 39 -64 9 0 21 -11 27 -25 13 -30 56 -45\n    68 -24 12 18 -5 46 -39 63 -15 8 -36 26 -45 40 -19 30 -41 34 -50 10z");
    			add_location(path194, file$7, 1884, 10, 116421);
    			attr_dev(path195, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path195, "d", "M9852 7467 c-16 -19 2 -40 27 -32 25 8 28 30 5 39 -21 8 -20 8 -32\n    -7z");
    			add_location(path195, file$7, 1888, 10, 116619);
    			attr_dev(path196, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path196, "d", "M9770 7445 c-10 -12 -10 -18 0 -30 7 -8 19 -15 26 -15 8 0 14 -9 14\n    -20 0 -19 27 -40 50 -40 6 0 10 12 8 28 -2 19 -9 28 -25 30 -16 2 -23 10 -23\n    27 0 12 -7 26 -16 29 -21 8 -20 8 -34 -9z");
    			add_location(path196, file$7, 1892, 10, 116753);
    			attr_dev(path197, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path197, "d", "M9685 7441 c-3 -5 2 -16 11 -25 19 -20 57 -4 48 19 -7 16 -49 21 -59\n    6z");
    			add_location(path197, file$7, 1897, 10, 117004);
    			attr_dev(path198, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path198, "d", "M9477 7433 c-24 -24 10 -71 39 -55 13 7 25 5 42 -6 21 -14 25 -14 40\n    1 15 16 15 19 -5 38 -17 17 -24 19 -41 10 -15 -8 -23 -7 -32 4 -13 16 -32 19\n    -43 8z");
    			add_location(path198, file$7, 1901, 10, 117139);
    			attr_dev(path199, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path199, "d", "M9943 7404 c-8 -20 9 -36 30 -28 21 8 22 30 1 38 -22 8 -24 8 -31\n    -10z");
    			add_location(path199, file$7, 1906, 10, 117357);
    			attr_dev(path200, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path200, "d", "M10045 7384 c-15 -15 -15 -19 -1 -32 17 -17 46 -10 46 11 0 8 -6 20\n    -14 26 -11 9 -18 8 -31 -5z");
    			add_location(path200, file$7, 1910, 10, 117491);
    			attr_dev(path201, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path201, "d", "M9382 7378 c-15 -15 3 -48 27 -48 27 0 36 31 15 47 -22 16 -27 16\n    -42 1z");
    			add_location(path201, file$7, 1914, 10, 117649);
    			attr_dev(path202, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path202, "d", "M9671 7341 c-12 -22 -5 -31 25 -31 31 0 41 20 19 37 -25 17 -32 17\n    -44 -6z");
    			add_location(path202, file$7, 1918, 10, 117785);
    			attr_dev(path203, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path203, "d", "M9920 7325 c-10 -13 -10 -19 5 -35 23 -25 32 -25 45 -1 7 15 6 23 -6\n    35 -19 20 -28 20 -44 1z");
    			add_location(path203, file$7, 1922, 10, 117923);
    			attr_dev(path204, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path204, "d", "M9520 7320 c-18 -11 -4 -42 17 -38 10 2 19 10 21 19 4 19 -19 31 -38\n    19z");
    			add_location(path204, file$7, 1926, 10, 118079);
    			attr_dev(path205, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path205, "d", "M10184 7315 c-4 -9 -2 -21 3 -26 14 -14 45 1 41 20 -4 22 -37 26 -44\n    6z");
    			add_location(path205, file$7, 1930, 10, 118215);
    			attr_dev(path206, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path206, "d", "M9720 7275 c0 -28 25 -44 42 -27 15 15 -1 52 -23 52 -14 0 -19 -7\n    -19 -25z");
    			add_location(path206, file$7, 1934, 10, 118350);
    			attr_dev(path207, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path207, "d", "M10304 7286 c-8 -21 3 -36 27 -36 15 0 20 6 17 22 -4 27 -35 37 -44\n    14z");
    			add_location(path207, file$7, 1938, 10, 118488);
    			attr_dev(path208, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path208, "d", "M10026 7282 c-8 -14 20 -34 41 -30 28 5 22 33 -9 36 -14 2 -29 -1\n    -32 -6z");
    			add_location(path208, file$7, 1942, 10, 118623);
    			attr_dev(path209, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path209, "d", "M9587 7263 c-13 -12 -7 -41 10 -47 9 -4 23 0 31 8 13 12 13 18 2 30\n    -13 17 -32 21 -43 9z");
    			add_location(path209, file$7, 1946, 10, 118760);
    			attr_dev(path210, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path210, "d", "M9813 7244 c-4 -11 1 -22 12 -30 22 -16 25 -17 45 -4 12 7 12 13 4\n    27 -15 25 -52 29 -61 7z");
    			add_location(path210, file$7, 1950, 10, 118912);
    			attr_dev(path211, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path211, "d", "M9931 7236 c-17 -20 -7 -46 18 -46 29 0 33 15 13 40 -16 20 -19 20\n    -31 6z");
    			add_location(path211, file$7, 1954, 10, 119066);
    			attr_dev(path212, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path212, "d", "M10153 7243 c-18 -7 -16 -40 3 -47 16 -6 54 9 54 22 0 23 -31 36 -57\n    25z");
    			add_location(path212, file$7, 1958, 10, 119203);
    			attr_dev(g, "transform", "translate(0.000000,1600.000000) scale(0.100000,-0.100000)");
    			attr_dev(g, "fill", "#000000");
    			attr_dev(g, "stroke", "none");
    			add_location(g, file$7, 7, 5, 202);
    			attr_dev(svg, "version", "1.0");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "width", "1600.000000pt");
    			attr_dev(svg, "height", "1600.000000pt");
    			attr_dev(svg, "viewBox", "0 0 1600.000000 1600.000000");
    			attr_dev(svg, "preserveAspectRatio", "xMidYMid meet");
    			attr_dev(svg, "class", "svelte-1giqqxd");
    			add_location(svg, file$7, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, g);
    			append_dev(g, path0);
    			append_dev(g, path1);
    			append_dev(g, path2);
    			append_dev(g, path3);
    			append_dev(g, path4);
    			append_dev(g, path5);
    			append_dev(g, path6);
    			append_dev(g, path7);
    			append_dev(g, path8);
    			append_dev(g, path9);
    			append_dev(g, path10);
    			append_dev(g, path11);
    			append_dev(g, path12);
    			append_dev(g, path13);
    			append_dev(g, path14);
    			append_dev(g, path15);
    			append_dev(g, path16);
    			append_dev(g, path17);
    			append_dev(g, path18);
    			append_dev(g, path19);
    			append_dev(g, path20);
    			append_dev(g, path21);
    			append_dev(g, path22);
    			append_dev(g, path23);
    			append_dev(g, path24);
    			append_dev(g, path25);
    			append_dev(g, path26);
    			append_dev(g, path27);
    			append_dev(g, path28);
    			append_dev(g, path29);
    			append_dev(g, path30);
    			append_dev(g, path31);
    			append_dev(g, path32);
    			append_dev(g, path33);
    			append_dev(g, path34);
    			append_dev(g, path35);
    			append_dev(g, path36);
    			append_dev(g, path37);
    			append_dev(g, path38);
    			append_dev(g, path39);
    			append_dev(g, path40);
    			append_dev(g, path41);
    			append_dev(g, path42);
    			append_dev(g, path43);
    			append_dev(g, path44);
    			append_dev(g, path45);
    			append_dev(g, path46);
    			append_dev(g, path47);
    			append_dev(g, path48);
    			append_dev(g, path49);
    			append_dev(g, path50);
    			append_dev(g, path51);
    			append_dev(g, path52);
    			append_dev(g, path53);
    			append_dev(g, path54);
    			append_dev(g, path55);
    			append_dev(g, path56);
    			append_dev(g, path57);
    			append_dev(g, path58);
    			append_dev(g, path59);
    			append_dev(g, path60);
    			append_dev(g, path61);
    			append_dev(g, path62);
    			append_dev(g, path63);
    			append_dev(g, path64);
    			append_dev(g, path65);
    			append_dev(g, path66);
    			append_dev(g, path67);
    			append_dev(g, path68);
    			append_dev(g, path69);
    			append_dev(g, path70);
    			append_dev(g, path71);
    			append_dev(g, path72);
    			append_dev(g, path73);
    			append_dev(g, path74);
    			append_dev(g, path75);
    			append_dev(g, path76);
    			append_dev(g, path77);
    			append_dev(g, path78);
    			append_dev(g, path79);
    			append_dev(g, path80);
    			append_dev(g, path81);
    			append_dev(g, path82);
    			append_dev(g, path83);
    			append_dev(g, path84);
    			append_dev(g, path85);
    			append_dev(g, path86);
    			append_dev(g, path87);
    			append_dev(g, path88);
    			append_dev(g, path89);
    			append_dev(g, path90);
    			append_dev(g, path91);
    			append_dev(g, path92);
    			append_dev(g, path93);
    			append_dev(g, path94);
    			append_dev(g, path95);
    			append_dev(g, path96);
    			append_dev(g, path97);
    			append_dev(g, path98);
    			append_dev(g, path99);
    			append_dev(g, path100);
    			append_dev(g, path101);
    			append_dev(g, path102);
    			append_dev(g, path103);
    			append_dev(g, path104);
    			append_dev(g, path105);
    			append_dev(g, path106);
    			append_dev(g, path107);
    			append_dev(g, path108);
    			append_dev(g, path109);
    			append_dev(g, path110);
    			append_dev(g, path111);
    			append_dev(g, path112);
    			append_dev(g, path113);
    			append_dev(g, path114);
    			append_dev(g, path115);
    			append_dev(g, path116);
    			append_dev(g, path117);
    			append_dev(g, path118);
    			append_dev(g, path119);
    			append_dev(g, path120);
    			append_dev(g, path121);
    			append_dev(g, path122);
    			append_dev(g, path123);
    			append_dev(g, path124);
    			append_dev(g, path125);
    			append_dev(g, path126);
    			append_dev(g, path127);
    			append_dev(g, path128);
    			append_dev(g, path129);
    			append_dev(g, path130);
    			append_dev(g, path131);
    			append_dev(g, path132);
    			append_dev(g, path133);
    			append_dev(g, path134);
    			append_dev(g, path135);
    			append_dev(g, path136);
    			append_dev(g, path137);
    			append_dev(g, path138);
    			append_dev(g, path139);
    			append_dev(g, path140);
    			append_dev(g, path141);
    			append_dev(g, path142);
    			append_dev(g, path143);
    			append_dev(g, path144);
    			append_dev(g, path145);
    			append_dev(g, path146);
    			append_dev(g, path147);
    			append_dev(g, path148);
    			append_dev(g, path149);
    			append_dev(g, path150);
    			append_dev(g, path151);
    			append_dev(g, path152);
    			append_dev(g, path153);
    			append_dev(g, path154);
    			append_dev(g, path155);
    			append_dev(g, path156);
    			append_dev(g, path157);
    			append_dev(g, path158);
    			append_dev(g, path159);
    			append_dev(g, path160);
    			append_dev(g, path161);
    			append_dev(g, path162);
    			append_dev(g, path163);
    			append_dev(g, path164);
    			append_dev(g, path165);
    			append_dev(g, path166);
    			append_dev(g, path167);
    			append_dev(g, path168);
    			append_dev(g, path169);
    			append_dev(g, path170);
    			append_dev(g, path171);
    			append_dev(g, path172);
    			append_dev(g, path173);
    			append_dev(g, path174);
    			append_dev(g, path175);
    			append_dev(g, path176);
    			append_dev(g, path177);
    			append_dev(g, path178);
    			append_dev(g, path179);
    			append_dev(g, path180);
    			append_dev(g, path181);
    			append_dev(g, path182);
    			append_dev(g, path183);
    			append_dev(g, path184);
    			append_dev(g, path185);
    			append_dev(g, path186);
    			append_dev(g, path187);
    			append_dev(g, path188);
    			append_dev(g, path189);
    			append_dev(g, path190);
    			append_dev(g, path191);
    			append_dev(g, path192);
    			append_dev(g, path193);
    			append_dev(g, path194);
    			append_dev(g, path195);
    			append_dev(g, path196);
    			append_dev(g, path197);
    			append_dev(g, path198);
    			append_dev(g, path199);
    			append_dev(g, path200);
    			append_dev(g, path201);
    			append_dev(g, path202);
    			append_dev(g, path203);
    			append_dev(g, path204);
    			append_dev(g, path205);
    			append_dev(g, path206);
    			append_dev(g, path207);
    			append_dev(g, path208);
    			append_dev(g, path209);
    			append_dev(g, path210);
    			append_dev(g, path211);
    			append_dev(g, path212);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('HomeAnimation', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<HomeAnimation> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class HomeAnimation extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "HomeAnimation",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src/components/HomeAnimation2.svelte generated by Svelte v3.55.1 */

    const file$6 = "src/components/HomeAnimation2.svelte";

    function create_fragment$6(ctx) {
    	let svg;
    	let g;
    	let path0;
    	let path1;
    	let path2;
    	let path3;
    	let path4;
    	let path5;
    	let path6;
    	let path7;
    	let path8;
    	let path9;
    	let path10;
    	let path11;
    	let path12;
    	let path13;
    	let path14;
    	let path15;
    	let path16;
    	let path17;
    	let path18;
    	let path19;
    	let path20;
    	let path21;
    	let path22;
    	let path23;
    	let path24;
    	let path25;
    	let path26;
    	let path27;
    	let path28;
    	let path29;
    	let path30;
    	let path31;
    	let path32;
    	let path33;
    	let path34;
    	let path35;
    	let path36;
    	let path37;
    	let path38;
    	let path39;
    	let path40;
    	let path41;
    	let path42;
    	let path43;
    	let path44;
    	let path45;
    	let path46;
    	let path47;
    	let path48;
    	let path49;
    	let path50;
    	let path51;
    	let path52;
    	let path53;
    	let path54;
    	let path55;
    	let path56;
    	let path57;
    	let path58;
    	let path59;
    	let path60;
    	let path61;
    	let path62;
    	let path63;
    	let path64;
    	let path65;
    	let path66;
    	let path67;
    	let path68;
    	let path69;
    	let path70;
    	let path71;
    	let path72;
    	let path73;
    	let path74;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			g = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			path5 = svg_element("path");
    			path6 = svg_element("path");
    			path7 = svg_element("path");
    			path8 = svg_element("path");
    			path9 = svg_element("path");
    			path10 = svg_element("path");
    			path11 = svg_element("path");
    			path12 = svg_element("path");
    			path13 = svg_element("path");
    			path14 = svg_element("path");
    			path15 = svg_element("path");
    			path16 = svg_element("path");
    			path17 = svg_element("path");
    			path18 = svg_element("path");
    			path19 = svg_element("path");
    			path20 = svg_element("path");
    			path21 = svg_element("path");
    			path22 = svg_element("path");
    			path23 = svg_element("path");
    			path24 = svg_element("path");
    			path25 = svg_element("path");
    			path26 = svg_element("path");
    			path27 = svg_element("path");
    			path28 = svg_element("path");
    			path29 = svg_element("path");
    			path30 = svg_element("path");
    			path31 = svg_element("path");
    			path32 = svg_element("path");
    			path33 = svg_element("path");
    			path34 = svg_element("path");
    			path35 = svg_element("path");
    			path36 = svg_element("path");
    			path37 = svg_element("path");
    			path38 = svg_element("path");
    			path39 = svg_element("path");
    			path40 = svg_element("path");
    			path41 = svg_element("path");
    			path42 = svg_element("path");
    			path43 = svg_element("path");
    			path44 = svg_element("path");
    			path45 = svg_element("path");
    			path46 = svg_element("path");
    			path47 = svg_element("path");
    			path48 = svg_element("path");
    			path49 = svg_element("path");
    			path50 = svg_element("path");
    			path51 = svg_element("path");
    			path52 = svg_element("path");
    			path53 = svg_element("path");
    			path54 = svg_element("path");
    			path55 = svg_element("path");
    			path56 = svg_element("path");
    			path57 = svg_element("path");
    			path58 = svg_element("path");
    			path59 = svg_element("path");
    			path60 = svg_element("path");
    			path61 = svg_element("path");
    			path62 = svg_element("path");
    			path63 = svg_element("path");
    			path64 = svg_element("path");
    			path65 = svg_element("path");
    			path66 = svg_element("path");
    			path67 = svg_element("path");
    			path68 = svg_element("path");
    			path69 = svg_element("path");
    			path70 = svg_element("path");
    			path71 = svg_element("path");
    			path72 = svg_element("path");
    			path73 = svg_element("path");
    			path74 = svg_element("path");
    			attr_dev(path0, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path0, "d", "M3260 9376c-19-7-65-33-102-57s-1e2-64-140-88-107-65-148-91-245-152-453-280c-228-140-382-241-386-253-4-11-1-42 6-70 11-42 13-489 14-2392 1-1287 5-2783 8-3324l6-984 425-174c234-95 510-208 614-250l190-77 385 27c568 40 2294 166 4136 302 259 19 524 38 591 41l121 7 6 96c4 53 7 1640 7 3526 1 3278 0 3431-17 3442s-336 52-793 103c-102 11-219 24-260 30-41 5-97 12-125 15-106 11-152 16-220 26-67 9-587 69-940 109-93 10-366 42-605 70-599 70-1002 117-1215 140-344 39-530 61-6e2 70-133 19-410 50-440 50-16-1-46-7-65-14zm65-51c29-24 29-25 7-25-31 0-62 17-62 35 0 22 21 18 55-10zm102-1c18-14 33-29 33-33 0-17-74 8-99 33l-26 26h29c16 0 44-11 63-26zm101-11c23-15 42-31 42-36 0-14-51 2-87 26-65 44-21 53 45 10zm137-33c19-20 19-20-1-20-24 0-85 39-92 58-6 18 66-12 93-38zm-406 26c9-10 9-16 1-21-12-7-40 11-40 26 0 14 26 10 39-5zm463-13c18-15 35-28 37-30s2-6-2-9c-9-9-87 38-87 53 0 20 15 16 52-14zm79 7c19-6 46-22 60-36l24-27-32 6c-34 7-103 46-103 60 0 9 8 9 51-3zm-587-40c-7-7-16-5-30 5-16 13-17 16-4 24 19 13 50-13 34-29zm736-6c22-21 22-24 6-24-10 0-35 14-54 32l-36 31 29-7c17-4 41-18 55-32zm82-1c37-25 39-28 20-31-23-4-92 33-92 49 0 17 30 9 72-18zm108-13c33-29 34-30 9-30-21 0-99 43-99 55 0 17 61-1 90-25zm-975 0c0-8-7-16-15-17-22-4-44 13-35 26 10 17 50 9 50-9zm545-15c118-14 307-37 420-50 113-14 410-48 660-75 250-28 458-54 461-58 10-10 21-13e2 12-1305s-374 11-420 18l-31 6-4 187c-2 121-7 194-15 208-17 29-65 40-298 64-325 33-536 47-599 40-69-8-106-40-106-93 0-168-6-347-12-353-7-7-446 11-454 18-2 2-5 325-6 717l-3 713 90-6c50-3 187-18 305-31zm512 9c44-31 45-34 18-34-23 0-93 59-71 60 8 0 32-12 53-26zm-932-29c0-19-4-36-9-40-11-6-81 25-81 37 0 10 73 47 83 41 4-2 7-19 7-38zm1041 24c9-4 21-15 29-23 11-14 8-16-17-16-30 0-83 33-83 51 0 10 43 3 71-12zm94-24c20-16 25-24 14-25-8 0-26 11-39 25-30 32-14 32 25 0zm-1310 5c11-18-26-23-43-6-15 15-14 16 10 16 15 0 30-5 33-10zm1419-11c14-11 26-25 26-30 0-15-53 2-83 28l-29 23h30c16 0 41-9 56-21zm118-16c27-25 22-36-14-29-33 6-68 32-68 49 0 14 61 0 82-20zm-1587-14c-10-15-55-11-55 5 0 8 6 16 13 19 17 6 49-12 42-24zm1657 1c22-20 28-30 17-30-8 0-28 14-44 30-37 39-15 39 27 0zm89-1c16-11 29-25 29-30 0-18-30-8-62 21-27 24-29 29-15 30 11 0 32-9 48-21zm-1581-14c50-25 50-25 50-75 0-55-6-59-43-30-14 11-30 20-36 20-17 0-121 52-121 60 0 12 62 48 83 49 10 1 40-10 67-24zm1690-11c24-23 24-24 4-24-23 0-74 35-74 51s42-1 70-27zm104-14 20-20h-25c-26 0-79 34-79 50 0 14 63-8 84-30zm-2024 4c0-8-6-14-12-14-21 0-41 17-34 28 8 14 46 3 46-14zm2092-1c19-17 24-33 10-33-11 0-52 35-52 44 0 12 23 6 42-11zm95-18c27-23 27-24 6-25-12 0-35 11-50 25-27 23-27 24-6 25 12 0 35-11 50-25zm-2253 9c9-3 16-12 16-20 0-16-28-18-50-4-13 9-13 11 0 20 18 12 15 11 34 4zm2334-13c12-10 22-21 22-25 0-14-31-4-57 19s-26 24-7 25c12 0 31-8 42-19zm94-8c22-20 23-33 3-33-19 0-65 29-65 41 0 15 42 10 62-8zm-2277-7c19-13 18-15-17-31-34-17-88-15-88 3 0 10 52 40 71 41 8 1 24-5 34-13zm2375-11 23-25h-25c-13 0-35 11-48 25l-23 25h25c13 0 35-11 48-25zm1e2-7 21-23-22-3c-13-2-32 6-48 22l-26 26h27c15 0 37-10 48-22zm-2691 3c13-8 8-31-7-31-17 1-34 19-28 29 9 13 16 14 35 2zm2791-16 23-25h-28c-27 0-65 24-65 42s48 7 70-17zm-2479-15c14-8 19-21 19-55v-45l-57 29c-32 16-66 36-77 43-17 14-17 16 15 35 33 22 48 20 1e2-7zm2559-18c-12-4-50 26-50 40 0 5 14-2 31-14 16-12 25-24 19-26zm62 21c10-9 18-20 18-25 0-15-18-8-47 17-24 21-25 24-9 25 11 0 28-7 38-17zm88-18c32-34 2-35-37 0-26 22-26 24-7 25 11 0 31-11 44-25zm-3060 5c0-5-7-7-15-4-8 4-15 8-15 10s7 4 15 4 15-4 15-10zm144 4c24-9 19-22-15-40-30-15-79-13-79 4 0 9 51 41 67 42 6 0 18-3 27-6zm3013-19 28-24h-25c-23 0-70 29-70 43 0 15 42 3 67-19zm-542 0c66-8 266-30 445-50s397-44 485-55c88-10 185-21 215-25 105-11 486-54 575-64 50-6 351-40 670-76s599-68 623-71l42-6v-551-550l-167 7c-160 6-721 33-2307 111-390 19-712 38-715 41s-7 298-9 655c-2 527 0 649 11 649 7 0 66-7 132-15zm625-10c22-24 23-25 3-25-11 0-30 11-43 25-22 24-23 25-3 25 11 0 30-11 43-25zm82-2c10-9 18-20 18-25 0-16-29-8-57 17l-28 24 24 1c14 0 33-7 43-17zm-3377-2c3-5 1-13-5-16-15-9-43 3-35 15 8 13 32 13 40 1zm425-128v-42l-29 10c-22 8-32 20-39 47-7 25-10 30-11 15-1-32-22-29-92 12-33 19-64 35-70 35-19 0-8 21 22 39l32 19 93-46 94-47v-42zm61 127c24-13 28-1e2 5-1e2-22 0-46 40-46 77 0 35 9 40 41 23zm2969-10c14-10 22-22 18-26-9-8-58 22-58 36 0 15 12 12 40-10zm82-7c10-9 18-20 18-25 0-15-18-8-47 17-24 21-25 24-9 25 11 0 28-7 38-17zm78-13c24-19 24-20 4-20-11 0-29 9-39 20-24 27 1 27 35 0zm-3513-6c2-6-8-19-22-28-20-13-29-14-47-5l-22 12 24 19c24 20 61 21 67 2zm3598-4c18-19 17-20-7-20-14 0-33 9-43 20-18 19-17 20 7 20 14 0 33-9 43-20zm75-5c24-29 4-38-25-12-28 24-28 26-9 27 12 0 27-7 34-15zm85-15c18-19 17-20-2-20-11 0-28 9-38 20-18 19-17 20 2 20 11 0 28-9 38-20zm54-19c-6-2-15 3-20 10-15 24-10 29 11 11 12-10 16-18 9-21zm-4020 15c14-17-12-30-42-20-20 6-20 7-2 20 24 17 30 17 44 0zm350-41c97-48 101-51 101-82 0-18-4-33-10-33-20 0-191 92-196 105-3 8-11 12-17 9-7-2-19 1-27 6-13 9-11 13 10 30 14 11 28 19 31 17 4-1 52-24 108-52zm3749 39c27-18 29-34 4-34-16 0-62 34-62 45s37 4 58-11zm73-14c18-15 20-19 8-20-9 0-24 9-34 20-23 26-4 26 26 0zm-4062-4c9-10 6-17-13-30-27-17-62-21-70-7-8 13 35 46 65 50 4 1 12-5 18-13zm4126-6c16-18 16-20 2-20-9 0-21 9-27 20s-7 20-2 20 17-9 27-20zm82-5 28-24-24-1c-24 0-61 25-61 42 0 16 29 8 57-17zm85-14c25-21 11-34-17-15-29 19-42 46-17 37 9-4 24-13 34-22zm78 4c38-20 38-35 0-35-19 0-33 7-40 19-19 36-7 41 40 16zm-4552-7c-3-7-11-13-18-13s-15 6-17 13c-3 7 4 12 17 12s20-5 18-12zm4674-25 23-25-35 7c-37 8-73 33-65 45 9 14 53-2 77-27zm-4423 18c11-7 7-13-17-25-56-29-102-16-55 16 31 20 51 22 72 9zm419-3c12-12 17-88 6-88-3 0-14 5-25 10-14 8-19 21-19 50 0 41 14 52 38 28zm4077-18c18-19 17-20-3-20-12 0-26 9-32 20-8 16-8 20 3 20 8 0 22-9 32-20zm75-22c0-13-18-9-34 8-9 8-16 20-16 25 0 11 49-22 50-33zm-4879 17c0-5-9-11-21-13-20-3-27 8-13 22 10 9 34 3 34-9zm139 5c17-11 16-12-37-39-78-39-109-19-35 22 54 30 52 30 72 17zm4818-12c17-15 15-28-5-28-18 0-53 28-53 42 0 11 39 1 58-14zm-4493-46 110-57 3-43 3-44-140 72c-184 95-182 93-145 113 16 9 36 16 44 17 8 0 65-26 125-58zm4566 39c13-11 21-23 17-26-9-9-58 21-58 35 0 15 15 12 41-9zm95-22c14-15 14-19 3-19-18 0-59 28-59 40 0 13 37 0 56-21zm72-24c-7-8-38 23-38 38 0 6 10 2 22-10 12-13 19-25 16-28zm-5258 25c0-5-7-10-15-10s-15 5-15 10c0 6 7 10 15 10s15-4 15-10zm270 2c0-17-95-61-110-52-17 10-16 11 30 39 35 21 80 28 80 13zm440-17c6-8 10-27 8-44-3-29-4-30-28-18-19 9-26 22-28 49-3 32-1 36 17 31 11-3 25-11 31-18zm4621 5 24-19-25-1c-25 0-50 16-50 32 0 15 27 8 51-12zm74-28c-6-7-35 18-35 31 0 5 9 2 20-8s18-20 15-23zm-5455-2c-19-12-40-13-40 0 0 5 8 13 18 19 22 13 44-5 22-19zm688-199c2-30-1-51-7-51-19 0-335 167-339 178-2 7 9 17 24 22 15 6 24 13 21 16s-19-2-36-10c-32-17-72-13-90 8-8 10 1 19 37 39l47 26 170-88 170-88 3-52zm4847 209c18-19 17-20-6-20-25 0-49 16-49 32s37 8 55-12zm66 0c10-6 19-15 19-20 0-17-26-11-45 10-20 22-7 27 26 10zm-5471-10c0-17-89-55-101-43-7 7 0 16 23 31 35 23 78 29 78 12zm720-52c0-41-2-43-31-28-14 8-19 21-19 50 0 39 1 39 25 28 20-9 25-18 25-50zm4836 45c12-12 13-18 4-21-7-3-22 5-33 17-18 18-19 21-5 21 9 0 24-8 34-17zm62-5c19-19 14-30-8-18-11 6-20 15-20 20 0 14 14 12 28-2zm67-26c-9-9-35 8-35 24s2 16 20-1c11-10 18-20 15-23zm61 11c11-12 13-18 5-21-13-4-41 16-41 29 0 14 17 10 36-8zm-5948-4c-2-6-8-10-13-10s-11 4-13 10 4 11 13 11 15-5 13-11zm255 4c9-8-57-53-77-53-31 0-25 20 11 39 41 22 56 25 66 14zm5755-5c19-19 14-30-8-18-11 6-20 15-20 20 0 14 14 12 28-2zm78-19c4-7-2-9-17-7-13 2-25 11-27 21-3 16-1 17 17 8 11-6 23-16 27-22zm64-9c0-6-7-10-15-10s-15 2-15 4-3 12-7 21c-5 15-3 16 15 6 12-7 22-16 22-21zm-6195 1c6-11-33-26-43-16-4 3 0 10 8 15 19 12 27 12 35 1zm366-1c27-15 24-23-16-45-27-14-42-16-62-9-38 13-38 28-1 46 40 20 53 21 79 8zm493-1c27-13 38-42 29-77-6-26-5-25-38-10-21 9-25 18-25 55 0 48-1 47 34 32zm-734-9c0-18-89-55-101-43-7 7-1 16 23 31 35 22 78 28 78 12zm-190-30c0-5-4-10-9-10-6 0-13 5-16 10-3 6 1 10 9 10 9 0 16-4 16-10zm459-96c113-59 208-108 210-110 3-3-11-20-29-39l-34-35-225 116c-124 64-230 120-234 124-11 10 52 48 82 49 13 1 116-47 230-105zm155 40 126-66-21-29c-11-16-25-29-30-29-18 0-291 141-285 147 13 13 62 42 72 42 7 1 69-29 138-65zm4e2 50c11-4 16-19 16-50 0-48-2-49-31-34-14 8-19 21-19 50 0 40 5 45 34 34zm-1059-24c-3-5-10-10-16-10-5 0-9 5-9 10 0 6 7 10 16 10 8 0 12-4 9-10zm111-2c9-15-44-58-73-58-38 0-34 17 10 44 48 29 53 30 63 14zm303-153c116-60 211-114 211-119s-12-24-26-43l-26-34-151 80c-242 126-351 187-354 198-2 5 16 18 39 30 52 25 27 34 307-112zm583 90c9-12 10-89 2-98-4-3-19 0-35 9-27 13-29 19-29 69v55l28-13c15-6 30-16 34-22zm-1092 15c0-5-7-10-16-10-8 0-12 5-9 10 3 6 10 10 16 10 5 0 9-4 9-10zm457-218c101-53 183-101 183-105 0-18-42-67-58-67-9 0-93 42-186 94-94 51-226 122-293 157-68 35-123 67-123 70s21 17 47 32l48 26 1e2-55c55-30 182-98 282-152zm702 174c7-8 11-36 9-65-3-51-3-51-25-36-19 13-23 26-23 66 0 51 15 64 39 35zm-204-33c47-23 56-32 61-61 10-54-6-58-85-18-39 20-71 41-71 46 0 11 30 60 36 60 2 0 28-12 59-27zm-951-49c7-18-3-64-14-64s-20 26-20 56c0 27 24 33 34 8zm1074-10c17-12 22-25 22-59v-45l-35 17c-32 15-35 20-35 60 0 47 11 53 48 27zm-1030-45c2-41 1-43-13-25-19 24-20 79-2 74 6-3 13-24 15-49zm882-2c75-37 85-45 85-69-1-14 3-24 7-22 4 3 8 14 8 24 0 19 1 19 34 3 31-14 35-20 38-67 3-28 3-54 1-59-5-9-323 152-323 163s50 70 58 70c4 0 45-19 92-43zm-797-3c73-37 387-204 415-221l23-14-21-29c-12-17-27-30-35-30-12 0-410 223-428 239-10 10-22 81-13 81 4 0 30-12 59-26zm1035-38c3-42 1-48-13-42-9 3-19 6-21 6s-4 21-4 46c0 38 3 45 18 42 13-2 18-15 20-52zm-1160-61c-3-46-4-48-20-31-18 17-25 86-11 1e2 16 16 34-23 31-69zm55-14c5-29 6-56 2-59-13-14-35 33-35 76 0 61 23 50 33-17zm877-26 170-85v-50c0-28-4-50-10-50-17 0-4e2 194-4e2 203 0 15 44 66 58 66 7 1 89-37 182-84zm-640-68c96-55 181-104 187-110 10-7 8-16-8-38-11-16-25-29-32-29-21 0-355 190-361 206-3 9-6 33-6 55 0 47-26 57 220-84zm858 101c13-13 17-118 4-118-20 0-32 28-32 77 0 54 6 63 28 41zm-1146-108c4-41-7-51-30-28-13 13-17 70-5 81 13 13 31-15 35-53zm888-43 205-102 3-57c2-32 0-58-3-58s-56 26-118 59c-61 32-172 88-245 125l-133 66 27 35c14 19 34 35 43 34 9 0 108-46 221-102zm-820 25c0-12 3-13 8-5 6 10 53-12 173-78 90-50 165-93 167-94 8-7-20-45-32-45-7 0-89 39-182 88l-169 87-3 43c-3 41-2 43 17 32 12-6 21-18 21-28zm1828-25c34-67 37-77 22-77-8 0-80 119-80 133 0 4 6 7 13 7 6 0 27-28 45-63zm-126-3c4-41 10-61 24-71 47-35 206-60 531-84 194-14 214-9 237 55 9 22 17 52 18 66 2 19 8 24 23 22 43-8 45-16 45-210v-185l-132 7c-73 3-281 13-463 21-181 9-335 17-341 19-8 3-11 58-9 183 4 217 2 198 21 217 29 30 41 19 46-40zm184-27c14-27 23-51 21-53-5-5-77 122-77 134 1 12 30-31 56-81zm37 18c39-68 42-75 28-75-5 0-25 32-45 70-47 88-33 92 17 5zm52-11c20-37 34-68 31-71-2-3-17 17-32 44-15 26-33 58-40 70-16 26-18 37-5 29 5-4 26-36 46-72zm-201 20c26-47 35-77 17-58-11 10-52 104-46 104 2 0 15-21 29-46zm255-24c22-38 36-72 32-75-11-6-20 5-59 76-34 61-37 69-23 69 5 0 27-31 50-70zm47-6c20-36 34-67 31-70-4-5-37 48-72 115-30 59 3 23 41-45zm53-3c46-77 48-83 26-74-9 3-30 33-48 67-41 79-40 76-29 76 5 0 28-31 51-69zm51-2c23-39 39-73 36-76-8-8-7-9-55 70-44 73-46 77-31 77 5 0 28-32 50-71zm-1090-15c0-52-1-54-20-44-16 9-20 21-20 66 0 52 1 54 20 44 16-9 20-21 20-66zm1149 10c46-73 46-74 28-74-11 0-87 116-87 133 0 22 23-1 59-59zm54-3c47-78 44-106-5-30-54 84-63 102-47 97 7-2 30-33 52-67zm-1271-197c8-5 12-114 4-114-7 0-523 275-545 290l-21 15 25 32 26 32 252-125c138-69 255-128 259-130zm1324 194c48-78 49-78 32-78-7 0-29 28-48 62-44 78-44 78-32 78 5 0 27-28 48-62zm48-3c49-85 41-95-10-13-47 75-48 78-37 78 5 0 26-29 47-65zm50-17c10-15 14-28 9-28-4 0-21 24-36 53-28 52-6 33 27-25zm26 21c0-18-10-8-25 24l-16 32 21-24c11-13 20-27 20-32zm-2542 19c7-7 12-38 12-71 0-50-2-58-17-55s-19 16-21 71c-3 66 3 78 26 55zm211-109c86-45 158-83 159-84 2-2-10-24-27-49l-32-46-132 66c-73 37-133 67-133 68-1 0-5 29-9 64-5 47-4 62 6 62 7 0 82-36 168-81zm666-130c110-56 208-108 218-117 12-11 17-30 17-69v-53l-47 24c-49 25-375 207-496 278-65 38-67 40-52 61 24 35 16 45-10 12-19-23-27-27-37-17-9 9-6 18 16 41l28 29 82-44c44-25 171-90 281-145zm269 145c12-5 16-21 16-66 0-51-2-59-16-54-9 3-18 6-20 6s-4 27-4 60 2 60 4 60 11-3 20-6zm-693-83c-13-23-26-27-36-10-4 5 1 19 11 30 22 25 41 10 25-20zm-447 13c17-17 23-114 7-114-33 0-41 14-41 71 0 61 7 70 34 43zm718-127c123-68 271-150 331-183 96-53 107-62 107-86 0-16-2-28-4-28-4 0-586 313-663 357-38 21-41 26-30 43 6 11 17 20 24 20s112-55 235-123zm-442-19c0-5-5-19-11-31-9-20-8-20 11 2l21 24 80-39c44-21 85-44 90-50 6-7-5-22-32-43l-40-33-87 46c-48 26-129 68-179 94l-93 47v58 58l120-62c66-34 120-66 120-71zm130 92c0-6-8-23-17-38l-17-27 31 29 32 29 73-40c40-22 143-77 228-121 85-45 214-112 285-150l130-69 3-62 3-62-133 68c-124 64-134 71-161 118-77 135-181 191-297 161l-54-14-98 49c-67 34-97 54-92 62 36 60 84 98 84 67zm734-16c12-5 16-21 16-66 0-51-2-59-16-54-9 3-18 6-20 6s-4 27-4 60 2 60 4 60 11-3 20-6zm-1120-106c8-42 8-78-2-78-4 0-18 7-30 16-18 12-22 25-22 64 0 49 0 49 24 39 15-7 26-23 30-41zm187-70c88-45 159-86 159-91 0-16-41-67-54-67-6 0-71 32-144 71l-132 71v49c0 27 3 49 6 49 4 0 78-37 165-82zm1239 52c102-5 505-26 895-45 391-19 1214-60 1830-90s1260-62 1430-70c628-30 740-36 758-41 16-5 17-116 17-2142 1-1175 1-2227 1-2337 1-110 0-284 0-387l-1-188h-44-45l-4 243c-2 133-3 679-2 1212 1 584-2 948-7 915-5-30-11-563-14-1185-2-621-7-1145-10-1162-4-30-8-33-39-33h-33l-6 73c-3 39-7 281-10 536-3 254-7 466-10 469-6 5-8-292-6-820l1-257-45-6c-76-12-76-11-76 125 0 78-4 119-10 115s-10-56-10-125v-118l-87-6c-184-13-725-37-729-33-3 2 68 28 156 57 89 28 159 54 157 57-7 6-250-61-337-93-43-16-102-28-175-34-150-12-431-24-425-17 6 6 152 60 465 172 505 181 742 272 732 281-3 3-139-43-303-102-165-58-387-138-494-176s-271-96-365-128l-170-58-190-11c-104-6-597-32-1095-56-498-25-1123-57-1389-70-510-27-5e2-27-501 18 0 9-4 17-10 17-5 0-10-13-10-30 0-22-5-30-18-30-18 0-19 16-25 268-3 147-4 827-2 1512 3 685 5 1818 5 2518v1272h33c17 0 115-5 217-10zm-290-91c0-57-1-59-20-49-17 9-20 21-20 71 0 57 1 59 20 49 17-9 20-21 20-71zm-507 6c31-39 29-42-16-19-44 23-58 35-51 45 11 19 40 8 67-26zm-621-48c1-37 2-38 5-9 2 17 9 32 15 32 9 0 235-115 246-125 8-7-44-85-56-85-8 0-72 30-143 68l-129 67v63 63l30-16c26-13 30-22 32-58zm694 52c35-21 1e2-96 91-105s-61 23-86 53c-13 15-33 38-44 51-26 28-6 29 39 1zm-165-9c21-12 191-211 185-218-3-2-29 11-58 28-57 35-183 173-173 190 8 13 21 13 46 0zm-35-65c20-25 35-48 32-50-8-8-98 54-98 68 0 15 9 27 21 27 4 0 24-20 45-45zm182-9c74-38 233-226 191-226-44 0-116 71-242 238-14 18-2 15 51-12zm-262-12c26-18 159-184 146-184-4 0-29 13-56 28-56 31-142 132-133 157 8 19 12 19 43-1zm-237-164c23-15 23-16 5-53-10-20-23-37-28-37-6 0-49 23-96 50-47 28-93 53-102 56-14 4-18 17-18 60v55l108-58c60-32 119-65 131-73zm192 108c27-33 23-41-11-23-30 15-36 26-23 38 10 10 13 9 34-15zm441 0c15-12 35-58 25-58-3 0-17 16-31 35-27 35-24 46 6 23zm-257-20c33-18 2e2-197 191-205-1-2-27 11-58 27-41 22-72 51-121 115-37 47-64 85-60 85 5 0 26-10 48-22zm455-78 120-60v-70c0-39-3-70-7-70-3 0-34 16-68 35l-63 35-12 63c-6 35-15 70-20 77-17 28-22 1-9-54 12-57 8-79-13-58-8 8-57 142-58 160 0 6 19-2 130-58zm-645-21c30-40 54-74 51-76-10-10-86 39-114 74-23 30-28 43-21 56 6 9 14 17 19 17s34-32 65-71zm33 47c28-14 74-59 128-121 46-54 82-1e2 80-102-8-8-112 57-137 84-47 51-131 163-122 163 4-1 27-11 51-24zm322-32c28-15 72-52 101-85 28-33 54-57 57-54s-7 19-23 35-26 33-22 36c7 7 57-22 57-34 1-4 5-26 9-50 5-23 5-45 1-47-19-12-1e2 50-150 112-30 38-63 78-74 91-25 29-17 28 44-4zm-577-141c-4-48-17-48-112 7-90 51-91 52-91 91v39l103-55c92-50 102-57 1e2-82zm178 50c36-39 130-163 125-163-11 0-84 46-109 69-94 85-139 173-70 137 16-8 40-27 54-43zm249 32c37-19 69-49 125-120 41-51 75-97 75-1e2.0-13-98 50-130 85-46 49-133 160-125 160 3 0 28-11 55-25zm-304-92c-7-8-66 30-66 42 0 26 16 24 42-6 16-18 26-34 24-36zm164 19c47-27 1e2-80 178-180 19-23 30-42 25-42-4 0-35 15-68 33-45 24-74 50-118 107-61 79-81 110-72 110 3 0 28-13 55-28zm-429-12c27-16 65-36 85-45 32-13 35-18 29-42-3-16-10-32-15-37-10-10-12-9-1e2 43-59 35-65 42-68 75-4 44 6 45 69 6zm742-6c29-14 70-42 91-63 23-21 36-29 33-18-7 20 3 22 25 5 15-12 35-128 23-128-3 0-27 11-54 24-31 16-62 44-91 83-24 32-55 73-68 91-29 39-26 39 41 6zm230-33c4-30 5-56 2-59-12-13-33 26-38 71-4 40-2 48 12 45 11-2 18-20 24-57zm-728-27c25-31 44-59 42-61-7-6-99 51-110 68-11 18-3 49 12 49 6 0 31-25 56-56zm825 26 60-30v-56-55l-62 33-63 33-5 53c-3 28-2 52 3 52 4 0 34-14 67-30zm-779-15c24-13 68-52 98-85 29-34 56-59 59-55 3 3-7 19-23 35s-26 32-23 35c7 7 97-43 132-74 16-14 26-20 22-13-4 6-5 12-1 12 9 0 286-140 326-166 35-22 39-29 39-64 0-22-4-40-10-40-5 0-106 52-222 117-117 64-243 133-280 153-46 25-79 52-105 86-20 27-43 55-50 62-13 13-17 22-9 22 2 0 23-11 47-25zm312-21c29-14 76-51 106-83 39-41 46-46 27-18-15 20-25 37-22 37s50-23 106-51l1e2-51v-59-60l-118 61c-106 54-124 66-168 122-63 81-96 128-89 128 3 0 29-12 58-26zm-583-41c38-21 70-42 70-48 0-23-22-85-30-85-5 0-33 13-62 29l-53 29-3 56c-2 31 0 56 3 56s37-17 75-37zm204-20c28-27 44-40 37-30-8 9-12 19-10 21s76-37 164-86 238-130 333-180l172-90v-44c0-24-4-44-9-44-14 0-251 131-251 139 0 4 6 13 13 20 10 10 7 10-14 1-25-11-40-5-2e2 85-233 131-263 150-294 191-26 34-28 64-3 64 7 0 35-21 62-47zm760-21c8-51 8-92-1-92-30 1-56 82-40 124 10 26 34 7 41-32zm96-17 50-25v-60c0-33-3-60-7-60-5 0-30 13-58 28l-50 27-3 58c-2 36 1 57 8 57 6 0 33-11 60-25zm-906-34c23-16 48-36 55-45s17-14 21-11c5 3 90-41 190-97l182-102-37-33c-21-18-41-33-46-33s-64 32-130 70c-67 39-125 70-130 70-17 0-168 181-162 196 7 19 8 19 57-15zm-146-54c31-18 34-23 28-55-3-19-7-37-10-39-2-3-27 8-55 24-50 28-51 29-51 77v48l27-17c14-10 42-27 61-38zm147-56c-2-2-20 7-39 19-34 21-44 39-29 53 6 7 74-65 68-72zm803 51c16-11 28-122 12-122-32 0-50 22-50 60 0 62 10 79 38 62zm107-54 45-22v-58c0-32-3-58-7-57-5 0-28 10-53 22-45 22-45 22-48 80-2 34 1 57 7 57s31-10 56-22zm-1044-75c3-9 4-27 1-40l-4-23-47 26c-56 33-59 37-53 73l4 29 47-24c25-14 49-32 52-41zm111 15c46-50 47-50 24-13-14 22-26 43-26 48 0 9 47-16 220-117 165-98 155-88 122-119l-27-26-185 108c-174 101-185 109-188 139-2 18 0 32 4 32s29-24 56-52zm821-29c19-8 26-21 30-52 7-54 2-60-34-42-25 14-29 21-29 60 0 50-1 49 33 34zm-832-61c45-47 60-51 21-5-23 27 3 21 51-11 23-16 84-52 135-82 50-30 92-57 92-60 0-4-10-16-23-28l-23-21-134 80c-159 95-180 113-180 151 0 15 2 28 5 28s28-24 56-52zm-150 10c44-29 49-36 49-70 0-20-4-39-10-43-5-3-27 6-50 20-33 21-40 31-41 58 0 17-2 40-4 50-4 23-2 22 56-15zm1094 0c44-22 45-23 45-70 0-26-2-48-5-48s-28 11-55 25c-49 25-50 26-50 70 0 25 4 45 10 45 5 0 30-10 55-22zm-174-178c1-17 3-19 6-7 2 9 9 17 13 17 5 0 52-23 105-51l95-51v-64c0-35-2-64-4-64-5 0-478 259-484 265-2 2 11 19 28 39 39 44 33 46-14 5-34-30-35-30-67-14l-31 17 38 39 38 38 138-72c119-62 138-75 139-97zm-742 54c6 4 62-24 124-62 264-163 495-295 674-386 152-78 163-87 163-142 0-24-2-44-5-44-18 0-373 215-385 233-66 96-138 144-237 156-61 8-85 18-189 79-101 60-128 82-176 141-66 81-77 113-19 57 22-21 44-35 50-32zm819 50c16-11 22-26 24-57l1-42 4 38c5 43 14 45 68 14 37-21 40-26 43-70 4-55-4-58-63-22-22 13-61 34-87 46-45 20-48 24-48 59 0 54 16 63 58 34zm-998-54c35-18 40-25 40-55 0-19-3-35-8-35-4 0-24 11-45 25-29 20-37 32-37 55 0 36 0 36 50 10zm585 4 24-16-21-29c-26-35-24-34-67-8l-33 20 23 25c26 28 41 30 74 8zm-464-25 22-31-32 16c-17 9-31 23-31 31 0 24 17 17 41-16zm739-123c291-154 280-145 280-207 0-27-4-49-10-49-5 0-114 62-242 137s-250 146-270 157c-21 12-38 25-38 30 0 12 42 57 50 54 3-2 107-56 230-122zm-52-97c174-99 321-184 325-188 5-5 7-25 5-45l-3-36-215 121c-118 67-280 159-358 206l-144 85 23 24c13 14 29 22 36 19 8-2 156-86 331-186zm-768 76c0-19-3-35-8-35-4 0-24 11-45 25-32 23-37 31-37 66v40l45-31c39-27 45-36 45-65zm140 9c0 4-9 21-21 37-11 16-18 29-14 29 3 0 64-35 136-77l131-77-34-17c-18-10-39-18-46-19-17 0-179 105-219 143-18 17-33 40-33 51 0 16 9 11 50-29 28-27 50-46 50-41zm-55-34c16-16 35-30 42-30 11 0 113-59 132-76 8-7-32-44-47-44s-75 39-80 52c-2 4-23 32-48 61-24 30-44 57-44 61 0 14 18 4 45-24zm-85-90c0-22-3-40-8-40-4 0-24 11-45 25-34 23-37 30-37 71v45l45-31c41-28 45-35 45-70zm61 43c13-15 12-15-8-4-24 12-29 21-14 21 5 0 15-7 22-17zm402-61c15-10 60-50 1e2-88 124-118 147-138 147-130 0 4-30 39-67 77-72 74-72 85-2 41 32-21 52-45 72-86 16-31 27-60 25-65-6-18-129 67-238 164-60 55-110 1e2-110 102 0 10 50 0 73-15zm105-13c30-17 52-33 49-35-6-6-72 27-102 50-34 26-3 18 53-15zm-415-27c42-28 44-37 19-70l-18-23-62 40c-49 32-62 46-62 66 0 31 7 31 37 3 17-16 23-18 23-7 0 8-6 21-12 28-17 17 19-1 75-37zm270-7c27-25 46-45 43-45-12 0-126 75-126 82 0 21 40 3 83-37zm-466 14c19-12 39-33 44-47 7-19 12-23 18-13 6 9 21 4 64-23 31-20 59-41 62-47 4-5 18-14 32-20 14-5 95-53 180-107 114-71 162-107 179-134 24-38 30-58 17-57-5 0-150 94-323 208-268 177-315 212-318 235-4 32 1 32 45 5zm389-21c16-12 73-60 127-107 99-85 146-109 61-32-25 24-44 44-42 46 4 4 121-66 145-87 10-8 39-25 66-37 26-13 51-30 56-39 15-30 23-92 11-92-6 0-18 17-27 38-15 34-17 35-22 15-6-22-12-19-125 53-110 70-316 236-316 256 0 16 37 8 66-14zm-55-35 24-26-32 19c-18 10-33 22-33 26 0 15 17 8 41-19zm-170-140c104-71 189-133 189-139s-9-19-19-28c-18-17-26-13-2e2 1e2l-181 117v38c0 22 5 39 11 39 5 0 95-57 2e2-127zm168 67c34-27 65-50 69-50 3 0-12 19-33 42l-40 41 35-21c419-262 420-263 420-311 0-17-2-31-5-31-10 0-215 131-221 141-3 6-17 15-31 20-48 18-218 128-252 163-29 30-35 56-12 56 4 0 36-22 70-50zm653-108 158-87v-52c0-29-4-53-10-53-5 0-73 37-151 83l-142 83-23 63c-29 77-42 79 168-37zm-826-72c141-92 145-96 140-125-4-16-10-33-15-38s-77 37-170 99l-161 109v43 44l30-19c17-10 96-61 176-113zm-94-61c57-39 126-87 155-105 50-32 52-34 43-65-5-17-12-34-15-37s-70 39-150 93l-145 99v43c0 24 2 43 4 43 3 0 51-32 108-71zm960-23c21-12 38-24 38-28s-13-22-28-40l-29-31-60 36c-76 46-79 51-88 111l-8 49 69-38c38-21 86-48 106-59zm-508-35c105-67 120-80 137-119 26-59 21-68-21-40-19 13-90 59-157 102l-123 78 16 29c8 17 18 29 22 27s61-36 126-77zm196-22c78-50 97-74 88-114-6-30-114 52-149 113-16 28-27 52-25 52 3 0 42-23 86-51zm122-4c3-23 0-35-8-35-13 0-24 31-24 69 0 37 27 8 32-34zm-724-69c130-88 133-91 126-121-3-16-9-33-13-37s-66 34-139 84l-132 92v44c0 32 3 41 13 36 6-4 72-48 145-98zm1002 79c28-15 30-19 30-76v-61l-27 17c-14 10-41 26-60 37-18 11-33 23-33 26 0 11 45 72 53 72 4 0 21-7 37-15zm-598-97c88-57 166-112 173-123s16-40 20-63c7-41 6-43-12-34-29 16-49 44-62 89-16 58-33 66-25 12 6-34 5-41-7-34-8 5-76 49-152 98-107 69-137 93-131 106 3 9 9 24 11 34 3 9 10 17 15 17 6 0 83-46 170-102zm422 62c33-21 46-35 42-46-4-12-1-14 14-9 14 4 42-6 85-31 62-36 65-40 65-76 0-21-3-38-7-38-16 0-245 145-254 161-11 22-12 69-1 69 4 0 30-14 56-30zm-88-94c5-30 4-38-7-34-8 3-17 21-20 41-11 66 14 59 27-7zm-791-34c145-1e2 162-117 157-151-2-17-9-31-14-31s-63 37-128 83l-120 82v43c0 49-8 52 105-26zm418-37c81-53 149-101 152-105 3-5 8-29 12-55l6-47-182 121c-174 116-181 123-175 149 9 37 14 44 28 39 7-3 78-49 159-102zm282 63c38-26 52-42 61-73l12-40 1 35c1 20 5 30 10 25 11-12 25-95 16-95-4 0-35 18-69 40-55 35-64 47-78 90-9 28-13 50-9 50 3 0 29-15 56-32zm257-52 123-74 3-46c2-25 1-46-2-46-9 0-233 147-239 156-9 15-20 84-13 84 3 0 61-33 128-74zm-572-113 160-107v-54-53l-87 61c-49 34-125 87-170 118-57 39-83 63-83 77 0 24 11 65 17 65 2 0 76-48 163-107zm-337-15c76-54 97-74 97-93 0-13-4-27-10-30-5-3-61 29-125 72-113 77-115 79-115 117v38l28-17c15-10 71-49 125-87zm941-3c93-58 95-61 96-97 0-21-3-38-6-38-4 0-60 33-125 73l-119 72v43 44l29-19c16-10 72-45 125-78zm-184-47c0-27-3-48-6-48-4 0-27 12-51 28-43 27-63 64-63 120 0 21 2 21 60-15 60-38 60-38 60-85zm-494-16c236-163 239-165 242-205 2-20-1-37-6-37-17 0-355 234-360 250-6 16 7 60 17 60 4 0 52-31 107-68zm-367 31c20-14 37-27 39-29 2-1-3-16-10-33l-13-31-32 22c-27 19-33 30-33 61 0 20 3 37 7 37 3 0 22-12 42-27zm725-44c12-63 5-73-32-41-13 10-23 35-28 66l-7 49 30-21c18-13 33-34 37-53zm296-18 115-67 3-57c2-31-1-57-5-57s-60 33-123 74l-115 73-3 52c-2 28 1 51 5 51 4-1 60-31 123-69zm-895-24c46-33 61-49 63-71 6-49-11-50-77-5-57 40-61 46-61 81 0 21 3 38 8 38 4-1 34-20 67-43zm691 13c41-29 44-34 44-75 0-25-2-45-5-45s-23 11-44 26c-37 24-50 54-51 112 0 18 6 15 56-18zm-401-105c66-44 122-82 125-85s20-16 38-29c27-19 33-29 30-55-2-17-6-31-9-31s-86 54-183 120c-174 118-197 141-182 180 6 17-4 23 181-1e2zm242 31c4-29 2-46-5-46-16 0-20 11-28 71-6 51-5 53 11 38 9-10 20-38 22-63zm-647-18c0-51-10-59-42-34-13 10-18 27-18 65v52l30-18c27-15 30-23 30-65zm714 20c21-29 21-98 2-98-28 0-46 30-46 76 0 50 18 59 44 22zm314-68 102-63v-48c0-33-4-49-12-49-28 1-248 156-248 175 0 7 3 27 6 44 6 30 8 31 28 17 12-7 68-42 124-76zm-919 15c61-45 61-45 61-95 0-27-3-50-7-50-20 1-55 41-92 105-60 103-55 108 38 40zm444-188c28-22 37-36 38-60 1-25 3-27 6-9 3 15 10 22 21 20 13-2 18-16 20-51 3-53-6-58-46-26-58 45-286 209-332 239-43 28-50 37-50 64 0 18 3 35 6 39 6 5 264-160 337-216zm263 182c31-19 34-25 34-70 0-27-3-49-6-49-24 0-72 44-78 71-15 74-6 83 50 48zm-156-69c0-26-5-40-13-40-30 0-47 43-31 84 5 12 10 13 25 5 14-7 19-21 19-49zm-672-24c3-50-2-55-30-29-12 11-18 30-18 61 0 44 0 44 23 30 16-12 23-27 25-62zm72 31c0-5-7-4-15 3s-15 20-15 29c1 13 3 13 15-3 8-11 15-24 15-29zm905-38c183-115 165-98 165-152 0-27-3-46-7-44-27 14-148 86-199 119-48 30-61 44-59 61 1 12 3 32 4 45 0 12 4 22 9 22 4 0 43-23 87-51zm-254 31c14-8 19-21 19-50 0-43-2-45-31-30-14 8-19 21-19 50 0 43 2 45 31 30zm-330-117c91-65 184-131 207-148 40-28 42-33 38-68-2-21-7-41-9-44-3-3-43 21-89 53-46 31-124 86-174 121-51 34-94 72-97 82-3 14-11 18-26 14-20-5-21-1-21 51 0 31 1 56 3 56 1 0 77-53 168-117zm-258 42c44-29 46-32 47-77 0-27-4-48-9-48-10 0-101 140-101 154 0 10 7 7 63-29zm7e2 3c15-11 27-29 27-41 0-17 2-19 10-7 10 16 22 10 180-86l85-51 3-47c2-25-1-46-5-46-8 0-283 176-337 216-26 19-28 25-22 58 7 39 8 39 59 4zm-185 10c13-13 17-78 4-78-18 0-32 26-32 57 0 35 8 41 28 21zm-568-43c17-25 27-45 23-45-17 0-63 52-63 70 0 29 5 25 40-25zm-96 6c12-13 16-32 14-60-3-41-3-41-25-26-18 13-23 26-23 61 0 48 8 54 34 25zm750-55c-8-40-8-40-33-24-15 9-20 22-19 43 2 43 6 47 34 28 21-13 24-21 18-47zm-490-2c9-24 7-94-3-94-13 0-21 27-21 71 0 40 13 52 24 23zm-139-69c31-41 59-75 62-75 5 0-34 68-49 85-20 23-5 23 31 0 33-22 39-33 45-72 3-25 4-48 1-51-7-7-142 96-149 114s-8 74-2 74c3 0 30-34 61-75zm782 2c60-40 141-93 181-116l72-43v-50-50l-27 17c-16 10-73 50-128 90-55 39-126 88-157 108-55 35-58 39-58 77 0 22 2 40 5 40s53-33 112-73zm-449-62c187-128 194-135 182-175-11-39-19-48-28-34-4 5-56 43-117 84-2e2 134-195 130-195 166 0 18-3 40-7 50-10 27 8 17 165-91zm282 51c12-32 1-78-18-74-24 5-35 32-28 71 5 27 11 35 22 30 9-3 19-15 24-27zm-730 6c17-14 21-26 18-61l-3-43-27 22c-22 17-28 30-28 61 0 43 7 47 40 21zm822-55c12-12 125-91 266-186l62-43v-54c0-54 0-55-23-42-13 7-101 69-195 138-159 116-172 127-172 157 0 63 18 72 62 30zm-648-156c-14-15-114 120-114 155 0 11 25-17 59-66 33-47 57-87 55-89zm1e2 105c4-26 5-50 2-53-12-12-24 12-31 61-9 65 16 59 29-8zm-53-74c10-41 10-74 0-68-9 6-91 141-91 150 0 18 86-59 91-82zm105 61c3-16 10-41 15-57 11-35 4-45-16-25-19 18-32 109-17 109 7 0 14-12 18-27zm377 9c13-15 15-25 6-55-9-33-12-35-29-24-20 12-26 49-14 81 8 21 17 20 37-2zm-702-15c20-16 28-35 33-69 3-27 3-48-1-48-3 0-21 9-39 21-31 19-34 25-34 70 0 27 3 49 8 49 4 0 19-10 33-23zm511-104c97-65 147-104 148-116 0-10-7-31-16-48l-15-30-67 47c-165 117-180 131-197 186-8 28-15 53-15 55 0 10 30-7 162-94zm276 60c15-10 29-20 32-24 3-3 23-18 45-32 22-15 58-39 80-55s76-53 120-84l80-56 3-51c3-48 2-51-15-42-61 33-388 279-391 294-4 21 5 67 14 67 2 0 17-8 32-17zm-677-35c14-13 49-58 79-1e2 58-85 80-1e2 31-22-38 58-39 71-6 47 21-15 55-93 55-125 0-5-19 4-41 19-40 26-159 171-159 192 0 17 15 13 41-11zm188-42c6-24 14-51 17-61 6-15 4-16-14-6-13 7-24 28-31 61-14 63-14 60 3 54 8-3 19-25 25-48zm391-6c0-40-14-54-39-41-21 11-22 26-5 79 7 22 44-10 44-38zm-674-17c21-16 35-38 42-65 6-24 9-44 7-46-1-2-26 13-54 33-47 34-51 40-51 77 0 43 1 43 56 1zm349 1c14-15 25-32 25-38 0-7 3-7 8 1s36-9 97-54c50-36 98-71 108-78 18-12 18-15 2-45-10-19-22-30-30-26-20 7-198 140-211 157-18 23-44 109-33 109 6 0 21-12 34-26zm-265-15c0-6-4-7-10-4-5 3-10 11-10 16 0 6 5 7 10 4 6-3 10-11 10-16zm841-121c199-139 204-144 207-180 2-21 1-38-3-38-3 0-36 21-74 46-58 38-68 49-63 67 5 20 4 21-12 8-15-12-31-4-149 74-73 49-133 89-135 91-6 4 10 74 18 74 4 0 99-64 211-142zm-710-48c38-47 69-89 69-93 0-5-21 7-46 25-89 63-154 135-154 170 0 19 1 19 32 1 17-10 62-56 99-103zm-181 50c31-25 78-115 66-127-2-3-38 21-80 52-73 54-76 57-76 97v40l28-17c15-10 43-30 62-45zm327-23c19-26 48-54 64-62 42-22 43-18 4 16-59 52-31 45 45-11 68-50 70-53 54-71-25-28-42-24-125 36-58 41-81 64-98 99-11 25-21 53-21 62 0 15 2 15 21-2 11-10 37-40 56-67zm466-29c64-43 117-82 117-87 0-19-53-72-67-67-25 10-215 149-220 161-8 21 25 87 39 79 7-4 66-43 131-86zm-551-12c18-19 46-51 62-71 33-41 92-75 132-75 29 0 274-165 274-185 0-17-30-55-44-55-17 0-48 35-39 43 3 4-3 7-14 7-12 0-83 45-159 101-77 55-144 104-150 107-17 11-116 162-105 162 5 0 25-15 43-34zm-230-63c81-60 93-73 123-137 19-39 33-72 31-73-4-4-128 91-203 155-47 39-53 49-53 83 0 22 3 39 6 39 4 0 47-30 96-67zm193-53c86-95 133-132 66-51-23 27-41 52-41 55 0 7 50-27 219-152l123-91-33-20c-19-12-36-21-39-21-3 1-84 60-180 133-145 110-179 140-197 177-47 97-25 88 82-30zm516 24c60-43 109-82 109-87 0-14-30-47-43-47-15 0-217 144-217 155 0 12 28 55 36 55 3 0 55-34 115-76zm299-45 80-51v-64c0-35-2-64-5-64-5 0-192 126-209 141-8 7 39 89 50 89 2 0 39-23 84-51zm-351-44c55-38 1e2-73 101-76 0-4-8-16-17-28l-18-22-115 82c-63 45-117 83-120 86-9 8 44 41 56 35 7-4 58-38 113-77zm-615-42c67-51 153-118 191-148 39-31 116-89 173-130 56-41 102-77 102-81 0-12-21-44-29-44-11 0-231 167-428 324-141 112-153 123-153 154 0 40-11 45 144-75zm931-50 115-76v-50c0-40-3-48-15-43-20 7-253 175-261 187-7 12 22 59 36 59 6 0 62-34 125-77zm-974-20c47-38 169-133 272-212s187-147 187-151-9-18-19-31l-19-24-144 109c-78 60-196 152-260 203-115 91-118 94-118 133 0 22 4 40 8 40 5 0 47-30 93-67zm375-115c11-17-38 2-74 29s-112 119-112 135c0 10 173-143 186-164zm74 1c0-5-9-9-21-9-19 0-67 44-144 130-11 13 22-7 73-45 50-37 92-71 92-76zm498 25c141-97 142-98 142-136 0-29-3-37-12-32-48 29-328 227-328 232 0 12 34 42 44 39 6-3 75-49 154-103zm-785-162c130-101 237-187 237-192 0-4-8-17-17-29l-18-21-45 36c-25 20-126 97-225 171-99 75-183 140-187 147-4 6-8 28-8 49 0 29 3 36 13 30 7-4 120-91 250-191zm757 71 170-117v-48c0-33-4-48-13-48-22 0-37 23-38 60-1 31-2 32-8 10-4-14-13-24-19-23-19 4-322 225-322 235 0 18 35 57 47 53 7-2 89-57 183-122zm-301 78c23-17 23-19 6-44-21-33-36-34-72-3l-28 24 25 21c31 25 39 25 69 2zm169-119c99-72 102-75 102-113 0-25-5-39-12-39s-51 28-98 61c-71 51-85 66-83 86 2 23 1 24-15 10-15-14-19-14-40 4l-24 19 22 30c13 19 26 27 34 23 7-5 58-41 114-81zm-247 51c21-16 39-30 39-33s-11-18-23-34l-24-29-68 49-69 48 45 12c61 17 56 17 1e2-13zm-490-114c74-56 171-131 217-166l82-64-17-30c-10-16-22-29-28-29-5 0-62 44-125 96-63 53-152 123-197 157-79 58-83 63-83 99 0 21 4 38 9 38s69-46 142-101zm582 46c18-13 18-15-4-44-27-36-23-35-54-15l-25 16 21 29c23 32 35 35 62 14zm142-101 105-76v-49c0-27-3-49-6-49-6 0-186 129-233 167l-24 20 22 32c12 17 24 31 27 31 2 0 51-34 109-76zm-680-104c189-155 568-455 688-544 57-44 77-64 77-82 0-12-5-26-11-30-7-4-67 50-145 127-73 73-137 130-141 126s13-28 38-54l44-47-40 29c-22 16-94 72-160 125s-169 133-230 180c-143 108-165 129-165 155 0 30-11 38-25 18-11-15-17-13-61 23-27 21-52 44-56 49-13 17-9 65 5 65 6 0 89-63 182-140zm481 109c3-6-2-20-13-31-19-19-20-19-44 1-23 19-23 19-5 40 19 21 45 16 62-10zm392-14c50-34 52-37 52-80 0-25-3-45-6-45s-30 17-59 38c-51 35-54 40-55 80 0 23 3 42 8 42 4 0 31-16 60-35zm-219-111c116-86 132-1e2 129-123-2-14-7-25-13-23-24 6-295 204-295 216 0 17 22 37 36 32 6-2 70-48 143-102zm-240 69 21-18-23-28-23-29-23 20c-24 19-24 19-5 45 23 31 26 32 53 10zm-531-71c37-32 43-42 40-70l-3-32-57 45c-51 40-58 50-58 80 0 42 8 40 78-23zm1112-15c0-49 0-49-22-35-17 12-24 27-26 62l-3 46 25-12c23-10 26-17 26-61zm-372-61 152-108v-45c0-38-3-44-17-39-27 11-352 250-353 260 0 17 34 47 50 43 8-2 84-52 168-111zm274 43c30-24 31-27 22-73l-9-48-50 38c-27 20-52 39-53 40-4 3-6 56-3 87 1 17 2 17 32 0 17-10 44-29 61-44zm-385-91c92-68 184-135 203-148s41-30 48-38c14-18 16-78 3-86-11-7-122 78-176 133-21 23-46 41-55 41-8 0-68 41-132 90l-118 91 17 25c9 14 22 23 29 20s88-60 181-128zm-636 26c58-46 59-48 59-95 0-27-2-49-4-49-3 0-32 23-65 50-58 48-61 53-61 95 0 25 3 45 6 45s32-21 65-46zm339-162c118-92 214-173 213-179s60-72 137-147c76-75 137-136 134-136-6 0-68 49-439 346-298 238-295 235-295 274 0 40-11 47 250-158zm310 3 240-180v-52c0-29-3-53-6-53-14 0-64 42-59 50 6 9-131 148-179 183l-28 20 11-20c6-12 50-58 98-103l88-83-90 69c-144 109-375 294-375 299 0 16 35 55 47 53 7-2 121-84 253-183zm453 171c12-10 17-27 17-65 0-55-1-56-31-41-15 9-19 22-19 65 0 58 4 63 33 41zm-105-71c34-25 42-36 42-63 0-37 1-37-68 13-34 25-42 36-42 63 0 37-1 37 68-13zm-995-75c60-47 70-67 65-119l-3-32-67 56c-66 54-68 57-68 101 0 25 4 44 8 42 4-1 34-23 65-48zm141 0c16-17 36-30 44-30s123-87 256-193c132-106 284-227 336-269l96-75-4-41c-3-30-8-40-16-34-7 4-142 108-302 232-306 238-454 374-454 416 0 31 9 30 44-6zm846-16c48-35 50-37 50-86 0-55 3-55-73 0-46 33-48 36-45 78 2 24 6 44 10 44 5 0 30-16 58-36zm130-31c0-30-2-33-20-23-26 14-38 37-32 65 4 23 5 23 28 8 18-11 24-24 24-50zm-18-50c12-11 18-30 18-60 0-47-7-52-39-25-19 14-21 23-15 60 7 47 10 49 36 25zm-1087-43c56-45 63-55 70-96 3-25 4-48 2-51-3-2-39 24-81 59-70 58-76 66-76 1e2.0 21 5 38 11 38s39-22 74-50zm533-295c284-222 307-243 310-273 6-62-3-67-51-31-78 61-545 431-634 502-45 36-63 57-63 74 0 13 2 23 4 23s39-35 81-77c86-86 83-78-15 42l-65 80 63-50c34-28 201-158 370-290zm439 288c50-34 53-39 53-80 0-23-3-43-7-43s-31 16-60 36c-50 35-53 39-53 80 0 24 3 44 7 44 3 0 30-16 60-37zm-972-119c77-61 83-71 84-127 1-35-1-37-19-27-12 6-23 25-27 41-4 20-8 26-14 18-7-12-50 14-93 57-16 15-23 94-8 94 4 0 39-25 77-56zm788-124c68-52 72-58 75-99l3-44-23 15c-13 9-22 23-20 31 1 8-59 74-135 148-151 145-159 149 1e2-51zm295 164c17-12 22-25 22-60 0-48-5-52-38-28-17 12-22 25-22 60 0 48 5 52 38 28zm-112-45 56-41-6-52c-3-28-6-52-6-54s-25 14-55 35l-54 38-1 58c0 31 2 57 5 57s31-18 61-41zm-666-162c-5 12-16 26-23 30s-25 26-42 47l-29 40 41-30c23-16 106-81 185-145 78-63 198-157 265-208s124-99 127-106c8-22-10-70-26-69-8 1-145 105-304 232-234 187-299 244-341 301-86 115-62 113 52-5 58-60 101-99 95-87zm775 87c22-14 25-24 25-75 0-33-3-59-7-59-5 0-21 10-37 23-27 22-28 26-21 75 4 29 9 52 11 52 3 0 16-7 29-16zm-1101-30c46-36 51-47 59-111 4-37 2-36-70 25-47 39-53 49-53 83 0 22 4 39 8 39 5 0 30-16 56-36zm188-27c14-11 61-59 104-108 42-49 79-87 82-84s-5 17-19 31c-49 54 6 15 236-166 226-178 235-186 230-215-3-16-9-33-14-38-6-6-97 61-228 165-120 96-233 185-252 199-56 40-191 201-191 227 0 25 3 24 52-11zm798-13c46-33 50-39 50-76 0-44-1-44-67 10-35 28-43 41-43 68 0 19 2 34 5 34s27-16 55-36zm-863-105c6-27 7-52 3-54-17-10-43 38-48 87-5 53-5 53 15 35 11-10 25-40 30-68zm-109 4c58-54 63-62 71-115 4-32 5-58 2-58-3 1-37 27-76 59l-70 57-3 57c-2 31 1 57 5 57 5 0 36-26 71-57zm1086 16c19-15 26-30 26-55 0-39-7-42-44-13-19 15-26 30-26 55 0 39 7 42 44 13zm-117-24c45-32 57-55 51-1e2l-3-28-57 47c-56 45-66 64-52 101 8 19 6 19 61-20zm-766-27c20-16 80-78 134-138 54-61 101-108 103-105 3 3-6 18-19 33-14 15-32 36-40 47-18 25-32 36 196-145 232-184 210-161 194-204-7-20-17-36-21-36-9 0-328 255-390 311-86 79-218 240-218 266 0 16 9 12 61-29zm-71-115c6-32 13-64 15-70 7-22-14-14-29 10-11 17-36 109-36 133 0 3 9 0 19-6 13-7 23-29 31-67zm953 53c24-19 28-29 25-65l-3-41-32 22c-38 26-46 46-37 82 8 31 11 32 47 2zm-105-41c33-29 42-43 42-69 0-18-3-35-6-39-4-3-33 14-66 40-48 37-59 50-54 67 3 11 6 29 6 39 0 22 18 14 78-38zm-996 3c33-31 49-55 56-85 5-24 8-43 5-43-2 0-31 23-64 51-50 44-59 57-59 85 0 19 4 34 8 34 5 0 29-19 54-42zm318-125c52-44 117-106 144-137s51-54 54-51c3 2-1 12-9 22-8 9-9 14-2 10 28-17 238-189 242-198 5-16-20-69-33-69-21 0-181 138-291 251-222 228-235 243-235 266 0 19-3 21 130-94zm782 40c21-20 28-36 28-65 0-21-3-38-6-38s-21 12-40 26c-28 22-34 33-34 65 0 46 13 49 52 12zm-1012-133c6-25 13-53 17-64 4-15-2-14-33 10-22 16-45 35-52 42-8 7-29 24-48 38-29 23-34 32-34 69 0 23 3 44 6 48 4 3 35-17 70-46 52-43 65-59 74-97zm17 119c19-40 26-79 14-79-15 0-37 39-45 78-7 40 12 40 31 1zm868-10c52-39 55-44 55-85 0-24-3-44-7-44-5 0-34 20-65 45-42 33-58 52-58 69 0 25 9 56 16 56 3 0 29-19 59-41zm-726-36c67-72 86-96 66-85-31 17-105 88-105 101 0 18 11 13 39-16zm-59-42c12-45 12-51 0-51-14 0-40 55-40 86 0 22 2 24 15 14 8-7 19-29 25-49zm940-88c0-24-3-43-6-43s-24 14-45 31c-39 31-45 49-33 96 6 22 7 22 45-9 35-28 39-36 39-75zm-107 2 107-79v-53c0-29-4-53-8-53-9 0-234 178-243 192-11 17 12 89 25 80 7-4 60-43 119-87zm-936-43c62-51 115-103 119-114 4-14 9-17 14-9 8 14 89-61 153-141 26-33 57-56 105-79 56-27 188-120 291-206 24-20 25-23 9-39-9-9-23-14-30-11-8 3-131 98-274 213-224 180-303 245-459 378-16 14-40 35-52 45-15 13-23 31-23 51 0 38-14 47 147-88zm396-87c209-170 217-178 201-196-9-11-24-19-32-19-15 0-422 401-422 415 0 5 8 1 18-7 9-8 115-95 235-193zm-317 107c9-29 14-55 12-57-1-2-14 5-27 16-22 18-40 69-41 113 0 37 39-13 56-72zm80-68c13-32 22-60 20-61-2-2-17 8-34 21-26 23-52 85-52 128 0 26 43-31 66-88zm69 34c47-49 34-44-27 11-24 21-36 41-25 41 1 0 25-23 52-52zm686-68 129-101v-46c0-35-3-43-12-36-7 6-68 51-135 101s-125 96-128 102c-8 12 2 80 12 80 3 0 63-45 134-1e2zm-1023 70c22-21 31-80 12-80-21 0-50 41-50 70 0 35 8 37 38 10zm522-199c63-52 119-98 124-102s-3-11-17-14c-24-6-42 8-172 131-80 77-145 143-145 148 0 9 18-5 210-163zm-387 88c136-118 280-235 492-398 66-51 121-96 123-1e2 1-4-7-16-18-26-18-17-21-17-46 0-36 24-342 270-504 407-124 105-135 117-138 151-2 20 0 37 3 37s43-32 88-71zm876-74 141-105v-55c0-30-3-55-7-55-10 0-270 203-299 233-20 20-20 25-8 55 8 17 18 32 23 32s72-47 150-105zm-1012 73c21-20 33-68 16-68s-53 46-53 67c0 29 7 29 37 1zm481-118c46-41 79-76 73-78-13-4-139 96-176 140-31 37-33 58-2 32 12-11 60-54 105-94zm-288-41c63-52 198-162 3e2-243 102-82 186-152 188-156 1-4-4-12-12-19-12-10-42 10-171 114s-3e2 244-432 356c-13 11-23 30-23 45 0 30-8 35 150-97zm-188 64c20-18 24-43 6-43-16 0-48 31-48 47 0 18 20 16 42-4zm914-53c50-39 99-79 108-89 16-17 15-20-17-44l-33-25-90 70c-125 98-119 90-1e2 127 9 17 22 31 28 31s53-32 104-70zm5454-289v-339l-27-6c-74-14-190-23-1488-116-933-67-1847-133-3025-220-294-21-559-40-588-42l-52-3v403c0 389 1 402 19 402 24 0 28-43 35-355 3-115 10-223 15-240 7-20 8 71 4 281l-6 312 89 6c82 6 362 21 1439 76 215 11 581 28 815 39s476 23 538 26c61 4 112 4 112 1s-450-154-1001-337c-550-182-999-332-997-334 6-6 808 250 1620 516l517 169 188 10c297 16 313 16 313 10 0-7-73-33-725-260-192-67-383-133-423-147s-71-27-69-29c4-4 821 267 1236 410 122 42 163 46 725 72 302 14 360 14 367 3 5-8 9-68 10-134 0-66 5-145 9-175 6-37 8 5 6 132l-2 186 36 6c19 3 45 6 58 6h22l1-257c2-297 15-266 25 60l6 197h39 39l1-132c1-73 5-2e2 9-283 6-142 7-135 8 115 1 146 5 275 8 288 5 18 13 22 50 22h44v-339zm-6140 159c346-281 4e2-328 386-339-9-8-77 42-267 195-296 239-309 251-309 277 0 14 4 17 13 10 6-5 86-70 177-143zm-233 108c21-20 33-78 16-78-19 0-53 46-53 72 0 34 6 35 37 6zm863-79c50-40 90-75 90-79s-11-12-24-20c-27-14-38-7-164 98-51 43-52 45-36 64 10 10 24 16 31 14 8-3 54-38 103-77zm-7e2-52c58-45 168-134 244-197s148-123 160-133l21-17-23-20-24-20-156 127c-239 193-282 232-282 256 0 17-2 19-10 7-7-12-12-12-29 4-20 18-30 76-13 76 4 0 54-37 112-83zm626-3c52-41 94-79 94-83 0-5-10-16-23-24-23-15-28-12-131 67-60 46-108 87-108 92 1 9 33 21 61 23 7 1 55-33 107-75zm-784 29c18-16 26-93 10-93-22 0-52 43-52 75 0 38 13 44 42 18zm1109-25c37-29 39-35 39-85 0-29-3-53-6-53-10 0-144 110-144 118s52 51 63 52c5 0 26-14 48-32zm-1021-90c0-42-9-47-34-19-15 17-17 45-7 90 1 2 10-4 21-14 13-12 20-31 20-57zm969-15c42-31 79-61 83-67 11-15 10-76-1-76-9 0-83 56-164 124-44 38-46 41-30 58 9 10 21 18 26 18 6 0 44-26 86-57zm-1047-4c11-15 18-37 16-52l-3-27-32 31c-21 18-33 40-33 55 0 33 25 29 52-7zm140 4c22-23 25-34 20-61l-7-34-28 22c-21 17-27 30-27 61 0 46 7 48 42 12zm839-61c154-118 161-125 157-161l-3-33-143 107c-137 103-142 108-126 126 9 11 22 19 29 19 6 0 45-26 86-58zm-913 6c7-7 12-28 12-47 0-33 0-34-20-16-11 10-20 31-20 47 0 30 9 35 28 16zm278-113c85-69 154-130 154-135 0-6 6-10 13-10s53-32 102-72c50-39 159-125 243-190s149-118 144-118-59 20-118 45c-103 43-123 57-359 246-325 259-345 278-345 324 0 19 3 35 6 35s75-56 160-125zm534 73c0-4-12-15-26-24-24-16-26-16-47 4-20 21-20 22-3 41 18 20 20 20 47 4 16-10 29-21 29-25zm-882-7c20-19 32-39 32-55 0-32-7-32-43 0-27 23-48 84-30 84 5 0 23-13 41-29zm140-14c21-23 41-87 27-87-4 0-20 9-36 21-22 16-29 28-29 55 0 40 9 42 38 11zm891-82 110-80 1-43c0-24-4-42-9-40-20 7-270 204-271 212 0 18 33 46 46 38 7-4 62-43 123-87zm-236 71c24-18 21-34-8-48-22-10-29-9-48 10-21 21-21 22-2 37 25 18 35 18 58 1zm-726-34c15-9 30-72 18-72-18 0-45 34-45 57 0 24 7 28 27 15zm943-131c116-90 125-99 128-134 2-20 1-37-3-37s-281 205-334 248c-14 12-14 15 9 32 30 23 29 24 2e2-109zm-927 20c48-40 86-75 84-78-20-20-227 143-212 167 8 13 4 15 128-89zm346-83c124-1e2 228-183 230-185s2-5-1-8c-2-3-39 9-80 26-60 25-108 59-237 165-130 108-161 139-161 159 0 14 5 25 11 25s113-82 238-182zm295 163c34-38-2-54-44-21-21 17-23 21-10 30 22 14 35 12 54-9zm-445-146c66-55 116-101 112-103-22-8-132 56-207 119-70 60-84 76-84 101v29l29-23c16-13 83-68 150-123zm391 1e2c20-21 21-25 7-30-8-4-27 1-41 11-21 13-24 19-15 30 16 19 22 18 49-11zm148-22c48-32 52-38 38-51-13-13-19-14-38-3-48 26-81 59-75 75 9 22 15 21 75-21zm-822-20c-8-9-46 18-40 28 4 6 13 4 25-7 11-9 17-19 15-21zm623 3c14-15 19-26 12-31-6-3-11-10-11-16 0-5 9-4 19 3 16 10 26 7 65-23 48-36 54-47 34-68-11-11-9-11 10-2 27 14 11 24 219-128 171-124 173-126 173-163 0-21-4-38-9-38-17 0-521 388-521 402 0 4-6 8-13 8-8 0-23 11-36 24l-22 23 23 16c30 21 31 21 57-7zm148-32c42-35 48-54 16-54-21 0-105 69-98 81 11 18 38 9 82-27zm248-92c97-71 121-92 123-115 2-15 0-27-4-27s-57 36-118 80c-171 124-162 116-147 134 7 9 16 16 20 15 3 0 60-40 126-87zm-104-15c41-29 109-77 152-105 67-46 77-56 77-82 0-17-4-30-9-30-7 0-98 67-261 193-36 28-67 52-69 53-7 5 11 24 23 24 7 0 46-24 87-53z");
    			add_location(path0, file$6, 10, 9, 266);
    			attr_dev(path1, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path1, "d", "M3361 9134c-2-128 31-1080 37-1086 9-9-3 911-13 1017-10 101-23 140-24 69z");
    			add_location(path1, file$6, 12, 10, 41535);
    			attr_dev(path2, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path2, "d", "M3880 9160c0-4 26-10 58-14 31-3 91-10 132-15 379-47 845-96 825-86-23 10-605 82-845 105-69 6-135 12-147 14-13 2-23 0-23-4z");
    			add_location(path2, file$6, 14, 10, 41659);
    			attr_dev(path3, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path3, "d", "M4590 9021c25-5 79-11 120-14 55-4 63-4 30 2-25 5-79 11-120 14-55 4-63 4-30-2z");
    			add_location(path3, file$6, 16, 10, 41832);
    			attr_dev(path4, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path4, "d", "M3415 8841c4-65 11-134 15-152l8-34 1 40c2 86-13 265-22 265-6 0-7-45-2-119z");
    			add_location(path4, file$6, 18, 10, 41961);
    			attr_dev(path5, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path5, "d", "M5197 8557c-7-253 2-698 15-691 11 7 11 904 0 904-5 0-12-96-15-213z");
    			add_location(path5, file$6, 20, 10, 42087);
    			attr_dev(path6, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path6, "d", "M4299 8421c8-5 51-12 95-16 45-3 99-8 121-12 22-3 37-2 33 2-7 8-187 35-233 35-22 0-26-3-16-9z");
    			add_location(path6, file$6, 22, 10, 42205);
    			attr_dev(path7, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path7, "d", "M3811 8386c10-10 773-87 844-85 56 1 10 8-217 34-373 41-639 63-627 51z");
    			add_location(path7, file$6, 24, 10, 42349);
    			attr_dev(path8, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path8, "d", "M4703 8293c9-2 25-2 35 0 9 3 1 5-18 5s-27-2-17-5z");
    			add_location(path8, file$6, 26, 10, 42470);
    			attr_dev(path9, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path9, "d", "M5142 8130c0-41 3-95 7-120 8-43 9-41 9 25 0 39-3 93-8 120-7 49-7 48-8-25z");
    			add_location(path9, file$6, 26, 91, 42551);
    			attr_dev(path10, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path10, "d", "M5814 8867c-21-19-26-31-26-66 1-56 31-91 79-91 78 0 111 93 54 151-36 35-70 37-107 6zm96-48c0-6-4-7-10-4-5 3-10 11-10 16 0 6 5 7 10 4 6-3 10-11 10-16zm-30-63c0-16-17-2-32 25-27 46-21 59 7 17 14-20 25-39 25-42z");
    			add_location(path10, file$6, 28, 10, 42676);
    			attr_dev(path11, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path11, "d", "M6615 8780c-28-31-25-108 4-132 28-22 40-23 68-3 24 17 39 71 28 104-16 51-67 67-1e2 31z");
    			add_location(path11, file$6, 30, 10, 42936);
    			attr_dev(path12, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path12, "d", "M6250 8757c-115-33-210-130-210-217 0-39 13-38 31 2 8 17 20 34 27 36 21 6 13-39-10-60l-23-19 28 4c20 3 31-1 37-14 16-28 12-50-10-56-11-3-20-11-20-18 0-19 63-71 120-1e2 54-28 87-33 56-10-19 15-19 15 3 15 13 0 30 8 37 18 11 14 15 15 23 3 5-8 19-12 35-9 32 6 32 5 1-28-23-25-29-26-85-21-75 6-132 39-194 109-54 62-62 44-13-28 66-99 181-138 282-94 66 28 81 43 118 115 25 50 31 75 35 145 3 75 1 90-20 130-45 83-151 124-248 97zm136-46c23-10 54-36 70-57 25-32 29-46 29-1e2.0-48-5-69-21-91-53-70-146-87-226-40-87 51-112 175-50 248 49 59 123 74 198 40zm-198-301c25-21 22-40-7-40-24 0-45 25-37 45 7 20 16 19 44-5zm102-61c0-5-7-9-16-9-23 0-55 20-49 30 7 11 65-8 65-21zm145 21c-3-5-11-10-16-10-6 0-7 5-4 10 3 6 11 10 16 10 6 0 7-4 4-10z");
    			add_location(path12, file$6, 32, 10, 43074);
    			attr_dev(path13, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path13, "d", "M6221 8675c-22-26-31-46-31-71 0-21 4-33 10-29 6 3 10 14 10 24 0 9 7 26 15 37 15 19 15 19 8-1-6-20-6-20 16 0 12 11 18 21 12 23-18 6-13 20 9 27 25 8 26 25 1 25-10 0-33-16-50-35z");
    			add_location(path13, file$6, 34, 10, 43848);
    			attr_dev(path14, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path14, "d", "M6434 8605c10-38-11-101-41-124-28-23-76-27-117-11-21 7-26 6-26-5 0-25 78-40 125-24 53 19 90 87 80 149-4 22-11 40-17 40s-8-11-4-25z");
    			add_location(path14, file$6, 36, 10, 44075);
    			attr_dev(path15, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path15, "d", "M6396 8593c-3-3-6-15-6-25 0-11-7-32-15-48-9-17-12-30-8-30 12 0 53 64 53 83 0 18-14 30-24 20z");
    			add_location(path15, file$6, 38, 10, 44257);
    			attr_dev(path16, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path16, "d", "M7023 8714c-10-4-13-82-13-339 0-309 1-334 18-339 9-2 71-7 137-11 66-3 286-15 489-26 202-11 375-18 383-15 12 5 14 53 11 315-2 170-6 312-10 316s-204 27-445 51c-539 53-555 54-570 48zm2e2-50c26-5 27-8 27-61v-56l-91 8c-107 8-122 12-115 32 3 8 6 33 6 55v40l73-7c39-3 84-8 1e2-11zm456-44c173-17 318-33 322-36 5-3 9-131 9-285v-279h-39c-52 0-539 28-618 36l-63 6v93 93l63 25c34 14 167 67 295 118 208 82 266 109 233 109-21 0-237-83-408-156-95-41-175-74-178-74s-5 35-3 78l3 77 130 38c72 21 177 54 235 72 166 54 47 33-147-26-93-28-180-55-195-59l-28-9v103c0 56 2 105 5 107 2 3 19 4 37 2s174-17 347-33zm-501-105 72-7v-43-42l-58-17c-40-11-71-13-102-8l-45 8-2 49c-2 69 2 78 34 71 16-3 61-8 101-11zm72-120c0-10-10-15-30-15-49 0-34 24 18 29 6 0 12-6 12-14zm-14-52c23-9 18-90-5-103-22-11-77-13-145-4l-46 7v60 60l91-8c51-4 98-9 105-12zm-8-160c20-5 22-11 22-64v-59h-44c-23 0-71 3-105 6l-61 7v65 65l83-7c45-4 92-10 105-13z");
    			add_location(path16, file$6, 40, 10, 44401);
    			attr_dev(path17, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path17, "d", "M7615 8331c-146-53-325-130-303-131 14 0 382 140 392 150 16 16-3 12-89-19z");
    			add_location(path17, file$6, 42, 10, 45352);
    			attr_dev(path18, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path18, "d", "M7610 8230c-95-32-161-59-144-60 16 0 264 80 264 85 0 11-39 2-120-25z");
    			add_location(path18, file$6, 44, 10, 45477);
    			attr_dev(path19, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path19, "d", "M5843 8570c-38-15-56-55-50-107 6-59 36-88 82-79 48 10 68 42 63 104-6 71-43 103-95 82zm53-47c7-10 13-25 13-33 1-10-6-6-19 10-11 14-20 28-20 33 0 12 12 8 26-10zm-18-99c-4-3-12 5-18 18-12 22-12 22 6 6 10-10 15-20 12-24z");
    			add_location(path19, file$6, 46, 10, 45597);
    			attr_dev(path20, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path20, "d", "M8466 8528c-7-48-27-684-25-808 2-98 3-92 15 85 15 223 30 755 21 755-3 0-8-15-11-32z");
    			add_location(path20, file$6, 48, 10, 45865);
    			attr_dev(path21, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path21, "d", "M8081 8343c-1-129 3-203 9-203 12 0 12 342 0 380-5 14-8-60-9-177z");
    			add_location(path21, file$6, 50, 10, 46000);
    			attr_dev(path22, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path22, "d", "M5358 8510c-11-42-17-356-10-5e2 7-132 8-130 16 150 8 293 6 397-6 350z");
    			add_location(path22, file$6, 52, 10, 46116);
    			attr_dev(path23, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path23, "d", "M6624 8470c-37-15-56-99-33-143 24-44 64-50 97-14 30 32 31 118 2 147-22 22-33 23-66 10zm46-58c0-15-2-15-10-2-13 20-13 33 0 25 6-3 10-14 10-23z");
    			add_location(path23, file$6, 54, 10, 46237);
    			attr_dev(path24, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path24, "d", "M8378 8351c-5-35-7-150-7-255 1-153 3-179 10-131 5 33 8 148 7 255-2 147-5 179-10 131z");
    			add_location(path24, file$6, 56, 10, 46430);
    			attr_dev(path25, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path25, "d", "M5950 8246c0-27 52-76 113-106 132-64 319-54 418 23 19 15 53 66 48 72-2 2-33-16-69-40-82-55-131-69-223-62-91 6-177 39-230 89-44 41-57 46-57 24z");
    			add_location(path25, file$6, 58, 10, 46566);
    			attr_dev(path26, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path26, "d", "M6510 8125c-9-11-10-19-2-27 12-12 28-4 42 23 9 16 7 19-8 19-11 0-25-7-32-15z");
    			add_location(path26, file$6, 60, 10, 46760);
    			attr_dev(path27, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path27, "d", "M5912 8083c3-19 48-32 48-14 0 10-31 31-45 31-4 0-5-8-3-17z");
    			add_location(path27, file$6, 62, 10, 46888);
    			attr_dev(path28, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path28, "d", "M6402 8039c-27-11-24-36 4-31 22 4 44 21 44 33 0 11-18 11-48-2z");
    			add_location(path28, file$6, 64, 10, 46998);
    			attr_dev(path29, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path29, "d", "M6046 8031c-9-15 22-33 44-26 26 8 26 21-2 29-31 8-36 7-42-3z");
    			add_location(path29, file$6, 66, 10, 47112);
    			attr_dev(path30, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path30, "d", "M6955 8010c-3-5-1-11 4-14 11-7 452-38 458-33 6 6-55 14-242 32-88 8-172 17-187 20-15 2-30 0-33-5z");
    			add_location(path30, file$6, 68, 10, 47224);
    			attr_dev(path31, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path31, "d", "M6231 7991c-16-10-6-31 14-31 8 0 26 5 42 11 26 10 27 12 8 19-27 11-47 12-64 1z");
    			add_location(path31, file$6, 70, 10, 47372);
    			attr_dev(path32, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path32, "d", "M5596 7791c-10-16 76-21 419-25l340-5-320 19c-373 22-432 23-439 11z");
    			add_location(path32, file$6, 72, 10, 47502);
    			attr_dev(path33, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path33, "d", "M6566 7720c11-4 171-15 355-24s491-25 684-36c346-20 564-25 365-10-421 34-792 61-935 70-206 12-499 12-469 0z");
    			add_location(path33, file$6, 74, 10, 47620);
    			attr_dev(path34, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path34, "d", "M3850 8035c0-49 2-86 5-84 7 7 8 159 1 166-3 3-6-33-6-82z");
    			add_location(path34, file$6, 76, 10, 47778);
    			attr_dev(path35, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path35, "d", "M4736 8043c-3-10-8-52-11-93-4-56-3-69 5-52 11 27 26 162 17 162-3 0-8-8-11-17z");
    			add_location(path35, file$6, 78, 10, 47886);
    			attr_dev(path36, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path36, "d", "M4678 7966c-3-14-2-30 2-36 4-7 9 1 12 19 5 37-8 52-14 17z");
    			add_location(path36, file$6, 80, 10, 48015);
    			attr_dev(path37, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path37, "d", "M4470 7878c0-5 18-8 40-8s40 2 40 4-18 6-40 8-40 0-40-4z");
    			add_location(path37, file$6, 82, 10, 48124);
    			attr_dev(path38, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path38, "d", "M4406 7861c-8-12 72-21 163-20l76 1-55 8c-110 15-179 19-184 11z");
    			add_location(path38, file$6, 84, 10, 48231);
    			attr_dev(path39, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path39, "d", "M39e2 7843c0-13 98-21 395-33 249-10 391-12 384-6-5 5-403 31-631 42-96 4-148 3-148-3z");
    			add_location(path39, file$6, 86, 10, 48345);
    			attr_dev(path40, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path40, "d", "M3446 7638c-24-86-30-1714-6-1821 3-18 10 335 13 783 4 448 10 870 13 938 4 79 3 122-4 122-5 0-12-10-16-22z");
    			add_location(path40, file$6, 88, 10, 48481);
    			attr_dev(path41, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path41, "d", "M8375 6890c3-278 6-622 7-765l1-260 9 275c9 305 1 1140-13 1210-5 26-6-170-4-460z");
    			add_location(path41, file$6, 90, 10, 48638);
    			attr_dev(path42, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path42, "d", "M5845 7315c-284-31-534-109-781-243-163-89-231-137-397-280-343-296-607-762-696-1224-26-136-29-163-37-368-14-373 60-725 221-1055 185-380 421-646 790-892 95-63 336-176 465-217 268-87 442-111 720-103 330 10 593 77 882 224 595 302 1028 894 1149 1569 40 228 42 544 3 773-168 994-958 1740-1930 1821-149 12-237 11-389-5zm2e2-60 40-34-40-1c-22 0-56-3-75-6-29-4-41 0-74 27-35 29-37 34-20 40 10 4 44 8 74 8 49 1 60-3 95-34zm232-5 42-35-42-3c-75-6-143 8-181 36-19 15-35 31-36 35 0 5 39 7 88 5 83-3 90-5 129-38zm-429-2c23-18 42-35 42-39 0-3-27-11-59-16-59-9-59-9-102 26l-43 36 49 12c70 16 67 16 113-19zm597 7c43-8 90-22 105-32 37-24 141-115 137-120-2-2-62 11-133 28-119 29-134 35-191 81-35 27-63 52-63 54 0 9 71 3 145-11zm-775-12c0-5 16-19 35-32s33-27 30-31-25-11-50-14c-41-7-48-4-86 26l-41 33 38 12c46 14 74 16 74 6zm-106-55 39-32-29-13c-44-19-60-16-1e2 19l-37 33 39 12c21 6 41 12 44 12 3 1 23-13 44-31zm1157-7c110-37 226-89 264-117 26-19 294-259 320-286 6-6-33 18-85 54-119 82-210 133-341 193-92 41-208 121-249 170-17 21-5 19 91-14zm-611 9c0-6-28-10-67-9-53 1-61 3-38 9 45 11 105 11 105 0zm246-3c14-14-4-16-91-10-60 4-83 9-70 14 23 10 151 7 161-4zm-914-33c21-15 38-30 38-34 0-9-79-40-1e2-40-15 1-85 58-78 65s74 33 87 34c8 1 32-11 53-25zm471 19c-7-2-19-2-25 0-7 3-2 5 12 5s19-2 13-5zm-56-9c-3-3-12-4-19-1-8 3-5 6 6 6 11 1 17-2 13-5zm-92-13c-14-12-103-25-90-12 10 9 41 17 80 20 11 0 15-3 10-8zm650-26c844-147 1494-842 1610-1723 19-145 19-399 0-545-64-490-310-953-675-1274-476-419-1141-572-1738-398-610 177-1098 657-1306 1285-45 135-86 311-86 368 0 29 3 31 45 38 25 3 47 5 49 3 1-2 12-65 24-139 25-150 61-314 69-306 3 2-2 37-11 76-26 111-57 363-47 373 5 5 21 7 37 5 27-3 30-7 39-65 6-34 14-65 19-70 5-4 6 1 3 12s-9 44-12 72c-6 44-4 54 9 59 9 4 19 5 21 3s10-53 18-114l15-110-1 115c-2 109-1 115 18 115 16 0 21-10 28-50 44-264 89-466 103-453 2 2-1 20-6 39-18 62-59 302-75 439-21 172-20 411 1 521 12 69 44 199 70 292 3 9 1 17-5 17-10 0-31-57-55-150-30-114-47-229-53-347-5-111-8-123-25-123-16 0-18 9-18 81 0 98-15 97-23-2-3-39-7-73-9-74-2-2-24-6-50-10-46-7-48-6-49 16v24l-11-22c-6-13-14-23-17-23s-4-22-3-49c4-49 3-50-30-60-30-8-31-9-7-10 29-1 40-18 32-49-3-14-16-21-50-26-26-3-49-3-52 0s-6 119-6 257c0 276 9 349 66 550 174 619 631 1120 1223 1341 157 59 274 86 476 110 71 9 358-4 445-19zm-1107-26c19-17 32-32 30-34-8-8-82-35-96-35-8 0-31 12-51 27l-35 27 49 22c28 13 55 23 60 23 6 0 25-13 43-30zm307 16c-34-16-84-20-69-6 9 10 44 18 79 19 15 0 12-3-10-13zm-95-24c0-10-78-41-105-41-25 0-11 12 38 32 48 19 67 22 67 9zm-341-51 34-29-45-22-45-22-32 24c-17 12-31 26-31 30 0 9 62 49 75 48 6 0 25-13 44-29zm196 1c7-13-84-53-98-44-8 5 52 40 90 52 1 1 4-3 8-8zm-308-65c15-13 26-26 23-28s-19-13-37-26c-40-27-53-28-87-1-34 26-33 33 7 57 43 27 61 27 94-2zm181 3c-2-6-20-21-40-33-28-16-40-18-49-9s-2 16 27 32c44 23 68 27 62 10zm2055-110c56-42 147-121 202-175 97-96 222-241 214-248-4-4-333 292-519 466-76 71-80 77-42 57 24-13 89-58 145-1e2zm-2376 50c8-8-1-20-34-46-42-32-47-33-61-19-15 15-15 17 3 30 11 8 29 21 40 30 24 18 37 20 52 5zm210-5c2-6-7-16-19-22-13-6-32-19-44-27-18-13-23-13-32-2s-4 19 26 41c37 26 62 30 69 10zm-163-33c3-5-11-21-31-37-47-36-25-45 27-10 55 36 66 13 14-31-21-18-41-33-44-33s-20 13-38 28l-33 28 43 31c47 35 54 38 62 24zm-154-51c0-14-79-72-90-65-18 11-10 30 26 57 32 24 64 28 64 8zm67-55 28-25-40-34c-29-26-43-32-52-24-7 6-10 14-7 19s-4 9-15 9c-35 0-36 22-2 52 39 34 52 35 88 3zm-179-36c4-21-67-74-81-60-8 8-2 20 23 46 35 36 53 40 58 14zm53-35c11-14 9-20-19-45-36-32-54-36-71-15-9 11-4 20 24 45 41 36 48 37 66 15zm45-35c3-6-10-27-30-47-28-29-38-34-48-24-9 9-5 20 22 47 36 38 45 41 56 24zm-193-16c4-3 0-18-10-32-16-26-16-26 4-8 24 21 37 22 54 1 11-13 7-21-24-51l-36-37-40 29c-23 15-41 30-41 33s14 21 32 39c31 32 48 40 61 26zm3144-287c58-55 109-128 162-234 13-24 20-46 17-49s-32 19-66 48c-39 34-86 92-134 164-59 89-164 227-195 255-3 3-13 14-21 25-16 21 133-110 237-209zm-3043 206c3-5-12-26-33-46-47-46-65-32-26 19 25 34 48 44 59 27zm-170-38 38-26-23-24c-12-13-25-24-29-24-3 0-21 13-40 29-35 29-35 29-16 50 24 26 24 26 70-5zm-65-72c34-28 34-28 16-55-22-33-28-33-71-1l-34 26 21 29c11 16 24 29 28 29s22-13 40-28zm140-14c-13-25-37-34-52-19-16 16 31 65 49 50 10-8 11-16 3-31zm-190-76c20-16 22-22 12-40-15-28-25-28-66 4-33 25-34 27-19 50 17 25 25 24 73-14zm136 28c3-6-3-24-15-40-18-25-25-28-36-19-18 15-18 28 3 51 18 20 38 23 48 8zm-171-113c7-10 4-23-7-41-22-32-25-32-67 2l-33 28 18 32 19 31 30-19c17-10 35-26 40-33zm106 33c12-7 12-12 0-35-15-27-28-28-44-3-7 12-6 21 3 32 15 18 21 19 41 6zm-56-66c21-8 20-37-1-63-16-19-20-20-37-8-19 14-19 15 0 45 10 18 19 32 20 32s9-3 18-6zm-94-68c0-7-6-20-13-30-12-16-15-15-55 14-26 19-40 35-36 43 21 36 25 36 65 10 21-14 39-31 39-37zm-78-42c21-15 38-29 38-32 0-13-25-72-30-72-3 0-25 14-48 31l-41 30 16 35c9 18 19 34 22 34s22-12 43-26zm128 11c10-12 10-21 2-40-10-22-14-24-32-13-23 15-24 21-8 48 15 24 22 25 38 5zm3552-127c23-20 85-154 76-164-2-2-25 14-52 35-38 30-57 56-87 121-22 45-39 85-39 87 0 4 29-18 102-79zm-3592 47c11-13 10-22-4-51-14-30-19-34-31-24-18 15-19 31-3 65 13 29 21 31 38 10zm-132-35 41-29-16-41c-9-22-21-40-27-40s-28 15-49 33l-39 32 18 38c10 20 21 37 24 37 4 0 25-13 48-30zm86-66c14-14 14-19 1-52-19-44-19-44-39-36s-21 36-1 74c18 35 19 35 39 14zm-121-56 28-23-18-47c-9-27-20-48-23-48s-24 17-47 38l-42 37 19 43c21 47 26 47 83 0zm84-86c-3-15-10-39-16-55-10-24-13-26-31-15-24 15-25 26-4 78 14 35 18 38 36 29 15-8 19-18 15-37zm3736 4c29-23 42-44 57-94 11-36 19-66 17-68-1-2-23 13-47 32-43 34-52 50-85 153-8 27-2 25 58-23zm-3843-75c0-23-20-91-26-91-5 0-94 61-94 65 0 1 7 25 15 53l16 53 44-32c25-18 45-40 45-48zm70-44c0-22-23-97-30-97-5 0-16 7-25 16-17 17-16 35 5 89 9 22 12 24 30 13 11-7 20-16 20-21zm-142-48c43-32 46-38 36-76-8-30-19-29-65 8-38 30-46 50-33 83 8 22 14 21 62-15zm3976-23c21-19 32-41 41-88 8-35 12-65 9-67-2-2-21 8-42 23-33 23-41 35-51 84-7 31-15 65-18 75-4 16-2 17 14 8 10-5 31-21 47-35zm-3879-52c9-9 14-23 11-31s-6-21-6-29c0-18-24-18-40 1-13 15-5 75 10 75 5 0 16-7 25-16zm-141-15c23-18 26-26 20-57-11-60-16-64-48-39-26 21-27 26-21 70 4 26 11 47 15 47s19-9 34-21zm58-85c-7-67-21-75-22-11 0 43 3 57 13 54 7-2 11-18 9-43zm62-2c11-13 14-29 10-53-10-60-11-61-34-47-20 13-26 50-14 96 8 27 16 28 38 4zm3932-30c24-21 33-38 37-74 4-27 3-48-2-48-22 0-81 68-81 93 0 14-3 32-6 41-9 25 17 19 52-12zm-4055-84c-1-29-4-54-6-56s-17 4-34 13c-33 16-38 38-25 104l7 31 31-20c29-18 31-22 27-72zm49-33c0-30 5-55 10-55 10 0 14 18 10 58-2 25 3 27 31 12 15-8 19-21 19-58 0-71-9-78-58-42-44 31-48 46-36 109 10 50 24 36 24-24zm4017-24c25-21 34-38 39-74 4-26 3-47-2-47-5 1-23 13-41 28-23 20-33 39-38 75-4 26-3 47 1 47 5-1 24-13 41-29zm-4101-18c20-17 34-37 34-50 0-29 18-39 22-13 3 20 5 19 46-12 40-31 42-35 42-86 0-33-4-51-10-47-5 3-10 16-10 28s-5 29-10 37c-8 12-10 11-10-7 0-12-4-24-10-28-11-7-50 30-50 48 0 9-2 9-8 0-11-18-95 44-88 64 3 8 6 32 6 54 0 21 2 39 6 39 3 0 21-12 40-27zm4113-119c27-22 31-32 31-75 0-27-4-49-9-49s-23 12-40 26c-27 22-31 32-31 75 0 27 4 49 9 49s23-12 40-26zm-4109-32c19-16 50-37 68-47 31-18 32-22 32-80l-1-60-24 28c-13 15-29 27-35 27s-31 14-56 30c-42 30-44 33-44 80 0 59 10 62 60 22zm436-108c9-34-1-41-63-50-57-7-62-2-47 54 6 19 13 22 55 22 44 0 49-3 55-26zm66 1c3-14 2-25-3-25-4 0-14-3-23-6-13-5-16 1-16 25 0 40 35 45 42 6zm3603-4c27-24 30-34 27-70-5-47-9-49-46-20-22 17-26 28-26 70 0 27 3 49 8 49 4 0 21-13 37-29zm-3962 2c8-30 7-93-2-93-5 0-11 17-15 38-8 52-7 72 3 72 5 0 12-8 14-17zm-141-36c32-27 39-40 44-86l7-54-32 19c-55 32-71 53-71 89 0 18-3 40-6 49-10 26 18 18 58-17zm508-42c0-31-3-35-25-35-19 0-25 5-25 23 0 25 17 47 37 47 8 0 13-13 13-35zm-70-15c0-20-5-30-15-30s-15 10-15 30 5 30 15 30 15-10 15-30zm-50-10c0-25-4-30-25-30-14 0-28 0-32-1-11 0-16 29-9 47 3 8 19 14 36 14 27 0 30-3 30-30zm-292-7c5-10 12-40 16-66 4-36 3-48-7-45-19 7-37 49-37 91 0 39 13 49 28 20zm4022-77c0-23-5-48-10-56-8-12-14-10-40 15s-29 34-24 64c10 63 11 64 44 40 25-19 30-30 30-63zm-3961-26c0-34-3-40-9-25-5 11-9 40-9 65 0 34 3 40 9 25 5-11 9-40 9-65zm-138 27c28-22 49-71 49-114 0-29-2-29-53 8-42 30-53 54-56 113-1 32 12 31 60-7zm107-102c7-22 12-50 10-62-5-39-29-10-43 51-12 52-12 57 3 54 10-2 23-21 30-43zm3962 10c11-14 8-1e2-4-113-3-2-19 7-36 20-30 21-31 26-25 68 4 25 9 48 12 53 5 9 35-6 53-28zm-3902-80c6-27 9-51 7-53-7-7-23 34-30 78-10 61 10 41 23-25zm-152 23c44-31 53-48 70-137 8-37 11-38-59 9-37 25-44 40-62 128-4 17-4 32 0 32s27-14 51-32zm4016-71c27-21 27-24 16-67-6-25-14-49-18-53-10-11-60 31-60 51 0 26 20 92 28 92 4 0 19-10 34-23zm-3898-19c16-27 39-118 32-126-19-18-66 82-66 139 0 17 19 9 34-13zm70-83c9-30 19-61 22-70 3-8 2-15-4-15-5 0-13 10-16 23-3 12-12 43-20 70-8 26-11 47-6 47s16-25 24-55zm-144-9c37-27 49-43 63-90 10-32 17-59 15-61s-26 12-54 30c-41 26-52 40-63 76-7 24-15 52-17 62-8 25 5 21 56-17zm3935-28c23-21 24-26 13-60-6-21-14-38-17-38s-18 10-34 23c-25 20-26 25-17 60 13 43 20 45 55 15zm-3823-50c15-11 58-109 58-131 0-13-39 13-50 34-17 31-39 109-31 109 4 0 15-6 23-12zm3787-59c24-20 24-22 10-61-17-49-26-54-58-29-23 18-24 20-11 65 14 51 23 55 59 25zm-3686-55c15-38 21-64 14-61-14 4-60 127-48 127 4 0 19-30 34-66zm-164 24c42-28 53-43 84-115 19-46 33-83 29-83-22 0-107 69-119 97-34 83-52 133-48 133 3 0 27-14 54-32zm181-174c18-41 30-77 27-80-14-15-50 28-77 93-36 87-37 98-6 78 13-9 38-48 56-91zm3617 84c26-25 28-37 10-62-13-18-15-18-40-1-29 19-33 35-17 66 13 24 18 24 47-3zm-3542-134c44-81 51-105 25-89-14 8-80 143-80 162 0 24 8 13 55-73zm3515 31c11-13 11-20-1-42-19-35-37-40-62-15-20 21-20 23-4 57 14 30 20 34 35 26 10-5 25-17 32-26zm-3640-55c26-23 109-160 96-160-8 0-80 42-99 59-21 18-87 132-87 150 0 14 47-11 90-49zm36e2-60c0-4-9-18-19-31-16-19-23-22-37-13-33 20-39 40-20 68l17 27 29-21c17-12 30-25 30-30zm-3445-80c25-42 45-80 45-83s-16 3-35 15c-33 19-68 72-95 143-9 23-8 24 15 13 15-6 44-44 70-88zm3360 24c30-19 32-43 6-75l-18-22-31 22-31 22 21 34c23 41 21 40 53 19zm-3240-102c35-48 62-88 60-90s-18 4-35 15c-27 16-80 87-119 161-12 22-11 23 9 12 12-6 50-50 85-98zm-192 31c25-14 52-38 60-52 9-14 17-20 17-13 0 27 82-33 121-88 21-30 49-68 61-85l23-30-25 16c-14 9-63 40-110 69-106 66-114 72-161 142-54 79-53 82 14 41zm3375-29c27-18 28-36 4-57-16-15-20-15-46 6s-27 25-15 45c16 26 27 27 57 6zm-51-78c27-24 28-24 9-45-24-26-34-26-62 0-21 20-22 23-7 45 19 30 25 30 60 0zm-2919-174c74-72 114-107 258-220l29-23-40 23c-22 12-97 59-168 104-107 68-137 93-187 155-33 41-60 78-60 82 0 20 90-45 168-121zm2882 80c-1-11-37-52-47-52-11 1-53 36-53 46 0 4 10 18 21 31l22 22 28-20c16-11 29-23 29-27zm-3067-59c72-47 149-111 247-205 79-76 138-138 132-138s-62 30-124 67c-96 57-132 87-240 196-113 114-140 147-123 147 2 0 51-30 108-67zm2975 8c27-24 27-29 0-58-26-28-36-28-65-4-29 25-29 30 5 58 33 27 32 27 60 4zm-81-82 34-21-27-29c-15-16-30-29-33-29-3 1-19 12-36 25l-29 24 24 26c13 14 26 25 28 25 3 0 20-10 39-21zm-64-83c18-14 17-16-15-45-18-17-35-31-38-31s-18 11-35 25l-30 25 33 30c34 32 40 31 85-4zm-2425-99c90-56 142-95 142-105 0-12 32-31 98-62 53-25 130-67 171-95 41-27 99-63 128-79 29-15 53-32 53-37 0-13-6-12-122 25-97 31-165 63-258 121-19 12-79 48-132 79-54 32-96 62-93 66 3 5-31 47-75 93-75 80-96 108-67 91 6-4 76-48 155-97zm2312 31c17-12 30-25 30-28s-14-16-31-29l-30-23-35 24c-18 13-34 26-34 30 0 5 59 47 68 48 2 0 16-10 32-22zm-90-70c17-12 30-24 30-28 0-3-13-13-28-22-27-16-30-16-60 5-36 25-39 35-14 53 24 19 38 17 72-8zm-93-50c41-28 42-42 4-58-27-11-33-9-66 15l-36 28 28 18c36 22 31 23 70-3zm-1737-88c41-17 95-38 120-47 82-29 64-32-31-6-52 14-112 34-134 46-49 25-165 97-165 103 0 3 30-11 68-30 37-19 101-49 142-66zm1647 34c18-14 33-28 33-32 0-11-55-42-74-42s-76 39-76 52c0 6 66 46 79 48 2 0 19-11 38-26zm-113-64 38-29-35-17c-36-17-37-17-77 11-22 15-40 29-40 31 0 5 54 33 65 33 6 0 27-13 49-29zm-113-37c21-16 39-32 39-36 0-10-63-37-86-37-9 0-34 14-57 32l-40 32 49 17c27 10 51 18 52 18 2 1 21-11 43-26zm-1102-80 26-17-30-6c-26-5-23-7 22-12 63-6 156-60 115-66-48-7-163 18-204 46l-42 27 40 5c39 5 38 5-26 18-59 12-141 50-154 71-9 13 225-47 253-66zm972 26c43-34 43-44 2-52-21-4-40 3-75 26-54 36-58 44-25 50 47 9 60 6 98-24zm-906 1c13-5 14-9 5-9-8 0-24 4-35 9-13 5-14 9-5 9 8 0 24-4 35-9zm794-30c46-34 46-45 1-55-23-5-39 0-77 26-26 18-50 34-53 36-9 8 26 23 56 23 19 0 47-12 73-30zm-128-26c27-20 47-39 44-44-2-4-23-10-46-13-44-6-57 0-128 52-34 26-34 26-10 32 56 16 91 9 140-27zm-590 15c53-8 87-21 135-51 35-22 64-45 64-50 0-7-21-8-57-3-54 6-142 48-208 99-24 19-22 19 66 5zm203 1c43-16 152-1e2 131-1e2-11 0-29-3-40-6-13-3-44 10-90 41-70 46-70 46-32 43 50-5 47 7-5 19-34 8-37 11-16 12 15 0 38-3 52-9zm170 1c13-6 48-27 77-48l53-38-49-7c-48-7-53-5-117 37-38 25-68 50-68 55 0 13 71 13 104 1z");
    			add_location(path42, file$6, 92, 10, 48769);
    			attr_dev(path43, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path43, "d", "M59e2 6791c-25-4 74-10 220-13 285-7 339-14 505-69 193-64 434-202 583-333 35-31 65-56 68-56 14 0-23 45-77 94-88 80-211 158-361 231-250 122-406 156-708 153-102 0-205-4-230-7z");
    			add_location(path43, file$6, 94, 10, 61229);
    			attr_dev(path44, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path44, "d", "M6301 6735c3-2 57-18 119-34 128-33 308-1e2 418-155 277-140 517-369 691-663 46-78 71-97 46-35-40 94-162 264-285 396-67 71-2e2 180-290 238-181 115-401 202-613 243-86 16-93 17-86 10z");
    			add_location(path44, file$6, 96, 10, 61453);
    			attr_dev(path45, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path45, "d", "M5905 6639c-238-37-468-131-674-277-109-77-287-258-368-374-272-393-345-896-193-1349 113-340 338-623 598-753 29-15 58-24 64-20 7 5 8 2 3-6-6-10-4-12 9-7 9 4 15 3 12-2s8-14 26-20c40-14 41-14 34 4-3 8-2 15 3 15 13 0 52-46 44-53-3-4 1-7 10-7 8 0 24-3 34-6 15-6 16-4 6 7-21 22-15 29 17 17 17-5 35-19 41-29 9-18 7-19-18-14l-28 6 25-15c14-8 38-15 54-16 24 0 27 2 16 15-7 9-11 17-8 20 8 9 78-19 95-38 18-19 17-19-27-13-45 6-45 6-15-9 31-15 95-20 95-8 0 4-12 19-27 35-14 15-24 30-21 33 12 12 76-24 98-55l23-33-26 5c-14 3-24 2-22-3 6-9 84-23 91-16 3 3-11 24-31 46-37 40-37 41-13 41 17 0 41-17 76-54 55-58 58-59 237-90 50-8 224 14 345 45 271 70 511 208 716 414 261 262 419 614 439 980 23 403-111 793-377 1095-210 240-484 399-810 471-106 24-447 35-553 18zm244-40c379-35 718-208 950-484 158-187 251-369 307-599 74-308 44-612-91-902-185-399-551-692-994-795-126-30-391-37-536-15-424 66-813 331-1010 690-21 37-35 69-32 73 3 3 18-4 34-15 35-24 93-54 93-48 0 3-32 24-71 47-54 31-74 49-85 76-8 19-14 39-12 44s84-58 183-142c197-165 269-219 195-147-48 46-160 145-304 267-48 41-91 81-95 90-19 35-57 271-44 271 4 0 59-51 122-112 135-133 128-118-21 43-73 78-108 124-108 139 0 20 12 12 79-53 43-42 82-77 86-77s-32 42-79 93c-55 59-86 1e2-86 115 0 27 1 26 86-41 53-41 64-57 92-125 40-97 133-255 192-324 190-225 502-402 822-466 94-19 99-21 208-101 62-45 114-80 116-78 3 3-37 38-88 78l-92 74 144 6c163 7 271 29 451 89 123 41 278 113 319 150 19 16 11 14-31-9-32-17-90-45-130-61l-72-30-91 69c-50 38-237 192-416 341-674 563-864 714-764 609 36-39 363-312 639-535 517-416 594-480 592-488-8-26-262-82-427-95-162-12-268-2-315 30-19 13-109 83-2e2 154-164 128-406 297-414 289-2-2-2-5 0-7s99-75 214-162c116-87 242-184 280-214 39-30 72-57 74-58 2-2 2-5 0-8-9-9-193 46-279 82-182 78-314 166-442 293-1e2 1e2-157 184-245 362-46 93-67 126-78 122-9-4-40 17-80 52-64 57-76 81-55 114 8 12 12 11 32-6 47-42 51-37 11 12l-42 49 14 70c21 1e2 47 195 55 2e2s36-17 149-112c34-29 65-53 69-53 7 1-32 38-143 137-53 46-67 64-59 73 9 9 46-19 150-112 227-202 444-385 444-375 0 3-114 108-252 234-139 125-270 244-292 264l-39 36 57 109c32 60 61 113 66 117 4 5 59-40 121-98 193-182 279-258 284-253 3 3-32 40-77 83-207 194-307 297-301 311 3 8 9 14 15 14 5 0 68-54 140-120 71-66 135-120 142-120 6 0-52 60-129 134-140 133-140 134-121 155l19 21 38-35c53-48 58-44 13 10-43 53-47 42 65 158 42 42 82 77 90 77 16 0 48-30 320-292 101-98 186-176 189-173s-105 115-241 250l-245 245 29 21c16 11 33 19 38 17s72-61 150-133c195-179 208-177 21 4-149 144-154 151-135 165 43 33 55 30 109-21 28-27 62-58 75-68 47-39 8 11-51 65-32 28-58 58-58 64 0 12 204 115 258 131 18 5 37-7 103-67 114-103 129-106 30-5-70 71-82 87-67 93 13 5 35-11 87-62 38-38 69-65 69-62 0 4-25 35-55 69-31 34-52 66-48 70 7 6 110 29 193 42 48 8 106 7 219-4zm528-84c80-30 1e2-46 46-35-41 8-133 46-133 55 0 10 19 5 87-20zm239-120c30-19 54-37 54-39s-22 2-48 9c-46 12-142 61-142 72 0 16 89-12 136-42zm76-70c25-6 81-55 62-55-31 0-84 24-105 46-22 24-22 26-4 21 11-3 32-9 47-12zm78-105c6-11 9-20 7-20s-12 9-22 20-13 20-7 20 16-9 22-20zm53-15c23-32 17-32-13 0-13 14-19 25-14 25s17-12 27-25zm47-10c13-14 21-25 18-25-2 0-15 11-28 25s-21 25-18 25c2 0 15-11 28-25zm24-76c17-15 28-31 25-33-9-10-72 29-88 53-15 23-15 23 9 16 14-4 38-20 54-36zm88-44c8-14 2-12-21 9-17 17-31 34-31 39 0 14 39-23 52-48zm-5-53c26-33 24-36-13-22-33 13-64 38-64 53 0 18 55-4 77-31zm77-52c-7-7-44 39-44 54 1 6 12-2 25-19 13-16 22-32 19-35zm-16-24c39-13 56-25 68-48 8-16 14-32 12-34s-34 11-70 27c-43 20-70 40-77 56-9 20-9 24 1 21 7-3 37-13 66-22zm57-1e2c35-16 59-34 67-50 6-15 9-28 6-31-10-10-116 44-132 67-32 45-20 48 59 14zm44-102c47-21 62-33 70-57 16-44 14-46-19-34-18 7-33 22-39 39-11 32-22 38-14 8 6-22 3-23-22-14-22 9-59 84-41 84 3 0 32-12 65-26zm13-119c16-34 1-45-23-16-23 28-24 41-4 41 9 0 21-11 27-25zm66-15c32-20 45-60 18-60-19 0-66 46-66 65 0 20 8 19 48-5zm-48-74c10-27 2-40-16-25-16 13-20 64-3 54 6-4 14-17 19-29zm101-47c14-27 5-35-28-23-27 9-56 51-47 66 8 12 62-19 75-43zm-81-51c0-30-25-15-28 17-3 25-2 27 12 16 9-8 16-22 16-33zm98-52 4-29-34 20c-23 13-34 28-36 47l-4 29 34-20c23-13 34-28 36-47zm-88-15c5-11 10-24 10-30 0-17-27-13-34 5-16 41 4 62 24 25zm103-68c7-37 2-40-31-21-34 21-47 41-39 62 6 15 9 15 36 2 18-10 31-26 34-43zm-95-15c18-18 15-51-4-44-9 3-18 6-20 6s-4 11-4 25c0 27 9 32 28 13zm80-37c19-17 32-61 17-61-19 0-63 32-68 49-9 36 15 41 51 12zm-79-35c14-16 4-46-15-46-9 0-14 11-14 30 0 32 11 38 29 16zm71-41c21-11 30-23 30-40 0-30-3-30-41-8-19 11-29 26-29 40 0 27 2 28 40 8zm-72-64c5-30-18-24-29 8-7 18-6 22 9 19 9-2 19-14 20-27zm77-17c24-16 33-48 17-58-12-7-72 32-72 47 0 30 20 34 55 11zm-80-34c4-6 4-18 1-27-5-12-9-13-21-3-8 7-15 19-15 26 0 16 26 19 35 4zm72-37c20-13 27-25 25-40-3-22-22-33-22-13 0 6-6 10-13 10-24 0-51 26-44 44 8 21 20 20 54-1zm-89-55c-3-35-28-52-28-20 0 28 10 52 22 52 5 0 8-14 6-32zm66-41c-14-48-44-47-44 2 0 35 8 43 32 30 14-7 17-16 12-32zm36-14c0-16-4-35-10-43-8-12-10-12-16 3-8 21 3 67 16 67 6 0 10-12 10-27zm-120-32c0-22-16-36-24-22-8 12 3 41 15 41 5 0 9-9 9-19zm60-37c0-14-6-24-14-24-20 0-29 16-21 40 8 26 35 14 35-16zm-77-39c-2-32-10-42-22-29-13 12-1 66 13 61 6-2 10-17 9-32zm117 10c0-25-14-34-24-16-8 12 3 41 15 41 5 0 9-11 9-25zm-56-32c3-8 4-19 0-24-3-5-1-9 5-9 5 0 11 6 14 13 3 9 8 9 16 1 9-8 9-18 1-38l-10-27-33 22c-17 12-34 24-35 25-2 1-1 16 3 33 7 31 28 34 39 4zm-86-55c-4-27-28-36-28-10 0 20 8 32 22 32 5 0 8-10 6-22zm68-29c35-21 40-34 25-58-7-11-15-10-42 9-19 13-35 24-36 25-4 2 9 45 14 45 3 0 21-9 39-21zm-89-35c5-14-24-50-32-42-11 11 4 60 17 56 7-3 13-9 15-14zm91-71c1-10-2-24-7-32-7-11-15-9-42 10-19 13-35 24-37 25-1 1 2 14 8 29l10 27 33-21c17-11 33-28 35-38zm-128-13c0-21-15-27-25-10-7 12 2 30 16 30 5 0 9-9 9-20zm44-19c3-5-1-14-9-21-13-10-15-9-15 9 0 21 14 28 24 12zm-70-20c9-14-4-41-20-41-15 0-17 10-8 34 7 18 20 21 28 7zm126-19c0-4-4-13-8-19-12-20-47 9-39 31 5 14 11 15 27 6 11-6 20-14 20-18zm-90-14c0-19-18-43-25-36-4 3-2 16 5 27 12 24 20 27 20 9zm60-40c0-17-13-38-25-38-24 0-37 27-25 49 9 18 13 19 30 8 11-6 20-15 20-19zm-130-2c0-8-4-17-9-21-12-7-24 12-16 25 9 15 25 12 25-4zm34-31c-6-16-24-21-24-7 0 11 11 22 21 22 5 0 6-7 3-15zm-64-17c0-24-15-37-30-28-11 7-11 11-1 24 16 19 31 21 31 4zm115-3c17-14 17-17 4-30-14-14-17-14-33 4-10 11-15 25-11 30 8 14 16 13 40-4zm-91-39c-3-9-10-16-15-16-6 0-5 9 1 21 13 24 24 20 14-5zm56-11c15-18 6-45-15-45-18 0-30 24-21 45 7 19 20 19 36 0zm-105-15c14-16 16-23 7-32s-16-7-32 7c-23 21-26 45-7 45 8 0 22-9 32-20zm-36-47c20-17 21-19 6-40-19-28-23-28-54-2-23 19-23 20-6 39 22 24 27 25 54 3zm105-6c7-11 7-20 0-27-16-16-47 11-38 33 7 21 23 18 38-6zm-145-93c-15-18-24-18-55 2-23 16-24 18-8 35 16 18 18 18 46-2 23-17 26-24 17-35zm110 43c14-18-19-50-43-41-19 7-19 9-6 35 12 22 33 25 49 6zm-169-67c23-18 24-20 8-36-17-18-38-12-38 11 0 9-6 12-15 9-9-4-15 0-15 8 0 33 24 36 60 8zm108-27c-14-14-20-14-33-3-14 12-14 15 2 32 15 17 18 17 32 3 14-13 14-17-1-32zm-178-13c0-12-28-25-36-17-9 9 6 27 22 27 8 0 14-5 14-10zm138-23c4-20-25-34-40-19s-1 44 19 40c10-2 19-11 21-21zm-98-7c0-4-7-13-15-20-22-18-44 2-26 24 12 14 41 12 41-4zm-104-28c-8-9-19-13-22-9-10 9 16 38 28 31 6-4 4-13-6-22zm143-6c17-20-13-43-34-26-12 10-13 16-4 26 6 8 15 14 19 14s13-6 19-14zm-71-27c54-48 19-70-38-23-24 21-28 29-19 40 16 19 19 18 57-17zm-118 2c0-12-20-25-27-18s6 27 18 27c5 0 9-4 9-9zm70-47c27-24 30-29 17-41-11-11-20-12-33-5-30 16-57 50-49 61 10 18 32 13 65-15zm-120 7c0-6-10-17-22-25-29-21-51-3-22 19 22 16 44 19 44 6zm64-50 28-29-26-18c-26-17-27-16-57 12l-30 29 22 17c28 23 30 23 63-11zm-139 0c7-12-12-24-25-16-11 7-4 25 10 25 5 0 11-4 15-9zm-50-30c8-14-33-34-52-26-14 5-14 7 3 20 22 17 40 19 49 6zm134-48c1-19-23-16-53 8-21 17-24 24-15 35s16 10 40-9c15-12 28-28 28-34zm-212 0c5-14-33-27-48-17-9 5-6 11 7 21 20 14 36 13 41-4zm141-6c17-18 19-26 10-35-19-19-42-14-67 12-22 23-22 25-4 35 27 15 37 13 61-12zm-218-32c-2-14-35-25-50-15-7 4-9 13-5 19 8 14 56 10 55-4zm138-4c28-24 28-38 1-46-28-9-74 32-58 52 15 18 30 16 57-6zm-213-20c10-17-34-34-51-21-7 7-11 16-8 21 7 12 51 11 59 0zm144-25c19-21 20-24 6-30-29-11-52-6-71 15-16 17-16 22-4 29 24 16 45 11 69-14zm-230 1c13-16 5-27-20-27-24 0-35 20-18 31 19 12 25 11 38-4zm-72-23c5-15-28-27-40-15-5 5-6 14-2 21 8 13 37 9 42-6zm211-3c12-11 22-24 22-30 0-18-56-12-74 8-17 18-17 20 1 30 24 14 24 14 51-8zm-287-17c11-14 9-15-21-12-18 2-35 9-38 16-6 18 43 15 59-4zm-92-8c9-10 8-15-4-20-21-7-45 3-45 20 0 18 34 18 49 0zm303-3c22-20 23-29 1-37-18-7-66 31-57 45 8 14 36 10 56-8zm-519-39c26-25 47-47 47-50 0-2-9-4-20-4-20 0-110 75-110 91 0 22 39 5 83-37zm91-4c45-46 48-50 26-50-23 0-110 73-110 92 0 22 41 2 84-42zm46 35c10-12 9-15-8-15-11 0-25 7-32 15-10 12-9 15 8 15 11 0 25-7 32-15zm310-20 23-25h-24c-31 0-64 23-55 38 11 19 31 14 56-13zm-78-12c25-23 23-33-9-33-26 0-63 25-63 42 0 15 53 9 72-9zm-180-20c21-18 23-33 6-33-14 0-48 30-48 42 0 13 22 9 42-9zm93-3c18-20 17-20-11-20-18 0-34 7-42 20-11 18-10 20 11 20 13 0 32-9 42-20z");
    			add_location(path45, file$6, 98, 10, 61684);
    			attr_dev(path46, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path46, "d", "M5970 6321c0-6 52-50 116-98l115-88 51-102c27-56 48-107 46-113s-95 61-208 149-218 167-235 177l-30 17 20-23c11-12 122-104 248-203 256-203 239-180 257-353 15-142-4-362-45-541-17-72-20-107-6-83 12 20 55 193 75 299 17 89 20 286 7 381-5 30-7 58-4 62 2 5 86-54 186-130s238-178 306-227 125-94 127-1e2c10-26-120-309-165-360-10-11-22-27-26-35-8-13-7-13 9 0 30 24 92 122 158 247 34 65 65 120 70 121 4 2 6 7 4 11-3 4 6 41 19 82 42 133 56 226 56 366 0 180-23 303-56 303-18 0-18 5 2-77 12-50 17-111 16-228 0-139-3-172-25-255-14-52-32-109-39-127l-14-32-216 162c-119 89-264 2e2-322 247-99 78-108 88-122 136-8 29-26 76-40 105-13 29-23 55-20 57 2 2 61-37 132-86 246-171 238-157-20 35-97 73-177 137-177 143s-12 16-27 23c-16 6-59 34-98 62-97 70-125 87-125 76z");
    			add_location(path46, file$6, 100, 10, 70505);
    			attr_dev(path47, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path47, "d", "M6159 6316c13-15 233-167 271-186 14-7 21-8 15-3-18 17-242 180-263 192-28 15-37 14-23-3z");
    			add_location(path47, file$6, 102, 10, 71296);
    			attr_dev(path48, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path48, "d", "M6683 6175c34-159 49-240 54-293 3-35 9-58 13-51 8 12 7 30-11 184-13 115-25 159-46 176-15 13-16 11-10-16z");
    			add_location(path48, file$6, 104, 10, 71435);
    			attr_dev(path49, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path49, "d", "M5620 6116c0-11 571-574 6e2-591 8-5-86 96-210 223-242 251-390 390-390 368z");
    			add_location(path49, file$6, 106, 10, 71591);
    			attr_dev(path50, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path50, "d", "M6990 5815c0-66-7-178-15-249s-14-131-12-133c5-5 35 136 47 222 15 108 13 238-5 261-13 17-14 7-15-101z");
    			add_location(path50, file$6, 108, 10, 71717);
    			attr_dev(path51, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path51, "d", "M7307 5253c-8-254-41-362-228-735-1e2-199-123-262-56-151 46 77 217 390 217 398 0 3 9 27 21 52 12 26 32 89 46 142 22 84 26 118 27 268 1 114-3 176-10 183-8 8-13-34-17-157z");
    			add_location(path51, file$6, 110, 10, 71869);
    			attr_dev(path52, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path52, "d", "M5841 5112c4-10 113-101 272-227 49-39 118-93 153-122 35-28 77-61 94-73 56-40 30-12-52 57-46 37-96 80-113 95-52 46-319 259-339 270-12 6-17 6-15 0z");
    			add_location(path52, file$6, 112, 10, 72089);
    			attr_dev(path53, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path53, "d", "M7205 5098c-33-150-61-254-85-317-16-41-27-77-25-80 6-5 56 104 85 185 22 62 50 182 50 215 0 26-19 24-25-3z");
    			add_location(path53, file$6, 114, 10, 72286);
    			attr_dev(path54, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path54, "d", "M5507 5037c13-25 85-83 333-273 271-207 3e2-228 3e2-217 0 4-13 17-28 28-30 21-177 137-416 328-171 136-204 160-189 134z");
    			add_location(path54, file$6, 116, 10, 72443);
    			attr_dev(path55, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path55, "d", "M4940 4362c0-18 58-88 114-140 126-114 250-198 373-250 70-30 383-113 419-111 20 1 15 3-206 74-266 86-403 164-582 334-104 99-118 110-118 93z");
    			add_location(path55, file$6, 118, 10, 72612);
    			attr_dev(path56, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path56, "d", "M5305 4275c30-25 176-91 224-101 14-3-28 24-94 60-126 68-187 88-130 41z");
    			add_location(path56, file$6, 120, 10, 72802);
    			attr_dev(path57, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path57, "d", "M7705 4988c-2-7-6-35-10-63-13-105-48-228-66-232-15-4-16-8-7-23 9-14 8-24-5-44-9-14-17-32-17-40 0-22-103-247-146-318-65-109-154-238-164-238-5 0-12 5-15 10-3 6-13 10-22 10-14 0-14-3 2-20 15-17 16-24 6-46l-12-27-24 23c-30 29-53 23-25-7 24-27 25-36 4-54-13-10-19-8-40 14-29 31-50 36-35 9 5-10 17-24 25-32 25-20 20-30-41-94-48-49-51-54-18-29 22 17 51 43 64 57 19 20 27 23 38 15 21-18 16-28-48-91-33-33-59-62-57-64 2-1 33 24 68 56 67 61 76 65 94 38 8-13 2-22-24-45-103-85-107-106-5-24l50 40 37-36c43-42 51-36 13 9-30 36-31 40-5 63 20 18 21 18 62-21 41-38 41-38 17-5-13 18-28 39-34 47-13 18 39 65 63 57 9-3-2 14-25 36-24 23-43 44-43 47s33 46 74 97c40 51 90 119 111 151 36 57 78 156 69 165-5 6-5 6-42-69-34-69-142-225-203-294-30-33-39-38-44-25-4 11 17 52 58 115 88 136 145 241 197 361 25 56 49 103 53 103 5 0 47-21 95-47 106-58 1e2-41-9 24-73 43-80 50-74 73 4 14 9 27 11 29 2 3 39-10 80-27 88-37 83-18-6 22-33 15-60 32-60 39s9 46 20 87c21 78 38 230 26 230-4 0-8-6-11-12zm-389-1019c3-6-3-21-15-33-18-18-23-19-31-6-6 10-4 20 7 32 19 21 29 23 39 7zm58-97-27-24-25 26-26 25 24 26 24 25 28-27 29-28-27-23zm-118 33c6-16-12-45-28-45-15 0-21 30-8 45 16 19 29 19 36 0zm46-42c24-21 23-35-4-52-19-12-23-11-35 5-16 22-17 36-1 52 15 15 18 15 40-5z");
    			add_location(path57, file$6, 122, 10, 72924);
    			attr_dev(path58, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path58, "d", "M4490 4537c0-24 44-136 90-227 95-190 209-351 348-494 80-83 232-209 241-201 3 3-29 35-70 72-110 98-243 237-303 317-83 110-188 294-241 421-27 63-53 115-57 115s-8-1-8-3z");
    			add_location(path58, file$6, 124, 10, 74202);
    			attr_dev(path59, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path59, "d", "M4730 4183c0-26 177-250 188-239 2 3-27 47-65 98s-78 105-87 121c-17 25-36 36-36 20z");
    			add_location(path59, file$6, 126, 10, 74420);
    			attr_dev(path60, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path60, "d", "M5140 3816c0-35 226-161 370-207l85-26-2-43c-1-23-5-45-8-48s-28-1-56 4c-75 16-41-9 44-31 52-14 67-22 67-36s-7-19-25-19c-33 0-198 53-281 91-73 32-78 34-69 19 17-27 187-97 313-130 29-7 46-18 52-33 7-17 9-18 9-4 1 11 9 17 26 17 21 0 25-5 26-32 1-31 2-31 8-8 8 28 0 28 147 5 156-23 175-16 29 11-161 30-155 28-155 60 0 25 1 26 53 20l52-6-48 16-49 15 7 42c4 23 10 45 14 48 3 4 38 3 76-2 129-15 419-22 540-13 113 8 102 9-185 15-311 6-412 17-429 46-6 11-10 12-15 4-13-21-36-12-36 14 0 30-15 33-23 6-6-24-47-17-48 8 0 10-2 11-6 4-7-18-23-16-110 13-118 40-194 77-288 138-50 33-85 50-85 42zm517-291c-6-54-9-59-36-50-37 11-19 95 20 95 20 0 21-4 16-45zm63 8c0-49-11-73-32-73-18 0-20 4-14 42 8 49 13 58 32 58 9 0 14-10 14-27zm-20-122c0-24-3-28-20-24-11 3-23 9-25 13-9 15 7 40 26 40 14 0 19-7 19-29z");
    			add_location(path60, file$6, 128, 10, 74554);
    			attr_dev(path61, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path61, "d", "M6797 3486c-123-66-287-127-396-147-45-9-59-15-48-21 35-19 246 41 382 110 68 34 185 108 185 117 0 7 7 10-123-59z");
    			add_location(path61, file$6, 130, 10, 75389);
    			attr_dev(path62, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path62, "d", "M6696 3488c-27-18-44-34-38-36 13-4 92 47 92 59s1 13-54-23z");
    			add_location(path62, file$6, 132, 10, 75552);
    			attr_dev(path63, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path63, "d", "M5621 3314c0-11 3-14 6-6 3 7 2 16-1 19-3 4-6-2-5-13z");
    			add_location(path63, file$6, 134, 10, 75662);
    			attr_dev(path64, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path64, "d", "M3522 7230c0-14 2-19 5-12 2 6 2 18 0 25-3 6-5 1-5-13z");
    			add_location(path64, file$6, 134, 94, 75746);
    			attr_dev(path65, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path65, "d", "M3523 7025c0-99 3-254 7-345 6-149 6-136 7 135 1 165-2 320-6 345-6 30-8-14-8-135z");
    			add_location(path65, file$6, 136, 10, 75851);
    			attr_dev(path66, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path66, "d", "M7170 7193c0-5 22-23 48-41 143-97 370-328 592-602 150-185 181-212 60-50-208 277-380 466-548 601-73 59-152 106-152 92z");
    			add_location(path66, file$6, 138, 10, 75983);
    			attr_dev(path67, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path67, "d", "M4864 7094c-43-29-149-112-204-158-19-16-91-86-160-155-210-211-372-446-520-753-64-134-160-360-160-376 0-4 59 110 129 253 284 574 435 771 836 1097 69 56 134 118 123 118-3 0-23-12-44-26z");
    			add_location(path67, file$6, 140, 10, 76152);
    			attr_dev(path68, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path68, "d", "M4381 6823c-96-98-219-261-277-368-47-88-41-83 34 30 102 152 306 395 332 395 5 0 10 7 14 15 13 35-22 10-103-72z");
    			add_location(path68, file$6, 142, 10, 76387);
    			attr_dev(path69, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path69, "d", "M3396 4997c-5-104-6-280-3-390 3-111 0-535-6-942-6-450-7-818-1-940l8-2e2 7 155c9 214 17 2148 10 2345l-6 160-9-188z");
    			add_location(path69, file$6, 144, 10, 76549);
    			attr_dev(path70, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path70, "d", "M8117 4158c-8-12-42-67-76-121-129-206-240-342-506-616-102-105-185-193-185-197 0-11 319 297 394 380 174 195 328 408 377 523 21 50 19 68-4 31z");
    			add_location(path70, file$6, 146, 10, 76714);
    			attr_dev(path71, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path71, "d", "M4165 3948c4-13 20-50 36-82 143-281 503-646 834-846 127-77 116-66-65 64-338 244-578 497-732 772-60 107-87 142-73 92z");
    			add_location(path71, file$6, 148, 10, 76906);
    			attr_dev(path72, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path72, "d", "M4430 3110c0-13 67-90 142-163 80-77 309-263 359-291l34-19-25 27c-14 16-54 51-90 79-36 29-69 57-75 63-5 6-37 31-70 56s-109 93-168 151-107 102-107 97z");
    			add_location(path72, file$6, 150, 10, 77074);
    			attr_dev(path73, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path73, "d", "M4691 2734c20-22 246-179 299-209 38-20-17 23-156 125-149 110-189 133-143 84z");
    			add_location(path73, file$6, 152, 10, 77274);
    			attr_dev(path74, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path74, "d", "M7495 2215c-5-2-80-23-165-46s-149-44-143-46c14-5 269 61 316 81 27 12 21 21-8 11z");
    			add_location(path74, file$6, 154, 10, 77402);
    			attr_dev(g, "transform", "translate(0.000000,1024.000000) scale(0.100000,-0.100000)");
    			attr_dev(g, "fill", "#000");
    			attr_dev(g, "stroke", "none");
    			add_location(g, file$6, 6, 5, 134);
    			attr_dev(svg, "version", "1.0");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "width", "1024pt");
    			attr_dev(svg, "height", "1024pt");
    			attr_dev(svg, "viewBox", "0 0 1024 1024");
    			attr_dev(svg, "class", "svelte-1giqqxd");
    			add_location(svg, file$6, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, g);
    			append_dev(g, path0);
    			append_dev(g, path1);
    			append_dev(g, path2);
    			append_dev(g, path3);
    			append_dev(g, path4);
    			append_dev(g, path5);
    			append_dev(g, path6);
    			append_dev(g, path7);
    			append_dev(g, path8);
    			append_dev(g, path9);
    			append_dev(g, path10);
    			append_dev(g, path11);
    			append_dev(g, path12);
    			append_dev(g, path13);
    			append_dev(g, path14);
    			append_dev(g, path15);
    			append_dev(g, path16);
    			append_dev(g, path17);
    			append_dev(g, path18);
    			append_dev(g, path19);
    			append_dev(g, path20);
    			append_dev(g, path21);
    			append_dev(g, path22);
    			append_dev(g, path23);
    			append_dev(g, path24);
    			append_dev(g, path25);
    			append_dev(g, path26);
    			append_dev(g, path27);
    			append_dev(g, path28);
    			append_dev(g, path29);
    			append_dev(g, path30);
    			append_dev(g, path31);
    			append_dev(g, path32);
    			append_dev(g, path33);
    			append_dev(g, path34);
    			append_dev(g, path35);
    			append_dev(g, path36);
    			append_dev(g, path37);
    			append_dev(g, path38);
    			append_dev(g, path39);
    			append_dev(g, path40);
    			append_dev(g, path41);
    			append_dev(g, path42);
    			append_dev(g, path43);
    			append_dev(g, path44);
    			append_dev(g, path45);
    			append_dev(g, path46);
    			append_dev(g, path47);
    			append_dev(g, path48);
    			append_dev(g, path49);
    			append_dev(g, path50);
    			append_dev(g, path51);
    			append_dev(g, path52);
    			append_dev(g, path53);
    			append_dev(g, path54);
    			append_dev(g, path55);
    			append_dev(g, path56);
    			append_dev(g, path57);
    			append_dev(g, path58);
    			append_dev(g, path59);
    			append_dev(g, path60);
    			append_dev(g, path61);
    			append_dev(g, path62);
    			append_dev(g, path63);
    			append_dev(g, path64);
    			append_dev(g, path65);
    			append_dev(g, path66);
    			append_dev(g, path67);
    			append_dev(g, path68);
    			append_dev(g, path69);
    			append_dev(g, path70);
    			append_dev(g, path71);
    			append_dev(g, path72);
    			append_dev(g, path73);
    			append_dev(g, path74);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('HomeAnimation2', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<HomeAnimation2> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class HomeAnimation2 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "HomeAnimation2",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/components/HomeAnimation3.svelte generated by Svelte v3.55.1 */

    const file$5 = "src/components/HomeAnimation3.svelte";

    function create_fragment$5(ctx) {
    	let svg;
    	let g;
    	let path0;
    	let path1;
    	let path2;
    	let path3;
    	let path4;
    	let path5;
    	let path6;
    	let path7;
    	let path8;
    	let path9;
    	let path10;
    	let path11;
    	let path12;
    	let path13;
    	let path14;
    	let path15;
    	let path16;
    	let path17;
    	let path18;
    	let path19;
    	let path20;
    	let path21;
    	let path22;
    	let path23;
    	let path24;
    	let path25;
    	let path26;
    	let path27;
    	let path28;
    	let path29;
    	let path30;
    	let path31;
    	let path32;
    	let path33;
    	let path34;
    	let path35;
    	let path36;
    	let path37;
    	let path38;
    	let path39;
    	let path40;
    	let path41;
    	let path42;
    	let path43;
    	let path44;
    	let path45;
    	let path46;
    	let path47;
    	let path48;
    	let path49;
    	let path50;
    	let path51;
    	let path52;
    	let path53;
    	let path54;
    	let path55;
    	let path56;
    	let path57;
    	let path58;
    	let path59;
    	let path60;
    	let path61;
    	let path62;
    	let path63;
    	let path64;
    	let path65;
    	let path66;
    	let path67;
    	let path68;
    	let path69;
    	let path70;
    	let path71;
    	let path72;
    	let path73;
    	let path74;
    	let path75;
    	let path76;
    	let path77;
    	let path78;
    	let path79;
    	let path80;
    	let path81;
    	let path82;
    	let path83;
    	let path84;
    	let path85;
    	let path86;
    	let path87;
    	let path88;
    	let path89;
    	let path90;
    	let path91;
    	let path92;
    	let path93;
    	let path94;
    	let path95;
    	let path96;
    	let path97;
    	let path98;
    	let path99;
    	let path100;
    	let path101;
    	let path102;
    	let path103;
    	let path104;
    	let path105;
    	let path106;
    	let path107;
    	let path108;
    	let path109;
    	let path110;
    	let path111;
    	let path112;
    	let path113;
    	let path114;
    	let path115;
    	let path116;
    	let path117;
    	let path118;
    	let path119;
    	let path120;
    	let path121;
    	let path122;
    	let path123;
    	let path124;
    	let path125;
    	let path126;
    	let path127;
    	let path128;
    	let path129;
    	let path130;
    	let path131;
    	let path132;
    	let path133;
    	let path134;
    	let path135;
    	let path136;
    	let path137;
    	let path138;
    	let path139;
    	let path140;
    	let path141;
    	let path142;
    	let path143;
    	let path144;
    	let path145;
    	let path146;
    	let path147;
    	let path148;
    	let path149;
    	let path150;
    	let path151;
    	let path152;
    	let path153;
    	let path154;
    	let path155;
    	let path156;
    	let path157;
    	let path158;
    	let path159;
    	let path160;
    	let path161;
    	let path162;
    	let path163;
    	let path164;
    	let path165;
    	let path166;
    	let path167;
    	let path168;
    	let path169;
    	let path170;
    	let path171;
    	let path172;
    	let path173;
    	let path174;
    	let path175;
    	let path176;
    	let path177;
    	let path178;
    	let path179;
    	let path180;
    	let path181;
    	let path182;
    	let path183;
    	let path184;
    	let path185;
    	let path186;
    	let path187;
    	let path188;
    	let path189;
    	let path190;
    	let path191;
    	let path192;
    	let path193;
    	let path194;
    	let path195;
    	let path196;
    	let path197;
    	let path198;
    	let path199;
    	let path200;
    	let path201;
    	let path202;
    	let path203;
    	let path204;
    	let path205;
    	let path206;
    	let path207;
    	let path208;
    	let path209;
    	let path210;
    	let path211;
    	let path212;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			g = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			path5 = svg_element("path");
    			path6 = svg_element("path");
    			path7 = svg_element("path");
    			path8 = svg_element("path");
    			path9 = svg_element("path");
    			path10 = svg_element("path");
    			path11 = svg_element("path");
    			path12 = svg_element("path");
    			path13 = svg_element("path");
    			path14 = svg_element("path");
    			path15 = svg_element("path");
    			path16 = svg_element("path");
    			path17 = svg_element("path");
    			path18 = svg_element("path");
    			path19 = svg_element("path");
    			path20 = svg_element("path");
    			path21 = svg_element("path");
    			path22 = svg_element("path");
    			path23 = svg_element("path");
    			path24 = svg_element("path");
    			path25 = svg_element("path");
    			path26 = svg_element("path");
    			path27 = svg_element("path");
    			path28 = svg_element("path");
    			path29 = svg_element("path");
    			path30 = svg_element("path");
    			path31 = svg_element("path");
    			path32 = svg_element("path");
    			path33 = svg_element("path");
    			path34 = svg_element("path");
    			path35 = svg_element("path");
    			path36 = svg_element("path");
    			path37 = svg_element("path");
    			path38 = svg_element("path");
    			path39 = svg_element("path");
    			path40 = svg_element("path");
    			path41 = svg_element("path");
    			path42 = svg_element("path");
    			path43 = svg_element("path");
    			path44 = svg_element("path");
    			path45 = svg_element("path");
    			path46 = svg_element("path");
    			path47 = svg_element("path");
    			path48 = svg_element("path");
    			path49 = svg_element("path");
    			path50 = svg_element("path");
    			path51 = svg_element("path");
    			path52 = svg_element("path");
    			path53 = svg_element("path");
    			path54 = svg_element("path");
    			path55 = svg_element("path");
    			path56 = svg_element("path");
    			path57 = svg_element("path");
    			path58 = svg_element("path");
    			path59 = svg_element("path");
    			path60 = svg_element("path");
    			path61 = svg_element("path");
    			path62 = svg_element("path");
    			path63 = svg_element("path");
    			path64 = svg_element("path");
    			path65 = svg_element("path");
    			path66 = svg_element("path");
    			path67 = svg_element("path");
    			path68 = svg_element("path");
    			path69 = svg_element("path");
    			path70 = svg_element("path");
    			path71 = svg_element("path");
    			path72 = svg_element("path");
    			path73 = svg_element("path");
    			path74 = svg_element("path");
    			path75 = svg_element("path");
    			path76 = svg_element("path");
    			path77 = svg_element("path");
    			path78 = svg_element("path");
    			path79 = svg_element("path");
    			path80 = svg_element("path");
    			path81 = svg_element("path");
    			path82 = svg_element("path");
    			path83 = svg_element("path");
    			path84 = svg_element("path");
    			path85 = svg_element("path");
    			path86 = svg_element("path");
    			path87 = svg_element("path");
    			path88 = svg_element("path");
    			path89 = svg_element("path");
    			path90 = svg_element("path");
    			path91 = svg_element("path");
    			path92 = svg_element("path");
    			path93 = svg_element("path");
    			path94 = svg_element("path");
    			path95 = svg_element("path");
    			path96 = svg_element("path");
    			path97 = svg_element("path");
    			path98 = svg_element("path");
    			path99 = svg_element("path");
    			path100 = svg_element("path");
    			path101 = svg_element("path");
    			path102 = svg_element("path");
    			path103 = svg_element("path");
    			path104 = svg_element("path");
    			path105 = svg_element("path");
    			path106 = svg_element("path");
    			path107 = svg_element("path");
    			path108 = svg_element("path");
    			path109 = svg_element("path");
    			path110 = svg_element("path");
    			path111 = svg_element("path");
    			path112 = svg_element("path");
    			path113 = svg_element("path");
    			path114 = svg_element("path");
    			path115 = svg_element("path");
    			path116 = svg_element("path");
    			path117 = svg_element("path");
    			path118 = svg_element("path");
    			path119 = svg_element("path");
    			path120 = svg_element("path");
    			path121 = svg_element("path");
    			path122 = svg_element("path");
    			path123 = svg_element("path");
    			path124 = svg_element("path");
    			path125 = svg_element("path");
    			path126 = svg_element("path");
    			path127 = svg_element("path");
    			path128 = svg_element("path");
    			path129 = svg_element("path");
    			path130 = svg_element("path");
    			path131 = svg_element("path");
    			path132 = svg_element("path");
    			path133 = svg_element("path");
    			path134 = svg_element("path");
    			path135 = svg_element("path");
    			path136 = svg_element("path");
    			path137 = svg_element("path");
    			path138 = svg_element("path");
    			path139 = svg_element("path");
    			path140 = svg_element("path");
    			path141 = svg_element("path");
    			path142 = svg_element("path");
    			path143 = svg_element("path");
    			path144 = svg_element("path");
    			path145 = svg_element("path");
    			path146 = svg_element("path");
    			path147 = svg_element("path");
    			path148 = svg_element("path");
    			path149 = svg_element("path");
    			path150 = svg_element("path");
    			path151 = svg_element("path");
    			path152 = svg_element("path");
    			path153 = svg_element("path");
    			path154 = svg_element("path");
    			path155 = svg_element("path");
    			path156 = svg_element("path");
    			path157 = svg_element("path");
    			path158 = svg_element("path");
    			path159 = svg_element("path");
    			path160 = svg_element("path");
    			path161 = svg_element("path");
    			path162 = svg_element("path");
    			path163 = svg_element("path");
    			path164 = svg_element("path");
    			path165 = svg_element("path");
    			path166 = svg_element("path");
    			path167 = svg_element("path");
    			path168 = svg_element("path");
    			path169 = svg_element("path");
    			path170 = svg_element("path");
    			path171 = svg_element("path");
    			path172 = svg_element("path");
    			path173 = svg_element("path");
    			path174 = svg_element("path");
    			path175 = svg_element("path");
    			path176 = svg_element("path");
    			path177 = svg_element("path");
    			path178 = svg_element("path");
    			path179 = svg_element("path");
    			path180 = svg_element("path");
    			path181 = svg_element("path");
    			path182 = svg_element("path");
    			path183 = svg_element("path");
    			path184 = svg_element("path");
    			path185 = svg_element("path");
    			path186 = svg_element("path");
    			path187 = svg_element("path");
    			path188 = svg_element("path");
    			path189 = svg_element("path");
    			path190 = svg_element("path");
    			path191 = svg_element("path");
    			path192 = svg_element("path");
    			path193 = svg_element("path");
    			path194 = svg_element("path");
    			path195 = svg_element("path");
    			path196 = svg_element("path");
    			path197 = svg_element("path");
    			path198 = svg_element("path");
    			path199 = svg_element("path");
    			path200 = svg_element("path");
    			path201 = svg_element("path");
    			path202 = svg_element("path");
    			path203 = svg_element("path");
    			path204 = svg_element("path");
    			path205 = svg_element("path");
    			path206 = svg_element("path");
    			path207 = svg_element("path");
    			path208 = svg_element("path");
    			path209 = svg_element("path");
    			path210 = svg_element("path");
    			path211 = svg_element("path");
    			path212 = svg_element("path");
    			attr_dev(path0, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path0, "d", "M12745 13623 c-77 -2 -1011 -4 -2075 -6 l-1935 -2 -730 -123 c-401\n    -67 -908 -152 -1125 -188 -264 -43 -400 -70 -410 -80 -13 -13 -15 -172 -11\n    -1337 l4 -1321 -104 98 c-526 502 -1133 787 -1854 871 -185 22 -523 22 -710 0\n    -729 -84 -1387 -399 -1896 -905 -465 -463 -756 -1043 -855 -1705 -21 -144 -29\n    -494 -15 -651 63 -671 364 -1314 841 -1793 621 -626 1497 -958 2397 -910 589\n    31 1122 206 1605 529 180 119 309 224 480 389 l113 109 6 -87 c4 -47 7 -646 8\n    -1331 1 -685 4 -1289 8 -1342 l6 -98 36 -10 c42 -12 485 -68 1421 -179 371\n    -44 1445 -173 2385 -286 941 -113 1879 -226 2085 -250 206 -25 396 -48 421\n    -51 62 -8 51 -18 369 316 97 102 297 313 445 470 262 278 335 356 520 550 289\n    304 447 471 488 515 l47 50 1 1145 c4 4553 3 7495 -4 7553 l-9 67 -906 -2\n    c-499 -1 -970 -4 -1047 -5z m1665 -73 c-62 -21 -1279 -367 -1410 -401 -71 -18\n    -109 -22 -235 -20 -161 1 -1400 22 -2810 46 -478 8 -1142 19 -1475 25 -491 9\n    -1443 27 -1625 31 -39 1 -39 1 -10 9 17 5 347 61 735 125 388 64 800 133 915\n    153 l210 36 875 6 c481 3 1777 6 2880 7 1963 1 2004 1 1950 -17z m250 -85 c0\n    -52 -3 -95 -6 -95 -3 0 -42 26 -87 58 -44 31 -85 60 -91 64 -6 4 -8 10 -4 13\n    5 6 161 52 181 54 4 1 7 -42 7 -94z m-122 -61 l122 -85 0 -74 c0 -41 -3 -76\n    -7 -78 -9 -4 -396 259 -401 272 -2 7 123 48 154 50 5 1 65 -38 132 -85z m-113\n    -132 l230 -158 3 -78 c3 -94 9 -94 -120 2 -51 38 -176 131 -278 206 -102 76\n    -186 141 -188 146 -2 6 81 33 118 39 3 0 109 -71 235 -157z m-143 -88 c145\n    -108 289 -216 321 -240 l57 -44 0 -66 c0 -51 -3 -65 -13 -61 -8 3 -110 79\n    -228 169 -118 90 -226 173 -240 183 -15 11 -84 65 -155 120 l-128 99 54 17\n    c30 9 58 17 62 18 4 1 125 -87 270 -195z m-273 28 c84 -64 217 -166 296 -227\n    79 -60 191 -146 249 -190 l105 -80 1 -87 c0 -49 -2 -88 -4 -88 -8 0 -162 119\n    -177 136 -8 9 -16 51 -19 98 -4 62 -9 81 -20 84 -13 2 -15 -9 -12 -68 2 -38 1\n    -70 -3 -70 -4 0 -73 51 -153 113 -81 62 -159 122 -173 133 -15 10 -85 64 -155\n    119 -71 55 -155 120 -186 143 -32 24 -58 48 -58 52 0 9 112 48 140 49 8 1 84\n    -52 169 -117z m-137 -115 c122 -95 298 -231 391 -302 l167 -130 0 -87 c0 -57\n    -4 -88 -11 -88 -9 0 -200 145 -679 515 -63 49 -150 116 -192 149 -43 32 -78\n    62 -78 66 0 7 130 46 162 49 9 0 117 -77 240 -172z m-176 -103 c148 -114 298\n    -230 334 -258 55 -42 319 -248 381 -296 18 -14 19 -24 13 -98 -4 -45 -10 -82\n    -13 -82 -3 0 -157 117 -341 260 -184 144 -444 345 -576 448 -183 141 -238 189\n    -227 196 24 13 137 45 149 41 6 -2 132 -97 280 -211z m-5866 166 c327 -6 603\n    -13 613 -16 16 -5 17 -30 15 -392 l-3 -387 -115 2 c-381 8 -1774 61 -1807 69\n    l-23 6 0 371 0 370 363 -7 c199 -3 630 -11 957 -16z m1650 -30 c371 -6 916\n    -15 1210 -20 294 -5 821 -14 1170 -20 619 -9 1002 -19 1007 -24 2 -1 3 -299 3\n    -662 l1 -659 -25 -9 c-17 -6 -213 -4 -543 7 -1227 41 -1757 58 -2728 87 -566\n    17 -1035 33 -1041 35 -8 2 -13 190 -18 635 -6 523 -5 634 6 641 7 5 74 7 148\n    4 74 -3 439 -10 810 -15z m3841 -73 c193 -154 422 -332 724 -561 165 -126 317\n    -245 338 -264 37 -36 37 -37 37 -113 0 -43 -3 -80 -7 -82 -6 -4 -442 331 -818\n    627 -50 40 -375 297 -462 366 -45 36 -82 68 -82 71 -1 9 99 37 135 38 24 1 53\n    -17 135 -82z m-279 -4 c57 -40 378 -290 888 -693 168 -133 344 -271 393 -308\n    l87 -66 0 -78 c0 -43 -4 -78 -9 -78 -13 0 -144 102 -733 572 -299 239 -587\n    469 -640 511 -95 75 -98 79 -98 118 0 32 4 41 23 49 32 13 29 13 89 -27z m133\n    -302 c805 -640 1221 -975 1228 -987 4 -7 4 -47 0 -89 l-8 -75 -145 117 c-300\n    243 -557 451 -669 544 -128 105 -453 367 -573 463 l-77 61 -1 78 c0 60 3 76\n    13 71 6 -5 111 -87 232 -183z m170 -346 c209 -170 532 -432 718 -583 l337\n    -274 0 -83 c0 -46 -4 -86 -8 -89 -4 -2 -87 59 -184 137 -358 289 -559 452\n    -1037 840 -35 29 -104 85 -152 125 l-89 73 0 96 c0 91 1 95 18 81 9 -8 188\n    -154 397 -323z m1233 146 l82 -64 0 -94 c0 -73 -3 -93 -12 -87 -7 4 -53 39\n    -101 77 l-88 70 2 81 c1 44 4 84 6 89 6 10 12 5 111 -72z m-1474 -188 c93 -76\n    270 -219 392 -318 121 -99 297 -242 390 -317 437 -354 502 -408 505 -420 2 -7\n    2 -47 -1 -90 l-5 -76 -101 81 c-56 45 -121 98 -145 118 -24 20 -222 182 -439\n    359 -217 178 -413 338 -435 356 -22 18 -98 81 -170 140 -71 58 -139 112 -149\n    120 -17 11 -20 26 -20 99 -1 47 1 85 3 85 2 0 81 -62 175 -137z m1462 -39 c47\n    -37 88 -72 90 -79 3 -6 4 -49 2 -94 l-3 -83 -87 66 c-47 36 -92 74 -100 84\n    -15 22 -13 172 3 172 5 0 47 -30 95 -66z m-7959 -16 c40 -40 75 -70 77 -67 3\n    3 -15 31 -40 62 -25 32 -42 61 -40 66 14 22 66 -7 137 -75 109 -105 116 -101\n    22 12 -24 28 -40 54 -36 57 17 18 44 1 120 -75 45 -45 84 -80 87 -77 3 2 -20\n    33 -49 69 -30 36 -55 68 -55 71 0 10 34 17 52 10 9 -3 53 -41 98 -84 45 -44\n    84 -76 87 -73 3 3 -16 31 -43 63 -83 97 -81 93 -48 93 22 -1 52 -22 127 -91\n    55 -50 102 -88 105 -84 3 3 -26 38 -66 78 -40 40 -72 78 -72 85 0 7 13 12 29\n    12 20 0 45 -16 90 -57 155 -140 208 -166 81 -38 l-85 85 39 0 c33 0 48 -9 105\n    -58 124 -110 167 -122 61 -17 -32 32 -57 62 -54 67 16 26 60 2 176 -97 68 -58\n    127 -105 133 -105 5 0 -34 44 -88 98 l-99 97 47 3 c46 3 48 2 125 -71 43 -42\n    88 -81 101 -87 l24 -13 -25 29 c-13 16 -47 52 -74 81 -41 43 -47 53 -33 59 33\n    12 66 -7 163 -96 112 -101 146 -119 63 -32 -30 31 -68 72 -84 90 l-29 32 62 0\n    c61 0 61 0 129 -62 122 -112 127 -115 115 -93 -11 21 -29 42 -91 108 -35 37\n    -35 37 -10 37 16 0 61 -29 129 -85 58 -47 110 -85 115 -84 6 0 -27 35 -73 77\n    -45 42 -82 80 -82 85 0 4 17 7 37 7 29 0 52 -11 107 -53 157 -119 184 -128 71\n    -25 -41 36 -71 69 -68 72 17 17 58 2 101 -37 144 -131 199 -160 82 -42 -73 73\n    -74 75 -45 75 23 0 45 -14 88 -52 l57 -53 0 -167 0 -168 -97 0 c-262 -1 -1839\n    54 -1845 64 -10 14 -10 430 -1 439 11 12 16 9 90 -65z m1851 -37 l3 -33 -24\n    18 c-14 11 -30 27 -37 37 -10 17 -8 18 22 15 29 -3 33 -7 36 -37z m4832 -282\n    c309 -253 281 -230 716 -584 432 -351 384 -300 384 -412 0 -52 -4 -93 -9 -91\n    -7 2 -492 408 -795 665 -34 28 -195 164 -358 303 l-298 251 0 80 0 81 42 -34\n    c24 -18 167 -134 318 -259z m1283 97 l87 -67 0 -90 c0 -49 -2 -89 -5 -89 -8 0\n    -134 98 -172 134 -32 29 -33 33 -33 106 0 79 5 96 24 81 6 -4 50 -39 99 -75z\n    m-1353 -257 c140 -118 314 -264 385 -324 72 -60 200 -168 285 -240 85 -72 229\n    -193 320 -269 91 -76 169 -148 173 -160 9 -23 -1 -156 -12 -156 -4 0 -59 44\n    -122 98 -63 53 -167 140 -230 193 -63 53 -208 176 -324 274 -115 97 -244 205\n    -285 240 -41 35 -140 118 -220 185 -80 67 -172 149 -206 182 -61 59 -61 60\n    -58 111 2 29 3 65 4 81 0 27 1 28 18 14 9 -8 132 -111 272 -229z m1343 35 l97\n    -75 0 -81 c0 -65 -3 -79 -14 -75 -27 11 -194 148 -201 165 -7 19 4 142 14 142\n    3 0 50 -34 104 -76z m-7217 -19 c1355 -43 4322 -135 4929 -153 l580 -17 7 -40\n    c4 -22 7 -1969 7 -4327 1 -4077 0 -4288 -16 -4288 -17 0 -282 32 -2013 240\n    -415 50 -865 104 -1000 120 -135 16 -452 54 -705 85 -773 93 -1678 202 -2123\n    255 -233 27 -435 53 -448 56 l-24 6 0 577 c0 318 -3 969 -6 1447 l-7 869 46\n    58 45 58 6 -63 c3 -35 10 -207 16 -383 11 -330 25 -522 41 -559 6 -15 8 -4 4\n    34 -8 90 -24 578 -26 808 l-2 212 34 50 c31 46 35 48 41 28 3 -13 7 -102 8\n    -198 2 -96 6 -224 10 -285 6 -107 7 -104 11 90 2 110 2 257 0 327 -3 123 -2\n    129 23 173 15 25 31 45 36 45 6 0 10 -40 10 -92 0 -51 5 -100 10 -108 7 -10\n    10 32 10 128 l0 143 38 67 c21 37 60 117 87 179 34 76 53 109 61 103 6 -5 34\n    -56 64 -112 226 -437 420 -710 697 -978 307 -298 641 -507 1040 -650 51 -18\n    91 -36 88 -40 -2 -3 -54 -29 -114 -55 -61 -27 -108 -51 -106 -53 2 -3 58 18\n    124 47 66 28 128 51 139 51 23 0 242 -57 250 -64 6 -6 12 -4 -273 -122 -110\n    -46 -193 -84 -185 -84 8 0 87 30 175 66 88 36 202 81 254 100 l93 34 102 -15\n    c146 -23 435 -30 596 -16 337 30 657 119 940 261 353 177 634 412 949 793 102\n    124 130 152 169 168 85 36 312 154 312 162 0 4 -21 -4 -48 -17 -52 -26 -286\n    -126 -296 -126 -3 0 37 85 89 189 187 375 261 596 315 946 28 179 38 515 21\n    717 -47 557 -220 1057 -524 1513 -120 180 -215 294 -391 470 -243 242 -485\n    415 -791 566 -495 244 -997 335 -1535 278 -629 -67 -1270 -416 -1697 -924\n    -174 -207 -356 -513 -453 -760 -17 -44 -35 -84 -39 -88 -4 -4 -25 31 -47 79\n    -81 183 -193 362 -342 548 -35 44 -69 91 -76 105 -10 20 -15 176 -20 682 -4\n    360 -4 667 -1 682 5 17 14 27 25 27 10 0 372 -11 806 -25z m5787 -167 c106\n    -90 224 -190 262 -223 39 -33 169 -143 289 -245 121 -102 326 -276 457 -388\n    l239 -203 0 -74 c0 -41 -4 -76 -9 -80 -8 -5 -335 264 -542 445 -10 8 -215 184\n    -457 390 -331 282 -441 381 -444 400 -4 32 2 140 9 140 2 0 91 -73 196 -162z\n    m1398 -4 c133 -102 129 -96 129 -191 0 -52 -4 -83 -11 -83 -6 0 -33 19 -60 42\n    -47 40 -49 43 -50 97 l-1 56 -11 -42 c-5 -24 -14 -43 -19 -43 -6 0 -25 15 -43\n    33 -22 22 -32 40 -30 57 1 14 3 49 4 78 0 28 5 52 10 52 5 0 42 -25 82 -56z\n    m-1345 -260 c122 -104 295 -252 385 -329 90 -77 258 -220 374 -319 115 -98\n    237 -202 270 -230 33 -28 82 -71 108 -96 l48 -45 -3 -74 -3 -74 -130 112\n    c-133 116 -301 261 -550 476 -77 66 -194 167 -260 225 -128 111 -435 374 -472\n    406 -20 16 -23 28 -23 93 0 70 1 73 18 59 9 -9 116 -101 238 -204z m1299 65\n    c35 -31 35 -32 35 -113 0 -46 -3 -86 -6 -89 -4 -4 -24 7 -45 24 l-39 31 0 89\n    c0 50 4 89 10 89 5 0 25 -14 45 -31z m-4805 -112 c63 -61 186 -181 273 -264\n    86 -84 157 -154 157 -156 0 -3 -33 4 -72 13 -40 10 -107 23 -148 30 l-75 13\n    -232 231 c-128 127 -233 234 -233 238 0 5 48 8 108 8 l107 0 115 -113z m159\n    92 c62 -8 81 -15 115 -43 38 -30 308 -280 661 -610 155 -145 247 -231 345\n    -322 36 -33 108 -100 160 -149 52 -49 122 -114 155 -145 33 -30 152 -141 265\n    -246 113 -104 219 -202 235 -218 17 -15 135 -125 263 -244 263 -244 240 -209\n    286 -437 34 -169 41 -218 28 -214 -5 2 -144 134 -309 294 -164 159 -336 326\n    -382 370 -101 97 -114 116 -229 327 -148 273 -239 398 -421 578 -218 216 -452\n    370 -730 480 -82 33 -88 37 -275 221 -105 102 -233 226 -283 274 -51 49 -93\n    92 -93 97 0 9 75 4 209 -13z m-322 -211 c123 -122 223 -225 223 -228 0 -3 -53\n    -4 -117 -2 l-118 3 -120 122 c-207 210 -289 297 -283 302 6 7 110 22 157 24\n    33 1 50 -14 258 -221z m-270 -15 c111 -114 201 -208 199 -210 -9 -9 -223 -30\n    -236 -23 -9 5 -36 30 -60 57 -24 26 -104 111 -177 187 -74 77 -130 143 -126\n    147 7 7 152 44 188 48 6 1 101 -92 212 -206z m884 172 c163 -42 262 -76 300\n    -104 43 -31 99 -82 314 -285 87 -83 195 -185 239 -226 44 -41 116 -109 161\n    -151 131 -124 650 -604 798 -739 122 -111 142 -133 171 -195 42 -88 128 -324\n    123 -338 -4 -13 -1 -15 -482 428 -779 719 -1727 1604 -1740 1625 -9 15 6 13\n    116 -15z m3025 -160 c108 -93 214 -183 233 -200 39 -33 741 -641 888 -769 l93\n    -81 0 -78 c0 -60 -3 -76 -12 -71 -7 5 -200 168 -428 363 -228 195 -523 447\n    -655 560 -132 112 -264 227 -292 255 l-53 50 0 79 c0 64 3 77 14 70 8 -4 103\n    -84 212 -178z m1455 133 l49 -41 0 -89 c0 -48 -3 -88 -6 -88 -4 0 -28 16 -54\n    35 -53 39 -60 58 -60 161 0 39 4 64 11 64 6 0 33 -19 60 -42z m-5690 -130\n    c211 -223 242 -259 233 -267 -13 -11 -157 -44 -175 -40 -17 4 -359 363 -359\n    377 0 7 140 59 165 61 6 1 67 -59 136 -131z m-251 -45 c182 -187 260 -271 260\n    -280 0 -11 -148 -74 -170 -72 -13 1 -99 90 -303 315 l-59 64 74 35 c40 18 80\n    34 88 34 9 1 58 -43 110 -96z m5817 38 c33 -26 33 -27 33 -113 0 -49 -3 -88\n    -6 -88 -3 0 -24 14 -45 31 l-39 31 0 89 c0 98 -2 96 57 50z m-3789 -45 c450\n    -226 799 -524 1109 -951 98 -135 218 -336 211 -355 -2 -4 -95 78 -208 184\n    -113 105 -323 299 -465 431 -143 131 -289 267 -325 300 -36 34 -99 93 -140\n    130 -180 165 -340 319 -340 326 0 12 30 -1 158 -65z m-2296 -25 c18 -21 98\n    -107 177 -190 l144 -153 -78 -44 c-45 -26 -85 -42 -94 -38 -9 3 -91 87 -183\n    187 -131 143 -164 185 -155 194 13 13 137 82 149 83 3 0 21 -17 40 -39z m5256\n    -575 c759 -650 722 -614 722 -708 0 -46 -7 -44 -89 29 -50 45 -54 52 -61 108\n    l-7 60 -2 -47 c0 -27 -4 -48 -7 -48 -7 0 -66 50 -508 425 -175 148 -337 286\n    -361 305 -245 203 -414 354 -417 373 -5 37 3 118 12 115 5 -2 328 -277 718\n    -612z m955 543 l47 -41 0 -84 c0 -46 -4 -84 -8 -84 -5 0 -30 16 -55 36 l-47\n    37 0 88 c0 49 3 89 8 89 4 0 28 -18 55 -41z m-6282 -216 c90 -97 170 -184 177\n    -194 11 -16 3 -24 -64 -73 -42 -31 -80 -56 -84 -56 -4 0 -87 86 -185 191 -154\n    166 -175 193 -163 206 17 16 140 102 149 102 3 1 79 -79 170 -176z m6156 88\n    l33 -26 0 -98 c0 -109 -1 -110 -67 -48 -32 29 -33 32 -33 114 0 46 3 87 6 90\n    8 8 17 3 61 -32z m-1392 -124 c77 -66 223 -190 325 -275 102 -86 244 -206 315\n    -267 72 -61 175 -149 230 -195 55 -46 137 -117 183 -158 l82 -74 0 -79 c0 -43\n    -3 -79 -7 -79 -5 0 -82 63 -172 141 -90 77 -261 222 -379 322 -445 377 -716\n    613 -732 637 -20 30 -17 166 3 153 6 -4 74 -60 152 -126z m-4948 -118 c98\n    -104 179 -193 179 -197 1 -4 -29 -35 -66 -70 l-68 -63 -183 197 c-101 108\n    -184 202 -184 208 0 10 124 115 137 116 4 0 87 -86 185 -191z m6464 140 l49\n    -41 0 -99 c0 -54 -3 -99 -6 -99 -3 0 -27 19 -55 43 l-49 42 0 98 c0 53 3 97 6\n    97 3 0 28 -18 55 -41z m-6620 -306 c93 -99 169 -185 169 -190 0 -11 -107 -137\n    -120 -141 -9 -3 -49 37 -264 272 l-128 139 68 68 c65 66 69 68 87 51 11 -9 95\n    -99 188 -199z m-2020 160 c313 -246 399 -328 530 -503 132 -177 220 -331 273\n    -478 26 -73 34 -125 17 -106 -5 5 -29 59 -54 119 -127 311 -365 621 -658 857\n    -113 91 -187 157 -176 158 4 0 35 -21 68 -47z m7115 -84 c66 -57 253 -216 414\n    -354 161 -137 390 -333 509 -435 l216 -185 3 -83 c2 -45 -1 -82 -5 -82 -7 0\n    -121 96 -528 445 -66 57 -174 150 -241 207 -66 56 -195 166 -285 243 -243 208\n    -238 202 -240 255 -1 25 -1 63 0 84 1 36 2 38 19 24 9 -8 71 -62 138 -119z\n    m1393 91 l44 -40 -1 -81 c-1 -45 -4 -84 -7 -87 -2 -3 -25 12 -50 32 l-45 37 0\n    90 c0 49 3 89 8 89 4 -1 27 -19 51 -40z m132 -112 l49 -41 0 -89 c0 -48 -3\n    -88 -7 -88 -15 1 -102 85 -104 100 -4 35 1 160 7 160 3 0 28 -19 55 -42z\n    m-5102 -50 c39 -34 67 -65 63 -69 -4 -4 -23 -10 -42 -14 -32 -5 -41 0 -113 60\n    -42 37 -75 70 -72 76 4 5 26 9 50 9 39 0 51 -6 114 -62z m199 10 c35 -28 59\n    -54 55 -58 -4 -4 -38 -10 -75 -14 l-67 -6 -58 51 c-32 28 -65 58 -73 65 -12\n    12 -2 14 70 14 l85 0 63 -52z m-5313 27 c439 -55 817 -237 1143 -549 286 -275\n    472 -617 557 -1026 33 -155 45 -449 26 -607 -88 -711 -535 -1327 -1187 -1634\n    -137 -65 -307 -121 -464 -154 -153 -32 -463 -45 -626 -26 -312 37 -640 153\n    -871 308 -330 222 -595 542 -736 888 -224 548 -207 1119 47 1640 247 507 685\n    893 1211 1068 297 98 602 129 900 92z m657 -42 c149 -63 217 -103 363 -210\n    216 -160 442 -417 559 -637 64 -121 38 -104 -52 34 -248 380 -493 601 -878\n    795 -82 41 -144 74 -137 75 6 0 71 -26 145 -57z m4307 3 c37 -30 75 -64 85\n    -75 17 -19 17 -20 -23 -32 -37 -11 -43 -10 -78 14 -21 14 -63 48 -93 75 l-55\n    50 35 10 c56 16 59 15 129 -42z m444 45 c34 -8 124 -75 126 -93 1 -11 -58 -10\n    -99 2 -19 6 -57 31 -85 55 l-50 45 35 0 c19 0 52 -4 73 -9z m-4403 -71 c124\n    -71 228 -149 265 -197 54 -71 42 -71 -35 0 -38 35 -133 108 -210 162 -77 53\n    -140 99 -140 102 0 3 10 -1 23 -9 12 -8 56 -34 97 -58z m2311 -18 c111 -116\n    271 -290 288 -314 11 -17 9 -26 -23 -74 -43 -64 -42 -64 -131 37 -33 37 -118\n    128 -188 203 l-129 135 43 51 c23 27 45 50 49 50 4 0 45 -39 91 -88z m1542 -4\n    c47 -40 86 -76 86 -79 1 -3 -18 -13 -41 -22 -45 -18 -44 -19 -99 33 -9 8 -42\n    35 -73 59 -60 47 -65 61 -25 72 51 15 67 8 152 -63z m788 37 c47 -16 126 -83\n    84 -72 -11 3 -42 8 -70 12 -60 8 -91 23 -128 63 l-29 30 49 -9 c26 -5 69 -16\n    94 -24z m-948 -51 c31 -25 57 -49 57 -52 0 -4 -16 -17 -36 -30 l-36 -23 -61\n    53 c-78 67 -81 70 -54 85 40 22 70 14 130 -33z m4182 -245 c171 -146 427 -364\n    570 -484 143 -121 290 -249 328 -285 l67 -66 0 -72 c0 -40 -4 -72 -8 -72 -5 0\n    -62 46 -128 103 -516 445 -553 477 -885 762 -96 82 -200 174 -231 204 l-58 54\n    0 75 c0 71 1 74 18 60 9 -8 157 -134 327 -279z m1209 234 l36 -32 0 -86 c0\n    -47 -3 -85 -6 -85 -3 0 -27 19 -55 43 l-49 42 0 76 c0 103 3 104 74 42z\n    m-5504 -38 c36 -31 66 -60 68 -64 4 -10 -46 -51 -62 -51 -13 0 -156 128 -156\n    139 0 8 47 28 70 30 8 0 44 -24 80 -54z m1269 20 c41 -20 72 -37 69 -40 -8 -8\n    -119 32 -146 53 -42 33 -6 27 77 -13z m-3947 -192 c39 -45 90 -108 114 -140\n    48 -64 120 -193 107 -193 -4 0 -28 31 -53 68 -71 105 -165 228 -261 339 -49\n    56 -89 106 -89 110 0 12 104 -93 182 -184z m1411 -22 c108 -115 197 -215 197\n    -222 0 -11 -78 -159 -84 -159 -3 0 -94 101 -324 359 -58 65 -91 109 -87 119 9\n    24 79 111 90 112 6 0 99 -94 208 -209z m1130 158 c127 -101 130 -106 79 -133\n    -27 -14 -30 -12 -116 61 l-88 75 29 19 c15 10 32 19 36 19 4 0 31 -19 60 -41z\n    m1023 30 c3 -6 -3 -20 -15 -32 l-21 -21 -45 22 c-25 12 -45 26 -45 32 0 14\n    117 13 126 -1z m226 -15 c9 -2 128 -66 265 -140 136 -75 280 -154 319 -175\n    218 -119 230 -127 272 -179 24 -28 41 -54 39 -57 -3 -2 -171 87 -373 198 -203\n    111 -435 238 -516 282 -82 44 -148 84 -148 87 0 7 110 -6 142 -16z m-369 -20\n    c70 -37 75 -42 55 -62 -15 -15 -3 -15 21 0 16 10 51 -7 242 -111 123 -68 228\n    -127 233 -132 11 -10 -9 -59 -24 -59 -14 0 -473 249 -485 263 -5 7 -18 13 -28\n    15 -31 5 -188 95 -180 103 8 8 42 15 78 18 12 0 51 -15 88 -35z m-521 1 l29\n    -25 -46 -22 -45 -22 -21 20 -20 21 31 27 c17 14 34 26 37 26 3 0 18 -11 35\n    -25z m896 -90 c97 -53 188 -104 201 -114 21 -16 22 -20 9 -44 l-13 -27 -220\n    120 c-121 66 -221 124 -223 130 -6 16 30 41 51 36 9 -2 97 -48 195 -101z\n    m4504 68 c24 -21 46 -42 50 -48 9 -12 11 -175 2 -175 -3 0 -30 21 -60 46 l-54\n    46 0 84 c0 49 4 84 10 84 5 0 29 -17 52 -37z m-4995 -40 c98 -54 102 -57 87\n    -75 -10 -10 -24 -18 -32 -18 -13 0 -201 100 -229 123 -20 15 -5 27 34 27 25 0\n    68 -17 140 -57z m-822 -24 c71 -59 84 -73 74 -85 -34 -41 -46 -38 -139 37 -50\n    40 -90 77 -90 82 0 14 32 36 52 37 9 0 55 -32 103 -71z m710 -20 c71 -39 132\n    -73 134 -75 3 -3 -4 -13 -15 -24 -22 -23 -15 -25 -218 88 -96 53 -98 55 -75\n    68 13 7 28 13 34 14 5 0 68 -32 140 -71z m882 40 c140 -55 397 -208 380 -225\n    -3 -3 -29 7 -59 22 -59 30 -411 224 -417 230 -12 12 27 1 96 -27z m-1267 -9\n    c0 -6 -14 -19 -32 -30 -25 -15 -36 -17 -52 -8 -19 11 -19 12 13 39 27 22 38\n    26 53 18 10 -5 18 -14 18 -19z m-402 -84 l83 -69 -23 -24 c-48 -51 -51 -51\n    -153 34 -51 43 -94 83 -94 89 -1 6 16 23 36 37 30 21 40 24 52 14 9 -6 53 -43\n    99 -81z m4331 2 c53 -45 135 -116 182 -158 47 -41 127 -111 178 -155 52 -44\n    182 -157 290 -250 108 -94 276 -239 374 -323 l177 -154 0 -62 c0 -35 -3 -65\n    -6 -69 -3 -3 -59 40 -123 96 -65 56 -214 185 -331 287 -117 102 -356 310 -532\n    463 l-318 277 0 65 c0 36 3 65 6 65 3 0 49 -37 103 -82z m-3634 -4 c77 -42\n    144 -80 149 -85 13 -12 -13 -39 -37 -39 -18 0 -232 111 -306 159 -22 14 -22\n    15 -5 28 31 23 55 15 199 -63z m5068 21 c40 -38 47 -50 47 -83 0 -52 -11 -104\n    -21 -100 -4 2 -28 22 -53 46 -34 31 -45 49 -42 65 3 12 5 43 5 70 1 26 4 47 9\n    47 4 0 28 -20 55 -45z m-8176 -157 c25 -36 43 -72 41 -79 -2 -7 -24 16 -48 51\n    -24 36 -70 101 -102 145 l-59 80 61 -65 c33 -36 81 -95 107 -132z m1346 -90\n    c90 -101 157 -185 157 -196 0 -11 -17 -59 -37 -108 l-36 -87 -28 33 c-15 18\n    -29 45 -31 59 -2 18 -13 31 -38 42 -33 16 -324 328 -344 369 -6 13 2 34 29 76\n    66 105 62 103 120 42 28 -29 121 -133 208 -230z m1367 248 c0 -20 -60 -50 -73\n    -37 -9 9 -4 18 18 35 29 24 55 24 55 2z m310 -84 c149 -83 183 -114 135 -119\n    -16 -2 -197 93 -329 173 -23 14 -13 34 17 33 12 0 92 -39 177 -87z m659 -38\n    c130 -70 244 -132 253 -138 18 -10 16 -40 -2 -60 -7 -7 -381 190 -508 266 -32\n    19 -32 21 -16 39 9 11 22 19 27 19 6 0 116 -57 246 -126z m-1375 21 c47 -38\n    86 -75 86 -81 0 -6 -11 -21 -24 -33 -20 -19 -28 -21 -45 -12 -25 14 -26 20 -5\n    49 18 26 8 29 -18 6 -17 -16 -20 -15 -55 10 -21 15 -56 42 -77 61 l-40 35 29\n    30 c33 34 18 41 149 -65z m312 43 c10 -16 -45 -63 -59 -49 -8 8 -4 18 13 36\n    26 28 35 31 46 13z m328 -78 c183 -103 185 -104 166 -124 -14 -14 -30 -8 -160\n    65 -156 88 -180 105 -180 126 0 25 33 13 174 -67z m698 -77 c226 -124 268\n    -151 268 -170 0 -12 -4 -24 -9 -27 -9 -6 -533 275 -560 300 -12 11 -12 16 -1\n    28 7 9 17 16 23 16 6 0 132 -66 279 -147z m4686 80 c33 -28 33 -29 30 -107\n    l-3 -79 -62 52 c-68 57 -72 69 -57 163 l7 38 26 -20 c14 -11 41 -32 59 -47z\n    m-11958 44 c0 -1 -37 -40 -82 -87 -44 -47 -107 -117 -139 -157 -185 -232 -362\n    -623 -438 -969 -42 -190 -52 -275 -52 -439 1 -166 19 -281 91 -575 27 -112 50\n    -211 49 -220 0 -25 -97 306 -124 425 -84 380 -53 716 107 1160 101 279 250\n    533 432 738 70 78 156 147 156 124z m5812 -65 l68 -54 -32 -44 c-17 -24 -36\n    -44 -41 -44 -10 0 -143 106 -153 121 -7 13 67 90 80 82 6 -3 41 -31 78 -61z\n    m501 26 c-9 -24 -17 -44 -19 -46 -1 -2 -14 3 -29 11 l-27 14 43 31 c24 18 44\n    32 46 32 2 0 -5 -19 -14 -42z m1709 -148 c182 -100 339 -187 350 -194 25 -18\n    81 -106 67 -106 -6 0 -113 56 -238 124 -124 68 -293 161 -376 206 -82 45 -154\n    86 -159 90 -11 11 1 60 15 60 5 0 159 -81 341 -180z m-1856 148 c8 -13 -49\n    -68 -71 -68 -25 0 -17 22 18 51 36 32 43 34 53 17z m4249 -118 c66 -58 346\n    -302 622 -543 276 -240 509 -444 517 -453 16 -15 23 -123 10 -137 -5 -4 -408\n    335 -619 522 -23 20 -67 59 -100 86 -33 28 -116 100 -186 160 -69 61 -187 162\n    -262 225 l-135 115 -1 79 c-1 73 0 78 17 65 9 -8 71 -61 137 -119z m-3891 46\n    c72 -41 139 -81 150 -89 18 -13 18 -14 -4 -35 -19 -17 -27 -19 -44 -10 -24 12\n    -259 149 -265 154 -8 7 10 54 20 54 6 0 71 -33 143 -74z m706 -94 c260 -144\n    285 -160 282 -182 -1 -14 -6 -28 -10 -32 -4 -4 -113 52 -242 123 -392 217\n    -380 209 -369 231 5 10 20 18 32 18 12 0 150 -71 307 -158z m4610 -16 c0 -40\n    -3 -75 -6 -79 -4 -3 -28 13 -55 36 l-49 42 0 71 c0 39 3 74 6 77 4 4 29 -12\n    55 -34 l49 -41 0 -72z m-7119 -4 c68 -75 129 -144 136 -153 12 -15 1 -16 -130\n    -14 l-144 2 -44 47 c-60 66 -62 71 -43 108 48 95 87 157 94 153 5 -3 64 -67\n    131 -143z m1515 132 c-1 -12 27 -39 41 -39 1 0 -9 -45 -23 -100 -38 -159 -55\n    -296 -55 -456 0 -124 6 -204 34 -444 1 -15 -4 -19 -23 -20 -18 0 -26 -6 -28\n    -21 -4 -26 22 -38 38 -18 21 24 26 17 38 -49 17 -89 74 -274 126 -403 210\n    -525 556 -939 951 -1137 169 -84 397 -129 559 -110 89 11 87 2 -13 -43 -64\n    -29 -61 -29 -61 -5 0 24 -13 33 -35 25 -13 -5 -15 -14 -11 -36 5 -26 2 -31\n    -29 -44 -43 -18 -222 -62 -287 -70 -40 -5 -48 -4 -48 9 0 9 -7 23 -16 32 -19\n    19 -44 4 -44 -25 0 -28 -89 -38 -129 -14 -25 14 -32 15 -45 5 -24 -20 -103 -5\n    -128 25 -25 28 -35 30 -59 8 -28 -25 -102 -11 -141 27 -32 30 -52 36 -63 19\n    -10 -16 -37 1 -32 22 6 20 -16 48 -37 48 -7 0 -19 11 -26 24 -26 50 -65 43\n    -57 -10 3 -19 3 -34 0 -34 -16 0 -125 66 -133 80 -5 10 -23 20 -41 24 -27 5\n    -30 9 -25 30 3 14 3 32 0 40 -8 21 -54 21 -54 1 0 -8 -3 -15 -7 -15 -17 0\n    -103 83 -103 99 0 9 -5 22 -12 29 -9 9 -8 12 4 12 22 0 40 24 32 44 -10 25\n    -47 16 -54 -13 -5 -21 -7 -22 -19 -7 -7 9 -24 16 -37 16 -20 0 -24 5 -24 28 0\n    34 -16 52 -47 52 -25 0 -29 10 -13 26 8 8 7 19 -2 38 -10 23 -17 27 -39 22\n    -34 -7 -57 15 -34 34 17 14 19 29 6 49 -8 12 -15 13 -35 3 -34 -15 -47 5 -16\n    28 16 12 20 23 16 38 -9 29 -34 35 -48 12 -9 -14 -16 -16 -25 -8 -19 15 -16\n    28 6 28 25 0 33 33 14 59 -19 27 -37 27 -50 -1 -9 -21 -14 -15 -50 62 -40 84\n    -109 286 -133 388 -12 50 -11 55 9 74 16 14 21 29 19 51 -3 28 -6 32 -30 30\n    -33 -2 -39 22 -8 30 29 7 26 45 -5 59 -14 6 -25 14 -25 17 0 9 56 32 72 30 28\n    -3 38 2 38 21 0 25 -25 37 -44 21 -8 -7 -25 -9 -40 -5 -20 5 -26 12 -26 34 0\n    15 7 33 15 40 19 16 19 34 -1 51 -13 11 -15 26 -9 93 8 87 18 116 39 116 22 0\n    26 26 8 51 -18 27 -18 35 5 129 17 71 72 230 80 230 2 0 13 -4 23 -10 13 -7\n    21 -6 30 5 15 18 6 45 -15 45 -25 0 -7 48 62 163 25 42 38 56 46 48 17 -17 44\n    -13 51 6 4 11 1 22 -8 29 -9 6 -16 16 -16 22 0 25 225 272 248 272 5 0 9 -7 8\n    -16z m1654 -137 c464 -251 463 -250 487 -298 12 -24 20 -45 19 -46 -3 -3 -759\n    400 -774 412 -1 1 3 16 9 33 10 28 13 31 32 21 12 -7 114 -61 227 -122z\n    m-2172 51 c76 -62 76 -63 39 -112 -13 -18 -16 -17 -68 22 -30 22 -69 53 -87\n    69 l-32 28 26 33 c29 37 24 38 122 -40z m357 52 c3 -5 -7 -23 -22 -40 -20 -21\n    -32 -27 -42 -21 -12 7 -10 15 10 39 25 32 43 39 54 22z m839 -16 c25 -14 46\n    -30 46 -35 0 -5 8 -9 17 -9 16 0 426 -222 485 -262 18 -13 25 -24 21 -38 -3\n    -11 -10 -20 -15 -20 -5 0 -60 29 -121 64 -62 35 -159 89 -217 121 -58 32 -118\n    67 -133 78 -16 11 -54 32 -85 47 -74 36 -97 54 -88 68 11 19 40 14 90 -14z\n    m-437 -55 c68 -40 126 -76 129 -81 4 -6 -4 -21 -18 -34 l-24 -25 -118 67 c-65\n    37 -120 73 -122 79 -6 13 12 65 22 65 4 0 63 -32 131 -71z m-537 36 c10 -12 5\n    -23 -25 -59 -31 -38 -40 -44 -56 -35 -26 13 -24 25 12 70 33 42 49 48 69 24z\n    m960 -80 c0 -27 -30 -29 -73 -5 -62 34 -73 46 -58 64 11 14 20 12 72 -14 33\n    -17 59 -37 59 -45z m5033 12 l58 -52 -3 -78 -3 -78 -67 56 c-62 51 -68 60 -68\n    93 0 48 11 112 19 112 3 -1 32 -24 64 -53z m-5933 11 c0 -17 -61 -88 -76 -88\n    -24 0 -16 24 22 68 33 39 54 47 54 20z m2055 -215 c394 -211 371 -196 391\n    -249 9 -24 15 -46 13 -49 -3 -2 -146 74 -319 169 -246 135 -316 177 -318 194\n    -3 17 -7 19 -20 11 -13 -8 -35 0 -102 36 -109 60 -114 64 -100 99 l10 28 88\n    -48 c48 -26 209 -112 357 -191z m-2429 172 c97 -75 99 -77 80 -112 -33 -60\n    -28 -60 -120 11 -47 37 -88 71 -90 75 -5 8 43 81 52 81 3 0 38 -25 78 -55z\n    m1214 -41 c0 -6 -9 -19 -19 -29 -19 -16 -22 -16 -81 20 l-61 37 22 24 22 24\n    59 -32 c32 -18 58 -38 58 -44z m3675 -140 c324 -279 637 -549 834 -719 95 -82\n    184 -159 198 -170 22 -18 24 -26 21 -90 l-3 -69 -315 278 c-173 154 -463 410\n    -644 570 -181 160 -332 293 -336 296 -8 5 -13 60 -11 104 1 17 3 18 19 4 9 -8\n    116 -100 237 -204z m-4090 147 c76 -45 100 -64 100 -80 0 -24 3 -26 32 -17 15\n    5 38 -3 77 -24 67 -38 71 -43 48 -63 -18 -16 -40 -6 -299 147 -77 45 -97 69\n    -76 89 10 11 11 10 118 -52z m770 -99 c143 -81 261 -154 262 -162 5 -27 -14\n    -46 -34 -34 -10 6 -126 73 -258 149 -132 75 -246 143 -254 150 -16 15 -8 45\n    11 45 7 -1 130 -67 273 -148z m-1361 122 c22 -9 20 -34 -7 -67 -22 -28 -23\n    -28 -39 -10 -16 17 -16 20 4 51 22 36 20 34 42 26z m5997 -128 c2 -46 2 -48 8\n    -16 8 45 19 42 93 -22 l58 -50 0 -59 c0 -32 -4 -59 -10 -59 -5 0 -60 43 -122\n    97 -120 103 -129 117 -119 200 l3 33 44 -36 c41 -34 44 -40 45 -88z m-4056 -2\n    c19 -14 13 -54 -9 -54 -7 0 -37 15 -67 33 -30 18 -68 39 -86 46 -43 18 -53 31\n    -42 59 l9 23 89 -47 c48 -26 96 -53 106 -60z m-1059 65 c59 -33 65 -46 34 -74\n    -23 -20 -36 -17 -111 30 l-41 27 23 24 c12 13 27 24 32 24 5 0 34 -14 63 -31z\n    m-2160 -84 c-3 -5 -21 -48 -40 -95 -19 -47 -39 -86 -43 -87 -4 -1 -27 21 -50\n    48 l-43 49 19 48 c11 26 29 69 40 96 l22 49 50 -49 c27 -27 47 -53 45 -59z\n    m1017 26 c81 -65 90 -83 59 -121 l-18 -22 -92 73 c-51 40 -92 77 -92 82 0 21\n    42 68 53 59 7 -5 47 -37 90 -71z m333 65 c3 -7 -5 -30 -17 -50 -19 -33 -24\n    -36 -37 -23 -13 14 -12 19 7 51 24 38 38 45 47 22z m997 -2 c49 -25 447 -253\n    490 -280 36 -24 45 -46 28 -73 -7 -11 -24 -5 -87 30 -117 64 -488 280 -498\n    290 -6 5 -2 17 9 29 22 24 18 24 58 4z m-460 -74 c76 -44 152 -89 168 -101 29\n    -20 29 -22 13 -40 -9 -10 -22 -19 -28 -19 -26 2 -311 176 -314 193 -4 22 4 47\n    15 47 5 0 71 -36 146 -80z m5206 28 l61 -51 0 -84 c0 -45 -3 -83 -7 -83 -5 0\n    -34 24 -65 53 l-57 52 -3 83 c-2 45 0 82 3 82 4 0 34 -23 68 -52z m-5870 -2\n    c17 -20 -23 -99 -47 -94 -25 5 -26 34 -2 73 24 39 32 42 49 21z m1873 -57\n    c114 -63 121 -69 113 -102 -7 -24 -9 -25 -34 -14 -57 25 -191 102 -195 112 -4\n    11 11 55 19 55 3 0 47 -23 97 -51z m2713 -39 c28 -25 82 -72 120 -106 39 -33\n    167 -146 285 -250 118 -104 325 -286 460 -405 135 -119 266 -237 293 -264 47\n    -48 47 -48 47 -117 l0 -70 -24 19 c-13 10 -104 90 -202 178 -97 88 -241 217\n    -318 286 -633 565 -762 683 -768 705 -3 13 -5 32 -3 41 2 10 4 31 4 47 l1 30\n    28 -25 c15 -14 50 -45 77 -69z m-3309 -59 c131 -76 262 -152 289 -168 36 -21\n    51 -36 53 -54 5 -47 -10 -52 -64 -22 -135 74 -551 317 -563 329 -13 12 -12 16\n    4 34 10 11 23 20 30 20 6 0 119 -62 251 -139z m-1228 50 c-25 -44 -26 -45 -46\n    -32 -11 7 -11 14 3 42 29 56 36 62 53 46 12 -13 11 -20 -10 -56z m-360 19 c28\n    -21 52 -43 55 -47 6 -10 -30 -93 -40 -93 -4 0 -34 20 -65 45 l-58 45 22 45\n    c12 25 25 45 29 45 4 0 30 -18 57 -40z m989 -62 c57 -33 106 -64 109 -70 3 -5\n    -1 -17 -11 -28 -15 -17 -21 -15 -138 52 -144 83 -158 95 -151 125 l6 22 42\n    -21 c22 -11 87 -47 143 -80z m1683 -73 c118 -64 223 -126 233 -137 17 -20 24\n    -58 10 -58 -23 0 -568 311 -571 325 -2 9 -1 23 2 31 5 13 15 11 58 -14 29 -16\n    150 -82 268 -147z m-3383 144 c10 -7 44 -36 76 -63 51 -43 58 -53 52 -75 -4\n    -14 -9 -28 -11 -30 -5 -6 -184 170 -184 180 0 12 48 3 67 -12z m-4 -95 c65\n    -58 117 -110 117 -117 0 -7 -4 -18 -9 -26 -7 -11 -39 11 -140 94 -72 59 -131\n    113 -131 119 0 15 21 36 35 36 7 0 64 -47 128 -106z m150 78 c15 -15 16 -23 7\n    -46 l-10 -28 -50 42 c-27 23 -53 47 -57 52 -11 19 90 0 110 -20z m6968 -93\n    l119 -100 0 -78 c0 -43 -3 -80 -6 -84 -4 -3 -60 39 -125 94 l-119 100 0 85 c0\n    46 3 84 6 84 3 0 59 -45 125 -101z m-4813 -94 c259 -150 312 -184 312 -202 0\n    -12 -4 -24 -9 -27 -7 -5 -632 352 -655 374 -11 11 12 42 29 38 7 -2 152 -84\n    323 -183z m584 116 c99 -57 122 -81 100 -103 -13 -13 -219 100 -228 124 -6 19\n    2 38 16 38 5 0 55 -27 112 -59z m-1932 39 c12 -8 12 -13 -3 -44 -17 -37 -43\n    -47 -53 -22 -6 15 21 76 34 76 4 0 14 -4 22 -10z m-912 -188 c28 -24 52 -50\n    52 -58 0 -20 -13 -17 -28 6 -8 13 -23 20 -45 20 -42 0 -71 16 -153 85 -38 32\n    -71 59 -73 61 -2 2 2 17 9 34 l12 30 87 -67 c47 -36 110 -86 139 -111z m1583\n    102 c63 -36 123 -74 135 -85 11 -10 26 -19 34 -19 12 0 175 -92 613 -348 105\n    -61 127 -79 127 -98 0 -12 -4 -25 -8 -28 -5 -3 -157 81 -338 186 -181 105\n    -403 233 -494 286 -189 108 -202 118 -194 150 4 12 7 22 9 22 1 0 54 -30 116\n    -66z m1508 25 c222 -121 497 -273 504 -279 13 -11 26 -80 16 -80 -8 0 -85 42\n    -384 208 -225 125 -235 132 -235 156 0 21 7 36 18 36 3 0 39 -19 81 -41z m575\n    22 c28 -19 66 -67 66 -86 0 -5 -23 13 -52 40 l-51 50 32 -42 c18 -24 28 -43\n    23 -43 -14 0 -52 54 -57 80 -5 25 2 25 39 1z m-2865 -40 c0 -9 -8 -33 -17 -54\n    -16 -36 -18 -37 -39 -22 -27 19 -29 42 -8 91 14 34 15 35 40 18 14 -9 25 -24\n    24 -33z m-570 16 c10 -20 8 -38 -12 -113 -14 -49 -28 -102 -32 -118 -6 -29 -6\n    -29 -26 -9 -20 19 -20 20 7 141 28 124 40 143 63 99z m441 -81 c0 -23 -13 -56\n    -21 -56 -5 0 -34 19 -63 43 -55 43 -64 63 -46 98 10 18 14 17 70 -27 33 -26\n    60 -52 60 -58z m306 90 c6 -17 -21 -86 -34 -86 -5 0 -15 6 -21 14 -9 11 -8 22\n    6 50 17 37 39 47 49 22z m1130 -118 c115 -69 260 -153 321 -187 62 -35 115\n    -66 117 -70 7 -11 -5 -51 -16 -51 -8 0 -158 85 -550 312 -76 44 -138 85 -138\n    92 0 19 23 37 41 33 9 -2 110 -60 225 -129z m-2486 76 c45 -49 46 -60 20 -129\n    -12 -30 -12 -29 -46 64 -19 51 -34 97 -34 102 0 19 19 7 60 -37z m7253 -17\n    l47 -45 0 -81 c0 -45 -3 -81 -6 -81 -4 0 -33 23 -65 51 l-59 51 0 84 c0 98 0\n    98 83 21z m-3952 -73 c17 -15 15 -64 -2 -64 -14 0 -202 109 -223 130 -12 12\n    -16 25 -11 39 6 21 10 20 113 -35 59 -31 114 -63 123 -70z m2680 0 c162 -146\n    697 -625 918 -823 96 -86 193 -172 215 -192 40 -35 41 -38 44 -113 2 -42 1\n    -76 -3 -76 -4 0 -26 17 -49 37 -48 42 -214 193 -230 208 -15 15 -373 346 -734\n    679 l-302 279 0 59 c0 33 4 58 9 56 5 -1 64 -53 132 -114z m-4743 59 c5 -34\n    -24 -94 -42 -87 -20 8 -20 32 -1 78 17 39 38 44 43 9z m-1048 -33 l55 -49 -54\n    -1 c-75 0 -106 30 -85 84 10 25 25 19 84 -34z m2365 -160 c176 -101 326 -189\n    334 -196 12 -11 12 -18 3 -38 l-11 -25 -158 91 c-418 242 -557 325 -560 335\n    -2 6 4 18 13 27 14 15 19 15 38 3 11 -8 165 -96 341 -197z m946 126 c341 -187\n    485 -268 497 -280 8 -7 12 -25 10 -40 -3 -26 -4 -25 -193 80 -360 201 -455\n    255 -460 265 -6 8 2 49 9 49 2 0 63 -33 137 -74z m-1428 -63 c375 -214 751\n    -434 765 -447 10 -9 10 -19 2 -40 l-10 -28 -68 38 c-177 98 -861 489 -894 510\n    -32 20 -38 30 -38 59 0 19 5 35 11 35 6 0 110 -57 232 -127z m-1099 53 l49\n    -43 -13 -62 c-7 -33 -16 -61 -19 -61 -8 0 -141 108 -141 114 0 3 20 64 35 104\n    6 17 25 6 89 -52z m326 39 c9 -11 8 -25 -5 -65 -15 -44 -19 -49 -36 -40 -23\n    13 -24 35 -4 84 17 39 26 44 45 21z m1865 -50 c126 -69 151 -95 126 -133 -7\n    -11 -14 -11 -42 3 -72 37 -219 128 -219 136 0 4 5 20 10 34 10 25 12 26 33 13\n    12 -8 54 -32 92 -53z m982 3 c14 -18 44 -98 37 -98 -3 0 -25 11 -49 25 -34 21\n    -47 36 -59 72 -9 26 -16 48 -16 50 0 7 77 -36 87 -49z m-3035 25 c19 -17 23\n    -49 9 -72 -6 -10 -13 -10 -29 -2 -26 14 -34 36 -22 66 11 29 17 31 42 8z\n    m6358 -112 c101 -83 100 -82 100 -172 0 -43 -3 -79 -7 -79 -16 1 -228 193\n    -236 213 -8 22 -8 135 1 150 2 5 21 -6 41 -25 20 -19 65 -58 101 -87z m-2784\n    -86 c6 -5 141 -137 301 -293 l291 -283 6 -62 c16 -180 18 -277 5 -277 -7 0\n    -74 62 -148 138 -74 75 -229 234 -346 352 l-212 215 -17 85 c-10 47 -31 130\n    -48 185 -16 55 -32 109 -35 120 -3 11 39 -23 93 -75 54 -52 103 -99 110 -105z\n    m-4582 167 c3 -5 -3 -25 -12 -45 -28 -59 -44 -43 -21 22 11 31 23 39 33 23z\n    m3405 -83 c390 -218 494 -278 503 -293 10 -15 10 -66 0 -66 -7 0 -99 52 -519\n    294 -142 81 -153 90 -153 117 0 16 5 29 12 29 6 0 77 -37 157 -81z m-2281 19\n    c33 -28 40 -55 21 -89 -10 -19 -13 -18 -60 21 -50 42 -58 64 -39 101 12 22 16\n    20 78 -33z m4867 -189 c116 -107 377 -347 580 -534 204 -187 396 -365 428\n    -395 l58 -55 -3 -67 -3 -68 -35 32 c-160 147 -287 264 -350 323 -42 38 -100\n    93 -130 120 -30 28 -192 176 -360 330 -463 426 -439 401 -441 460 -2 93 -2 92\n    24 68 12 -11 117 -107 232 -214z m-3852 -6 c468 -265 569 -325 574 -338 2 -6\n    -2 -18 -9 -27 -12 -15 -51 4 -383 193 -203 116 -377 219 -386 229 -9 11 -19\n    17 -22 13 -3 -3 -47 18 -96 47 -83 47 -91 54 -91 82 0 23 4 29 16 24 8 -3 187\n    -103 397 -223z m1793 208 c29 -17 53 -66 39 -79 -10 -10 -57 22 -71 50 -26 51\n    -17 59 32 29z m-968 -11 c17 -11 32 -22 32 -26 0 -5 -19 -45 -25 -52 -6 -7\n    -75 33 -75 42 0 26 13 56 24 56 6 0 26 -9 44 -20z m-2748 4 c0 -3 -5 -14 -10\n    -25 -12 -22 -11 -23 24 -9 25 9 26 8 20 -18 -15 -67 -11 -66 -75 -11 -32 28\n    -59 55 -59 60 0 5 23 9 50 9 28 0 50 -3 50 -6z m765 -24 c16 -18 16 -25 5 -67\n    -16 -60 -25 -70 -46 -52 -13 10 -15 25 -11 66 8 77 19 89 52 53z m6175 -40\n    l45 -40 4 -87 3 -88 -23 20 c-13 10 -43 37 -66 59 l-43 40 0 78 c0 90 -1 90\n    80 18z m-7555 41 c-10 -10 -294 -36 -302 -28 -2 3 36 10 84 17 48 6 95 13 103\n    15 38 7 123 4 115 -4z m568 -66 c58 -49 59 -50 52 -90 -8 -50 -19 -62 -41 -45\n    -12 11 -14 24 -10 53 9 52 -4 65 -75 73 -64 7 -84 22 -74 54 7 22 20 26 30 10\n    10 -16 25 -12 25 6 0 19 0 19 93 -61z m620 30 c34 -30 38 -38 32 -64 -4 -17\n    -10 -33 -15 -36 -4 -3 -26 12 -48 33 -37 34 -39 39 -31 70 5 17 13 32 17 32 4\n    -1 24 -16 45 -35z m2284 -8 c102 -58 103 -59 103 -94 0 -20 -5 -33 -13 -33 -7\n    0 -48 21 -91 46 -56 33 -76 50 -72 61 3 8 6 23 6 34 0 10 2 19 4 19 2 0 30\n    -15 63 -33z m1043 -50 c5 -17 8 -33 5 -36 -11 -11 -97 43 -106 67 -19 50 -12\n    55 40 26 35 -18 53 -36 61 -57z m-745 -4 c72 -42 166 -96 210 -119 44 -24 139\n    -78 210 -121 126 -76 130 -80 133 -116 2 -20 -1 -37 -7 -37 -9 0 -82 41 -310\n    176 -84 50 -108 63 -289 168 -90 51 -102 61 -102 85 0 27 7 41 19 41 4 0 65\n    -35 136 -77z m-3570 58 l20 -8 -20 -6 c-30 -9 -287 -26 -485 -31 -229 -6 -169\n    7 125 28 127 9 246 18 265 20 61 5 74 5 95 -3z m165 -22 c0 -5 -7 -9 -15 -9\n    -15 0 -20 12 -9 23 8 8 24 -1 24 -14z m473 -3 c3 -7 -2 -68 -11 -136 -15 -108\n    -19 -121 -31 -106 -11 13 -12 37 -7 111 8 124 15 155 31 148 8 -2 16 -10 18\n    -17z m642 -21 l52 -44 -10 -58 c-5 -32 -11 -60 -13 -62 -7 -8 -54 30 -54 44 0\n    8 -8 15 -18 15 -30 0 -55 35 -49 67 8 40 25 83 33 83 4 0 30 -20 59 -45z\n    m-6324 -60 c-115 -298 -138 -529 -100 -1025 5 -69 12 -147 15 -175 4 -27 4\n    -48 0 -44 -9 9 -34 195 -52 399 -15 167 -16 215 -6 339 20 236 72 450 134 547\n    16 26 31 44 34 42 2 -3 -9 -40 -25 -83z m5540 39 c-7 -31 -9 -34 -10 -12 -1\n    27 9 62 15 55 3 -2 0 -22 -5 -43z m1540 -4 c67 -40 69 -42 69 -82 0 -47 1 -47\n    -101 12 -67 40 -69 42 -69 82 0 47 -1 47 101 -12z m1116 -1 c2 -7 -1 -20 -6\n    -27 -14 -22 -71 12 -71 42 0 12 3 26 7 29 9 10 67 -26 70 -44z m1045 -28 c12\n    -44 4 -49 -37 -26 -31 16 -35 23 -35 57 l0 40 32 -19 c21 -12 35 -30 40 -52z\n    m-3112 1 c0 -41 -15 -59 -34 -43 -16 13 -22 71 -10 84 14 14 44 -14 44 -41z\n    m-88 -82 c-2 -17 -6 -30 -8 -30 -2 0 -22 16 -44 36 -28 25 -40 44 -40 63 0 44\n    11 44 55 1 34 -34 41 -46 37 -70z m6554 13 l114 -98 0 -77 c0 -50 -4 -78 -11\n    -78 -11 0 -109 81 -186 154 l-43 40 0 78 c0 43 3 78 6 78 3 0 57 -44 120 -97z\n    m-7228 25 c65 -56 72 -65 72 -99 0 -53 -33 -60 -77 -17 -18 18 -33 37 -33 43\n    0 7 -11 18 -25 25 -32 17 -106 96 -98 104 4 3 25 6 48 6 36 0 50 -8 113 -62z\n    m2945 21 c40 -22 78 -46 86 -54 14 -14 7 -55 -11 -55 -5 0 -45 21 -89 47 -58\n    35 -79 53 -79 69 0 19 8 34 17 34 2 0 36 -18 76 -41z m-3118 -10 c25 -23 42\n    -45 39 -50 -3 -5 -22 -9 -43 -9 -30 0 -44 8 -80 44 -45 46 -43 54 12 55 19 1\n    41 -12 72 -40z m3405 -36 c63 -36 123 -72 133 -81 19 -17 23 -72 5 -72 -7 0\n    -76 37 -155 82 -127 73 -143 85 -143 109 0 53 2 52 160 -38z m2860 -362 c201\n    -184 372 -342 381 -350 9 -9 115 -108 237 -220 l222 -204 0 -63 c0 -35 -4 -64\n    -8 -64 -4 0 -127 111 -272 246 -506 471 -600 559 -745 695 -38 36 -120 112\n    -182 169 -62 56 -113 109 -115 118 -2 8 -1 37 0 64 l4 48 57 -52 c31 -29 221\n    -203 421 -387z m-6402 386 c23 -24 39 -46 36 -50 -4 -4 -25 -7 -47 -7 -33 0\n    -46 7 -81 42 l-41 42 25 7 c49 14 66 9 108 -34z m1178 -19 c25 -14 29 -23 32\n    -67 2 -29 -1 -51 -7 -51 -5 0 -35 23 -66 51 -51 47 -55 55 -49 83 10 48 15 51\n    39 25 12 -13 34 -32 51 -41z m3109 36 c34 -19 47 -35 54 -62 6 -20 8 -38 5\n    -41 -3 -3 -29 8 -59 23 -51 28 -65 47 -65 89 0 23 14 22 65 -9z m-4451 -25\n    c13 -31 20 -39 28 -31 8 8 15 9 25 1 23 -20 14 -29 -26 -29 -31 0 -48 8 -80\n    37 -47 42 -50 50 -18 56 50 10 55 7 71 -34z m3249 22 c27 -14 32 -26 21 -55\n    -8 -21 -23 -20 -53 3 -19 14 -22 24 -17 45 4 15 10 26 14 24 4 -2 19 -10 35\n    -17z m-3349 -32 c25 -22 44 -44 42 -48 -3 -4 -20 -8 -38 -9 -27 -2 -43 6 -81\n    41 -26 24 -45 46 -41 50 4 4 22 7 39 7 23 0 45 -11 79 -41z m736 -20 c0 -44\n    -3 -59 -12 -56 -19 6 -12 117 7 117 3 0 5 -27 5 -61z m-852 6 l47 -45 -39 0\n    c-30 0 -49 8 -82 36 -24 19 -44 40 -44 45 0 5 16 9 36 9 28 0 45 -9 82 -45z\n    m2767 -103 c121 -68 280 -158 353 -199 134 -76 147 -89 120 -126 -12 -15 -28\n    -8 -173 71 -316 175 -540 304 -552 320 -7 9 -13 31 -13 49 0 32 1 33 23 22 12\n    -7 121 -68 242 -137z m-2883 101 c21 -20 38 -41 38 -45 0 -4 -16 -8 -35 -8\n    -39 0 -75 28 -75 58 0 44 24 42 72 -5z m2518 -18 c64 -38 80 -51 85 -76 4 -17\n    5 -33 2 -36 -5 -5 -117 54 -149 79 -16 13 -36 78 -23 78 3 0 41 -20 85 -45z\n    m2146 16 c22 -13 33 -29 36 -50 5 -36 -3 -38 -48 -10 -26 16 -34 27 -34 50 0\n    34 5 35 46 10z m3173 -38 l62 -58 -3 -69 -3 -69 -67 57 -68 57 0 70 c0 38 4\n    69 9 69 4 0 36 -26 70 -57z m-6289 -8 c0 -38 -10 -44 -34 -19 -18 17 -18 20\n    -10 51 10 37 44 11 44 -32z m2191 3 c78 -46 89 -55 89 -80 0 -16 -5 -28 -12\n    -28 -17 0 -161 85 -177 104 -11 13 -7 56 5 56 3 0 46 -23 95 -52z m-2292 -12\n    c18 -19 31 -41 29 -48 -3 -7 -2 -22 3 -33 7 -17 8 -16 8 8 1 32 11 34 36 7 14\n    -16 16 -29 11 -67 -4 -33 -3 -43 4 -33 5 8 10 25 10 37 0 12 3 24 8 26 4 3 35\n    -17 70 -45 l62 -50 0 -59 c0 -32 -4 -59 -8 -59 -11 0 -37 30 -45 53 -4 9 -14\n    17 -24 17 -10 0 -69 41 -130 91 -113 90 -113 90 -113 134 0 85 14 89 79 21z\n    m2546 -27 c173 -95 185 -104 185 -140 0 -24 -4 -30 -15 -25 -44 17 -294 168\n    -299 181 -6 16 2 45 13 45 3 0 56 -27 116 -61z m-435 33 c18 -15 22 -25 16\n    -45 -6 -27 -7 -27 -36 -12 -36 19 -43 30 -35 55 8 25 26 25 55 2z m-1787 -7\n    c16 -12 18 -21 10 -67 l-8 -53 -23 23 c-13 13 -21 30 -18 39 3 8 6 28 6 44 0\n    32 6 35 33 14z m3091 -68 c15 -58 10 -61 -51 -26 -67 38 -73 44 -73 82 l0 28\n    59 -31 c36 -20 61 -40 65 -53z m-4081 22 l52 -50 -55 6 c-43 5 -61 13 -82 36\n    -40 42 -38 47 25 58 5 0 32 -22 60 -50z m860 4 c50 -41 58 -51 55 -78 -2 -16\n    -8 -30 -14 -30 -7 0 -37 23 -67 50 -47 43 -54 55 -50 78 3 15 8 27 12 27 3 0\n    32 -21 64 -47z m-1093 18 c0 -12 -54 -19 -250 -30 -293 -17 -396 -20 -374 -11\n    53 21 624 59 624 41z m410 -75 c0 -34 -3 -66 -7 -69 -13 -13 -32 15 -28 41 2\n    15 7 44 10 65 9 57 25 34 25 -37z m2812 -14 c39 -22 48 -32 48 -54 0 -15 -4\n    -29 -9 -32 -7 -5 -211 109 -211 119 0 2 4 15 10 30 l10 26 52 -31 c29 -17 74\n    -43 100 -58z m-1227 30 c65 -39 82 -54 91 -82 7 -19 8 -36 3 -38 -9 -4 -128\n    61 -159 86 -20 17 -40 82 -24 82 5 -1 45 -22 89 -48z m279 -49 c496 -281 511\n    -290 508 -314 -1 -13 -6 -27 -10 -31 -7 -7 -417 219 -507 280 -22 14 -60 36\n    -85 48 -25 12 -52 28 -62 35 -17 15 -35 79 -22 79 4 0 84 -44 178 -97z m1616\n    -33 c166 -97 180 -107 180 -133 1 -20 2 -20 11 -5 9 16 13 17 39 3 43 -22 60\n    -44 60 -76 0 -16 -2 -29 -4 -29 -4 0 -454 256 -498 284 -12 7 -18 23 -18 49\n    l0 39 53 -30 c28 -15 108 -62 177 -102z m236 109 c24 -14 35 -30 40 -55 3 -19\n    4 -37 1 -40 -11 -11 -88 40 -92 61 -6 31 -3 55 8 55 5 0 25 -9 43 -21z m1775\n    -2 c24 -21 470 -435 659 -612 47 -44 110 -103 140 -130 30 -28 155 -144 278\n    -258 l222 -209 0 -54 c0 -31 -4 -54 -10 -54 -6 0 -63 50 -128 112 -64 61 -164\n    157 -222 212 -243 232 -330 315 -410 391 -415 390 -560 529 -561 539 -8 99 -8\n    98 32 63z m1607 -111 l92 -80 0 -74 0 -73 -23 18 c-90 71 -196 166 -201 179\n    -3 9 -6 45 -6 81 l0 64 23 -18 c13 -10 65 -54 115 -97z m-4526 81 c22 -18 25\n    -26 17 -45 -8 -22 -10 -22 -38 -7 -37 19 -44 30 -36 55 8 26 24 25 57 -3z\n    m493 -65 c129 -76 150 -92 153 -115 2 -15 -2 -27 -8 -27 -6 0 -80 39 -165 88\n    -141 79 -155 89 -155 115 0 15 6 27 13 27 6 0 80 -40 162 -88z m-2933 -93 c3\n    -85 9 -183 13 -218 5 -51 4 -62 -7 -59 -31 11 -38 52 -38 246 0 151 3 193 13\n    190 8 -3 14 -49 19 -159z m4737 -502 l44 -47 -3 -88 c-3 -116 -13 -187 -25\n    -187 -6 0 -82 74 -169 165 -88 91 -230 237 -317 325 l-157 160 -6 100 c-4 55\n    -9 129 -12 165 l-6 65 304 -305 c167 -168 323 -326 347 -353z m-4334 543 c50\n    -40 96 -80 103 -88 13 -17 17 -102 5 -102 -10 0 -180 125 -215 158 -23 21 -28\n    34 -28 72 0 54 7 65 29 47 9 -8 57 -47 106 -87z m3325 68 c33 -19 61 -42 64\n    -53 8 -27 7 -65 0 -65 -17 0 -115 64 -124 80 -11 20 -14 70 -4 70 3 0 32 -15\n    64 -32z m-3055 -12 c10 -15 14 -33 9 -50 -5 -21 -9 -24 -25 -15 -14 7 -19 21\n    -19 49 0 45 12 51 35 16z m1935 -33 c98 -56 119 -78 103 -107 -7 -12 -28 -4\n    -113 45 -58 33 -108 64 -112 67 -10 9 2 52 13 52 5 0 54 -26 109 -57z m4125\n    17 c79 -64 85 -75 85 -141 0 -32 -3 -59 -6 -59 -8 0 -89 65 -121 97 -19 18\n    -23 33 -23 83 0 33 3 60 8 60 4 0 30 -18 57 -40z m-6994 -64 c114 -106 132\n    -128 127 -158 -3 -18 -20 -7 -130 86 -110 93 -128 112 -128 137 0 19 5 29 15\n    29 8 0 60 -42 116 -94z m84 58 c30 -19 50 -80 38 -111 l-8 -23 -25 23 c-14 13\n    -47 46 -75 75 l-49 52 47 0 c27 0 58 -7 72 -16z m2584 -1 c33 -19 39 -39 19\n    -66 -12 -15 -15 -15 -45 4 -33 21 -38 34 -27 63 8 20 15 20 53 -1z m534 -90\n    c144 -83 147 -85 147 -119 0 -19 -3 -34 -6 -34 -9 0 -318 181 -333 195 -9 8\n    -11 23 -7 39 8 31 -12 39 199 -81z m459 -52 c236 -135 238 -136 238 -170 0\n    -26 -3 -32 -16 -27 -14 5 -428 244 -483 278 -14 9 -21 23 -21 46 0 40 -31 53\n    282 -127z m-1913 98 c64 -36 92 -58 101 -79 7 -16 10 -33 9 -39 -5 -11 -167\n    83 -191 111 -17 18 -25 58 -13 58 3 0 45 -23 94 -51z m141 31 c42 -21 65 -53\n    56 -76 -14 -36 -80 8 -95 64 -5 17 -7 32 -5 32 3 0 22 -9 44 -20z m1966 -1\n    c19 -11 34 -26 35 -32 0 -7 2 -24 3 -39 2 -34 -4 -35 -54 -3 -34 22 -40 30\n    -40 60 0 40 10 43 56 14z m2090 -329 c181 -174 408 -390 504 -480 96 -90 211\n    -199 255 -240 44 -42 110 -104 146 -139 57 -53 68 -69 73 -106 4 -23 4 -55 0\n    -69 l-6 -26 -32 26 c-17 14 -69 63 -116 108 -76 73 -297 283 -820 776 -90 85\n    -209 198 -264 251 l-99 95 -3 60 c-2 66 1 78 20 67 8 -5 162 -150 342 -323z\n    m-3085 232 c63 -37 152 -90 199 -116 263 -150 290 -168 290 -198 0 -15 -5 -28\n    -10 -28 -8 0 -282 153 -566 315 -22 13 -45 30 -51 37 -12 14 0 58 15 58 5 0\n    61 -31 123 -68z m-1915 -44 c5 -47 4 -58 -8 -58 -28 0 -38 24 -38 89 0 65 0\n    65 20 46 12 -13 22 -41 26 -77z m1304 -63 c113 -64 210 -122 217 -129 14 -13\n    6 -56 -11 -56 -6 0 -107 55 -225 122 -214 123 -251 153 -251 201 0 18 2 18 33\n    -1 17 -11 124 -73 237 -137z m1768 112 c48 -29 52 -34 52 -69 0 -21 -3 -38 -7\n    -38 -12 0 -118 62 -125 74 -4 6 -8 26 -8 45 0 39 5 38 88 -12z m-3981 -100\n    c67 -58 92 -86 97 -109 16 -79 10 -76 -124 57 -106 105 -130 135 -130 158 l0\n    28 33 -28 c19 -15 74 -63 124 -106z m2604 106 c29 -18 34 -29 23 -57 -5 -14\n    -11 -13 -45 4 -40 21 -43 27 -33 54 8 20 19 20 55 -1z m-1845 -242 c6 -33 10\n    -61 8 -61 -2 0 -59 41 -126 92 -68 50 -125 93 -127 95 -7 5 -20 106 -15 115 3\n    4 60 -34 127 -85 l122 -94 11 -62z m2343 177 c182 -103 211 -124 211 -153 0\n    -14 -5 -25 -11 -25 -7 0 -87 44 -180 98 -154 88 -169 99 -169 125 0 15 5 27\n    11 27 7 0 68 -32 138 -72z m503 -76 c223 -130 253 -151 256 -175 2 -15 -1 -27\n    -7 -27 -5 0 -121 65 -258 143 -235 136 -248 145 -251 175 -2 18 -1 32 1 32 3\n    0 119 -67 259 -148z m3572 57 l106 -91 0 -64 c0 -35 -2 -64 -5 -64 -7 0 -175\n    142 -198 167 -20 23 -36 143 -19 143 6 0 58 -41 116 -91z m-5420 11 c70 -40\n    100 -63 111 -87 26 -54 17 -57 -27 -8 -34 38 -43 44 -50 30 -8 -14 -15 -12\n    -58 11 -59 32 -76 50 -86 88 -8 35 -11 36 110 -34z m147 19 c27 -13 45 -32 55\n    -56 8 -19 13 -37 10 -40 -2 -3 -25 7 -49 22 -30 17 -49 37 -56 57 -17 47 -17\n    47 40 17z m5078 -47 c42 -37 118 -103 170 -147 140 -119 131 -106 131 -178 0\n    -35 -3 -66 -6 -70 -4 -3 -60 42 -126 101 -66 59 -146 128 -178 155 -32 26 -63\n    60 -69 75 -11 26 -13 132 -3 132 3 0 39 -30 81 -68z m-3987 -120 c277 -158\n    313 -182 316 -205 4 -34 -5 -34 -76 2 -113 58 -577 330 -580 341 -5 15 5 40\n    17 40 5 0 151 -80 323 -178z m-2188 145 c20 -15 36 -117 19 -117 -21 0 -46 41\n    -50 85 -6 47 1 54 31 32z m1772 -16 c26 -16 31 -24 27 -45 -7 -37 -19 -40 -58\n    -16 -38 23 -38 24 -29 58 8 27 20 28 60 3z m1417 -48 c29 -18 37 -29 37 -53 0\n    -38 -12 -38 -80 3 -49 30 -55 37 -58 71 l-3 37 33 -17 c18 -9 50 -28 71 -41z\n    m-4003 -75 c111 -105 114 -109 121 -160 3 -29 6 -54 5 -55 -1 -1 -61 56 -134\n    127 -127 124 -132 130 -132 170 0 52 -2 53 140 -82z m3616 -31 l249 -143 3\n    -37 c2 -20 0 -37 -3 -37 -7 0 -416 237 -477 276 -30 19 -38 31 -38 54 0 17 4\n    30 9 30 5 0 121 -64 257 -143z m2224 -116 c197 -188 337 -321 793 -753 138\n    -131 254 -243 258 -250 12 -22 15 -143 4 -145 -10 -1 -170 150 -765 723 -69\n    66 -172 165 -230 220 -58 54 -160 153 -227 220 l-123 121 0 55 c0 30 3 58 6\n    61 9 8 43 -22 284 -252z m-3624 135 c109 -63 200 -121 202 -128 1 -7 -3 -21\n    -10 -30 -12 -15 -30 -6 -179 80 -91 54 -178 106 -192 117 -26 20 -48 75 -30\n    75 5 0 99 -51 209 -114z m771 -91 c310 -176 332 -190 336 -219 3 -17 2 -34 -2\n    -38 -8 -9 -221 109 -221 122 0 6 -8 10 -17 10 -9 0 -115 55 -235 122 -180 101\n    -218 127 -218 145 0 27 10 54 19 50 3 -2 155 -88 338 -192z m-2082 165 c19\n    -21 34 -110 18 -110 -20 0 -41 36 -48 83 -8 51 1 59 30 27z m876 -36 c44 -25\n    99 -69 124 -97 43 -47 71 -87 62 -87 -6 0 -198 112 -224 131 -19 13 -53 74\n    -53 94 0 11 15 4 91 -41z m-1135 -60 c62 -47 120 -94 129 -104 16 -17 49 -134\n    43 -152 -3 -8 -36 14 -204 139 -72 53 -72 53 -83 116 -13 74 -13 87 -4 87 3 0\n    57 -39 119 -86z m1377 1 c10 -21 16 -40 13 -42 -12 -12 -95 49 -110 81 -9 19\n    -16 37 -16 40 0 4 21 -5 48 -18 33 -17 53 -35 65 -61z m526 55 c33 -16 38 -23\n    34 -45 -7 -36 -19 -39 -58 -15 -35 22 -40 34 -29 64 8 20 7 20 53 -4z m1416\n    -39 c63 -36 76 -51 68 -79 -7 -29 -15 -28 -79 10 -48 29 -54 36 -54 65 0 18 3\n    33 8 33 4 0 30 -13 57 -29z m823 -429 c156 -163 192 -206 192 -229 0 -37 -29\n    -196 -39 -211 -7 -12 -195 172 -447 438 -186 197 -177 183 -170 253 3 34 9 96\n    12 137 l7 74 126 -130 c69 -72 213 -221 319 -332z m-1168 298 c135 -79 273\n    -159 308 -179 57 -32 62 -38 57 -61 -4 -14 -8 -26 -10 -28 -3 -3 -435 245\n    -500 287 -22 14 -58 35 -80 47 -33 17 -41 26 -43 54 -3 24 0 31 10 28 7 -3\n    123 -70 258 -148z m-3550 -45 l45 -48 -40 7 c-22 3 -53 6 -68 6 -21 0 -44 15\n    -88 58 -55 54 -59 62 -59 104 0 24 3 48 6 51 7 7 129 -100 204 -178z m763 170\n    c16 -15 34 -112 23 -123 -15 -15 -47 37 -53 86 -6 54 2 65 30 37z m1953 -85\n    c196 -110 262 -149 269 -160 9 -14 -13 -50 -30 -50 -8 0 -65 31 -127 68 -62\n    38 -155 90 -205 117 -81 43 -93 53 -93 76 0 31 9 42 29 34 8 -3 78 -41 157\n    -85z m4297 -52 c229 -203 207 -175 207 -258 0 -41 -4 -70 -9 -68 -11 4 -229\n    195 -313 275 l-58 55 0 69 c0 38 3 69 6 69 3 0 78 -64 167 -142z m-4848 28\n    c145 -85 157 -94 149 -119 -4 -12 -8 -24 -10 -26 -5 -6 -279 157 -297 177 -8\n    9 -19 30 -23 46 l-7 29 44 -25 c24 -13 89 -50 144 -82z m293 54 c34 -21 35\n    -23 26 -57 l-6 -22 -44 22 c-32 15 -44 27 -44 42 0 41 19 45 68 15z m-2234\n    -185 c19 -82 52 -201 75 -262 22 -62 37 -113 33 -113 -13 0 -117 122 -130 152\n    -12 28 -62 345 -62 396 l0 27 25 -25 c19 -20 32 -57 59 -175z m655 126 c5 -20\n    12 -51 16 -69 6 -31 5 -33 -12 -24 -36 20 -52 49 -59 106 l-7 58 26 -17 c16\n    -10 31 -32 36 -54z m858 31 c27 -16 81 -48 121 -72 54 -32 78 -53 93 -81 12\n    -25 15 -39 8 -39 -7 0 -64 30 -127 67 -108 64 -152 104 -152 141 0 17 3 16 57\n    -16z m4113 -312 c129 -124 304 -292 389 -375 241 -233 408 -393 509 -490 l92\n    -88 0 -74 c0 -40 -3 -73 -7 -73 -5 0 -68 58 -140 128 -130 124 -133 128 -135\n    172 -1 38 -2 40 -5 12 -3 -18 -8 -32 -13 -30 -10 3 -244 224 -475 447 -185\n    178 -482 461 -534 508 -43 39 -45 43 -49 107 -2 36 -1 73 2 82 7 19 -2 27 366\n    -326z m-3837 254 c10 -13 24 -21 32 -18 18 7 244 -127 245 -144 0 -7 -4 -22\n    -10 -32 -9 -17 -23 -11 -167 72 -87 50 -163 95 -169 102 -6 6 -14 28 -17 49\n    l-6 38 37 -22 c20 -12 45 -32 55 -45z m1879 35 c29 -17 56 -36 59 -41 6 -10 0\n    -48 -7 -48 -3 0 -29 14 -59 31 -52 29 -73 57 -60 79 8 14 7 14 67 -21z m-567\n    5 c17 -11 25 -26 25 -45 0 -34 -1 -34 -40 -14 -23 12 -30 22 -30 45 0 34 10\n    37 45 14z m-596 -112 c113 -64 206 -121 207 -127 2 -5 -3 -18 -10 -28 -13 -16\n    -28 -9 -220 100 -167 95 -206 121 -206 138 0 21 8 35 19 35 3 0 98 -53 210\n    -118z m-308 66 c28 -16 39 -28 39 -45 0 -33 -21 -37 -64 -13 -34 21 -48 55\n    -29 73 9 10 11 9 54 -15z m-1779 -96 c70 -52 130 -102 133 -113 3 -10 12 -16\n    19 -13 24 9 59 -32 82 -96 13 -36 21 -66 19 -68 -2 -2 -85 59 -186 135 -185\n    140 -197 154 -214 232 -9 41 -19 46 147 -77z m2993 -37 c116 -67 220 -128 233\n    -136 21 -13 30 -53 14 -62 -4 -3 -81 38 -172 90 -91 52 -202 115 -247 140 -79\n    43 -83 46 -83 79 0 41 -31 55 255 -111z m-3805 110 c13 -14 22 -26 19 -28 -2\n    -2 -16 -8 -31 -15 -28 -12 -28 -11 -28 28 0 46 8 49 40 15z m954 -4 c17 -19\n    50 -135 43 -155 -8 -25 -54 42 -61 90 -4 27 -9 57 -12 67 -7 23 9 22 30 -2z\n    m3106 -30 c45 -27 58 -53 41 -81 -8 -12 -17 -10 -58 12 -42 23 -48 31 -51 62\n    -4 44 6 45 68 7z m-1162 -118 c89 -52 162 -100 162 -107 0 -7 -6 -20 -13 -31\n    -13 -17 -25 -11 -193 88 -228 135 -219 127 -210 160 l6 27 43 -21 c23 -12 115\n    -64 205 -116z m-827 34 c54 -31 106 -69 118 -84 11 -15 21 -22 21 -15 0 14 49\n    -9 136 -64 46 -30 54 -39 48 -57 -3 -12 -10 -26 -14 -31 -5 -5 -99 45 -212\n    111 -191 112 -205 122 -230 169 -36 63 -35 70 5 46 17 -10 75 -44 128 -75z\n    m1424 81 c18 -8 25 -19 25 -40 0 -33 -1 -33 -40 -13 -21 11 -30 23 -30 40 0\n    28 8 30 45 13z m3652 -98 c65 -58 146 -132 181 -164 l62 -59 0 -79 c0 -43 -4\n    -78 -9 -78 -14 0 -91 88 -91 104 0 10 -6 13 -15 10 -16 -6 -47 19 -187 153\n    l-78 74 0 75 c0 42 4 74 9 72 5 -1 62 -50 128 -108z m-6084 52 c23 -24 83\n    -169 74 -179 -2 -2 -22 10 -45 27 -41 30 -54 56 -68 143 -8 44 3 47 39 9z\n    m1161 -14 c126 -74 171 -101 187 -115 19 -16 14 -53 -6 -53 -7 0 -59 26 -116\n    59 -82 46 -109 67 -126 97 -39 67 -34 68 61 12z m347 18 c30 -20 36 -30 32\n    -50 -3 -15 -8 -26 -12 -26 -4 0 -28 14 -54 30 -42 26 -46 32 -37 50 14 26 28\n    25 71 -4z m1035 -22 c36 -21 44 -31 44 -55 0 -16 -2 -29 -4 -29 -2 0 -24 12\n    -50 26 -38 21 -46 31 -46 55 0 16 3 29 6 29 3 0 25 -12 50 -26z m-3496 -4 c11\n    -11 20 -24 20 -29 0 -5 9 -13 21 -16 18 -6 20 -12 14 -43 -4 -21 -10 -41 -14\n    -45 -8 -8 -141 127 -141 143 0 19 79 11 100 -10z m3190 -45 c117 -65 130 -77\n    130 -117 0 -16 -5 -28 -12 -28 -7 1 -69 34 -138 74 -98 58 -124 78 -122 92 5\n    23 22 45 31 40 3 -2 53 -29 111 -61z m2396 24 c19 -22 269 -261 644 -619 113\n    -107 245 -233 293 -280 l88 -85 -3 -72 -3 -71 -70 65 c-38 36 -230 222 -425\n    412 -195 190 -397 386 -448 436 -111 107 -122 124 -115 188 6 53 12 56 39 26z\n    m-2941 -58 c55 -32 132 -77 172 -100 40 -23 75 -46 78 -51 12 -19 -6 -52 -25\n    -47 -14 3 -349 197 -369 213 -2 2 0 15 3 29 8 33 9 32 141 -44z m2028 -316\n    c268 -283 255 -257 210 -390 l-26 -79 -131 135 c-228 236 -442 463 -458 487\n    -12 17 -14 31 -8 50 5 15 16 63 26 106 l17 79 66 -69 c36 -38 173 -181 304\n    -319z m-1288 359 c19 -12 25 -25 25 -50 0 -39 -1 -39 -40 -19 -25 13 -30 22\n    -30 50 0 39 9 43 45 19z m-3419 -93 c-10 -16 -48 -14 -74 5 -22 15 -31 71 -15\n    88 10 10 97 -80 89 -93z m2481 53 c17 -13 35 -24 38 -24 6 0 363 -206 374\n    -216 6 -6 -17 -54 -26 -54 -9 0 -463 267 -476 279 -4 4 -3 20 4 34 13 29 24\n    27 86 -19z m1325 -78 c75 -43 142 -83 147 -90 8 -9 7 -18 -2 -30 -13 -17 -19\n    -15 -98 30 -253 144 -244 138 -247 174 l-3 33 33 -20 c18 -10 95 -54 170 -97z\n    m-4262 94 c0 -6 -42 -9 -107 -9 -78 1 -97 4 -68 9 63 11 175 11 175 0z m627\n    -27 c-3 -10 -5 -4 -5 12 0 17 2 24 5 18 2 -7 2 -21 0 -30z m538 -5 c29 -24\n    114 -90 189 -146 108 -83 141 -114 162 -153 29 -52 41 -60 25 -15 -6 14 -8 26\n    -5 26 3 0 41 -27 84 -60 49 -37 95 -83 119 -118 21 -31 78 -101 125 -154 48\n    -54 84 -98 81 -98 -11 0 -247 185 -264 207 -11 12 -27 23 -37 23 -11 0 -121\n    76 -245 169 l-225 169 -32 70 c-35 79 -48 122 -37 122 5 0 31 -19 60 -42z\n    m2502 -66 c128 -73 138 -81 141 -110 2 -18 -1 -32 -6 -32 -8 0 -300 165 -310\n    175 -9 8 11 45 23 45 8 0 76 -35 152 -78z m323 57 c43 -26 50 -36 50 -71 0\n    -33 -1 -33 -43 -12 -50 25 -67 45 -67 76 0 34 13 35 60 7z m-3812 -9 c-17 -10\n    -376 -30 -503 -29 l-70 1 62 9 c162 24 543 37 511 19z m2417 -110 c181 -106\n    168 -99 395 -230 107 -61 201 -117 208 -122 16 -13 15 -30 -2 -53 -13 -18 -26\n    -11 -230 111 -119 71 -236 140 -259 153 -118 66 -234 136 -251 150 -22 19 -66\n    86 -66 102 0 6 14 2 33 -9 17 -11 95 -57 172 -102z m-2250 90 c3 -5 2 -10 -4\n    -10 -5 0 -13 5 -16 10 -3 6 -2 10 4 10 5 0 13 -4 16 -10z m315 -87 c9 -37 15\n    -70 13 -72 -2 -3 -17 8 -33 24 -25 24 -30 37 -30 75 0 88 25 74 50 -27z m2250\n    44 c272 -156 381 -221 389 -231 8 -9 6 -18 -4 -32 -14 -19 -16 -18 -67 10 -88\n    47 -408 238 -413 246 -5 9 6 50 14 50 4 0 40 -19 81 -43z m4605 -62 c60 -55\n    114 -106 122 -113 13 -14 19 -142 6 -142 -3 0 -34 26 -67 57 -34 31 -88 82\n    -121 112 l-59 56 -4 69 c-3 43 -1 67 6 65 5 -2 58 -49 117 -104z m-3634 74\n    c22 -16 29 -28 29 -55 0 -40 -4 -41 -47 -14 -27 16 -33 26 -33 55 0 40 10 43\n    51 14z m344 -72 c77 -45 141 -89 143 -97 1 -9 -3 -23 -10 -32 -12 -16 -25 -11\n    -151 58 -105 58 -139 82 -143 100 -7 26 1 55 13 53 4 0 71 -37 148 -82z\n    m-3705 17 c0 -24 -4 -44 -10 -44 -12 0 -21 38 -16 65 3 11 5 24 5 28 1 5 6 5\n    11 2 6 -3 10 -26 10 -51z m3118 -35 c86 -50 161 -94 165 -98 5 -5 7 -25 5 -45\n    l-3 -36 -170 100 c-93 55 -176 104 -183 108 -15 10 0 62 18 62 7 0 82 -41 168\n    -91z m-3188 71 c0 -5 -2 -10 -4 -10 -3 0 -8 5 -11 10 -3 6 -1 10 4 10 6 0 11\n    -4 11 -10z m1063 -25 c35 -27 56 -54 83 -111 20 -41 34 -77 32 -79 -7 -8 -135\n    93 -141 111 -3 11 -12 40 -21 67 -8 26 -11 47 -7 47 4 0 29 -16 54 -35z\n    m-1055 -44 c53 -59 62 -75 62 -107 l0 -38 -40 39 c-22 21 -40 47 -40 57 0 10\n    -7 18 -15 18 -23 0 -97 83 -82 92 30 19 55 6 115 -61z m6052 -381 c200 -195\n    417 -407 482 -470 l118 -115 0 -79 0 -79 -82 78 c-82 78 -376 366 -756 740\n    -254 249 -242 234 -242 304 0 32 3 61 7 64 8 9 39 -20 473 -443z m-6187 400\n    l42 -39 -44 -1 c-35 0 -51 6 -73 27 -40 38 -38 41 25 52 4 0 27 -17 50 -39z\n    m-132 2 c36 -32 32 -52 -10 -52 -27 0 -81 47 -81 70 0 22 60 10 91 -18z m3792\n    12 c52 -26 67 -45 67 -81 0 -18 -2 -33 -5 -33 -12 0 -84 40 -99 55 -18 18 -22\n    75 -6 75 6 0 25 -7 43 -16z m-3899 -26 c27 -35 26 -48 -5 -48 -25 0 -59 34\n    -59 60 0 31 35 24 64 -12z m-128 14 c6 -4 17 -18 24 -31 15 -28 -3 -46 -31\n    -30 -19 10 -49 48 -49 61 0 10 41 10 56 0z m3076 -124 c137 -80 227 -139 227\n    -148 0 -8 -5 -23 -13 -32 -15 -21 0 -28 -267 129 -137 80 -199 122 -199 134 0\n    21 10 49 18 49 3 0 108 -60 234 -132z m-3150 95 c36 -35 35 -43 -5 -43 -23 0\n    -41 8 -60 28 -35 36 -34 42 5 42 21 0 41 -9 60 -27z m-109 -11 c33 -34 34 -42\n    4 -42 -21 0 -77 46 -77 63 0 18 49 4 73 -21z m-86 -4 c30 -28 29 -38 -4 -38\n    -31 0 -40 5 -67 38 l-19 22 33 0 c21 0 43 -8 57 -22z m3933 -89 c118 -69 194\n    -119 199 -132 5 -13 10 -16 15 -9 4 7 58 -19 154 -74 81 -47 151 -89 155 -93\n    11 -11 -2 -39 -22 -46 -11 -3 -67 25 -152 76 -74 45 -152 91 -174 103 -164 92\n    -285 166 -285 177 0 5 -7 9 -16 9 -21 0 -94 41 -94 52 0 11 19 48 25 48 2 0\n    90 -50 195 -111z m261 78 c37 -24 54 -77 25 -77 -26 0 -76 50 -76 76 0 30 8\n    30 51 1z m-3204 -47 c14 -17 29 -64 38 -125 l6 -40 -55 58 c-54 56 -56 60 -56\n    114 l0 56 27 -24 c15 -13 33 -31 40 -39z m3529 -11 c68 -39 124 -72 124 -74 0\n    -18 -26 -55 -39 -55 -9 0 -61 26 -116 58 -100 58 -100 58 -103 100 -2 23 0 42\n    4 42 4 0 62 -32 130 -71z m-4606 46 c10 -12 10 -15 -4 -15 -9 0 -16 7 -16 15\n    0 8 2 15 4 15 2 0 9 -7 16 -15z m1371 -220 c122 -230 237 -391 402 -561 130\n    -136 228 -218 382 -320 114 -75 167 -126 365 -344 137 -151 285 -312 443 -482\n    68 -73 117 -134 114 -141 -3 -7 -46 -31 -96 -52 l-92 -38 -30 29 c-61 58 -267\n    273 -429 449 -36 38 -95 101 -131 140 -36 38 -124 133 -195 210 -70 77 -185\n    201 -254 275 -69 75 -177 191 -240 260 -63 68 -179 191 -258 274 l-142 151 5\n    50 c3 33 -3 90 -20 170 -39 185 -39 185 60 80 46 -49 99 -117 116 -150z m3884\n    116 c50 -53 177 -187 283 -299 105 -112 192 -209 192 -216 0 -17 -69 -189 -81\n    -201 -6 -6 -23 5 -47 32 -20 22 -149 161 -287 308 -137 147 -251 273 -253 280\n    -3 11 33 122 63 197 9 23 21 14 130 -101z m-2060 -55 c393 -234 374 -221 368\n    -246 -4 -14 -11 -19 -21 -15 -20 8 -450 256 -516 299 -55 35 -128 116 -104\n    116 7 0 130 -70 273 -154z m-2346 87 c28 -31 51 -61 51 -65 0 -4 -14 -8 -32\n    -8 -25 0 -43 11 -80 47 -56 55 -62 83 -19 83 23 0 40 -12 80 -57z m928 -70\n    c88 -67 112 -92 173 -181 39 -57 65 -100 58 -96 -65 37 -265 185 -283 209 -29\n    37 -105 167 -105 178 0 10 19 -3 157 -110z m2688 49 c211 -118 224 -129 185\n    -154 -12 -8 -52 11 -160 74 -136 79 -145 86 -148 116 l-3 33 48 -26 c26 -14\n    62 -34 78 -43z m3473 -60 l122 -117 0 -70 0 -69 -52 49 c-29 28 -88 84 -130\n    125 l-78 75 0 62 c0 35 3 63 8 63 4 0 62 -53 130 -118z m-7228 50 c0 -34 -3\n    -43 -10 -32 -13 20 -13 93 0 85 6 -3 10 -27 10 -53z m3123 33 c31 -22 36 -29\n    27 -45 -6 -10 -14 -21 -18 -24 -10 -6 -94 43 -89 52 2 4 7 15 10 25 9 23 26\n    21 70 -8z m-3343 -15 c-38 -8 -312 -22 -295 -14 20 9 162 21 245 22 64 0 76\n    -2 50 -8z m3791 -10 c22 -12 42 -27 46 -35 3 -8 9 -13 14 -10 7 5 251 -125\n    273 -146 12 -10 -20 -59 -38 -59 -8 0 -72 34 -142 76 -213 126 -204 120 -204\n    159 0 19 2 35 5 35 3 0 24 -9 46 -20z m2275 -102 l103 -101 -6 -76 c-3 -42 -7\n    -78 -9 -80 -2 -2 -49 42 -106 97 l-103 101 -3 80 c-3 60 -1 81 8 81 7 0 59\n    -46 116 -102z m1614 -45 c0 -35 -4 -63 -9 -63 -5 0 -25 18 -45 40 -34 38 -36\n    44 -36 107 l0 67 45 -44 c44 -43 45 -46 45 -107z m-4007 -21 c139 -82 267\n    -157 285 -166 35 -18 39 -41 11 -59 -12 -7 -78 27 -287 148 -150 86 -282 165\n    -293 174 -19 15 -20 21 -10 40 7 13 18 20 27 17 7 -3 128 -72 267 -154z\n    m-3377 121 c-7 -7 -26 7 -26 19 0 6 6 6 15 -2 9 -7 13 -15 11 -17z m296 -40\n    c43 -46 78 -99 78 -123 0 -25 -48 -7 -86 33 -78 82 -79 84 -64 112 7 14 16 25\n    20 25 3 0 26 -21 52 -47z m2705 27 c30 -18 32 -22 21 -45 -14 -31 -19 -31 -63\n    -2 -37 24 -42 36 -23 55 16 16 28 15 65 -8z m-2869 -103 l57 -57 -60 0 -59 0\n    -53 58 c-29 31 -53 59 -53 63 0 3 25 2 55 -1 51 -6 61 -11 113 -63z m120 0\n    l54 -54 -28 -6 c-15 -3 -37 -1 -48 3 -22 8 -116 99 -116 112 0 10 52 15 70 7\n    8 -4 39 -32 68 -62z m-267 11 c48 -52 49 -53 24 -56 -32 -4 -52 11 -71 56 -28\n    68 -18 68 47 0z m2571 -99 c265 -153 362 -211 473 -281 53 -33 57 -38 33 -38\n    -46 0 -110 27 -229 96 -63 36 -172 100 -244 141 -144 84 -200 120 -251 165\n    -32 28 -61 68 -50 68 2 0 123 -68 268 -151z m603 99 c49 -28 122 -70 160 -93\n    39 -23 125 -75 193 -114 l123 -72 -25 -20 c-14 -11 -29 -18 -33 -16 -111 59\n    -536 314 -540 324 -7 18 4 43 19 43 7 0 53 -23 103 -52z m-4387 -105 c-98\n    -188 -167 -298 -262 -417 -103 -129 -328 -359 -431 -443 -80 -65 -172 -119\n    -183 -109 -3 3 -3 8 -1 9 2 2 58 45 124 95 134 101 363 328 467 462 70 91 193\n    277 248 375 44 79 99 165 104 165 3 0 -27 -62 -66 -137z m4176 116 c40 -23 44\n    -34 20 -60 -15 -17 -18 -17 -50 -2 -36 17 -41 31 -24 64 13 23 11 24 54 -2z\n    m-3012 -103 c14 -9 52 -19 87 -22 l62 -7 108 -116 c235 -253 572 -621 720\n    -785 35 -39 91 -100 125 -136 34 -36 212 -229 395 -430 184 -201 350 -382 369\n    -402 l35 -37 -45 -22 -45 -22 -95 32 c-111 37 -86 14 -413 381 -115 129 -215\n    241 -222 248 -11 11 -249 276 -937 1042 -239 266 -247 276 -241 309 4 18 11\n    45 17 60 10 26 10 26 33 -26 13 -28 34 -58 47 -67z m7216 -3 l120 -113 4 -56\n    c1 -31 -1 -58 -5 -61 -7 -4 -75 57 -209 188 -46 45 -48 49 -48 104 0 31 4 55\n    9 53 5 -1 63 -54 129 -115z m-2613 -204 c99 -106 208 -223 243 -260 l63 -68\n    -46 -92 c-45 -89 -47 -91 -64 -73 -515 551 -566 606 -569 614 -3 9 63 146 81\n    168 8 11 21 2 61 -41 28 -30 132 -141 231 -248z m-3247 184 c25 -18 102 -90\n    171 -161 141 -144 152 -153 265 -229 89 -59 194 -113 331 -171 91 -39 205\n    -106 205 -121 0 -8 -33 -4 -148 20 -60 12 -183 91 -549 353 -218 155 -224 160\n    -318 277 -52 65 -95 121 -95 124 0 3 21 -9 46 -27 25 -18 67 -47 92 -65z\n    m1795 46 c205 -118 457 -272 457 -279 0 -5 -14 -13 -31 -19 -30 -10 -43 -4\n    -276 130 -135 78 -247 148 -250 155 -5 12 13 54 23 54 3 0 38 -19 77 -41z\n    m4295 -122 l-3 -67 -37 36 c-37 34 -38 37 -38 107 l0 72 40 -41 c41 -40 41\n    -41 38 -107z m-4484 112 c20 -12 36 -23 36 -25 0 -12 -25 -54 -33 -54 -13 0\n    -67 33 -67 42 0 9 22 58 26 58 2 0 19 -9 38 -21z m2939 -161 c23 -24 27 -36\n    27 -85 0 -31 -2 -54 -5 -52 -2 2 -52 51 -110 109 -102 101 -106 106 -104 145\n    1 22 4 44 7 48 3 7 88 -69 185 -165z m442 -209 c121 -119 271 -265 334 -326\n    l114 -110 5 -89 5 -89 -64 60 c-35 33 -227 219 -426 414 l-363 355 0 85 0 86\n    88 -86 c48 -46 186 -182 307 -300z m-5085 252 c58 -41 143 -114 190 -162 117\n    -119 222 -201 237 -185 6 5 -27 39 -71 74 -16 12 -27 24 -25 27 3 2 103 -61\n    223 -141 120 -80 216 -147 213 -150 -9 -9 -153 49 -268 107 -207 105 -400 248\n    -549 407 -51 53 -96 106 -102 117 -11 19 -11 19 18 1 16 -10 76 -53 134 -95z\n    m-802 57 c9 -8 67 -68 127 -134 61 -65 175 -189 255 -274 132 -141 357 -384\n    670 -720 64 -69 204 -219 312 -335 309 -332 299 -321 285 -333 -15 -12 -152\n    -72 -165 -72 -5 0 -27 19 -47 43 -21 23 -63 69 -94 103 -31 33 -101 109 -156\n    169 -93 101 -213 233 -455 495 -633 688 -970 1059 -970 1069 0 3 50 6 111 5\n    83 -1 115 -5 127 -16z m-713 -50 c-51 -140 -45 -128 -260 -459 -46 -70 -88\n    -130 -95 -134 -9 -6 -11 -4 -5 6 5 8 59 95 121 194 61 99 142 239 179 310 75\n    144 75 145 79 145 2 0 -7 -28 -19 -62z m3538 -73 c225 -133 225 -133 152 -149\n    -25 -5 -50 5 -150 62 -128 74 -277 162 -284 168 -2 2 1 16 8 30 9 20 17 25 34\n    22 12 -2 120 -62 240 -133z m-3088 -215 c142 -157 279 -307 304 -335 54 -58\n    753 -840 915 -1023 59 -68 107 -125 104 -127 -5 -6 -266 121 -322 157 -34 22\n    -203 208 -570 627 -744 851 -690 785 -731 880 -39 92 -40 99 -23 136 l12 26\n    27 -28 c15 -15 143 -156 284 -313z m2726 303 c16 -10 29 -26 29 -36 0 -14 5\n    -17 20 -12 14 4 63 -20 170 -82 82 -48 160 -96 172 -105 23 -17 23 -18 -20\n    -18 -36 0 -69 16 -225 106 -203 119 -212 126 -204 148 8 20 22 20 58 -1z\n    m4310 -107 l113 -109 4 -59 c3 -33 1 -63 -4 -68 -5 -5 -62 42 -132 108 l-122\n    117 0 68 c0 55 3 66 14 60 8 -4 65 -57 127 -117z m-2960 6 c63 -67 405 -434\n    472 -507 26 -27 47 -57 47 -65 0 -18 -96 -170 -108 -170 -19 0 -582 608 -582\n    629 0 13 102 170 111 171 3 0 30 -26 60 -58z m1559 -59 l100 -96 0 -63 c0 -35\n    -4 -65 -8 -68 -5 -3 -53 41 -107 96 l-99 101 -2 64 c-1 35 2 63 7 63 5 0 54\n    -43 109 -97z m1620 -35 c0 -32 -4 -58 -8 -58 -5 0 -20 12 -34 28 -20 20 -27\n    39 -28 72 -3 88 -4 88 35 50 32 -31 35 -39 35 -92z m-5581 -112 c63 -44 109\n    -82 103 -84 -16 -5 -75 31 -202 121 -111 80 -180 138 -180 151 0 7 43 -22 279\n    -188z m4601 -313 c118 -116 243 -237 278 -270 l62 -59 0 -63 c0 -35 -4 -61 -9\n    -59 -5 2 -197 189 -425 416 l-416 412 0 62 0 63 148 -146 c81 -79 244 -240\n    362 -356z m-6983 354 c-41 -62 -92 -130 -112 -152 -20 -22 12 33 72 122 59 90\n    110 158 112 152 2 -6 -31 -61 -72 -122z m7743 -33 l120 -116 0 -75 c0 -41 -4\n    -73 -8 -71 -19 7 -232 213 -237 228 -11 35 -16 150 -6 150 6 0 64 -52 131\n    -116z m-3067 -51 c132 -138 462 -496 470 -510 5 -7 -25 -24 -87 -48 -110 -44\n    -98 -48 -205 70 -57 61 -200 216 -354 382 l-48 51 63 76 c35 42 64 76 66 76 1\n    0 44 -44 95 -97z m1664 -6 l93 -92 0 -67 c0 -38 -4 -68 -8 -68 -5 0 -52 44\n    -105 99 l-97 98 0 60 c0 57 6 79 19 68 3 -3 48 -47 98 -98z m1623 -24 c0 -72\n    -15 -82 -49 -34 -16 23 -21 44 -21 97 l0 68 35 -34 c33 -32 35 -38 35 -97z\n    m-1052 -345 l419 -417 7 -72 c3 -40 4 -74 1 -78 -8 -7 -831 816 -854 854 -13\n    22 -16 44 -13 83 2 29 8 52 13 50 4 -2 197 -191 427 -420z m-11066 251 c342\n    -333 853 -587 1283 -638 245 -29 390 -23 764 30 117 16 218 28 224 26 16 -5\n    -178 -45 -324 -67 -446 -66 -738 -41 -1119 97 -352 127 -744 389 -925 618 -70\n    88 -72 120 -3 40 29 -33 73 -81 100 -106z m8187 148 c-2 -2 -17 -13 -33 -25\n    -15 -12 -33 -19 -38 -16 -5 4 8 17 29 29 21 13 40 22 42 19 2 -2 2 -5 0 -7z\n    m3444 -135 c59 -58 110 -115 113 -127 3 -11 4 -48 2 -80 l-3 -60 -133 130\n    -133 130 -6 79 -6 80 29 -23 c16 -12 77 -70 137 -129z m-4816 102 c-3 -3 -12\n    -4 -19 -1 -8 3 -5 6 6 6 11 1 17 -2 13 -5z m-1796 -385 c410 -466 668 -764\n    664 -767 -6 -7 -84 48 -195 139 -205 166 -409 382 -561 594 -118 164 -250 382\n    -249 411 1 11 -10 23 341 -377z m3060 348 c-21 -26 -80 -52 -91 -41 -8 8 1 17\n    32 33 50 25 76 28 59 8z m-1264 -31 c43 -18 121 -45 173 -60 84 -25 158 -61\n    147 -72 -5 -6 -116 20 -203 47 -38 12 -99 42 -136 66 -97 65 -94 68 19 19z\n    m5081 -75 c61 -58 115 -115 121 -128 14 -30 14 -143 1 -143 -6 0 -64 52 -130\n    116 l-120 117 0 74 c0 41 4 73 8 71 5 -1 59 -50 120 -107z m-8546 27 c-54 -70\n    -170 -184 -178 -175 -7 6 208 238 215 231 2 -2 -15 -27 -37 -56z m5531 -277\n    c125 -134 186 -206 179 -213 -11 -11 -171 -78 -186 -78 -5 0 -21 13 -35 29\n    -14 16 -71 78 -127 137 -219 237 -274 298 -274 305 0 3 32 37 72 74 l71 68 56\n    -59 c31 -33 141 -151 244 -263z m-918 299 c8 -14 -92 -62 -123 -58 -45 5 -35\n    25 25 46 66 23 89 26 98 12z m2622 -261 c-3 -33 -7 -63 -9 -65 -4 -4 -175 164\n    -188 186 -11 18 -13 123 -3 134 4 4 52 -38 106 -93 l99 -100 -5 -62z m1533\n    124 l0 -78 -29 30 c-26 26 -30 39 -33 102 -3 40 -2 76 1 79 3 3 18 -8 33 -25\n    25 -28 28 -38 28 -108z m-614 -798 c3 -17 4 -52 2 -78 l-3 -48 -440 441 -440\n    440 -3 47 c-2 26 0 58 3 72 6 23 43 -12 441 -410 332 -332 435 -441 440 -464z\n    m-3731 873 c14 -6 25 -14 25 -18 0 -8 -100 -40 -124 -40 -22 0 -80 30 -72 37\n    5 5 107 30 133 32 7 1 24 -4 38 -11z m-401 -50 c23 -12 52 -28 65 -36 22 -15\n    22 -16 5 -23 -11 -4 -44 -8 -75 -8 -47 -1 -59 3 -79 24 -13 14 -29 25 -36 25\n    -7 0 -26 12 -41 26 l-28 25 74 -6 c44 -4 92 -15 115 -27z m4347 -190 c30 -29\n    43 -84 37 -152 l-3 -40 -133 130 -132 129 0 79 0 80 102 -100 c56 -54 114\n    -111 129 -126z m-4131 188 l44 -24 -57 -12 c-54 -13 -60 -12 -100 10 -79 43\n    -80 50 -2 50 53 -1 81 -7 115 -24z m-455 -26 c115 -22 135 -28 135 -42 0 -6\n    -36 -9 -93 -6 -85 3 -97 6 -143 35 -42 28 -46 33 -24 33 14 0 70 -9 125 -20z\n    m1307 -39 c13 -16 97 -109 187 -207 91 -99 174 -189 184 -201 l20 -23 -68 -31\n    c-38 -17 -79 -35 -92 -40 -20 -7 -40 11 -195 183 -95 105 -183 203 -196 219\n    l-23 28 67 50 c37 28 73 51 80 51 7 0 23 -13 36 -29z m3582 -208 c3 -8 6 -49\n    6 -91 l0 -77 -125 125 -125 125 0 78 0 79 119 -112 c66 -62 122 -119 125 -127z\n    m-1444 -77 l0 -80 -30 29 c-22 21 -30 38 -30 64 0 20 -3 54 -7 76 -6 36 -7 38\n    -14 15 -4 -14 -8 -41 -8 -60 l-1 -35 -55 57 -55 56 0 64 c0 36 3 68 7 72 4 3\n    49 -35 100 -86 l93 -93 0 -79z m1517 222 c20 -19 23 -31 23 -95 0 -40 -4 -73\n    -9 -73 -5 0 -18 11 -29 25 -14 18 -20 42 -21 95 -1 38 2 70 5 70 4 0 18 -10\n    31 -22z m-1024 -436 c336 -336 439 -445 447 -472 12 -43 13 -130 1 -130 -5 0\n    -210 203 -455 452 l-446 451 0 69 c0 37 3 68 8 68 4 0 204 -197 445 -438z\n    m-2816 374 c11 -13 53 -61 94 -106 41 -46 79 -88 84 -94 6 -6 47 -52 93 -102\n    45 -51 82 -94 82 -97 0 -2 -39 -22 -86 -43 -65 -29 -90 -35 -102 -28 -19 12\n    -362 394 -362 403 0 10 143 90 162 90 9 1 25 -10 35 -23z m3426 -169 c72 -70\n    77 -77 78 -118 1 -24 3 -63 5 -86 2 -24 0 -43 -4 -43 -4 0 -63 56 -131 124\n    l-125 125 -4 88 -4 88 53 -52 c30 -28 89 -85 132 -126z m-5208 54 c74 -30 162\n    -59 258 -86 48 -13 67 -25 106 -68 230 -251 451 -498 451 -505 0 -12 -183 -92\n    -207 -91 -10 0 -47 33 -83 73 -88 98 -260 286 -334 366 -100 107 -300 323\n    -321 349 l-20 23 40 -17 c22 -9 72 -29 110 -44z m5445 -74 l120 -119 0 -74 c0\n    -41 -4 -74 -8 -74 -4 0 -63 56 -130 123 l-122 124 0 72 c0 42 4 71 10 69 5 -1\n    63 -56 130 -121z m-3778 -29 c64 -73 146 -164 182 -203 36 -38 65 -73 66 -76\n    0 -11 -166 -81 -182 -77 -13 2 -328 346 -366 397 -11 16 -4 21 70 53 46 20 90\n    36 98 37 9 1 68 -59 132 -131z m2346 -76 l-3 -92 -52 51 -53 52 0 82 c0 45 3\n    85 7 89 4 4 29 -15 55 -42 l49 -48 -3 -92z m1632 46 c0 -81 -8 -94 -34 -56\n    -11 16 -16 46 -16 102 l0 79 25 -23 c23 -21 25 -31 25 -102z m-1040 -339 c245\n    -248 448 -456 451 -462 9 -15 23 -167 16 -167 -6 0 -810 808 -873 879 -27 29\n    -51 59 -54 67 -7 18 0 134 8 134 4 0 207 -203 452 -451z m-1803 384 c-19 -27\n    -44 -56 -54 -66 -18 -16 -21 -15 -53 18 -19 19 -32 35 -29 35 2 0 40 16 84 35\n    43 19 81 32 83 30 3 -2 -12 -26 -31 -52z m-1298 -181 c100 -112 181 -208 181\n    -213 0 -8 -105 -61 -177 -90 -20 -7 -43 14 -225 217 -112 124 -202 228 -201\n    232 2 9 203 61 225 59 9 -1 98 -94 197 -205z m-5229 178 c-14 -10 -72 -46\n    -130 -79 -321 -184 -695 -262 -1185 -248 -228 7 -447 39 -424 61 2 3 61 -2\n    129 -11 158 -20 552 -22 705 -4 328 39 596 120 820 249 91 53 131 67 85 32z\n    m4310 -46 c153 -9 129 6 319 -209 95 -106 173 -197 173 -202 1 -9 -179 -91\n    -202 -92 -18 -1 -85 67 -280 284 -79 88 -159 177 -179 199 l-36 39 60 -7 c33\n    -3 98 -9 145 -12z m2084 -25 c30 -35 33 -44 23 -59 -26 -37 -116 -130 -126\n    -130 -11 0 -130 130 -132 145 -1 9 164 84 188 85 6 0 27 -19 47 -41z m2505\n    -82 l121 -118 0 -66 0 -66 -22 19 c-13 10 -69 64 -125 120 -92 90 -103 105\n    -103 136 0 20 -3 50 -7 68 -4 22 -2 31 5 29 6 -2 65 -57 131 -122z m-3974 -68\n    c213 -239 247 -281 238 -289 -4 -4 -48 -24 -97 -45 l-88 -39 -54 59 c-29 33\n    -52 64 -51 69 2 5 23 17 47 27 54 22 42 24 -22 4 l-48 -14 -170 190 c-93 104\n    -170 193 -170 199 0 8 63 14 200 17 l55 2 160 -180z m2884 155 c18 -23 21 -41\n    21 -115 0 -49 -2 -89 -5 -89 -3 0 -17 12 -30 26 -23 24 -25 35 -25 115 0 49 4\n    89 9 89 5 0 19 -12 30 -26z m1479 -332 l-3 -82 -122 120 -123 119 0 88 0 88\n    125 -126 126 -125 -3 -82z m-3102 191 c38 -42 71 -80 73 -85 4 -11 -119 -127\n    -134 -128 -10 0 -171 176 -187 204 -5 9 18 24 75 49 45 20 87 36 93 37 6 0 42\n    -34 80 -77z m2121 -365 c237 -238 447 -450 466 -472 29 -33 35 -48 41 -105 13\n    -144 54 -174 -445 324 -248 248 -463 466 -478 485 -24 33 -26 42 -23 118 2 45\n    5 82 6 82 1 0 196 -195 433 -432z m-608 377 l41 -45 0 -82 0 -83 -55 57 -55\n    56 0 71 c0 86 10 90 69 26z m1661 26 c12 -24 14 -161 1 -161 -20 0 -31 31 -37\n    104 -6 66 -5 76 9 76 9 0 21 -9 27 -19z m-3368 -166 c51 -58 93 -109 93 -114\n    0 -13 -131 -111 -147 -110 -15 1 -223 235 -223 250 0 12 141 77 167 78 9 1 58\n    -46 110 -104z m2926 -20 c46 -44 91 -94 98 -112 15 -34 19 -143 6 -143 -4 0\n    -59 52 -122 115 l-115 115 -3 77 -4 78 28 -25 c15 -14 66 -61 112 -105z\n    m-1111 53 c20 -19 23 -31 23 -100 0 -43 -4 -78 -10 -78 -5 0 -18 10 -30 22\n    -17 18 -20 35 -20 100 0 43 3 78 7 78 4 0 17 -10 30 -22z m1401 -151 l92 -94\n    0 -69 0 -68 -52 49 c-28 28 -57 55 -63 60 -36 34 -55 71 -57 114 -1 43 -2 44\n    -5 9 -2 -21 -7 -38 -11 -38 -3 0 -21 14 -39 32 -31 30 -33 37 -33 96 l0 64 38\n    -30 c20 -17 79 -73 130 -125z m-9510 123 c-32 -19 -334 -101 -480 -131 -162\n    -32 -319 -46 -358 -32 -19 8 -3 11 75 17 110 8 417 67 620 120 139 37 172 42\n    143 26z m6086 -120 c64 -71 116 -134 116 -139 0 -10 -141 -101 -157 -101 -8 0\n    -181 188 -240 260 l-23 28 93 41 c50 22 93 41 93 41 1 0 54 -58 118 -130z\n    m1911 40 c45 -46 49 -53 53 -109 7 -101 -1 -105 -64 -37 l-54 60 0 68 c0 37 4\n    68 8 68 4 0 30 -22 57 -50z m1665 31 c13 -25 13 -171 0 -171 -19 0 -30 41 -30\n    114 0 76 10 94 30 57z m-990 -492 c386 -392 456 -467 462 -498 8 -43 10 -141\n    3 -141 -5 0 -458 457 -853 860 l-123 125 5 70 c3 39 5 71 6 73 1 13 106 -90\n    500 -489z m-2873 394 c28 -32 85 -96 127 -143 41 -47 76 -88 76 -92 0 -10\n    -175 -98 -193 -98 -16 0 -262 275 -262 293 0 9 172 94 196 96 3 1 28 -25 56\n    -56z m3533 -273 l0 -73 -22 19 c-13 10 -64 61 -114 113 -97 99 -104 114 -104\n    220 l0 36 120 -121 120 -121 0 -73z m-4141 203 c27 -32 47 -61 43 -65 -11 -10\n    -194 -88 -208 -88 -13 0 -104 103 -104 118 0 11 176 92 202 92 9 0 39 -26 67\n    -57z m4232 -81 c3 -42 4 -79 2 -81 -2 -3 -20 11 -40 31 -32 33 -37 44 -41 97\n    -2 33 -1 68 2 78 6 14 11 12 39 -15 29 -29 33 -40 38 -110z m-1312 102 c16\n    -21 21 -41 21 -90 0 -34 -4 -65 -9 -68 -19 -12 -49 39 -51 89 -5 103 2 116 39\n    69z m-2504 -126 c60 -68 120 -135 133 -150 l24 -26 -33 -17 c-18 -10 -63 -28\n    -100 -40 -53 -18 -71 -21 -82 -12 -24 20 -248 279 -244 283 5 5 180 83 188 83\n    3 1 55 -54 114 -121z m2395 31 l50 -52 0 -86 0 -86 -60 62 -60 61 0 76 c0 46\n    4 76 10 76 6 0 33 -23 60 -51z m540 -341 c478 -486 604 -616 611 -637 12 -32\n    21 -173 11 -170 -6 2 -86 83 -178 179 -92 96 -242 252 -333 345 -92 94 -239\n    246 -329 339 l-162 168 0 74 c0 41 3 74 6 74 4 0 172 -168 374 -372z m990 297\n    l75 -75 3 -80 c2 -44 2 -80 -1 -80 -12 0 -143 144 -148 163 -11 42 -20 147\n    -12 147 5 0 42 -34 83 -75z m128 63 c7 -7 12 -41 12 -82 0 -68 0 -69 -20 -51\n    -16 14 -20 31 -20 82 0 63 6 73 28 51z m-4729 -55 c28 -31 51 -60 51 -63 0 -9\n    -191 -90 -210 -90 -8 0 -39 27 -68 60 l-54 60 44 19 c115 50 164 70 175 71 6\n    0 34 -26 62 -57z m459 -113 c61 -71 114 -135 117 -142 4 -10 -22 -21 -99 -41\n    -57 -15 -111 -27 -119 -27 -18 0 -239 239 -234 253 4 13 198 96 211 90 6 -3\n    62 -63 124 -133z m3845 -8 c53 -54 97 -105 98 -113 0 -8 1 -35 1 -61 0 -27 4\n    -48 9 -48 4 0 9 21 11 48 l3 47 41 -42 c42 -44 54 -82 54 -172 l0 -36 -55 57\n    c-37 37 -53 62 -49 72 3 9 2 16 -4 16 -6 0 -12 -5 -14 -10 -2 -6 -52 38 -111\n    98 -93 95 -107 113 -108 143 0 19 -3 54 -6 77 -5 40 -4 43 13 34 11 -6 63 -55\n    117 -110z m201 -69 c4 -41 5 -77 2 -80 -3 -3 -23 14 -45 36 -41 42 -41 42 -41\n    118 l0 77 39 -38 c36 -35 39 -42 45 -113z m-4765 80 c28 -31 51 -61 51 -65 0\n    -8 -99 -55 -165 -79 -33 -12 -36 -11 -66 17 -17 16 -44 45 -60 65 l-29 37 98\n    40 c53 23 102 41 109 42 6 0 34 -26 62 -57z m3433 40 c15 -13 18 -31 18 -100\n    0 -45 -4 -83 -9 -83 -26 0 -41 47 -41 122 0 43 3 78 7 78 3 0 15 -7 25 -17z\n    m-2921 -211 c21 -25 35 -50 30 -55 -13 -13 -234 -36 -252 -26 -17 8 -161 164\n    -167 179 -2 4 46 28 105 53 l108 46 69 -75 c38 -42 86 -96 107 -122z m4479\n    139 c5 -11 10 -52 10 -92 0 -63 -2 -71 -14 -59 -17 19 -33 170 -17 170 6 0 15\n    -9 21 -19z m-1653 -56 c51 -53 53 -58 55 -113 l2 -57 3 49 4 48 25 -23 c22\n    -20 24 -30 24 -108 l0 -86 -95 96 -95 96 0 77 c0 51 4 76 12 76 6 0 35 -25 65\n    -55z m202 18 c46 -51 517 -538 722 -748 227 -231 248 -256 249 -285 0 -20 2\n    -22 11 -10 8 12 28 -4 109 -88 l99 -104 -36 -39 c-20 -21 -42 -39 -48 -39 -7\n    0 -31 21 -55 48 -23 26 -187 196 -364 377 -634 651 -614 628 -607 684 2 7 -2\n    10 -8 6 -6 -3 -11 -14 -11 -23 0 -11 -19 2 -55 38 l-55 54 0 83 c0 46 3 83 8\n    83 4 0 22 -17 41 -37z m-3786 -39 c64 -69 64 -67 -22 -103 -79 -33 -127 -24\n    -181 35 -23 26 -38 50 -34 54 11 11 167 79 175 76 3 0 31 -29 62 -62z m5197\n    -163 c0 -39 -2 -71 -5 -71 -3 0 -36 32 -74 71 l-69 71 -4 66 c-2 37 -2 71 1\n    76 2 5 37 -25 77 -66 l74 -75 0 -72z m-4792 100 c40 -44 72 -82 72 -85 0 -3\n    -65 -6 -144 -6 l-144 0 -36 42 c-20 23 -33 45 -29 49 14 14 168 78 189 78 13\n    1 45 -26 92 -78z m4629 -350 c3 -45 2 -81 -3 -81 -16 0 -313 304 -322 330 -5\n    14 -10 57 -11 95 l-2 70 166 -167 167 -166 5 -81z m-5300 357 c41 -38 29 -42\n    -56 -16 l-34 11 24 13 c33 18 39 17 66 -8z m371 -59 l24 -29 -54 1 c-29 1 -64\n    4 -78 9 -24 7 -23 8 20 28 57 27 60 27 88 -9z m5136 -25 c9 -25 7 -144 -3\n    -144 -15 0 -21 28 -21 96 0 61 11 83 24 48z m-1544 -254 l0 -75 -95 96 -95 96\n    0 60 c0 33 3 63 7 67 4 3 47 -33 95 -81 l88 -88 0 -75z m150 59 l0 -82 -22 19\n    c-12 10 -37 35 -55 54 -31 34 -33 38 -33 120 l0 85 55 -57 55 -56 0 -83z\n    m1286 104 l69 -68 5 -78 c3 -42 2 -77 -2 -77 -16 0 -127 113 -142 144 -16 35\n    -22 146 -8 146 5 0 40 -30 78 -67z m-208 -301 c4 -51 5 -92 2 -92 -3 0 -50 44\n    -104 99 l-98 98 -7 87 c-4 48 -4 89 -2 92 3 3 49 -40 104 -94 l98 -98 7 -92z\n    m-886 81 c201 -206 777 -801 806 -834 l22 -25 -33 -37 c-18 -20 -37 -37 -43\n    -37 -6 0 -55 46 -109 103 -98 102 -338 348 -642 658 l-163 165 0 82 c0 45 2\n    82 4 82 2 0 73 -71 158 -157z m1208 31 c0 -48 -4 -73 -10 -69 -5 3 -10 40 -10\n    81 0 48 4 73 10 69 6 -3 10 -40 10 -81z m-1637 -12 l87 -87 0 -63 c0 -34 -4\n    -62 -9 -62 -8 0 -155 155 -172 182 -11 16 -12 118 -1 118 4 0 47 -39 95 -88z\n    m188 6 c48 -51 49 -53 49 -115 0 -35 -3 -63 -7 -63 -4 0 -29 21 -55 47 -48 47\n    -48 47 -48 115 0 37 3 68 6 68 3 0 28 -23 55 -52z m1361 -39 l88 -91 0 -74 c0\n    -41 -4 -74 -8 -74 -5 0 -47 40 -95 89 l-87 88 0 77 c0 42 3 76 7 76 4 0 47\n    -41 95 -91z m-163 -53 l43 -44 6 -93 5 -93 -30 24 c-17 14 -37 34 -44 45 -14\n    21 -40 205 -29 205 3 0 25 -20 49 -44z m-152 -78 l101 -103 6 -70 c4 -38 9\n    -80 12 -92 2 -13 1 -23 -3 -23 -5 0 -54 46 -110 103 -73 73 -104 111 -107 132\n    -11 68 -15 155 -8 155 5 0 54 -46 109 -102z m-281 -614 c107 -111 194 -206\n    194 -211 0 -5 -14 -22 -31 -39 l-31 -29 -408 415 -409 415 0 75 0 75 245 -250\n    c135 -137 333 -341 440 -451z m-866 434 c0 -51 -3 -66 -12 -61 -7 3 -50 45\n    -95 93 l-83 88 0 59 c0 33 3 63 7 67 4 4 47 -35 95 -86 l87 -93 1 -67z m117\n    134 c31 -31 33 -38 33 -100 l0 -66 -55 54 -55 54 0 65 0 64 22 -19 c13 -10 38\n    -34 55 -52z m1346 -40 l87 -87 0 -72 c0 -109 -14 -108 -118 8 l-72 80 0 80 c0\n    43 3 79 8 79 4 0 47 -39 95 -88z m-1567 -114 c39 -40 79 -84 88 -98 16 -25 22\n    -105 9 -113 -5 -3 -46 36 -92 85 -81 86 -85 92 -89 144 -2 30 0 54 5 54 4 0\n    40 -33 79 -72z m917 -555 l159 -162 -23 -30 c-13 -16 -32 -33 -42 -36 -18 -7\n    -22 -3 -511 508 l-209 218 1 57 c0 31 1 62 1 67 1 6 106 -96 233 -225 127\n    -129 303 -308 391 -397z m534 229 l-48 -47 -114 120 c-122 128 -120 124 -129\n    250 l-6 70 172 -173 172 -172 -47 -48z m-30 356 c18 -18 33 -42 33 -55 0 -15\n    5 -21 13 -17 14 5 110 -75 127 -105 7 -13 0 -28 -30 -62 l-38 -44 -66 65 c-36\n    35 -68 71 -70 80 -9 34 -17 170 -10 170 5 0 23 -14 41 -32z m-1155 -177 c1\n    -39 0 -71 -3 -71 -3 0 -34 29 -67 64 -59 61 -62 67 -62 114 0 91 7 93 71 24\n    l57 -61 4 -70z m-210 -85 c46 -55 49 -61 44 -105 -2 -25 -5 -47 -5 -49 -2 -8\n    -27 16 -101 98 -67 75 -80 95 -80 124 0 67 9 71 53 29 21 -21 62 -64 89 -97z\n    m462 -116 c161 -164 265 -272 416 -433 l44 -47 -37 -38 -38 -37 -82 85 c-190\n    196 -513 543 -519 558 -4 10 -7 44 -7 76 l-1 59 21 -19 c12 -10 103 -102 203\n    -204z m-307 125 c53 -59 58 -69 63 -120 3 -31 3 -59 0 -61 -2 -3 -35 28 -72\n    68 -65 71 -67 75 -68 126 0 28 4 52 9 52 5 0 36 -29 68 -65z m-115 -263 c2\n    -24 1 -48 -3 -53 -3 -5 -45 31 -92 80 -82 85 -87 93 -87 134 0 24 3 47 8 51 4\n    5 44 -32 89 -80 72 -78 82 -93 85 -132z m74 135 c109 -117 114 -125 114 -185\n    l-1 -57 -74 80 c-73 78 -75 81 -75 133 0 28 3 52 8 52 4 0 16 -10 28 -23z\n    m443 -297 c85 -91 180 -191 210 -223 l55 -57 -30 -31 -30 -30 -165 173 c-354\n    371 -349 365 -349 442 l1 51 76 -80 c42 -44 146 -154 232 -245z m-519 -16 l-1\n    -59 -89 95 c-74 78 -90 101 -90 127 0 72 8 71 97 -19 l83 -85 0 -59z m66 148\n    c10 -9 45 -45 77 -79 56 -60 57 -63 57 -119 l0 -57 -80 84 c-78 83 -79 85 -80\n    137 0 28 2 52 3 52 2 0 13 -8 23 -18z m212 -53 c28 -32 32 -44 32 -95 l-1 -59\n    -44 50 c-41 45 -45 54 -45 103 0 60 6 61 58 1z m-277 -213 c9 -15 16 -146 9\n    -146 -6 0 -31 26 -142 147 -46 50 -48 55 -48 111 0 32 3 61 6 65 6 5 160 -150\n    175 -177z m437 42 c49 -51 128 -135 176 -187 l87 -94 -28 -29 -27 -28 -136\n    141 c-74 78 -143 154 -152 168 -16 23 -26 121 -14 121 3 0 45 -42 94 -92z\n    m-229 -148 l0 -55 -84 89 -85 90 0 55 1 56 84 -90 85 -90 -1 -55z m104 63 c3\n    -29 3 -53 -1 -53 -5 0 -25 17 -46 39 -32 33 -38 46 -43 97 l-5 59 45 -45 c39\n    -39 45 -52 50 -97z m-385 -74 c96 -100 100 -107 101 -161 1 -45 -7 -47 -39\n    -10 -12 15 -56 61 -96 103 -68 70 -74 80 -74 118 0 22 5 41 11 41 5 0 49 -41\n    97 -91z m522 -24 c117 -123 160 -172 160 -180 0 -13 -32 -45 -45 -45 -6 0 -59\n    52 -118 115 l-107 115 0 52 0 51 22 -19 c12 -10 51 -50 88 -89z m-230 -140 c0\n    -32 3 -55 7 -51 4 4 6 23 4 42 -2 27 1 35 12 32 16 -4 97 -94 97 -109 0 -6 4\n    -8 9 -5 9 6 111 -97 111 -112 0 -4 -14 -21 -30 -37 l-31 -29 -97 99 c-54 55\n    -132 136 -174 180 l-76 80 -7 75 -6 75 90 -91 91 -91 0 -58z m100 56 l0 -55\n    -45 49 c-41 46 -44 54 -44 105 l0 55 44 -49 c42 -46 45 -54 45 -105z m-381\n    -57 c99 -105 101 -108 101 -155 0 -26 3 -55 7 -65 14 -36 -24 -4 -124 104\n    l-103 111 0 56 c0 30 4 55 9 55 5 0 54 -48 110 -106z m471 19 c31 -32 73 -77\n    95 -101 l39 -42 -25 -25 -25 -26 -77 80 c-73 75 -77 81 -77 125 0 25 4 46 8\n    46 4 0 32 -26 62 -57z m-192 -152 c83 -88 152 -163 152 -167 0 -13 -32 -44\n    -45 -44 -7 0 -69 60 -137 133 -120 126 -126 134 -133 185 -4 28 -3 52 2 52 4\n    0 77 -72 161 -159z m-231 -102 c70 -74 73 -79 73 -125 l0 -49 -120 121 c-113\n    114 -120 123 -120 161 0 22 3 43 7 47 4 4 25 -12 47 -36 22 -24 73 -77 113\n    -119z m196 -23 c59 -63 107 -118 107 -123 0 -5 -11 -20 -25 -33 l-26 -24 -83\n    84 c-84 84 -84 85 -91 148 -4 36 -3 62 2 62 5 0 57 -51 116 -114z m-193 -131\n    l153 -156 -24 -25 -24 -26 -137 142 c-130 133 -138 143 -138 181 0 21 4 39 8\n    39 5 0 77 -70 162 -155z m159 -10 c53 -55 61 -67 51 -84 -19 -36 -32 -34 -77\n    12 -40 40 -46 51 -47 91 -1 25 1 46 5 46 3 0 34 -29 68 -65z m-194 -103 c55\n    -57 101 -110 103 -117 2 -8 -7 -24 -19 -36 l-22 -22 -98 100 -99 100 0 53 c0\n    63 -7 67 135 -78z m-40 -122 l79 -80 -21 -21 c-26 -26 -42 -19 -106 50 -40 43\n    -47 56 -47 91 0 22 3 40 8 40 4 0 43 -36 87 -80z m-36 -112 c40 -43 40 -43 21\n    -63 -19 -19 -20 -19 -50 10 -22 21 -30 38 -30 62 0 18 4 33 10 33 5 0 27 -19\n    49 -42z m-34 -108 c0 -7 -6 -15 -12 -17 -8 -3 -13 4 -13 17 0 13 5 20 13 18 6\n    -3 12 -11 12 -18z");
    			add_location(path0, file$5, 11, 9, 337);
    			attr_dev(path1, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path1, "d", "M13295 13524 c-33 -1 -874 -8 -1870 -13 -1771 -11 -2075 -15 -2075\n    -31 0 -17 467 -20 1535 -10 627 6 1553 14 2057 18 504 4 920 11 924 15 4 4 4\n    10 0 14 -7 7 -459 13 -571 7z");
    			add_location(path1, file$5, 1050, 10, 81808);
    			attr_dev(path2, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path2, "d", "M8565 13450 c-371 -67 -619 -117 -690 -139 -74 -24 -61 -25 41 -6 44\n    8 183 31 309 51 376 59 655 118 655 139 0 9 -49 2 -315 -45z");
    			add_location(path2, file$5, 1055, 10, 82046);
    			attr_dev(path3, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path3, "d", "M10794 13421 c3 -5 43 -13 88 -17 103 -10 2064 -12 2037 -2 -59 22\n    -2138 41 -2125 19z");
    			add_location(path3, file$5, 1059, 10, 82237);
    			attr_dev(path4, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path4, "d", "M11917 13342 c-5 -6 31 -12 106 -16 156 -9 557 -12 557 -5 0 16 -654\n    37 -663 21z");
    			add_location(path4, file$5, 1063, 10, 82386);
    			attr_dev(path5, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path5, "d", "M6607 13067 c-4 -10 -7 -141 -6 -290 1 -304 14 -313 24 -17 6 185 -3\n    343 -18 307z");
    			add_location(path5, file$5, 1067, 10, 82530);
    			attr_dev(path6, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path6, "d", "M7088 13041 c-42 -3 -80 -10 -85 -15 -9 -10 1079 2 1177 13 76 9\n    -977 11 -1092 2z");
    			add_location(path6, file$5, 1071, 10, 82675);
    			attr_dev(path7, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path7, "d", "M6706 12853 c3 -93 10 -172 15 -177 10 -11 12 227 3 298 -4 25 -11\n    46 -16 46 -6 0 -7 -66 -2 -167z");
    			add_location(path7, file$5, 1075, 10, 82820);
    			attr_dev(path8, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path8, "d", "M7232 12899 c-74 -5 -141 -14 -150 -19 -15 -10 -14 -10 3 -6 11 3\n    157 10 325 16 168 7 307 14 309 16 7 7 -346 2 -487 -7z");
    			add_location(path8, file$5, 1079, 10, 82981);
    			attr_dev(path9, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path9, "d", "M8740 13060 c-69 -4 -127 -8 -130 -10 -3 -1 11 -6 30 -10 20 -5 171\n    -4 345 3 264 10 295 13 210 18 -124 8 -292 8 -455 -1z");
    			add_location(path9, file$5, 1083, 10, 83164);
    			attr_dev(path10, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path10, "d", "M10893 12981 c-76 -4 -127 -11 -135 -19 -9 -9 -15 -82 -20 -250 -11\n    -344 -14 -589 -6 -597 7 -8 992 -24 1486 -25 319 0 342 1 342 18 0 9 3 168 7\n    352 9 487 9 498 -2 509 -12 12 -1485 23 -1672 12z m1630 -65 c4 -6 5 -29 3\n    -51 -3 -22 -9 -195 -13 -384 l-6 -344 -416 7 c-229 3 -618 9 -865 12 l-449 7\n    7 251 c3 138 9 310 13 383 l6 132 91 3 c50 2 435 1 856 -1 541 -3 767 -7 773\n    -15z");
    			add_location(path10, file$5, 1087, 10, 83348);
    			attr_dev(path11, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path11, "d", "M10943 12860 c-23 -9 -23 -12 -23 -183 0 -130 3 -178 14 -192 12 -17\n    28 -18 205 -16 105 1 191 -2 191 -6 -1 -4 -41 -34 -89 -66 -113 -75 -231 -161\n    -209 -154 9 3 83 49 165 103 178 116 204 130 228 117 16 -9 -2 -25 -174 -150\n    -2 -2 -2 -5 0 -8 3 -2 59 32 124 75 l120 80 140 0 c77 0 147 5 155 10 12 7 16\n    37 18 139 l4 130 64 42 c35 23 64 45 64 50 0 5 -27 -4 -60 -21 -71 -36 -80\n    -37 -80 -7 0 12 -4 27 -8 33 -5 8 -93 14 -277 18 -148 3 -333 8 -410 11 -78 3\n    -150 1 -162 -5z m455 -57 c61 -3 112 -9 112 -13 0 -4 -58 -42 -129 -84 -144\n    -88 -230 -152 -126 -95 33 18 116 67 185 108 l125 75 90 1 c89 0 90 0 93 -26\n    4 -32 -1 -36 -173 -151 l-140 -93 -232 -3 -233 -2 0 145 0 145 158 0 c86 0\n    208 -3 270 -7z m352 -132 c0 -12 -17 -29 -47 -47 -27 -15 -74 -45 -106 -66\n    -43 -29 -66 -38 -89 -36 -30 3 -23 9 97 85 72 45 133 83 138 83 4 0 7 -9 7\n    -19z m-4 -147 c-6 -16 -150 -21 -144 -4 2 5 35 29 73 54 l70 45 3 -41 c2 -22\n    1 -47 -2 -54z");
    			add_location(path11, file$5, 1095, 10, 83798);
    			attr_dev(path12, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path12, "d", "M12420 12840 c-30 -15 -77 -30 -105 -33 -84 -9 -105 -21 -105 -60 0\n    -25 -7 -38 -30 -55 -40 -30 -50 -28 -50 12 0 84 -51 126 -126 104 -57 -17 -64\n    -25 -64 -77 0 -60 20 -87 77 -104 l45 -13 -258 -174 c-296 -198 -269 -179\n    -263 -184 3 -3 63 33 134 79 72 46 213 137 314 202 225 145 218 141 235 117\n    11 -14 31 -20 75 -24 l61 -5 -97 -64 -98 -65 -97 0 c-53 -1 -99 -4 -103 -8 -4\n    -4 -8 -41 -9 -83 -1 -66 2 -78 19 -88 39 -23 67 -26 105 -11 42 17 70 67 70\n    124 0 37 16 52 129 119 90 55 160 107 131 98 -13 -4 -16 8 -15 74 l1 79 39 27\n    c50 33 49 32 44 37 -2 2 -29 -8 -59 -24z m-352 -98 c6 -9 12 -26 12 -39 0 -19\n    -5 -23 -33 -23 -42 0 -57 15 -57 57 0 31 1 32 33 27 17 -4 38 -14 45 -22z\n    m280 -15 c5 -26 -16 -47 -48 -47 -39 0 -45 25 -12 49 32 24 55 23 60 -2z\n    m-265 -286 c25 -24 6 -78 -31 -88 -28 -7 -52 16 -47 45 2 9 4 30 4 46 1 26 3\n    28 29 21 15 -3 35 -14 45 -24z");
    			add_location(path12, file$5, 1110, 10, 84807);
    			attr_dev(path13, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path13, "d", "M12299 12493 c-46 -7 -62 -35 -63 -111 l-1 -67 42 -14 c81 -29 123\n    10 131 121 3 43 1 59 -9 62 -26 8 -74 12 -100 9z m36 -35 c27 -12 31 -29 14\n    -76 -12 -35 -37 -48 -56 -30 -9 9 -11 29 -6 66 6 56 9 58 48 40z");
    			add_location(path13, file$5, 1124, 10, 85750);
    			attr_dev(path14, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path14, "d", "M9454 12963 c-38 -13 -130 -80 -121 -89 4 -4 152 55 175 69 6 5 12\n    12 12 17 0 16 -25 17 -66 3z");
    			add_location(path14, file$5, 1129, 10, 86021);
    			attr_dev(path15, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path15, "d", "M8811 12960 c-34 -3 -56 -10 -59 -19 -4 -11 3 -13 34 -8 22 4 88 7\n    148 7 60 0 107 3 103 6 -10 10 -167 19 -226 14z");
    			add_location(path15, file$5, 1133, 10, 86179);
    			attr_dev(path16, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path16, "d", "M9765 12899 c-7 -10 1 -21 53 -79 13 -14 37 -55 55 -92 18 -37 36\n    -67 41 -67 13 -1 -3 88 -26 142 -31 71 -104 128 -123 96z");
    			add_location(path16, file$5, 1137, 10, 86356);
    			attr_dev(path17, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path17, "d", "M12788 12860 c-12 -61 -19 -538 -11 -710 8 -162 8 -158 20 245 6 226\n    8 430 4 455 l-7 45 -6 -35z");
    			add_location(path17, file$5, 1141, 10, 86541);
    			attr_dev(path18, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path18, "d", "M9595 12871 c-3 -6 4 -19 15 -29 l21 -20 -35 -6 c-21 -4 -45 -2 -58\n    5 -21 11 -21 12 -3 25 37 27 3 27 -79 1 -103 -34 -153 -69 -188 -133 -58 -106\n    -46 -226 31 -327 46 -60 121 -127 143 -127 6 0 8 10 4 25 -5 21 -3 25 18 25\n    28 0 49 -21 40 -43 -8 -21 60 -40 102 -28 91 26 182 100 216 177 32 74 -4 91\n    -45 22 -28 -47 -74 -95 -83 -86 -3 4 2 18 12 32 19 30 12 45 -11 26 -9 -7 -18\n    -10 -22 -7 -3 4 -14 2 -24 -4 -25 -13 -24 -4 3 40 17 27 24 32 26 19 4 -19 22\n    -25 22 -8 0 6 11 10 23 10 32 0 57 30 57 66 0 23 -2 26 -11 14 -7 -12 -9 -8\n    -7 15 2 24 8 31 30 33 22 3 29 -2 34 -22 11 -46 24 -28 24 34 0 66 -20 116\n    -73 184 -55 69 -161 120 -182 87z m125 -105 c13 -17 11 -19 -40 -30 -27 -6\n    -37 -1 -59 26 -12 16 -10 20 10 37 23 19 24 19 50 0 14 -10 32 -25 39 -33z\n    m-165 -20 c137 -104 83 -355 -80 -374 -58 -6 -97 11 -140 60 -114 134 -25 359\n    137 345 31 -3 59 -13 83 -31z m208 -34 c19 -21 42 -80 34 -88 -3 -3 -19 -3\n    -35 1 -22 4 -32 14 -38 36 -11 37 -30 35 -28 -3 2 -38 -12 -35 -20 4 -3 17 -5\n    32 -4 33 8 6 64 34 69 35 3 0 13 -8 22 -18z m-36 -199 c-3 -10 -5 -4 -5 12 0\n    17 2 24 5 18 2 -7 2 -21 0 -30z m-121 -172 c-9 -14 -66 -34 -74 -27 -10 11 28\n    36 56 36 13 0 21 -4 18 -9z");
    			add_location(path18, file$5, 1145, 10, 86700);
    			attr_dev(path19, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path19, "d", "M9546 12658 c5 -30 4 -39 -4 -34 -16 10 -16 -44 0 -81 6 -15 10 -34\n    9 -40 -1 -7 2 -13 7 -13 11 0 32 76 32 115 0 33 -26 95 -40 95 -6 0 -8 -15 -4\n    -42z");
    			add_location(path19, file$5, 1163, 10, 87960);
    			attr_dev(path20, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path20, "d", "M9458 12473 c-10 -2 -18 -9 -18 -14 0 -15 36 -10 50 6 13 16 5 18\n    -32 8z");
    			add_location(path20, file$5, 1168, 10, 88176);
    			attr_dev(path21, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path21, "d", "M9496 12439 c-10 -6 -43 -9 -73 -7 -48 4 -52 3 -39 -10 8 -8 37 -17\n    66 -20 39 -4 55 -1 70 13 35 31 18 48 -24 24z");
    			add_location(path21, file$5, 1172, 10, 88312);
    			attr_dev(path22, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path22, "d", "M9163 12698 c-13 -26 -17 -59 -17 -153 -1 -139 11 -170 88 -245 40\n    -39 86 -68 86 -55 0 3 -20 30 -44 59 -74 91 -95 198 -72 364 7 54 6 62 -7 62\n    -9 0 -24 -15 -34 -32z");
    			add_location(path22, file$5, 1176, 10, 88488);
    			attr_dev(path23, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path23, "d", "M8890 12643 c-46 -17 -100 -111 -100 -174 0 -102 146 -114 196 -17\n    34 65 15 157 -37 183 -30 16 -35 17 -59 8z m45 -75 c18 -44 11 -47 -25 -13\n    -35 34 -38 45 -10 45 14 0 26 -11 35 -32z m-10 -68 c10 -11 14 -20 8 -20 -5 0\n    -18 9 -28 20 -10 11 -14 20 -8 20 5 0 18 -9 28 -20z");
    			add_location(path23, file$5, 1181, 10, 88719);
    			attr_dev(path24, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path24, "d", "M10153 12610 c-133 -81 -62 -297 83 -250 76 25 111 114 76 194 -32\n    72 -96 95 -159 56z m103 -65 c25 -38 11 -41 -28 -6 -31 28 -31 30 -11 31 13 0\n    29 -11 39 -25z m-26 -110 c21 -26 -4 -17 -48 17 -23 18 -42 38 -42 46 0 14 63\n    -30 90 -63z");
    			add_location(path24, file$5, 1187, 10, 89057);
    			attr_dev(path25, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path25, "d", "M9864 12398 c-53 -99 -117 -162 -209 -204 -40 -19 -78 -34 -84 -34\n    -6 0 -11 -5 -11 -11 0 -28 177 22 234 66 67 51 146 197 130 240 -10 26 -20 17\n    -60 -57z");
    			add_location(path25, file$5, 1193, 10, 89359);
    			attr_dev(path26, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path26, "d", "M8843 12273 c-62 -12 -112 -106 -93 -173 14 -47 31 -67 72 -84 75\n    -32 158 36 158 129 0 79 -67 141 -137 128z m59 -70 c10 -9 18 -23 18 -31 0\n    -12 -6 -10 -25 8 -38 35 -31 58 7 23z m3 -73 c10 -11 14 -20 8 -20 -5 0 -18 9\n    -28 20 -10 11 -14 20 -8 20 5 0 18 -9 28 -20z");
    			add_location(path26, file$5, 1198, 10, 89578);
    			attr_dev(path27, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path27, "d", "M10160 12243 c-122 -62 -96 -263 35 -263 67 0 124 69 125 152 0 94\n    -81 151 -160 111z m95 -73 c19 -38 10 -38 -35 0 l-35 29 27 1 c21 0 31 -8 43\n    -30z m-59 -72 c24 -17 44 -35 44 -40 0 -10 -85 46 -95 62 -11 18 6 11 51 -22z\n    m-11 -56 c-7 -8 -35 7 -35 18 0 6 7 6 20 -2 10 -7 17 -14 15 -16z");
    			add_location(path27, file$5, 1204, 10, 89909);
    			attr_dev(path28, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path28, "d", "M6625 11991 c23 -10 201 -26 435 -41 354 -22 991 -38 978 -25 -2 2\n    -290 18 -639 35 -349 16 -670 32 -714 35 -48 3 -72 1 -60 -4z");
    			add_location(path28, file$5, 1210, 10, 90262);
    			attr_dev(path29, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path29, "d", "M6768 11761 c-86 -3 -160 -9 -164 -13 -9 -10 982 -8 1166 1 l135 8\n    -161 1 c-88 1 -309 4 -490 6 -181 2 -400 1 -486 -3z");
    			add_location(path29, file$5, 1214, 10, 90452);
    			attr_dev(path30, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path30, "d", "M6755 11649 c125 -10 390 -9 315 1 -30 5 -134 8 -230 7 -152 0 -163\n    -1 -85 -8z");
    			add_location(path30, file$5, 1218, 10, 90633);
    			attr_dev(path31, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path31, "d", "M11210 11612 c32 -21 732 -53 1095 -51 260 2 175 12 -280 33 -454 21\n    -834 30 -815 18z");
    			add_location(path31, file$5, 1222, 10, 90775);
    			attr_dev(path32, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path32, "d", "M12750 11480 c-28 -104 -77 -348 -170 -850 -28 -151 -65 -350 -84\n    -442 -18 -93 -30 -168 -27 -168 16 0 251 1143 291 1413 13 87 8 112 -10 47z");
    			add_location(path32, file$5, 1226, 10, 90924);
    			attr_dev(path33, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path33, "d", "M11688 11493 c-103 -9 -39 -20 155 -26 276 -9 407 -9 407 2 0 12\n    -470 33 -562 24z");
    			add_location(path33, file$5, 1230, 10, 91127);
    			attr_dev(path34, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path34, "d", "M8210 11393 c-542 -303 -1275 -731 -1267 -740 6 -6 187 85 317 160\n    155 89 1003 598 1015 608 16 16 1 9 -65 -28z");
    			add_location(path34, file$5, 1234, 10, 91272);
    			attr_dev(path35, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path35, "d", "M11776 11371 c13 -13 244 -26 244 -14 0 6 -41 13 -92 17 -126 9 -164\n    8 -152 -3z");
    			add_location(path35, file$5, 1238, 10, 91446);
    			attr_dev(path36, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path36, "d", "M7396 11145 c-225 -117 -245 -129 -232 -142 10 -11 340 168 456 246\n    50 34 -33 -4 -224 -104z");
    			add_location(path36, file$5, 1242, 10, 91589);
    			attr_dev(path37, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path37, "d", "M12734 9905 c3 -417 13 -712 53 -1545 13 -282 15 -112 4 325 -6 237\n    -18 702 -26 1035 -9 333 -20 619 -25 635 -6 19 -8 -150 -6 -450z");
    			add_location(path37, file$5, 1246, 10, 91744);
    			attr_dev(path38, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path38, "d", "M6776 5795 c-9 -238 1 -1220 13 -1335 9 -86 12 1336 2 1465 -6 95 -7\n    88 -15 -130z");
    			add_location(path38, file$5, 1250, 10, 91938);
    			attr_dev(path39, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path39, "d", "M12110 5833 c-74 -30 -331 -134 -570 -230 -456 -184 -974 -398 -1000\n    -413 -29 -18 -2 -10 71 21 41 17 238 93 439 171 564 216 1055 420 1189 493 50\n    27 4 12 -129 -42z");
    			add_location(path39, file$5, 1254, 10, 92083);
    			attr_dev(path40, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path40, "d", "M12660 5593 c1 -674 39 -2157 57 -2173 6 -5 -2 707 -17 1475 -15 762\n    -22 995 -31 995 -5 0 -9 -134 -9 -297z");
    			add_location(path40, file$5, 1259, 10, 92313);
    			attr_dev(path41, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path41, "d", "M6686 5428 c-14 -56 -28 -638 -22 -955 5 -315 24 -679 33 -669 3 2 3\n    152 2 333 -2 180 -2 550 0 821 2 270 1 492 -1 492 -3 0 -8 -10 -12 -22z");
    			add_location(path41, file$5, 1263, 10, 92483);
    			attr_dev(path42, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path42, "d", "M11713 5336 c-165 -69 -387 -175 -381 -182 5 -5 520 224 533 237 14\n    14 9 12 -152 -55z");
    			add_location(path42, file$5, 1267, 10, 92685);
    			attr_dev(path43, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path43, "d", "M10470 5160 c-8 -5 -10 -10 -5 -10 6 0 17 5 25 10 8 5 11 10 5 10 -5\n    0 -17 -5 -25 -10z");
    			add_location(path43, file$5, 1271, 10, 92834);
    			attr_dev(path44, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path44, "d", "M9255 4854 c-391 -116 -644 -193 -905 -276 -391 -123 -1324 -434\n    -1365 -454 l-30 -14 39 6 c71 10 262 70 826 259 642 215 1023 339 1305 425\n    231 70 226 68 200 69 -11 0 -42 -7 -70 -15z");
    			add_location(path44, file$5, 1275, 10, 92984);
    			attr_dev(path45, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path45, "d", "M12074 4363 c-131 -136 -314 -324 -406 -418 -91 -93 -165 -172 -163\n    -174 14 -14 244 207 505 484 138 147 313 346 308 351 -3 2 -113 -107 -244\n    -243z");
    			add_location(path45, file$5, 1280, 10, 93232);
    			attr_dev(path46, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path46, "d", "M8435 4353 c-163 -40 -851 -260 -841 -270 2 -3 71 14 153 37 249 71\n    834 268 688 233z");
    			add_location(path46, file$5, 1285, 10, 93445);
    			attr_dev(path47, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path47, "d", "M11958 3942 c-57 -49 -121 -106 -143 -127 -61 -58 -25 -55 43 3 71\n    63 219 212 209 212 -3 0 -53 -40 -109 -88z");
    			add_location(path47, file$5, 1289, 10, 93593);
    			attr_dev(path48, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path48, "d", "M8800 3863 c0 -26 259 -60 1090 -143 333 -33 685 -70 784 -81 98 -11\n    180 -18 182 -16 10 10 -489 72 -1046 132 -755 80 -979 105 -994 111 -9 3 -16\n    2 -16 -3z");
    			add_location(path48, file$5, 1293, 10, 93765);
    			attr_dev(path49, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path49, "d", "M7321 3846 c9 -9 343 -53 1574 -206 1219 -152 1476 -183 2415 -295\n    908 -108 1169 -137 1188 -133 9 2 -129 22 -308 46 -179 23 -444 58 -590 77\n    -1833 242 -3489 445 -3990 489 -96 9 -202 18 -235 22 -33 3 -57 3 -54 0z");
    			add_location(path49, file$5, 1298, 10, 93986);
    			attr_dev(path50, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path50, "d", "M12543 3203 c9 -2 23 -2 30 0 6 3 -1 5 -18 5 -16 0 -22 -2 -12 -5z");
    			add_location(path50, file$5, 1303, 10, 94264);
    			attr_dev(path51, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path51, "d", "M3853 10605 c-193 -52 -608 -251 -626 -300 -4 -8 -4 -15 0 -15 3 0\n    85 43 183 95 264 142 434 215 497 215 14 0 21 4 18 10 -7 12 -7 12 -72 -5z");
    			add_location(path51, file$5, 1306, 10, 94390);
    			attr_dev(path52, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path52, "d", "M5120 10285 c0 -15 85 -60 151 -80 24 -8 24 -8 5 14 -29 32 -110 81\n    -134 81 -13 0 -22 -6 -22 -15z");
    			add_location(path52, file$5, 1310, 10, 94593);
    			attr_dev(path53, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path53, "d", "M4232 10123 c-140 -159 -272 -320 -272 -331 0 -8 17 10 253 267 150\n    164 185 211 158 211 -5 0 -67 -66 -139 -147z");
    			add_location(path53, file$5, 1314, 10, 94754);
    			attr_dev(path54, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path54, "d", "M3032 10193 c-148 -76 -421 -350 -570 -570 -76 -113 -172 -329 -241\n    -547 -36 -113 -38 -164 -2 -66 111 304 266 576 455 797 107 125 167 182 324\n    306 61 49 110 93 106 98 -8 13 -15 12 -72 -18z");
    			add_location(path54, file$5, 1318, 10, 94929);
    			attr_dev(path55, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path55, "d", "M4268 10078 c-52 -64 -88 -121 -88 -138 0 -9 6 -5 17 10 9 14 41 53\n    70 88 29 35 53 67 53 73 0 19 -19 7 -52 -33z");
    			add_location(path55, file$5, 1323, 10, 95184);
    			attr_dev(path56, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path56, "d", "M5540 9956 c0 -3 29 -50 65 -105 72 -109 177 -314 236 -461 44 -109\n    51 -105 14 7 -80 239 -229 518 -295 553 -11 6 -20 8 -20 6z");
    			add_location(path56, file$5, 1327, 10, 95359);
    			attr_dev(path57, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path57, "d", "M3175 9868 c-2 -7 -11 -56 -20 -108 -28 -168 -85 -361 -180 -615 l-7\n    -20 14 20 c8 11 35 72 60 135 114 286 185 572 148 595 -6 3 -12 0 -15 -7z");
    			add_location(path57, file$5, 1331, 10, 95548);
    			attr_dev(path58, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path58, "d", "M3427 9823 c-3 -5 -19 -66 -37 -138 -48 -193 -145 -475 -289 -832\n    -28 -71 -16 -67 16 5 169 378 309 772 320 905 5 61 2 80 -10 60z");
    			add_location(path58, file$5, 1335, 10, 95752);
    			attr_dev(path59, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path59, "d", "M5294 9625 c29 -166 122 -483 193 -652 32 -77 20 -19 -28 132 -27 88\n    -70 243 -95 345 -25 102 -52 192 -61 200 -14 14 -15 11 -9 -25z");
    			add_location(path59, file$5, 1339, 10, 95944);
    			attr_dev(path60, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path60, "d", "M3000 9458 c-53 -190 -57 -209 -30 -145 25 61 82 273 78 292 -2 8\n    -23 -58 -48 -147z");
    			add_location(path60, file$5, 1343, 10, 96138);
    			attr_dev(path61, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path61, "d", "M4977 9530 c-16 -36 -23 -159 -15 -253 16 -190 65 -353 239 -796 59\n    -150 41 -69 -32 145 -146 426 -169 520 -178 754 -4 91 -10 158 -14 150z");
    			add_location(path61, file$5, 1347, 10, 96285);
    			attr_dev(path62, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path62, "d", "M4602 9323 c-71 -97 -190 -293 -374 -613 -147 -255 -406 -697 -449\n    -766 -22 -33 -39 -65 -39 -70 0 -24 283 430 553 886 77 130 375 637 384 653 2\n    4 2 7 0 7 -2 0 -36 -44 -75 -97z");
    			add_location(path62, file$5, 1351, 10, 96486);
    			attr_dev(path63, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path63, "d", "M5440 9363 c0 -45 86 -360 96 -350 5 5 -38 210 -63 300 -16 58 -33\n    84 -33 50z");
    			add_location(path63, file$5, 1356, 10, 96728);
    			attr_dev(path64, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path64, "d", "M4269 9192 c-172 -241 -462 -729 -484 -812 -3 -14 20 22 53 80 105\n    187 312 525 440 718 41 62 73 114 71 117 -2 2 -38 -44 -80 -103z");
    			add_location(path64, file$5, 1360, 10, 96869);
    			attr_dev(path65, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path65, "d", "M5956 9193 c-4 -9 6 -80 21 -157 48 -247 35 -568 -36 -896 -11 -47\n    -17 -87 -15 -89 19 -19 107 305 124 459 17 140 7 405 -19 531 -29 142 -57 199\n    -75 152z");
    			add_location(path65, file$5, 1364, 10, 97062);
    			attr_dev(path66, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path66, "d", "M5877 8945 c8 -158 -35 -606 -82 -851 -16 -85 -15 -106 3 -45 68 225\n    126 732 103 894 -18 126 -31 127 -24 2z");
    			add_location(path66, file$5, 1369, 10, 97281);
    			attr_dev(path67, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path67, "d", "M5130 8960 c0 -24 70 -237 103 -310 27 -60 18 -12 -18 105 -46 146\n    -84 239 -85 205z");
    			add_location(path67, file$5, 1373, 10, 97452);
    			attr_dev(path68, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path68, "d", "M2811 8811 c-62 -144 -88 -386 -71 -654 13 -206 49 -599 55 -606 7\n    -6 6 22 -10 334 -17 327 -19 562 -5 660 8 58 46 226 66 298 11 38 -15 14 -35\n    -32z");
    			add_location(path68, file$5, 1377, 10, 97599);
    			attr_dev(path69, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path69, "d", "M5741 8528 c-7 -144 -15 -267 -18 -275 -3 -7 -1 -13 5 -13 22 0 57\n    530 35 543 -6 4 -14 -92 -22 -255z");
    			add_location(path69, file$5, 1382, 10, 97813);
    			attr_dev(path70, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path70, "d", "M2172 8743 c-11 -28 -8 -361 3 -372 7 -7 10 32 10 117 0 70 4 160 8\n    200 6 50 5 72 -3 72 -6 0 -14 -8 -18 -17z");
    			add_location(path70, file$5, 1386, 10, 97977);
    			attr_dev(path71, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path71, "d", "M4302 8563 c-173 -293 -364 -644 -377 -693 -4 -14 31 43 78 125 46\n    83 132 231 191 330 115 194 193 342 184 351 -3 3 -37 -48 -76 -113z");
    			add_location(path71, file$5, 1390, 10, 98149);
    			attr_dev(path72, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path72, "d", "M2451 8587 c-37 -97 -4 -548 48 -667 l12 -25 -6 25 c-23 110 -38 300\n    -39 482 -1 115 -2 208 -4 208 -1 0 -6 -10 -11 -23z");
    			add_location(path72, file$5, 1394, 10, 98345);
    			attr_dev(path73, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path73, "d", "M3175 8502 c-14 -122 46 -424 129 -655 33 -92 65 -161 66 -144 0 5\n    -18 66 -40 135 -75 242 -112 423 -126 625 -4 53 -10 97 -14 97 -5 0 -11 -26\n    -15 -58z");
    			add_location(path73, file$5, 1398, 10, 98527);
    			attr_dev(path74, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path74, "d", "M2646 8427 c-8 -74 -7 -240 4 -322 15 -121 75 -425 83 -425 5 0 6 8\n    3 18 -25 81 -66 503 -66 674 0 106 -14 138 -24 55z");
    			add_location(path74, file$5, 1403, 10, 98744);
    			attr_dev(path75, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path75, "d", "M3315 8330 c-19 -88 75 -410 136 -466 14 -13 12 -3 -11 42 -37 75\n    -86 265 -95 372 -8 85 -19 104 -30 52z");
    			add_location(path75, file$5, 1407, 10, 98925);
    			attr_dev(path76, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path76, "d", "M5197 7770 c-58 -121 -229 -370 -319 -465 -141 -150 -265 -214 -503\n    -262 -137 -27 -373 -25 -485 5 -147 39 -294 118 -396 213 -49 45 -125 127\n    -147 158 -25 37 -31 18 -9 -31 26 -58 141 -175 229 -232 165 -107 326 -155\n    543 -163 229 -8 413 31 594 125 100 53 186 134 286 267 90 122 216 342 249\n    435 19 57 -4 28 -42 -50z");
    			add_location(path76, file$5, 1411, 10, 99092);
    			attr_dev(path77, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path77, "d", "M5743 7697 c-50 -78 -135 -205 -188 -282 -114 -165 -113 -164 -93\n    -147 24 19 177 224 241 323 64 98 141 238 135 244 -2 3 -45 -60 -95 -138z");
    			add_location(path77, file$5, 1418, 10, 99478);
    			attr_dev(path78, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path78, "d", "M4844 7557 c-53 -82 -152 -191 -233 -258 -49 -41 -88 -76 -86 -77 2\n    -2 24 6 50 17 80 35 227 197 289 319 21 42 7 41 -20 -1z");
    			add_location(path78, file$5, 1422, 10, 99679);
    			attr_dev(path79, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path79, "d", "M8828 10038 c-8 -21 2 -38 24 -38 14 0 19 6 16 22 -3 25 -33 36 -40\n    16z");
    			add_location(path79, file$5, 1426, 10, 99865);
    			attr_dev(path80, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path80, "d", "M8737 9963 c-11 -10 -8 -41 4 -49 17 -10 32 12 24 35 -6 21 -16 26\n    -28 14z");
    			add_location(path80, file$5, 1430, 10, 100000);
    			attr_dev(path81, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path81, "d", "M8813 9944 c-3 -9 0 -20 8 -24 18 -12 50 7 43 25 -8 20 -43 19 -51\n    -1z");
    			add_location(path81, file$5, 1434, 10, 100138);
    			attr_dev(path82, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path82, "d", "M8790 9865 c-10 -11 -10 -19 -2 -27 15 -15 44 -2 40 19 -4 23 -22 27\n    -38 8z");
    			add_location(path82, file$5, 1438, 10, 100272);
    			attr_dev(path83, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path83, "d", "M8690 9775 c-11 -13 -11 -19 2 -32 17 -16 38 -10 38 11 0 8 -6 19\n    -14 25 -10 9 -16 8 -26 -4z");
    			add_location(path83, file$5, 1442, 10, 100411);
    			attr_dev(path84, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path84, "d", "M8780 9699 c-10 -17 -9 -24 4 -37 15 -15 17 -15 33 1 13 13 15 21 7\n    34 -16 26 -31 26 -44 2z");
    			add_location(path84, file$5, 1446, 10, 100567);
    			attr_dev(path85, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path85, "d", "M8585 9700 c-8 -14 13 -40 32 -40 20 0 12 44 -9 48 -9 2 -19 -2 -23\n    -8z");
    			add_location(path85, file$5, 1450, 10, 100722);
    			attr_dev(path86, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path86, "d", "M8701 9677 c-14 -17 -4 -47 15 -47 22 0 29 29 12 46 -13 13 -16 13\n    -27 1z");
    			add_location(path86, file$5, 1454, 10, 100857);
    			attr_dev(path87, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path87, "d", "M8592 9598 c5 -34 38 -37 38 -4 0 20 -5 26 -21 26 -15 0 -20 -5 -17\n    -22z");
    			add_location(path87, file$5, 1458, 10, 100994);
    			attr_dev(path88, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path88, "d", "M8782 9568 c-16 -16 -15 -33 2 -47 21 -18 41 11 26 38 -13 25 -12 25\n    -28 9z");
    			add_location(path88, file$5, 1462, 10, 101130);
    			attr_dev(path89, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path89, "d", "M8602 9551 c-21 -13 -11 -56 13 -56 15 0 20 7 20 29 0 31 -12 41 -33\n    27z");
    			add_location(path89, file$5, 1466, 10, 101269);
    			attr_dev(path90, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path90, "d", "M8701 9496 c-9 -10 -8 -16 4 -26 13 -11 19 -10 33 4 15 15 15 18 2\n    26 -20 13 -26 12 -39 -4z");
    			add_location(path90, file$5, 1470, 10, 101405);
    			attr_dev(path91, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path91, "d", "M8781 9446 c-17 -20 13 -43 34 -26 8 7 15 19 15 26 0 18 -34 18 -49\n    0z");
    			add_location(path91, file$5, 1474, 10, 101560);
    			attr_dev(path92, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path92, "d", "M8492 9438 c-15 -15 3 -48 27 -48 25 0 34 26 15 45 -18 18 -26 19\n    -42 3z");
    			add_location(path92, file$5, 1478, 10, 101694);
    			attr_dev(path93, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path93, "d", "M8707 9403 c-11 -10 -8 -38 4 -50 18 -18 39 -3 39 28 0 21 -5 29 -18\n    29 -10 0 -22 -3 -25 -7z");
    			add_location(path93, file$5, 1482, 10, 101830);
    			attr_dev(path94, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path94, "d", "M8605 9379 c-10 -30 18 -58 40 -39 22 18 15 54 -12 58 -15 2 -23 -3\n    -28 -19z");
    			add_location(path94, file$5, 1486, 10, 101986);
    			attr_dev(path95, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path95, "d", "M8431 9381 c-19 -12 -6 -43 16 -39 10 2 18 12 18 22 0 22 -14 29 -34\n    17z");
    			add_location(path95, file$5, 1490, 10, 102126);
    			attr_dev(path96, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path96, "d", "M8797 9384 c-4 -4 -7 -18 -7 -31 0 -17 6 -23 21 -23 16 0 20 5 17 27\n    -3 26 -18 39 -31 27z");
    			add_location(path96, file$5, 1494, 10, 102262);
    			attr_dev(path97, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path97, "d", "M8527 9302 c-13 -14 -14 -21 -5 -30 18 -18 36 -14 43 8 12 38 -11 52\n    -38 22z");
    			add_location(path97, file$5, 1498, 10, 102415);
    			attr_dev(path98, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path98, "d", "M8705 9269 c-10 -30 18 -58 40 -39 22 18 15 54 -12 58 -15 2 -23 -3\n    -28 -19z");
    			add_location(path98, file$5, 1502, 10, 102555);
    			attr_dev(path99, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path99, "d", "M8633 9273 c-17 -6 -17 -60 0 -66 23 -9 39 9 35 38 -3 29 -13 37 -35\n    28z");
    			add_location(path99, file$5, 1506, 10, 102695);
    			attr_dev(path100, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path100, "d", "M8430 9206 c0 -27 22 -40 38 -24 8 8 8 17 1 30 -14 26 -39 23 -39 -6z");
    			add_location(path100, file$5, 1510, 10, 102831);
    			attr_dev(path101, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path101, "d", "M8530 9201 c-12 -23 -5 -47 17 -55 23 -9 33 2 33 40 0 27 -4 34 -20\n    34 -10 0 -24 -9 -30 -19z");
    			add_location(path101, file$5, 1513, 10, 102960);
    			attr_dev(path102, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path102, "d", "M8793 9174 c-8 -20 9 -49 28 -49 8 0 15 13 17 33 3 27 0 32 -18 32\n    -11 0 -23 -7 -27 -16z");
    			add_location(path102, file$5, 1517, 10, 103116);
    			attr_dev(path103, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path103, "d", "M8725 9164 c-11 -12 -12 -20 -5 -35 18 -33 63 -16 53 21 -7 26 -29\n    32 -48 14z");
    			add_location(path103, file$5, 1521, 10, 103268);
    			attr_dev(path104, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path104, "d", "M8450 9135 c-15 -18 -6 -45 13 -45 8 0 20 7 27 15 10 12 10 18 0 30\n    -16 19 -24 19 -40 0z");
    			add_location(path104, file$5, 1525, 10, 103409);
    			attr_dev(path105, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path105, "d", "M8634 9125 c-9 -23 3 -45 26 -45 20 0 25 15 14 44 -8 20 -33 21 -40\n    1z");
    			add_location(path105, file$5, 1529, 10, 103561);
    			attr_dev(path106, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path106, "d", "M8377 9073 c-12 -12 -7 -51 7 -56 20 -8 39 18 31 43 -6 20 -25 26\n    -38 13z");
    			add_location(path106, file$5, 1533, 10, 103695);
    			attr_dev(path107, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path107, "d", "M8752 9038 c-16 -16 -15 -33 4 -48 22 -19 54 12 38 37 -14 22 -27 26\n    -42 11z");
    			add_location(path107, file$5, 1537, 10, 103832);
    			attr_dev(path108, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path108, "d", "M8476 9018 c-11 -15 -12 -26 -5 -40 19 -36 63 -9 52 33 -7 27 -31 31\n    -47 7z");
    			add_location(path108, file$5, 1541, 10, 103972);
    			attr_dev(path109, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path109, "d", "M8547 8998 c-6 -18 11 -48 28 -48 19 0 25 12 18 38 -6 24 -38 30 -46\n    10z");
    			add_location(path109, file$5, 1545, 10, 104111);
    			attr_dev(path110, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path110, "d", "M8647 8966 c-7 -18 3 -56 14 -56 14 0 41 48 34 60 -9 15 -42 12 -48\n    -4z");
    			add_location(path110, file$5, 1549, 10, 104247);
    			attr_dev(path111, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path111, "d", "M8391 8951 c-7 -13 -6 -24 3 -36 16 -22 36 -12 36 20 0 29 -26 40\n    -39 16z");
    			add_location(path111, file$5, 1553, 10, 104382);
    			attr_dev(path112, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path112, "d", "M8852 8933 c2 -10 13 -19 26 -21 17 -3 22 2 22 17 0 16 -6 21 -26 21\n    -19 0 -25 -5 -22 -17z");
    			add_location(path112, file$5, 1557, 10, 104519);
    			attr_dev(path113, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path113, "d", "M8487 8913 c-10 -9 -9 -43 1 -43 18 0 45 28 38 38 -8 13 -29 16 -39\n    5z");
    			add_location(path113, file$5, 1561, 10, 104673);
    			attr_dev(path114, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path114, "d", "M8584 8907 c-11 -29 0 -62 22 -65 27 -4 36 18 21 48 -15 29 -35 37\n    -43 17z");
    			add_location(path114, file$5, 1565, 10, 104807);
    			attr_dev(path115, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path115, "d", "M8773 8854 c-3 -8 2 -23 11 -32 15 -15 17 -15 33 0 13 14 14 20 3 32\n    -16 20 -39 20 -47 0z");
    			add_location(path115, file$5, 1569, 10, 104945);
    			attr_dev(path116, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path116, "d", "M8863 8814 c-4 -11 1 -22 12 -31 16 -11 21 -11 33 1 8 8 12 22 9 30\n    -8 21 -46 21 -54 0z");
    			add_location(path116, file$5, 1573, 10, 105098);
    			attr_dev(path117, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path117, "d", "M8694 8795 c-7 -18 3 -35 21 -35 18 0 26 15 19 34 -8 20 -33 21 -40\n    1z");
    			add_location(path117, file$5, 1577, 10, 105249);
    			attr_dev(path118, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path118, "d", "M8522 8788 c-16 -16 -15 -33 4 -48 12 -11 18 -11 30 2 13 12 14 20 5\n    37 -13 24 -22 26 -39 9z");
    			add_location(path118, file$5, 1581, 10, 105383);
    			attr_dev(path119, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path119, "d", "M8605 8780 c-8 -24 11 -60 31 -60 19 0 28 24 20 55 -8 30 -42 34 -51\n    5z");
    			add_location(path119, file$5, 1585, 10, 105539);
    			attr_dev(path120, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path120, "d", "M8764 8729 c-3 -6 1 -18 10 -27 15 -15 17 -15 32 0 19 19 11 38 -16\n    38 -10 0 -22 -5 -26 -11z");
    			add_location(path120, file$5, 1589, 10, 105674);
    			attr_dev(path121, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path121, "d", "M8440 8715 c-22 -27 12 -49 38 -23 8 8 9 15 1 25 -15 17 -24 16 -39\n    -2z");
    			add_location(path121, file$5, 1593, 10, 105830);
    			attr_dev(path122, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path122, "d", "M8920 8706 c0 -20 5 -26 21 -26 15 0 20 5 17 22 -5 34 -38 37 -38 4z");
    			add_location(path122, file$5, 1597, 10, 105965);
    			attr_dev(path123, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path123, "d", "M8550 8675 c-15 -17 -5 -35 20 -35 19 0 30 17 23 38 -6 16 -28 15\n    -43 -3z");
    			add_location(path123, file$5, 1600, 10, 106093);
    			attr_dev(path124, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path124, "d", "M8825 8680 c-4 -7 -3 -16 3 -22 14 -14 47 -6 47 12 0 18 -40 26 -50\n    10z");
    			add_location(path124, file$5, 1604, 10, 106230);
    			attr_dev(path125, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path125, "d", "M8641 8666 c-15 -18 2 -56 24 -56 19 0 29 38 15 55 -16 19 -24 19\n    -39 1z");
    			add_location(path125, file$5, 1608, 10, 106365);
    			attr_dev(path126, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path126, "d", "M8734 8646 c-8 -21 13 -46 32 -39 20 8 13 47 -9 51 -9 2 -20 -4 -23\n    -12z");
    			add_location(path126, file$5, 1612, 10, 106501);
    			attr_dev(path127, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path127, "d", "M8866 8574 c-7 -19 10 -44 30 -44 15 0 18 18 8 44 -8 21 -30 20 -38\n    0z");
    			add_location(path127, file$5, 1616, 10, 106637);
    			attr_dev(path128, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path128, "d", "M8983 8583 c-18 -6 -16 -48 2 -63 11 -9 18 -10 29 -1 24 20 -2 74\n    -31 64z");
    			add_location(path128, file$5, 1620, 10, 106771);
    			attr_dev(path129, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path129, "d", "M8475 8570 c-8 -13 13 -50 29 -50 17 0 27 25 20 45 -7 17 -40 20 -49\n    5z");
    			add_location(path129, file$5, 1624, 10, 106908);
    			attr_dev(path130, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path130, "d", "M8587 8566 c-18 -18 -12 -52 10 -60 21 -9 33 2 33 28 0 34 -24 51\n    -43 32z");
    			add_location(path130, file$5, 1628, 10, 107043);
    			attr_dev(path131, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path131, "d", "M8756 8532 c-7 -11 4 -52 14 -52 15 0 32 30 26 45 -6 16 -31 20 -40\n    7z");
    			add_location(path131, file$5, 1632, 10, 107180);
    			attr_dev(path132, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path132, "d", "M8666 8505 c-8 -22 4 -45 24 -45 10 0 20 7 24 15 8 22 -4 45 -24 45\n    -10 0 -20 -7 -24 -15z");
    			add_location(path132, file$5, 1636, 10, 107314);
    			attr_dev(path133, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path133, "d", "M8914 8475 c-8 -21 3 -45 20 -45 20 0 29 16 21 40 -7 23 -33 27 -41\n    5z");
    			add_location(path133, file$5, 1640, 10, 107467);
    			attr_dev(path134, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path134, "d", "M8421 8462 c-7 -14 -6 -25 4 -38 7 -11 15 -33 17 -49 2 -22 8 -30 23\n    -30 22 0 32 34 19 63 -4 9 -6 21 -5 25 3 15 -20 47 -34 47 -8 0 -19 -8 -24\n    -18z");
    			add_location(path134, file$5, 1644, 10, 107601);
    			attr_dev(path135, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path135, "d", "M8514 8445 c-7 -17 12 -45 31 -45 16 0 26 25 19 45 -8 19 -43 19 -50\n    0z");
    			add_location(path135, file$5, 1649, 10, 107815);
    			attr_dev(path136, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path136, "d", "M8624 8446 c-11 -28 1 -61 22 -64 29 -4 39 25 19 54 -18 27 -33 31\n    -41 10z");
    			add_location(path136, file$5, 1653, 10, 107950);
    			attr_dev(path137, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path137, "d", "M8809 8428 c-4 -42 17 -66 40 -44 18 19 5 56 -20 56 -10 0 -20 -6\n    -20 -12z");
    			add_location(path137, file$5, 1657, 10, 108088);
    			attr_dev(path138, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path138, "d", "M9043 8399 c-19 -19 4 -58 33 -59 18 0 25 29 14 51 -12 21 -30 25\n    -47 8z");
    			add_location(path138, file$5, 1661, 10, 108226);
    			attr_dev(path139, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path139, "d", "M8716 8384 c-9 -23 19 -53 35 -37 15 15 7 47 -12 51 -9 2 -19 -5 -23\n    -14z");
    			add_location(path139, file$5, 1665, 10, 108362);
    			attr_dev(path140, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path140, "d", "M8645 8350 c-8 -24 11 -60 31 -60 19 0 28 24 20 55 -8 30 -42 34 -51\n    5z");
    			add_location(path140, file$5, 1669, 10, 108499);
    			attr_dev(path141, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path141, "d", "M8887 8356 c-9 -22 19 -41 38 -26 8 7 15 19 15 26 0 19 -46 18 -53 0z");
    			add_location(path141, file$5, 1673, 10, 108634);
    			attr_dev(path142, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path142, "d", "M8987 8323 c-12 -11 -8 -40 8 -53 12 -10 18 -10 30 0 19 16 19 25 -1\n    44 -17 17 -27 20 -37 9z");
    			add_location(path142, file$5, 1676, 10, 108763);
    			attr_dev(path143, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path143, "d", "M8759 8299 c-9 -17 -8 -25 4 -37 19 -18 47 -9 47 16 0 18 -18 42 -32\n    42 -4 0 -12 -10 -19 -21z");
    			add_location(path143, file$5, 1680, 10, 108919);
    			attr_dev(path144, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path144, "d", "M9097 8286 c-7 -19 17 -51 31 -42 20 12 15 56 -7 56 -10 0 -21 -6\n    -24 -14z");
    			add_location(path144, file$5, 1684, 10, 109076);
    			attr_dev(path145, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path145, "d", "M8564 8275 c-4 -10 0 -24 10 -33 16 -16 18 -16 32 3 18 24 13 39 -14\n    43 -14 2 -25 -3 -28 -13z");
    			add_location(path145, file$5, 1688, 10, 109214);
    			attr_dev(path146, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path146, "d", "M8884 8276 c-8 -21 13 -46 32 -39 20 8 13 47 -9 51 -9 2 -20 -4 -23\n    -12z");
    			add_location(path146, file$5, 1692, 10, 109371);
    			attr_dev(path147, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path147, "d", "M8497 8264 c-4 -4 -7 -18 -7 -31 0 -20 5 -24 23 -21 16 2 22 10 22\n    28 0 24 -23 39 -38 24z");
    			add_location(path147, file$5, 1696, 10, 109507);
    			attr_dev(path148, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path148, "d", "M8690 8250 c-13 -8 -13 -11 2 -27 21 -20 45 -5 35 21 -7 18 -16 20\n    -37 6z");
    			add_location(path148, file$5, 1700, 10, 109660);
    			attr_dev(path149, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path149, "d", "M8961 8221 c-17 -11 -5 -51 15 -51 8 0 17 7 21 16 8 21 -18 46 -36\n    35z");
    			add_location(path149, file$5, 1704, 10, 109797);
    			attr_dev(path150, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path150, "d", "M8720 8175 c-6 -8 -9 -23 -5 -35 7 -23 40 -27 49 -5 13 34 -23 66\n    -44 40z");
    			add_location(path150, file$5, 1708, 10, 109931);
    			attr_dev(path151, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path151, "d", "M9046 8175 c-9 -25 5 -45 31 -45 13 0 31 -7 39 -15 20 -19 46 -8 42\n    19 -2 14 -12 22 -28 24 -14 2 -29 10 -33 18 -11 19 -43 18 -51 -1z");
    			add_location(path151, file$5, 1712, 10, 110068);
    			attr_dev(path152, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path152, "d", "M8820 8155 c0 -18 5 -25 20 -25 15 0 20 7 20 25 0 18 -5 25 -20 25\n    -15 0 -20 -7 -20 -25z");
    			add_location(path152, file$5, 1716, 10, 110264);
    			attr_dev(path153, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path153, "d", "M8530 8155 c-16 -19 2 -65 25 -65 22 0 30 27 17 56 -13 28 -24 30\n    -42 9z");
    			add_location(path153, file$5, 1720, 10, 110416);
    			attr_dev(path154, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path154, "d", "M8637 8143 c-13 -13 -7 -51 10 -57 23 -9 35 7 27 38 -6 25 -23 34\n    -37 19z");
    			add_location(path154, file$5, 1724, 10, 110552);
    			attr_dev(path155, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path155, "d", "M9186 8141 c-10 -16 5 -41 26 -41 14 0 19 6 16 22 -3 24 -32 36 -42\n    19z");
    			add_location(path155, file$5, 1728, 10, 110689);
    			attr_dev(path156, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path156, "d", "M8957 8123 c-12 -11 -7 -40 9 -53 21 -18 46 6 38 38 -6 21 -33 30\n    -47 15z");
    			add_location(path156, file$5, 1732, 10, 110824);
    			attr_dev(path157, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path157, "d", "M8762 8088 c-23 -23 -7 -68 24 -68 18 0 27 36 14 60 -12 23 -21 25\n    -38 8z");
    			add_location(path157, file$5, 1736, 10, 110961);
    			attr_dev(path158, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path158, "d", "M8860 8075 c-16 -19 3 -45 31 -45 22 0 26 29 7 48 -16 16 -23 15 -38\n    -3z");
    			add_location(path158, file$5, 1740, 10, 111098);
    			attr_dev(path159, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path159, "d", "M9140 8035 c-11 -13 -11 -19 2 -32 17 -16 38 -10 38 11 0 8 -6 19\n    -14 25 -10 9 -16 8 -26 -4z");
    			add_location(path159, file$5, 1744, 10, 111234);
    			attr_dev(path160, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path160, "d", "M8718 8006 c-30 -30 6 -82 38 -55 18 15 18 22 -4 49 -17 21 -19 21\n    -34 6z");
    			add_location(path160, file$5, 1748, 10, 111390);
    			attr_dev(path161, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path161, "d", "M9031 8006 c-15 -17 -7 -52 14 -59 19 -8 37 17 33 45 -4 27 -30 35\n    -47 14z");
    			add_location(path161, file$5, 1752, 10, 111527);
    			attr_dev(path162, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path162, "d", "M8905 7990 c-8 -25 1 -40 25 -40 22 0 30 19 18 43 -12 23 -35 22 -43\n    -3z");
    			add_location(path162, file$5, 1756, 10, 111665);
    			attr_dev(path163, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path163, "d", "M9210 7985 c-11 -13 -11 -19 3 -33 20 -19 41 -5 35 24 -4 24 -22 28\n    -38 9z");
    			add_location(path163, file$5, 1760, 10, 111801);
    			attr_dev(path164, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path164, "d", "M8821 7946 c-6 -7 -9 -21 -5 -30 4 -10 1 -16 -9 -16 -22 0 -32 -39\n    -14 -57 12 -13 16 -12 31 2 9 10 15 22 13 29 -2 6 5 15 16 21 27 14 31 29 12\n    49 -20 20 -29 20 -44 2z");
    			add_location(path164, file$5, 1764, 10, 111939);
    			attr_dev(path165, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path165, "d", "M9120 7940 c-13 -8 -13 -11 3 -27 16 -16 18 -16 33 -1 28 27 -1 50\n    -36 28z");
    			add_location(path165, file$5, 1769, 10, 112172);
    			attr_dev(path166, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path166, "d", "M9312 7938 c-17 -17 -15 -36 6 -46 23 -12 42 -4 42 17 0 16 -18 41\n    -30 41 -3 0 -11 -5 -18 -12z");
    			add_location(path166, file$5, 1773, 10, 112310);
    			attr_dev(path167, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path167, "d", "M8956 7915 c-9 -10 -15 -24 -12 -32 3 -8 6 -17 6 -19 0 -2 8 -4 19\n    -4 23 0 33 33 17 56 -11 15 -14 15 -30 -1z");
    			add_location(path167, file$5, 1777, 10, 112468);
    			attr_dev(path168, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path168, "d", "M8879 7868 c-4 -42 17 -66 40 -44 18 19 5 56 -20 56 -10 0 -20 -6\n    -20 -12z");
    			add_location(path168, file$5, 1781, 10, 112640);
    			attr_dev(path169, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path169, "d", "M9095 7870 c-8 -13 13 -50 28 -50 23 0 37 22 26 42 -10 19 -44 25\n    -54 8z");
    			add_location(path169, file$5, 1785, 10, 112778);
    			attr_dev(path170, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path170, "d", "M9231 7866 c-23 -27 17 -68 45 -45 13 11 8 39 -10 51 -16 11 -22 10\n    -35 -6z");
    			add_location(path170, file$5, 1789, 10, 112914);
    			attr_dev(path171, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path171, "d", "M9395 7824 c-8 -9 -22 -14 -30 -11 -18 7 -39 -18 -31 -38 7 -19 20\n    -19 38 -1 10 9 20 11 30 5 25 -14 51 16 38 42 -13 23 -24 24 -45 3z");
    			add_location(path171, file$5, 1793, 10, 113053);
    			attr_dev(path172, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path172, "d", "M9030 7805 c-10 -12 -10 -18 0 -30 21 -25 42 -18 38 12 -4 32 -20 40\n    -38 18z");
    			add_location(path172, file$5, 1797, 10, 113249);
    			attr_dev(path173, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path173, "d", "M8940 7756 c0 -28 24 -51 45 -42 19 7 19 30 -1 50 -23 24 -44 20 -44\n    -8z");
    			add_location(path173, file$5, 1801, 10, 113389);
    			attr_dev(path174, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path174, "d", "M9180 7765 c-16 -19 3 -45 31 -45 24 0 26 45 3 54 -21 8 -20 8 -34\n    -9z");
    			add_location(path174, file$5, 1805, 10, 113525);
    			attr_dev(path175, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path175, "d", "M8845 7760 c-11 -18 6 -50 25 -50 24 0 33 15 25 40 -7 21 -39 27 -50\n    10z");
    			add_location(path175, file$5, 1809, 10, 113659);
    			attr_dev(path176, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path176, "d", "M9509 7734 c-11 -14 -10 -18 5 -29 21 -16 46 -9 46 11 0 23 -36 36\n    -51 18z");
    			add_location(path176, file$5, 1813, 10, 113795);
    			attr_dev(path177, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path177, "d", "M9091 7731 c-19 -12 -6 -43 16 -39 10 2 18 12 18 22 0 22 -14 29 -34\n    17z");
    			add_location(path177, file$5, 1817, 10, 113933);
    			attr_dev(path178, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path178, "d", "M9260 7716 c0 -20 5 -26 21 -26 15 0 20 5 17 22 -5 34 -38 37 -38 4z");
    			add_location(path178, file$5, 1821, 10, 114069);
    			attr_dev(path179, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path179, "d", "M9340 7700 c0 -23 26 -38 41 -23 14 14 0 43 -22 43 -12 0 -19 -7 -19\n    -20z");
    			add_location(path179, file$5, 1824, 10, 114197);
    			attr_dev(path180, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path180, "d", "M9013 7673 c-18 -6 -16 -49 3 -67 30 -30 49 -13 39 33 -6 30 -21 41\n    -42 34z");
    			add_location(path180, file$5, 1828, 10, 114334);
    			attr_dev(path181, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path181, "d", "M9113 7654 c-7 -20 11 -38 31 -31 9 4 12 13 9 26 -6 25 -31 28 -40 5z");
    			add_location(path181, file$5, 1832, 10, 114473);
    			attr_dev(path182, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path182, "d", "M9433 7653 c-17 -6 -16 -28 0 -42 10 -8 19 -7 32 3 16 12 17 16 6 30\n    -14 17 -18 18 -38 9z");
    			add_location(path182, file$5, 1835, 10, 114602);
    			attr_dev(path183, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path183, "d", "M9286 7635 c-19 -20 -20 -27 -4 -43 21 -21 48 -14 48 12 0 34 -24 51\n    -44 31z");
    			add_location(path183, file$5, 1839, 10, 114755);
    			attr_dev(path184, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path184, "d", "M9621 7640 c-19 -11 -9 -54 13 -58 25 -5 39 12 32 36 -8 24 -28 33\n    -45 22z");
    			add_location(path184, file$5, 1843, 10, 114895);
    			attr_dev(path185, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path185, "d", "M9530 7625 c-10 -12 -10 -19 -2 -27 7 -7 12 -25 12 -40 0 -38 42 -60\n    67 -36 14 15 13 19 -12 42 -15 14 -24 30 -20 36 7 11 -11 40 -25 40 -4 0 -13\n    -7 -20 -15z");
    			add_location(path185, file$5, 1847, 10, 115033);
    			attr_dev(path186, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path186, "d", "M9080 7565 c-10 -12 -9 -20 4 -40 18 -28 44 -33 52 -10 6 16 -20 65\n    -35 65 -5 0 -14 -7 -21 -15z");
    			add_location(path186, file$5, 1852, 10, 115256);
    			attr_dev(path187, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path187, "d", "M9200 7556 c0 -21 5 -26 26 -26 21 0 25 4 22 23 -2 14 -11 23 -25 25\n    -19 3 -23 -1 -23 -22z");
    			add_location(path187, file$5, 1856, 10, 115415);
    			attr_dev(path188, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path188, "d", "M9004 7545 c-9 -23 3 -45 26 -45 22 0 25 12 10 41 -13 23 -28 25 -36\n    4z");
    			add_location(path188, file$5, 1860, 10, 115569);
    			attr_dev(path189, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path189, "d", "M9720 7551 c0 -23 14 -41 30 -41 19 0 30 17 23 38 -5 14 -53 17 -53\n    3z");
    			add_location(path189, file$5, 1864, 10, 115704);
    			attr_dev(path190, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path190, "d", "M9646 7525 c-21 -22 -17 -50 8 -50 29 0 44 31 25 51 -15 14 -18 14\n    -33 -1z");
    			add_location(path190, file$5, 1868, 10, 115838);
    			attr_dev(path191, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path191, "d", "M9466 7517 c-16 -12 -17 -14 -1 -27 14 -11 18 -11 32 2 8 9 12 21 9\n    27 -9 14 -18 14 -40 -2z");
    			add_location(path191, file$5, 1872, 10, 115976);
    			attr_dev(path192, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path192, "d", "M9264 7505 c-9 -23 3 -45 26 -45 23 0 27 29 8 48 -16 16 -27 15 -34\n    -3z");
    			add_location(path192, file$5, 1876, 10, 116131);
    			attr_dev(path193, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path193, "d", "M9350 7501 c0 -10 7 -24 16 -31 12 -11 18 -11 30 2 20 20 7 48 -22\n    48 -17 0 -24 -6 -24 -19z");
    			add_location(path193, file$5, 1880, 10, 116266);
    			attr_dev(path194, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path194, "d", "M9146 7484 c-8 -21 19 -64 39 -64 9 0 21 -11 27 -25 13 -30 56 -45\n    68 -24 12 18 -5 46 -39 63 -15 8 -36 26 -45 40 -19 30 -41 34 -50 10z");
    			add_location(path194, file$5, 1884, 10, 116421);
    			attr_dev(path195, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path195, "d", "M9852 7467 c-16 -19 2 -40 27 -32 25 8 28 30 5 39 -21 8 -20 8 -32\n    -7z");
    			add_location(path195, file$5, 1888, 10, 116619);
    			attr_dev(path196, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path196, "d", "M9770 7445 c-10 -12 -10 -18 0 -30 7 -8 19 -15 26 -15 8 0 14 -9 14\n    -20 0 -19 27 -40 50 -40 6 0 10 12 8 28 -2 19 -9 28 -25 30 -16 2 -23 10 -23\n    27 0 12 -7 26 -16 29 -21 8 -20 8 -34 -9z");
    			add_location(path196, file$5, 1892, 10, 116753);
    			attr_dev(path197, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path197, "d", "M9685 7441 c-3 -5 2 -16 11 -25 19 -20 57 -4 48 19 -7 16 -49 21 -59\n    6z");
    			add_location(path197, file$5, 1897, 10, 117004);
    			attr_dev(path198, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path198, "d", "M9477 7433 c-24 -24 10 -71 39 -55 13 7 25 5 42 -6 21 -14 25 -14 40\n    1 15 16 15 19 -5 38 -17 17 -24 19 -41 10 -15 -8 -23 -7 -32 4 -13 16 -32 19\n    -43 8z");
    			add_location(path198, file$5, 1901, 10, 117139);
    			attr_dev(path199, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path199, "d", "M9943 7404 c-8 -20 9 -36 30 -28 21 8 22 30 1 38 -22 8 -24 8 -31\n    -10z");
    			add_location(path199, file$5, 1906, 10, 117357);
    			attr_dev(path200, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path200, "d", "M10045 7384 c-15 -15 -15 -19 -1 -32 17 -17 46 -10 46 11 0 8 -6 20\n    -14 26 -11 9 -18 8 -31 -5z");
    			add_location(path200, file$5, 1910, 10, 117491);
    			attr_dev(path201, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path201, "d", "M9382 7378 c-15 -15 3 -48 27 -48 27 0 36 31 15 47 -22 16 -27 16\n    -42 1z");
    			add_location(path201, file$5, 1914, 10, 117649);
    			attr_dev(path202, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path202, "d", "M9671 7341 c-12 -22 -5 -31 25 -31 31 0 41 20 19 37 -25 17 -32 17\n    -44 -6z");
    			add_location(path202, file$5, 1918, 10, 117785);
    			attr_dev(path203, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path203, "d", "M9920 7325 c-10 -13 -10 -19 5 -35 23 -25 32 -25 45 -1 7 15 6 23 -6\n    35 -19 20 -28 20 -44 1z");
    			add_location(path203, file$5, 1922, 10, 117923);
    			attr_dev(path204, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path204, "d", "M9520 7320 c-18 -11 -4 -42 17 -38 10 2 19 10 21 19 4 19 -19 31 -38\n    19z");
    			add_location(path204, file$5, 1926, 10, 118079);
    			attr_dev(path205, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path205, "d", "M10184 7315 c-4 -9 -2 -21 3 -26 14 -14 45 1 41 20 -4 22 -37 26 -44\n    6z");
    			add_location(path205, file$5, 1930, 10, 118215);
    			attr_dev(path206, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path206, "d", "M9720 7275 c0 -28 25 -44 42 -27 15 15 -1 52 -23 52 -14 0 -19 -7\n    -19 -25z");
    			add_location(path206, file$5, 1934, 10, 118350);
    			attr_dev(path207, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path207, "d", "M10304 7286 c-8 -21 3 -36 27 -36 15 0 20 6 17 22 -4 27 -35 37 -44\n    14z");
    			add_location(path207, file$5, 1938, 10, 118488);
    			attr_dev(path208, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path208, "d", "M10026 7282 c-8 -14 20 -34 41 -30 28 5 22 33 -9 36 -14 2 -29 -1\n    -32 -6z");
    			add_location(path208, file$5, 1942, 10, 118623);
    			attr_dev(path209, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path209, "d", "M9587 7263 c-13 -12 -7 -41 10 -47 9 -4 23 0 31 8 13 12 13 18 2 30\n    -13 17 -32 21 -43 9z");
    			add_location(path209, file$5, 1946, 10, 118760);
    			attr_dev(path210, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path210, "d", "M9813 7244 c-4 -11 1 -22 12 -30 22 -16 25 -17 45 -4 12 7 12 13 4\n    27 -15 25 -52 29 -61 7z");
    			add_location(path210, file$5, 1950, 10, 118912);
    			attr_dev(path211, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path211, "d", "M9931 7236 c-17 -20 -7 -46 18 -46 29 0 33 15 13 40 -16 20 -19 20\n    -31 6z");
    			add_location(path211, file$5, 1954, 10, 119066);
    			attr_dev(path212, "class", "svg_path svelte-1giqqxd");
    			attr_dev(path212, "d", "M10153 7243 c-18 -7 -16 -40 3 -47 16 -6 54 9 54 22 0 23 -31 36 -57\n    25z");
    			add_location(path212, file$5, 1958, 10, 119203);
    			attr_dev(g, "transform", "translate(0.000000,1600.000000) scale(0.100000,-0.100000)");
    			attr_dev(g, "fill", "#000000");
    			attr_dev(g, "stroke", "none");
    			add_location(g, file$5, 7, 5, 202);
    			attr_dev(svg, "version", "1.0");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "width", "1600.000000pt");
    			attr_dev(svg, "height", "1600.000000pt");
    			attr_dev(svg, "viewBox", "0 0 1600.000000 1600.000000");
    			attr_dev(svg, "preserveAspectRatio", "xMidYMid meet");
    			attr_dev(svg, "class", "svelte-1giqqxd");
    			add_location(svg, file$5, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, g);
    			append_dev(g, path0);
    			append_dev(g, path1);
    			append_dev(g, path2);
    			append_dev(g, path3);
    			append_dev(g, path4);
    			append_dev(g, path5);
    			append_dev(g, path6);
    			append_dev(g, path7);
    			append_dev(g, path8);
    			append_dev(g, path9);
    			append_dev(g, path10);
    			append_dev(g, path11);
    			append_dev(g, path12);
    			append_dev(g, path13);
    			append_dev(g, path14);
    			append_dev(g, path15);
    			append_dev(g, path16);
    			append_dev(g, path17);
    			append_dev(g, path18);
    			append_dev(g, path19);
    			append_dev(g, path20);
    			append_dev(g, path21);
    			append_dev(g, path22);
    			append_dev(g, path23);
    			append_dev(g, path24);
    			append_dev(g, path25);
    			append_dev(g, path26);
    			append_dev(g, path27);
    			append_dev(g, path28);
    			append_dev(g, path29);
    			append_dev(g, path30);
    			append_dev(g, path31);
    			append_dev(g, path32);
    			append_dev(g, path33);
    			append_dev(g, path34);
    			append_dev(g, path35);
    			append_dev(g, path36);
    			append_dev(g, path37);
    			append_dev(g, path38);
    			append_dev(g, path39);
    			append_dev(g, path40);
    			append_dev(g, path41);
    			append_dev(g, path42);
    			append_dev(g, path43);
    			append_dev(g, path44);
    			append_dev(g, path45);
    			append_dev(g, path46);
    			append_dev(g, path47);
    			append_dev(g, path48);
    			append_dev(g, path49);
    			append_dev(g, path50);
    			append_dev(g, path51);
    			append_dev(g, path52);
    			append_dev(g, path53);
    			append_dev(g, path54);
    			append_dev(g, path55);
    			append_dev(g, path56);
    			append_dev(g, path57);
    			append_dev(g, path58);
    			append_dev(g, path59);
    			append_dev(g, path60);
    			append_dev(g, path61);
    			append_dev(g, path62);
    			append_dev(g, path63);
    			append_dev(g, path64);
    			append_dev(g, path65);
    			append_dev(g, path66);
    			append_dev(g, path67);
    			append_dev(g, path68);
    			append_dev(g, path69);
    			append_dev(g, path70);
    			append_dev(g, path71);
    			append_dev(g, path72);
    			append_dev(g, path73);
    			append_dev(g, path74);
    			append_dev(g, path75);
    			append_dev(g, path76);
    			append_dev(g, path77);
    			append_dev(g, path78);
    			append_dev(g, path79);
    			append_dev(g, path80);
    			append_dev(g, path81);
    			append_dev(g, path82);
    			append_dev(g, path83);
    			append_dev(g, path84);
    			append_dev(g, path85);
    			append_dev(g, path86);
    			append_dev(g, path87);
    			append_dev(g, path88);
    			append_dev(g, path89);
    			append_dev(g, path90);
    			append_dev(g, path91);
    			append_dev(g, path92);
    			append_dev(g, path93);
    			append_dev(g, path94);
    			append_dev(g, path95);
    			append_dev(g, path96);
    			append_dev(g, path97);
    			append_dev(g, path98);
    			append_dev(g, path99);
    			append_dev(g, path100);
    			append_dev(g, path101);
    			append_dev(g, path102);
    			append_dev(g, path103);
    			append_dev(g, path104);
    			append_dev(g, path105);
    			append_dev(g, path106);
    			append_dev(g, path107);
    			append_dev(g, path108);
    			append_dev(g, path109);
    			append_dev(g, path110);
    			append_dev(g, path111);
    			append_dev(g, path112);
    			append_dev(g, path113);
    			append_dev(g, path114);
    			append_dev(g, path115);
    			append_dev(g, path116);
    			append_dev(g, path117);
    			append_dev(g, path118);
    			append_dev(g, path119);
    			append_dev(g, path120);
    			append_dev(g, path121);
    			append_dev(g, path122);
    			append_dev(g, path123);
    			append_dev(g, path124);
    			append_dev(g, path125);
    			append_dev(g, path126);
    			append_dev(g, path127);
    			append_dev(g, path128);
    			append_dev(g, path129);
    			append_dev(g, path130);
    			append_dev(g, path131);
    			append_dev(g, path132);
    			append_dev(g, path133);
    			append_dev(g, path134);
    			append_dev(g, path135);
    			append_dev(g, path136);
    			append_dev(g, path137);
    			append_dev(g, path138);
    			append_dev(g, path139);
    			append_dev(g, path140);
    			append_dev(g, path141);
    			append_dev(g, path142);
    			append_dev(g, path143);
    			append_dev(g, path144);
    			append_dev(g, path145);
    			append_dev(g, path146);
    			append_dev(g, path147);
    			append_dev(g, path148);
    			append_dev(g, path149);
    			append_dev(g, path150);
    			append_dev(g, path151);
    			append_dev(g, path152);
    			append_dev(g, path153);
    			append_dev(g, path154);
    			append_dev(g, path155);
    			append_dev(g, path156);
    			append_dev(g, path157);
    			append_dev(g, path158);
    			append_dev(g, path159);
    			append_dev(g, path160);
    			append_dev(g, path161);
    			append_dev(g, path162);
    			append_dev(g, path163);
    			append_dev(g, path164);
    			append_dev(g, path165);
    			append_dev(g, path166);
    			append_dev(g, path167);
    			append_dev(g, path168);
    			append_dev(g, path169);
    			append_dev(g, path170);
    			append_dev(g, path171);
    			append_dev(g, path172);
    			append_dev(g, path173);
    			append_dev(g, path174);
    			append_dev(g, path175);
    			append_dev(g, path176);
    			append_dev(g, path177);
    			append_dev(g, path178);
    			append_dev(g, path179);
    			append_dev(g, path180);
    			append_dev(g, path181);
    			append_dev(g, path182);
    			append_dev(g, path183);
    			append_dev(g, path184);
    			append_dev(g, path185);
    			append_dev(g, path186);
    			append_dev(g, path187);
    			append_dev(g, path188);
    			append_dev(g, path189);
    			append_dev(g, path190);
    			append_dev(g, path191);
    			append_dev(g, path192);
    			append_dev(g, path193);
    			append_dev(g, path194);
    			append_dev(g, path195);
    			append_dev(g, path196);
    			append_dev(g, path197);
    			append_dev(g, path198);
    			append_dev(g, path199);
    			append_dev(g, path200);
    			append_dev(g, path201);
    			append_dev(g, path202);
    			append_dev(g, path203);
    			append_dev(g, path204);
    			append_dev(g, path205);
    			append_dev(g, path206);
    			append_dev(g, path207);
    			append_dev(g, path208);
    			append_dev(g, path209);
    			append_dev(g, path210);
    			append_dev(g, path211);
    			append_dev(g, path212);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('HomeAnimation3', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<HomeAnimation3> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class HomeAnimation3 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "HomeAnimation3",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src/components/Home.svelte generated by Svelte v3.55.1 */
    const file$4 = "src/components/Home.svelte";

    function create_fragment$4(ctx) {
    	let section;
    	let div13;
    	let div12;
    	let div3;
    	let img0;
    	let img0_src_value;
    	let t0;
    	let div2;
    	let div0;
    	let h50;
    	let t2;
    	let p0;
    	let t4;
    	let div1;
    	let homeanimation;
    	let t5;
    	let div7;
    	let img1;
    	let img1_src_value;
    	let t6;
    	let div6;
    	let div4;
    	let h51;
    	let t8;
    	let p1;
    	let t10;
    	let div5;
    	let homeanimation2;
    	let t11;
    	let div11;
    	let img2;
    	let img2_src_value;
    	let t12;
    	let div10;
    	let div8;
    	let h52;
    	let t14;
    	let p2;
    	let t16;
    	let div9;
    	let homeanimation3;
    	let current;
    	homeanimation = new HomeAnimation({ $$inline: true });
    	homeanimation2 = new HomeAnimation2({ $$inline: true });
    	homeanimation3 = new HomeAnimation3({ $$inline: true });

    	const block = {
    		c: function create() {
    			section = element("section");
    			div13 = element("div");
    			div12 = element("div");
    			div3 = element("div");
    			img0 = element("img");
    			t0 = space();
    			div2 = element("div");
    			div0 = element("div");
    			h50 = element("h5");
    			h50.textContent = "1 slide label";
    			t2 = space();
    			p0 = element("p");
    			p0.textContent = "Some representative placeholder content for the 1\n                            slide.";
    			t4 = space();
    			div1 = element("div");
    			create_component(homeanimation.$$.fragment);
    			t5 = space();
    			div7 = element("div");
    			img1 = element("img");
    			t6 = space();
    			div6 = element("div");
    			div4 = element("div");
    			h51 = element("h5");
    			h51.textContent = "2 slide label";
    			t8 = space();
    			p1 = element("p");
    			p1.textContent = "Some representative placeholder content for the 2\n                            slide.";
    			t10 = space();
    			div5 = element("div");
    			create_component(homeanimation2.$$.fragment);
    			t11 = space();
    			div11 = element("div");
    			img2 = element("img");
    			t12 = space();
    			div10 = element("div");
    			div8 = element("div");
    			h52 = element("h5");
    			h52.textContent = "1 slide label";
    			t14 = space();
    			p2 = element("p");
    			p2.textContent = "Some representative placeholder content for the 1\n                            slide.";
    			t16 = space();
    			div9 = element("div");
    			create_component(homeanimation3.$$.fragment);
    			if (!src_url_equal(img0.src, img0_src_value = "/static/background1.png")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "class", "d-block w-100 opacity-75 svelte-mzyd4c");
    			attr_dev(img0, "alt", "...");
    			add_location(img0, file$4, 14, 16, 479);
    			add_location(h50, file$4, 21, 24, 780);
    			add_location(p0, file$4, 22, 24, 827);
    			attr_dev(div0, "class", "carousel-description svelte-mzyd4c");
    			add_location(div0, file$4, 20, 20, 721);
    			attr_dev(div1, "class", "carousel-image svelte-mzyd4c");
    			add_location(div1, file$4, 27, 20, 1020);
    			attr_dev(div2, "class", "carousel-caption d-none d-md-block svelte-mzyd4c");
    			add_location(div2, file$4, 19, 16, 652);
    			attr_dev(div3, "class", "carousel-item active svelte-mzyd4c");
    			add_location(div3, file$4, 13, 12, 428);
    			if (!src_url_equal(img1.src, img1_src_value = "/static/background2.png")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "class", "d-block w-100 opacity-75 svelte-mzyd4c");
    			attr_dev(img1, "alt", "...");
    			add_location(img1, file$4, 33, 16, 1216);
    			add_location(h51, file$4, 40, 24, 1517);
    			add_location(p1, file$4, 41, 24, 1564);
    			attr_dev(div4, "class", "carousel-description svelte-mzyd4c");
    			add_location(div4, file$4, 39, 20, 1458);
    			attr_dev(div5, "class", "carousel-image svelte-mzyd4c");
    			add_location(div5, file$4, 46, 20, 1757);
    			attr_dev(div6, "class", "carousel-caption d-none d-md-block svelte-mzyd4c");
    			add_location(div6, file$4, 38, 16, 1389);
    			attr_dev(div7, "class", "carousel-item svelte-mzyd4c");
    			add_location(div7, file$4, 32, 12, 1172);
    			if (!src_url_equal(img2.src, img2_src_value = "/static/background1.png")) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "class", "d-block w-100 opacity-75 svelte-mzyd4c");
    			attr_dev(img2, "alt", "...");
    			add_location(img2, file$4, 50, 16, 1909);
    			add_location(h52, file$4, 57, 24, 2210);
    			add_location(p2, file$4, 58, 24, 2257);
    			attr_dev(div8, "class", "carousel-description svelte-mzyd4c");
    			add_location(div8, file$4, 56, 20, 2151);
    			attr_dev(div9, "class", "carousel-image svelte-mzyd4c");
    			add_location(div9, file$4, 63, 20, 2450);
    			attr_dev(div10, "class", "carousel-caption d-none d-md-block svelte-mzyd4c");
    			add_location(div10, file$4, 55, 16, 2082);
    			attr_dev(div11, "class", "carousel-item  svelte-mzyd4c");
    			add_location(div11, file$4, 49, 12, 1864);
    			attr_dev(div12, "class", "carousel-inner svelte-mzyd4c");
    			add_location(div12, file$4, 12, 8, 387);
    			attr_dev(div13, "id", "carouselExampleFade");
    			attr_dev(div13, "class", "carousel slide carousel-fade svelte-mzyd4c");
    			attr_dev(div13, "data-bs-interval", "5000");
    			attr_dev(div13, "data-bs-ride", "carousel");
    			add_location(div13, file$4, 6, 4, 226);
    			attr_dev(section, "id", "home");
    			attr_dev(section, "class", "home svelte-mzyd4c");
    			add_location(section, file$4, 5, 0, 189);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, div13);
    			append_dev(div13, div12);
    			append_dev(div12, div3);
    			append_dev(div3, img0);
    			append_dev(div3, t0);
    			append_dev(div3, div2);
    			append_dev(div2, div0);
    			append_dev(div0, h50);
    			append_dev(div0, t2);
    			append_dev(div0, p0);
    			append_dev(div2, t4);
    			append_dev(div2, div1);
    			mount_component(homeanimation, div1, null);
    			append_dev(div12, t5);
    			append_dev(div12, div7);
    			append_dev(div7, img1);
    			append_dev(div7, t6);
    			append_dev(div7, div6);
    			append_dev(div6, div4);
    			append_dev(div4, h51);
    			append_dev(div4, t8);
    			append_dev(div4, p1);
    			append_dev(div6, t10);
    			append_dev(div6, div5);
    			mount_component(homeanimation2, div5, null);
    			append_dev(div12, t11);
    			append_dev(div12, div11);
    			append_dev(div11, img2);
    			append_dev(div11, t12);
    			append_dev(div11, div10);
    			append_dev(div10, div8);
    			append_dev(div8, h52);
    			append_dev(div8, t14);
    			append_dev(div8, p2);
    			append_dev(div10, t16);
    			append_dev(div10, div9);
    			mount_component(homeanimation3, div9, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(homeanimation.$$.fragment, local);
    			transition_in(homeanimation2.$$.fragment, local);
    			transition_in(homeanimation3.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(homeanimation.$$.fragment, local);
    			transition_out(homeanimation2.$$.fragment, local);
    			transition_out(homeanimation3.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			destroy_component(homeanimation);
    			destroy_component(homeanimation2);
    			destroy_component(homeanimation3);
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Home', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Home> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		HomeAnimation,
    		HomeAnimation2,
    		HomeAnimation3
    	});

    	return [];
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src/components/About.svelte generated by Svelte v3.55.1 */

    const file$3 = "src/components/About.svelte";

    function create_fragment$3(ctx) {
    	let section;
    	let div7;
    	let header;
    	let p0;
    	let t1;
    	let div1;
    	let div0;
    	let p1;
    	let t3;
    	let p2;
    	let t5;
    	let div6;
    	let div5;
    	let div2;
    	let t7;
    	let div3;
    	let t9;
    	let div4;

    	const block = {
    		c: function create() {
    			section = element("section");
    			div7 = element("div");
    			header = element("header");
    			p0 = element("p");
    			p0.textContent = "About Us";
    			t1 = space();
    			div1 = element("div");
    			div0 = element("div");
    			p1 = element("p");
    			p1.textContent = "Desde el año 1992, hemos atendido las necesidades de\n                    limpieza de ropa de la ciudad de los reyes, michoacan.";
    			t3 = space();
    			p2 = element("p");
    			p2.textContent = "Atendiendo siempre cordialmente al cliente y entregando el\n                    mejor trabajo posible de tintoreria y lavanderia posible";
    			t5 = space();
    			div6 = element("div");
    			div5 = element("div");
    			div2 = element("div");
    			div2.textContent = "Pellentesque quis orci a enim porttitor condimentum. Nullam\n                    ut euismod justo. Duis sed quam sodales, feugiat dui eget,\n                    condimentum orci. Pellentesque et laoreet mauris, sed\n                    tristique dui. Pellentesque tempus libero ac massa suscipit,\n                    mollis dapibus velit egestas. Quisque a fringilla felis,\n                    ornare porttitor leo. Ut et orci lectus. Praesent non felis\n                    ac nisl rutrum porta.";
    			t7 = space();
    			div3 = element("div");
    			div3.textContent = "Pellentesque quis orci a enim porttitor condimentum. Nullam\n                    ut euismod justo. Duis sed quam sodales, feugiat dui eget,\n                    condimentum orci. Pellentesque et laoreet mauris, sed\n                    tristique dui. Pellentesque tempus libero ac massa suscipit,\n                    mollis dapibus velit egestas. Quisque a fringilla felis,\n                    ornare porttitor leo. Ut et orci lectus. Praesent non felis\n                    ac nisl rutrum porta.";
    			t9 = space();
    			div4 = element("div");
    			div4.textContent = "Pellentesque quis orci a enim porttitor condimentum. Nullam\n                    ut euismod justo. Duis sed quam sodales, feugiat dui eget,\n                    condimentum orci. Pellentesque et laoreet mauris, sed\n                    tristique dui. Pellentesque tempus libero ac massa suscipit,\n                    mollis dapibus velit egestas. Quisque a fringilla felis,\n                    ornare porttitor leo. Ut et orci lectus. Praesent non felis\n                    ac nisl rutrum porta.";
    			attr_dev(p0, "class", "header-text svelte-b8hwst");
    			add_location(p0, file$3, 5, 12, 124);
    			attr_dev(header, "class", "header svelte-b8hwst");
    			add_location(header, file$3, 4, 8, 88);
    			attr_dev(p1, "class", "lead mb-4 svelte-b8hwst");
    			add_location(p1, file$3, 9, 16, 276);
    			attr_dev(p2, "class", "lead mb-4 svelte-b8hwst");
    			add_location(p2, file$3, 13, 16, 483);
    			attr_dev(div0, "class", "background svelte-b8hwst");
    			add_location(div0, file$3, 8, 12, 235);
    			attr_dev(div1, "class", "about-text text-center svelte-b8hwst");
    			add_location(div1, file$3, 7, 8, 186);
    			attr_dev(div2, "class", "col");
    			add_location(div2, file$3, 21, 16, 825);
    			attr_dev(div3, "class", "col");
    			add_location(div3, file$3, 30, 16, 1395);
    			attr_dev(div4, "class", "col");
    			add_location(div4, file$3, 39, 16, 1965);
    			attr_dev(div5, "class", "row");
    			add_location(div5, file$3, 20, 12, 791);
    			attr_dev(div6, "class", "container text-center description-blocks svelte-b8hwst");
    			add_location(div6, file$3, 19, 8, 724);
    			attr_dev(div7, "class", "content svelte-b8hwst");
    			add_location(div7, file$3, 3, 4, 58);
    			attr_dev(section, "id", "about");
    			attr_dev(section, "class", "about svelte-b8hwst");
    			add_location(section, file$3, 2, 0, 19);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, div7);
    			append_dev(div7, header);
    			append_dev(header, p0);
    			append_dev(div7, t1);
    			append_dev(div7, div1);
    			append_dev(div1, div0);
    			append_dev(div0, p1);
    			append_dev(div0, t3);
    			append_dev(div0, p2);
    			append_dev(div7, t5);
    			append_dev(div7, div6);
    			append_dev(div6, div5);
    			append_dev(div5, div2);
    			append_dev(div5, t7);
    			append_dev(div5, div3);
    			append_dev(div5, t9);
    			append_dev(div5, div4);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
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

    function instance$3($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('About', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<About> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class About extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "About",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/components/Features.svelte generated by Svelte v3.55.1 */

    const file$2 = "src/components/Features.svelte";

    function create_fragment$2(ctx) {
    	let section;
    	let div23;
    	let header;
    	let p;
    	let t1;
    	let div22;
    	let div10;
    	let div4;
    	let div0;
    	let img0;
    	let img0_src_value;
    	let t2;
    	let div3;
    	let div1;
    	let t4;
    	let div2;
    	let t6;
    	let div9;
    	let div5;
    	let img1;
    	let img1_src_value;
    	let t7;
    	let div8;
    	let div6;
    	let t9;
    	let div7;
    	let t11;
    	let div21;
    	let div15;
    	let div11;
    	let img2;
    	let img2_src_value;
    	let t12;
    	let div14;
    	let div12;
    	let t14;
    	let div13;
    	let t16;
    	let div20;
    	let div16;
    	let img3;
    	let img3_src_value;
    	let t17;
    	let div19;
    	let div17;
    	let t19;
    	let div18;

    	const block = {
    		c: function create() {
    			section = element("section");
    			div23 = element("div");
    			header = element("header");
    			p = element("p");
    			p.textContent = "Features";
    			t1 = space();
    			div22 = element("div");
    			div10 = element("div");
    			div4 = element("div");
    			div0 = element("div");
    			img0 = element("img");
    			t2 = space();
    			div3 = element("div");
    			div1 = element("div");
    			div1.textContent = "Feature";
    			t4 = space();
    			div2 = element("div");
    			div2.textContent = "Pellentesque quis orci a enim porttitor condimentum.\n                            Nullam ut euismod justo. Duis sed quam sodales,\n                            feugiat dui eget, condimentum orci. Pellentesque et\n                            laoreet mauris, sed tristique dui. Pellentesque\n                            tempus libero ac massa suscipit, mollis dapibus\n                            velit egestas. Quisque a fringilla felis, ornare\n                            porttitor leo. Ut et orci lectus. Praesent non felis\n                            ac nisl rutrum porta.";
    			t6 = space();
    			div9 = element("div");
    			div5 = element("div");
    			img1 = element("img");
    			t7 = space();
    			div8 = element("div");
    			div6 = element("div");
    			div6.textContent = "Feature";
    			t9 = space();
    			div7 = element("div");
    			div7.textContent = "Pellentesque quis orci a enim porttitor condimentum.\n                            Nullam ut euismod justo. Duis sed quam sodales,\n                            feugiat dui eget, condimentum orci. Pellentesque et\n                            laoreet mauris, sed tristique dui. Pellentesque\n                            tempus libero ac massa suscipit, mollis dapibus\n                            velit egestas. Quisque a fringilla felis, ornare\n                            porttitor leo. Ut et orci lectus. Praesent non felis\n                            ac nisl rutrum porta.";
    			t11 = space();
    			div21 = element("div");
    			div15 = element("div");
    			div11 = element("div");
    			img2 = element("img");
    			t12 = space();
    			div14 = element("div");
    			div12 = element("div");
    			div12.textContent = "Feature";
    			t14 = space();
    			div13 = element("div");
    			div13.textContent = "Pellentesque quis orci a enim porttitor condimentum.\n                            Nullam ut euismod justo. Duis sed quam sodales,\n                            feugiat dui eget, condimentum orci. Pellentesque et\n                            laoreet mauris, sed tristique dui. Pellentesque\n                            tempus libero ac massa suscipit, mollis dapibus\n                            velit egestas. Quisque a fringilla felis, ornare\n                            porttitor leo. Ut et orci lectus. Praesent non felis\n                            ac nisl rutrum porta.";
    			t16 = space();
    			div20 = element("div");
    			div16 = element("div");
    			img3 = element("img");
    			t17 = space();
    			div19 = element("div");
    			div17 = element("div");
    			div17.textContent = "Feature";
    			t19 = space();
    			div18 = element("div");
    			div18.textContent = "Pellentesque quis orci a enim porttitor condimentum.\n                            Nullam ut euismod justo. Duis sed quam sodales,\n                            feugiat dui eget, condimentum orci. Pellentesque et\n                            laoreet mauris, sed tristique dui. Pellentesque\n                            tempus libero ac massa suscipit, mollis dapibus\n                            velit egestas. Quisque a fringilla felis, ornare\n                            porttitor leo. Ut et orci lectus. Praesent non felis\n                            ac nisl rutrum porta.";
    			attr_dev(p, "class", "header-text svelte-xojb1j");
    			add_location(p, file$2, 6, 12, 131);
    			attr_dev(header, "class", "header svelte-xojb1j");
    			add_location(header, file$2, 5, 8, 95);
    			if (!src_url_equal(img0.src, img0_src_value = "/static/feature1.png")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "");
    			attr_dev(img0, "srcset", "");
    			attr_dev(img0, "class", "svelte-xojb1j");
    			add_location(img0, file$2, 13, 24, 356);
    			attr_dev(div0, "class", "image svelte-xojb1j");
    			add_location(div0, file$2, 12, 20, 312);
    			attr_dev(div1, "class", "description-header svelte-xojb1j");
    			add_location(div1, file$2, 16, 24, 505);
    			attr_dev(div2, "class", "description-body");
    			add_location(div2, file$2, 17, 24, 575);
    			attr_dev(div3, "class", "description");
    			add_location(div3, file$2, 15, 20, 455);
    			attr_dev(div4, "class", "feature svelte-xojb1j");
    			add_location(div4, file$2, 11, 16, 270);
    			if (!src_url_equal(img1.src, img1_src_value = "/static/feature2.png")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "");
    			attr_dev(img1, "srcset", "");
    			attr_dev(img1, "class", "svelte-xojb1j");
    			add_location(img1, file$2, 31, 24, 1386);
    			attr_dev(div5, "class", "image svelte-xojb1j");
    			add_location(div5, file$2, 30, 20, 1342);
    			attr_dev(div6, "class", "description-header svelte-xojb1j");
    			add_location(div6, file$2, 34, 24, 1535);
    			attr_dev(div7, "class", "description-body");
    			add_location(div7, file$2, 35, 24, 1605);
    			attr_dev(div8, "class", "description");
    			add_location(div8, file$2, 33, 20, 1485);
    			attr_dev(div9, "class", "feature svelte-xojb1j");
    			add_location(div9, file$2, 29, 16, 1300);
    			attr_dev(div10, "class", "row svelte-xojb1j");
    			add_location(div10, file$2, 10, 12, 236);
    			if (!src_url_equal(img2.src, img2_src_value = "/static/feature3.png")) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "");
    			attr_dev(img2, "srcset", "");
    			attr_dev(img2, "class", "svelte-xojb1j");
    			add_location(img2, file$2, 51, 24, 2465);
    			attr_dev(div11, "class", "image svelte-xojb1j");
    			add_location(div11, file$2, 50, 20, 2421);
    			attr_dev(div12, "class", "description-header svelte-xojb1j");
    			add_location(div12, file$2, 54, 24, 2614);
    			attr_dev(div13, "class", "description-body");
    			add_location(div13, file$2, 55, 24, 2684);
    			attr_dev(div14, "class", "description");
    			add_location(div14, file$2, 53, 20, 2564);
    			attr_dev(div15, "class", "feature svelte-xojb1j");
    			add_location(div15, file$2, 49, 16, 2379);
    			if (!src_url_equal(img3.src, img3_src_value = "/static/feature1.png")) attr_dev(img3, "src", img3_src_value);
    			attr_dev(img3, "alt", "");
    			attr_dev(img3, "srcset", "");
    			attr_dev(img3, "class", "svelte-xojb1j");
    			add_location(img3, file$2, 69, 24, 3495);
    			attr_dev(div16, "class", "image svelte-xojb1j");
    			add_location(div16, file$2, 68, 20, 3451);
    			attr_dev(div17, "class", "description-header svelte-xojb1j");
    			add_location(div17, file$2, 72, 24, 3644);
    			attr_dev(div18, "class", "description-body");
    			add_location(div18, file$2, 73, 24, 3714);
    			attr_dev(div19, "class", "description");
    			add_location(div19, file$2, 71, 20, 3594);
    			attr_dev(div20, "class", "feature svelte-xojb1j");
    			add_location(div20, file$2, 67, 16, 3409);
    			attr_dev(div21, "class", "row svelte-xojb1j");
    			add_location(div21, file$2, 48, 12, 2345);
    			attr_dev(div22, "class", "features-blocks svelte-xojb1j");
    			add_location(div22, file$2, 9, 8, 194);
    			attr_dev(div23, "class", "content svelte-xojb1j");
    			add_location(div23, file$2, 4, 4, 65);
    			attr_dev(section, "id", "features");
    			attr_dev(section, "class", "features svelte-xojb1j");
    			add_location(section, file$2, 3, 0, 20);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, div23);
    			append_dev(div23, header);
    			append_dev(header, p);
    			append_dev(div23, t1);
    			append_dev(div23, div22);
    			append_dev(div22, div10);
    			append_dev(div10, div4);
    			append_dev(div4, div0);
    			append_dev(div0, img0);
    			append_dev(div4, t2);
    			append_dev(div4, div3);
    			append_dev(div3, div1);
    			append_dev(div3, t4);
    			append_dev(div3, div2);
    			append_dev(div10, t6);
    			append_dev(div10, div9);
    			append_dev(div9, div5);
    			append_dev(div5, img1);
    			append_dev(div9, t7);
    			append_dev(div9, div8);
    			append_dev(div8, div6);
    			append_dev(div8, t9);
    			append_dev(div8, div7);
    			append_dev(div22, t11);
    			append_dev(div22, div21);
    			append_dev(div21, div15);
    			append_dev(div15, div11);
    			append_dev(div11, img2);
    			append_dev(div15, t12);
    			append_dev(div15, div14);
    			append_dev(div14, div12);
    			append_dev(div14, t14);
    			append_dev(div14, div13);
    			append_dev(div21, t16);
    			append_dev(div21, div20);
    			append_dev(div20, div16);
    			append_dev(div16, img3);
    			append_dev(div20, t17);
    			append_dev(div20, div19);
    			append_dev(div19, div17);
    			append_dev(div19, t19);
    			append_dev(div19, div18);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
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

    function instance$2($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Features', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Features> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Features extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Features",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/components/Footer.svelte generated by Svelte v3.55.1 */

    const file$1 = "src/components/Footer.svelte";

    function create_fragment$1(ctx) {
    	let footer;
    	let header;
    	let p0;
    	let t1;
    	let div0;
    	let t2;
    	let div14;
    	let div13;
    	let div11;
    	let div3;
    	let div1;
    	let envelopefill;
    	let t3;
    	let t4;
    	let div2;
    	let whatsapp;
    	let t5;
    	let t6;
    	let div6;
    	let div4;
    	let facebook;
    	let t7;
    	let t8;
    	let div5;
    	let instagram;
    	let t9;
    	let t10;
    	let div10;
    	let div7;
    	let google;
    	let t11;
    	let t12;
    	let div8;
    	let geoaltfill;
    	let t13;
    	let t14;
    	let div9;
    	let telephonefill;
    	let t15;
    	let t16;
    	let div12;
    	let p1;
    	let t18;
    	let a;
    	let t20;
    	let ul;
    	let li0;
    	let t21;
    	let li1;
    	let t22;
    	let li2;
    	let current;

    	envelopefill = new EnvelopeFill({
    			props: { width: 24, height: 24 },
    			$$inline: true
    		});

    	whatsapp = new Whatsapp({
    			props: { width: 24, height: 24 },
    			$$inline: true
    		});

    	facebook = new Facebook({
    			props: { width: 24, height: 24 },
    			$$inline: true
    		});

    	instagram = new Instagram({
    			props: { width: 24, height: 24 },
    			$$inline: true
    		});

    	google = new Google({
    			props: { width: 24, height: 24 },
    			$$inline: true
    		});

    	geoaltfill = new GeoAltFill({
    			props: { width: 24, height: 24 },
    			$$inline: true
    		});

    	telephonefill = new TelephoneFill({
    			props: { width: 24, height: 24 },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			footer = element("footer");
    			header = element("header");
    			p0 = element("p");
    			p0.textContent = "Contact Us";
    			t1 = space();
    			div0 = element("div");
    			t2 = space();
    			div14 = element("div");
    			div13 = element("div");
    			div11 = element("div");
    			div3 = element("div");
    			div1 = element("div");
    			create_component(envelopefill.$$.fragment);
    			t3 = text("\n                        abc@def.xyz");
    			t4 = space();
    			div2 = element("div");
    			create_component(whatsapp.$$.fragment);
    			t5 = text("\n                        abc.def.xyz");
    			t6 = space();
    			div6 = element("div");
    			div4 = element("div");
    			create_component(facebook.$$.fragment);
    			t7 = text("\n                        abc.def.xyz");
    			t8 = space();
    			div5 = element("div");
    			create_component(instagram.$$.fragment);
    			t9 = text("\n                        abc.def.xyz");
    			t10 = space();
    			div10 = element("div");
    			div7 = element("div");
    			create_component(google.$$.fragment);
    			t11 = text("\n                        abc.def.xyz");
    			t12 = space();
    			div8 = element("div");
    			create_component(geoaltfill.$$.fragment);
    			t13 = text("\n                        abc.def.xyz abc.def.xyz abc.def.xyz");
    			t14 = space();
    			div9 = element("div");
    			create_component(telephonefill.$$.fragment);
    			t15 = text("\n                        +9876543210");
    			t16 = space();
    			div12 = element("div");
    			p1 = element("p");
    			p1.textContent = "© 2022 Company, Inc. All rights reserved.";
    			t18 = space();
    			a = element("a");
    			a.textContent = "back to the top";
    			t20 = space();
    			ul = element("ul");
    			li0 = element("li");
    			t21 = space();
    			li1 = element("li");
    			t22 = space();
    			li2 = element("li");
    			attr_dev(p0, "class", "header-text svelte-1jz9b7h");
    			add_location(p0, file$1, 5, 8, 209);
    			attr_dev(header, "class", "header svelte-1jz9b7h");
    			add_location(header, file$1, 4, 4, 177);
    			attr_dev(div0, "class", "map svelte-1jz9b7h");
    			add_location(div0, file$1, 7, 4, 265);
    			attr_dev(div1, "class", "email contact svelte-1jz9b7h");
    			add_location(div1, file$1, 12, 20, 430);
    			attr_dev(div2, "class", "whatsapp contact svelte-1jz9b7h");
    			add_location(div2, file$1, 16, 20, 605);
    			attr_dev(div3, "class", "col-4");
    			add_location(div3, file$1, 11, 16, 390);
    			attr_dev(div4, "class", "facebook contact svelte-1jz9b7h");
    			add_location(div4, file$1, 22, 20, 838);
    			attr_dev(div5, "class", "instagram contact svelte-1jz9b7h");
    			add_location(div5, file$1, 26, 20, 1012);
    			attr_dev(div6, "class", "col-4");
    			add_location(div6, file$1, 21, 16, 798);
    			attr_dev(div7, "class", "google contact svelte-1jz9b7h");
    			add_location(div7, file$1, 32, 20, 1247);
    			attr_dev(div8, "class", "geo contact svelte-1jz9b7h");
    			add_location(div8, file$1, 36, 20, 1417);
    			attr_dev(div9, "class", "phone contact svelte-1jz9b7h");
    			add_location(div9, file$1, 40, 20, 1612);
    			attr_dev(div10, "class", "col-4");
    			add_location(div10, file$1, 31, 16, 1207);
    			attr_dev(div11, "class", "row");
    			add_location(div11, file$1, 10, 12, 356);
    			add_location(p1, file$1, 49, 16, 1957);
    			attr_dev(a, "href", "#header");
    			add_location(a, file$1, 50, 16, 2022);
    			attr_dev(li0, "class", "ms-3");
    			add_location(li0, file$1, 52, 20, 2130);
    			attr_dev(li1, "class", "ms-3");
    			add_location(li1, file$1, 53, 20, 2170);
    			attr_dev(li2, "class", "ms-3");
    			add_location(li2, file$1, 54, 20, 2210);
    			attr_dev(ul, "class", "list-unstyled d-flex");
    			add_location(ul, file$1, 51, 16, 2076);
    			attr_dev(div12, "class", "d-flex flex-column flex-sm-row justify-content-between py-4 my-4 border-top");
    			add_location(div12, file$1, 46, 12, 1822);
    			attr_dev(div13, "class", "container");
    			add_location(div13, file$1, 9, 8, 320);
    			attr_dev(div14, "class", "contacts svelte-1jz9b7h");
    			add_location(div14, file$1, 8, 4, 289);
    			attr_dev(footer, "id", "contact");
    			attr_dev(footer, "class", "svelte-1jz9b7h");
    			add_location(footer, file$1, 3, 0, 151);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, footer, anchor);
    			append_dev(footer, header);
    			append_dev(header, p0);
    			append_dev(footer, t1);
    			append_dev(footer, div0);
    			append_dev(footer, t2);
    			append_dev(footer, div14);
    			append_dev(div14, div13);
    			append_dev(div13, div11);
    			append_dev(div11, div3);
    			append_dev(div3, div1);
    			mount_component(envelopefill, div1, null);
    			append_dev(div1, t3);
    			append_dev(div3, t4);
    			append_dev(div3, div2);
    			mount_component(whatsapp, div2, null);
    			append_dev(div2, t5);
    			append_dev(div11, t6);
    			append_dev(div11, div6);
    			append_dev(div6, div4);
    			mount_component(facebook, div4, null);
    			append_dev(div4, t7);
    			append_dev(div6, t8);
    			append_dev(div6, div5);
    			mount_component(instagram, div5, null);
    			append_dev(div5, t9);
    			append_dev(div11, t10);
    			append_dev(div11, div10);
    			append_dev(div10, div7);
    			mount_component(google, div7, null);
    			append_dev(div7, t11);
    			append_dev(div10, t12);
    			append_dev(div10, div8);
    			mount_component(geoaltfill, div8, null);
    			append_dev(div8, t13);
    			append_dev(div10, t14);
    			append_dev(div10, div9);
    			mount_component(telephonefill, div9, null);
    			append_dev(div9, t15);
    			append_dev(div13, t16);
    			append_dev(div13, div12);
    			append_dev(div12, p1);
    			append_dev(div12, t18);
    			append_dev(div12, a);
    			append_dev(div12, t20);
    			append_dev(div12, ul);
    			append_dev(ul, li0);
    			append_dev(ul, t21);
    			append_dev(ul, li1);
    			append_dev(ul, t22);
    			append_dev(ul, li2);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(envelopefill.$$.fragment, local);
    			transition_in(whatsapp.$$.fragment, local);
    			transition_in(facebook.$$.fragment, local);
    			transition_in(instagram.$$.fragment, local);
    			transition_in(google.$$.fragment, local);
    			transition_in(geoaltfill.$$.fragment, local);
    			transition_in(telephonefill.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(envelopefill.$$.fragment, local);
    			transition_out(whatsapp.$$.fragment, local);
    			transition_out(facebook.$$.fragment, local);
    			transition_out(instagram.$$.fragment, local);
    			transition_out(google.$$.fragment, local);
    			transition_out(geoaltfill.$$.fragment, local);
    			transition_out(telephonefill.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(footer);
    			destroy_component(envelopefill);
    			destroy_component(whatsapp);
    			destroy_component(facebook);
    			destroy_component(instagram);
    			destroy_component(google);
    			destroy_component(geoaltfill);
    			destroy_component(telephonefill);
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Footer', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		EnvelopeFill,
    		Whatsapp,
    		Facebook,
    		Instagram,
    		Google,
    		GeoAltFill,
    		TelephoneFill
    	});

    	return [];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
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
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    var translations = {
        en: {
            "homepage.title": "Hello, World!",
            "homepage.welcome": "Hi <strong>{{name}}</strong>, how are you?",
            "homepage.time": "The current time is: {{time}}",
        },
        es: {
            "homepage.title": "¡Hola Mundo!",
            "homepage.welcome": "Hola, <strong>{{name}}</strong>, ¿cómo estás?",
            "homepage.time": "La hora actual es: {{time}}",
        },
    };

    const locale = writable("en");
    function translate(locale, key, vars) {
        // Let's throw some errors if we're trying to use keys/locales that don't exist.
        // We could improve this by using Typescript and/or fallback values.
        if (!key)
            throw new Error("no key provided to $t()");
        if (!locale)
            throw new Error(`no translation for key "${key}"`);
        // Grab the translation from the translations object.
        let text = translations[locale][key];
        if (!text)
            throw new Error(`no translation found for ${locale}.${key}`);
        // Replace any passed in variables in the translation string.
        Object.keys(vars).map((k) => {
            const regex = new RegExp(`{{${k}}}`, "g");
            text = text.replace(regex, vars[k]);
        });
        return text;
    }
    derived(locale, ($locale) => (key, vars = {}) => translate($locale, key, vars));

    /* src/App.svelte generated by Svelte v3.55.1 */
    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let div;
    	let header;
    	let t0;
    	let home;
    	let t1;
    	let about;
    	let t2;
    	let features;
    	let t3;
    	let footer;
    	let current;
    	header = new Header({ $$inline: true });
    	home = new Home({ $$inline: true });
    	about = new About({ $$inline: true });
    	features = new Features({ $$inline: true });
    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(header.$$.fragment);
    			t0 = space();
    			create_component(home.$$.fragment);
    			t1 = space();
    			create_component(about.$$.fragment);
    			t2 = space();
    			create_component(features.$$.fragment);
    			t3 = space();
    			create_component(footer.$$.fragment);
    			attr_dev(div, "class", "root svelte-ehbs40");
    			add_location(div, file, 14, 0, 441);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(header, div, null);
    			append_dev(div, t0);
    			mount_component(home, div, null);
    			append_dev(div, t1);
    			mount_component(about, div, null);
    			append_dev(div, t2);
    			mount_component(features, div, null);
    			append_dev(div, t3);
    			mount_component(footer, div, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(home.$$.fragment, local);
    			transition_in(about.$$.fragment, local);
    			transition_in(features.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(home.$$.fragment, local);
    			transition_out(about.$$.fragment, local);
    			transition_out(features.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(header);
    			destroy_component(home);
    			destroy_component(about);
    			destroy_component(features);
    			destroy_component(footer);
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
    	let time;
    	let $locale;
    	validate_store(locale, 'locale');
    	component_subscribe($$self, locale, $$value => $$invalidate(0, $locale = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Header,
    		Home,
    		About,
    		Features,
    		Footer,
    		locale,
    		time,
    		$locale
    	});

    	$$self.$inject_state = $$props => {
    		if ('time' in $$props) time = $$props.time;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$locale*/ 1) {
    			time = new Date().toLocaleDateString($locale, {
    				weekday: "long",
    				year: "numeric",
    				month: "long",
    				day: "numeric"
    			});
    		}
    	};

    	return [$locale];
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
        // props: {
        // 	name: 'world'
        // }
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
