import {DexiePromise} from './../src/helpers/promise.js';
const {module, stop, start, asyncTest, equal, ok} = QUnit;

function supportsDOMEvents() {
    return typeof window === 'object' && window.addEventListener;
}

module("promise");

//Dexie.debug = "dexie";

function createDirectlyResolvedPromise() {
    return new DexiePromise(function(resolve) {
        resolve();
    });
}

asyncTest("Promise basics", ()=>{
   new DexiePromise(resolve => resolve("value"))
   .then(value => {
      equal(value, "value", "Promise should be resolved with 'value'");
   }).then(()=>{
      start(); 
   });
});

asyncTest("return Promise.resolve() from Promise.then(...)", ()=>{
    new DexiePromise(resolve => resolve("value"))
    .then (value => {
        return DexiePromise.resolve(value);
    }).then (value => {
        equal (value, "value", "returning DexiePromise.resolve() from then handler should work");
        start();
    })
});

asyncTest("return unresolved Promise from Promise.then(...)", ()=>{
    new DexiePromise(resolve => resolve("value"))
    .then (value => {
        return new DexiePromise(resolve => setTimeout(resolve, 0, "value"));
    }).then (value => {
        equal (value, "value", "When unresolved promise is resolved, this promise should resolve with its value");
        start();
    })
});

asyncTest("Compatibility with other promises", ()=>{
    DexiePromise.resolve().then(()=>{
       return window.Promise.resolve(3); 
    }).then(x => {
        equal(x, 3, "returning a window.Promise should be ok");
        start();
    })
});

asyncTest("When to promise resolve", ()=>{
    var Promise = DexiePromise;
    var res = [];
    Promise.follow(()=>{
        new Promise (resolve => resolve()).then(()=>res.push("B1"));
        res.push("A1");
        new Promise (resolve => resolve()).then(()=>res.push("B2"));
        res.push("A2");
    }).then(()=>{
        equal(JSON.stringify(res), JSON.stringify([
            "A1",
            "A2",
            "B1",
            "B2"
        ]), "Resolves come in expected order.");
    }).catch(e => {
        ok(false, e.stack || e);
    }).then(start);
});

asyncTest("Promise.follow()", ()=>{
    var Promise = DexiePromise;
    Promise.follow(() => {
        Promise.resolve("test")
            .then(x => x + ":")
            .then(x => Promise.reject("rejection"))
            .then(()=>ok(false, "Should not come here"))
            .catch(e => equal(e, "rejection", "Should catch rejection"));
    }).then(()=>ok(true, "Scope ended"))
      .catch(e => ok(false, "Error: " + e.stack))
      .then(start);
});

asyncTest("Promise.follow() 2", ()=>{
    var Promise = DexiePromise;
    Promise.follow(() => {
        Promise.resolve("test")
            .then(x => x + ":")
            .then(x => Promise.reject("rejection"))
            .then(()=>ok(false, "Should not come here"))
    }).then(()=>ok(false, "Scope should not resolve"))
      .catch(e => ok(true, "Got error: " + e.stack))
      .then(start);
});

asyncTest("Promise.follow() 3 (empty)", ()=>{
    DexiePromise.follow(()=>{})
        .then(()=>ok(true, "Promise resolved when nothing was done"))
        .then(start); 
});

asyncTest ("Promise.follow chained", ()=>{
    var Promise = DexiePromise;
    //Promise._rootExec(()=>{        
    //Promise.scheduler = (fn, args) => setTimeout(fn, 0, args[0], args[1], args[2]);
        
    Promise.follow(()=>{
        new Promise(resolve => resolve()).then(()=>Promise.follow(()=>{
            Promise.PSD.inner = true;
            
            // Chains and rejection
            new Promise(resolve => resolve())
                .then(x => 3)
                .then(null, e => "catched")
                .then(x => {}) 
                .then(()=>{throw new TypeError("oops");})
            }).then(()=>ok(false, "Promise.follow() should not resolve since an unhandled rejection should have been detected"))
        ).then(()=>ok(false, "Promise.follow() should not resolve since an unhandled rejection should have been detected"))
        .catch (TypeError, err => {
            ok(true, "Got TypeError: " + err.stack);
        });
    }).then (()=> ok(true, "Outer Promise.follow() should resolve because inner was catched"))
    .catch (err => {
        ok(false, "Should have catched TypeError: " + err.stack);
    }).then(()=>{
        start();
    });
    //});
});

asyncTest("onunhandledrejection should propagate once", 1, function(){
    if (!supportsDOMEvents()) {
        ok(true, "Skipping - DOM events not supported");
        start();
        return;
    }

    var Promise = DexiePromise;
    function logErr (ev) {
        ok(true, ev.reason);
        return false;
    }
    
    window.addEventListener('unhandledrejection', logErr);
    var p = new Promise((resolve, reject)=>{
        reject("apa");
    }).finally(()=>{

    }).finally(()=>{

    });
    var p2 = p.finally(()=>{});
    var p3 = p.then(()=>{});
    var p4 = p.then(()=>{

    }).then(()=>{

    });
    Promise.all([p, p2, p3, p4]).finally(()=>{
        setTimeout(()=>{
            window.removeEventListener('unhandledrejection', logErr);
            start();
        }, 1);
    });
});

