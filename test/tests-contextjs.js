import DexiePromise from './../src/helpers/promise.js';

import {Layer, withLayers, withoutLayers} from './../ContextJS/src/contextjs.js';
import {activeLayers, currentLayers, LayerStack, proceed, resetLayerStack} from './../ContextJS/src/Layers.js';
import {decrementExpectedAwaits, incrementExpectedAwaits, newScope} from "../src/helpers/promise.js";

class Zone {
  static get current() {
      return DexiePromise.PSD;
  }
}

function copyFrame(frame) {
    const resultFrame = {};

    // use copied arrays of layers
    if (frame.withLayers) {
        resultFrame.withLayers = Array.from(frame.withLayers)
    }
    if (frame.withoutLayers) {
        resultFrame.withoutLayers = Array.from(frame.withoutLayers)
    }

    return Object.assign(resultFrame, frame);
}

function storeLayerStack() {
    return LayerStack.map(copyFrame);
}

function replayLayerStack(from) {
    const fromLength = from.length;
    const LayerStackLength = LayerStack.length;
    const maxLengthCommonAncestry = Math.min(fromLength, LayerStackLength);
    let commonAncestryLength = 0;

    while (commonAncestryLength < maxLengthCommonAncestry && frameEquals(from[commonAncestryLength], LayerStack[commonAncestryLength])) {
        commonAncestryLength++;
    }

    while (LayerStack.length > commonAncestryLength) {
        popFrame();
    }
    while (LayerStack.length < fromLength) {
        pushFrame(from[LayerStack.length]);
    }
}

function popFrame() {
    const beforePop = currentLayers();

    const frame = LayerStack.pop();
    const { withLayers, withoutLayers } = frame;

    const afterPop = currentLayers();

    withLayers && withLayers
        .filter(l => beforePop.includes(l) && !afterPop.includes(l))
        .forEach(l => l._emitDeactivateCallbacks());

    withoutLayers && withoutLayers
        .filter(l => !beforePop.includes(l) && afterPop.includes(l))
        .forEach(l => l._emitActivateCallbacks());
}
function pushFrame(frame) {
    const {withLayers, withoutLayers} = frame;

    const beforePush = currentLayers();

    LayerStack.push(frame);

    withLayers && withLayers
        .filter(l => !beforePush.includes(l))
        .forEach(l => l._emitActivateCallbacks());

    withoutLayers && withoutLayers
        .filter(l => beforePush.includes(l))
        .forEach(l => l._emitDeactivateCallbacks());
}

function frameEquals(frame1, frame2) {
    const layerListProperties = ['withLayers', 'withoutLayers'];

    // all props are StrictEqual, except withLayers and withoutLayers
    const shallowCompare = (obj1, obj2) =>
        Object.keys(obj1).length === Object.keys(obj2).length &&
        Object.keys(obj1).every(key => {
            if (layerListProperties.includes(key)) {
                return true; // checked later
            }
            return obj2.hasOwnProperty(key) && obj1[key] === obj2[key]
        });

    if (!shallowCompare(frame1, frame2)) { return false; }

    // withLayers and withoutLayers should contain the same layers in order
    return layerListProperties.every(prop => {
        const arr1 = frame1[prop];
        const arr2 = frame2[prop];
        if (arr1 && arr2) { // both have prop set
            if (!Array.isArray(arr1) || ! Array.isArray(arr2) || arr1.length !== arr2.length) {
                return false;
            }
            return arr1.every((layer, index) => layer === arr2[index]);
        }

        return !arr1 && !arr2; // both do not define the prop is fine, too
    });
}

/********************************************************************************************************/
/********************************************************************************************************/
/********************************************************************************************************/

const {module, test, strictEqual, ok, notStrictEqual, config} = QUnit;
config.testTimeout = 5000;
import {promisedTest} from './unittest-utils.js';

const GlobalPromise = window.Promise;

const transcript = []
function transcriptLayer(name) {
    return new Layer(name)
        .onActivate(() => transcript.push(name + 'a'))
        .onDeactivate(() => transcript.push(name + 'd'));
}

module("contextjs/await integration", {
    setup: function (assert) {
        resetLayerStack();
        transcript.length = 0;
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
    const l1 = transcriptLayer('l1');
    const l2 = transcriptLayer('l2');

    withLayers([l1], () => {
        withLayers([l2], () => {
        });
    });

    strictEqual(transcript.join(','), 'l1a,l2a,l2d,l1d');
});

test("Layer callbacks called on restore", function(assert) {
    let innerStack;
    const l1 = transcriptLayer('l1');
    const l2 = transcriptLayer('l2');

    withLayers([l1], () => {
        withLayers([l2], () => {
            innerStack = storeLayerStack();
        });
    });

    strictEqual(transcript.join(','), 'l1a,l2a,l2d,l1d');
    transcript.length = 0;

    replayLayerStack(innerStack);
    strictEqual(transcript.join(','), 'l1a,l2a');

    strictEqual(activeLayers().length, 2, 'stack contains 2 items');
    ok(activeLayers().includes(l1), 'stack did not include l1');
    ok(activeLayers().includes(l2), 'stack did not include l2');
});

test("pop previous layers on restore (if not present)", function(assert) {
    const l1 = transcriptLayer('l1');
    const l2 = transcriptLayer('l2');

    let outerStack = storeLayerStack();

    withLayers([l1], () => {
        withLayers([l2], () => {
            const temp = storeLayerStack();
            transcript.length = 0;
            replayLayerStack(outerStack);
            strictEqual(transcript.join(','), 'l2d,l1d');
            strictEqual(activeLayers().length, 0, 'stack contains no items');
            transcript.length = 0;
            replayLayerStack(temp);
        });
    });
});

test("ignore common ancestry on restore for Layer (de-)activation", function(assert) {
    let innerStack;
    const l1 = transcriptLayer('l1');
    const l2 = transcriptLayer('l2');

    withLayers([l1], () => {
        withLayers([l2], () => {
            innerStack = storeLayerStack();
        });
        const temp = storeLayerStack();

        transcript.length = 0;
        debugger
        replayLayerStack(innerStack);
        strictEqual(transcript.join(','), 'l2a');
        transcript.length = 0;

        strictEqual(activeLayers().length, 2, 'stack contains 2 items');
        ok(activeLayers().includes(l1), 'stack did not include l1');
        ok(activeLayers().includes(l2), 'stack did not include l2');

        replayLayerStack(temp);
    });
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

