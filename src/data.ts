export type NFT={id:number;name:string;edition:string;price:string;stock:number;image:string;collection:string;network:string;description:string}
export type CartItem={id:number;qty:number}
export type User={id:string;name:string;email:string;password:string;avatar?:string;wallets:string[];favorites:number[]}
export type Order={id:string;userId:string;items:Array<{nft:NFT;qty:number}>;subtotal:string;fee:string;total:string;status:'pending'|'confirmed'|'refused';createdAt:string}
export const nfts:NFT[]=[
{id:1,name:'Emerald Ape',edition:'#042',price:'1.19',stock:8,image:'/nfts/emerald.webp',collection:'Arte digital',network:'Ethereum',description:'Uma edição rara da coleção Genesis. Um explorador visionário com estilo único e acabamento exclusivo.'},
{id:2,name:'Sage Nomad',edition:'#099',price:'1.69',stock:12,image:'/nfts/sage.webp',collection:'Colecionáveis',network:'Ethereum',description:'O viajante sábio da coleção Kurio Genesis, criado para quem valoriza originalidade.'},
{id:3,name:'Neon Vessel',edition:'#552',price:'1.99',stock:7,image:'/nfts/neon.webp',collection:'Arte digital',network:'Polygon',description:'Um retrato atemporal combinando elegância e identidade digital.'},
{id:4,name:'Cosmic Bloom',edition:'#118',price:'1.29',stock:4,image:'/nfts/cosmic.webp',collection:'Arte 3D',network:'Ethereum',description:'A criatividade floresce em uma edição limitada de alta qualidade.'},
{id:5,name:'Violet Nomad',edition:'#314',price:'1.39',stock:10,image:'/nfts/sage.webp',collection:'Colecionáveis',network:'Solana',description:'Explorador em tons de violeta, parte da comunidade Kurio.'},
{id:6,name:'Ivory Baron',edition:'#088',price:'1.79',stock:6,image:'/nfts/neon.webp',collection:'Fotografia',network:'Polygon',description:'Elegância minimalista combinada com a inovação da arte digital.'},
{id:7,name:'Golden Beat',edition:'#207',price:'0.99',stock:14,image:'/nfts/golden.webp',collection:'Música',network:'Ethereum',description:'Expressividade, música e energia em um colecionável singular.'},
{id:8,name:'Golden Signal',edition:'#160',price:'0.39',stock:21,image:'/nfts/golden.webp',collection:'Arte digital',network:'Solana',description:'Uma obra vibrante da série Golden Genesis.'},
{id:9,name:'Emerald Legacy',edition:'#306',price:'2.29',stock:3,image:'/nfts/emerald.webp',collection:'Arte 3D',network:'Ethereum',description:'Um clássico moderno com tiragem limitada.'},
]
export const money=(x:number)=>x.toFixed(2)+' ETH'
export const price=(x:string)=>Number(x)
