"""How close painting colors get to their nearest name, at several list sizes (ROADMAP §13-14).
Run from the repo root: python3 tools/name_coverage.py. The synthetic ladder (101/250/.../2711) is a farthest-point
spread of data/library.json, used to pick a target size; the final section measures the real, built core list
(data/core-names.json, tools/build_core_names.py) the same way, so the two are directly comparable."""
import json, sys, numpy as np
def lab(rgb):
    c=rgb/255.0; c=np.where(c>0.04045,((c+0.055)/1.055)**2.4,c/12.92)
    M=np.array([[0.4124,0.3576,0.1805],[0.2126,0.7152,0.0722],[0.0193,0.1192,0.9505]])
    xyz=c@M.T/np.array([0.95047,1,1.08883])
    f=np.where(xyz>0.008856,np.cbrt(xyz),7.787*xyz+16/116)
    return np.stack([116*f[:,1]-16,500*(f[:,0]-f[:,1]),200*(f[:,1]-f[:,2])],1)
def de00(A,B):  # A (n,3), B (m,3) -> (n,m)
    L1,a1,b1=[A[:,i][:,None] for i in range(3)]; L2,a2,b2=[B[:,i][None,:] for i in range(3)]
    C1=np.hypot(a1,b1);C2=np.hypot(a2,b2);Cb=(C1+C2)/2;G=0.5*(1-np.sqrt(Cb**7/(Cb**7+25**7)))
    a1p=(1+G)*a1;a2p=(1+G)*a2;C1p=np.hypot(a1p,b1);C2p=np.hypot(a2p,b2)
    h1=np.degrees(np.arctan2(b1,a1p))%360;h2=np.degrees(np.arctan2(b2,a2p))%360
    dL=L2-L1;dC=C2p-C1p;dh=h2-h1;dh=np.where(dh>180,dh-360,np.where(dh<-180,dh+360,dh));dh=np.where(C1p*C2p==0,0,dh)
    dH=2*np.sqrt(C1p*C2p)*np.sin(np.radians(dh/2))
    Lb=(L1+L2)/2;Cbp=(C1p+C2p)/2
    hs=h1+h2;hb=np.where(C1p*C2p==0,hs,np.where(np.abs(h1-h2)<=180,hs/2,np.where(hs<360,(hs+360)/2,(hs-360)/2)))
    T=1-0.17*np.cos(np.radians(hb-30))+0.24*np.cos(np.radians(2*hb))+0.32*np.cos(np.radians(3*hb+6))-0.2*np.cos(np.radians(4*hb-63))
    SL=1+0.015*(Lb-50)**2/np.sqrt(20+(Lb-50)**2);SC=1+0.045*Cbp;SH=1+0.015*Cbp*T
    RT=-2*np.sqrt(Cbp**7/(Cbp**7+25**7))*np.sin(np.radians(60*np.exp(-((hb-275)/25)**2)))
    return np.sqrt((dL/SL)**2+(dC/SC)**2+(dH/SH)**2+RT*(dC/SC)*(dH/SH))
raw=open('data/gallery/index.bin','rb').read(); n=len(raw)//30
P=[]; W=[]
for i in range(n):
    r=raw[i*30+6:i*30+30]
    for k in range(6): P.append(r[k*4:k*4+3]); W.append(r[k*4+3])
P=np.array([list(p) for p in P],float); Wt=np.array(W,float)
rng=np.random.default_rng(1); idx=rng.choice(len(P),20000,replace=False); PL=lab(P[idx]); PW=Wt[idx]
lib=json.load(open('data/library.json'))
LH=np.array([[int(x['h'][i:i+2],16) for i in (1,3,5)] for x in lib],float); LL=lab(LH)
# greedy coverage order: farthest-point on the library (start at mid grey); proxy for "a well spread core list"
order=[int(np.argmin(np.abs(LL[:,0]-50)+np.hypot(LL[:,1],LL[:,2])))]; dmin=de00(LL,LL[order])[:,0]
for _ in range(len(LL)-1):
    j=int(np.argmax(dmin)); order.append(j); dmin=np.minimum(dmin,de00(LL,LL[[j]])[:,0])
def row(label, sub):
    d=np.concatenate([de00(PL[i:i+2000],sub).min(1) for i in range(0,len(PL),2000)])
    q=lambda p: np.percentile(d,p)
    print(f"{label:>22}: median {q(50):4.1f}  90th {q(90):4.1f}  <3: {np.mean(d<3)*100:4.0f}%  <5: {np.mean(d<5)*100:4.0f}%")

print(f"{n} paintings, 20,000 sampled palette colors. Nearest-name ΔE2000:")
if "--ladder" in sys.argv or "--core" not in sys.argv:
    for N in [101,250,500,1000,1500,2711]:
        row(f"{N} names (synthetic)", LL[order[:N]])
if "--core" in sys.argv or "--ladder" not in sys.argv:
    core=json.load(open('data/core-names.json'))
    CH=np.array([[int(x['h'][i:i+2],16) for i in (1,3,5)] for x in core],float); CL=lab(CH)
    row(f"{len(core)} names (core-names.json)", CL)
