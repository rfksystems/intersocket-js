/**
 * Logger
 */
export default class Logger {
    /**
     * @param {logEventHandler} handler
     */
    constructor(handler) {
        this._handler = !!handler ? handler : (level, args) => {
            switch (level) {
                case 'trace':
                    console.debug(...args);
                    break;
                case 'debug':
                    console.debug(...args);
                    break;
                case 'info':
                    console.info(...args);
                    break;
                case 'warning':
                    console.warn(...args);
                    break;
                case 'error':
                    console.error(...args);
                    break;
            }
        };
    }

    /**
     * @param {...*} arg
     */
    trace() {
        this._handler('trace', arguments);
    }

    /**
     * @param {...*} arg
     */
    debug() {
        this._handler('debug', arguments);
    }

    /**
     * @param {...*} arg
     */
    info() {
        this._handler('info', arguments);
    }

    /**
     *
     * @param {...*} arg
     */
    warning() {
        this._handler('warning', arguments);
    }

    /**
     * @param {...*} arg
     */
    error() {
        this._handler('error', arguments);
    }
}
