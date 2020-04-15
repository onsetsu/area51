import {awaitIterator} from "../src/helpers/yield-support.js";
import DexiePromise, {rejection} from "../src/helpers/promise.js";

const {test, ok} = QUnit;

function spawn(generatorFn, args, thiz) {
    try {
        var rv = awaitIterator(generatorFn.apply(thiz, args || []));
        if (!rv || typeof rv.then !== 'function')
            return DexiePromise.resolve(rv);
        return rv;
    } catch (e) {
        return rejection(e);
    }
}

export function spawnedTest (name, num, promiseGenerator) {
    if (!promiseGenerator) {
        promiseGenerator = num;
        test(name, function(assert) {
            let done = assert.async();
            spawn(promiseGenerator)
                .catch(e => ok(false, e.stack || e))
                .then(done);
        });
    } else {
        test(name, num, function(assert) {
            let done = assert.async();
            spawn(promiseGenerator)
                .catch(e => ok(false, e.stack || e))
                .then(done);
        });
    }
}



export function promisedTest (name, num, asyncFunction) {
    if (!asyncFunction) {
        asyncFunction = num;
        test(name, (assert) => {
            let done = assert.async();
            Promise.resolve().then(asyncFunction)
              .catch(e => ok(false, e.stack || e))
              .then(done);
        });
    } else {
        test(name, num, (assert) => {
            let done = assert.async();
            Promise.resolve().then(asyncFunction)
              .catch(e => ok(false, e.stack || e))
              .then(done);
        });
    }
}
