/**
 * @hideconstructor
 */
export default class MultiConsumer {
    constructor() {
        this._consumers = [];
    }

    consume() {
        for (const consumer of this._consumers) {
            consumer(...arguments);
        }
    }

    add(consumer) {
        if (-1 !== this._consumers.indexOf(consumer)) {
            return;
        }

        this._consumers.push(consumer);
    }

    remove(consumer) {
        const index = this._consumers.indexOf(consumer);
        if (-1 === index) {
            return;
        }

        this._consumers.splice(index, 1);
    }
}
