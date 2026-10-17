import { LiveUpdates } from './live';
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription, } from '@/components/ui/dialog';
import { useEffect, useState, type FormEvent } from 'react';
import { createRootRoute, createRoute, createRouter, RouterProvider, Outlet, Link, useNavigate, useSearch, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Search, ShoppingCart, Heart, UserRound, Menu, X, Plus, Minus, ChevronRight, ArrowRight, Wallet, LogOut, Check, ShieldCheck } from 'lucide-react';
import { nfts, money, type NFT, type CartItem, type Order } from './data';
const api = axios.create({ baseURL: '/api' });

// Apenas a API simulada emite esse evento quando uma sessão privada expira.
api.interceptors.response.use(
    response => response,
    error => {
        if (axios.isAxiosError(error) && error.response?.status === 401 &&
            !['/login', '/signup'].some(path => error.config?.url?.endsWith(path))) {
            window.dispatchEvent(new Event('kurio:session-expired'));
        }
        return Promise.reject(error);
    },
);

const get = async <T,>(url: string): Promise<T> => (await api.get<T>(url)).data;
const err = (e: unknown) => axios.isAxiosError(e) ? e.response?.data?.message || e.message : 'Ocorreu um erro inesperado';
type Account = {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    wallets: string[];
    favorites: number[];
};
type CatalogResponse = {
    items: NFT[];
    total: number;
    pages: number;
};
type Filters = {
    q?: string;
    collection?: string;
    sort?: string;
    max?: number;
    page?: number;
};
const root = createRootRoute({ component: Shell });
const home = createRoute({ getParentRoute: () => root, path: '/', component: Home, validateSearch: (s: Record<string, unknown>): Filters => ({ q: typeof s.q === 'string' ? s.q : undefined, collection: typeof s.collection === 'string' ? s.collection : undefined, sort: typeof s.sort === 'string' ? s.sort : undefined, max: Number(s.max) || undefined, page: Number(s.page) || undefined }) });
const detail = createRoute({ getParentRoute: () => root, path: '/nft/$id', component: Detail });
const cartRoute = createRoute({ getParentRoute: () => root, path: '/carrinho', component: Cart });
const checkoutRoute = createRoute({ getParentRoute: () => root, path: '/pagamento', component: Checkout });
const accountRoute = createRoute({ getParentRoute: () => root, path: '/perfil', component: Profile });
const walletRoute = createRoute({ getParentRoute: () => root, path: '/carteiras', component: Wallets });
const ordersRoute = createRoute({ getParentRoute: () => root, path: '/pedidos', component: Orders });
const receiptRoute = createRoute({ getParentRoute: () => root, path: '/pedido/$id', component: Receipt });
const notFound = createRoute({ getParentRoute: () => root, path: '/nao-encontrado', component: () => <section className="wrap centered"><h1>Página não encontrada</h1><Link to="/" className="btn">Voltar para início</Link></section> });
const router = createRouter({ routeTree: root.addChildren([home, detail, cartRoute, checkoutRoute, accountRoute, walletRoute, ordersRoute, receiptRoute, notFound]), defaultNotFoundComponent: () => <section className="wrap centered"><h1>Página não encontrada</h1><Link to="/" className="btn">Voltar para início</Link></section> });
declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
}
export function App() { return <RouterProvider router={router}/>; }
function useSession() { return useQuery({ queryKey: ['session'], queryFn: () => get<Account | null>('/session'), refetchInterval: 10_000, refetchOnWindowFocus: true }); }
function useCart() { return useQuery({ queryKey: ['cart'], queryFn: () => get<CartItem[]>('/cart') }); }
function useCartUpdate() { const q = useQueryClient(); return useMutation({ mutationFn: async (x: CartItem) => (await api.put<CartItem[]>('/cart', x)).data, onSuccess: () => { q.invalidateQueries({ queryKey: ['cart'] }); q.invalidateQueries({ queryKey: ['quote'] }); } }); }
function useLogin() { const q = useQueryClient(); return useMutation({ mutationFn: async (x: {
        email: string;
        password: string;
    }) => (await api.post<Account>('/login', x)).data, onSuccess: account => { q.removeQueries({ predicate: query => query.queryKey[0] !== 'session' }); q.setQueryData(['session'], account); } }); }
