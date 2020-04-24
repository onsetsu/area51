import { Layer } from './../ContextJS/src/contextjs.js';

export const transcript = {
    inner: [],
    reset() { this.inner.length = 0; },
    push(item) { this.inner.push(item); },
    set length(v) { this.inner.length = v},
    join(separator = ',') {return this.inner.join(separator); },
    layer(name) {
        return new Layer(name)
            .onActivate(() => this.push(name + 'a'))
            .onDeactivate(() => this.push(name + 'd'));
    }
}
