import DexiePromise from './../src/helpers/promise.js';

const {module, test, strictEqual, ok, notStrictEqual, config} = QUnit;
config.testTimeout = 1000
import {promisedTest, spawnedTest} from './unittest-utils.js';

let hasNativeAsyncFunctions = false;
try {
    hasNativeAsyncFunctions = !!new Function(`return (async ()=>{})();`)().then;
} catch (e) {}

const signalError = e => {
    ok(false, `Error: ${e.stack || e}`);
};

module("native async/await", {
    setup: function (assert) {
        let done = assert.async();
        done();
    },
    teardown: function () {
    }
});

test("PSD preserved in DexiePromise", function(assert) {
    let done = assert.async();
    // Create a PSD scope
    DexiePromise.newPSD (function () {

        // Put something in it.
        DexiePromise.PSD.test = 3;

        // Create a promise that uses it
        new Promise(function (resolve, reject) {
            setTimeout(resolve, 200);
        }).then (function () {
            // This callback will get same PSD instance as was active when .then() was called
            strictEqual(DexiePromise.PSD.test, 3, `expect var on PSD to be 3: ` + DexiePromise.PSD.test);
        }).catch(signalError).then(done);
    });

    notStrictEqual(DexiePromise.PSD.test, 3, `expect var outside that scope NOT to be 3: ` + DexiePromise.PSD.test);
});

test("PSD preserved over awaiting a Non-Promise and NESTED newPSDs", function(assert) {
    let done = assert.async();
    // Create a PSD scope
    DexiePromise.newPSD (function () {

        // Put something in it.
        DexiePromise.PSD.test = 5;

        // Create a promise that uses it
        new DexiePromise(function (resolve, reject) {
            setTimeout(resolve, 500);
        }).then (async function () {

            // This callback will get same PSD instance as was active when .then() was called
            strictEqual(DexiePromise.PSD.test, 5, `expect var on PSD to be 5: (BEFORE AWAIT)` + DexiePromise.PSD.test);
            await new Promise(res => setTimeout(res, 200));
            strictEqual(DexiePromise.PSD.test, 5, `expect var on PSD to be 5 (AFTER AWAIT): ` + DexiePromise.PSD.test);
            DexiePromise.newPSD (async function () {
                DexiePromise.PSD.test = 6;
                strictEqual(DexiePromise.PSD.test, 6, `expect var on PSD to be 6 (inner BEFORE AWAIT new scope): ` + DexiePromise.PSD.test);
                await 3;
                strictEqual(DexiePromise.PSD.test, 6, `expect var on PSD to be 6 (inner AFTER AWAIT new scope): ` + DexiePromise.PSD.test);
            }).finally(done);
            strictEqual(DexiePromise.PSD.test, 5, `expect var on PSD to be 5 (AFTER new scope): ` + DexiePromise.PSD.test);
        });
    });

    notStrictEqual(DexiePromise.PSD.test, 5, `expect var outside that scope NOT to be 5: ` + DexiePromise.PSD.test);
});

