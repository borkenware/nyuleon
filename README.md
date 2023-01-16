# 뉴런
[![License](https://img.shields.io/github/license/borkenware/nyuleon.svg?style=flat-square)](https://github.com/borkenware/nyuleon/blob/mistress/LICENSE)
[![npm](https://img.shields.io/npm/v/nyuleon?style=flat-square)](https://npm.im/nyuleon)

A minimalist NodeJS client for [신경](https://github.com/queer/singyeong) written in TypeScript. Requires Node 18+

> ## 뉴런
> [/ɲuɾʌ̹n/ • nyureon](https://en.wiktionary.org/wiki/%EB%89%B4%EB%9F%B0)
> 1. neuron
>
> ## Neuron
> /ˈnjʊəɹɒn/ • *noun*
> 1. (cytology) A cell of the nervous system, which conducts nerve impulses; consisting of an axon and several
> dendrites. Neurons are connected by synapses.

This client only does very little abstraction over the 신경 connection and protocol, while still providing QoL
helpers and a user-friendly API.

The small amount of abstractions makes it plugin-friendly: it can deal with arbitrary events and routes easily.

> **Warning**: 신경 is alpha software, so is 뉴런. Because breaking changes may happen at any time in 신경, it means this
> library may also receive breaking changes that will reflect the upstream changes.

## Installation
```sh
pnpm add nyuleon
# or
yarn add nyuleon
# or
npm i nyuleon
```

## Usage
```ts
import SingyeongClient from 'nyuleon'

const client = new SingyeongClient('singyeong://my-fancy-app@localhost:4000/', { options... })
```

### Options
  - `clientId: string`: ID this client should have. Must be unique. If unset, a random UUID will be used.
  - `authentication: string`: Authentication token to use. If set, will override the password part of the DSN.
  - `ip: string`: IP used for HTTP proxying. Despite the name, this field accepts a protocol (http:// or https://) and a port.
    - If unset, `http://<Connecting IP>:80` will be used to send requests to your client.
  - `namespace: string`: Namespace of the app. Useful for routing via `namespace` metadata key.
  - `receiveClientUpdates: boolean`: Whether the client wants to receive events when a client dis/connects to/from the server.
  - `dispatcher: Dispatcher`: [Undici dispatcher](https://undici.nodejs.org/#/docs/api/Dispatcher) to use for all HTTP requests.
    - *Right now, due to [nodejs/undici#1811](https://github.com/nodejs/undici/issues/1811) the WebSocket connection doesn't use this dispatcher. This is intended to change whenever Undici brings this feature.*
  - `restOnly: boolean`: When set to true, the client will not connect and you will only be able to use the REST API.
    - Only methods marked as available in this mode will work. No event will be emitted.

### Methods
  - `updateMetadata(metadata: MetadataData): void`
    - Updates client metadata. Metadata will be cached and restored upon reconnecting if connection is lost.
    - `metadata: MetadataData`: Metadata object. Must be complete, partial updates won't work! Can be made [type safe](#type-safety).

  - `send({ query, payload, nonce }: MessageParams): void`
    - Sends a message to a *single* singyeong client matching the routing query.
    - `query: Query`: Routing query. Can be made [type safe](#type-safety).
    - `payload: any`: Payload to send.
    - `nonce?: string`: String that'll be sent along with the message. Can be used for req-res messaging.

  - `broadcast({ query, payload, nonce }: MessageParams): void`
    - Sends a message to a *all* singyeong client matching the routing query.
    - See `send` for the parameters documentation.

  - `queue({ queue, query, payload, nonce }: QueueMessageParams): void`
    - Pushes a message to a named queue, which will be dispatched to a client matching the query.
    - `queue: string`: Name of the queue to push into.
    - See `send` for the other parameters documentation.

  - `queueSubscribe(queue: string): void`
    - Requests the server a subscription to a named queue. Subscriptions will be cached and restored upon reconnecting if connection is lost.
    - `queue: string`: Name of the queue to subscribe to.

  - `queueUnsubscribe(queue: string): void`
    - Requests the server to unsubscribe from a named queue.
    - `queue: string`: Name of the queue to unsubscribe from.

  - `queueAck(queue: string, id: string): void`
    - Acknowledges a queued message as processed.
    - `queue: string`: Name of the queue.
    - `id: string`: ID sent by singyeong along with the message you want to acknowledge.

  - `dispatch(event: string, payload: any): void`
    - Dispatches a generic event to singyeong. Useful for dispatching non-standard (plugin) events. \
      *You should **NOT** use this method for standard dispatches and should use the appropriate helpers.*
    - `event: string`: Name of the event to dispatch.
    - `payload: any`: Payload to send as dispatch data.

  - `close(code?: number, reason?: string): void`
    - Closes the connection to the singyeong server.
    - `code?: number`: WebSocket close code
    - `reason?: number`: WebSocket close reason message

  - `proxy(query: Query, request: RequestParams): Promise<ResponseData>`
    - Sends an HTTP request to an application through singyeong.
    - `query: Query`: Routing query to find the application to request. Can be made [type safe](#type-safety).
    - `request: RequestParams`: Request to send to the target client.
      - `request.method: HttpMethod`: HTTP method.
      - `request.route: string`: HTTP path to send the request to.
      - `request.headers?: Record<string, string>`: HTTP headers to send along with the request.
      - `request.body?: any`: Request body to send. Cannot be set if `method` is GET.
    - Returns: An [Undici ResponseData](https://undici.nodejs.org/#/docs/api/Dispatcher?id=parameter-responsedata) object.
      singyeong forwards the raw response body, and headers set by the target application.
    - *Available in REST-only mode.*

  - `findClients(query: Query): Promise<Client[]>`
    - Queries the server the list of clients that match a particular query.
    - `query: Query`: Routing query you want to search for. Can be made [type safe](#type-safety).
    - Returns: Clients that match the routing query.
    - *Available in REST-only mode.*

  - `request(request: RequestOptions): Promise<ResponseData>`
    - Sends an arbitrary request to the singyeong server. Meant for plugin routes. \
      *You should **NOT** use this method for standard requests and should use the appropriate helpers.*
    - `request: RequestOptions`: An [Undici RequestOptions](https://undici.nodejs.org/#/docs/api/Dispatcher?id=parameter-requestoptions) object.
    - Returns: An [Undici ResponseData](https://undici.nodejs.org/#/docs/api/Dispatcher?id=parameter-responsedata) object.
    - *Available in REST-only mode.*

### Emitted events
  - `ready`: Emitted when singyeong sent the `READY` payload.
    - `restricted: boolean`: Whether the socket is considered "restricted".
    - *Note: can be sent more than once during the client lifetime.*

  - `message`: Emitted when a message has been received.
    - `message: Message<T = any>`: The message you received
      - `message.payload: T`: The payload.
      - `message.nonce?: string`: The nonce of the payload, if set by the emitter.
    - `broadcast: boolean`: Whether the message was a `BROADCAST` or a `SEND`.

  - `queueMessage`: Emitted when a message from a queue has been received.
    - `message: QueueMessage<T = any>`: The message you received
      - `message.queue: string`: The name of the queue this message is from.
      - `message.id: string`: ID to send to singyeong to acknowledge this message.
      - `message.payload: T`: The payload.
      - `message.nonce?: string`: The nonce of the payload, if set by the emitter.
      - `message.ack: Function`: Acks the message. Alias to `client.queueAck(msg.queue, msg.id)`.
    - *Note: you must acknowledge the message once handled, or the server will consider the message lost and will attempt re-delivery.*

  - `queueConfirm`: Emitted by singyeong to confirm a message has been queued.
    - `queue: string`: Name of the queue.

  - `clientConnected`: Emitted when a new client connected to the singyeong server.
    - `applicationId: string`: ID of the application that connected.
    - *Note: You must subscribe to these events when creating the client.*

  - `clientDisconnected`: Emitted when a client disconnected from the singyeong server.
    - `applicationId: string`: ID of the application that disconnected.
    - *Note: You must subscribe to these events when creating the client.*

  - `pluginDispatch`: Emitted when a non-standard (plugin) dispatch was received.
    - `event: string`: Name of the dispatch event received.
    - `payload: any`: Raw payload data sent.

  - `reconnect`: Emitted when the connection was closed and the client is reconnecting.
    - `code: number`: WebSocket close code.
    - `reason: string`: WebSocket close reason.
    - `wasClean: boolean`: Whether the close was clean or not.

  - `close`: Emitted when the connection was closed.
    - `code: number`: WebSocket close code.
    - `reason: string`: WebSocket close reason.
    - `wasClean: boolean`: Whether the close was clean or not.

  - `zombie`: Emitted when the server stopped responding to heartbeat. The client will disconnect and reconnect.

  - `error`: Emitted when an error occurred.
    - `e: SingyeongError`: The error.

### Type safety
뉴런 has first-class support for type safe queries and metadata support. By default, the only type checking enforced
is "whatever that is valid". However, you can specify via generics the shape of metadata objects you are dealing with,
and strong type checking will be applied. This ensures your queries are always valid, and it gives amazing
autocompletion capability.

```ts
type MyMeta = { someString: string, someNumber: number, someOtherString: string };
const client = new SingyeongClient<MyMeta>('singyeong://meow@localhost:4000')

client.updateMetadata({
  someString: { type: 'string', value: '1' },
  someNumber: { type: 'integer', value: 1337 },
  // this will cause a type error:
  someOtherString: { type: 'boolean', value: false },
  // this will cause a type error:
  anUnknownMetadataProperty: { type: 'string', value: 'who am i??' },
})

type TargetMetadata = { key1: string, key2: { subkey1: string } };
client.send<TargetMetadata>({
  query: {
    ops: [
      {
        path: '/key1',
        op: '$eq',
        // this will cause a type error
        to: { value: 1 },
      },
      {
        // this will cause a type error
        path: '/unknownKey',
        op: '$eq',
        to: { value: 1 },
      },
    ],
  },
})
```

## What is that name?
신경 named itself after the Korean word for "nerve", so the name 뉴런 ("neuron") was picked to stay in the same naming
scheme: Korean word around the nervous system.
