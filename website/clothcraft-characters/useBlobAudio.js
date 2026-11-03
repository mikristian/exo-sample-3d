import {useCallback,useEffect,useRef,useState} from 'react'

// All audio stays in the browser on this computer.
// No uploads, external services, speech recognition or voice storage.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value))

export default function useBlobAudio(){
  const levelRef=useRef(0)
  const bandsRef=useRef([0,0,0])
  const session=useRef(null)
  const generation=useRef(0)
  const [mode,setMode]=useState('idle')
  const [meter,setMeter]=useState(0)
  const [error,setError]=useState('')
  const [fileName,setFileName]=useState('')

  const stop=useCallback(()=>{
    generation.current++
    const old=session.current
    session.current=null
    if(old){
      cancelAnimationFrame(old.frame)
      clearTimeout(old.timeout)
      old.element?.pause()
      old.element?.removeAttribute('src')
      old.element?.load()
      if(old.url)URL.revokeObjectURL(old.url)
      old.stream?.getTracks().forEach(track=>track.stop())
      try{old.source?.disconnect()}catch{}
      try{old.analyser?.disconnect()}catch{}
      try{old.gain?.disconnect()}catch{}
      try{old.filter?.disconnect()}catch{}
      old.oscillators?.forEach(o=>{try{o.stop()}catch{};try{o.disconnect()}catch{}})
      if(old.context?.state!=='closed')void old.context?.close().catch(()=>{})
    }
    levelRef.current=0;bandsRef.current=[0,0,0]
    setMeter(0)
    setMode('idle')
  },[])

  useEffect(()=>()=>{generation.current++;const current=session.current;session.current=null;if(current){cancelAnimationFrame(current.frame);clearTimeout(current.timeout);current.element?.pause();current.stream?.getTracks().forEach(t=>t.stop());if(current.url)URL.revokeObjectURL(current.url);void current.context?.close().catch(()=>{})}},[])
  useEffect(()=>{
    const onHidden=()=>{if(document.hidden&&session.current?.stream)stop()}
    document.addEventListener('visibilitychange',onHidden)
    return()=>document.removeEventListener('visibilitychange',onHidden)
  },[stop])

  const establish=useCallback(async(requestedMode)=>{
    stop()
    setError('')
    const token=++generation.current
    const Audio=window.AudioContext||window.webkitAudioContext
    if(!Audio){setError('Web Audio is unavailable in this browser.');return null}
    let context
    try{context=new Audio();await context.resume()}
    catch(err){setError('Audio could not start. Allow sound playback and try again.');if(context)void context.close().catch(()=>{});return null}
    if(token!==generation.current){void context.close().catch(()=>{});return null}
    const analyser=context.createAnalyser()
    analyser.fftSize=1024
    analyser.smoothingTimeConstant=.78
    const current={context,analyser,frame:0,timeout:0,oscillators:[],element:null,stream:null,source:null,gain:null,filter:null,url:null}
    session.current=current
    setMode(requestedMode)
    const raw=new Uint8Array(analyser.fftSize)
    const freq=new Uint8Array(analyser.frequencyBinCount)
    let filtered=0,lastUI=0
    const loop=time=>{
      if(session.current!==current)return
      analyser.getByteTimeDomainData(raw)
      analyser.getByteFrequencyData(freq)
      let squares=0
      for(let i=0;i<raw.length;i++){const n=(raw[i]-128)/128;squares+=n*n}
      const rms=Math.sqrt(squares/raw.length)
      const rawLevel=clamp(Math.pow(rms*5.6,.81),0,1)
      filtered+=(rawLevel-filtered)*(rawLevel>filtered?.36:.16)
      levelRef.current=filtered
      // Energy by thirds in the 90-3000Hz frequency band.
      const hzPerBin=context.sampleRate/analyser.fftSize
      const ranges=[[60,220],[220,880],[880,2900]]
      bandsRef.current=ranges.map(([from,to])=>{
        const start=Math.max(0,Math.floor(from/hzPerBin))
        const end=Math.min(freq.length,Math.ceil(to/hzPerBin))
        let value=0
        for(let i=start;i<end;i++)value+=freq[i]
        return clamp((value/Math.max(1,end-start))/170,0,1)
      })
      if(time-lastUI>85){setMeter(Math.round(filtered*100));lastUI=time}
      current.frame=requestAnimationFrame(loop)
    }
    current.frame=requestAnimationFrame(loop)
    return {current,token}
  },[stop])

  const playDemo=useCallback(async()=>{
    const ready=await establish('demo')
    if(!ready)return false
    const {current,token}=ready
    const {context,analyser}=current
    // Original voiced-synth preview: 12 softly rounded tonal syllables routed
    // through the same analyser used for microphone and local audio files.
    const filter=context.createBiquadFilter()
    filter.type='lowpass';filter.frequency.value=950;filter.Q.value=.7
    const gain=context.createGain()
    gain.gain.value=0
    filter.connect(gain)
    gain.connect(analyser)
    analyser.connect(context.destination)
    current.gain=gain;current.filter=filter
    const voice=context.createOscillator()
    voice.type='triangle';voice.frequency.value=175
    const undertone=context.createOscillator()
    undertone.type='sine';undertone.frequency.value=87
    const underGain=context.createGain();underGain.gain.value=.18
    voice.connect(filter);undertone.connect(underGain);underGain.connect(filter)
    current.oscillators=[voice,undertone]
    voice.start();undertone.start()
    const start=context.currentTime+.045
    const pitches=[178,205,155,186,229,203,170,187,165,233,198,159,185]
    let cursor=start
    pitches.forEach((pitch,index)=>{
      const duration=[.19,.25,.30,.17,.26,.33,.19,.22,.28,.18,.25,.34,.22][index]
      voice.frequency.setTargetAtTime(pitch,cursor,.026)
      undertone.frequency.setTargetAtTime(pitch*.5,cursor,.035)
      const peak=.10+[.14,.29,.17,.24,.18][index%5]
      gain.gain.setValueAtTime(0,cursor)
      gain.gain.linearRampToValueAtTime(peak,cursor+.042)
      gain.gain.setValueAtTime(peak,cursor+duration*.45)
      gain.gain.exponentialRampToValueAtTime(.0001,cursor+duration-.006)
      cursor+=duration+.07
    })
    const length=(cursor-start+.14)*1000
    current.timeout=setTimeout(()=>{if(generation.current===token)stop()},length)
    return true
  },[establish,stop])

  const startMicrophone=useCallback(async()=>{
    if(!navigator.mediaDevices?.getUserMedia){setError('Microphone input needs localhost/HTTPS and a compatible browser.');return false}
    const ready=await establish('microphone')
    if(!ready)return false
    const {current,token}=ready
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false})
      if(token!==generation.current){stream.getTracks().forEach(track=>track.stop());return false}
      current.stream=stream
      current.source=current.context.createMediaStreamSource(stream)
      current.source.connect(current.analyser) // Intentionally NOT connected to speakers.
      stream.getAudioTracks().forEach(track=>track.addEventListener('ended',()=>{if(session.current===current)stop()},{once:true}))
      return true
    }catch(err){
      if(token===generation.current){
        stop()
        setError(err.name==='NotAllowedError'?'Microphone permission was not granted.':'Microphone input is unavailable.')
      }
      return false
    }
  },[establish,stop])

  const playFile=useCallback(async(file)=>{
    if(!file)return false
    if(!file.type.startsWith('audio/')){setError('Choose an audio file (MP3, WAV, M4A, etc.).');return false}
    if(file.size>75*1024*1024){setError('Please use an audio file smaller than 75 MB.');return false}
    const ready=await establish('file')
    if(!ready)return false
    const {current,token}=ready
    const audio=new Audio()
    const url=URL.createObjectURL(file)
    audio.src=url
    current.url=url;current.element=audio
    setFileName(file.name)
    audio.addEventListener('ended',()=>{if(generation.current===token)stop()},{once:true})
    audio.addEventListener('error',()=>{if(generation.current===token){stop();setError('Unable to play this audio format.')}},{once:true})
    current.source=current.context.createMediaElementSource(audio)
    current.source.connect(current.analyser)
    current.analyser.connect(current.context.destination)
    try{await audio.play();return true}catch{if(generation.current===token){stop();setError('Audio playback was blocked or the file could not be decoded.')}return false}
  },[establish,stop])

  return {mode,meter,error,fileName,levelRef,bandsRef,playDemo,startMicrophone,playFile,stop}
}