test("Should be able to use global Promise within transaction scopes2", function(assert) {
    let done = assert.async();
    // Create a PSD scope
    DexiePromise.newPSD (async function () {

        // Put something in it.
        DexiePromise.PSD.test = 7;

        // Create a promise that uses it
        Promise.resolve().then(async function (resolve, reject) {
            // This callback will get same PSD instance as was active when .then() was called
            strictEqual(Promise.PSD.test, 7, `expect var on PSD to be 7 (BEFORE AWAIT 1): ` + Promise.PSD.test);
            // log(`depending on what we await here, a <span class='important'> Promise or a non Promise</span>, Dexie will work as intended or not:
            //   for non Promises, the <span class='important'> order of execution will also be different</span> (could be a Dexie Bug, due to manual task scheduling and the inability of dexie to recognize the await operator on a non-promise)`);
            // log(`Insight/Bug: <span class='important'>if the first await in a chain has a non-Promise, the PSD will be lost and reverted back to the global PSD; until there is </span>`);
            await 3;
            strictEqual(Promise.PSD.test, 7, `expect var on PSD to be 7 (AFTER AWAIT 1): ${DexiePromise.PSD.test} <-- awaiting a non-Promise`);
            setTimeout(resolve, 1000);
        }).then(async function (resolve, reject) {
            // This callback will get same PSD instance as was active when .then() was called
            strictEqual(Promise.PSD.test, 7, `expect var on PSD to be 7 (BEFORE AWAIT): ` + DexiePromise.PSD.test);
            await Promise.resolve();
            strictEqual(Promise.PSD.test, 7, `expect var on PSD to be 7 (AFTER AWAIT): <span class='important'>${DexiePromise.PSD.test}</span> <-- awaiting a non-Promise`);
            setTimeout(resolve, 1000);
        }).then(async function (resolve, reject) {
            // This callback will get same PSD instance as was active when .then() was called
            strictEqual(Promise.PSD.test, 7, `expect var on PSD to be 7 (BEFORE AWAIT): ` + DexiePromise.PSD.test);
            await 'not a promise';
            strictEqual(Promise.PSD.test, 7, `expect var on PSD to be 7 (AFTER AWAIT): <span class='important'>${DexiePromise.PSD.test}</span> <-- awaiting a non-Promise`);
            setTimeout(resolve, 1000);
        }).then(async function (resolve, reject) {
            // This callback will get same PSD instance as was active when .then() was called
            strictEqual(Promise.PSD.test, 7, `expect var on PSD to be 7 (BEFORE AWAIT): ` + DexiePromise.PSD.test);
            await Promise.resolve();
            strictEqual(Promise.PSD.test, 7, `expect var on PSD to be 7 (AFTER AWAIT): <span class='important'>${Promise.PSD.test}</span> <-- awaiting a Promise`);
            setTimeout(resolve, 1000);
        }).finally(done);
    });

    notStrictEqual(DexiePromise.PSD.test, 7, `expect var outside that scope NOT to be 7: ` + DexiePromise.PSD.test);
});

test("Should be able to use global Promise within nested transaction scopes", function(assert) {
    let done = assert.async();
    let innerPSD;
    let outerPSD = DexiePromise.PSD;
    DexiePromise.newPSD (async function () {
        innerPSD = Promise.PSD;
        Promise.resolve()
            .then(trans => {
                return window.Promise.resolve().then(()=> {
                    notStrictEqual(DexiePromise.PSD, outerPSD, "outerPSD does not leak in 1");
                    strictEqual(Promise.PSD, innerPSD, "Transaction scopes should persist through Promise.resolve() 1");
                    return window.Promise.resolve();
                }).then(()=>{
                    return Promise.resolve();
                }).then(()=>{
                    notStrictEqual(Promise.PSD, outerPSD, "outerPSD does not leak in 2");
                    strictEqual(Promise.PSD, innerPSD, "Transaction scopes should persist through Promise.resolve() 2");
                    return Promise.resolve('foobar');
                });
            }).then (function(foobar){
            strictEqual(foobar, 'foobar', "Transaction should have lived throughout the Promise.resolve() chain");
            notStrictEqual(Promise.PSD, outerPSD, "outerPSD does not leak in 3");
            strictEqual(Promise.PSD, innerPSD, "Transaction scopes should persist through Promise.resolve() 3");
            }).catch (signalError).finally(done);
    });
    notStrictEqual(DexiePromise.PSD, innerPSD, "innerPSD does not leak");
    strictEqual(DexiePromise.PSD, outerPSD, "outerPSD does not leak in !out");
});

//**************************************************************************************************************

