/** Original local-only operation counts; never used as a condition for access. */
const KEY='stencil-usage'
export function operationUsage():Record<string,number>{try{const raw=JSON.parse(localStorage.getItem(KEY)??'{}');return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}}catch{return {}}}
export function recordOperationUse(type:string){const usage=operationUsage();usage[type]=(Number(usage[type])||0)+1;try{localStorage.setItem(KEY,JSON.stringify(usage))}catch{}}
export function frequentFirst<T extends {type:string}>(options:T[]){const usage=operationUsage();return options.slice().sort((a,b)=>(Number(usage[b.type])||0)-(Number(usage[a.type])||0))}
