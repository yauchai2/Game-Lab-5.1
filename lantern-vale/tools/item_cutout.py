import sys,numpy as np
from PIL import Image
from scipy import ndimage as ndi
BG=np.array([26,6,6],float)
def cut(src,dst,sizes=(256,128),bg=BG,tol=26,soft_lo=14,soft_w=26,fill_holes=False):
    a=np.asarray(Image.open(src).convert('RGB')).astype(float)
    d=np.sqrt(((a-np.asarray(bg,float))**2).sum(2))
    cand=d<tol
    lab,n=ndi.label(cand)
    border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bg=np.isin(lab,list(border))
    # enclosed bg-colored holes (ring loops) - only large ones
    inner=cand&~bg
    il,ni=ndi.label(inner)
    if ni and not fill_holes:
        isz=ndi.sum(inner,il,range(1,ni+1)); big=[i+1 for i,v in enumerate(isz) if v>600]
        bg|=np.isin(il,big)
    fg=~bg
    lab2,n2=ndi.label(fg)
    if n2>1:
        sz=ndi.sum(fg,lab2,range(1,n2+1)); keep=[i+1 for i,s in enumerate(sz) if s>sz.max()*0.01]
        fg=np.isin(lab2,keep)
    # soft edge: pixels in 2px rim blend by closeness to bg colour
    rim=fg&~ndi.binary_erosion(fg,iterations=2)
    alpha=fg.astype(float)
    soft=np.clip((d-soft_lo)/soft_w,0,1)
    alpha[rim]=soft[rim]
    alpha=ndi.gaussian_filter(alpha,0.6)
    alpha=np.where(fg|ndi.binary_dilation(fg,iterations=1),alpha,0)
    rgba=np.dstack([a,np.clip(alpha,0,1)*255]).astype(np.uint8)
    img=Image.fromarray(rgba,'RGBA')
    bb=img.getchannel('A').point(lambda v:255 if v>8 else 0).getbbox()
    img=img.crop(bb); w,h=img.size; s=max(w,h); pad=int(s*0.05); S=s+pad*2
    sq=Image.new('RGBA',(S,S),(0,0,0,0)); sq.paste(img,((S-w)//2,(S-h)//2))
    for sz in sizes:
        sq.resize((sz,sz),Image.BOX if S>sz*2 else Image.LANCZOS).save(dst.replace('{s}',str(sz)))
if __name__=='__main__': cut(sys.argv[1],sys.argv[2])
