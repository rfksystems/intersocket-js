import MultiConsumer from './MultiConsumer.js';

const MAGIC_ID = 463;
const MAGIC_ID_STRING = MAGIC_ID.toString(10);

const TYPE_INT = {
    C2S_HANDSHAKE: 10,
    S2C_HANDSHAKE: 11,
    C2S_MESSAGE: 12,
    S2C_ACK: 13,
    S2C_MESSAGE: 14,
    S2C_IDENT_CHANGE: 15,
    S2C_PLATFORM_CHANGE: 16,
    S2C_BROADCAST: 17,
    S2C_ERROR: 18,
    S2C_MESSAGE_ERROR: 19,
    C2S_SYNCHRONIZE_TOPICS: 20,
    S2C_BINARY_ATTACHMENT: 21,
};

const TYPE_STRING = {
    C2S_HANDSHAKE: TYPE_INT.C2S_HANDSHAKE.toString(10),
    S2C_HANDSHAKE: TYPE_INT.S2C_HANDSHAKE.toString(10),
    C2S_MESSAGE: TYPE_INT.C2S_MESSAGE.toString(10),
    S2C_ACK: TYPE_INT.S2C_ACK.toString(10),
    S2C_MESSAGE: TYPE_INT.S2C_MESSAGE.toString(10),
    S2C_IDENT_CHANGE: TYPE_INT.S2C_IDENT_CHANGE.toString(10),
    S2C_PLATFORM_CHANGE: TYPE_INT.S2C_PLATFORM_CHANGE.toString(10),
    S2C_BROADCAST: TYPE_INT.S2C_BROADCAST.toString(10),
    S2C_ERROR: TYPE_INT.S2C_ERROR.toString(10),
    S2C_MESSAGE_ERROR: TYPE_INT.S2C_MESSAGE_ERROR.toString(10),
    C2S_SYNCHRONIZE_TOPICS: TYPE_INT.C2S_SYNCHRONIZE_TOPICS.toString(10),
    S2C_BINARY_ATTACHMENT: TYPE_INT.S2C_BINARY_ATTACHMENT.toString(10),
};

/**
 * @hideconstructor
 */
class SocketTransport {
    constructor(id, logger, configuration) {
        this._id = id;
        this._logger = logger;
        this._handshakeResponse = null;
        this._configuration = configuration;

        this._onAcknowledgedConsumer = new MultiConsumer();
        this._onHandshakeReceivedConsumer = new MultiConsumer();
        this._onMessageResponseConsumer = new MultiConsumer();
        this._onMessageErrorResponseConsumer = new MultiConsumer();
        this._onOpenConsumer = new MultiConsumer();
        this._onClosedConsumer = new MultiConsumer();
        this._onMessageConsumer = new MultiConsumer();
        this._onErrorConsumer = new MultiConsumer();
        this._onServerErrorConsumer = new MultiConsumer();
        this._onBinaryMessageConsumer = new MultiConsumer();
        this._onBinaryAttachmentConsumer = new MultiConsumer();
        this._onForeignProtocolConsumer = new MultiConsumer();
        this._onUnknownMessageTypeConsumer = new MultiConsumer();
        this._onPlatformChangeConsumer = new MultiConsumer();
        this._onIdentChangeConsumer = new MultiConsumer();
        this._onBroadcastConsumer = new MultiConsumer();

        this._socket = this._createSocket();
    }

    static _encodeFrame(frame) {
        if (frame._payload instanceof ArrayBuffer || frame._payload instanceof DataView || frame._payload instanceof Blob) {
            throw new Error('Binary payloads are not supported by Intersocket');
        }

        return MAGIC_ID_STRING + TYPE_STRING.C2S_MESSAGE + JSON.stringify({
            id: frame._id,
            topic: frame._topic,
            payload: frame._payload,
            notify: frame._isNotification
        });
    }

    static _createHandshake() {
        return MAGIC_ID_STRING + TYPE_STRING.C2S_HANDSHAKE + JSON.stringify({
            protocol: 1,
        });
    }

    static _encodeTopics(topicList) {
        return MAGIC_ID_STRING + TYPE_STRING.C2S_SYNCHRONIZE_TOPICS + JSON.stringify({
            topics: topicList,
        });
    }

    static _blobSplice(startingByte, endingByte, blob) {
        if (blob.webkitSlice) {
            return blob.webkitSlice(startingByte, endingByte);
        } else if (blob.mozSlice) {
            return blob.mozSlice(startingByte, endingByte);
        } else {
            return blob.slice(startingByte, endingByte);
        }
    }

    _createSocket() {
        const socket = new WebSocket(this._configuration.url);

        socket.onclose = this._onSocketClosed.bind(this);
        socket.onopen = this._onSocketOpen.bind(this);
        socket.onerror = this._onSocketError.bind(this);
        socket.onmessage = this._onSocketMessage.bind(this);

        return socket;
    }

    _onSocketOpen(event) {
        this._onOpenConsumer.consume(event);
        this._socket.send(SocketTransport._createHandshake());
    }

    _onSocketClosed(event) {
        this._onClosedConsumer.consume(event);
    }