function useSignup() { const q = useQueryClient(); return useMutation({ mutationFn: async (x: {
        name: string;
        email: string;
        password: string;
    }) => (await api.post<Account>('/signup', x)).data, onSuccess: account => { q.removeQueries({ predicate: query => query.queryKey[0] !== 'session' }); q.setQueryData(['session'], account); } }); }
function Thumb({ nft, large = false }: {
    nft: NFT;
    large?: boolean;
}) { return <img className={large ? 'nft-photo large' : 'nft-photo'} src={nft.image} alt={'Arte do NFT ' + nft.name} loading="lazy"/>; }
function SiteButton({ children, onClick, disabled = false, }: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (<Button type="button" className="btn" onClick={onClick} disabled={disabled}>
      {children}
    </Button>);
}
function Shell() {
    const q = useQueryClient();
    const s = useSession();
    const c = useCart();
    const [auth, setAuth] = useState<'login' | 'signup' | null>(null);
    const [mobile, setMobile] = useState(false);
    const [notice, setNotice] = useState('');
    const count = c.data?.reduce((sum, item) => sum + item.qty, 0) || 0;

    useEffect(() => {
        const requireAuth = () => setAuth('login');
        const sessionExpired = () => {
            q.removeQueries({ predicate: query => ['cart', 'quote', 'checkout-quote', 'orders', 'order'].includes(String(query.queryKey[0])) });
            q.setQueryData(['session'], null);
            setNotice('Sua sessão expirou. Entre novamente para continuar.');
            setAuth('login');
        };
        window.addEventListener('kurio:auth-required', requireAuth);
        window.addEventListener('kurio:session-expired', sessionExpired);
        return () => {
            window.removeEventListener('kurio:auth-required', requireAuth);
            window.removeEventListener('kurio:session-expired', sessionExpired);
        };
    }, [q]);

    const show = (message: string) => {
        setNotice(message);
        window.setTimeout(() => setNotice(''), 3500);
    };

    return <>
        <LiveUpdates userId={s.data?.id || null}/>
        <header className="topbar">
            <div className="wrap nav">
                <Link to="/" className="logo">KURIO</Link>
                <nav className={mobile ? 'nav-links show' : 'nav-links'}>
                    <Link to="/" activeProps={{ className: 'active' }} onClick={() => setMobile(false)}>Início</Link>
                    <Link to="/" search={{ collection: 'Arte digital' }} onClick={() => setMobile(false)}>Mercado</Link>
                    <Link to="/" onClick={() => setMobile(false)}>Criadores</Link>
                    <Link to="/" onClick={() => setMobile(false)}>Aprenda</Link>
                </nav>
                <div className="nav-actions">
                    <Link to="/" aria-label="Busca"><Search size={18}/></Link>
                    <Link to="/carrinho" aria-label={'Carrinho com ' + count + ' itens'} className="cart-top">
                        <ShoppingCart size={19}/>{count > 0 && <b>{count}</b>}
                    </Link>
                    {s.data
                        ? <Link to="/perfil" className="btn small"><UserRound size={14}/> Perfil</Link>
                        : <button className="btn small" onClick={() => setAuth('login')}><UserRound size={14}/> Entrar</button>}
                    <button className="mobile-menu icon-btn" onClick={() => setMobile(!mobile)} aria-label="Abrir menu"><Menu/></button>
                </div>
            </div>
        </header>
        <main><div className="page"><Outlet/></div></main>
        <Footer/>
        {notice && <div className="toast" role="status">{notice}</div>}
        {auth && <AuthModal kind={auth} close={() => setAuth(null)} switchMode={setAuth}
            onSuccess={() => { setAuth(null); show('Bem-vindo ao Kurio!'); }}/>}
    </>;
}
function Footer() { return <footer className="footer"><div className="wrap"><div className="features"><div><span>◉</span><strong>Segurança na compra</strong><p>Transações simuladas com acompanhamento de pedidos.</p></div><div><span>◕</span><strong>Coleções exclusivas</strong><p>Encontre arte digital e colecionáveis únicos.</p></div><div><span>◉</span><strong>Artistas e comunidade</strong><p>Apoie os criadores e descubra novas histórias.</p></div><div className="newsletter"><strong>Novidades em primeira mão</strong><p>Receba novidades sobre lançamentos e coleções.</p><form onSubmit={e => { e.preventDefault(); alert('Demonstração: cadastro de newsletter não disponível'); }}><input type="email" required placeholder="Seu e-mail" aria-label="E-mail"/><button className="btn small">Enviar</button></form></div></div><div className="footer-bottom"><div><b>KURIO</b><p>Seu universo de arte digital.</p></div><span>Mercado · Criadores · Comunidade · Ajuda</span><span>© 2026 Kurio. Projeto demonstrativo.</span></div></div></footer>; }
function Card({ nft }: {
    nft: NFT;
}) { return <Link to="/nft/$id" params={{ id: String(nft.id) }} className="nft-card"><Thumb nft={nft}/><div className="nft-name">{nft.name} {nft.edition}</div><div className="nft-price">{nft.price} ETH</div></Link>; }
function Home() { const params = useSearch({ from: '/' }); const nav = useNavigate({ from: '/' }); const update = (patch: Filters) => nav({ search: (prev) => ({ ...prev, ...patch, page: patch.page || 1 }) }); const result = useQuery({ queryKey: ['nfts', params], queryFn: () => get<CatalogResponse>('/nfts?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString()) }); return <div className="wrap"><section className="hero"><div className="hero-copy"><div className="eyebrow">Bem-vindo à Kurio</div><h1>SEJA DONO DO FUTURO<br />DA ARTE DIGITAL</h1><p>Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.</p><a className="btn" href="#catalogo">EXPLORAR</a><div className="hero-dots"><i /><i /><i /></div></div><img src="/nfts/hero.webp" className="hero-image" alt="Personagem colecionável da Kurio"/></section><section id="catalogo" className="market"><aside className="sidebar"><div className="filter-panel"><h3>Coleções</h3>{['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Colecionáveis'].map(v => <button key={v} className={params.collection === v ? 'filter-active' : ''} onClick={() => update({ collection: params.collection === v ? '' : v })}>{v} <span>({nfts.filter(n => n.collection === v).length})</span></button>)}<h3>Faixa de preço</h3><input aria-label="Preço máximo em ETH" type="range" min="0.39" max="2.3" step="0.1" value={params.max || 2.3} onChange={e => update({ max: Number(e.target.value) })}/><div className="muted tiny">Preço: 0,39 – {(params.max || 2.3).toFixed(2)} ETH</div><button className="btn small" onClick={() => update({ page: 1 })}>Aplicar</button><h3>Rede</h3><div className="filter-row">Ethereum <span>(119)</span></div><div className="filter-row">Polygon <span>(78)</span></div><div className="filter-row">Solana <span>(86)</span></div></div><div className="featured"><strong>NFT EM DESTAQUE</strong><h4>OFERTA LIMITADA</h4><img src="/nfts/sage.webp" alt="Sage Nomad em destaque"/></div></aside><div className="catalog"><div className="catalog-top"><div className="tabs"><button className={!params.collection ? 'selected' : ''} onClick={() => update({ collection: '' })}>Todos os NFTs</button><button onClick={() => update({ sort: 'name' })}>Novos lançamentos</button><button onClick={() => update({ sort: 'price-desc' })}>Em alta</button></div><label>Ordenar por: <select value={params.sort || ''} onChange={e => update({ sort: e.target.value })}><option value="">Listados recentemente</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="name">Nome</option></select></label></div><div className="searchbox"><Search size={16}/><Input type="text" className="kurio-search-input" placeholder="Pesquisar NFTs ou coleções..." aria-label="Pesquisar NFTs" value={params.q || ''} onChange={e => update({ q: e.target.value })}/>{params.q && <button onClick={() => update({ q: '' })}><X size={15}/></button>}</div>{result.isLoading ? <div className="card-grid">{Array.from({ length: 6 }, (_, i) => <Skeleton className="skeleton" key={i}/>)}</div> : result.isError ? <p role="alert">Não foi possível carregar os NFTs. <button onClick={() => result.refetch()}>Tentar novamente</button></p> : result.data?.items.length ? <><div className="card-grid">{result.data.items.map(n => <Card key={n.id} nft={n}/>)}</div><div className="pages">{Array.from({ length: result.data.pages }, (_, i) => <button className={(params.page || 1) === i + 1 ? 'selected' : ''} key={i} onClick={() => update({ page: i + 1 })}>{i + 1}</button>)}<button disabled={(params.page || 1) >= result.data.pages} onClick={() => update({ page: (params.page || 1) + 1 })}><ChevronRight size={16}/></button></div></> : <p className="empty">Nenhum NFT encontrado. Tente outros filtros.</p>}</div></section><section className="promo-grid"><div><img src="/nfts/emerald.webp" alt="NFT Genesis"/><span><b>Lançamentos gênesis de edição limitada</b><p>Colecione edições escassas diretamente dos criadores.</p><Link to="/" className="btn small">Explorar <ArrowRight size={13}/></Link></span></div><div><img src="/nfts/neon.webp" alt="Arte digital"/><span><b>Arte digital selecionada e muito mais</b><p>Explore novos artistas, coleções verificadas e obras únicas.</p><Link to="/" className="btn small">Explorar <ArrowRight size={13}/></Link></span></div></section><section className="blog"><h2>Diário da Cunhagem</h2><p>Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p><div className="blog-grid">{[nfts[2], nfts[0], nfts[1], nfts[6]].map((n, i) => <article key={n.id}><img src={n.image} alt={n.name}/><div><small>{12 + i} de setembro | Leitura de 3 min</small><h3>{['Como funciona a propriedade de NFTs', '10 artistas digitais para acompanhar', 'Raridade, atributos e procedência', 'Como proteger sua carteira'][i]}</h3><p>Aprenda mais sobre arte digital e o universo dos colecionáveis.</p><Link to="/">Ler mais →</Link></div></article>)}</div></section></div>; }
function Detail() { const { id } = useParams({ from: '/nft/$id' }); const nft = useQuery({ queryKey: ['nft', id], queryFn: () => get<NFT>('/nfts/' + id) }); const ses = useSession(); const cart = useCart(); const update = useCartUpdate(); const q = useQueryClient(); const [qty, setQty] = useState(1); const [msg, setMsg] = useState(''); const favorite = useMutation({ mutationFn: () => api.post('/favorites/' + id), onSuccess: () => q.invalidateQueries({ queryKey: ['session'] }) }); if (nft.isLoading)
    return <div className="wrap centered">Carregando NFT...</div>; if (!nft.data)
    return <div className="wrap centered">NFT não encontrado. <Link to="/">Voltar ao catálogo</Link></div>; const n = nft.data; const exists = ses.data?.favorites.includes(n.id); const inCart = cart.data?.find(x => x.id === n.id)?.qty || 0; return <div className="wrap"><div className="breadcrumbs"><Link to="/">Home</Link> / Mercado / {n.name}</div><div className="detail-layout"><div className="detail-photos"><div className="thumb-list">{[n.image, n.image, n.image].map((im, i) => <img key={i} src={im} alt={'Miniatura ' + (i + 1)}/>)}</div><Thumb nft={n} large/></div><div className="detail-info"><small className="eyebrow">Coleção Genesis</small><h1>{n.name} {n.edition}</h1><p>Uma criação exclusiva da coleção Kurio. Descubra o futuro da arte digital.</p><div className="detail-price">{n.price} ETH</div><div className="muted">Rede: {n.network} · {n.stock} unidades disponíveis</div><div className="detail-divider"/><h3>Selecionar edição</h3><div className="edition-box">{n.edition} — Edição limitada</div><h3>Quantidade</h3><div className="qty"><button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Diminuir"><Minus size={16}/></button><span>{qty}</span><button onClick={() => setQty(Math.min(n.stock, qty + 1))} aria-label="Aumentar"><Plus size={16}/></button></div><div className="detail-buttons"><SiteButton disabled={update.isPending} onClick={() => update.mutate({ id: n.id, qty: Math.min(n.stock, qty + inCart) }, { onSuccess: () => setMsg('NFT adicionado ao carrinho'), onError: e => setMsg(err(e)) })}><ShoppingCart size={15}/> Adicionar ao carrinho</SiteButton><button className="btn ghost" aria-label="Favoritar NFT" onClick={() => ses.data ? favorite.mutate() : setMsg('Entre em sua conta para favoritar')}><Heart size={16} fill={exists ? 'currentColor' : 'none'}/>{exists ? 'Favorito' : 'Favoritar'}</button></div>{msg && <p className="feedback" role="status">{msg}</p>}</div></div><section className="description"><div className="tabs"><span className="selected">Descrição do NFT</span><span>Histórico de propriedade</span></div><p>{n.description}</p><p>Este item faz parte de uma coleção limitada, criada para fãs de arte digital e colecionadores.</p></section><section className="related"><h2>Mais nesta coleção</h2><div className="card-grid">{nfts.filter(x => x.id !== n.id).slice(0, 4).map(x => <Card key={x.id} nft={x}/>)}</div></section></div>; }
function Cart() { const cart = useCart(); const update = useCartUpdate(); const [coupon, setCoupon] = useState(''); const [applied, setApplied] = useState(''); const [couponError, setCouponError] = useState(''); const quote = useQuery({ queryKey: ['quote', cart.data, applied], queryFn: () => api.post<{
        subtotal: string;
        discount: string;
        fee: string;
        total: string;
    }>('/quote', { coupon: applied }).then(r => r.data), enabled: !!cart.data }); const items = cart.data || []; return <div className="wrap"><div className="breadcrumbs"><Link to="/">Home</Link> / Carrinho</div><h1 className="section-title">Carrinho de NFTs</h1>{items.length ? <div className="cart-layout"><div><div className="table-header"><span>Produto</span><span>Preço</span><span>Quantidade</span><span>Total</span></div>{items.map(item => { const n = nfts.find(n => n.id === item.id)!; return <div className="cart-item" key={n.id}><Link to="/nft/$id" params={{ id: String(n.id) }} className="cart-product"><img src={n.image} alt={n.name}/><span><strong>{n.name} {n.edition}</strong><small>{n.collection}</small></span></Link><div>{n.price} ETH</div><div className="qty"><button onClick={() => update.mutate({ id: n.id, qty: item.qty - 1 })}><Minus size={13}/></button><span>{item.qty}</span><button onClick={() => update.mutate({ id: n.id, qty: item.qty + 1 })}><Plus size={13}/></button></div><div><b>{money(Number(n.price) * item.qty)}</b><button className="remove" onClick={() => update.mutate({ id: n.id, qty: 0 })}>Remover</button></div></div>; })}<Link to="/" className="subtle-link">← Continuar comprando</Link></div><aside className="summary"><h3>Resumo do pedido</h3><div><span>Subtotal</span><strong>{quote.data?.subtotal || '—'} ETH</strong></div><div><span>Desconto</span><strong>-{quote.data?.discount || '0.00'} ETH</strong></div><div><span>Taxa de rede</span><strong>{quote.data?.fee || '—'} ETH</strong></div><div className="summary-total"><span>Total</span><strong>{quote.data?.total || '—'} ETH</strong></div><label>Cupom de desconto</label><div className="coupon"><input value={coupon} placeholder="Código do cupom" onChange={e => setCoupon(e.target.value)}/><button onClick={() => { if (!coupon) {
    setApplied('');
    setCouponError('');
    return;
} api.post('/quote', { coupon }).then(() => { setApplied(coupon); setCouponError(''); }).catch(e => setCouponError(err(e))); }}>Aplicar</button></div>{couponError && <p role="alert" className="error">{couponError}</p>}{applied && <p className="success">Cupom aplicado!</p>}<Link to="/pagamento" className="btn wide">Continuar para pagamento <ArrowRight size={15}/></Link></aside></div> : <div className="empty centered"><ShoppingCart size={32}/><h2>Seu carrinho está vazio</h2><Link to="/" className="btn">Explorar NFTs</Link></div>}</div>; }
function AuthModal({ kind, close, switchMode, onSuccess, }: {
    kind: 'login' | 'signup';
    close: () => void;
    switchMode: (mode: 'login' | 'signup') => void;
    onSuccess: () => void;
}) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const login = useLogin();
    const signup = useSignup();
    const isLogin = kind === 'login';
    const mutation = isLogin ? login : signup;
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (isLogin) {
            login.mutate({ email, password }, { onSuccess });
        }
        else {
            signup.mutate({ name, email, password }, { onSuccess });
        }
    }
    return (<Dialog open onOpenChange={(open) => { if (!open)
        close(); }}>
      <DialogContent showCloseButton={false} className="kurio-auth-dialog">
        <button type="button" className="close icon-btn" onClick={close} aria-label="Fechar">
          <X size={20}/>
        </button>
        <div className="auth-logo">KURIO</div>
        <DialogTitle>{isLogin ? 'Entrar' : 'Criar uma conta'}</DialogTitle>
        <DialogDescription>
          {isLogin ? 'Bem-vindo de volta. Entre em sua conta.' : 'Junte-se à comunidade de colecionadores.'}
        </DialogDescription>
        <form onSubmit={submit}>
          {!isLogin && (<label>
              Nome completo
              <input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)}/>
            </label>)}
          <label>
            E-mail
            <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}/>
          </label>
          <label>
            Senha
            <input required type="password" minLength={isLogin ? 1 : 8} autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)}/>
          </label>
          {mutation.isError && <p role="alert" className="error">{err(mutation.error)}</p>}
          <button type="submit" className="btn wide" disabled={mutation.isPending}>
            {mutation.isPending ? 'Aguarde...' : isLogin ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
        <p>
          {isLogin ? 'Ainda não tem conta?' : 'Já possui conta?'}{' '}
          <button type="button" className="text-button" onClick={() => switchMode(isLogin ? 'signup' : 'login')}>
            {isLogin ? 'Cadastre-se' : 'Entrar'}
          </button>
        </p>
        <small>Teste: demo@kurio.com / Demo1234!</small>
      </DialogContent>
    </Dialog>);
}
function Guard({ children }: { children: React.ReactNode }) {
    const s = useSession();
    useEffect(() => {
        if (!s.isLoading && !s.data) {
            window.dispatchEvent(new Event('kurio:auth-required'));
        }
    }, [s.isLoading, s.data]);

    if (s.isLoading) return <div className="wrap centered">Carregando sessão...</div>;
    if (s.data) return <>{children}</>;
    return <div className="wrap centered">
        <UserRound size={32}/>
        <h2>Entre novamente para continuar</h2>
        <p>Seu carrinho permanece salvo. Após entrar, você continuará nesta página.</p>
        <button className="btn" onClick={() => window.dispatchEvent(new Event('kurio:auth-required'))}>Entrar</button>
    </div>;
}
function Checkout() { return <Guard><CheckoutInner /></Guard>; }
function CheckoutInner() { const s = useSession(); const cart = useCart(); const nav = useNavigate(); const draftKey = 'kurio-checkout-draft:' + (s.data?.id || 'guest');
    const [draft] = useState<Partial<{ wallet: string; network: string; coupon: string; scenario: 'confirmed' | 'pending' | 'refused'; idempotencyKey: string }>>(() => {
        try { return JSON.parse(sessionStorage.getItem(draftKey) || '{}'); } catch { return {}; }
    });
    const [wallet, setWallet] = useState(draft.wallet || '');
    const [network, setNetwork] = useState(draft.network || 'Ethereum');
    const [coupon, setCoupon] = useState(draft.coupon || '');
    const [scenario, setScenario] = useState<'confirmed' | 'pending' | 'refused'>(draft.scenario || 'confirmed'); const [error, setError] = useState(''); const [confirmed, setConfirmed] = useState(false); const [key] = useState(() => draft.idempotencyKey || crypto.randomUUID());
    useEffect(() => {
        sessionStorage.setItem(draftKey, JSON.stringify({ wallet, network, coupon, scenario, idempotencyKey: key }));
    }, [draftKey, wallet, network, coupon, scenario, key]); const quote = useQuery({ queryKey: ['checkout-quote', cart.data, coupon], queryFn: () => api.post<{
        subtotal: string;
        discount: string;
        fee: string;
        total: string;
    }>('/quote', { coupon }).then(x => x.data), enabled: !!cart.data }); const purchase = useMutation({ mutationFn: async () => { const current = (await api.post<{
        total: string;
    }>('/quote', { coupon })).data; if (current.total !== quote.data?.total) {
        setConfirmed(false);
        await quote.refetch();
        throw new Error('Os valores mudaram. Revise o resumo e confirme novamente.');
    } return (await api.post<Order>('/orders', { wallet: wallet || s.data?.wallets[0], coupon, idempotencyKey: key, scenario })).data; }, onSuccess: o => { sessionStorage.removeItem(draftKey); nav({ to: '/pedido/$id', params: { id: o.id } }); }, onError: e => setError(e instanceof Error && !axios.isAxiosError(e) ? e.message : err(e)) }); return <div className="wrap"><div className="breadcrumbs"><Link to="/carrinho">Carrinho</Link> / Pagamento</div><h1 className="section-title">Pagamento</h1><div className="checkout-layout"><div className="form-panel"><h2>Dados do colecionador</h2><label>Nome completo<input disabled value={s.data?.name || ''}/></label><label>E-mail<input disabled value={s.data?.email || ''}/></label><h2>Pagamento e carteira</h2>{s.data?.wallets.length ? <><label>Carteira<select value={wallet || s.data.wallets[0]} onChange={e => setWallet(e.target.value)}>{s.data.wallets.map(w => <option key={w} value={w}>{w.slice(0, 12)}...{w.slice(-6)}</option>)}</select></label><label>Rede<select value={network} onChange={e => setNetwork(e.target.value)}><option>Ethereum</option><option>Polygon</option><option>Solana</option></select></label></> : <p className="error">Você precisa cadastrar uma carteira. <Link to="/carteiras">Cadastrar carteira</Link></p>}<p className="muted">A carteira e o pagamento são simulados; não há conexão com blockchain real.</p><label>Cenário do pagamento (demonstração)<select value={scenario} onChange={e => { setScenario(e.target.value as typeof scenario); setConfirmed(false); }}><option value="confirmed">Pagamento confirmado</option><option value="pending">Pagamento pendente (confirma após 2 segundos)</option><option value="refused">Pagamento recusado</option></select></label><label>Cupom<input value={coupon} onChange={e => setCoupon(e.target.value)} placeholder="KURIO10"/></label><label className="checkbox-line"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/> Confirmo os itens, valores e condições da compra.</label>{error && <p className="error" role="alert">{error}</p>}{quote.isError && <p className="error" role="alert">{err(quote.error)}</p>}<SiteButton disabled={!confirmed || !cart.data?.length || !s.data?.wallets.length || purchase.isPending || quote.isError || !quote.data || quote.isFetching} onClick={() => purchase.mutate()}>{purchase.isPending ? 'Enviando pedido...' : 'Confirmar pedido'}</SiteButton></div><aside className="summary"><h3>Resumo do pedido</h3>{(cart.data || []).map(x => { const n = nfts.find(n => n.id === x.id)!; return <div className="summary-product" key={x.id}><img src={n.image} alt={n.name}/><span>{n.name}<small>Quantidade: {x.qty}</small></span><b>{money(Number(n.price) * x.qty)}</b></div>; })}<div><span>Subtotal</span><b>{quote.data?.subtotal || '—'} ETH</b></div><div><span>Desconto</span><b>{quote.data?.discount || '—'} ETH</b></div><div><span>Taxa de rede</span><b>{quote.data?.fee || '—'} ETH</b></div><div className="summary-total"><span>Total</span><b>{quote.data?.total || '—'} ETH</b></div><p className="muted"><ShieldCheck size={15}/> Compra protegida na simulação</p></aside></div></div>; }
