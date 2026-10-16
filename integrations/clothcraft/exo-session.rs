//! EXO adapter: one persistent upstream document, authoring history and VBD/OGC solver.
use marvelous_cloth::{authoring::{self,Command,History}, fitting::{FittingProject,FittingScene}, garment::{presets::GarmentKind, shapes::{Primitive,MirrorAxis,BooleanOp}, meshing::MeshingSettings}, vbd::{VbdSolver,VbdSettings}};
use serde::{de::DeserializeOwned};
use serde_json::{Value,json};
use std::{io::{self,BufRead,Write},path::PathBuf,sync::Arc};
fn field<T:DeserializeOwned>(v:&Value,k:&str)->Result<T,String>{serde_json::from_value(v.get(k).cloned().ok_or(format!("Missing {k}"))?).map_err(|e|e.to_string())}
fn command(v:&Value)->Result<Command,String>{
 let op=v["kind"].as_str().ok_or("Missing command kind")?;
 macro_rules! f {($k:literal)=>{field(v,$k)?}}
 Ok(match op {
 "Primitive"=>Command::Primitive{kind:match v["shape"].as_str(){Some("ellipse")=>Primitive::Ellipse,Some("sector")=>Primitive::Sector,_=>Primitive::Rectangle},size:f!("size"),sweep_degrees:v["sweep_degrees"].as_f64().unwrap_or(180.),origin:f!("origin"),meshing:MeshingSettings::default(),fabric:f!("fabric"),replace:false},
 "Polygon"=>Command::Polygon{points:f!("points"),tangents:field(v,"tangents").unwrap_or_default(),meshing:MeshingSettings::default(),fabric:f!("fabric"),replace:false},
 "Anchor"=>Command::Anchor{panel:f!("panel"),anchor:f!("anchor"),position:f!("position")},
 "MovePoints"=>Command::MovePoints{panel:f!("panel"),points:f!("points"),delta:f!("delta")},
 "Dimensions"=>Command::Dimensions{panel:f!("panel"),width:f!("width"),height:f!("height")},
 "Shape"=>Command::Shape{panel:f!("panel"),polygon:f!("polygon")},
 "SplitBoundary"=>Command::SplitBoundary{panel:f!("panel"),edge:f!("edge"),at_m:f!("at_m")},
 "RemovePoint"=>Command::RemovePoint{panel:f!("panel"),point:f!("point")},
 "CurvePoint"=>Command::CurvePoint{panel:f!("panel"),anchor:f!("anchor"),curved:f!("curved")},
 "TargetLength"=>Command::TargetLength{panel:f!("panel"),edge:f!("edge"),target_m:f!("target_m")},
 "BoardTransform"=>Command::BoardTransform{panel:f!("panel"),origin:f!("origin"),rotation_degrees:f!("rotation_degrees")},
 "Place"=>Command::Place{panel:f!("panel"),placement:f!("placement")},
 "Duplicate"=>Command::Duplicate{panel:f!("panel")},
 "RemovePanel"=>Command::RemovePanel{panel:f!("panel")},
 "Sew"=>Command::Sew{a:f!("a"),b:f!("b"),reverse:f!("reverse"),ease:f!("ease")},
 "RemoveSeam"=>Command::RemoveSeam{seam:f!("seam")},
 "Fabric"=>Command::Fabric{panel:f!("panel"),name:f!("name"),properties:f!("properties"),all_panels:f!("all_panels")},
 "Mirror"=>Command::Mirror{panel:f!("panel"),axis:if v["axis"]=="y"{MirrorAxis::Y}else{MirrorAxis::X},copy_side:field(v,"copy_side").unwrap_or(None)},
 "Boolean"=>Command::Boolean{a:f!("a"),b:f!("b"),op:match v["operation"].as_str(){Some("difference")=>BooleanOp::Difference,Some("intersection")=>BooleanOp::Intersection,_=>BooleanOp::Union},keep_tool:f!("keep_tool")},
 "InternalLine"=>Command::InternalLine{panel:f!("panel"),points:f!("points"),tangents:field(v,"tangents").unwrap_or_default()},
 "RemoveLine"=>Command::RemoveLine{panel:f!("panel"),line:f!("line")},
 "Ruffle"=>Command::Ruffle{panel:f!("panel"),line:f!("line"),width:f!("width"),ratio:f!("ratio")},
 _=>return Err(format!("Unsupported authoring command {op}")),
 })
}
struct Session {project:FittingProject,scene:FittingScene,solver:Option<VbdSolver>,history:History,revision:u64,metrics:Value, #[cfg(feature="desktop")] gpu:Option<marvelous_cloth::gpu_vbd::GpuVbd>}
impl Session {
 fn new(project:FittingProject)->Result<Self,String>{
 let scene=project.compile()?;
 #[cfg(feature="desktop")]
 let gpu=if std::env::args().any(|a|a=="--gpu") {
  use eframe::wgpu;
  let instance=wgpu::Instance::new(wgpu::InstanceDescriptor::new_without_display_handle());
  let adapter=pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions{power_preference:wgpu::PowerPreference::HighPerformance,..Default::default()})).map_err(|e|e.to_string())?;
  if adapter.get_info().device_type==wgpu::DeviceType::Cpu{return Err("Hardware GPU unavailable".into())}
  let (device,queue)=pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor{label:Some("EXO ClothCraft Metal workspace"),..Default::default()})).map_err(|e|e.to_string())?;
  Some(marvelous_cloth::gpu_vbd::GpuVbd::new(device,queue))
 }else{None};
 #[cfg(not(feature="desktop"))]
 if std::env::args().any(|a|a=="--gpu"){return Err("Build with desktop for GPU simulation".into())}
 Ok(Self{project,scene,solver:None,history:History::default(),revision:0,metrics:Value::Null,#[cfg(feature="desktop")]gpu})
 }
 fn apply_edit(&mut self,edit:authoring::Edit){
  if edit.reset_simulation {
   self.scene.state=edit.state_after(&self.scene.garment,&self.scene.state);
   self.scene.garment=Arc::new(edit.garment);self.solver=None;self.metrics=Value::Null;
  }
  self.project.template=edit.template;self.revision+=1;
 }
 fn snapshot(&self,avatar:bool)->Value {
  let g=&self.scene.garment;
  let panels:Vec<_>=g.panels.iter().enumerate().map(|(i,p)|json!({"id":p.id,"vertices":[p.vertices.start,p.vertices.end],"triangles":[p.triangles.start,p.triangles.end],"boundaries":p.boundaries,"layout":authoring::layout(&self.project.template,i)})).collect();
  let seams:Vec<_>=g.seams.iter().map(|s|json!({"id":s.id,"guides":s.guides,"gap_m":s.max_gap(&self.scene.state.x)})).collect();
  json!({"revision":self.revision,"template":self.project.template,"positions":self.scene.state.x,"uv":g.mesh.uv,"triangles":g.mesh.triangles.iter().map(|t|t.vertices).collect::<Vec<_>>(),"panels":panels,"seams":seams,"time":self.scene.state.time,"metrics":self.metrics,"canUndo":self.history.can_undo(),"canRedo":self.history.can_redo(),"avatar":if avatar {json!({"positions":self.scene.collider.surface.vertices,"triangles":self.scene.collider.surface.triangles})}else{Value::Null},"backend":if std::env::args().any(|a|a=="--gpu"){"ClothCraft GPU VBD + CPU OGC"}else{"ClothCraft CPU VBD + OGC"},"fitCertified":false})
 }
 fn request(&mut self,v:&Value)->Result<Value,String>{
  let op=v["op"].as_str().unwrap_or("snapshot");
  if !["snapshot","save"].contains(&op) && v["revision"].as_u64()!=Some(self.revision){return Err("Stale document revision; reload current snapshot".into())}
  match op {
   "edit"=>{let edit=authoring::apply(&self.project.template,command(&v["command"])?)?;self.history.record(self.project.template.clone());self.apply_edit(edit);},
   "undo"|"redo"=>{let edit=self.history.restore(&self.project.template,op=="redo")?;self.apply_edit(edit);},
   "reset"=>{self.scene.state=self.scene.garment.initial_state.clone();self.solver=None;self.metrics=Value::Null;self.revision+=1;},
   "step"=>{
    let count=v["steps"].as_u64().unwrap_or(1);if !(1..=4).contains(&count){return Err("Step batch must be 1–4".into())}
    if self.solver.is_none(){self.solver=Some(VbdSolver::new(self.scene.garment.clone(),Some(&self.scene.collider.surface),&self.scene.state)?)}
    let settings=VbdSettings{dt:1.0/60.0,iterations:16,..Default::default()};
    for _ in 0..count {
 #[cfg(feature="desktop")]
 let metric=if let Some(gpu)=&self.gpu{gpu.step(self.solver.as_mut().unwrap(),&mut self.scene.state,&settings,None)?}else{self.solver.as_mut().unwrap().step(&mut self.scene.state,&settings,None)?};
 #[cfg(not(feature="desktop"))]
 let metric=self.solver.as_mut().unwrap().step(&mut self.scene.state,&settings,None)?;
 self.metrics=serde_json::to_value(metric).map_err(|e|e.to_string())?;self.revision+=1;
 }
   },
   "save"=>{let mut p=self.project.clone();p.state=Some(self.scene.state.clone());let file=PathBuf::from(std::env::args().nth(2).ok_or("save path missing")?);if let Some(dir)=file.parent(){std::fs::create_dir_all(dir).map_err(|e|e.to_string())?;}p.save(&file)?;let saved:Value=serde_json::from_str(&std::fs::read_to_string(file).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;return Ok(json!({"project":saved,"revision":self.revision}))},
   "snapshot"=>{},_=>return Err("Unknown session operation".into())
  }
  Ok(self.snapshot(v["avatar"].as_bool().unwrap_or(false)))
 }
}
fn main(){
 rayon::ThreadPoolBuilder::new().num_threads(2).build_global().unwrap();
 let avatar=PathBuf::from(std::env::args().nth(1).expect("avatar path required"));
 let mut session:Option<Session>=None;
 for line in io::stdin().lock().lines(){
  let line=match line{Ok(s)=>s,Err(_)=>break};
  let result=(||->Result<Value,String>{
   let v:Value=serde_json::from_str(&line).map_err(|e|e.to_string())?;
   if v["op"]=="open" {
    let mut p=if let Some(value)=v.get("project"){serde_json::from_value::<FittingProject>(value.clone()).map_err(|e|e.to_string())?}else{
     FittingProject::basic(if v["preset"]=="dress"{GarmentKind::Dress}else{GarmentKind::Tshirt},2,avatar.clone())
    };
    // All imports use the exact bundled upstream mannequin, never caller-controlled files.
    p.avatar_path=avatar.clone();
    if let Some(t)=v.get("template"){p.template=serde_json::from_value(t.clone()).map_err(|e|e.to_string())?;p.state=None;p.mesh_signature=None;}
    let next=Session::new(p)?;let out=next.snapshot(true);session=Some(next);return Ok(out)
   }
   session.as_mut().ok_or("Open a garment first")?.request(&v)
  })();
  let response=match result{Ok(data)=>json!({"ok":true,"data":data}),Err(error)=>json!({"ok":false,"error":error,"data":session.as_ref().map(|s|s.snapshot(false))})};
  println!("{}",response);let _=io::stdout().flush();
 }
}
