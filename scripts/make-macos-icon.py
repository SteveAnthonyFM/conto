"""Generates the macOS app icon master (icon_1024.png): rounded shape, transparent margin (824px body on a 1024 canvas). Usage: python3 scripts/make-macos-icon.py  -> writes icon_1024.png in the cwd; then build an .icns with sips + iconutil."""
import zlib, struct, math
N=1024; SS=2
BODY=824.0; HALF=BODY/2; K=BODY/1024.0
bg=(15,19,27); blue=(61,127,255); dot=(238,241,246)
def mix(a,b,t): return tuple(a[i]*(1-t)+b[i]*t for i in range(3))
outline_col=mix(bg,blue,0.3)
def sd_round(px,py,hx,hy,r):
    qx=abs(px)-hx+r; qy=abs(py)-hy+r
    return math.hypot(max(qx,0),max(qy,0))+min(max(qx,qy),0)-r
CX,CY,R=539.5,512.0,260.0
A=math.atan2(212,150.5)
def in_c(x,y):  # coordinates in original 1024 art space
    dx=x-CX; dy=y-CY; th=math.atan2(dy,dx)
    if abs(th)>=A: return abs(math.hypot(dx,dy)-R)<=42
    for ex,ey in ((690,300),(690,724)):
        if math.hypot(x-ex,y-ey)<=42: return True
    return False
rows=[]
for j in range(N):
    row=bytearray()
    for i in range(N):
        r=g=b=a=0.0
        for sj in range(SS):
            for si in range(SS):
                x=i+(si+.5)/SS-512; y=j+(sj+.5)/SS-512
                if sd_round(x,y,HALF,HALF,185)>0: continue
                ox=512+x/K; oy=512+y/K   # original art coords
                col=bg
                d=sd_round(ox-512,oy-512,440,440,196)
                if abs(d)<=5: col=outline_col
                if in_c(ox,oy): col=blue
                if math.hypot(ox-690,oy-512)<=46: col=dot
                r+=col[0];g+=col[1];b+=col[2];a+=1
        n=SS*SS
        if a==0: row+=bytes((0,0,0,0))
        else: row+=bytes((round(r/a),round(g/a),round(b/a),round(255*a/n)))
    rows.append(bytes(row))
raw=b''.join(b'\x00'+r for r in rows)
def chunk(t,d): 
    c=struct.pack('>I',len(d))+t+d; return c+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',N,N,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
open('icon_1024.png','wb').write(png)
