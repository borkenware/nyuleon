/*
 * Copyright (c) Borkenware, All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import type { MetadataData, TypeToMetadata } from './query/metadata.js'
import type { Query } from './query/query.js'

import { TypedEmitter } from 'tiny-typed-emitter'
import { type Dispatcher, Client as HttpClient } from 'undici'
import { type SingyeongSocketOptions, SingyeongSocket } from './socket/socket.js'
import { DispatchEvent } from './socket/dispatch.js'

export type Message<T = any> = {
  /** The payload. */
  payload: T
  /** The nonce of the payload, if set by the emitter. */
  nonce?: string
}

export type QueueMessage<T = any> = {
  /** The name of the queue this message is from. */
  queue: string
  /** ID to send to singyeong to acknowledge this message. */
  id: string
  /** The payload. */
  payload: T
  /** The nonce of the payload, if set by the emitter. */
  nonce?: string
  /** Acks the message. Alias to `client.queueAck(msg.queue, msg.id)`. */
  ack: () => void
}

export type Client = {
  /** Application ID of the client. */
  app_id: string
  /** Client ID of the client. */
  client_id: string
  /** Metadata of the client. */
  metadata: MetadataData
  /** IP address of the client. */
  socket_ip: string
  /** Queues the client is subscribed to. */
  queues: string[]
}

export type SingyeongOpts = SingyeongSocketOptions & {
  /** When set to true, the client will not connect and you will only be able to use the REST API. */
  restOnly?: boolean
}

export type MessageParams<T extends MetadataData = MetadataData> = { query: Query<T>, payload: any, nonce?: string }

export type QueueMessageParams<T extends MetadataData = MetadataData> = MessageParams<T> & { queue: string }

export type RequestParams =
  | {
    method: 'GET'
    route: string
    headers?: Record<string, string | undefined>
  }
  | {
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    route: string
    headers?: Record<string, string | undefined>
    body?: any
  }

type ClientEvents = {
  ready: (restricted: boolean) => void
  message: (message: Message, broadcast: boolean) => void
  queueMessage: (message: QueueMessage) => void
  queueConfirm: (queue: string) => void
  clientConnected: (applicationId: string) => void
  clientDisconnected: (applicationId: string) => void
  pluginDispatch: (event: string, payload: any) => void

  reconnect: (code: number, reason: string, wasClean: boolean) => void
  close: (code: number, reason: string, wasClean: boolean) => void
  zombie: () => void
  error: (e: Error) => void
}

export default class SingyeongClient<TMetadata extends MetadataData = MetadataData> extends TypedEmitter<ClientEvents> {
  #url: URL
  #opts: SingyeongOpts
  #dispatcher: Dispatcher
  #socket: SingyeongSocket<TMetadata> | undefined

  constructor (url: string | URL, opts: SingyeongOpts = {}) {
    super()

    const parsedUrl = typeof url === 'string' ? new URL(url) : url
    if (parsedUrl.protocol !== 'singyeong:' && parsedUrl.protocol !== 'ssingyeong:') {
      throw new URIError('DSN is invalid (invalid protocol)')
    }

    const protocol = parsedUrl.protocol === 'ssingyeong:' ? 'https:' : 'http:'
    this.#url = new URL(`${protocol}//${parsedUrl.host}`)
    this.#dispatcher = opts.dispatcher = opts.dispatcher || new HttpClient(this.#url)
    this.#opts = opts || {}

    // If we're in REST-only mode, we can stop here.
    if (opts?.restOnly) return;

    if (!parsedUrl.username) {
      throw new URIError('DSN must specify a username (application id)')
    }

    this.#socket = new SingyeongSocket(parsedUrl, opts)
    this.#socket.on('dispatch', (evt, payload) => this.#handleDispatch(evt, payload))

    // Forward events
    this.#socket.on('ready', (restricted) => this.emit('ready', restricted))
    this.#socket.on('reconnect', (code, reason, wasClean) => this.emit('reconnect', code, reason, wasClean))
    this.#socket.on('close', (code, reason, wasClean) => this.emit('close', code, reason, wasClean))
    this.#socket.on('zombie', () => this.emit('zombie'))
    this.#socket.on('error', (e) => this.emit('error', e))
  }

