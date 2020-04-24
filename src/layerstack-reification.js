import {Layer, withLayers, withoutLayers} from './../ContextJS/src/contextjs.js';
import {activeLayers, currentLayers, LayerStack, proceed, resetLayerStack} from './../ContextJS/src/Layers.js';

export function copyFrame(frame) {
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

export function storeLayerStack() {
    return LayerStack.map(copyFrame);
}

export function replayLayerStack(from) {
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

export function popFrame() {
    const beforePop = currentLayers();

    const frame = LayerStack.pop();
    const { withLayers, withoutLayers } = frame;

    const afterPop = currentLayers();

    // #TODO: we should probably .reverse() the list to deactivate the last activated layer first
    withLayers && withLayers
        .filter(l => beforePop.includes(l) && !afterPop.includes(l))
        .forEach(l => l._emitDeactivateCallbacks());

    withoutLayers && withoutLayers
        .filter(l => !beforePop.includes(l) && afterPop.includes(l))
        .forEach(l => l._emitActivateCallbacks());
}

export function pushFrame(frame) {
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

export function frameEquals(frame1, frame2) {
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
