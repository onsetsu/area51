import DexiePromise, {Zone, setZonePrintF, lZone, getFrame} from './../src/helpers/promise.js';

import {decrementExpectedAwaits, incrementExpectedAwaits, newScope} from "../src/helpers/promise.js";

/********************************************************************************************************/
/********************************************************************************************************/
/********************************************************************************************************/

const {module, test, strictEqual, ok, notStrictEqual, config} = QUnit;
config.testTimeout = 5000;

const GlobalPromise = window.Promise;

const transcript = []
module("enter/leave integration", {
    setup: function (assert) {
        transcript.length = 0;
        let done = assert.async();
        done();
    },
    teardown: function () {
    }
});

setZonePrintF(true);
test("enter/leave basic callbacks", async (assert) => {
    let done = assert.async();

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

    function log(arg) { transcript.push(arg); }

    const gZone = lZone(Zone.current);
    let iZone; // innerZone
    log('start');
    withZone(async function () {
        Zone.current.test = 3;
        log('before');
        console.log(`before ${lZone(DexiePromise.PSD)}`, getFrame())
        iZone = lZone(Zone.current)
        await (42);
        console.log(`after ${lZone(DexiePromise.PSD)}`, getFrame())
        strictEqual(Zone.current.test, 3);
        log('after');
    }, {
        beforeEnter(from, to) { log(lZone(from)+'be'+lZone(to)); },
        afterEnter(from, to) { log(lZone(from)+'ae'+lZone(to)); },
        beforeLeave(from, to) { log(lZone(from)+'bl'+lZone(to)); },
        afterLeave(from, to) { log(lZone(from)+'al'+lZone(to)); },
    });
    log('end')
    notStrictEqual(Zone.current.test, 3);

    ok(transcript.join(',').includes('be'), 'entered');
    strictEqual(transcript.join(','), `start,${gZone}be${iZone},${gZone}ae${iZone},before,${iZone}bl${gZone},${iZone}al${gZone},end`);
    transcript.length = 0;
    await new Promise(r => setTimeout(r, 0));
    notStrictEqual(Zone.current.test, 3);

    const expectedSubstring = `${gZone}be${iZone},${gZone}ae${iZone},after,${iZone}bl${gZone},${iZone}al${gZone}`;
    ok(transcript.join(',').includes(expectedSubstring), transcript.join(',') + 'did not include \n' + expectedSubstring);

    // #TODO: we currently have a lot of zoneEchoEnter/Leave microtasks, when running concurrently to other async tests!
    // #TODO: better way would be to track zone echoes per Zone, not globally -> is that even possible?
    // strictEqual(transcript.join(',').match(/be/g || []).length, 0, 'what');

    done();
});

