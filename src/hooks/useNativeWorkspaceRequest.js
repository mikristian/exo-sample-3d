import {useCallback} from 'react'
import {nativeBridgeFetch,nativeWorkspaceHeaders as workspaceHeaders} from '../core/nativeWorkspaceTransport.js'

// Owns the serialized native command boundary; renderers consume its snapshots.
export function useNativeWorkspaceRequest({BASE,state,lock,setBusy,setError,nativeGradeLastError,graphicsProjectEpoch,setS,running,setPlaying}){
 return useCallback(async(data)=>{if(lock.current)return null;lock.current=true;setBusy(true);setError('');nativeGradeLastError.current='';try{const res=await nativeBridgeFetch(BASE+'/workspace',{method:'POST',headers:workspaceHeaders(),body:JSON.stringify({revision:state.current?.revision,...data})});const result=await res.json();if(!res.ok||!result?.ok)throw Error(result?.error||'ClothCraft request failed');if(result.data?.template){const next={...result.data,avatar:result.data.avatar||(data.op==='open'?null:state.current?.avatar)};if(data.op==='open')graphicsProjectEpoch.current+=1;state.current=next;setS(next)}return result.data}catch(e){nativeGradeLastError.current=e.message;setError(e.message.includes('OGC initial intersection')?'A panel overlaps the avatar or another panel. Use Move to place it fully clear, then switch to Hand or press SIM. Reset Panels restores the initial arrangement.':e.message);running.current=false;setPlaying(false);return null}finally{lock.current=false;setBusy(false)}},[])
}
