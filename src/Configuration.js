export default class Configuration {
    constructor(options) {
        // TODO intervals, topics etc
        this.tickInterval = options.tickInterval ? options.tickInterval : 5;
        this.url = options.url ? options.url : null;
        this.subscribers = {
            // 'a': [
            //     function() {
            //         console.log(arguments);
            //     }
            // ]
        };
    }
}
