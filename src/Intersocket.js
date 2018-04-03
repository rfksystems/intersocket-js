import MessageFrame from './MessageFrame.js';
import MessageBuffer from './MessageBuffer.js';
import {SocketTransport} from './SocketTransport.js';
import Logger from './Logger.js';
import Configuration from './Configuration.js';
import SubscriberRegistry from './SubscriberRegistry.js';
import MultiConsumer from './MultiConsumer.js';

const UUIDv4 = require('uuid').v4;

/**
 * New intersocket instance
 * @TODO intersocket now connects immediately when instance is created. This is not optimal. It should connect either on method call or first message.
 */
export default class Intersocket {
    /**
     * @param {Object} options Configuration parameters
     */
    constructor(options) {
        this._id = UUIDv4();
        this._configuration = new Configuration(options || {});
        this._logger = new Logger();
        this._buffer = new MessageBuffer(this._logger);
        this._subscribers = new SubscriberRegistry(this._configuration);
        this._transport = this._createTransport(this, this._configuration);

        this._isDisposed = false;
        this._state = 'new';

        // Intersocket-produced events
        this._onStateChangeConsumer = new MultiConsumer();
        this._onLostMessageResponseConsumer = new MultiConsumer();
        this._onLostAcknowledgedConsumer = new MultiConsumer();
        this._onMessageRescheduledConsumer = new MultiConsumer();

        // Transport-bridged events
        this._onTransportAcknowledgedConsumer = new MultiConsumer();
        this._onTransportHandshakeReceivedConsumer = new MultiConsumer();
        this._onTransportMessageResponseConsumer = new MultiConsumer();
        this._onTransportMessageErrorResponseConsumer = new MultiConsumer();
        this._onTransportOpenConsumer = new MultiConsumer();
        this._onTransportClosedConsumer = new MultiConsumer();
        this._onTransportMessageConsumer = new MultiConsumer();
        this._onTransportErrorConsumer = new MultiConsumer();
        this._onTransportServerErrorConsumer = new MultiConsumer();
        this._onTransportBinaryMessageConsumer = new MultiConsumer();
        this._onTransportBinaryAttachmentConsumer = new MultiConsumer();
        this._onTransportForeignProtocolConsumer = new MultiConsumer();
        this._onTransportUnknownMessageTypeConsumer = new MultiConsumer();
        this._onTransportPlatformChangeConsumer = new MultiConsumer();
        this._onTransportIdentChangeConsumer = new MultiConsumer();
        this._onTransportLostBroadcastConsumer = new MultiConsumer();

        this._ident = null;
        this._platformVersion = null;

        if (this._configuration.tickInterval > 100) {
            this._logger.warning('Intersocket: tick interval larger than 100ms is not recommended. ' +
                'Current value is ' + this._configuration.tickInterval + 'ms. ' +
                'See https://developers.google.com/web/fundamentals/performance/rail for more details.')
        }

        this._monitor = setInterval(this._tick.bind(this), this._configuration.tickInterval);
    }

    /**
     * <p> Create a new message frame and and register it with this instance of {@link Intersocket}.
     *
     * <p> <b>IMPORTANT:</b> do not create new message frames if you have no intention of sending them,
     *                       because frames are registered to this instance on creation and will not be garbage
     *                       collected unless this instance of {@link Intersocket} is itself destroyed!
     *
     * @param {string} topic Topic for which the message was created
     * @returns {MessageFrame} Instance of newly created {@link MessageFrame} or undefined if instance of
     *                         Intersocket is disposed of.
     */
    createFrame(topic) {
        if (this._isDisposed) {
            this._logger.warning('Invoked "createFrame" method has no effect on disposed instance of Intersocket');
            return undefined;
        }

        const frame = new MessageFrame(UUIDv4(), topic, this);
        this._buffer._enqueue(frame);
        return frame;
    }