    _onSocketMessage(event) {
        this._onMessageConsumer.consume(event);


        if (typeof event.data !== 'string') {
            this._onBinaryMessageConsumer.consume(event);

            if (event.data instanceof Blob) {
                const ifHeader = SocketTransport._blobSplice(0, 5, event.data);

                const magicHeaderReader = new FileReader();
                magicHeaderReader.onload = () => {
                    if (magicHeaderReader.result !== MAGIC_ID_STRING + TYPE_STRING.S2C_BINARY_ATTACHMENT) {
                        return;
                    }

                    const ifMessageId = SocketTransport._blobSplice(5, 41, event.data);
                    const messageIdReader = new FileReader();

                    messageIdReader.onload = () => {
                        const messageId = messageIdReader.result;
                        const attachment = SocketTransport._blobSplice(41, undefined, event.data);

                        this._onBinaryAttachmentConsumer.consume(messageId, attachment, event);
                    };

                    messageIdReader.readAsText(ifMessageId, 'ASCII');

                };
                magicHeaderReader.readAsText(ifHeader, 'ASCII');
            }

            return;
        }

        if (event.data.length < 5 || event.data.substr(0, 3) !== MAGIC_ID_STRING) {
            this._onForeignProtocolConsumer.consume(event);
            return;
        }

        const frameType = event.data.substr(3, 2);
        const payloadText = event.data.substr(5);
        const payloadJson = JSON.parse(payloadText);

        if (TYPE_STRING.S2C_HANDSHAKE === frameType) {
            this._handshakeResponse = payloadJson;
            this._onHandshakeReceivedConsumer.consume(this._handshakeResponse, event);
            return;
        }

        if (TYPE_STRING.S2C_ACK === frameType) {
            this._onAcknowledgedConsumer.consume(payloadJson.ack, event);
            return;
        }

        if (TYPE_STRING.S2C_MESSAGE === frameType) {
            this._onMessageResponseConsumer.consume(payloadJson.id, payloadJson.payload, event);
            return;
        }

        if (TYPE_STRING.S2C_IDENT_CHANGE === frameType) {
            this._onIdentChangeConsumer.consume(payloadJson.identChange, event);
            return;
        }

        if (TYPE_STRING.S2C_PLATFORM_CHANGE === frameType) {
            this._onPlatformChangeConsumer.consume(payloadJson.platformChange, event);
            return;
        }

        if (TYPE_STRING.S2C_BROADCAST === frameType) {
            this._onBroadcastConsumer.consume(
                payloadJson.topic,
                payloadJson.broadcast,
                event
            );
            return;
        }

        if (TYPE_STRING.S2C_ERROR === frameType) {
            this._onServerErrorConsumer.consume(payloadJson, event);
            return;
        }

        if (TYPE_STRING.S2C_MESSAGE_ERROR === frameType) {
            this._onMessageErrorResponseConsumer.consume(payloadJson.id, payloadJson, event);
            return;
        }

        this._onUnknownMessageTypeConsumer(event, frameType, payloadJson);
    }

    _onSocketError(event) {
        this._onErrorConsumer.consume(event);
    }

    _synchronizeTopics(topicList) {
        if (!this._isReady()) {
            return;
        }

        this._socket.send(SocketTransport._encodeTopics(topicList));

        return this;
    }

    _sendFrame(frame) {
        if (!this._isReady()) {
            throw new Error('Transport is not ready');
        }

        this._socket.send(SocketTransport._encodeFrame(frame));
        this._logger.debug('Sent frame', frame);

        return this;
    }

    _onAcknowledged(consumer) {
        this._onAcknowledgedConsumer.add(consumer);
        return this;
    }

    _onHandshakeReceived(consumer) {
        this._onHandshakeReceivedConsumer.add(consumer);
        return this;
    }

    _onMessageResponse(consumer) {
        this._onMessageResponseConsumer.add(consumer);
        return this;
    }

    _onMessageErrorResponse(consumer) {
        this._onMessageErrorResponseConsumer.add(consumer);
        return this;
    }

    _onOpen(consumer) {
        this._onOpenConsumer.add(consumer);
        return this;
    }

    _onClosed(consumer) {
        this._onClosedConsumer.add(consumer);
        return this;
    }

    _onMessage(consumer) {
        this._onMessageConsumer.add(consumer);
        return this;
    }

    _onError(consumer) {
        this._onErrorConsumer.add(consumer);
        return this;
    }

    _onServerError(consumer) {
        this._onServerErrorConsumer.add(consumer);
        return this;
    }

    _onBinaryMessage(consumer) {
        this._onBinaryMessageConsumer.add(consumer);
        return this;
    }

    _onBinaryAttachment(consumer) {
        this._onBinaryAttachmentConsumer.add(consumer);
        return this;
    }

    _onForeignProtocol(consumer) {
        this._onForeignProtocolConsumer.add(consumer);
        return this;
    }

    _onUnknownMessageType(consumer) {
        this._onUnknownMessageTypeConsumer.add(consumer);
        return this;
    }

    _onPlatformChange(consumer) {
        this._onPlatformChangeConsumer.add(consumer);
        return this;
    }

    _onIdentChange(consumer) {
        this._onIdentChangeConsumer.add(consumer);
        return this;
    }

    _onBroadcast(consumer) {
        this._onBroadcastConsumer.add(consumer);
        return this;
    }

    _isReady() {
        return 1 === this._socket.readyState && null !== this._handshakeResponse;
    }

    _socket() {
        return this._socket;
    }
}

export {SocketTransport, MAGIC_ID, MAGIC_ID_STRING, TYPE_STRING, TYPE_INT};