test("Should be able to use native async await", function(assert) {
    let done = assert.async();
    DexiePromise.resolve().then(()=>{
        let f = function() {
            return withZone(async ()=>{
                let trans = DexiePromise.PSD;
                ok(!!trans, "Should have a current transaction");
                await new Promise(resolve => setTimeout(resolve, 40));
                ok(DexiePromise.PSD === trans, "Transaction persisted between await calls of Dexie.Promise");
                await DexiePromise.resolve();
                ok(DexiePromise.PSD === trans, "Transaction persisted between await calls of Dexie.Promise synch");
                await window.Promise.resolve();
                ok(DexiePromise.PSD === trans, "Transaction persisted between await calls of global Promise");
                await 3;
                ok(DexiePromise.PSD === trans, "Transaction persisted between await calls of primitive(!)");
                await withZone(async () => {
                    const innerTrans = DexiePromise.PSD;
                    ok(!!innerTrans, "Should have inner transaction");
                    equal(DexiePromise.PSD, innerTrans, "Inner transaction should be there");
                    equal(innerTrans.parent, trans, "Parent transaction should be correct");
                    let x = await Promise.resolve(1);
                    ok(DexiePromise.PSD === innerTrans, "Transaction persisted in inner transaction");
                });
                ok(DexiePromise.PSD === trans, "Transaction persisted between await calls of sub transaction");
                await (async ()=>{
                    return await Promise.resolve(1);
                })();
                ok(DexiePromise.PSD === trans, "Transaction persisted between await calls of async function");
                await (async ()=>{
                    await Promise.all([withZone(async() => {
                        await Promise.resolve(1);
                        await Promise.resolve(2);
                    }), withZone(async() => {
                        return await Promise.resolve(1);
                    })]);
                })();
                ok(DexiePromise.PSD === trans, "Transaction persisted between await calls of async function 2");

                await window.Promise.resolve().then(()=>{
                    ok(DexiePromise.PSD === trans, "Transaction persisted after window.Promise.resolve().then()");
                    return (async ()=>{})(); // Resolve with native promise
                }).then(()=>{
                    ok(DexiePromise.PSD === trans, "Transaction persisted after native promise completion");
                    return window.Promise.resolve();
                }).then(()=>{
                    ok(DexiePromise.PSD === trans, "Transaction persisted after window.Promise.resolve().then()");
                    return (async ()=>{})();
                });
                ok(DexiePromise.PSD === trans, "Transaction persisted between await calls of mixed promises");
            })
        }
        return f();
    }).catch(unsupportedNativeAwait).then(done);
});

const NativePromise = (()=>{
    try {
        return new Function("return (async ()=>{})().constructor")();
    } catch(e) {
        return window.Promise; 
    }
})();

test("Must not leak PSD zone", async function(assert) {
    let done = assert.async();

    if (!hasNativeAsyncFunctions) {
        ok(true, "Browser doesnt support native async-await");
        done();
        return;
    }
    let F = function F(){
        ok(DexiePromise.PSD.global, "Should not have an ongoing transaction to start with");
        var trans1, trans2;
        var p1 = withZone(async ()=> {
            var trans = trans1 = DexiePromise.PSD;
            await Promise.resolve(1); // Just to prohibit IDB bug in Safari - must use transaction in initial tick!
            await 3;
            ok(DexiePromise.PSD === trans, "Should still be in same transaction 1.0 - after await 3");
            await 4;
            ok(DexiePromise.PSD === trans, "Should still be in same transaction 1.0 - after await 4");
            await 5;
            ok(DexiePromise.PSD === trans, "Should still be in same transaction 1.0 - after await 5");
            await Promise.resolve(1);
            ok(DexiePromise.PSD === trans, "Should still be in same transaction 1.1 - after db.items.get(1)");
            await 6;
            ok(DexiePromise.PSD === trans, "Should still be in same transaction 1.1 - after await 6");
            await subFunc(1);
            ok(DexiePromise.PSD === trans, "Should still be in same transaction 1.2 - after async subFunc()");
            await Promise.all([subFunc(11), subFunc(12), subFunc(13)]);
            ok(DexiePromise.PSD === trans, "Should still be in same transaction 1.3 - after Promise.all()");
            await subFunc2_syncResult();
            ok(DexiePromise.PSD === trans, "Should still be in same transaction 1.4 - after async subFunc_syncResult()");
            await Promise.all([subFunc2_syncResult(), subFunc2_syncResult(), subFunc2_syncResult()]);
            ok(DexiePromise.PSD === trans, "Should still be in same transaction 1.5 - after Promise.all(sync results)");
        });
        var p2 = withZone(async ()=> {
            var trans = trans2 = DexiePromise.PSD;
            await Promise.resolve(1); // Just to prohibit IDB bug in Safari - must use transaction in initial tick!
            ok(trans1 !== trans2, "Parallell transactions must be different from each other");
            await 3;
            ok(DexiePromise.PSD === trans, "Should still be in same transaction 2.0 - after await 3");
            await Promise.resolve(1);
            ok(DexiePromise.PSD === trans, "Should still be in same transaction 2.1 - after db.items.get(1)");
            await subFunc(2);
            ok(DexiePromise.PSD === trans, "Should still be in same transaction 2.2 - after async subFunc()");
            await Promise.all([subFunc(21), subFunc(22), subFunc(23)]);
            ok(DexiePromise.PSD === trans, "Should still be in same transaction 2.3 - after Promise.all()");
            await subFunc2_syncResult();
            ok(DexiePromise.PSD === trans, "Should still be in same transaction 2.4 - after async subFunc_syncResult()");
            await Promise.all([subFunc2_syncResult(), subFunc2_syncResult(), subFunc2_syncResult()]);
            ok(DexiePromise.PSD === trans, "Should still be in same transaction 2.5 - after Promise.all(sync results)");
        });
        //var p2 = Promise.resolve();
        ok(DexiePromise.PSD.global, "Should not have an ongoing transaction after transactions");

        async function subFunc(n) {
            await 3;
            let result = await Promise.resolve(2);
            return result;
        }

        async function subFunc2_syncResult() {
            let result = await 3;
            return result;
        }
        
        return Promise.all([p1, p2]);
    }
    F().catch(e => ok(false, e.stack || e)).then(done);
});

