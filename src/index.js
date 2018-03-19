/**
 * @callback logEventHandler
 * @param {string} level One of trace|debug|info|warning|error
 * @param {Array} args Arguments received
 */

/**
 * Consumer function accepting one argument - {@link MessageFrame}
 * @callback messageFrameConsumer
 * @param {MessageFrame} frame
 */

/**
 * Consumer function accepting one argument - array of {@link MessageFrame}
 * @callback messageFrameListConsumer
 * @param {MessageFrame[]} frames
 */

/**
 * Consumer function (S2C broadcast messages)
 *
 * @callback broadcastConsumer
 * @param {Object} broadcast Payload object of the broadcast
 * @param {MessageEvent} event {@link WebSocket} message event
 * @param {string} topic Topic for which the payload is meant to
 */

/**
 * Consumer function - Intersocket state
 * @callback stateChangeConsumer
 * @param {String} newState
 * @param {String} oldState
 */

/**
 * Consumer function - lost message
 * @callback lostMessageResponseConsumer
 * @param {String} id
 * @param {Object} payload
 * @param {MessageEvent} event {@link WebSocket} message event
 */

/**
 * Consumer function - message
 * @callback messageResponseConsumer
 * @param {MessageFrame} frame
 * @param {Object} payload
 * @param {MessageEvent} event {@link WebSocket} message event
 */

/**
 * Consumer function - message error
 * @callback messageErrorResponseConsumer
 * @param {MessageFrame} frame
 * @param {String} id
 * @param {Object} payload
 * @param {MessageEvent} event {@link WebSocket} message event
 */

/**
 * Consumer function - lost ack
 * @callback lostAcknowledgedConsumer
 * @param {String} id
 * @param {MessageEvent} event {@link WebSocket} message event
 */

/**
 * Consumer function - ack
 * @callback acknowledgedConsumer
 * @param {String} id
 * @param {MessageFrame} frame
 * @param {MessageEvent} event {@link WebSocket} message event
 */

/**
 * Consumer function - handshake
 * @callback handshakeConsumer
 * @param {Object} handshake
 * @param {MessageEvent} event {@link WebSocket} message event
 */

/**
 *
 * @callback onTransportOpenConsumer
 * @param {Event} event
 */

/**
 *
 * @callback onTransportClosedConsumer
 * @param {Event} event
 */

/**
 *
 * @callback onTransportErrorConsumer
 * @param {Event} event
 */

/**
 *
 * @callback onServerErrorConsumer
 * @param {Object} payload
 * @param {Event} event
 */

/**
 *
 * @callback onTransportMessageConsumer
 * @param {MessageEvent} event {@link WebSocket} message event
 */

/**
 *
 * @callback onBinaryMessageConsumer
 * @param {MessageEvent} event {@link WebSocket} message event
 */

/**
 *
 * @callback onForeignProtocolConsumer
 * @param {MessageEvent} event {@link WebSocket} message event
 */

/**
 *
 * @callback onUnknownMessageTypeConsumer
 * @param {MessageEvent} event {@link WebSocket} message event
 */

/**
 *
 * @callback onPlatformChangeConsumer
 * @param {string} newPlatformVersion
 * @param {string} oldPlatformVersion
 * @param {MessageEvent} event {@link WebSocket} message event
 */

/**
 *
 * @callback onIdentChangeConsumer
 * @param {string} newIdent
 * @param {string} oldIdent
 * @param {MessageEvent} event {@link WebSocket} message event
 */

/**
 *
 * @callback onMessageRescheduledConsumer
 * @param {MessageFrame} frame
 */



export {default} from './Intersocket.js';
