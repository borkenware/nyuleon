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

import type { OpCode } from './payload.js'
import type { Metadata } from '../query/metadata.js'
import type { Query } from '../query/query.js'

export enum DispatchEvent {
  /** Update metadata on the server. The inner payload should be a key-value mapping of metadata */
  UPDATE_METADATA = 'UPDATE_METADATA',
  /** Send a payload to a single client that matches the routing query. Indicates a message being received when received. */
  SEND = 'SEND',
  /** Send a payload to all clients that match the routing query. Indicates a message being received when received. */
  BROADCAST = 'BROADCAST',
  /**
   * Returns all nodes matching the given routing query.
   * @warning This is intended to help with debugging, and SHOULD NOT BE USED OTHERWISE!
   */
  QUERY_NODES = 'QUERY_NODES',
  /** Queues a new message into the specified queue when sent. Indicates a queued message being received when received. */
  QUEUE = 'QUEUE',
  /** Sends an acknowledgement of message queuing to the client. */
  QUEUE_CONFIRM = 'QUEUE_CONFIRM',
  /** Adds the client to the list of clients awaiting messages. */
  QUEUE_REQUEST = 'QUEUE_REQUEST',
  /** Removes the client from the list of clients awaiting messages. Basically the opposite of QUEUE_REQUEST. */
  QUEUE_REQUEST_CANCEL = 'QUEUE_REQUEST_CANCEL',
  /** ACKs the message in the payload, indicating that it's been handled and doesn't need to be re-queued. */
  QUEUE_ACK = 'QUEUE_ACK',
  /** Received when a client connects to the server, if this client is not in restricted mode and `receive_client_updates` is set to true. */
  CLIENT_CONNECTED = 'CLIENT_CONNECTED',
  /** Received when a client disconnects from the server, if this client is not in restricted mode and `receive_client_updates` is set to true. */
  CLIENT_DISCONNECTED = 'CLIENT_DISCONNECTED',
}

export type OutgoingMessageDispatchPayloadData = {
  /** Routing query for finding receiving nodes. */
  target: Query
  /** Optional nonce, can be used for req-res queries. */
  nonce?: string | null
  /** Whatever data you want to pass. */
  payload: any
}

export type IncomingMessageDispatchPayloadData = {
  /** Optional nonce, can be used for req-res queries. */
  nonce?: string | null
  /** Whatever data you received. */
  payload: unknown
}

export type OutgoingQueueDispatchPayloadData = {
  /** Name of the queue. */
  queue: string
  /** Routing query for finding receiving nodes. */
  target: Query
  /** Optional nonce, can be used for req-res queries. */
  nonce?: string | null
  /** Whatever data you want to queue. */
  payload: any
}

export type IncomingQueueDispatchPayloadData = {
  /** Optional nonce, can be used for req-res queries. */
  nonce?: string | null
  payload: {
    /** Name of the queue. */
    queue: string
    /** ID to send back in the QUEUE_ACK payload. */
    id: string
    /** Whatever data was queued. */
    payload: any
  }
}

export type QueueConfirmDispatchPayloadData = {
  /** Name of the queue. */
  queue: string
}

export type QueueRequestDispatchPayloadData = {
  /** Name of the queue. */
  queue: string
}

export type QueueRequestCancelDispatchPayloadData = {
  /** Name of the queue. */
  queue: string
}

export type QueueAckDispatchPayloadData = {
  /** Name of the queue. */
  queue: string
  /** ID sent in the QUEUE event. */
  id: string
}

export type ClientConnectedDispatchPayloadData = {
  /** application_id of the client. */
  app: string
}

export type ClientDisconnectedDispatchPayloadData = {
  /** application_id of the client. */
  app: string
}

type MessageDispatch = DispatchEvent.SEND | DispatchEvent.BROADCAST

export type IncomingDispatchPayload =
  | { op: OpCode.DISPATCH, d: IncomingMessageDispatchPayloadData, t: MessageDispatch, ts: number }
  | { op: OpCode.DISPATCH, d: IncomingQueueDispatchPayloadData, t: DispatchEvent.QUEUE, ts: number }
  | { op: OpCode.DISPATCH, d: QueueConfirmDispatchPayloadData, t: DispatchEvent.QUEUE_CONFIRM, ts: number }
  | { op: OpCode.DISPATCH, d: ClientConnectedDispatchPayloadData, t: DispatchEvent.CLIENT_CONNECTED, ts: number }
  | { op: OpCode.DISPATCH, d: ClientDisconnectedDispatchPayloadData, t: DispatchEvent.CLIENT_DISCONNECTED, ts: number }

export type OutgoingDispatchPayload =
  | { op: OpCode.DISPATCH, d: Metadata, t: DispatchEvent.UPDATE_METADATA }
  | { op: OpCode.DISPATCH, d: OutgoingMessageDispatchPayloadData, t: MessageDispatch }
  | { op: OpCode.DISPATCH, d: Query, t: DispatchEvent.QUERY_NODES }
  | { op: OpCode.DISPATCH, d: OutgoingQueueDispatchPayloadData, t: DispatchEvent.QUEUE }
  | { op: OpCode.DISPATCH, d: QueueRequestDispatchPayloadData, t: DispatchEvent.QUEUE_REQUEST }
  | { op: OpCode.DISPATCH, d: QueueRequestCancelDispatchPayloadData, t: DispatchEvent.QUEUE_REQUEST_CANCEL }
  | { op: OpCode.DISPATCH, d: QueueAckDispatchPayloadData, t: DispatchEvent.QUEUE_ACK }
