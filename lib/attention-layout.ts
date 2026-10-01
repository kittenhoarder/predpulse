import type { AttentionGroup } from "./attention-model";
export interface AttentionTile { group: AttentionGroup; x: number; y: number; width: number; height: number }
/** Exact area partition before separator strokes. Only seven canonical categories. */
export function attentionTiles(groups: AttentionGroup[], width = 600, height = 320): AttentionTile[] {
  const tiles: AttentionTile[]=[];
  const split=(items:AttentionGroup[],x:number,y:number,w:number,h:number)=>{
    if(items.length===1){tiles.push({group:items[0],x,y,width:w,height:h});return;}
    const total=items.reduce((s,c)=>s+c.volume,0);let sum=0,at=1,distance=Infinity;
    for(let i=1;i<items.length;i++){sum+=items[i-1].volume;const d=Math.abs(total/2-sum);if(d<distance){distance=d;at=i;}}
    const left=items.slice(0,at),right=items.slice(at),ratio=left.reduce((s,c)=>s+c.volume,0)/total;
    if(w>=h){split(left,x,y,w*ratio,h);split(right,x+w*ratio,y,w*(1-ratio),h);}
    else{split(left,x,y,w,h*ratio);split(right,x,y+h*ratio,w,h*(1-ratio));}
  };
  const positive=groups.filter(c=>c.volume>0);if(positive.length)split(positive,0,0,width,height);
  return tiles;
}