test("Must not leak PSD zone2", async function(assert) {
    let done = assert.async();
    const globalPSD = DexiePromise.PSD
    ok(globalPSD.global, "Should not have an ongoing transaction to start with");

    let otherZonePromise;
    (()=>{
        function promiseFlow () {
            return NativePromise.resolve().then(()=>{
                if(DexiePromise.PSD !== globalPSD) ok(false, "PSD zone leaked");
                return new NativePromise(resolve => NativePromise.resolve().then(resolve));
            });
        }
        otherZonePromise = promiseFlow();
        for (let i=0;i<100;++i) {
            otherZonePromise = otherZonePromise.then(promiseFlow);
        }
    })()

    DexiePromise.newPSD(()=>{
        let trans = Promise.PSD;
        ok(trans !== null, "Should have a current transaction");

        // In parallell with the above 2*100 async tasks are being executed and verified,
        // maintain the transaction zone below:
        return Promise.resolve().then(()=>{ // Just to prohibit IDB bug in Safari - must use transaction in initial tick!
            return;
        }).then(()=> {
            ok(DexiePromise.PSD === trans, "Still same transaction 1");
            // Make sure native async functions maintains the zone:
            let f = function f(){
                return (async ()=>{
                    ok(DexiePromise.PSD === trans, "Still same transaction 1.1");
                    await Promise.resolve();
                    ok(DexiePromise.PSD === trans, "Still same transaction 1.2");
                    await DexiePromise.resolve();
                    ok(DexiePromise.PSD === trans, "Still same transaction 1.3");
                    await window.Promise.resolve();
                    ok(DexiePromise.PSD === trans, "Still same transaction 1.4");
                    await DexiePromise.resolve(1);
                })()
            };
            return f();
        }).catch (unsupportedNativeAwait).then(()=>{
            // NativePromise
            ok(DexiePromise.PSD === trans, "Still same transaction 2");
            return Promise.resolve();
        }).then(()=>{
            // window.Promise
            ok(DexiePromise.PSD === trans, "Still same transaction 3");
            return DexiePromise.resolve();
        }).then(()=>{
            // Dexie.Promise
            ok(DexiePromise.PSD === trans, "Still same transaction 4");
            return otherZonePromise; // wait for the foreign zone promise to complete.
        }).then(()=>{
            ok(DexiePromise.PSD === trans, "Still same transaction 5");
        });
    }).catch(signalError).then(done);
});

test("Should be able to await Promise.all()", async (assert) => {
    let done = assert.async();

    if (!hasNativeAsyncFunctions) {
        ok(true, "Browser doesnt support native async-await");
        done();
        return;
    }

    (function f() {
        return withZone(async (trans)=>{
            trans = Promise.PSD;
            ok(Promise.PSD === trans, "Correct initial transaction.");
            await Promise.resolve(1); // Just to prohibit IDB bug in Safari - must use transaction in initial tick!
            var promises = [];
            for (var i=0; i<50; ++i) {
                promises.push(subAsync1(trans));
            }
            for (var i=0; i<50; ++i) {
                promises.push(subAsync2(trans));
            }

            await Promise.all(promises);
            ok(Promise.PSD === trans, "Still same transaction 1 - after await Promise.all([100 promises...]);");
            await Promise.all([1,2,3, Promise.resolve(2)]);
            ok(Promise.PSD === trans, "Still same transaction 2 - after Promise.all(1,2,3,db.items.get(2))");
            await Promise.resolve(1);
            ok(Promise.PSD === trans, "Still same transaction 3 - after await db.items.get(1);");
            await 3;
            ok(Promise.PSD === trans, "Still same transaction 4 - after await 3;");
        });

        async function subAsync1 (trans) {
            await 1;
            await 2;
            await 3;
            if (Promise.PSD !== trans) ok(false, "Not in transaction");
        }

        async function subAsync2 (trans) {
            await 1;
            await 2;
            if (Promise.PSD !== trans) ok(false, "Not in transaction 2");
            await Promise.resolve(1);
        }
    })()
    .catch(e => {
        ok(false, e.stack || e);
    }).then(done);
});

