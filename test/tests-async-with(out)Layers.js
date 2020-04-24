import DexiePromise, {Zone} from './../src/helpers/promise.js';

import {Layer, withLayers, withoutLayers} from './../ContextJS/src/contextjs.js';
import {activeLayers, currentLayers, LayerStack, proceed, resetLayerStack} from './../ContextJS/src/Layers.js';
import {decrementExpectedAwaits, incrementExpectedAwaits, newScope} from "../src/helpers/promise.js";

import { copyFrame, storeLayerStack, replayLayerStack, popFrame, pushFrame, frameEquals} from './../src/layerstack-reification.js';

function withLayersNEW (layers, callback) {

}

function withoutLayersNEW (layers, callback) {

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

test("frameEquals", function(assert) {
    const l1 = new Layer('l1')
    const l2 = new Layer('l2')

    const base = {
        isStatic: true,
        toString: function() { return "BaseLayer"; },
        composition: null
    };
    const w12a = {withLayers:[l1, l2]};
    const w12b = {withLayers:[l1, l2]};
    const wo12 = {withoutLayers:[l1, l2]};
    const w21 = {withLayers:[l2, l1]};
    const w1 = {withLayers:[l1]};

    ok(frameEquals(w12a, w12a), 'frameEquals -1');
    ok(!frameEquals(w12a, base), 'frameEquals 0')
    ok(frameEquals(w12a, w12b), 'frameEquals 1');
    ok(!frameEquals(w12a, wo12), 'frameEquals 2');
    ok(!frameEquals(w12a, w21), 'frameEquals 3');
    ok(!frameEquals(w12a, w1), 'frameEquals 4');
});

test("store and replay Layers", function(assert) {
    let innerStack;

    const l1 = new Layer('l1')
    const l2 = new Layer('l2')

    withLayers([l1], () => {
        withLayers([l2], () => {
            innerStack = storeLayerStack();
        });
    });

    replayLayerStack(innerStack);

    strictEqual(activeLayers().length, 2, 'stack contains 2 items');
    ok(activeLayers().includes(l1), 'stack did not include l1');
    ok(activeLayers().includes(l2), 'stack did not include l2');
});

test("testing Layer callbacks", function(assert) {
    const l1 = transcript.layer('l1');
    const l2 = transcript.layer('l2');

    withLayers([l1], () => {
        withLayers([l2], () => {
        });
    });

    strictEqual(transcript.join(','), 'l1a,l2a,l2d,l1d');
});

test("Layer callbacks called on restore", function(assert) {
    let innerStack;
    const l1 = transcript.layer('l1');
    const l2 = transcript.layer('l2');

    withLayers([l1], () => {
        withLayers([l2], () => {
            innerStack = storeLayerStack();
        });
    });

    strictEqual(transcript.join(','), 'l1a,l2a,l2d,l1d');
    transcript.reset();

    replayLayerStack(innerStack);
    strictEqual(transcript.join(','), 'l1a,l2a');

    strictEqual(activeLayers().length, 2, 'stack contains 2 items');
    ok(activeLayers().includes(l1), 'stack did not include l1');
    ok(activeLayers().includes(l2), 'stack did not include l2');
});

test("pop previous layers on restore (if not present)", function(assert) {
    const l1 = transcript.layer('l1');
    const l2 = transcript.layer('l2');

    let outerStack = storeLayerStack();

    withLayers([l1], () => {
        withLayers([l2], () => {
            const temp = storeLayerStack();
            transcript.reset();
            replayLayerStack(outerStack);
            strictEqual(transcript.join(','), 'l2d,l1d');
            strictEqual(activeLayers().length, 0, 'stack contains no items');
            transcript.reset();
            replayLayerStack(temp);
        });
    });
});

test("ignore common ancestry on restore for Layer (de-)activation", function(assert) {
    let innerStack;
    const l1 = transcript.layer('l1');
    const l2 = transcript.layer('l2');

    withLayers([l1], () => {
        withLayers([l2], () => {
            innerStack = storeLayerStack();
        });
        const temp = storeLayerStack();

        transcript.reset();
        replayLayerStack(innerStack);
        strictEqual(transcript.join(','), 'l2a');
        transcript.reset();

        strictEqual(activeLayers().length, 2, 'stack contains 2 items');
        ok(activeLayers().includes(l1), 'stack did not include l1');
        ok(activeLayers().includes(l2), 'stack did not include l2');

        replayLayerStack(temp);
    });
});

test("(de-)activation considers global layers", function(assert) {
    let innerStack;
    const l1 = transcript.layer('l1');
    const l2 = transcript.layer('l2');

    l2.beGlobal();

    withLayers([l1], () => {
        withoutLayers([l2], () => {
            innerStack = storeLayerStack();
        });
    });

    l2.beNotGlobal();

    const temp = storeLayerStack();

    transcript.reset();
    replayLayerStack(innerStack);
    strictEqual(transcript.join(','), 'l1a');
    strictEqual(activeLayers().length, 1, 'stack contains 1 item');
    ok(activeLayers().includes(l1), 'stack did not include l1');

    replayLayerStack(temp);
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

