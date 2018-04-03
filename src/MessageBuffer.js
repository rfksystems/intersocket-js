/**
 * Holds messages that are related to {@link Intersocket} instance.
 * @hideconstructor
 */
export default class MessageBuffer {
    constructor(logger) {
        this._logger = logger;
        this._holder = [];
    }

    /**
     *
     * @param {messageFrameConsumer} consumer
     * @returns {MessageBuffer}
     */
    forEachNotSent(consumer) {
        this._holder
            .filter(it => null === it._sentAt && true === it._isReady)
            .forEach(consumer);
        return this;
    }

    /**
     *
     * @param {messageFrameConsumer} consumer
     * @returns {MessageBuffer}
     */
    forEachTimed(consumer) {
        this._holder
            .filter(it => it._isTimed())
            .forEach(consumer);
        return this;
    }

    /**
     *
     * @param {messageFrameConsumer} consumer
     * @returns {MessageBuffer}
     */
    forEachAcknowledgedTimed(consumer) {
        this._holder
            .filter(it => it._isAcknowledgedTimed())
            .forEach(consumer);
        return this;
    }

    /**
     *
     * @param {SocketTransport} transport
     * @param {messageFrameConsumer} consumer
     * @returns {MessageBuffer}
     */
    forEachWithLostTransport(transport, consumer) {
        this._holder
            .filter(it => {
                return null !== it._sentAt
                    && transport._id !== it._transport._id
                    && true === it._isReady
                    && false === (it._isCancelled || it._isFinalized);
            })
            .forEach(consumer);
        return this;
    }

    /**
     *
     * @returns {MessageFrame[]}
     */
    allUnsent() {
        return this._holder.filter(it => null === it._sentAt && true === it._isReady);
    }

    /**
     *
     * @returns {Number}
     */
    size() {
        return this._holder.length;
    }

    /**
     *
     * @returns {MessageFrame[]}
     */
    buffer() {
        return this._holder;
    }

    /**
     *
     * @param id
     * @returns {MessageFrame|undefined}
     */
    frameWithId(id) {
        return this._holder.find(it => id === it._id);
    }

    /**
     *
     * @param topic
     * @returns {boolean}
     */
    hasForTopic(topic) {
        return typeof this.allForTopic(topic) !== 'undefined';
    }

    /**
     *
     * @param topic
     * @returns {MessageFrame[]}
     */
    allForTopic(topic) {
        return this._holder.find(it => topic === it._topic);
    }

    /**
     *
     * @returns {MessageBuffer}
     */
    removeFinalized() {
        const toRemove = this._holder.filter(it => true === it._isFinalized);
        if (toRemove.length > 0) {
            this._logger.trace('Removing finalized frames from buffer', toRemove);
        }
        this.removeFrames(toRemove);
        return this;
    }

    /**
     *
     * @returns {MessageBuffer}
     */
    removeCancelled() {
        const toRemove = this._holder.filter(it => true === it._isCancelled);
        if (toRemove.length > 0) {
            this._logger.trace('Removing cancelled frames from buffer', toRemove);
        }
        this.removeFrames(toRemove);
        return this;
    }

    /**
     *
     * @returns {MessageBuffer}
     */
    removeOnlineOnly() {
        const toRemove = this._holder.filter(it => true === it._discardIfOffline);

        if (toRemove.length > 0) {
            this._logger.trace('Removing online-only frames from buffer', toRemove);
        }

        this.removeFrames(toRemove);
        return this;
    }

    /**
     *
     * @returns {MessageBuffer}
     */
    removeAcknowledgedNotifications() {
        const toRemove = this._holder.filter(it => true === it._isNotification && null !== it._acknowledgedAt);
        if (toRemove.length > 0) {
            this._logger.trace('Removing acknowledged notification frames from buffer', toRemove);
        }
        this.removeFrames(toRemove);
        return this;
    }

    /**
     *
     * @param {MessageFrame[]} frames
     * @returns {MessageBuffer}
     */
    removeFrames(frames) {
        for (const frame of frames) {
            const index = this._holder.indexOf(frame);

            if (-1 === index) {
                continue;
            }

            this._holder.splice(index, 1);
        }
        return this;
    }

    /**
     *
     * @param {MessageFrame} frame
     * @private
     */
    _enqueue(frame) {
        if (!!this.frameWithId(frame.id)) {
            // Guard against dupes
            return;
        }

        this._logger.debug('Enqueueing frame', frame);
        this._holder.push(frame);
    }
}
