import { useEffect, useRef, useCallback } from 'react'
import type { StreamMessage } from '../types'

const WS_BASE = `ws://${window.location.host}`

type MessageHandler = (msg: StreamMessage) => void

export function useRunStream(runId: string | null, onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null)
  const handlerRef = useRef(onMessage)
  handlerRef.current = onMessage

  const connect = useCallback(() => {
    if (!runId) return
    const token = localStorage.getItem('crucible_token') ?? 'dev-token'
    const url = `${WS_BASE}/runs/${runId}/stream?token=${token}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as StreamMessage
        handlerRef.current(msg)
      } catch {
        // ignore malformed frames
      }
    }

    ws.onerror = () => {
      // will trigger onclose; reconnect handled there if needed
    }

    return ws
  }, [runId])

  useEffect(() => {
    const ws = connect()
    return () => {
      ws?.close()
      wsRef.current = null
    }
  }, [connect])
}
