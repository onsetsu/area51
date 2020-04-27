import DexiePromise, {Zone} from './../src/helpers/promise.js';

import {Layer, withLayers, withoutLayers} from './../ContextJS/src/contextjs.js';
import {activeLayers, currentLayers, LayerStack, proceed, resetLayerStack} from './../ContextJS/src/Layers.js';

import { withZone, withLayersZoned, withoutLayersZoned} from './../src/dynamic-extent-zoned.js';

const {module, test, strictEqual, ok, notStrictEqual, config} = QUnit;
config.testTimeout = 5000;
import {promisedTest} from './unittest-utils.js';

const GlobalPromise = window.Promise;

import { transcript } from './unittest-utils-transcript.js';

module("async with(out)Layers", {
    setup: function (assert) {
        resetLayerStack();
        transcript.reset();
        let done = assert.async();
        done();
    },
    teardown: function () {
        resetLayerStack()
    }
});

test("basic withLayersZoned", function(assert) {
    const l1 = new Layer('l1')
    const l2 = new Layer('l2')

    withLayersZoned([l1], () => {
        var layers = currentLayers();
        ok(layers.includes(l1), 'l1 active 1');
        ok(!layers.includes(l2), 'l2 not active 1');

        withLayersZoned([l2], () => {
            var layers = currentLayers();
            ok(layers.includes(l1), 'l1 active 2');
            ok(layers.includes(l2), 'l2 active 2');
        });

        var layers = currentLayers();
        ok(layers.includes(l1), 'l1 active 3');
        ok(!layers.includes(l2), 'l2 not active 3');
    });

    var layers = currentLayers();
    ok(!layers.includes(l1), 'l1 active 4');
    ok(!layers.includes(l2), 'l2 active 4');
});

test("async withLayersZoned", function(assert) {
    const done = assert.async();

    const l1 = new Layer('l1')
    const l2 = new Layer('l2')

    withLayersZoned([l1, l2], async () => {
        await 0;
        var layers = currentLayers();
        ok(layers.includes(l1), 'l1 active 1');
        ok(layers.includes(l2), 'l2 active 1');
    });
    var layers = currentLayers();
    ok(!layers.includes(l1), 'l1 not active 2');
    ok(!layers.includes(l2), 'l2 not active 2');

    setTimeout(() => {
        var layers = currentLayers();
        ok(!layers.includes(l1), 'l1 not active 3');
        ok(!layers.includes(l2), 'l2 not active 3');
        done();
    }, 0);
});

test("async withLayersZoned indirection over sync callback", function(assert) {
    const done = assert.async();

    const l1 = new Layer('l1')
    const l2 = new Layer('l2')

    withLayersZoned([l1, l2], () => {
        (async () => {
            await 0;
            const layers = currentLayers();
            ok(layers.includes(l1), 'l1 active');
            ok(layers.includes(l2), 'l2 active');
        })();
    });

    setTimeout(done, 0);
});

test("testing Layer callbacks", function(assert) {
    const l1 = transcript.layer('l1');
    const l2 = transcript.layer('l2');

    withLayersZoned([l1], () => {
        withLayersZoned([l2], () => {
        });
    });

    strictEqual(transcript.join(','), 'l1a,l2a,l2d,l1d');
});

test("(de-)activation considers global layers", function(assert) {
    const done = assert.async();

    const l1 = transcript.layer('l1');
    const l2 = transcript.layer('l2');

    let innerFnCalled = false;


    withLayersZoned([l1], () => {
        withoutLayersZoned([l2], async () => {
            ok(activeLayers().includes(l1), 'l1 active 1');
            ok(!activeLayers().includes(l2), 'l2 not active 1');

            await 0;
            ok(activeLayers().includes(l1), 'l1 active 2');
            ok(!activeLayers().includes(l2), 'l2 not active 2');

            innerFnCalled = true;
        });
    });
    ok(!activeLayers().includes(l1), 'l1 not active 3');
    ok(!activeLayers().includes(l2), 'l2 not active 3');

    l2.beGlobal();
    ok(!activeLayers().includes(l1), 'l1 not active 4');
    ok(activeLayers().includes(l2), 'l2 active 4');

    setTimeout(() => {
        ok(innerFnCalled, 'inner scope func not called by with(out)Layers');
        done();
    }, 0);
});

test("(de-)activation considers global layers2", function(assert) {
    const done = assert.async();

    const l1 = transcript.layer('l1');
    const l2 = transcript.layer('l2');

    let innerFnCalled = false;

debugger
    withLayersZoned([l1], () => {
        withoutLayersZoned([l2], async () => {
            ok(activeLayers().includes(l1), 'l1 active 1');
            ok(!activeLayers().includes(l2), 'l2 not active 1');

            await 0;
            debugger
            ok(activeLayers().includes(l1), 'l1 active 2');
            ok(!activeLayers().includes(l2), 'l2 not active 2');

            innerFnCalled = true;
        });
    });
    ok(!activeLayers().includes(l1), 'l1 not active 3');
    ok(!activeLayers().includes(l2), 'l2 not active 3');

    l2.beGlobal();
    ok(!activeLayers().includes(l1), 'l1 not active 4');
    ok(activeLayers().includes(l2), 'l2 active 4');

    setTimeout(() => {
        ok(innerFnCalled, 'inner scope func not called by with(out)Layers');
        done();
    }, 0);
});

test("basic withLayers test", function(assert) {
    const obj = {
        fn() { return 2; }
    }

    const testLayer = new Layer('test1').refineObject(obj, {
        fn() {
            return proceed() + 3;
        }
    });

    strictEqual(obj.fn(), 2);
    withLayers([testLayer], () => {
        ok(obj.fn(), 5)
    })
    strictEqual(obj.fn(), 2);
});

test("--async tests work--", async function(assert) {
    let done = assert.async();

    await new Promise(resolve => setTimeout(resolve, 10));
    ok(true)
    done()
});

promisedTest ("--promisedTests work--", async () => {
    let trans;
    ok(true)
    await 2;
});

test("sync Dexie works", async (assert) => {
    let done = assert.async();

    const transcript = [];
    function log(arg) { transcript.push(arg); }

    log('OUTER START')
    withZone(async function () {
        Zone.current.test = 3;
        log('before');
        await (42);
        strictEqual(Zone.current.test, 3);
        log('after');
    });
    notStrictEqual(Zone.current.test, 3);
    log('OUTER END')
    await new Promise(r => setTimeout(r, 0));
    notStrictEqual(Zone.current.test, 3);
    log('END')
    strictEqual(transcript.join(','), 'OUTER START,before,OUTER END,after,END');
    done();
});

