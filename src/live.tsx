import {useEffect} from 'react'
import {useQueryClient} from '@tanstack/react-query'
import {io} from 'socket.io-client'
import type {NFT,Order} from './data'

type NFTEvent={id:number;version:number;nft:NFT}
type OrderEvent={id:string;version:number;userId:string;status:Order['status'];order:Order}
export function LiveUpdates({userId}:{userId:string|null}){
  const cache=useQueryClient()
  useEffect(()=>{
    const seen=new Map<string,number>()
    const socket=io(window.location.origin,{
      path:'/socket.io',transports:['websocket'],autoConnect:true,
      reconnection:true,reconnectionDelay:400,reconnectionDelayMax:3000,
    })
    const fresh=(kind:string,id:string|number,v:number)=>{
      const key=kind+':'+id
      if(!Number.isSafeInteger(v)||v<=(seen.get(key)||0))return false
      seen.set(key,v);return true
    }
    const reconcile=()=>{
      void cache.invalidateQueries({queryKey:['nfts']})
      void cache.invalidateQueries({queryKey:['nft']})
      void cache.invalidateQueries({queryKey:['cart']})
      void cache.invalidateQueries({queryKey:['quote']})
      void cache.invalidateQueries({queryKey:['checkout-quote']})
      if(userId){void cache.invalidateQueries({queryKey:['orders']});void cache.invalidateQueries({queryKey:['order']})}
    }
    socket.on('connect',reconcile)
    socket.on('nft.updated',(evt:NFTEvent)=>{
      if(!evt?.nft||!fresh('nft',evt.id,evt.version))return
      // UI refaz consultas via REST, evitando aplicar uma atualização sobre uma resposta obsoleta.
      reconcile()
    })
    socket.on('order.updated',(evt:OrderEvent)=>{
      if(!userId||evt?.userId!==userId||!fresh('order',evt.id,evt.version))return
      cache.setQueryData(['order',evt.id],evt.order)
      void cache.invalidateQueries({queryKey:['orders']})
      void cache.invalidateQueries({queryKey:['cart']})
    })
    return ()=>{socket.removeAllListeners();socket.disconnect();seen.clear()}
  },[cache,userId])
  return null
}
