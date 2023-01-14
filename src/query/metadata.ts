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

export type MetadataType = 'string' | 'integer' | 'float' | 'boolean' | 'version' | 'list' | 'map'

export type MetadataValue = string | number | boolean | MetadataValue[] | { [key: string]: MetadataValue }

export type MetadataEntry =
  | { type: 'string', value: string }
  | { type: 'integer', value: number } // todo: BigInt? elixir can represent arbitrarily large numbers..
  | { type: 'float', value: number } // todo: BigDecimal (polyfill)? elixir can represent arbitrarily large numbers..
  | { type: 'boolean', value: boolean }
  | { type: 'version', value: string }
  | { type: 'list', value: MetadataValue[] }
  | { type: 'map', value: { [key: string]: MetadataValue } }

export type Metadata = {
  [key: string]: MetadataEntry
}

export type MetadataData = {
  [key: string]: MetadataValue
}

type ValueToMetadataType<T extends MetadataValue> =
  T extends string
    ? { type: 'string' | 'version', value: T }
    : T extends number
      ? { type: 'integer' | 'float', value: T }
      : T extends boolean
        ? { type: 'boolean', value: T }
        : T extends MetadataValue[]
          ? { type: 'list', value: T }
          : { type: 'map', value: T }

export type TypeToMetadata<T extends MetadataData> =
  { [K in keyof T]: ValueToMetadataType<T[K]> }

export type MetadataToType<T extends Metadata> =
  { [K in keyof T]: T[K]['value'] }