    /**
     * <p> Create a new {@link MessageFrame} if there are no message frames pending in this same instance of
     * {@link Intersocket} with the same topic and pass it to the consumer.
     *
     * <p> This is useful to avoid accidental congestion of polled updates and such.
     *
     * <p> If there is pending message with this topic already, the consumer will never be called.
     *
     * <p> It is recommended to use this method of frame creation whenever you are periodically sending
     *     messages over the wire and are not storing state externally.
     *
     * @param {string} topic Topic against which to check message existence and create the new message
     *                       if no messages exist.
     * @param {messageFrameConsumer} frameConsumer Consumer to invoke when no existing messages are queued.
     *                                             Accepts one argument - newly created {@link MessageFrame}
     * @param {messageFrameListConsumer} onExists Consumer to invoke when existing messages are found in the
     *                                            queue. Accepts one argument - list of existing {@link MessageFrame}
     *                                            instances.
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    ifNoPending(topic, frameConsumer, onExists) {
        if (this._isDisposed) {
            this._logger.warning('Invoked "ifNoPending" method has no effect on disposed instance of Intersocket');
            return this;
        }

        if (this._buffer.hasForTopic(topic)) {
            onExists(this._buffer.allForTopic());
            return this;
        }

        frameConsumer(this.createFrame(topic));

        return this;
    }

    /**
     * Register a subscriber to be invoked whenever a message that belongs to given topic is received
     * and announce interest to this topic to the server.
     *
     * @param {string} topic Name of the topic to subscribe to.
     * @param {broadcastConsumer} consumer Consumer to invoke when broadcast is received
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    subscribe(topic, consumer) {
        if (this._isDisposed) {
            this._logger.warning('Invoked "subscribe" method has no effect on disposed instance of Intersocket');
            return this;
        }

        this._subscribers.subscribe(topic, consumer);
        this._transport._synchronizeTopics(this._subscribers.getKnownTopics());
        return this;
    }

    /**
     * Remove a subscriber previously subscribed with {@link Intersocket#subscribe}.
     *
     * @param {string} topic Name of topic to unsubscribe from
     * @param {broadcastConsumer} consumer Instance of consumer to unsubscribe.
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    unsubscribe(topic, consumer) {
        this._subscribers.unsubscribe(topic, consumer);
        this._transport._synchronizeTopics(this._subscribers.getKnownTopics());
        return this;
    }

    /**
     * Dispose of this instance. Clears the tick interval and marks this instance as disposed.
     * No ingoing or outgoing messages will be processed, no new frames can be created from disposed instances.
     * All incoming messages will be discarded.
     *
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    dispose() {
        if (this._isDisposed) {
            this._logger.warning('Invoked "dispose" method has no effect on disposed instance of Intersocket');

            return this;
        }

        this._isDisposed = true;
        clearInterval(this._monitor);

        return this;
    }

    /**
     *
     * @returns {SocketTransport}
     */
    getTransport() {
        return this._transport;
    }

    /**
     * Retrieve the underlying {@link WebSocket} instance from current transport.
     *
     * @returns {WebSocket} Current instance of {@link WebSocket} for current {@link SocketTransport}
     */
    getSocket() {
        if (this._isDisposed) {
            this._logger.warning('Invoked "getSocket" method has no effect on disposed instance of Intersocket');

            return undefined;
        }

        return this._transport._socket();
    }

