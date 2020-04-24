import DexiePromise, {Zone} from './../src/helpers/promise.js';

import {Layer, withLayers, withoutLayers} from './../ContextJS/src/contextjs.js';
import * as cop from './../ContextJS/src/Layers.js';
import {activeLayers, currentLayers, LayerStack, proceed, resetLayerStack} from './../ContextJS/src/Layers.js';
import {decrementExpectedAwaits, incrementExpectedAwaits, newScope} from "../src/helpers/promise.js";

import { copyFrame, storeLayerStack, replayLayerStack, popFrame, pushFrame, frameEquals} from './../src/layerstack-reification.js';

function withZone(scopeFunc, zoneProps = {}) {
    let returnValue;
    try {
        incrementExpectedAwaits();

        newScope(() => {
            returnValue = scopeFunc.call();
        }, zoneProps)
    } finally {
        if (returnValue && typeof returnValue.then === 'function') {
            returnValue.then(() => decrementExpectedAwaits())
        } else {
            decrementExpectedAwaits()
        }
    }
}

function withFrameZoned (frame, callback) {
    try {
        // there is a 1 to 1 relationship between a Layerstack and a zone created with `withFrameZones`
        // however, we cannot attach the current LayerStack to the Zone because the global Zone is special, e.g.:
        // we call withLayers from global zone, then the current LayerStack (1) would be attached to the global zone
        // for later reverting. within the withLayers, we now run withZone(cb, !globalZone!) and in the cb, we again
        // do withLayers from the global zone. Then we would use the current Layerstack (2), but this would override
        // the original LayerStack (1)! So, due to the ability to run any code in any Zone at any time, we have this
        // safety hole! This break works also with any other Zone that is used as a basis to call withLayers from.
        // Instead, we here use the Stack Frame in which the withLayers takes place to store the original LayerStack (1).
        // So we have 1 layerStack to return to for each call to with(out)Layers!
        const layerStackToRevertTo = storeLayerStack();
        const zonedLayerStack = storeLayerStack();
        zonedLayerStack.push(frame);

        return withZone(callback, {
            afterEnter() {
                replayLayerStack(zonedLayerStack);
            },
            afterLeave() {
                replayLayerStack(layerStackToRevertTo)
            }
        });
    } finally {

    }
}

function withLayersZoned (layers, callback) {
    return withLayerFrameZoned({withLayers: layers}, callback);
}

function withoutLayersZoned (layers, callback) {
    return withLayerFrameZoned({withoutLayers: layers}, callback);
}

/********************************************************************************************************/
/********************************************************************************************************/
/********************************************************************************************************/

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

    function withZone(scopeFunc) {
        let returnValue;
        try {
            const zoneProps = {};

            incrementExpectedAwaits();

            newScope(() => {
                returnValue = scopeFunc.call();
            }, zoneProps)
        } finally {
            if (returnValue && typeof returnValue.then === 'function') {
                returnValue.then(() => decrementExpectedAwaits())
            }
        }
    }

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