function Profile() { return <Guard><ProfileInner /></Guard>; }
function ProfileInner() { const s = useSession(); const q = useQueryClient(); const [name, setName] = useState(s.data?.name || ''); const [password, setPassword] = useState(''); const [notice, setNotice] = useState(''); const update = useMutation({ mutationFn: () => api.put('/profile', { name, password: password || undefined }), onSuccess: () => { q.invalidateQueries({ queryKey: ['session'] }); setNotice('Perfil atualizado'); }, onError: e => setNotice(err(e)) }); return <div className="wrap account-layout"><AccountNav /><div className="form-panel"><h1>Meu perfil</h1><div className="profile-avatar"><UserRound size={36}/></div><label>Nome completo<input value={name} onChange={e => setName(e.target.value)}/></label><label>E-mail<input disabled value={s.data?.email || ''}/></label><label>Nova senha (opcional)<input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="No mínimo 8 caracteres"/></label><SiteButton onClick={() => update.mutate()} disabled={update.isPending}>Salvar alterações</SiteButton>{notice && <p role="status">{notice}</p>}</div></div>; }
function AccountNav() { const q = useQueryClient(); const navigate = useNavigate(); return <aside className="account-nav"><h3>Minha conta</h3><Link to="/perfil"><UserRound size={16}/> Meu perfil</Link><Link to="/carteiras"><Wallet size={16}/> Minhas carteiras</Link><Link to="/pedidos"><ShoppingCart size={16}/> Meus pedidos</Link><button onClick={async () => { await api.post('/logout'); q.clear(); navigate({ to: '/' }); }}><LogOut size={16}/> Sair</button></aside>; }
function Wallets() { return <Guard><WalletsInner /></Guard>; }
function WalletsInner() { const s = useSession(); const q = useQueryClient(); const [items, setItems] = useState(s.data?.wallets || []); const [value, setValue] = useState(''); const [notice, setNotice] = useState(''); const update = useMutation({ mutationFn: () => api.put('/wallets', { wallets: items }), onSuccess: () => { q.invalidateQueries({ queryKey: ['session'] }); setNotice('Carteiras salvas'); }, onError: e => setNotice(err(e)) }); return <div className="wrap account-layout"><AccountNav /><div className="form-panel"><h1>Minhas carteiras</h1><p className="muted">Carteiras fictícias para pagamentos simulados.</p>{items.map((w, i) => <div className="wallet-line" key={w}><Wallet size={18}/><span>{w}</span><button className="text-button" onClick={() => setItems(items.filter((_, j) => i !== j))}>Remover</button></div>)}<label>Adicionar carteira Ethereum (0x + 40 caracteres)<input placeholder="0x..." value={value} onChange={e => setValue(e.target.value)}/></label><button className="btn ghost" onClick={() => { if (/^0x[a-fA-F0-9]{40}$/.test(value)) {
    setItems([...items, value]);
    setValue('');
    setNotice('Carteira adicionada. Clique em Salvar.');
}
else
    setNotice('Insira um endereço válido de 42 caracteres.'); }}><Plus size={15}/> Adicionar</button> <SiteButton onClick={() => update.mutate()} disabled={update.isPending}>Salvar carteiras</SiteButton>{notice && <p role="status">{notice}</p>}</div></div>; }