    /**
     * Register a consumer to be invoked whenever state of this {@link Intersocket} instance changes.
     *
     * @param {stateChangeConsumer} consumer Consumer with two arguments - newState and oldState
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onStateChange(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onStateChangeConsumer.add(consumer);
        return this;
    }

    /**
     * Register a consumer to be invoked when message with unknown backing {@link MessageFrame} has been received.
     * This happens if server sends a response frame that the client has no knowledge about, e.g. message
     * has already received a response and removed from buffer, a response received for notification
     * or response meant for some other client. This should not happen unless broken server
     * implementation.
     *
     * @param {lostMessageResponseConsumer} consumer
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onLostMessageResponse(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onLostMessageResponseConsumer.add(consumer);
        return this;
    }

    /**
     * Register a consumer to be invoked when acknowledgement for unknown message has been received.
     * Happens under pretty much the same circumstances than {@link Intersocket#onLostMessageResponse}
     *
     * @param {lostAcknowledgedConsumer} consumer
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onLostAcknowledged(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onLostAcknowledgedConsumer.add(consumer);
        return this;
    }

    /**
     * Register a consumer to be invoked when message acknowledgement has been received.
     *
     * @param {acknowledgedConsumer} consumer
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onAcknowledged(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onTransportAcknowledgedConsumer.add(consumer);
        return this;
    }

    /**
     * Register a consumer to be invoked when handshake response has been received.
     *
     * @param {handshakeConsumer} consumer
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onHandshakeReceived(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onTransportHandshakeReceivedConsumer.add(consumer);
        return this;
    }

    /**
     * Register a consumer to be invoked when message response has been received.
     *
     * @param {messageResponseConsumer} consumer
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onMessageResponse(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onTransportMessageResponseConsumer.add(consumer);
        return this;
    }

    /**
     * Register a consumer to be invoked when message error response has been received.
     * @param {messageErrorResponseConsumer} consumer
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onMessageErrorResponse(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onTransportMessageErrorResponseConsumer.add(consumer);
        return this;
    }

    /**
     *
     * @param {onTransportOpenConsumer} consumer
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onOpen(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onTransportOpenConsumer.add(consumer);
        return this;
    }

    /**
     *
     * @param {onTransportClosedConsumer} consumer
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onClosed(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onTransportClosedConsumer.add(consumer);
        return this;
    }

    /**
     *
     * @param {onTransportMessageConsumer} consumer
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onMessage(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onTransportMessageConsumer.add(consumer);
        return this;
    }

    /**
     *
     * @param {onTransportErrorConsumer} consumer
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onError(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onTransportErrorConsumer.add(consumer);
        return this;
    }

    /**
     *
     * @param {onServerErrorConsumer} consumer
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onServerError(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onTransportServerErrorConsumer.add(consumer);
        return this;
    }

    /**
     *
     * @param {onBinaryMessageConsumer} consumer
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onBinaryMessage(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onTransportBinaryMessageConsumer.add(consumer);
        return this;
    }

    /**
     * // TODO
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onBinaryAttachment(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onTransportBinaryAttachmentConsumer.add(consumer);
        return this;
    }

    /**
     *
     * @param {onForeignProtocolConsumer} consumer
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onForeignProtocol(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onTransportForeignProtocolConsumer.add(consumer);
        return this;
    }

    /**
     *
     * @param {onUnknownMessageTypeConsumer} consumer
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onUnknownMessageType(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onTransportUnknownMessageTypeConsumer.add(consumer);
        return this;
    }

    /**
     *
     * @param {onPlatformChangeConsumer} consumer
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onPlatformChange(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onTransportPlatformChangeConsumer.add(consumer);
        return this;
    }

    /**
     *
     * @param {onIdentChangeConsumer} consumer
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onIdentChange(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onTransportIdentChangeConsumer.add(consumer);
        return this;
    }

    /**
     *
     * @param {onMessageRescheduledConsumer} consumer
     * @returns {Intersocket} current instance of {@link Intersocket}
     */
    onMessageRescheduled(consumer) {
        if (this._isDisposed) {
            return this;
        }
        this._onMessageRescheduledConsumer.add(consumer);
        return this;
    }

