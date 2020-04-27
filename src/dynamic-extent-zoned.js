import {decrementExpectedAwaits, incrementExpectedAwaits, newScope} from "../src/helpers/promise.js";

import { copyFrame, storeLayerStack, replayLayerStack, popFrame, pushFrame, frameEquals} from './layerstack-reification.js';

export function withZone(scopeFunc, zoneProps = {}) {
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

export function withLayersZoned (layers, callback) {
    return withFrameZoned({withLayers: layers}, callback);
}

export function withoutLayersZoned (layers, callback) {
    return withFrameZoned({withoutLayers: layers}, callback);
}

