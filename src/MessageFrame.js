/**
 * @class MessageFrame
 * @hideconstructor
 */
export default class MessageFrame {
    constructor(id, topic, socket) {
        this._id = id.toString();
        this._topic = topic;
        this._socket = socket;
        this._transport = null;

        // Times
        this._createdAt = +new Date();
        this._sentAt = null;
        this._acknowledgedAt = null;
        this._responseAt = null;

        // Timeouts (millis)
        this._timeout = null;
        this._acknowledgeTimeout = null;

        this._isCancelled = false;
        this._isFinalized = false;
        this._isReady = false;
        this._isNotification = false;

        this._payload = null;

        this._completeHandlers = [];
        this._errorHandlers = [];
        this._finallyHandlers = [];
        this._acknowledgedHandlers = [];
        this._timedHandlers = [];
        this._acknowledgedTimedHandlers = [];
    }

    static _handle(handlers, frame, arg, event) {
        for (const handler of handlers) {
            handler(arg, frame, event);
        }
    }

    withAcknowledgeTimeout(millis) {
        this._acknowledgeTimeout = millis;
        return this;
    }

    withTimeout(millis) {
        this._timeout = millis;
        return this;
    }

    then(onComplete) {
        this._completeHandlers.push(onComplete);
        return this;
    }

    orElse(onError) {
        this._errorHandlers.push(onError);
        return this;
    }

    finally(onFinally) {
        this._finallyHandlers.push(onFinally);
        return this;
    }

    whenAcknowledged(onAcknowledged) {
        this._acknowledgedHandlers.push(onAcknowledged);
        return this;
    }

    whenTimed(onTimed) {
        this._timedHandlers.push(onTimed);
        return this;
    }

    whenAcknowledgedTimed(onTimed) {
        this._acknowledgedTimedHandlers.push(onTimed);
        return this;
    }

    send(payload) {
        if (this._isReady || null !== this._sentAt) {
            throw new Error('Already scheduled to be sent'); // TODO
        }

        if (payload instanceof ArrayBuffer || payload instanceof DataView || payload instanceof Blob) {
            throw new Error('Binary payloads are not supported by Intersocket. Encode as string ' +
                'or use underlying socket directly.');
        }

        this._payload = payload;
        this._isReady = true;
        return this;
    }

    notify(payload) {
        if (this._isReady || null !== this._sentAt) {
            throw new Error('Already scheduled to be sent'); // TODO
        }

        if (payload instanceof ArrayBuffer || payload instanceof DataView || payload instanceof Blob) {
            throw new Error('Binary payloads are not supported by Intersocket. Encode as string ' +
                'or use underlying socket directly.');
        }

        this._payload = payload;
        this._isNotification = true;
        this._isReady = true;
        return this;
    }

    cancel() {
        this._isCancelled = true;
        return this;
    }

    _reschedule() {
        if (this._isCancelled || this._isFinalized) {
            return;
        }

        this._sentAt = null;
        this._acknowledgedAt = null;
        this._responseAt = null;
        this._transport = null;
    }

    _complete(responsePayload, event) {
        if (!this._canHandle()) {
            return;
        }

        this._isFinalized = true;

        try {
            MessageFrame._handle(this._completeHandlers, this, responsePayload, event);
        } finally {
            MessageFrame._handle(this._finallyHandlers, this, responsePayload, event);
        }
    }

    _completeFailed(error, event) {
        if (!this._canHandle()) {
            return;
        }
        this._isFinalized = true;

        try {
            MessageFrame._handle(this._errorHandlers, this, error, event);
        } finally {
            MessageFrame._handle(this._finallyHandlers, this, error, event);
        }
    }

    _completeTimed() {
        if (!this._canHandle()) {
            return;
        }

        this._isFinalized = true;

        try {
            MessageFrame._handle(this._timedHandlers, this);
        } finally {
            MessageFrame._handle(this._finallyHandlers, this);
        }
    }

    _completeAcknowledgedTimed() {
        if (!this._canHandle()) {
            return;
        }

        this._isFinalized = true;

        try {
            MessageFrame._handle(this._acknowledgedTimedHandlers, this);
        } finally {
            MessageFrame._handle(this._finallyHandlers, this);
        }
    }

    _acknowledge() {
        if (this._isCancelled) {
            return;
        }

        this._acknowledgedAt = +new Date();
        MessageFrame._handle(this._acknowledgedHandlers, this, this._acknowledgedAt);
    }

    _isTimed() {
        if (null === this._timeout || null !== this._responseAt) {
            // Always false if response already received or no timeout is set
            return false;
        }

        return (+new Date() - this._sentAt) >= this._timeout;
    }

    _isAcknowledgedTimed() {
        if (null === this._acknowledgeTimeout || null !== this._acknowledgedAt) {
            // Always false if ack already received or no timeout is set
            return false;
        }

        return (+new Date() - this._sentAt) >= this._acknowledgeTimeout;
    }

    _canHandle() {
        return !this._isCancelled && !this._isFinalized;
    }
}
