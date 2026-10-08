// Shared helpers for the three visual-direction mockups (design/VISUAL-DIRECTION.md). Not app code.
const VD_NAMES = [
  ["Amber","#FFBF00"],["Mustard","#E1AD01"],["Saffron","#F4C430"],["Lemon","#FFF44F"],["Cream","#FFFDD0"],["Khaki","#C3B091"],
  ["Ochre","#CC7722"],["Tangerine","#F28500"],["Coral","#FF7F50"],["Salmon","#FA8072"],["Peach","#FFCBA4"],["Apricot","#FBCEB1"],
  ["Vermilion","#E34234"],["Scarlet","#FF2400"],["Crimson","#DC143C"],["Cherry","#B0122E"],["Burgundy","#800020"],["Maroon","#5E1A1A"],
  ["Rose","#E8798F"],["Blush","#DE5D83"],["Magenta","#C2185B"],["Fuchsia","#D02090"],["Mauve","#B784A7"],["Lilac","#C8A2C8"],
  ["Lavender","#B4A7D6"],["Violet","#7F00FF"],["Plum","#8E4585"],["Aubergine","#3D0734"],["Indigo","#3F2B8C"],["Navy","#1B2A5B"],
  ["Cobalt","#0047AB"],["Ultramarine","#2A3FB0"],["Azure","#2E7FD6"],["Cerulean","#2A9FD6"],["Sky","#87CEEB"],["Ice","#CFE8F0"],
  ["Teal","#008080"],["Petrol","#1F5F68"],["Turquoise","#30C5C0"],["Aqua","#7FDCD0"],["Mint","#98E2B5"],["Jade","#00A86B"],
  ["Emerald","#2E9B5F"],["Viridian","#40826D"],["Forest","#1F5130"],["Moss","#8A9A5B"],["Sage","#9CAF88"],["Olive","#7A7A2A"],
  ["Lime","#A4C639"],["Pistachio","#93C572"],["Chartreuse","#C4D600"],["Umber","#635147"],["Sienna","#A0522D"],["Rust","#B7410E"],
  ["Cocoa","#6B4A3A"],["Chocolate","#4A2C20"],["Taupe","#8B7D6B"],["Ash","#B2BEB5"],["Silver","#C0C0C0"],["Slate","#5A6470"],
  ["Charcoal","#36393D"],["Ivory","#F4EFDF"],["Bone","#E3DAC9"],["Ecru","#CDB891"]
];
const vdHex = h => [1,3,5].map(i => parseInt(h.slice(i,i+2),16));
const vdHsl = (h,s,l) => { s/=100; l/=100; const k=n=>(n+h/30)%12, a=s*Math.min(l,1-l), f=n=>l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1)); return [f(0),f(8),f(4)].map(x=>Math.round(x*255)); };
const vdToHex = c => "#" + c.map(x => x.toString(16).padStart(2,"0")).join("");
const vdNear = rgb => { let b=null,bd=1e9; for (const [n,h] of VD_NAMES){ const c=vdHex(h), d=(c[0]-rgb[0])**2*.3+(c[1]-rgb[1])**2*.59+(c[2]-rgb[2])**2*.11; if(d<bd){bd=d;b=[n,h];} } return b; };
const vdLum = c => (0.2126*c[0]+0.7152*c[1]+0.0722*c[2])/255;

// A hue map (hue across, light to dark down) packed on a hex lattice with a fisheye toward (cx, cy).
// shape: "circle" | "hex" | "chip". Returns HTML for absolutely positioned bubbles inside a w x h box.
function vdMap({ w=440, h=956, step=60, cx=.5, cy=.42, shape="circle", font="'Instrument Serif',serif", label=true, chipLabel=false, dim=false }) {
  const out = [], cols = Math.ceil(w/step)+2, rows = Math.ceil(h/(step*.87))+2, used = new Set();
  for (let r=-1; r<rows; r++) for (let q=-1; q<cols; q++) {
    const x = q*step + (r%2 ? step/2 : 0), y = r*step*.87;
    const dx = (x - w*cx)/w, dy = (y - h*cy)/h, d = Math.sqrt(dx*dx*1.4 + dy*dy*2.2);
    const s = Math.max(.32, 1.18 - d*1.7);
    const hue = (q/cols)*330 + 10, light = 88 - (r/rows)*70, sat = 62 + 30*Math.sin((q+r)*.7)**2;
    const rgb = vdHsl(hue, sat, light), [nm] = vdNear(rgb);
    const size = step*s*.96, L = vdLum(rgb), ink = L > .55 ? "rgba(20,18,16,.82)" : "rgba(255,255,255,.9)";
    const fs = Math.max(8, size*.2), show = label && size > 34 && !used.has(nm);
    if (show) used.add(nm);
    let radius = shape==="circle" ? "50%" : shape==="chip" ? "5px" : "0";
    const clip = shape==="hex" ? "clip-path:polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%);" : "";
    const lbl = show ? (chipLabel
      ? `<span style="position:absolute;left:0;right:0;bottom:0;height:${Math.max(12,size*.28)}px;background:#F6F3EC;color:#161412;font:500 ${Math.max(7,size*.14)}px/1 Geist,sans-serif;display:flex;align-items:center;padding-left:5px;border-radius:0 0 4px 4px">${nm}</span>`
      : `<span style="color:${ink};font:${fs}px/1 ${font};letter-spacing:-.01em">${nm}</span>`) : "";
    out.push(`<div style="position:absolute;left:${x-size/2}px;top:${y-size/2}px;width:${size}px;height:${shape==="chip"?size*1.12:size}px;background:${vdToHex(rgb)};border-radius:${radius};${clip}display:flex;align-items:center;justify-content:center;${dim?"opacity:.35;":""}box-sizing:border-box">${lbl}</div>`);
  }
  return out.join("");
}

// An odd-one-out board: n x n tiles, one slightly different (by dL in HSL lightness). Returns tile hexes.
function vdBoard(n=3, hue=262, sat=55, l=38, odd=4, dL=3.5) {
  return Array.from({length:n*n}, (_,i) => vdToHex(vdHsl(hue, sat, i===odd ? l+dL : l)));
}