function Orders() { return <Guard><OrdersInner /></Guard>; }

function OrderStatusBadge({ status }: { status: Order['status'] }) {
  const labels = {
    confirmed: 'Confirmado',
    pending: 'Pendente',
    refused: 'Recusado',
  }

  return (
    <Badge className={`kurio-status kurio-status-${status}`}>
      {labels[status]}
    </Badge>
  )
}

function OrdersInner() { const o = useQuery({ queryKey: ['orders'], queryFn: () => get<Order[]>('/orders') }); return <div className="wrap account-layout"><AccountNav /><div className="form-panel"><h1>Meus pedidos</h1>{o.data?.length ? o.data.map(x => <Link className="order-link" key={x.id} to="/pedido/$id" params={{ id: x.id }}><span>{x.id.slice(0, 8)} · {new Date(x.createdAt).toLocaleDateString('pt-BR')}</span><b>{x.total} ETH</b><OrderStatusBadge status={x.status} /></Link>) : <p>Nenhum pedido encontrado.</p>}</div></div>; }
function Receipt() { return <Guard><ReceiptInner /></Guard>; }
function ReceiptInner() { const { id } = useParams({ from: '/pedido/$id' }); const order = useQuery({ queryKey: ['order', id], queryFn: () => get<Order>('/orders/' + id), refetchInterval: q => q.state.data?.status === 'pending' ? 750 : false }); if (order.isLoading)
    return <div className="wrap centered">Carregando pedido...</div>; if (!order.data)
    return <div className="wrap centered">Pedido não encontrado</div>; const o = order.data; return <div className="wrap receipt"><div className="receipt-icon"><Check size={32}/></div><h1>{o.status === 'pending' ? 'Pedido pendente' : o.status === 'refused' ? 'Pagamento recusado' : 'Pedido confirmado!'}</h1><p>{o.status === 'pending' ? 'Aguardando resultado simulado. O status será atualizado automaticamente.' : o.status === 'refused' ? 'Nenhum item foi removido do carrinho. Você pode tentar novamente.' : 'Obrigado por colecionar com a Kurio. Este é um pedido simulado.'}</p><div className="summary"><h3>Detalhes do pedido</h3><div><span>Transação</span><small>{o.id}</small></div><div><span>Data</span><span>{new Date(o.createdAt).toLocaleString('pt-BR')}</span></div>{o.items.map(i => <div key={i.nft.id} className="summary-product"><img src={i.nft.image} alt={i.nft.name}/><span>{i.nft.name}<small>Quantidade: {i.qty}</small></span><b>{money(Number(i.nft.price) * i.qty)}</b></div>)}<div><span>Subtotal</span><b>{o.subtotal} ETH</b></div><div><span>Taxas</span><b>{o.fee} ETH</b></div><div className="summary-total"><span>{o.status === 'confirmed' ? 'Total pago' : 'Total do pedido'}</span><b>{o.total} ETH</b></div></div>{o.status === 'refused' && <Link to="/pagamento" className="btn">Tentar novamente</Link>}<Link to="/" className="btn">Voltar ao mercado</Link></div>; }