/*
spawnedTest("Should use Promise.all where applicable", function* (){
    yield db.transaction('rw', db.items, function* () {
        let x = yield Promise.resolve(3);
        yield db.items.bulkAdd([{id: 'a'}, {id: 'b'}]);
        let all = yield Promise.all([db.items.get('a'), db.items.get('b')]);
        equal (all.length, 2);
        equal (all[0].id, 'a');
        equal (all[1].id, 'b');
        all = yield Promise.all([db.items.get('a'), db.items.get('b')]);
        equal (all.length, 2);
        equal (all[0].id, 'a');
        equal (all[1].id, 'b');
    });
});

 */

spawnedTest("Even when keeping a reference to global Promise, still maintain PSD zone states", function* (){
   let Promise = window.Promise;
   yield withZone(() => {
       var trans = DexiePromise.PSD;
       ok (trans !== null, "Have a transaction");
       return Promise.resolve().then(()=>{
           ok (DexiePromise.PSD === trans, "Still have the same current transaction.");
           return Promise.resolve().then(()=>Promise.resolve());
       }).then(()=>{
           ok (DexiePromise.PSD === trans, "Still have the same current transaction after multiple global.Promise.resolve() calls");
       });
   });
});

spawnedTest ("Sub Transactions with async await", function*() {
    yield (function f(){
        return (async ()=>{
            const items = await DexiePromise.resolve([{id: 1}, {id:2}, {id: 3}]);
            const numItems = items.length;
                let result = await withZone(async ()=>{
                await DexiePromise.resolve();
                let numItems1 = await withZone(async ()=>{
                    equal(await Promise.resolve(numItems), await Promise.resolve(numItems), "Two awaits of count should equal");
                    equal(await Promise.resolve(numItems), 3, "Should be 3 items");
                    return await Promise.resolve(numItems);
                });
                let numItems2 = await withZone(async ()=>{
                    equal(await Promise.resolve(numItems), await Promise.resolve(numItems), "Two awaits of count should equal");
                    equal(await Promise.resolve(numItems), 3, "Should be 3 items");
                    return await Promise.resolve(numItems);
                });
                equal (numItems1, numItems2, "The total two inner transactions should be possible to run after each other");
                return numItems;
            });
            equal (result, 3, "Result should be 3");
        })();
    })();
});

promisedTest ("Should patch global Promise within transaction scopes but leave them intact outside", async() => {
    ok(Promise !== DexiePromise, "At global scope. Promise should not be DexiePromise");
    ok(window.Promise !== DexiePromise, "At global scope. Promise should not be DexiePromise");
    var GlobalPromise = window.Promise;
    await withZone(async() =>{
        ok(Promise === DexiePromise, "Within transaction scope, Promise should be DexiePromise.");
        ok(window.Promise === DexiePromise, "Within transaction scope, window.Promise should be DexiePromise.");
        ok(GlobalPromise !== Promise, "Promises are different");
        ok(GlobalPromise.resolve === Promise.resolve, "If holding a reference to the real global promise and doing Promise.resolve() it should be DexiePromise.resolve withing transaction scopes")
        ok(GlobalPromise.reject === Promise.reject, "If holding a reference to the real global promise and doing Promise.reject() it should be DexiePromise.reject withing transaction scopes")
        ok(GlobalPromise.all === Promise.all, "If holding a reference to the real global promise and doing Promise.all() it should be DexiePromise.all withing transaction scopes")
        ok(GlobalPromise.race === Promise.race, "If holding a reference to the real global promise and doing Promise.race() it should be DexiePromise.race withing transaction scopes")
    });
});

