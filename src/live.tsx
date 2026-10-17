
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { NFT, Order } from './data'

type NFTEvent = {
  id: number
  version: number
  nft: NFT
}

type OrderEvent = {
  id: string
  version: number
  userId: string
  status: Order['status']
  order: Order
}

export function LiveUpdates({ userId }: { userId: string | null }) {
  const cache = useQueryClient()

  useEffect(() => {
    let disposed = false
    let socket: import('socket.io-client').Socket | undefined

    const seen = new Map<string, number>()

    const fresh = (
      type: string,
      id: number | string,
      version: number
    ) => {
      const key = `${type}:${id}`

      if (
        !Number.isSafeInteger(version) ||
        version <= (seen.get(key) ?? 0)
      ) {
        return false
      }

      seen.set(key, version)
      return true
    }

    const reconcile = () => {
      for (const key of [
        'nfts',
        'nft',
        'cart',
        'quote',
        'checkout-quote',
      ]) {
        void cache.invalidateQueries({
          queryKey: [key],
        })
      }

      if (userId) {
        void cache.invalidateQueries({
          queryKey: ['orders'],
        })

        void cache.invalidateQueries({
          queryKey: ['order'],
        })
      }
    }

    async function startSocket() {
      // Carrega o cliente após a inicialização do MSW.
      const { io } = await import('socket.io-client')

      if (disposed) return

      const current = io(window.location.origin, {
        path: '/socket.io/',
        transports: ['websocket'],
        autoConnect: false,
        reconnection: true,
        reconnectionDelay: 400,
        reconnectionDelayMax: 3000,
        timeout: 10000,
      })

      socket = current

      current.on('connect', () => {
        console.info('[Socket.IO] Conectado:', current.id)
        reconcile()
      })

      current.on('connect_error', error => {
        console.error(
          '[Socket.IO] Erro de conexão:',
          error.message
        )
      })

      current.on('disconnect', reason => {
        console.info('[Socket.IO] Desconectado:', reason)
      })

      current.on('nft.updated', (event: NFTEvent) => {
        if (
          !event?.nft ||
          event.id !== event.nft.id ||
          !fresh('nft', event.id, event.version)
        ) {
          return
        }

        console.info('[Socket.IO] nft.updated:', event)
        reconcile()
      })

      current.on('order.updated', (event: OrderEvent) => {
        if (
          !userId ||
          event?.userId !== userId ||
          !fresh('order', event.id, event.version)
        ) {
          return
        }

        console.info('[Socket.IO] order.updated:', event)

        cache.setQueryData(['order', event.id], event.order)

        void cache.invalidateQueries({
          queryKey: ['orders'],
        })

        void cache.invalidateQueries({
          queryKey: ['cart'],
        })
      })

      if (!disposed) {
        current.connect()
      }
    }

    void startSocket().catch(error => {
      console.error('[Socket.IO] Erro na inicialização:', error)
    })

    return () => {
      disposed = true

      socket?.removeAllListeners()
      socket?.disconnect()

      seen.clear()
    }
  }, [cache, userId])

  return null
}
