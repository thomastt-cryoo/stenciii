import {writeFileSync,renameSync} from 'node:fs'
// Audit snapshots may be read by the evidence collector while a long replay runs.
// Replace completed JSON atomically and tolerate transient Windows scanner locks.
export function snapshot(path,value){
 const temporary=path+'.pending',body=JSON.stringify(value,null,2)+'\n'
 for(let attempt=0;;attempt++)try{writeFileSync(temporary,body);renameSync(temporary,path);return}catch(error){if(attempt>=39)throw error;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25)}
}
