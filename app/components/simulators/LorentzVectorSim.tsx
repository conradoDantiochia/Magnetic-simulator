'use client'

import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { createScene, handleResize, createArrow, C, disposeGroup, makeSprite } from '@/app/lib/three-utils'
import { ParamControl, ResultsPanel, FormulaBox, OrbitHint } from '@/app/components/ParamControl'
import { vec3, cross, scale, magnitude, add, ELECTRON_CHARGE, Vec3 } from '@/app/lib/physics'

export default function LorentzVectorSim(){

const mountRef = useRef<HTMLDivElement>(null)
const sceneRef = useRef<any>(null)

const [q,setQ] = useState(-1)

const [vx,setVx] = useState(0)
const [vy,setVy] = useState(0)
const [vz,setVz] = useState(0)

const [Bx,setBx] = useState(0)
const [By,setBy] = useState(0)
const [Bz,setBz] = useState(0)

const [Ex,setEx] = useState(0)
const [Ey,setEy] = useState(0)
const [Ez,setEz] = useState(0)

function safeNumber(v:number){
if(v===undefined || v===null || isNaN(v)) return 0
return v
}

const vV:Vec3 = vec3(safeNumber(vx),safeNumber(vy),safeNumber(vz))
const BV:Vec3 = vec3(safeNumber(Bx),safeNumber(By),safeNumber(Bz))
const EV:Vec3 = vec3(safeNumber(Ex),safeNumber(Ey),safeNumber(Ez))

const charge = q * ELECTRON_CHARGE

const vxB = cross(vV,BV)

const Fm = scale(vxB,charge)
const Fe = scale(EV,charge)

const FV = add(Fm,Fe)

const Fmag = magnitude(FV)

function toSexagesimal(angle:number){

const sign = angle<0?'-':''
const abs = Math.abs(angle)

const deg = Math.floor(abs)

const minFloat = (abs-deg)*60
const min = Math.floor(minFloat)

const sec = Math.round((minFloat-min)*60)

return `${sign}${deg}° ${min}' ${sec}"`
}

const angleXYdeg = Math.atan2(FV.y,FV.x)*180/Math.PI
const angleXYsex = toSexagesimal(angleXYdeg)

useEffect(()=>{

const mount = mountRef.current
if(!mount) return

const canvas = document.createElement('canvas')
canvas.style.width='100%'
canvas.style.height='100%'
mount.appendChild(canvas)

const {renderer,scene,camera,controls} = createScene(canvas)

sceneRef.current={scene,renderer,camera,controls}

let animId=0

const loop=()=>{

animId=requestAnimationFrame(loop)

handleResize(canvas,renderer,camera)

controls.update()

renderer.render(scene,camera)

}

loop()

return()=>{

cancelAnimationFrame(animId)

renderer.dispose()

controls.dispose()

mount.removeChild(canvas)

}

},[])

useEffect(()=>{

const s = sceneRef.current
if(!s) return

const {scene} = s

scene.children
.filter((c:THREE.Object3D)=>c.userData?.isVec)
.forEach((c:THREE.Object3D)=>disposeGroup(scene,c))

const vecs = [
{v:vV,color:C.cyan,lbl:'v'},
{v:BV,color:C.rose,lbl:'B'},
{v:EV,color:C.blue,lbl:'E'},
{v:Fm,color:0xff4444,lbl:'Fm'},
{v:Fe,color:0x4488ff,lbl:'Fe'},
{v:FV,color:C.gold,lbl:'F'}
]

const maxMag = Math.max(...vecs.map(x=>magnitude(x.v)),0.001)

vecs.forEach(({v,color,lbl})=>{

const mag = magnitude(v)

if(mag<0.0001) return

const len = 3.5*(mag/maxMag)

const dir = new THREE.Vector3(v.x,v.y,v.z).normalize()

const arrow = createArrow(
dir,
new THREE.Vector3(0,0,0),
len,
color,
0.18,
0.033
)

arrow.userData.isVec=true

const sprite = makeSprite(lbl,`#${color.toString(16).padStart(6,'0')}`,0.5)

sprite.position.copy(dir.clone().multiplyScalar(len+0.4))
sprite.userData.isVec=true

scene.add(arrow)
scene.add(sprite)

})

},[
vx,vy,vz,
Bx,By,Bz,
Ex,Ey,Ez,
q
])

const fmt = (v:Vec3)=>`(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`

return(

<div>

<FormulaBox
title="Fuerza de Lorentz"
lines={[
'F = q(E + v × B)'
]}
/>

<div style={{position:'relative',width:'100%',height:'420px'}}>
<div ref={mountRef} style={{width:'100%',height:'100%'}}/>
<OrbitHint/>
</div>

<div style={{display:'flex',flexWrap:'wrap',gap:10,marginTop:10}}>

<div style={{flex:'1 1 250px'}}>

<ParamControl label="q/e" value={safeNumber(q)} min={-10} max={10} step={1} onChange={v=>setQ(safeNumber(v))} color="rose"/>

<ParamControl label="vx (m/s)" value={safeNumber(vx)} min={-1000000} max={1000000} step={1000} onChange={v=>setVx(safeNumber(v))} color="cyan"/>

<ParamControl label="vy (m/s)" value={safeNumber(vy)} min={-1000000} max={1000000} step={1000} onChange={v=>setVy(safeNumber(v))} color="cyan"/>

<ParamControl label="vz (m/s)" value={safeNumber(vz)} min={-1000000} max={1000000} step={1000} onChange={v=>setVz(safeNumber(v))} color="cyan"/>

<ParamControl label="Bx (T)" value={safeNumber(Bx)} min={-20} max={20} step={0.5} onChange={v=>setBx(safeNumber(v))} color="rose"/>

<ParamControl label="By (T)" value={safeNumber(By)} min={-20} max={20} step={0.5} onChange={v=>setBy(safeNumber(v))} color="rose"/>

<ParamControl label="Bz (T)" value={safeNumber(Bz)} min={-20} max={20} step={0.5} onChange={v=>setBz(safeNumber(v))} color="rose"/>

<ParamControl label="Ex (N/C)" value={safeNumber(Ex)} min={-20} max={20} step={0.5} onChange={v=>setEx(safeNumber(v))} color="gold"/>

<ParamControl label="Ey (N/C)" value={safeNumber(Ey)} min={-20} max={20} step={0.5} onChange={v=>setEy(safeNumber(v))} color="gold"/>

<ParamControl label="Ez (N/C)" value={safeNumber(Ez)} min={-20} max={20} step={0.5} onChange={v=>setEz(safeNumber(v))} color="gold"/>

</div>

<div style={{flex:'1 1 250px'}}>

<ResultsPanel
rows={[
{label:'v',value:fmt(vV),color:'cyan'},
{label:'B',value:fmt(BV),color:'rose'},
{label:'E',value:fmt(EV),color:'cyan'},
{label:'v × B',value:fmt(vxB),color:'gold'},
{label:'Fm',value:fmt(Fm),color:'rose'},
{label:'Fe',value:fmt(Fe),color:'cyan'},
{label:'F total',value:fmt(FV),color:'gold'},
{label:'|F|',value:Fmag.toExponential(3)+' N',color:'green'},
{label:'angulo XY',value:`${angleXYdeg.toFixed(2)}° (${angleXYsex})`,color:'cyan'}
]}
/>

</div>

</div>

</div>

)

}