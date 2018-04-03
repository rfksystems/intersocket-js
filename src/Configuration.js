export default class Configuration {
    constructor(options) {
        this.tickInterval = options.tickInterval ? options.tickInterval : 5;
        this.reconnectInterval = options.reconnectInterval ? options.reconnectInterval : 1000;
        this.url = options.url ? options.url : null;
        this.subscribers = options.subscribers ? options.subscribers : [];
    }
}
