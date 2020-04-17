/*
 * Copyright (c) 2008-2016 Hasso Plattner Institute
 *
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
'use strict'; 

import * as cop from "./Layers.js";
import { currentLayers } from "./Layers.js";
export { proceed, Layer } from "./Layers.js";

// Layer Activation
export function withLayers(layers, func) {
  const previouslyActiveLayers = currentLayers();
  cop.LayerStack.push({withLayers: layers});
  layers
    .filter(l => !previouslyActiveLayers.includes(l))
    .forEach(l => l._emitActivateCallbacks());
  // console.log("callee: " + withLayers.callee);
  try {
    return func();
  } finally {
    const beforePop = currentLayers();
    cop.LayerStack.pop();
    const afterPop = currentLayers();
    layers
      .filter(l => beforePop.includes(l) && !afterPop.includes(l))
      .forEach(l => l._emitDeactivateCallbacks());
  }
}

export function withoutLayers(layers, func) {
  const beforePush = currentLayers();
  cop.LayerStack.push({withoutLayers: layers});
  layers
    .filter(l => beforePush.includes(l))
    .forEach(l => l._emitDeactivateCallbacks());
  try {
    return func();
  } finally {
    const beforePop = currentLayers();
    cop.LayerStack.pop();
    const afterPop = currentLayers();
    layers
      .filter(l => !beforePop.includes(l) && afterPop.includes(l))
      .forEach(l => l._emitActivateCallbacks());
  }
}

// Layer creation by name
export function layer(...args) {
  let layerName, context;
  if (args.length === 2) {
    [context, layerName] = args;
  } else if (args.length === 1) {
    [layerName] = args;
  }
  return basicCreate(layerName, context);
};

// Private helpers
function basicCreate(layerName, context) {
  if (typeof context === 'undefined')
    context = cop.GlobalNamedLayers;
  if (typeof context[layerName] !== 'undefined') {
    let existing = context[layerName];
    if (!existing.isLayer /* undefined or falsy */ || !existing.isLayer()) {
      throw new Error('Will not overwrite existing property ' + layerName);
    }
    return existing;
  } else {
    return context[layerName] = new cop.Layer(layerName, context);
  }
};
