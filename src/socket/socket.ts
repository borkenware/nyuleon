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

import type { MessageEvent, Dispatcher } from 'undici'
import type { IncomingPayload, OutgoingPayload } from './payload.js'
import type { MetadataData, TypeToMetadata } from '../query/metadata.js'
import type { Query } from '../query/query.js'

import { randomUUID } from 'crypto'
import { TypedEmitter } from 'tiny-typed-emitter'
import { type CloseEvent, WebSocket } from 'undici'

import { OpCode } from './payload.js'
import { DispatchEvent } from './dispatch.js'

// Socket state
const enum State {
  DISCONNECTED,
  CONNECTING,
  CONNECTED,
  RECONNECTING,
  CLOSING,
}

// Options
export type SingyeongSocketOptions = {
  /** ID this client should have. Must be unique. If unset, a random UUID will be used. */
  clientId?: string
  /** Authentication token to use. If set, will override the password part of the DSN. */
  authentication?: string
  /**
   * IP used for HTTP proxying. Despite the name, this field accepts a protocol (http:// or https://) and a port.
   * If unset, `http://<Connecting IP>:80` will be used to send requests to your client.
   */
  ip?: string
  /** Namespace of the app. Useful for routing via `namespace` metadata key. */
  namespace?: string
  /** Whether the client wants to receive events when a client dis/connects to/from the server. */
  receiveClientUpdates?: boolean
  /** Undici dispatcher to use for the WebSocket connection. */
  dispatcher?: Dispatcher
}

type InternalOptions = Omit<SingyeongSocketOptions, 'clientId'> & { clientId: string, applicationId: string }

type SingyeongSocketEvents = {
  ready: (restricted: boolean) => void
  dispatch: (event: string, payload: any) => void

  zombie: () => void
  reconnect: (code: number, reason: string, wasClean: boolean) => void
  close: (code: number, reason: string, wasClean: boolean) => void
  error: (e: Error) => void
}

/**
 * An abstraction around WebSocket that represents a connection to a singyeong server.
 * Handles automatic connection resuming and restoring metadata and queue subscriptions.
 * Users of this class should only be worried about DISPATCH events; all other OP codes are handled internally.
 */
export class SingyeongSocket<TMetadata extends MetadataData = MetadataData> extends TypedEmitter<SingyeongSocketEvents> {
  // Options
  #url: URL
  #opts: InternalOptions

  // Connection state
  #state: State
  #ws: WebSocket
  #heartbeatInterval?: NodeJS.Timer
  #alive = true

  // singyeong state
  #metadata?: TypeToMetadata<TMetadata>
  #subscribedQueues = new Set<string>()

  /**
   * Constructs a SingyeongSocket object.
   *
   * @param url singyeong DSN. The username will be used as application_id.
   * @param opts Client options.
   */
  constructor (url: string | URL, opts?: Partial<SingyeongSocketOptions>) {
    super()

    const parsedUrl = typeof url === 'string' ? new URL(url) : url
    if (parsedUrl.protocol !== 'singyeong:' && parsedUrl.protocol !== 'ssingyeong:') {
      throw new URIError('DSN is invalid (invalid protocol)')
    }

    if (!parsedUrl.username) {
      throw new URIError('DSN must specify a username (application id)')
    }

    const protocol = parsedUrl.protocol === 'ssingyeong:' ? 'wss:' : 'ws:'
    this.#url = new URL(`${protocol}//${parsedUrl.host}/gateway/websocket?encoding=json`)
    this.#opts = {
      ...opts || {},
      applicationId: parsedUrl.username,
      clientId: opts?.clientId ?? randomUUID(),
      authentication: opts?.authentication ?? (parsedUrl.password || void 0)
    }

