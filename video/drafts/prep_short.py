import json, re, subprocess, wave, numpy as np
D='/tmp/claude-0/-home-claude/5bcbe5b4-e22c-5d8b-91d6-a7477d36cd10/scratchpad/'
TAKE='TS2'; TEMPO=1.07; KEEP=0.24; SR=44100
al=json.load(open(D+f'acebaby/align_{TAKE}.json'))
chars=al['characters']; cs=al['character_start_times_seconds']; ce=al['character_end_times_seconds']
text=''.join(chars)
def t_of(sub, end=False, after=0):
    i=text.index(sub, after)
    return (ce[i+len(sub)-1] if end else cs[i]), i
src=D+f'acebaby/ACE_Baby_{TAKE}.mp3'
subprocess.run(['ffmpeg','-v','error','-y','-i',src,'-ac','1','-ar',str(SR),D+'ts_in.wav'],check=True)
log=subprocess.run(['ffmpeg','-hide_banner','-i',src,'-af','silencedetect=n=-38dB:d=0.30','-f','null','-'],capture_output=True,text=True).stderr
st=[float(x) for x in re.findall(r'silence_start: ([0-9.]+)',log)]; en=[float(x) for x in re.findall(r'silence_end: ([0-9.]+)',log)]
with wave.open(D+'ts_in.wav') as w: a=np.frombuffer(w.readframes(w.getnframes()),np.int16)
segs=[]; pos=0.0
for s,e in zip(st,en):
    if s<0.05: pos=max(0,e-KEEP/2); continue
    segs.append((pos, s+KEEP/2)); pos=e-KEEP/2
segs.append((pos, len(a)/SR))
out=[]; m=[]; acc=0.0
for s,e in segs:
    out.append(a[int(s*SR):int(e*SR)]); m.append((s,e,acc)); acc+=e-s
def M(t):
    for s,e,o in m:
        if t<=e: return (o+max(0,t-s))/TEMPO
    return acc/TEMPO
b=np.concatenate(out)
with wave.open(D+'ts_mid.wav','wb') as w: w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(b.tobytes())
subprocess.run(['ffmpeg','-v','error','-y','-i',D+'ts_mid.wav','-af',f'atempo={TEMPO}',D+'acevid/voice_short.wav'],check=True)
dur=acc/TEMPO
caps=[("Heyyy buddy!","Heyyy buddy!",[]),("You will","You will NOT believe my day!",["NOT"]),
 ("ACE brought","ACE brought in fresh leads before breakfast,",["ACE"]),("cranked","cranked out a whole week of content,",[]),
 ("and posted","and posted it EVERYWHERE!",["EVERYWHERE!"]),("Then it went","Then it went FULL THROTTLE on prospecting,",["FULL","THROTTLE"]),
 ("turned prospects","turned prospects into customers,",[]),("followed up","followed up with my whole pipeline...",[]),
 ("even got","even got my clients sending referrals!",[]),("And it all","And it all keeps growing... on autopilot.",["autopilot."]),
 ("Me?","Me?",[]),("I tapped","I tapped Approve.",["Approve."]),("On my phone","On my phone! On the beach!",[]),
 ("Gonna hang","Gonna hang with the boys tonight!",[])]
# end of each caption = start of next caption's anchor (or its own last char)
starts=[t_of(c[0])[0] for c in caps]
seri=t_of("Seriously")[0]
out_caps=[]
for k,(anc,txt,gw) in enumerate(caps):
    s=starts[k]; e=(starts[k+1] if k+1<len(caps) else seri)-0.05
    out_caps.append([round(M(s),2), round(M(e),2), txt, gw])
ev=lambda sub: round(M(t_of(sub)[0])+0.05,2)
timing={
 'voice_end': round(dur,2),
 'T1': round(M(seri)-0.12,2),
 'captions': out_caps,
 'events': [[ev("ACE brought"),0],[ev("cranked"),1],[ev("EVERYWHERE"),2],[ev("FULL THROTTLE"),3],[ev("turned prospects"),4],
            [ev("followed up"),5],[ev("referrals"),6],[ev("on autopilot"),7],
            [ev("I tapped"),None,"ONE-TAP APPROVAL","Approved from his phone","Everything above ran with one tap"]],
 'final_card': ev("Gonna hang"),
 'tagline': round(M(t_of("stop paying")[0]),2),
 'cta': round(M(t_of("Type AUTOMATE")[0]),2),
}
json.dump(timing,open(D+'acevid/timing_short.json','w'),indent=1)
print(json.dumps({k:v for k,v in timing.items() if k!='captions'},indent=0)); print(out_caps[:3])
