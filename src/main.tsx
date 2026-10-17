import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './ui'
import { worker } from './mocks'
import './style.css'
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000 } } })
async function start() { await worker.start({ onUnhandledRequest: 'bypass' }); ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><App /></QueryClientProvider></React.StrictMode>) }
start().catch(error => { console.error(error); document.getElementById('root')!.innerHTML = '<p style="color:white;padding:3rem">Não foi possível iniciar os mocks. Verifique o arquivo mockServiceWorker.js.</p>' })
