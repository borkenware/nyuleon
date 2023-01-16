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

import type { Metadata } from '../query/metadata.js'

export enum OpCode {
  /** Sent on initial connection to the server. */
  HELLO = 0,
  /** Tell the server who you are. */
  IDENTIFY = 1,
  /** The server has accepted you, and will send you packets. */
  READY = 2,
  /** Sent to tell you that an application-level issue with your payload occurred. */
  INVALID = 3,
  /** The server is sending you an event, or you are sending the gateway an event. */
  DISPATCH = 4,
  /** Send a heartbeat to the server. */
  HEARTBEAT = 5,
  /** Server acknowledging the last heartbeat you sent. */
  HEARTBEAT_ACK = 6,
  /** Sent to tell you to reconnect. Used for eg. load balancing. */
  GOODBYE = 7,
  /** Sent to tell you that an unrecoverable error occurred. */
  ERROR = 8,
}

export type HelloPayloadData = {
  /** Interval at which clients should send a heartbeat. */
  heartbeat_interval: number
}

export type IdentifyPayloadData = {
  /** A unique client ID. May NOT contain spaces. */
  client_id: string
  /** The name of the client application. May NOT contain spaces. */
  application_id: string
  /** Authentication token. If not set but configured on the server, the client will be considered restricted. */
  auth?: string
  /**
   * IP used for HTTP proxying. Despite the name, this field accepts a protocol (http:// or https://) and a port.
   * If unset, `http://<Connecting IP>:80` will be used to send requests to your client.
   */
  ip?: string
  /** Namespace of the app. Useful for routing via `namespace` metadata key. */
  namespace?: string
  /** Metadata to set for the client. Useful for restoring metadata on reconnect. */
  metadata?: Metadata
  /** Whether the client wants to receive events when a client dis/connects to/from the server. */
  receive_client_updates?: boolean
}

export type ReadyPayloadData = {
  /** Client ID sent during IDENTIFY. */
  client_id: string
  /** Whether this client is restricted or not. */
  restricted: boolean
}

export type InvalidPayloadData = {
  /** The error message/code. */
  error: string
  /** Extra data about the error. */
  extra_info: unknown
}

export type HeartbeatPayloadData = {
  /** Client ID sent during IDENTIFY. In practice unused, but specified in protocol docs. */
  client_id: string
}

export type HeartbeatAckPayloadData = {
  /** Client ID sent during IDENTIFY. In practice unused, but specified in protocol docs. */
  client_id: string
}

export type GoodbyePayloadData = {
  /** Disconnect message. */
  reason: string
}

export type ErrorPayloadData = {
  /** The error message/code. */
  error: string
  /** Extra data about the error. */
  extra_info: unknown
}

export type IncomingPayload =
  | { op: OpCode.HELLO, d: HelloPayloadData, t: null, ts: number }
  | { op: OpCode.READY, d: ReadyPayloadData, t: null, ts: number }
  | { op: OpCode.INVALID, d: InvalidPayloadData, t: null, ts: number }
  | { op: OpCode.DISPATCH, d: unknown, t: string, ts: number }
  | { op: OpCode.HEARTBEAT_ACK, d: HeartbeatAckPayloadData, t: null, ts: number }
  | { op: OpCode.GOODBYE, d: GoodbyePayloadData, t: null, ts: number }
  | { op: OpCode.ERROR, d: ErrorPayloadData, t: null, ts: number }

export type OutgoingPayload =
  | { op: OpCode.IDENTIFY, d: IdentifyPayloadData }
  | { op: OpCode.DISPATCH, d: unknown, t: string }
  | { op: OpCode.HEARTBEAT, d: HeartbeatPayloadData }