async function withZone(cb) {
    return DexiePromise.resolve().then(async () => {
            return DexiePromise.newPSD(async () => {
                return cb()
        })
    });
}
promisedTest ("Should be able to use transpiled async await", async () => {
    let trans;
    await withZone(async ()=>{
        trans = DexiePromise.PSD;
        ok(!!trans, "Should have a current transaction");
        await DexiePromise.resolve({id: 'foo'});
        ok(DexiePromise.PSD === trans, "Transaction persisted between await calls of Dexie.Promise");
        await Promise.resolve();
        ok(DexiePromise.PSD === trans, "Transaction persisted between await calls of Promise.resolve()");
        await 3;
        ok(DexiePromise.PSD === trans, "Transaction persisted after await 3");
        await withZone(async (innerTrans) => {
            innerTrans = DexiePromise.PSD;
            ok(!!innerTrans, "Should have inner transaction");
            equal(DexiePromise.PSD, innerTrans, "Inner transaction should be there");
            equal(innerTrans.parent, trans, "Parent transaction should be correct");
            let x = await Promise.resolve(1);
            ok(DexiePromise.PSD === innerTrans, "Transaction persisted in inner transaction");
        });
        ok(DexiePromise.PSD === trans, "Transaction persisted between await calls of sub transaction");
        await (async ()=>{
            return await Promise.resolve(1);
        })();
        ok(DexiePromise.PSD === trans, "Transaction persisted between await calls of async function");
        await (async ()=>{
            await Promise.all([withZone(async() => {
                await DexiePromise.resolve(1);
                await DexiePromise.resolve(2);
            }), withZone(async() => {
                return await DexiePromise.resolve(1);
            })]);
        })();
        ok(DexiePromise.PSD === trans, "Transaction persisted between await calls of async function 2");

        await Promise.resolve().then(()=>{
            ok(DexiePromise.PSD === trans, "Transaction persisted after window.Promise.resolve().then()");
            return (async ()=>{})(); // Resolve with native promise
        }).then(()=>{
            ok(DexiePromise.PSD === trans, "Transaction persisted after native promise completion");
            return Promise.resolve();
        }).then(()=>{
            ok(DexiePromise.PSD === trans, "Transaction persisted after window.Promise.resolve().then()");
            return (async ()=>{})();
        });
        ok(DexiePromise.PSD === trans, "Transaction persisted between await calls of mixed promises");

    }).catch ('PrematureCommitError', ()=> {
        ok(true, "PROMISE IS INCOMPATIBLE WITH INDEXEDDB (https://github.com/dfahlander/Dexie.js/issues/317). Ignoring test.");
    });

    notStrictEqual(DexiePromise.PSD, trans, 'PSD leaked outside');
});

promisedTest ("Should be able to use some simpe native async await even without zone echoing ", async () => {
    if (!hasNativeAsyncFunctions) {
        ok(true, "Browser doesnt support native async-await");
        return;
    }

    await (function f(){
        return DexiePromise.newPSD(trans=> (async (trans) => {
            ok(!DexiePromise.PSD.global, "Correct (non-global) initial transaction.");
            const psd = DexiePromise.PSD;
            await Promise.all([1,2,3, DexiePromise.resolve(2), Promise.resolve()]);
            strictEqual(DexiePromise.PSD, psd, "Still same transaction 1 - after Promise.all(1,2,3,db.items.get(2))");
            await DexiePromise.resolve(1);
            strictEqual(DexiePromise.PSD, psd, "Still same transaction 2 - after await db.items.get(1);");
        })(trans));
    })();
});

function unsupportedNativeAwait(e) {
    if (hasNativeAsyncFunctions)
        ok(false, `Error: ${e.stack || e}`);
    else
        ok(true, `This browser does not support native async functions`);
}

const GlobalPromise = window.Promise;
promisedTest ("Should behave outside transactions as well", async () => {
    if (!hasNativeAsyncFunctions) {
        ok(true, "Browser doesnt support native async-await");
        return;
    }

    function f() {
        async function doSomething() {
            ok(DexiePromise.PSD.global, "Should be at global scope.");
            ok(window.Promise !== DexiePromise, "window.Promise should be original");
            ok(window.Promise === GlobalPromise, "window.Promise should be original indeed");
            await DexiePromise.resolve();
            ok(DexiePromise.PSD.global, "Should be at global scope.");
            await 3;
            ok(DexiePromise.PSD.global, "Should be at global scope.");
            await DexiePromise.resolve();
            ok(true, "Could put an item");
            await DexiePromise.resolve();
            ok(true, "Could query an item");
            ok(DexiePromise.PSD.global, "Should be at global scope.");
            await 4;
            ok(DexiePromise.PSD.global, "Should be at global scope.");
        }

        DexiePromise.newPSD(async () => {
            ok(!DexiePromise.PSD.global)
        })

        return doSomething();
    }
    await (f)();
});
