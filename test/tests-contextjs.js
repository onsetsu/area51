import DexiePromise from './../src/helpers/promise.js';

const {module, test, strictEqual, ok, notStrictEqual, config} = QUnit;
config.testTimeout = 1000
import {promisedTest, spawnedTest} from './unittest-utils.js';

import * as cop from './../ContextJS/src/contextjs.js';

const GlobalPromise = window.Promise;

module("contextjs/await integration", {
    setup: function (assert) {
        let done = assert.async();
        done();
    },
    teardown: function () {
    }
});

test("basic withLayers test", function(assert) {
    const obj = {
        fn() { return 2; }
    }

    const testLayer = new cop.Layer('test1').refineObject(obj, {
        fn() {
            return cop.proceed() + 3;
        }
    });

    strictEqual(obj.fn(), 2);
    cop.withLayers([testLayer], () => {
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
