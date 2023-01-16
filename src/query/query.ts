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

import type { MetadataData, MetadataValue } from './metadata.js'

// Base types
export type QueryCompare =
  | {
    path: string
    op: '$eq' | '$ne' | '$gt' | '$gte' | '$lt' | '$lte' | '$contains' | '$ncontains',
    to: { value: MetadataValue }
  }
  | {
    path: string
    op: '$in' | '$nin'
    to: { value: MetadataValue[] }
  }

export type QueryLogic = {
  op: '$and' | '$or' | '$nor'
  with: Array<QueryCompare | QueryLogic>
}

export type QuerySelector =
  | { $min: string }
  | { $max: string }
  | { $avg: string }


// Typesafe types
type QueryEntry<TPath extends string, TValue extends MetadataValue> =
  | {
    path: TPath,
    op: '$eq' | '$ne' | '$gt' | '$gte' | '$lt' | '$lte'
    to: { value: TValue }
  }
  | {
    path: TPath,
    op: '$in' | '$nin'
    to: { value: TValue[] }
  }
  | (
    TValue extends Array<infer T>
      ? {
        path: TPath,
        op: '$contains' | '$ncontains'
        to: { value: T }
      } : never
  )

type _QueryCompareOps<TPrefix extends string, Metadata extends MetadataData> = {
  [TKey in keyof Metadata as string]: TKey extends string
    ? Metadata[TKey] extends MetadataData
      ? QueryEntry<`${TPrefix}/${TKey}`, Metadata[TKey]> | _QueryCompareOps<`${TPrefix}/${TKey}`, Metadata[TKey]>
      : QueryEntry<`${TPrefix}/${TKey}`, Metadata[TKey]>
    : never
}[string]

type _QueryWithLogicOps<T> = T | { path: never, op: '$and' | '$or' | '$nor', with: Array<_QueryWithLogicOps<T>> }

export type MetadataToQuery<Metadata extends MetadataData> =
  Array<_QueryWithLogicOps<_QueryCompareOps<'', Metadata>>>

export type Query<TMetadata extends MetadataData = MetadataData> = {
  /** ID of the application to query against. */
  application?: string
  /** Whether or not to allow restricted-mode clients in the query results. Default false. */
  restricted?: boolean
  /** The key used for consistent-hashing when choosing a client from the output. */
  key?: string
  /** Whether this payload can be dropped if it isn't routable or not. */
  droppable?: boolean
  /** Whether this query should be ignored and a client chosen randomly if it matches nothing. */
  optional?: boolean
  /** The ops used for querying. */
  ops?: MetadataToQuery<TMetadata>
  /** The selector used. */
  selector?: QuerySelector | null
}
