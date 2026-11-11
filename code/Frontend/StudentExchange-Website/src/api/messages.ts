import { request } from './accounts'
export interface Conversation {
  id: number
  listing_id: number
  listing_title: string
  other_name: string
  role: 'buyer' | 'seller'
  image_url: string | null
  last_kind: 'message' | 'offer'
  last_text: string
  last_amount: number | null
  last_datetime: string
  last_from_me: boolean
  unread: number
}
export interface Message {
  id: number
  mine: boolean
  kind: 'message' | 'offer'
  text: string
  amount: number | null
  datetime: string
  read: boolean
}
export interface OutgoingMessage {
  listing_id?: number
  conversation_id?: number
  kind: 'message' | 'offer'
  text: string
  amount?: number
}
export const messaging = {
  conversations: (signal?: AbortSignal) =>
    request<{ conversations: Conversation[] }>(
      'messages',
      'GET',
      undefined,
      signal,
    ),
  unread: (signal?: AbortSignal) =>
    request<{ unread: number }>('messages/unread', 'GET', undefined, signal),
  thread: (id: number, after = 0, signal?: AbortSignal) =>
    request<{ conversation_id: number; messages: Message[] }>(
      `messages/thread?${new URLSearchParams({ conversation_id: String(id), after: String(after) })}`,
      'GET',
      undefined,
      signal,
    ),
  send: (body: OutgoingMessage, signal?: AbortSignal) =>
    request<{ conversation_id: number; message: string }>(
      'messages',
      'POST',
      body,
      signal,
    ),
}