asyncTest("onunhandledrejection should not propagate if catched after finally", 1, function(){
    if (!supportsDOMEvents()) {
        ok(true, "Skipping - DOM events not supported");
        start();
        return;
    }
    var Promise = DexiePromise;
    function logErr (ev) {
        ok(false, "Should already be catched:" + ev.reason);
    }
    window.addEventListener('unhandledrejection', logErr);
    var p = new Promise((resolve, reject)=>{
        reject("apa");
    }).finally(()=>{

    }).finally(()=>{

    }).catch(e => {
        ok(true, "Catching it here: " + e);
    });

    var p2 = p.finally(()=>{});
    var p3 = p.then(()=>{});
    var p4 = p.then(()=>{

    }).then(()=>{

    });

    Promise.all([p, p2, p3, p4]).finally(()=>{
        setTimeout(()=>{
            window.removeEventListener('unhandledrejection', logErr);
            start();
        }, 1);
    });
});


asyncTest("Issue#27(A) - Then handlers are called synchronously for already resolved promises", function () {
    // Test with plain DexiePromise()
    var expectedLog = ['1', '3', '2', 'a', 'c', 'b'];
    var log = [];

    var promise = createDirectlyResolvedPromise();
    log.push('1');
    promise.then(function() {
        log.push('2');
        log.push('a');
        promise.then(function() {
            log.push('b');
            check();
        });
        log.push('c');
        check();
    });
    log.push('3');
    check();

    function check() {
        if (log.length == expectedLog.length) {
            for (var i = 0; i < log.length; ++i) {
                equal(log[i], expectedLog[i], "Position " + i + " is " + log[i] + " and was expected to be " + expectedLog[i]);
            }
            start();
        }
    }
});

asyncTest("Issue #97 A transaction may be lost after calling DexiePromise.resolve().then(...)", function() {
    DexiePromise.newPSD(function () {

        DexiePromise.PSD.hello = "promise land";

        DexiePromise.resolve().then(function () {
            ok(!!DexiePromise.PSD, "We should have a DexiePromise.PSD");
            equal(DexiePromise.PSD.hello, "promise land");
        }).catch(function(e) {
            ok(false, "Error: " + e);
        }).finally(start);

    });
});

/*asyncTest("setTimeout vs setImmediate", ()=>{
    var log=[];
    setImmediate(()=>{
        log.push("setImmediate");
        if (log.length == 2) end();
    });
    setTimeout(()=>{
        log.push("setTimeout");
        if (log.length == 2) end();
    }, 40);
    function end() {
        equal(log[0], "setImmediate", "setImmediate first");
        equal(log[1], "setTimeout", "setTimeout second");
        start();
    }
});*/

asyncTest("unhandledrejection", ()=> {
    if (!supportsDOMEvents()) {
        ok(true, "Skipping - DOM events not supported");
        start();
        return;
    }
    var errors = [];
    function onError(ev) {
        errors.push(ev.reason);
        ev.preventDefault();
    }
    window.addEventListener('unhandledrejection', onError);
    
    new DexiePromise((resolve, reject) => {
        reject ("error");
    });
    setTimeout(()=>{
        equal(errors.length, 1, "Should be one error there");
        equal(errors[0], "error", "Should be our error there");
        window.removeEventListener('unhandledrejection', onError);

        start();
    }, 40);
});

asyncTest("unhandledrejection2", ()=> {
    if (!supportsDOMEvents()) {
        ok(true, "Skipping - DOM events not supported");
        start();
        return;
    }
    var errors = [];
    function onError(ev) {
        errors.push(ev.reason);
        ev.preventDefault();
    }
    window.addEventListener('unhandledrejection', onError);
    
    new DexiePromise((resolve, reject) => {
        new DexiePromise((resolve2, reject2) => {
            reject2 ("error");
        }).then(resolve, e => {
            reject(e);
            //return DexiePromise.reject(e);
        });
    });
    
    setTimeout(()=>{
        equal(errors.length, 1, "Should be one error there");
        equal(errors[0], "error", "Should be our error there");
        window.removeEventListener('unhandledrejection', onError);
        start();
    }, 40);
});

asyncTest("unhandledrejection3", ()=> {
    if (!supportsDOMEvents()) {
        ok(true, "Skipping - DOM events not supported");
        start();
        return;
    }
    var errors = [];
    function onError(ev) {
        errors.push(ev.reason);
        ev.preventDefault();
    }
    window.addEventListener('unhandledrejection', onError);
    
    new DexiePromise((resolve, reject) => {
        new DexiePromise((resolve2, reject2) => {
            reject2 ("error");
        }).then(resolve, e => {
            reject(e);
            //return DexiePromise.reject(e);
        });
    }).catch(()=>{});
    
    setTimeout(()=>{
        equal(errors.length, 0, "Should be zarro errors there");
        window.removeEventListener('unhandledrejection', onError);
        start();
    }, 40);
});