    /**
     *
     * @param intersocket
     * @param configuration
     * @returns {SocketTransport}
     * @private
     */
    _createTransport(intersocket, configuration) {
        const transport = new SocketTransport(
            UUIDv4(),
            intersocket._logger,
            configuration
        );

        transport._onAcknowledged(this._onTransportAcknowledged.bind(this));
        transport._onHandshakeReceived(this._onTransportHandshakeReceived.bind(this));
        transport._onMessageResponse(this._onTransportMessageResponse.bind(this));
        transport._onMessageErrorResponse(this._onTransportErrorMessageResponse.bind(this));
        transport._onOpen(this._onTransportOpen.bind(this));
        transport._onClosed(this._onTransportClosed.bind(this));
        transport._onMessage(this._onTransportMessage.bind(this));
        transport._onError(this._onTransportError.bind(this));
        transport._onServerError(this._onTransportServerError.bind(this));
        transport._onBinaryMessage(this._onTransportBinaryMessage.bind(this));
        transport._onBinaryAttachment(this._onTransportBinaryAttachment.bind(this));
        transport._onForeignProtocol(this._onTransportForeignProtocol.bind(this));
        transport._onUnknownMessageType(this._onTransportUnknownMessageType.bind(this));
        transport._onPlatformChange(this._onTransportPlatformChange.bind(this));
        transport._onIdentChange(this._onTransportIdentChange.bind(this));
        transport._onBroadcast(this._onTransportBroadcast.bind(this));

        return transport;
    }

    /**
     * @private
     */
    _tick() {
        if (this._isDisposed) {
            return;
        }

        this._buffer.removeCancelled();
        this._buffer.removeAcknowledgedNotifications();
        this._buffer.forEachTimed(it => it._completeTimed());
        this._buffer.forEachAcknowledgedTimed(it => it._completeAcknowledgedTimed());

        if (!this._transport._isReady()) {
            this._buffer.removeOnlineOnly();
        }

        if (this._transport._isReady()) {
            this._buffer.forEachWithLostTransport(this._transport, it => {

                this._logger.debug("Rescheduling message for re-delivery", it);

                it._reschedule();
                this._onMessageRescheduledConsumer.consume(it);
            });


            this._buffer.forEachNotSent(it => {
                this._transport._sendFrame(it);
                it._sentAt = +new Date();
                it._transport = this._transport;
            });
        }

        this._buffer.removeFinalized();
    }

    /**
     * @param newState
     * @private
     */
    _setState(newState) {
        if (this._state !== newState) {
            const oldState = this._state;
            this._state = newState;
            this._onStateChangeConsumer.consume(newState, oldState);
        }
    }

    /**
     * @param id
     * @param event
     * @private
     */
    _onTransportAcknowledged(id, event) {
        if (this._isDisposed) {
            return;
        }

        const frame = this._buffer.frameWithId(id);

        if (!frame) {
            this._onLostAcknowledgedConsumer.consume(id, event);
            return;
        }

        frame._acknowledge();
        this._onTransportAcknowledgedConsumer.consume(id, frame, event);
    }

    /**
     * @param handshake
     * @param event
     * @private
     */
    _onTransportHandshakeReceived(handshake, event) {
        if (this._isDisposed) {
            return;
        }

        this._setState('ready');
        this._onTransportPlatformChange(handshake.platform);
        this._onTransportIdentChange(handshake.ident);
        this._transport._synchronizeTopics(this._subscribers.getKnownTopics());
        this._onTransportHandshakeReceivedConsumer.consume(handshake, event);
    }

    /**
     * @param id
     * @param payload
     * @param event
     * @private
     */
    _onTransportMessageResponse(id, payload, event) {
        if (this._isDisposed) {
            return;
        }

        const frame = this._buffer.frameWithId(id);

        if (!frame) {
            this._onLostMessageResponseConsumer.consume(id, payload, event);
            return;
        }

        frame._setResponsePayload(payload);
        this._onTransportMessageResponseConsumer.consume(frame, payload, event);
    }

    /**
     * @param id
     * @param payload
     * @param event
     * @private
     */
    _onTransportErrorMessageResponse(id, payload, event) {
        const frame = this._buffer.frameWithId(id);

        if (frame) {
            frame._completeFailed(payload, event);
        }

        this._onTransportMessageErrorResponseConsumer.consume(frame, id, payload, event);
    }

