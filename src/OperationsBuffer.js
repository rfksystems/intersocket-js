export default class OperationsBuffer {
    constructor() {
        this._pendingOperations = [];
    }

    append(operation) {
        this._pendingOperations.push(operation);
    }

    forEach(consumer) {
        for (const operation of this._pendingOperations) {
            consumer(operation);
        }
    }

    remove(operation) {
        const index = this._pendingOperations.indexOf(operation);
        this._pendingOperations.splice(index, 1);
    }

    clear() {
        this._pendingOperations = [];
    }
}