  /**
   * Updates client metadata.
   * Metadata will be cached and restored upon reconnecting if connection is lost.
   *
   * @param metadata Metadata object. Must be complete, partial updates won't work!
   */
  updateMetadata (metadata: TypeToMetadata<TMetadata>) {
    if (!this.#socket) throw new Error(this.#opts.restOnly ? 'client is in rest-only mode' : 'client have been closed')
    this.#socket.updateMetadata(metadata)
  }

  /**
   * Sends a message to a *single* singyeong client matching the routing query.
   *
   * @param message Message to send.
   * @param message.query Routing query.
   * @param message.payload Payload to send.
   * @param message.nonce String that'll be sent along with the message. Can be used for req-res messaging.
   */
  send<M extends MetadataData = MetadataData> ({ query, payload, nonce }: MessageParams<M>) {
    if (!this.#socket) throw new Error(this.#opts.restOnly ? 'client is in rest-only mode' : 'client have been closed')
    this.#socket.send(query, payload, nonce)
  }

  /**
   * Sends a message to a *all* singyeong client matching the routing query.
   *
   * @param message Message to send.
   * @param message.query Routing query.
   * @param message.payload Payload to send.
   * @param message.nonce String that'll be sent along with the message. Can be used for req-res messaging.
   */
  broadcast<M extends MetadataData = MetadataData> ({ query, payload, nonce }: MessageParams<M>) {
    if (!this.#socket) throw new Error(this.#opts.restOnly ? 'client is in rest-only mode' : 'client have been closed')
    this.#socket.broadcast(query, payload, nonce)
  }

  /**
   * Pushes a message to a named queue, which will be dispatched to a client matching the query.
   *
   * @param queue Name of the queue to push into.
   * @param query Routing query.
   * @param payload Payload to send.
   * @param nonce String that'll be sent along with the message. Can be used for req-res messaging.
   */
  queue<M extends MetadataData = MetadataData> ({ queue, query, payload, nonce }: QueueMessageParams<M>) {
    if (!this.#socket) throw new Error(this.#opts.restOnly ? 'client is in rest-only mode' : 'client have been closed')
    this.#socket.queue(queue, query, payload, nonce)
  }

  /**
   * Requests the server a subscription to a named queue.
   * Subscriptions will be cached and restored upon reconnecting if connection is lost.
   *
   * @param queue Name of the queue to subscribe to.
   */
  queueSubscribe (queue: string) {
    if (!this.#socket) throw new Error(this.#opts.restOnly ? 'client is in rest-only mode' : 'client have been closed')
    this.#socket.queueSubscribe(queue)
  }

  /**
   * Requests the server to unsubscribe from a named queue.
   *
   * @param queue Name of the queue to unsubscribe from.
   */
  queueUnsubscribe (queue: string) {
    if (!this.#socket) throw new Error(this.#opts.restOnly ? 'client is in rest-only mode' : 'client have been closed')
    this.#socket.queueUnsubscribe(queue)
  }

  /**
   * Acknowledges a queued message as processed.
   * If unacknowledged, messages will be re-send after a certain server-configured delay.
   *
   * @param queue Name of the queue.
   * @param id ID sent by singyeong along with the message you want to acknowledge.
   */
  queueAck (queue: string, id: string) {
    if (!this.#socket) throw new Error(this.#opts.restOnly ? 'client is in rest-only mode' : 'client have been closed')
    this.#socket.queueAck(queue, id)
  }

  /**
   * Dispatches a generic event to singyeong. Useful for dispatching non-standard (plugin) events.
   * You should NOT use this method for standard dispatches and should use the appropriate helpers.
   *
   * @param event Name of the event to dispatch.
   * @param payload Payload to send as dispatch data.
   */
  dispatch (event: string, payload: any) {
    if (!this.#socket) throw new Error(this.#opts.restOnly ? 'client is in rest-only mode' : 'client have been closed')
    this.#socket.dispatch(event, payload)
  }

  /**
   * Closes the connection to the singyeong server.
   *
   * @param code WebSocket close code
   * @param reason WebSocket close reason message
   */
  close (code?: number, reason?: string) {
    if (!this.#socket) throw new Error(this.#opts.restOnly ? 'client is in rest-only mode' : 'client have been closed')
    this.#socket.close(code, reason)
    this.#socket = void 0
  }

  /**
   * Sends an HTTP request to an application through singyeong.
   * *Available in REST-only mode.*
   *
   * @param query Routing query to find the application to request.
   * @param request Request to send to the target client.
   * @returns Whatever the target respond responded with.
   */
  proxy<M extends MetadataData = MetadataData> (query: Query<M>, request: RequestParams) {
    return this.#dispatcher.request({
      method: 'POST',
      path: '/api/v1/proxy',
      headers: { authorization: this.#opts.authentication },
      body: JSON.stringify({
        ...request,
        query: query,
      }),
    })
  }

  /**
   * Queries the server the list of clients that match a particular query.
   * *Available in REST-only mode.*
   *
   * @param query Routing query you want to search for.
   * @returns Clients that match the routing query
   */
  async findClients<M extends MetadataData = MetadataData> (query: Query<M>): Promise<Client[]> {
    const res = await this.#dispatcher.request({
      method: 'POST',
      path: '/api/v1/query',
      headers: { authorization: this.#opts.authentication },
      body: JSON.stringify(query),
    })

    return res.body.json()
  }

  /**
   * Sends an arbitrary request to the singyeong server. Meant for plugin routes.
   * You should NOT use this method for standard requests and should use the appropriate helpers.
   * *Available in REST-only mode.*
   *
   * @param request The request to send. See Undici's documentation for more information.
   * @returns The request response.
   */
  request (request: Dispatcher.RequestOptions) {
    return this.#dispatcher.request(request)
  }

  #handleDispatch (evt: string, payload: any) {
    switch (evt) {
      case DispatchEvent.SEND:
      case DispatchEvent.BROADCAST:
        this.emit('message', payload, evt === DispatchEvent.BROADCAST)
        break
      case DispatchEvent.QUEUE:
        this.emit('queueMessage', {
          queue: payload.payload.queue,
          id: payload.payload.id,
          payload: payload.payload.payload,
          nonce: payload.nonce,
          ack: () => this.queueAck(payload.payload.queue, payload.payload.id)
        })
        break
      case DispatchEvent.QUEUE_CONFIRM:
        this.emit('queueConfirm', payload.queue)
        break
      case DispatchEvent.CLIENT_CONNECTED:
        this.emit('clientConnected', payload.app)
        break
      case DispatchEvent.CLIENT_DISCONNECTED:
        this.emit('clientDisconnected', payload.app)
        break
      default:
        this.emit('pluginDispatch', evt, payload)
    }
  }
}