    /**
     * @param event
     * @private
     */
    _onTransportOpen(event) {
        if (this._isDisposed) {
            return;
        }

        if ('reconnecting' !== this._state) {
            this._setState('open');
        }

        this._onTransportOpenConsumer.consume(event);
    }

    /**
     * @param event
     * @private
     */
    _onTransportClosed(event) {
        if (this._isDisposed) {
            return;
        }

        if ('reconnecting' === this._state) {
            this._setState('reconnecting_failed');
        } else {
            this._setState('closed');
        }

        setTimeout(() => {
            this._setState('reconnecting');
            this._transport = this._createTransport(this, this._configuration);
        }, this._configuration.reconnectInterval);

        this._onTransportClosedConsumer.consume(event);
    }

    /**
     * @param event
     * @private
     */
    _onTransportMessage(event) {
        if (this._isDisposed) {
            return;
        }

        this._onTransportMessageConsumer.consume(event);
    }

    /**
     * @param event
     * @private
     */
    _onTransportError(event) {
        if (this._isDisposed) {
            return;
        }

        this._onTransportErrorConsumer.consume(event);
    }

    /**
     * @param payload
     * @param event
     * @private
     */
    _onTransportServerError(payload, event) {
        if (this._isDisposed) {
            return;
        }

        this._onTransportServerErrorConsumer.consume(payload, event);
    }

    /**
     * @param event
     * @private
     */
    _onTransportBinaryMessage(event) {
        if (this._isDisposed) {
            return;
        }
        this._onTransportBinaryMessageConsumer.consume(event);
    }

    /**
     * @param id
     * @param attachment
     * @param event
     * @private
     */
    _onTransportBinaryAttachment(id, attachment, event) {
        if (this._isDisposed) {
            return;
        }

        const frame = this._buffer.frameWithId(id);

        if (!frame) {
            this._onLostMessageResponseConsumer.consume(id, payload, event);
            return;
        }

        frame._setResponseAttachment(attachment);

        this._onTransportBinaryAttachmentConsumer.consume(id, attachment, event);
    }

    /**
     * @param event
     * @private
     */
    _onTransportForeignProtocol(event) {
        if (this._isDisposed) {
            return;
        }

        this._onTransportForeignProtocolConsumer.consume(event);
    }

    /**
     * @param event
     * @private
     */
    _onTransportUnknownMessageType(event) {
        if (this._isDisposed) {
            return;
        }

        this._onTransportUnknownMessageTypeConsumer.consume(event);
    }

    /**
     * @param platformVersion
     * @param event
     * @private
     */
    _onTransportPlatformChange(platformVersion, event) {
        if (this._isDisposed) {
            return;
        }

        if (platformVersion === this._platformVersion) {
            return;
        }

        const previousVersion = this._platformVersion;
        this._platformVersion = platformVersion;
        this._onTransportPlatformChangeConsumer.consume(platformVersion, previousVersion, event);
    }

    /**
     * @param ident
     * @param event
     * @private
     */
    _onTransportIdentChange(ident, event) {
        if (this._isDisposed) {
            return;
        }

        if (ident === this._ident) {
            return;
        }

        const previousIdent = this._ident;
        this._ident = ident;
        this._onTransportIdentChangeConsumer.consume(ident, previousIdent, event);
    }

    /**
     *
     * @param topic
     * @param broadcast
     * @param event
     * @private
     */
    _onTransportBroadcast(topic, broadcast, event) {
        const subscribers = this._subscribers.subscribersFor(topic);
        if (0 === subscribers.length) {
            this._onTransportLostBroadcastConsumer.consume(topic, broadcast, event);
            return;
        }

        const errors = [];

        for (const subscriber of subscribers) {
            try {
                subscriber(broadcast, event, topic);
            } catch (e) {
                errors.push(e);
            }
        }

        if (errors.length > 0) {
            this._logger.error('Errors occured during subscriber invocation', topic, errors);
        }
    }
}
