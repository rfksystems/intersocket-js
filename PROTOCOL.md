# Intersocket protocol version 1

## Message frames

Message frame is bi-directional sent to or received by server and client. It's format is as follows:

`MAGIC_HEADER+JSON`

For example, an `C2S_HANDSHAKE` message frame would result in following text string sent over the socket:

`46310{"protocol":1}`


### Magic header

Magic header is used to identify Intersocket messages and types of these messages. Magic header
is prepended to every message sent to and received from server, and is exactly 5 characters long.

Magic headers allow for different kinds of messages from different sources to be transmitted over the same
socket, thus allowing reuse of the sockets for different kinds of payloads.

#### Magic ID

To allow easy identification of Intersocket messages, each message header starts with 3 characters long
Intersocket protocol identifier - for version 1 this identifier is digits `463`. This allows
Intersocket server implementations bypass parsing all of the message string to determine whether or not
given string is in fact a valid Intersocket message.

Text string not starting with exactly the Magic ID should not be passed to Intersocket server implementations.

#### Magic type

Magic type is 2 character string identifying the exact message kind contained within the message. This allows for
much neater deserialization process, where for the most part, you can deserialize messages directly to
POJO's or other constructs depending on the server implementation.

Magic type for protocol version 1 is 2 characters, containing a short value between 10 and 99.
Intersocket protocol does not allow for custom message types, messages with different payloads 
segmented by topic should be used instead. 

##### Currently defined magic types

For convenience, message names here and in implementations are prefixed with either `C2S` for Client-to-Server or `S2C`
for Server-to-Client. 

###### C2S_HANDSHAKE (10)

Message frame sent from client to server immediately after connection is established. Contains one field, `protocol`
that contains `short` value of current protocol version.

###### S2C_HANDSHAKE (11)

Message frame sent from server to client immediately after `C2S_HANDSHAKE` is received. Contains following fields:

`protocol` <short|mandatory>: protocol version of the server. Must match client protocol version exactly.

`platform` <string|optional>: platform version of the current server
  
`ident` <string|optional>: identity assigned by the server to current client

###### C2S_MESSAGE (12)

###### S2C_ACK (13)

###### S2C_MESSAGE (14)

###### S2C_IDENT_CHANGE (15)

###### S2C_PLATFORM_CHANGE (16)

###### S2C_BROADCAST (17)

###### S2C_ERROR (18)

###### S2C_MESSAGE_ERROR (19)

###### C2S_SYNCHRONIZE_TOPICS (20)


#### Magic header composition

`[MAGIC_ID: 3 characters][TYPE_STRING: 2 characters]`

Magic header is always exactly 5 characters long.