    this.#state = State.CONNECTING
    this.#ws = this.#createWebSocket()
  }

  /**
   * Updates client metadata.
   * Metadata will be cached and restored upon reconnecting if connection is lost.
   *
   * @param metadata Metadata object. Must be complete, partial updates won't work!
   */
  updateMetadata (metadata: TypeToMetadata<TMetadata>) {
    this.#metadata = metadata
    this.dispatch(DispatchEvent.UPDATE_METADATA, metadata)
  }

  /**
   * Sends a message to a *single* singyeong client matching the routing query.
   *
   * @param query Routing query.
   * @param payload Payload to send.
   * @param nonce String that'll be sent along with the message. Can be used for req-res messaging.
   */
  send<M extends MetadataData = MetadataData> (query: Query<M>, payload: any, nonce?: string) {
    this.dispatch(DispatchEvent.SEND, {
      target: query,
      nonce: nonce,
      payload: payload,
    })
  }

  /**
   * Sends a message to a *all* singyeong client matching the routing query.
   *
   * @param query Routing query.
   * @param payload Payload to send.
   * @param nonce String that'll be sent along with the message. Can be used for req-res messaging.
   */
  broadcast<M extends MetadataData = MetadataData> (query: Query<M>, payload: any, nonce?: string) {
    this.dispatch(DispatchEvent.BROADCAST, {
      target: query,
      nonce: nonce,
      payload: payload,
    })
  }

  /**
   * Pushes a message to a named queue and will dispatch it to a client matching the query.
   *
   * @param queue Name of the queue.
   * @param query Routing query.
   * @param payload Payload to send.
   * @param nonce String that'll be sent along with the message. Can be used for req-res messaging.
   */
  queue<M extends MetadataData = MetadataData> (queue: string, query: Query<M>, payload: any, nonce?: string) {
    this.dispatch(DispatchEvent.QUEUE, {
      queue: queue,
      target: query,
      nonce: nonce,
      payload: payload,
    })
  }

  /**
   * Requests the server a subscription to a named queue.
   * Subscriptions will be cached and restored upon reconnecting if connection is lost.
   *
   * @param queue Name of the queue.
   */
  queueSubscribe (queue: string) {
    this.#subscribedQueues.add(queue)
    this.dispatch(DispatchEvent.QUEUE_REQUEST, { queue: queue })
  }

  /**
   * Requests the server to unsubscribe from a named queue.
   *
   * @param queue Name of the queue.
   */
  queueUnsubscribe (queue: string) {
    this.#subscribedQueues.delete(queue)
    this.dispatch(DispatchEvent.QUEUE_REQUEST_CANCEL, { queue: queue })
  }

  /**
   * Acknowledges a queued message as processed.
   * If unacknowledged, messages will be re-send after a certain server-configured delay.
   *
   * @param queue Name of the queue.
   * @param id ID sent by singyeong to identify a QUEUE dispatch.
   */
  queueAck (queue: string, id: string) {
    this.dispatch(DispatchEvent.QUEUE_ACK, { queue: queue, id: id })
  }

  /**
   * Dispatches a generic event to singyeong. Useful for dispatching non-standard (plugin) events.
   * You should NOT use this method for standard dispatches and should use the appropriate helpers.
   *
   * @param event Name of the event to dispatch.
   * @param payload Payload to send as dispatch data.
   */
  dispatch (event: string, payload: any) {
    this.#send({
      op: OpCode.DISPATCH,
      t: event,
      d: payload,
    })
  }

  /**
   * Closes the connection to singyeong.
   */
  close (code?: number, reason?: string) {
    if (this.#state !== State.CONNECTED) {
      throw new Error('Illegal state: cannot close if we are not connected!')
    }

    this.#state = State.CLOSING
    this.#ws.close(code, reason)
  }

  #createWebSocket () {
    const ws = new WebSocket(this.#url)
    // ws.addEventListener('error', (e) => this.emit('error', e.error))
    ws.addEventListener('open', () => (this.#state = State.CONNECTED), { once: true })
    ws.addEventListener('message', (e) => this.#handleMessage(e))
    ws.addEventListener('close', (e) => this.#handleClose(e), { once: true })
    return ws
  }

  #send (payload: OutgoingPayload) {
    this.#ws.send(JSON.stringify(payload))
  }

  #heartbeat () {
    if (!this.#alive) {
      // Zombie connection
      this.#state = State.RECONNECTING
      this.#ws?.close(4000, 'zombie connection')
      this.emit('zombie')
      return
    }

    this.#alive = false
    this.#send({
      op: OpCode.HEARTBEAT,
      d: { client_id: this.#opts.clientId },
    })
  }

  #identify () {
    this.#send({
      op: OpCode.IDENTIFY,
      d: {
        client_id: this.#opts.clientId,
        application_id: this.#opts.applicationId,
        auth: this.#opts.authentication,
        ip: this.#opts.ip,
        namespace: this.#opts.namespace,
        receive_client_updates: this.#opts.receiveClientUpdates,
        metadata: this.#metadata,
      }
    })
  }

  #restoreQueues () {
    for (const queue of this.#subscribedQueues) {
      this.queueSubscribe(queue)
    }
  }

  #handleMessage (evt: MessageEvent) {
    const payload = JSON.parse(evt.data) as IncomingPayload

    switch (payload.op) {
      case OpCode.HELLO:
        // Start heartbeating after a random jitter time to prevent clients
        // from synchronizing and crushing the server with spikes of heartbeats
        this.#heartbeatInterval = setTimeout(
          () => {
            this.#heartbeat()
            setInterval(() => this.#heartbeat(), payload.d.heartbeat_interval)
          },
          payload.d.heartbeat_interval * Math.random()
        )
        this.#identify()
        break
      case OpCode.READY:
        this.emit('ready', payload.d.restricted)
        this.#restoreQueues()
        break
      case OpCode.DISPATCH:
        this.emit('dispatch', payload.t, payload.d)
        break
      case OpCode.HEARTBEAT_ACK:
        this.#alive = true
        break
      case OpCode.GOODBYE:
        this.#state = State.RECONNECTING
        this.#ws.close(1000, 'server requested disconnect')
        this.emit('reconnect', 1000, 'server requested disconnect', true)
        break
      case OpCode.INVALID:
      case OpCode.ERROR:
        console.log(payload.d)
        break
      default:
        // TypeScript considers this state impossible (good!), but we handle it anyways -just in case-
        this.emit('error', new Error(`unexpected payload op ${(payload as any).op}`))
        this.close(4000, 'unexpected payload')
        break
    }
  }

  #handleClose (evt: CloseEvent) {
    clearInterval(this.#heartbeatInterval)

    if (this.#state === State.CLOSING) {
      this.emit('close', evt.code, evt.reason, evt.wasClean)
      return
    }

    if (this.#state === State.RECONNECTING) {
      this.#ws = this.#createWebSocket()
      return
    }

    this.#state = State.RECONNECTING
    // todo: proper backoff
    setTimeout(() => this.#state === State.RECONNECTING && (this.#ws = this.#createWebSocket()), 100)
    this.emit('reconnect', evt.code, evt.reason, evt.wasClean)
  }
}
