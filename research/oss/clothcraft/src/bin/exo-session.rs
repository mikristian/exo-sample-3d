//! EXO adapter: one persistent upstream document, authoring history and VBD/OGC solver.
use marvelous_cloth::{authoring::{self,Command,History}, fitting::{FittingProject,FittingScene,PrintGraphic,ImportedHardware,PersistedGradeRun,NativeDraftPointBindings,NativeDraftMeasurement,NativeCommitIdentityV1,NativePropertyMetadataV1}, native_fabric_grade_chart_20261027::PersistedFabricGradeEnvelope, garment::{presets::GarmentKind, shapes::{Primitive,MirrorAxis,BooleanOp}, meshing::MeshingSettings}, vbd::{Grab,VbdSolver,VbdSettings}};
use marvelous_cloth::native_piece_variant_20261027::PersistedPieceVariant;
use marvelous_cloth::native_facing_dependency_20261027::PersistedFacingDependency;
use marvelous_cloth::native_cross_piece_link_20261030::NativeCrossPieceLink20261030;
use serde::{de::DeserializeOwned,Serialize,Deserialize};
use serde_json::{Value,json};
use glam::{DVec2,DVec3,DQuat,EulerRot};
use std::{io::{self,BufRead,Write},path::PathBuf,sync::Arc};
/// Persist linked authoring history independently from simulation caches.
/// The digest anchors this journal to the precise FittingProject accepted on open.
#[derive(Clone,Serialize,Deserialize)]
#[serde(deny_unknown_fields)]
struct DurableHistoryV1 {
 schema_version:u32,
 project_digest:String,
 #[serde(default,skip_serializing_if="Option::is_none")]
 commit:Option<NativeCommitIdentityV1>,
 history:History,
 bindings_undo:Vec<Option<NativeDraftPointBindings>>,bindings_redo:Vec<Option<NativeDraftPointBindings>>,
 grade_undo:Vec<Option<PersistedGradeRun>>,grade_redo:Vec<Option<PersistedGradeRun>>,
 facing_undo:Vec<Option<PersistedFacingDependency>>,facing_redo:Vec<Option<PersistedFacingDependency>>,
 #[serde(default)]
 cross_undo:Vec<Option<NativeCrossPieceLink20261030>>,
 #[serde(default)]
 cross_redo:Vec<Option<NativeCrossPieceLink20261030>>,
 envelope_undo:Vec<Option<PersistedFabricGradeEnvelope>>,envelope_redo:Vec<Option<PersistedFabricGradeEnvelope>>,
 variant_undo:Vec<Option<PersistedPieceVariant>>,variant_redo:Vec<Option<PersistedPieceVariant>>,
 hardware_undo:Vec<Vec<ImportedHardware>>,hardware_redo:Vec<Vec<ImportedHardware>>,
 #[serde(default)]
 graphics_undo:Vec<Vec<PrintGraphic>>,
 #[serde(default)]
 graphics_redo:Vec<Vec<PrintGraphic>>,
 #[serde(default)]
 metadata_undo:Vec<Option<NativePropertyMetadataV1>>,
 #[serde(default)]
 metadata_redo:Vec<Option<NativePropertyMetadataV1>>,
 hardware_steps_undo:Vec<bool>,hardware_steps_redo:Vec<bool>,
}
fn history_digest(project:&FittingProject)->Result<String,String>{
 let mut canonical=project.clone();
 // Native save fills these derived fields and canonicalizes the mannequin.
 // They are irrelevant to authored history identity.
 canonical.mesh_signature=None;
 canonical.avatar_path=PathBuf::new();
 let bytes=serde_json::to_vec(&canonical).map_err(|e|e.to_string())?;
 // The exact canonical JSON bytes are held in the journal. This avoids a
 // second hashing dependency and rejects even same-length stale documents.
 Ok(String::from_utf8(bytes).map_err(|e|e.to_string())?)
}
fn history_path(project_path:&std::path::Path)->PathBuf{
 let mut name=project_path.as_os_str().to_os_string();name.push(".undo-v1.json");PathBuf::from(name)
}
/// Persist file contents before renaming and persist the containing directory
/// after each rename. A process crash and a system power loss have different
/// durability rules: rename alone does not guarantee the directory entry.
fn sync_saved_file(path:&std::path::Path)->Result<(),String>{
 std::fs::File::open(path).and_then(|file|file.sync_all()).map_err(|e|e.to_string())
}
fn sync_saved_directory(path:&std::path::Path)->Result<(),String>{
 let directory=path.parent().filter(|dir|!dir.as_os_str().is_empty()).unwrap_or(std::path::Path::new("."));
 std::fs::File::open(directory).and_then(|dir|dir.sync_all()).map_err(|e|e.to_string())
}
/// Stage a direct native grade mutation and its linked Undo/Redo journal before
/// replacing either committed file. Once project rename succeeds the matching
/// staged journal is retained for cold-open recovery even if promotion fails.
fn commit_direct_grade_with_history(session:&mut Session,candidate:&FittingProject,path:&std::path::Path,temporary:&std::path::Path)->Result<(),String>{
 commit_direct_grade_with_history_inner(session,candidate,path,temporary,||Ok(()))
}
// The failure seam makes the crash interval between the native project rename
// and the linked-journal rename deterministic in Rust tests. It is a no-op in
// the real editor, and cannot be invoked through its JSON/RPC boundary.
fn commit_direct_grade_with_history_inner(
 session:&mut Session,candidate:&FittingProject,path:&std::path::Path,
 temporary:&std::path::Path,after_project_commit:impl FnOnce()->Result<(),String>,
)->Result<(),String>{
 if candidate.native_commit!=session.project.native_commit {
  return Err("Direct native grade candidate has mismatched durable document identity".into());
 }
 let next_stamp=NativeCommitIdentityV1::next(session.commit_identity.as_ref())?;
 let mut stamped_candidate=candidate.clone();
 stamped_candidate.native_commit=Some(next_stamp.clone());
 let prior=session.export_history(&session.project)?;
 // Cold-open native and JS recovery both inspect this standard pending path.
 let pending=history_path(&path.with_extension("save-next.tmp"));
 session.record_linked_history();
 let mut project_committed=false;
 let staged=||->Result<(),String>{
  stamped_candidate.save(temporary)?;
  let reopened:FittingProject=serde_json::from_slice(&std::fs::read(temporary).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
  let mut journal=session.export_history(&reopened)?;
  journal.commit=Some(next_stamp.clone());
  std::fs::write(&pending,serde_json::to_vec(&journal).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
  sync_saved_file(temporary)?;
  sync_saved_file(&pending)?;
  sync_saved_directory(path)?;
  std::fs::rename(temporary,path).map_err(|e|e.to_string())?;
  project_committed=true;
  // Project is now committed. The staged, digest-checked journal can be
  // recovered after process death even if this second rename is interrupted.
  sync_saved_directory(path)?;
  after_project_commit()?;
  std::fs::rename(&pending,history_path(path)).map_err(|e|e.to_string())?;
  sync_saved_directory(path)?;
  session.commit_identity=journal.commit.clone();
  session.project.native_commit=journal.commit.clone();
  Ok(())
 };
 let result=staged();
 if result.is_err(){
  if project_committed {
   // This is NOT a rollback: the new Rust project is already durable, and
   // the staged journal must remain for an exact-digest cold-open. Disallow
   // all further operations on this now-stale in-memory session.
   session.recovery_required=true;
   return Err(format!("NATIVE_PROJECT_COMMITTED_HISTORY_RECOVERY_REQUIRED: {}",result.unwrap_err()));
  }
  let _=session.import_history(prior);
  let _=std::fs::remove_file(temporary);
  let _=std::fs::remove_file(&pending);
 }
 result
}
fn recover_durable_history(session:&mut Session,project_path:&std::path::Path)->bool{
 let committed=history_path(project_path);
 let pending=history_path(&project_path.with_extension("save-next.tmp"));
 let newer_pending=match (std::fs::metadata(&pending),std::fs::metadata(&committed)){
  // Filesystems can report identical timestamps for two consecutive saves.
  // A valid staged journal represents the transaction written after the
  // committed sidecar; validation below still rejects stale document digests.
  (Ok(p),Ok(c))=>match (p.modified(),c.modified()){(Ok(pm),Ok(cm))=>pm>=cm,_=>true},
  (Ok(_),Err(_))=>true,
  _=>false,
 };
 let candidates=if newer_pending {[&pending,&committed]}else{[&committed,&pending]};
 for candidate in candidates {
  if let Ok(bytes)=std::fs::read(candidate) {
   if let Ok(saved)=serde_json::from_slice::<DurableHistoryV1>(&bytes) {
    if session.import_history(saved).is_ok(){return true;}
   }
  }
 }
 false
}
/// A missing journal is allowed for legacy imports. Once either native
/// journal exists, however, raw Rust clients must not silently open the
/// garment with empty Undo/Redo stacks when both recovery candidates fail.
fn recover_durable_history_or_reject(session:&mut Session,project_path:&std::path::Path)->Result<(),String>{
 let committed=history_path(project_path);
 let pending=history_path(&project_path.with_extension("save-next.tmp"));
 let exists=|path:&std::path::Path|->Result<bool,String>{
  match std::fs::symlink_metadata(path){
   Ok(_)=>Ok(true),
   Err(error) if error.kind()==std::io::ErrorKind::NotFound=>Ok(false),
   Err(error)=>Err(format!("Native linked history journal cannot be inspected: {}",error)),
  }
 };
 let has_journal=exists(&committed)?||exists(&pending)?;
 if recover_durable_history(session,project_path){return Ok(());}
 if has_journal || session.project.native_commit.is_some() {
  return Err("Native linked history journal missing, corrupt or mismatched; refusing to discard Undo/Redo on open".into());
 }
 Ok(())
}
#[cfg(test)]
mod native_durable_history_tests {
 use super::*;
 fn session()->Session{
  let avatar=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/makehuman/mannequin.obj");
  Session::new(FittingProject::basic(GarmentKind::Tshirt,2,avatar)).unwrap()
 }
 fn metadata(project:&FittingProject)->NativePropertyMetadataV1{
  let panel=project.template.panels[0].id.clone();
  let fabric=project.template.fabrics[0].id.clone();
  NativePropertyMetadataV1{version:2,identity:"a".repeat(64),
   metadata_project_id:uuid::Uuid::new_v4().to_string(),
   panels:std::collections::BTreeMap::from([
     (panel,json!({"itemNo":"SEW-PANEL-1"}))]),
   fabrics:std::collections::BTreeMap::from([
     (fabric,json!({"supplier":"EXO FACTORY",
       "appearance":{"color":"#123abc","opacity":0.9,
         "side":{"roughness":0.4}}}))])}
 }
 #[test]
 fn property_metadata_is_native_owned_validated_saved_and_undo_follows_deleted_piece(){
  let mut writer=session();
  let native=metadata(&writer.project);
  let initial=serde_json::to_value(&writer.project).unwrap();
  let out=writer.request(&json!({"op":"property-metadata-store","revision":0,
    "metadata":native})).unwrap();
  assert_eq!(out["revision"],0,"presentation edits retain the geometry revision");
  assert_eq!(out["propertyMetadata"]["panels"][writer.project.template.panels[0].id.as_str()]["itemNo"],
    "SEW-PANEL-1");
  assert_ne!(serde_json::to_value(&writer.project).unwrap(),initial);
  let file=std::env::temp_dir().join(format!(
    "exo-native-property-{}-{:?}.json",std::process::id(),std::thread::current().id()));
  let saved_project=writer.project.clone();
  saved_project.save(&file).unwrap();
  let read=FittingProject::load(&file).unwrap();
  assert!(read.property_metadata.is_some(),"property is embedded in the native FittingProject");
  let loaded=read.property_metadata.as_ref().unwrap();
  assert_eq!(loaded.metadata_project_id,writer.project.property_metadata.as_ref().unwrap().metadata_project_id);
  std::fs::remove_file(&file).unwrap();
  let panel=writer.project.template.panels[0].id.clone();
  writer.request(&json!({"op":"edit","revision":0,
    "command":{"kind":"RemovePanel","panel":panel}})).unwrap();
  assert!(!writer.project.property_metadata.as_ref().unwrap().panels.contains_key(&panel));
  writer.request(&json!({"op":"undo","revision":1})).unwrap();
  assert!(writer.project.property_metadata.as_ref().unwrap().panels.contains_key(&panel),
    "Undo must restore the deleted panel's exact native property entry");
  writer.request(&json!({"op":"redo","revision":2})).unwrap();
  assert!(!writer.project.property_metadata.as_ref().unwrap().panels.contains_key(&panel));
 }
 #[test]
 fn invalid_or_cross_project_property_metadata_does_not_mutate_native_revision_or_history(){
  let mut s=session();
  let valid=metadata(&s.project);
  let original=serde_json::to_value(&s.project).unwrap();
  for wrong in [
   json!({"metadata":valid,"extra":true}),
   json!({"metadata":{}}),
   json!({"metadata":{ "version":2,"identity":"not-sha",
      "metadataProjectId":uuid::Uuid::new_v4().to_string(),
      "panels":{},"fabrics":{}}}),
  ]{
   let mut request=json!({"op":"property-metadata-store","revision":0});
   let data=wrong.as_object().unwrap();
   for (key,val) in data {request[key]=val.clone();}
   assert!(s.request(&request).is_err());
   assert_eq!(serde_json::to_value(&s.project).unwrap(),original);
  }
  let mut bad=metadata(&s.project);
  bad.panels.insert("unknown-piece".into(),json!({"itemNo":"X"}));
  assert!(s.request(&json!({"op":"property-metadata-store","revision":0,"metadata":bad})).is_err());
  let valid=metadata(&s.project);
  s.request(&json!({"op":"property-metadata-store","revision":0,"metadata":valid})).unwrap();
  let old=serde_json::to_value(&s.project).unwrap();
  let mut second=valid.clone();
  second.metadata_project_id=uuid::Uuid::new_v4().to_string();
  assert!(s.request(&json!({"op":"property-metadata-store","revision":0,"metadata":second})).is_err());
  assert_eq!(serde_json::to_value(&s.project).unwrap(),old);
  assert_eq!(s.revision,0);
 }
 #[test]
 fn raw_open_must_reject_existing_corrupt_or_mismatched_journal(){
  let mut source=session();
  let panel=source.project.template.panels[0].id.clone();
  source.request(&json!({"op":"set-property","revision":0,"target":"panel","id":panel,"field":"name","value":"HISTORY REQUIRED"})).unwrap();
  let valid=source.export_history(&source.project).unwrap();
  let directory=std::env::temp_dir().join(format!("exo-raw-history-{}-{:?}",std::process::id(),std::thread::current().id()));
  std::fs::create_dir_all(&directory).unwrap();
  let project=directory.join("project.json");
  let journal=history_path(&project);
  std::fs::write(&journal,b"{corrupt").unwrap();
  let mut corrupted=Session::new(source.project.clone()).unwrap();
  assert!(recover_durable_history_or_reject(&mut corrupted,&project).is_err());
  assert!(!corrupted.history.can_undo());
  std::fs::write(&journal,serde_json::to_vec(&valid).unwrap()).unwrap();
  let mut accepted=Session::new(source.project.clone()).unwrap();
  recover_durable_history_or_reject(&mut accepted,&project).unwrap();
  assert!(accepted.history.can_undo());
  let mut mismatched=session();
  assert!(recover_durable_history_or_reject(&mut mismatched,&project).is_err());
  assert!(!mismatched.history.can_undo());
  std::fs::remove_file(&journal).unwrap();
  let mut legacy=Session::new(source.project.clone()).unwrap();
  recover_durable_history_or_reject(&mut legacy,&project).unwrap();
  assert!(!legacy.history.can_undo());
  std::fs::remove_dir(&directory).unwrap();
 }
 #[test]
 fn native_history_reopens_with_linked_document_and_redo(){
  let mut source=session();
  let panel=source.project.template.panels[0].id.clone();
  let original=source.project.template.panels[0].name.clone();
  source.request(&json!({"op":"set-property","revision":0,"target":"panel","id":panel,"field":"name","value":"SAVED PANEL"})).unwrap();
  source.request(&json!({"op":"undo","revision":1})).unwrap();
  assert_eq!(source.project.template.panels[0].name,original);
  let encoded=serde_json::to_string(&source.export_history(&source.project).unwrap()).unwrap();
  let reopened:DurableHistoryV1=serde_json::from_str(&encoded).unwrap();
  let mut target=Session::new(source.project.clone()).unwrap();
  target.import_history(reopened).unwrap();
  assert!(!target.history.can_undo());assert!(target.history.can_redo());
  target.request(&json!({"op":"redo","revision":0})).unwrap();
  assert_eq!(target.project.template.panels[0].name,"SAVED PANEL");
  target.request(&json!({"op":"undo","revision":1})).unwrap();
  assert_eq!(target.project.template.panels[0].name,original);
 }
 #[test]
 fn mismatched_and_corrupt_history_cannot_replace_live_stacks(){
  let mut source=session();
  let panel=source.project.template.panels[0].id.clone();
  source.request(&json!({"op":"set-property","revision":0,"target":"panel","id":panel,"field":"name","value":"CHANGED"})).unwrap();
  let saved=source.export_history(&source.project).unwrap();
  let mut target=session();
  assert!(target.import_history(saved.clone()).is_err());
  assert!(!target.history.can_undo());
  let mut malformed=saved;
  malformed.hardware_undo.clear();
  let mut same=Session::new(source.project.clone()).unwrap();
  assert!(same.import_history(malformed).is_err());
  assert!(!same.history.can_undo());
 }
 #[test]
 fn newer_pending_same_digest_wins_but_invalid_pending_cannot_replace_committed(){
  let mut source=session();
  let panel=source.project.template.panels[0].id.clone();
  source.request(&json!({"op":"set-property","revision":0,"target":"panel","id":panel,"field":"name","value":"HISTORY ONLY"})).unwrap();
  let committed=source.export_history(&source.project).unwrap();
  // A linked history transaction can change stacks without changing project bytes.
  source.record_linked_history();
  let staged=source.export_history(&source.project).unwrap();
  assert_eq!(committed.project_digest,staged.project_digest);
  let directory=std::env::temp_dir().join(format!("exo-journal-order-{}-{:?}",std::process::id(),std::thread::current().id()));
  std::fs::create_dir_all(&directory).unwrap();
  let project=directory.join("test-project.json");
  let old=history_path(&project);
  let pending=history_path(&project.with_extension("save-next.tmp"));
  std::fs::write(&old,serde_json::to_vec(&committed).unwrap()).unwrap();
  std::thread::sleep(std::time::Duration::from_millis(1100));
  std::fs::write(&pending,serde_json::to_vec(&staged).unwrap()).unwrap();
  let mut recovered=Session::new(source.project.clone()).unwrap();
  assert!(recover_durable_history(&mut recovered,&project));
  assert_eq!(recovered.history.undo_len(),committed.history.undo_len()+1,"newer pending history must win with identical document digest");
  let committed_time=std::fs::metadata(&old).unwrap().modified().unwrap();
  std::fs::OpenOptions::new().write(true).open(&pending).unwrap()
   .set_times(std::fs::FileTimes::new().set_modified(committed_time)).unwrap();
  let mut tied=Session::new(source.project.clone()).unwrap();
  assert!(recover_durable_history(&mut tied,&project));
  assert_eq!(tied.history.undo_len(),staged.history.undo_len(),"equal modification times must retain valid pending history");
  std::fs::write(&pending,b"{broken").unwrap();
  let mut fallback=Session::new(source.project.clone()).unwrap();
  assert!(recover_durable_history(&mut fallback,&project));
  assert_eq!(fallback.history.undo_len(),committed.history.undo_len(),"invalid pending must fall back to validated committed history");
  let _=std::fs::remove_file(&pending);
  let _=std::fs::remove_file(&old);
  let _=std::fs::remove_dir(&directory);
 }
 #[test]
 fn direct_grade_transaction_links_saved_project_and_restores_history_on_failure(){
  let mut session=session();
  let mut candidate=session.project.clone();
  candidate.template.panels[0].name="GRADED TRANSACTION".into();
  let directory=std::env::temp_dir().join(format!("exo-direct-grade-{}-{:?}",std::process::id(),std::thread::current().id()));
  std::fs::create_dir_all(&directory).unwrap();
  let path=directory.join("project.json");
  let staged=directory.join("project-grade-next.tmp");
  let old_undo=session.history.undo_len();
  commit_direct_grade_with_history(&mut session,&candidate,&path,&staged).unwrap();
  assert_eq!(session.history.undo_len(),old_undo+1);
  assert_eq!(session.snapshot(false,false)["nativeCommit"],
    serde_json::to_value(&session.project.native_commit).unwrap());
  let persisted:FittingProject=serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
  let mut reopened=Session::new(persisted).unwrap();
  assert!(recover_durable_history(&mut reopened,&path));
  assert!(reopened.history.can_undo());
  assert_eq!(reopened.project.template.panels[0].name,"GRADED TRANSACTION");
  let failure=directory.join("missing-parent").join("unwritable.json");
  let initial=session.history.undo_len();
  assert!(commit_direct_grade_with_history(&mut session,&candidate,&failure,&failure.with_extension("tmp")).is_err());
  assert_eq!(session.history.undo_len(),initial,"failed disk transaction must restore linked stacks");
  let _=std::fs::remove_file(history_path(&path));
  let _=std::fs::remove_file(&path);
  let _=std::fs::remove_dir(&directory);
 }
 #[test]
 fn post_commit_history_failure_must_preserve_pending_journal_and_fence_live_native_session(){
  let mut source=session();
  let before=source.project.clone();
  let mut candidate=before.clone();
  candidate.template.panels[0].name="POST COMMIT NATIVE GRADE".into();
  let directory=std::env::temp_dir().join(format!("exo-postcommit-history-{}-{:?}",std::process::id(),std::thread::current().id()));
  std::fs::create_dir_all(&directory).unwrap();
  let file=directory.join("project.json");
  let temporary=directory.join("project-grade-next.tmp");
  // A deterministic injected failure *after* the native document's atomic
  // rename but *before* linked history promotion. This is the critical
  // power-loss interval, not an ordinary pre-commit error.
  let failure=commit_direct_grade_with_history_inner(
   &mut source,&candidate,&file,&temporary,
   ||Err("injected post-native-rename failure".into())).unwrap_err();
  assert!(failure.contains("NATIVE_PROJECT_COMMITTED_HISTORY_RECOVERY_REQUIRED"));
  assert!(source.recovery_required);
  assert_eq!(serde_json::to_value(&source.project.template).unwrap(),
    serde_json::to_value(&before.template).unwrap(),
    "live stale source cannot masquerade as committed");
  let saved:FittingProject=serde_json::from_slice(&std::fs::read(&file).unwrap()).unwrap();
  assert_eq!(saved.template.panels[0].name,"POST COMMIT NATIVE GRADE");
  let staged_history=history_path(&file.with_extension("save-next.tmp"));
  assert!(staged_history.exists(),"retain exact staged Undo after native rename");
  let stamp:DurableHistoryV1=serde_json::from_slice(&std::fs::read(&staged_history).unwrap()).unwrap();
  assert_eq!(stamp.commit.as_ref().unwrap().generation,1);
  stamp.commit.as_ref().unwrap().validate().unwrap();
  assert!(!history_path(&file).exists(),"do not manufacture a committed journal");
  for operation in [json!({"op":"snapshot"}),json!({"op":"save"}),
    json!({"op":"edit","revision":0,"command":{"kind":"RemovePanel","panel":"front"}})] {
   assert!(source.request(&operation).unwrap_err().contains("RECOVERY_REQUIRED"));
  }
  // Cold Rust must recognize the exact staged journal, including the
  // pre-commit native template and auxiliary Undo graphs.
  let mut reopened=Session::new(saved).unwrap();
  recover_durable_history_or_reject(&mut reopened,&file).unwrap();
  assert!(reopened.history.can_undo());
  assert_eq!(reopened.commit_identity,stamp.commit);
  let receipt=reopened.request(&json!({"op":"undo","revision":0})).unwrap();
  assert_eq!(receipt["revision"],1);
  assert_eq!(serde_json::to_value(&reopened.project.template).unwrap(),
    serde_json::to_value(&before.template).unwrap());
  let _=std::fs::remove_file(&staged_history);
  let _=std::fs::remove_file(&file);
  let _=std::fs::remove_dir(&directory);
 }
 #[test]
 fn native_generation_receipt_persists_v4_identity_and_rejects_forged_rollback(){
  let mut session=session();
  assert!(session.commit_identity.is_none());
  let first=NativeCommitIdentityV1::next(None).unwrap();
  first.validate().unwrap();
  assert_eq!(first.generation,1);
  let second=NativeCommitIdentityV1::next(Some(&first)).unwrap();
  assert_eq!(second.project_id,first.project_id);
  assert_eq!(second.generation,2);
  session.project.native_commit=Some(second.clone());
  let mut next=session.export_history(&session.project).unwrap();
  next.commit=Some(second.clone());
  session.import_history(next.clone()).unwrap();
  assert_eq!(session.commit_identity,Some(second));
  for forged in [
   NativeCommitIdentityV1{generation:0,..first.clone()},
   NativeCommitIdentityV1{project_id:"00000000-0000-0000-0000-000000000000".into(),..first.clone()},
   NativeCommitIdentityV1{schema_version:999,..first.clone()},
   NativeCommitIdentityV1{generation:u64::MAX,..first.clone()},
  ]{
   let mut journal=next.clone();journal.commit=Some(forged);
   assert!(session.import_history(journal).is_err());
   assert_eq!(session.commit_identity.as_ref().unwrap().generation,2);
  }
  session.project.native_commit=None;
  let mut legacy=session.export_history(&session.project).unwrap();
  legacy.commit=None;
  session.import_history(legacy).unwrap();
  assert!(session.commit_identity.is_none(),"existing legacy v1 files remain readable");
 }
 #[test]
 fn rust_reopen_rejects_aba_replay_and_cross_document_uuid_even_with_identical_polygon(){
  let first=NativeCommitIdentityV1::next(None).unwrap();
  let second=NativeCommitIdentityV1::next(Some(&first)).unwrap();
  let mut project=session().project;
  project.native_commit=Some(second.clone());
  let live=Session::new(project).unwrap();
  let valid=live.export_history(&live.project).unwrap();
  assert_eq!(valid.commit,Some(second.clone()));
  for stale in [
   Some(first),
   Some(NativeCommitIdentityV1::next(None).unwrap()),
   None,
  ] {
   let mut forged=valid.clone();
   forged.commit=stale;
   let mut reopened=Session::new(live.project.clone()).unwrap();
   assert!(reopened.import_history(forged).is_err(),
     "Rust must reject a same-template but wrong-generation/UUID Undo journal");
   assert_eq!(reopened.project.native_commit,Some(second.clone()));
  }
  let mut recovered=Session::new(live.project.clone()).unwrap();
  recovered.import_history(valid).unwrap();
  assert_eq!(recovered.commit_identity,Some(second));
 }
 #[test]
 fn two_real_direct_grade_file_commits_keep_uuid_advance_generation_and_reject_old_journal(){
  let mut writer=session();
  let directory=std::env::temp_dir().join(format!(
    "exo-durable-two-commits-{}-{:?}",std::process::id(),std::thread::current().id()));
  std::fs::create_dir_all(&directory).unwrap();
  let file=directory.join("project.json");
  let tmp=directory.join("project-grade-next.tmp");
  let mut first=writer.project.clone();
  first.template.panels[0].name="FIRST NATIVE COMMIT".into();
  commit_direct_grade_with_history(&mut writer,&first,&file,&tmp).unwrap();
  let first_saved:FittingProject=serde_json::from_slice(&std::fs::read(&file).unwrap()).unwrap();
  let first_id=first_saved.native_commit.clone().unwrap();
  assert_eq!(first_id.generation,1);
  let first_journal=std::fs::read(history_path(&file)).unwrap();
  let mut recovered=Session::new(first_saved).unwrap();
  recover_durable_history_or_reject(&mut recovered,&file).unwrap();
  let mut second=recovered.project.clone();
  second.template.panels[0].name="SECOND NATIVE COMMIT".into();
  commit_direct_grade_with_history(&mut recovered,&second,&file,&tmp).unwrap();
  let second_saved:FittingProject=serde_json::from_slice(&std::fs::read(&file).unwrap()).unwrap();
  let second_id=second_saved.native_commit.clone().unwrap();
  assert_eq!(second_id.project_id,first_id.project_id);
  assert_eq!(second_id.generation,2);
  let mut correct=Session::new(second_saved.clone()).unwrap();
  recover_durable_history_or_reject(&mut correct,&file).unwrap();
  assert_eq!(correct.commit_identity,Some(second_id.clone()));
  // Exact same candidate document with an old signed authoring journal must
  // not cold-open with the stale previous-generation Undo graph.
  std::fs::write(history_path(&file),first_journal).unwrap();
  let mut stale=Session::new(second_saved).unwrap();
  assert!(recover_durable_history_or_reject(&mut stale,&file).is_err());
  assert!(!stale.history.can_undo());
  let _=std::fs::remove_file(history_path(&file));
  let _=std::fs::remove_file(&file);
  let _=std::fs::remove_dir(&directory);
 }
}
fn field<T:DeserializeOwned>(v:&Value,k:&str)->Result<T,String>{serde_json::from_value(v.get(k).cloned().ok_or(format!("Missing {k}"))?).map_err(|e|e.to_string())}
fn authored_native_bindings(source:&marvelous_cloth::garment::template::GarmentTemplate,payload:&Value)->Result<NativeDraftPointBindings,String>{
 if !payload.as_object().is_some_and(|object|object.len()==2&&object.contains_key("measurements")&&object.contains_key("bindings")){
  return Err("Unsupported native measurement binding payload fields".into());
 }
 // Only Rust can capture the source template. The caller must never provide
 // arbitrary authoritative provenance or a stale geometry snapshot.
 let candidate:NativeDraftPointBindings=serde_json::from_value(json!({
  "version":1,"sourceTemplate":source,"measurements":payload["measurements"],"bindings":payload["bindings"]
 })).map_err(|error|error.to_string())?;
 candidate.valid_against(source)?;
 Ok(candidate)
}
/// Inverse for a saved direct numeric polar distance or one strictly scaled
/// computed distance (`direct * positive_constant`). The target must move
/// precisely along its authored unit direction. The native solver recomputes
/// every dependent chart value and grade; no inferred point coordinates or
/// replacement formula enter the six-size grade transaction.
fn infer_native_bound_polar_measurement_20261027(
 project:&FittingProject,panel_id:&str,anchor:usize,position:DVec2,
)->Result<(String,f64),String>{
 let graph=project.native_point_bindings.as_ref().ok_or("Saved native point bindings required")?;
 graph.valid_against(&project.template)?;
 if !graph.source_matches(&project.template){return Err("Stale native source graph".into())}
 let run=project.grade_run.as_ref().ok_or("Saved six-size catalog required")?;
 run.validate(&project.template)?;
 if !position.is_finite() || position.abs().max_element()>10. {return Err("Invalid target material coordinate".into())}
 let target:Vec<_>=graph.bindings.iter().filter(|rule|rule.panel_id==panel_id&&rule.point_index==anchor).collect();
 if target.len()!=1{return Err("Bound target has no unique authored native rule".into())}
 let rule=target[0];
 if rule.mode!="polar" || !rule.depends_on.is_empty(){return Err("Inverse native edit requires independent polar rule".into())}
 if graph.bindings.iter().any(|other|other.id!=rule.id && other.panel_id==panel_id && other.point_index==rule.a){
  return Err("Polar source is itself bound; ambiguous inverse measurement".into());
 }
 if graph.bindings.iter().any(|other|other.id!=rule.id && other.distance_formula!=rule.distance_formula){
  return Err("Ambiguous multiple measurement dependencies in saved grade graph".into());
 }
 let panel=project.template.panels.iter().find(|p|p.id==panel_id).ok_or("Unknown bound panel")?;
 let points=&panel.polygon.as_ref().ok_or("Missing native polygon")?.points;
 let source=*points.get(rule.a).ok_or("Missing authored polar reference")?;
 let old=*points.get(anchor).ok_or("Missing authored bound target")?;
 if anchor==rule.a || source==old{return Err("Invalid self-referential polar target".into())}
 let angle=rule.angle_deg.ok_or("Polar rule needs explicit angle")?.to_radians();
 let unit=DVec2::new(angle.cos(),angle.sin());
 let (previous,is_computed)=match graph.measurements.get(&rule.distance_formula).ok_or("Unknown polar measurement")?{
  NativeDraftMeasurement::Number(value)=>(*value,false),
  NativeDraftMeasurement::Definition(def) if def.formula.is_none()=>(def.value_mm.ok_or("Missing numeric polar measurement")?,false),
  NativeDraftMeasurement::Definition(def) if def.formula.is_some()=>{
   let evaluated=marvelous_cloth::native_measurement_formulas_20261027::evaluate_native_measurements_20261027(&graph.measurements)?;
   let computed=*evaluated.get(&rule.distance_formula).ok_or("Missing computed polar value")?;
   (computed,true)
  },
  _=>return Err("Computed measurement cannot be inferred from bound target drag".into()),
 };
 if !previous.is_finite() || previous.abs()>5000. || (old-source-unit*(previous/1000.)).length()>1e-8 {
  return Err("Bound target does not match installed direct polar measurement".into());
 }
 let delta=position-old;
 let projected=delta.dot(unit);
 if !projected.is_finite() || projected.abs()<1e-8 ||
   (delta-unit*projected).length()>1e-8 {
  return Err("Bound target movement must follow authored polar direction".into());
 }
 let inferred=previous+projected*1000.;
 if !inferred.is_finite() || inferred.abs()>5000. || inferred.abs()<1e-8 {
  return Err("Invalid inferred native measurement distance".into());
 }
 if is_computed {
  return marvelous_cloth::native_measurement_formulas_20261027::infer_scaled_direct_measurement_20261027(
   &graph.measurements,&rule.distance_formula,inferred);
 }
 Ok((rule.distance_formula.clone(),inferred))
}
fn command(v:&Value)->Result<Command,String>{
 let op=v["kind"].as_str().ok_or("Missing command kind")?;
 macro_rules! f {($k:literal)=>{field(v,$k)?}}
 Ok(match op {
 "Primitive"=>Command::Primitive{kind:match v["shape"].as_str(){Some("ellipse")=>Primitive::Ellipse,Some("sector")=>Primitive::Sector,_=>Primitive::Rectangle},size:f!("size"),sweep_degrees:v["sweep_degrees"].as_f64().unwrap_or(180.),origin:f!("origin"),meshing:MeshingSettings::default(),fabric:f!("fabric"),replace:false},
 "Polygon"=>Command::Polygon{points:f!("points"),tangents:field(v,"tangents").unwrap_or_default(),meshing:MeshingSettings::default(),fabric:f!("fabric"),replace:false},
 "Anchor"=>Command::Anchor{panel:f!("panel"),anchor:f!("anchor"),position:f!("position")},
 "AnchorGroup"=>Command::AnchorGroup{panel:f!("panel"),edits:f!("edits")},
 "MovePoints"=>Command::MovePoints{panel:f!("panel"),points:f!("points"),delta:f!("delta")},
 "Nudge"=>Command::Nudge{panel:f!("panel"),points:f!("points"),delta_mm:f!("delta_mm")},
 "SetMeasurement"=>Command::SetMeasurement{panel:f!("panel"),measurement:f!("measurement")},
 "RemoveMeasurement"=>Command::RemoveMeasurement{panel:f!("panel"),id:f!("id")},
 "Dimensions"=>Command::Dimensions{panel:f!("panel"),width:f!("width"),height:f!("height")},
 "Shape"=>Command::Shape{panel:f!("panel"),polygon:f!("polygon")},
 "SplitBoundary"=>Command::SplitBoundary{panel:f!("panel"),edge:f!("edge"),at_m:f!("at_m")},
 "DartCutSew"=>Command::DartCutSew{panel:f!("panel"),edge:f!("edge"),left_t:f!("left_t"),right_t:f!("right_t"),apex:f!("apex")},
 "TuckFoldSew"=>Command::TuckFoldSew{panel:f!("panel"),edge:f!("edge"),left_t:f!("left_t"),right_t:f!("right_t"),depth_m:f!("depth_m")},
 "RemovePoint"=>Command::RemovePoint{panel:f!("panel"),point:f!("point")},
 "CurvePoint"=>Command::CurvePoint{panel:f!("panel"),anchor:f!("anchor"),curved:f!("curved")},
 "TargetLength"=>Command::TargetLength{panel:f!("panel"),edge:f!("edge"),target_m:f!("target_m")},
 "Notch"=>Command::Notch{panel:f!("panel"),edge:f!("edge"),t:f!("t"),depth_m:f!("depth_m")},
 "NotchPair"=>Command::NotchPair{panel:f!("panel"),edge:f!("edge"),center_t:f!("center_t"),spacing_m:f!("spacing_m"),depth_m:f!("depth_m")},
 "RemoveNotch"=>Command::RemoveNotch{panel:f!("panel"),edge:f!("edge"),t:f!("t")},
 "SeamAllowance"=>Command::SeamAllowance{panel:f!("panel"),edge:f!("edge"),width_m:f!("width_m")},
 "BoardTransform"=>Command::BoardTransform{panel:f!("panel"),origin:f!("origin"),rotation_degrees:f!("rotation_degrees")},
 "Place"=>Command::Place{panel:f!("panel"),placement:f!("placement")},
 "Duplicate"=>Command::Duplicate{panel:f!("panel")},
 "RemovePanel"=>Command::RemovePanel{panel:f!("panel")},
 "Sew"=>Command::Sew{a:f!("a"),b:f!("b"),reverse:f!("reverse"),ease:f!("ease")},
 "SewMany"=>Command::SewMany{pairs:f!("pairs")},
 "SewSymmetric"=>Command::SewSymmetric{original:f!("original"),mirrored:f!("mirrored")},
 "RemoveSeam"=>Command::RemoveSeam{seam:f!("seam")},
 "Fabric"=>Command::Fabric{panel:f!("panel"),name:f!("name"),properties:f!("properties"),all_panels:f!("all_panels")},
 "Mirror"=>Command::Mirror{panel:f!("panel"),axis:if v["axis"]=="y"{MirrorAxis::Y}else{MirrorAxis::X},copy_side:field(v,"copy_side").unwrap_or(None)},
 "Boolean"=>Command::Boolean{a:f!("a"),b:f!("b"),op:match v["operation"].as_str(){Some("difference")=>BooleanOp::Difference,Some("intersection")=>BooleanOp::Intersection,_=>BooleanOp::Union},keep_tool:f!("keep_tool")},
 "ShapeBuilder"=>Command::ShapeBuilder{panel:f!("panel"),points:f!("points")},
 "InternalLine"=>Command::InternalLine{panel:f!("panel"),points:f!("points"),tangents:field(v,"tangents").unwrap_or_default()},
 "RemoveLine"=>Command::RemoveLine{panel:f!("panel"),line:f!("line")},
 "Ruffle"=>Command::Ruffle{panel:f!("panel"),line:f!("line"),width:f!("width"),ratio:f!("ratio")},
 "Annotation"=>Command::Annotation{panel:f!("panel"),id:field(v,"id").unwrap_or(None),text:f!("text"),position:f!("position")},
 "RemoveAnnotation"=>Command::RemoveAnnotation{panel:f!("panel"),id:f!("id")},
 _=>return Err(format!("Unsupported authoring command {op}")),
 })
}
#[cfg(test)]
mod native_adapter_nudge_tests {
 use super::*;
 #[test]
 fn numeric_nudge_preserves_explicit_material_millimetres(){
  let value=json!({"kind":"Nudge","panel":"front","points":[0,2],"delta_mm":[1.5,-2.25]});
  match command(&value).expect("Native Nudge authoring must be exposed"){
   Command::Nudge{panel,points,delta_mm}=>{
    assert_eq!(panel,"front");
    assert_eq!(points,vec![0,2]);
    assert_eq!(delta_mm,DVec2::new(1.5,-2.25));
   },
   _=>panic!("Native millimetre Nudge was decoded as another operation"),
  }
 }
 #[test]
 fn nudge_rejects_missing_metric_delta_or_missing_selection(){
  assert!(command(&json!({"kind":"Nudge","panel":"front","points":[0]})).is_err());
  assert!(command(&json!({"kind":"Nudge","panel":"front","delta_mm":[1.0,2.0]})).is_err());
 }
}
/// Apply a measured two-axis grade to a simple material-space pattern.
/// Named edges and point indices stay stable for sewing and undo.
fn graded_polygon(source:&marvelous_cloth::garment::polygon::PolygonPattern, width_delta_mm:f64, height_delta_mm:f64)->Result<marvelous_cloth::garment::polygon::PolygonPattern,String>{
 if ![width_delta_mm,height_delta_mm].iter().all(|v|v.is_finite() && v.abs()<=500.) {return Err("Grade increments must be finite and within ±500 mm".into())}
 if source.points.len()<3 {return Err("Grading requires a polygon with at least three points".into())}
 // A straight-sided hole belongs to material space, just like a pocket guide.
 // Before applying any affine grade, validate the actual source topology so
 // malformed holes cannot be laundered into apparently-valid graded pieces.
 if !source.holes.is_empty()||!source.lines.is_empty(){
  marvelous_cloth::garment::domain::validate(source,&source.outer_points()?)?;
 }
 // True dimension bounds include curve lobes outside their end vertices.
 // Use the same 0.25 mm conservative flattened boundary as native sewing
 // and material metrics; grading by polygon corners alone misses the lobes.
 let mut min=DVec2::splat(f64::INFINITY);
 let mut max=DVec2::splat(f64::NEG_INFINITY);
 for edge_index in 0..source.edges.len(){
  for p in source.edge_points(edge_index)? {
   min=min.min(p);
   max=max.max(p);
  }
 }
 let size=max-min;
 if !min.is_finite() || !max.is_finite() || size.min_element()<=1e-6 {return Err("Cannot grade a degenerate pattern".into())}
 let new_size=size+DVec2::new(width_delta_mm,height_delta_mm)/1000.;
 if new_size.min_element()<0.001 || new_size.max_element()>10. {return Err("Graded dimensions must be between 1 mm and 10 m".into())}
 let scale=new_size/size;
 let center=(min+max)*0.5;
 let mut result=source.clone();
 for point in &mut result.points {*point=center+(*point-center)*scale;}
 // Scale the actual native cubic controls and independent free curve anchors,
 // not a display polyline. This preserves analytic sewing edges and their
 // identity under grading, with the same affine mapping on every dependent
 // curve control. Notch depth and allowance width remain physical millimetres.
 for controls in result.curves.values_mut(){
  for point in controls.iter_mut(){*point=center+(*point-center)*scale;}
 }
 for free_points in result.free_curve_points.values_mut(){
  for point in free_points {
   point.position=center+(point.position-center)*scale;
   // These are material derivatives, not absolute anchor positions.
   // Non-uniform grade scaling must also transform *both* independently
   // adjustable handles; otherwise the Bézier profile changes on reload.
   for derivative in [&mut point.derivative,&mut point.derivative_in,&mut point.derivative_out] {
    if let Some(value)=derivative.as_mut(){*value *=scale;}
   }
  }
 }
 for annotation in &mut result.annotations {
  annotation.position=center+(annotation.position-center)*scale;
 }
 // Preserve directed hole-edge identities and geometric stations. An
 // axis-aligned affine transform with strictly positive scales preserves hole
 // winding, containment and nonintersection, but run independent validation
 // after grading because the sampled outer boundary may have curved lobes.
 for hole in &mut result.holes {
  for point in &mut hole.points {*point=center+(*point-center)*scale;}
 }
 // A named internal drafting/sewing guide is material geometry, not a 2D
 // decoration. Preserve every line ID, affine-transform every anchor and
 // independently scale every cubic tangent, just like contour Béziers.
 // Validate all source guides before accepting any edit.
 for line in &mut result.lines {
  line.samples()?; // also rejects invalid point/tangent correspondence
  for point in &mut line.points {*point=center+(*point-center)*scale;}
  for tangent in &mut line.tangents {*tangent *=scale;}
  line.samples()?;
 }
 if !result.holes.is_empty()||!result.lines.is_empty(){
  marvelous_cloth::garment::domain::validate(&result,&result.outer_points()?)?;
 }
 // Grade edge-length specifications by the actual graded physical arclength,
 // not by one Cartesian axis; this also works for anisotropically curved edges.
 // Keep the named target reference and its proportional design ease instead
 // of silently deleting an authored manufacturing constraint.
 let graded_targets=result.target_lengths.clone();
 for (edge,target) in graded_targets {
  if !target.is_finite()||target<=0. {
   return Err(format!("Cannot grade invalid target length on boundary {edge}"));
  }
  let index=source.edges.iter().position(|name|name==&edge)
   .ok_or(format!("Cannot grade a target referring to unknown boundary {edge}"))?;
  let physical_length=|p:&marvelous_cloth::garment::polygon::PolygonPattern|->Result<f64,String>{
   let points=p.edge_points(index)?;
   Ok(points.windows(2).map(|pair|pair[0].distance(pair[1])).sum::<f64>())
  };
  let old_len=physical_length(source)?;
  let next_len=physical_length(&result)?;
  if old_len<=1e-9 || !old_len.is_finite() || !next_len.is_finite() {
   return Err(format!("Cannot grade degenerate target boundary {edge}"));
  }
  result.target_lengths.insert(edge,target*(next_len/old_len));
 }
 Ok(result)
}
/// Drafting marks only: three parallel guides strictly inside a rectangular contour.
fn pleat_guide_points(source:&marvelous_cloth::garment::polygon::PolygonPattern,orientation:&str,spacing_mm:f64,inset_mm:f64)->Result<Vec<[DVec2;2]>,String>{
 if !spacing_mm.is_finite() || !(5.0..=100.0).contains(&spacing_mm) || !inset_mm.is_finite() || !(5.0..=50.0).contains(&inset_mm) {return Err("Pleat spacing must be 5–100 mm and inset 5–50 mm".into())}
 if !source.curves.is_empty() || !source.holes.is_empty() || source.points.len()!=4 {return Err("Pleat guides require a straight axis-aligned rectangular polygon without holes".into())}
 let min=source.points.iter().copied().fold(DVec2::splat(f64::INFINITY),|a,b|a.min(b));
 let max=source.points.iter().copied().fold(DVec2::splat(f64::NEG_INFINITY),|a,b|a.max(b));
 if !min.is_finite() || !max.is_finite() {return Err("Invalid rectangle points".into())}
 let tol=1e-8;
 let mut corners=std::collections::HashSet::new();
 for p in &source.points {
  let x=if (p.x-min.x).abs()<tol {0} else if (p.x-max.x).abs()<tol {1} else {return Err("Contour is not an axis-aligned rectangle".into())};
  let y=if (p.y-min.y).abs()<tol {0} else if (p.y-max.y).abs()<tol {1} else {return Err("Contour is not an axis-aligned rectangle".into())};
  if !corners.insert((x,y)) {return Err("Rectangle contains duplicate corners".into())}
 }
 if corners.len()!=4 {return Err("Rectangle requires four distinct corners".into())}
 let spacing=spacing_mm/1000.;let inset=inset_mm/1000.;
 let vertical=match orientation {"vertical"=>true,"horizontal"=>false,_=>return Err("Pleat orientation must be vertical or horizontal".into())};
 let across=if vertical {max.x-min.x}else{max.y-min.y};
 let along=if vertical {max.y-min.y}else{max.x-min.x};
 if across<=2.*(inset+spacing) || along<=2.*inset {return Err("All three fold guides must fit strictly inside the rectangle".into())}
 let center=if vertical {(min.x+max.x)*0.5}else{(min.y+max.y)*0.5};
 Ok([-1.,0.,1.].into_iter().map(|i|{
  let v=center+i*spacing;
  if vertical {[DVec2::new(v,min.y+inset),DVec2::new(v,max.y-inset)]}else{[DVec2::new(min.x+inset,v),DVec2::new(max.x-inset,v)]}
 }).collect())
}
/// Read-only, Rust-authoritative rest-space pattern diagnostics. These are
/// stitchline dimensions, NOT offset factory cutlines or approved grade rules.
/// All figures are derived from the same material-space curves used by the
/// native sewing mesh; display code never recomputes them from SVG pixels.
fn pattern_factory_audit(template:&marvelous_cloth::garment::template::GarmentTemplate,revision:u64)->Result<Value,String>{
 let mut panels=Vec::new();
 let mut warnings=Vec::<String>::new();
 let mut lengths=std::collections::BTreeMap::<(String,String),f64>::new();
 let mut polygon_count=0usize;
 for panel in &template.panels {
  let Some(polygon)=panel.polygon.as_ref() else {
   warnings.push(format!("{} has no editable polygon contour",panel.name));
   panels.push(json!({"panelId":panel.id,"name":panel.name,"editable":false}));
   continue;
  };
  polygon_count+=1;
  let mut outline=Vec::<DVec2>::new();
  let mut edges=Vec::new();
  for (i,edge) in polygon.edges.iter().enumerate(){
   let points=polygon.edge_points(i)?;
   if points.len()<2 || points.iter().any(|point|!point.is_finite()){
    return Err(format!("Invalid sampled geometry on {} / {}",panel.id,edge))
   }
   let length:f64=points.windows(2).map(|w|w[0].distance(w[1])).sum();
   if !length.is_finite()||length<=1e-8 {return Err(format!("Collapsed boundary {} / {}",panel.id,edge));}
   // Independent, bounded source-Bézier measurement. Mesh/seam/marker stations
   // still follow the existing sampled arclength: the read-only comparison
   // surfaces curvature precision debt without silently moving user geometry.
   let precise=marvelous_cloth::garment::precision_curve_20261030::edge_length_bounds(
    polygon,edge,1e-5)?;
   let bias_mm=(precise.estimate_m()-length)*1000.;
   if bias_mm.abs()>0.1 {
    warnings.push(format!("{} / {} sampled curve length differs from native precision curve by {:.3} mm; review graded seam and notch stations",panel.name,edge,bias_mm));
   }
   lengths.insert((panel.id.clone(),edge.clone()),length);
   outline.extend_from_slice(&points[..points.len()-1]);
   let marks=polygon.notches.get(edge).map_or(0,Vec::len);
   if let Some(notches)=polygon.notches.get(edge){
    for notch in notches {polygon.notch_segment(edge,notch)?;}
   }
   let allowance=polygon.seam_allowances.get(edge).copied();
   let target=polygon.target_length(edge);
   if let Some(spec)=target {
    let delta_mm=(length-spec).abs()*1000.;
    if delta_mm>0.5 {warnings.push(format!("{} / {} target length differs from rest boundary by {:.2} mm",panel.name,edge,delta_mm));}
   }
   edges.push(json!({"edgeId":edge,"lengthMm":length*1000.,
    "precisionLengthMm":precise.estimate_m()*1000.,
    "precisionUncertaintyMm":precise.max_error_m()*1000.,
    "sampledLengthBiasMm":bias_mm,
    "precisionMode":"read-only cubic length bounds; native sewn and notch stations unchanged",
    "curve":polygon.curves.contains_key(edge)||polygon.free_curve_points.contains_key(edge),
    "notchCount":marks,"allowanceMm":allowance.map(|value|value*1000.),"targetMm":target.map(|value|value*1000.)}));
  }
  if outline.len()<3{return Err(format!("Pattern {} has too few contour points",panel.id));}
  let mut signed_area=0f64;
  for i in 0..outline.len(){signed_area+=outline[i].perp_dot(outline[(i+1)%outline.len()])*0.5;}
  if !signed_area.is_finite()||signed_area<=1e-8{return Err(format!("Pattern {} has invalid contour area",panel.id));}
  let min=outline.iter().copied().fold(DVec2::splat(f64::INFINITY),|a,b|a.min(b));
  let max=outline.iter().copied().fold(DVec2::splat(f64::NEG_INFINITY),|a,b|a.max(b));
  let without_allowance=polygon.edges.iter().filter(|edge|!polygon.seam_allowances.contains_key(*edge)).count();
  let mut pom_rows=Vec::new();
  for pom in &polygon.measurements {
   let length=polygon.measurement_length(pom)?;
   let [a,b]=polygon.measurement_points(pom)?;
   pom_rows.push(json!({"id":pom.id,"label":pom.label,"lengthMm":length*1000.,
     "first":{"edge":pom.a.edge,"t":pom.a.t,"positionMm":[a.x*1000.,a.y*1000.]},
     "second":{"edge":pom.b.edge,"t":pom.b.t,"positionMm":[b.x*1000.,b.y*1000.]}}));
  }
  if without_allowance>0 {warnings.push(format!("{} has {} boundary edge(s) without authored seam allowance",panel.name,without_allowance));}
  warnings.extend(polygon.target_diagnostics().into_iter().map(|v|format!("{}: {}",panel.name,v)));
  panels.push(json!({"panelId":panel.id,"name":panel.name,"editable":true,"widthMm":(max.x-min.x)*1000.,"heightMm":(max.y-min.y)*1000.,"areaMm2":signed_area*1e6,"edgeCount":polygon.edges.len(),"curveCount":polygon.curves.len(),"freeCurvePointCount":polygon.free_curve_points.values().map(Vec::len).sum::<usize>(),"notchCount":polygon.notches.values().map(Vec::len).sum::<usize>(),"allowanceEdgeCount":polygon.seam_allowances.len(),"missingAllowanceEdges":without_allowance,"pomCount":pom_rows.len(),"measurements":pom_rows,"edges":edges}));
 }
 let mut seams=Vec::new();
 for seam in &template.seams{
  let resolve=|link:&marvelous_cloth::garment::seam::BoundaryRef|->Option<f64>{
   lengths.get(&(link.panel.clone(),link.edge.clone()?))
     .map(|length|length*(link.range[1]-link.range[0]))
  };
  let a=resolve(&seam.a);let b=resolve(&seam.b);
  let mismatch=match (a,b){(Some(a),Some(b))=>Some((a-b).abs()*1000.),_=>None};
  if let Some(mm)=mismatch {
   if mm>1.0&&!seam.allow_ease {warnings.push(format!("Sewing pair {} has {:.2} mm rest length mismatch without ease",seam.id,mm));}
  }
  seams.push(json!({"seamId":seam.id,"firstLengthMm":a.map(|v|v*1000.),"secondLengthMm":b.map(|v|v*1000.),"mismatchMm":mismatch,"allowEase":seam.allow_ease,"correspondences":seam.notches.len()}));
 }
 // Source pattern geometry is measurable, but this native path does not yet
 // produce verified joined allowance cutlines, industrial grades or AAMA/ASTM.
 // Never turn an internal source-mesh check into a manufacturer-ready badge.
 let blockers=vec![
  "No independently validated complete cutline offsets/corner joins",
  "No native industrial multi-size curve-aware grading release",
  "No independently verified AAMA/ASTM CAD or physical cutting approval",
 ];
 Ok(json!({"format":"exo-native-pattern-audit.v1","revision":revision,"units":"mm","panelCount":template.panels.len(),"editablePanelCount":polygon_count,"panels":panels,"seams":seams,"warnings":warnings,"releaseBlockers":blockers,"sourceGeometryMeasured":true,"manufacturerReady":false}))
}
#[cfg(test)]
mod native_precision_curve_audit_tests_20261030 {
 use super::*;

 #[test]
 fn audit_reports_independent_curve_length_and_keeps_editable_source_unchanged(){
  let mut template=marvelous_cloth::garment::presets::basic(GarmentKind::Tshirt,0);
  let panel=template.panels.iter_mut().find(|p|p.polygon.is_some()).unwrap();
  let polygon=panel.polygon.as_mut().unwrap();
  let edge=polygon.edges[0].clone();
  let start=polygon.points[0];let end=polygon.points[1];
  let delta=end-start;
  let normal=DVec2::new(-delta.y,delta.x).normalize();
  polygon.curves.insert(edge.clone(),[start+delta/3.+normal*0.08,
   start+delta*2./3.+normal*0.08]);
  let panel_id=panel.id.clone();
  let before=serde_json::to_string(&template).unwrap();
  let report=pattern_factory_audit(&template,11).unwrap();
  assert_eq!(report["format"],"exo-native-pattern-audit.v1");
  assert_eq!(report["manufacturerReady"],false);
  let rows=report["panels"].as_array().unwrap();
  let matching=rows.iter().find(|row|row["panelId"]==panel_id).unwrap();
  let measured=matching["edges"].as_array().unwrap().iter()
   .find(|row|row["edgeId"]==edge).unwrap();
  let coarse=measured["lengthMm"].as_f64().unwrap();
  let precise=measured["precisionLengthMm"].as_f64().unwrap();
  let uncertainty=measured["precisionUncertaintyMm"].as_f64().unwrap();
  let bias=measured["sampledLengthBiasMm"].as_f64().unwrap();
  assert!(precise>0. && coarse>0. && precise>=coarse-0.01);
  assert!((precise-coarse-bias).abs()<1e-8);
  assert!(uncertainty<=0.005001);
  assert_eq!(serde_json::to_string(&template).unwrap(),before);
 }
}
#[cfg(test)]
mod native_multi_panel_session_20261030_tests {
 use super::*;
 use marvelous_cloth::garment::shapes;

 fn session()->Session{
  let avatar=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/makehuman/mannequin.obj");
  let mut p=FittingProject::basic(GarmentKind::Tshirt,0,avatar);
  p.template.seams.clear();p.template.panels.truncate(2);
  for panel in &mut p.template.panels {
   panel.pins.clear();panel.pin_points.clear();
   panel.polygon=Some(shapes::primitive(Primitive::Rectangle,DVec2::new(0.4,0.25),
     180.,Default::default()).unwrap());
   panel.pattern.width=0.4;panel.pattern.height=0.25;
  }
  Session::new(p).unwrap()
 }

 #[test]
 fn native_two_panel_chart_is_one_undo_redo_and_saved_geometry_revision(){
  let mut s=session();
  let panels=s.project.template.panels.iter().map(|p|p.id.clone()).collect::<Vec<_>>();
  let binding=panels.iter().flat_map(|id|vec![
   json!({"id":format!("{id}_width"),"panelId":id,"pointIndex":1,
     "mode":"polar","a":0,"b":0,"distanceFormula":"halfWidth","angleDeg":0}),
   json!({"id":format!("{id}_corner"),"panelId":id,"pointIndex":2,
     "mode":"polar","a":1,"b":0,"distanceFormula":"height","angleDeg":90,
     "dependsOn":[format!("{id}_width")]}),
  ]).collect::<Vec<_>>();
  let stored=s.request(&json!({"op":"bindings-store","revision":0,
   "nativeBindings":{"measurements":{"chest":{"valueMm":800},
     "halfWidth":{"formula":"chest / 2"},"height":{"valueMm":250}},
     "bindings":binding}})).unwrap();
  assert_eq!(stored["revision"],1);
  let before=serde_json::to_string(&s.project.template).unwrap();
  let request=json!({"op":"bindings-multipanel-measurement-recompute",
   "revision":1,"measurement":"chest","expectedValueMm":800.,"valueMm":840.});
  let response=s.request(&request).unwrap();
  assert_eq!(response["revision"],2);
  assert_eq!(response["nativeMeasurementRecompute"]["panelCount"],2);
  assert_eq!(response["nativeMeasurementRecompute"]["correctedBindingIds"].as_array().unwrap().len(),4);
  assert_eq!(response["nativeMeasurementRecompute"]["oneUndoStep"],true);
  for id in &panels {
   let poly=s.project.template.panels.iter().find(|p|p.id==*id).unwrap().polygon.as_ref().unwrap();
   assert!((poly.points[1].x-poly.points[0].x-0.42).abs()<1e-8);
   assert!((poly.points[2].x-poly.points[1].x).abs()<1e-8);
  }
  let committed=serde_json::to_string(&s.project.template).unwrap();
  let faulty=json!({"op":"bindings-multipanel-measurement-recompute","revision":2,
    "measurement":"chest","expectedValueMm":840.,"valueMm":860.,
    "dependentPosition":[0.5,0.3]});
  assert!(s.request(&faulty).is_err());
  assert_eq!(s.revision,2);
  assert_eq!(serde_json::to_string(&s.project.template).unwrap(),committed);
  s.request(&json!({"op":"undo","revision":2})).unwrap();
  assert_eq!(serde_json::to_string(&s.project.template).unwrap(),before);
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["measurements"]["chest"]["valueMm"],800.);
  s.request(&json!({"op":"redo","revision":3})).unwrap();
  assert_eq!(serde_json::to_string(&s.project.template).unwrap(),committed);
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["measurements"]["chest"]["valueMm"],840.);
  // The real save RPC obtains its filename from the child process command
  // line; this unit test has none. Verify project codec roundtrip here.
  let json=serde_json::to_value(&s.project).unwrap();
  let reopened:FittingProject=serde_json::from_value(json).unwrap();
  assert_eq!(serde_json::to_string(&reopened.template).unwrap(),committed);
  assert_eq!(serde_json::to_value(&reopened.native_point_bindings.unwrap().measurements["chest"]).unwrap(),
    json!({"valueMm":840.}));
 }
}
/// ASCII DXF R2000 engineering handoff with explicit millimetre header.
/// CUT_EXO is a single closed polyline and NOTCH_EXO comprises separate
/// projected notch mark lines. Not AAMA/ASTM graded interchange or cutter QA.
fn dxf_safe_label(s:&str)->String {
 s.chars().filter(|c| !c.is_control() && *c!='\\' ).take(120).collect()
}
fn xml_safe_label(s:&str)->String {
 s.chars().filter(|c|!c.is_control()).take(120).collect::<String>()
  .replace('&',"&amp;").replace('<',"&lt;").replace('>',"&gt;")
  .replace('"',"&quot;").replace('\'',"&apos;")
}
fn native_cutline_dxf(line:&marvelous_cloth::garment::cutline::ProductionCutline,
 polygon:&marvelous_cloth::garment::polygon::PolygonPattern,name:&str)->Result<String,String>{
 let mut out=String::from("0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$INSUNITS\n70\n4\n9\n$MEASUREMENT\n70\n1\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n");
 out.push_str("999\nEXO QA CUTLINE PROOF - verify metric scale, not factory approved\n0\nLWPOLYLINE\n8\nCUT_EXO\n");
 out.push_str(&format!("90\n{}\n70\n1\n",line.points.len()));
 for p in &line.points {
  out.push_str(&format!("10\n{:.6}\n20\n{:.6}\n",p.x*1000.,p.y*1000.));
 }
 for n in &line.notches {
  out.push_str(&format!("0\nLINE\n8\nNOTCH_EXO\n10\n{:.6}\n20\n{:.6}\n11\n{:.6}\n21\n{:.6}\n",n.cut_start.x*1000.,n.cut_start.y*1000.,n.inner_end.x*1000.,n.inner_end.y*1000.));
 }
 // Sew contour is independent from the offset cutline, with a distinct layer.
 // Use LINE entities, not a second closed LWPOLYLINE: pattern importers must
 // never mistake a sew contour for a second garment piece.
 for i in 0..polygon.edges.len(){
  for pair in polygon.edge_points(i)?.windows(2){
   out.push_str(&format!("0\nLINE\n8\nSTITCH_EXO\n10\n{:.6}\n20\n{:.6}\n11\n{:.6}\n21\n{:.6}\n",pair[0].x*1000.,pair[0].y*1000.,pair[1].x*1000.,pair[1].y*1000.));
  }
 }
 let cx=line.points.iter().map(|p|p.x).sum::<f64>()/line.points.len() as f64*1000.;
 let cy=line.points.iter().map(|p|p.y).sum::<f64>()/line.points.len() as f64*1000.;
 out.push_str(&format!("0\nTEXT\n8\nLABEL_EXO\n10\n{cx:.6}\n20\n{cy:.6}\n40\n5\n1\n{}\n",dxf_safe_label(name)));
 for pom in &polygon.measurements {
  let [a,b]=polygon.measurement_points(pom)?;
  let label=format!("{} {:.2} mm",pom.label,a.distance(b)*1000.);
  out.push_str(&format!("0\nLINE\n8\nPOM_EXO\n10\n{:.6}\n20\n{:.6}\n11\n{:.6}\n21\n{:.6}\n",a.x*1000.,a.y*1000.,b.x*1000.,b.y*1000.));
  out.push_str(&format!("0\nTEXT\n8\nPOM_LABEL_EXO\n10\n{:.6}\n20\n{:.6}\n40\n3\n1\n{}\n",(a.x+b.x)*500.,(a.y+b.y)*500.,dxf_safe_label(&label)));
 }
 out.push_str("0\nENDSEC\n0\nEOF\n");
 Ok(out)
}
/// Strictly read-only material-metric cutting geometry produced by the Rust
/// cutline kernel. Unsupported panel topology is returned as a blocked row,
/// never downgraded to the un-offset stitch contour or silently omitted.
fn native_production_cutlines(template:&marvelous_cloth::garment::template::GarmentTemplate,revision:u64,filter:Option<&str>)->Result<Value,String>{
 use marvelous_cloth::garment::cutline::production_cutline;
 if let Some(id)=filter{
  if !template.panels.iter().any(|p|p.id==id){return Err("Selected production cutline panel not found".into())}
 }
 let mut records=Vec::new();
 let mut good=0usize; let mut blocked=0usize;
 for panel in template.panels.iter().filter(|p|filter.is_none_or(|id|p.id==id)) {
  let polygon=match panel.polygon.as_ref(){
   Some(v)=>v,
   None=>{records.push(json!({"panelId":panel.id,"name":panel.name,"ok":false,"error":"No editable polygon for this panel"}));blocked+=1;continue}
  };
  match production_cutline(polygon){
   Ok(result)=>{
    if result.points.len()<3||result.points.len()>8192{return Err("Cutline exceeded the export point budget".into())}
    let metric:Vec<[f64;2]>=result.points.iter().map(|p|[p.x*1000.,p.y*1000.]).collect();
    let min=result.points.iter().copied().fold(DVec2::splat(f64::INFINITY),|a,b|a.min(b));
    let max=result.points.iter().copied().fold(DVec2::splat(f64::NEG_INFINITY),|a,b|a.max(b));
    let margin=10.;
    let origin=DVec2::new(min.x*1000.-margin,min.y*1000.-margin);
    let size=(max-min)*1000.+DVec2::splat(margin*2.);
    if !size.is_finite()||size.min_element()<=0.||size.max_element()>20_000. {return Err("Unsafe cutline print bounds".into())}
    // Physical mm lengths are written by Rust. Consumers must still disable
    // application/print-dialog scaling and measure a physical test page.
    let points=result.points.iter()
      .map(|p|format!("{:.6},{:.6}",p.x*1000.,p.y*1000.))
      .collect::<Vec<_>>().join(" ");
    let notch_marks=result.notches.iter().map(|n|{
      format!(r##"<path d="M {:.6} {:.6} L {:.6} {:.6}" fill="none" stroke="#c0392b" stroke-width="0.2"/>"##,
        n.cut_start.x*1000.,n.cut_start.y*1000.,n.inner_end.x*1000.,n.inner_end.y*1000.)
    }).collect::<Vec<_>>().join("");
    let stitch_paths=polygon.edges.iter().enumerate().map(|(i,_)|{
     polygon.edge_points(i).map(|points|format!(r##"<polyline data-pattern-role="stitch" points="{}" fill="none" stroke="#24718a" stroke-width="0.2"/>"##,
      points.iter().map(|p|format!("{:.6},{:.6}",p.x*1000.,p.y*1000.)).collect::<Vec<_>>().join(" ")))
    }).collect::<Result<Vec<_>,_>>()?.join("");
    let mut pom_rows=Vec::new();
    let mut pom_svg=String::new();
    for pom in &polygon.measurements{
     let [a,b]=polygon.measurement_points(pom)?;
     let length_mm=a.distance(b)*1000.;
     pom_rows.push(json!({"id":pom.id,"label":pom.label,"startMm":[a.x*1000.,a.y*1000.],"endMm":[b.x*1000.,b.y*1000.],"lengthMm":length_mm}));
     pom_svg.push_str(&format!(r##"<line data-pattern-role="pom" x1="{:.6}" y1="{:.6}" x2="{:.6}" y2="{:.6}" stroke="#7252a0" stroke-width="0.2"/><text x="{:.6}" y="{:.6}" font-size="3" fill="#7252a0">{} {:.2} mm</text>"##,
      a.x*1000.,a.y*1000.,b.x*1000.,b.y*1000.,(a.x+b.x)*500.,(a.y+b.y)*500.,xml_safe_label(&pom.label),length_mm));
    }
    let label_x=(min.x+max.x)*500.;
    let label_y=(min.y+max.y)*500.;
    let svg=format!(r#"<svg xmlns="http://www.w3.org/2000/svg" width="{:.6}mm" height="{:.6}mm" viewBox="{:.6} {:.6} {:.6} {:.6}"><title>EXO engineering cutline and notch marking proof, NOT factory approved</title><path d="M {} Z" fill="none" stroke="black" stroke-width="0.2"/>{}{}<text data-pattern-role="piece-label" x="{:.6}" y="{:.6}" font-size="5">{}</text>{}</svg>"#,
      size.x,size.y,origin.x,origin.y,size.x,size.y,
      points.replace(' '," L ").replace(','," "),notch_marks,stitch_paths,label_x,label_y,xml_safe_label(&panel.name),pom_svg);
    let notches_mm:Vec<Value>=result.notches.iter().map(|n|json!({"edgeId":n.edge_id,"t":n.t,"depthMm":n.depth_m*1000.,"cutStartMm":[n.cut_start.x*1000.,n.cut_start.y*1000.],"innerEndMm":[n.inner_end.x*1000.,n.inner_end.y*1000.]})).collect();
    good+=1;
    let dxf=native_cutline_dxf(&result,polygon,&panel.name)?;
    records.push(json!({"panelId":panel.id,"name":panel.name,"ok":true,"units":"mm","pointsMm":metric,"pointCount":metric.len(),"edges":result.edges,"notchMarksMm":notches_mm,"notchMarkCount":result.notches.len(),"pomMarksMm":pom_rows,"stitchLayer":"STITCH_EXO","pointCountStitch":polygon.edges.len(),"perimeterMm":result.perimeter_m*1000.,"areaMm2":result.area_m2*1_000_000.,"svg":svg,"dxf":dxf,"factoryApproved":false}));
   }
   Err(reason)=>{blocked+=1;records.push(json!({"panelId":panel.id,"name":panel.name,"ok":false,"error":reason}));}
  }
 }
 Ok(json!({"format":"exo-native-cutline-proof.v1","revision":revision,"units":"mm","generatedCount":good,"blockedCount":blocked,"panels":records,"factoryApproved":false,"printCalibrationRequired":true,"note":"Rust ASCII DXF and SVG are engineering proofs, not graded AAMA/ASTM interchange. External CAD layer import, notch cutter configuration and physical-scale validation are release gates."}))
}
#[cfg(test)]
mod grade_tests {
 use super::*;
 use marvelous_cloth::garment::polygon::PolygonPattern;
 #[test]
 fn persistent_pom_grades_with_stable_named_material_stations(){
  use marvelous_cloth::garment::polygon::{MeasurementAnchor,PatternMeasurement};
  let mut source:PolygonPattern=serde_json::from_value(json!({
   "points":[[0.,0.],[0.2,0.],[0.2,0.1],[0.,0.1]],
   "edges":["top","right","bottom","left"],"subdivisions":2
  })).unwrap();
  source.measurements.push(PatternMeasurement{
   id:"across-body".into(),label:"Body width".into(),
   a:MeasurementAnchor{edge:"left".into(),t:0.5},
   b:MeasurementAnchor{edge:"right".into(),t:0.5},
  });
  let original=source.measurement_length(&source.measurements[0]).unwrap();
  assert!((original-0.2).abs()<1e-9);
  let graded=graded_polygon(&source,20.,10.).unwrap();
  assert_eq!(graded.measurements,source.measurements);
  assert!((graded.measurement_length(&graded.measurements[0]).unwrap()-0.22).abs()<1e-9);
  let restored:PolygonPattern=serde_json::from_str(&serde_json::to_string(&graded).unwrap()).unwrap();
  assert_eq!(restored.measurements,graded.measurements);
 }
 #[test]
 fn grade_preserves_named_edges_and_exact_metric_delta() {
  let mut p:PolygonPattern=serde_json::from_value(json!({"points":[[0.,0.],[0.2,0.],[0.2,0.1],[0.,0.1]],"edges":["top","right","bottom","left"],"subdivisions":2})).unwrap();
  p.target_lengths.insert("top".into(),0.2);
  let q=graded_polygon(&p,20.,-10.).unwrap();
  assert_eq!(p.edges,q.edges);
  assert!((q.points[1].x-q.points[0].x-0.22).abs()<1e-12);
  assert!((q.points[2].y-q.points[1].y-0.09).abs()<1e-12);
  assert!((q.target_lengths["top"]-0.22).abs()<1e-10,
    "An authored target must be scaled and preserved, never silently cleared");
  assert_eq!(p.target_lengths.get("top"),Some(&0.2));
  let reopened:PolygonPattern=serde_json::from_str(&serde_json::to_string(&q).unwrap()).unwrap();
  assert_eq!(reopened.points,q.points);
 }
 #[test]
 fn grade_rejects_collapse_and_nonfinite_delta_without_mutation() {
  let p:PolygonPattern=serde_json::from_value(json!({"points":[[0.,0.],[0.2,0.],[0.2,0.1],[0.,0.1]],"edges":["a","b","c","d"],"subdivisions":2})).unwrap();
  assert!(graded_polygon(&p,0.,-100.).is_err());
  assert!(graded_polygon(&p,f64::NAN,10.).is_err());
  assert_eq!(p.points[1].x,0.2);
 }
 #[test]
 fn affine_grade_preserves_actual_cubic_controls_and_notch_allowance_mm(){
  use marvelous_cloth::garment::polygon::{EdgeNotch,FreeCurvePoint,PatternAnnotation};
  let mut p:PolygonPattern=serde_json::from_value(json!({"points":[[0.,0.],[0.2,0.],[0.2,0.1],[0.,0.1]],"edges":["top","right","bottom","left"],"subdivisions":2})).unwrap();
  p.curves.insert("top".into(),[DVec2::new(0.05,-0.025),DVec2::new(0.15,-0.025)]);
  p.free_curve_points.insert("top".into(),vec![FreeCurvePoint{id:"f1".into(),t:0.5,position:DVec2::new(0.1,-0.028),mirror_group:None,derivative:None, derivative_in:None, derivative_out:None,}]);
  p.notches.insert("top".into(),vec![EdgeNotch{t:0.25,depth_m:0.004}]);
  p.seam_allowances.insert("top".into(),0.01);
  p.annotations.push(PatternAnnotation{id:"note".into(),text:"QA".into(),position:DVec2::new(0.1,0.05)});
  let mut min=DVec2::splat(f64::INFINITY);
  let mut max=DVec2::splat(f64::NEG_INFINITY);
  for i in 0..p.edges.len(){for point in p.edge_points(i).unwrap(){
   min=min.min(point);max=max.max(point);
  }}
  let scale=((max-min)+DVec2::new(0.02,0.01))/(max-min);
  let center=(min+max)*0.5;
  let affine=|point:DVec2|center+(point-center)*scale;
  let q=graded_polygon(&p,20.,10.).unwrap();
  assert_eq!(q.edges,p.edges);
  assert_eq!(q.notches,p.notches);
  assert_eq!(q.seam_allowances,p.seam_allowances);
  assert_eq!(q.free_curve_points["top"][0].id,"f1");
  assert_eq!(q.free_curve_points["top"][0].t,0.5);
  assert!((q.curves["top"][0]-affine(p.curves["top"][0])).length()<1e-12);
  assert!((q.free_curve_points["top"][0].position-affine(p.free_curve_points["top"][0].position)).length()<1e-12);
  assert!((q.annotations[0].position-affine(p.annotations[0].position)).length()<1e-12);
  let path=q.edge_points(0).expect("Sample native graded free Bézier");
  assert!(path.len()>3);
  assert!(path.iter().all(|v|v.is_finite()));
  assert_eq!(serde_json::from_str::<PolygonPattern>(&serde_json::to_string(&q).unwrap()).unwrap().curves,q.curves);
 }
 #[test]
 fn graded_independent_bezier_handles_preserve_affine_geometry_and_specs(){
  use marvelous_cloth::garment::polygon::{EdgeNotch,FreeCurvePoint};
  let mut original:PolygonPattern=serde_json::from_value(json!({
   "points":[[0.,0.],[0.2,0.],[0.2,0.16],[0.,0.16]],
   "edges":["top","right","bottom","left"],"subdivisions":2
  })).unwrap();
  original.curves.insert("top".into(),[DVec2::new(0.045,-0.05),DVec2::new(0.15,-0.05)]);
  original.free_curve_points.insert("top".into(),vec![FreeCurvePoint{
   id:"shoulder_knot".into(),t:0.4,position:DVec2::new(0.08,-0.033),
   derivative:Some(DVec2::new(0.2,0.02)),
   derivative_in:Some(DVec2::new(0.13,-0.045)),
   derivative_out:Some(DVec2::new(0.15,0.075)),mirror_group:None
  }]);
  original.notches.insert("top".into(),vec![EdgeNotch{t:0.24,depth_m:0.006}]);
  original.seam_allowances.insert("top".into(),0.012);
  let original_len=|p:&PolygonPattern|p.edge_points(0).unwrap().windows(2)
    .map(|seg|seg[0].distance(seg[1])).sum::<f64>();
  let old_len=original_len(&original);
  original.target_lengths.insert("top".into(),old_len*1.02);
  let mut min=DVec2::splat(f64::INFINITY);
  let mut max=DVec2::splat(f64::NEG_INFINITY);
  for i in 0..original.edges.len(){
   for point in original.edge_points(i).unwrap(){min=min.min(point);max=max.max(point)}
  }
  assert!(min.y < -0.02,"The test must have a lobe outside its vertices");
  let old_size=max-min;
  let scale=(old_size+DVec2::new(0.025,0.017))/old_size;
  let center=(min+max)*0.5;
  let graded=graded_polygon(&original,25.,17.).unwrap();
  let expected=|point:DVec2|center+(point-center)*scale;
  let new_len=original_len(&graded);
  let knot=&graded.free_curve_points["top"][0];
  let old=&original.free_curve_points["top"][0];
  for (got,wanted) in [
   (knot.position,expected(old.position)),
   (knot.derivative.unwrap(),old.derivative.unwrap()*scale),
   (knot.derivative_in.unwrap(),old.derivative_in.unwrap()*scale),
   (knot.derivative_out.unwrap(),old.derivative_out.unwrap()*scale),
  ]{assert!((got-wanted).length()<1e-11,"Scaled independent tangent or position changed");}
  for (before,after) in original.edge_points(0).unwrap().iter().zip(graded.edge_points(0).unwrap()){
   assert!((after-expected(*before)).length()<0.0007,
    "Full Bézier shape must undergo the same material-space affine transform");
  }
  assert_eq!(graded.notches,original.notches);
  assert_eq!(graded.seam_allowances,original.seam_allowances);
  assert!((graded.target_lengths["top"]/new_len-1.02).abs()<1e-10);
  let reopened:PolygonPattern=serde_json::from_str(&serde_json::to_string(&graded).unwrap()).unwrap();
  assert_eq!(reopened.target_lengths,graded.target_lengths);
  assert_eq!(reopened.free_curve_points["top"][0].derivative_in,knot.derivative_in);
  assert_eq!(reopened.free_curve_points["top"][0].derivative_out,knot.derivative_out);
 }
 #[test]
 fn invalid_or_orphaned_grade_target_fails_closed_without_losing_references(){
  let mut pattern:marvelous_cloth::garment::polygon::PolygonPattern=serde_json::from_value(json!({
   "points":[[0.,0.],[0.2,0.],[0.2,0.1],[0.,0.1]],
   "edges":["top","right","bottom","left"],"subdivisions":2
  })).unwrap();
  pattern.target_lengths.insert("top".into(),f64::NAN);
  assert!(graded_polygon(&pattern,15.,10.).is_err());
  assert!(pattern.target_lengths["top"].is_nan());
  pattern.target_lengths.remove("top");
  pattern.target_lengths.insert("missing_edge".into(),0.2);
  assert!(graded_polygon(&pattern,15.,10.).is_err());
  assert_eq!(pattern.target_lengths["missing_edge"],0.2);
 }
 #[test]
 fn graded_internal_bezier_guides_preserve_identity_points_and_tangents(){
  let source:marvelous_cloth::garment::polygon::PolygonPattern=
    serde_json::from_value(json!({
      "points":[[0.,0.],[0.3,0.],[0.3,0.2],[0.,0.2]],
      "edges":["bottom","right","top","left"],
      "subdivisions":2,
      "lines":[{"id":"pocket-placement",
        "points":[[0.04,0.04],[0.22,0.16]],
        "tangents":[[0.02,0.0],[-0.015,0.01]]}]
    })).unwrap();
  let before=serde_json::to_string(&source).unwrap();
  let result=graded_polygon(&source,30.,-20.).unwrap();
  let sx=1.1;
  let sy=0.9;
  let center=DVec2::new(0.15,0.10);
  let mapped=|p:DVec2|center+(p-center)*DVec2::new(sx,sy);
  assert_eq!(result.lines.len(),1);
  assert_eq!(result.lines[0].id,"pocket-placement");
  assert!((result.lines[0].points[0]-mapped(source.lines[0].points[0])).length()<1e-12);
  assert!((result.lines[0].points[1]-mapped(source.lines[0].points[1])).length()<1e-12);
  assert!((result.lines[0].tangents[0]-source.lines[0].tangents[0]*DVec2::new(sx,sy)).length()<1e-12);
  assert!((result.lines[0].tangents[1]-source.lines[0].tangents[1]*DVec2::new(sx,sy)).length()<1e-12);
  assert!(result.lines[0].samples().unwrap().len()>2);
  assert_eq!(serde_json::to_string(&source).unwrap(),before);
  let reopened:marvelous_cloth::garment::polygon::PolygonPattern=
     serde_json::from_str(&serde_json::to_string(&result).unwrap()).unwrap();
  assert_eq!(reopened.lines[0].id,result.lines[0].id);
  assert_eq!(reopened.lines[0].points,result.lines[0].points);
  assert_eq!(reopened.lines[0].tangents,result.lines[0].tangents);
 }
 #[test]
 fn malformed_internal_guide_blocks_grade_without_mutating_source(){
  let mut p:marvelous_cloth::garment::polygon::PolygonPattern=
    serde_json::from_value(json!({
      "points":[[0.,0.],[0.3,0.],[0.3,0.2],[0.,0.2]],
      "edges":["bottom","right","top","left"],"subdivisions":2,
      "lines":[{"id":"bad","points":[[0.04,0.04],[0.22,0.16]],
                "tangents":[[0.01,0.01]]}]
    })).unwrap();
  let before=serde_json::to_string(&p).unwrap();
  assert!(graded_polygon(&p,20.,10.).is_err());
  assert_eq!(serde_json::to_string(&p).unwrap(),before);
  p.lines.clear();
  p.holes.push(serde_json::from_value(json!({
    "points":[[0.05,0.05],[0.08,0.05],[0.08,0.08]],
    "edges":["h1","h2","h3"]
  })).unwrap());
  assert!(graded_polygon(&p,20.,10.).is_err());
 }
 #[test]
 fn graded_straight_hole_and_internal_guide_keep_physical_identity_and_shape(){
  use marvelous_cloth::garment::domain;
  let source:marvelous_cloth::garment::polygon::PolygonPattern=serde_json::from_value(json!({
    "points":[[0.,0.],[0.3,0.],[0.3,0.2],[0.,0.2]],
    "edges":["bottom","right","top","left"],"subdivisions":2,
    "holes":[{"points":[[0.05,0.06],[0.05,0.10],[0.09,0.10],[0.09,0.06]],
      "edges":["hole-left","hole-bottom","hole-right","hole-top"]}],
    "lines":[{"id":"pocket-rail","points":[[0.15,0.04],[0.25,0.15]],"tangents":[[0.02,0.0],[-0.01,0.01]]}]
  })).unwrap();
  domain::validate(&source,&source.outer_points().unwrap()).unwrap();
  let original=serde_json::to_string(&source).unwrap();
  let next=graded_polygon(&source,30.,-20.).unwrap();
  domain::validate(&next,&next.outer_points().unwrap()).unwrap();
  assert_eq!(next.holes[0].edges,source.holes[0].edges);
  assert_eq!(next.lines[0].id,source.lines[0].id);
  let center=DVec2::new(0.15,0.10);
  let scale=DVec2::new(1.1,0.9);
  for (a,b) in source.holes[0].points.iter().zip(next.holes[0].points.iter()){
    assert!((*b-(center+(*a-center)*scale)).length()<1e-12);
  }
  assert_eq!(serde_json::to_string(&source).unwrap(),original);
  let roundtrip:marvelous_cloth::garment::polygon::PolygonPattern=
    serde_json::from_str(&serde_json::to_string(&next).unwrap()).unwrap();
  assert_eq!(roundtrip.holes[0].edges,source.holes[0].edges);
  assert_eq!(roundtrip.holes[0].points,next.holes[0].points);
  assert_eq!(roundtrip.lines[0].tangents,next.lines[0].tangents);
 }
}
#[cfg(test)]
mod pleat_tests {
 use super::*;
 use marvelous_cloth::garment::polygon::PolygonPattern;
 fn rectangle()->PolygonPattern {serde_json::from_value(json!({"points":[[0.,0.],[0.3,0.],[0.3,0.2],[0.,0.2]],"edges":["top","right","bottom","left"],"subdivisions":2})).unwrap()}
 #[test]
 fn three_parallel_guides_fit_inside_and_survive_serialization() {
  let p=rectangle();
  for orientation in ["vertical","horizontal"] {
   let guides=pleat_guide_points(&p,orientation,20.,10.).unwrap();
   assert_eq!(guides.len(),3);
   for endpoints in guides {
    for point in endpoints {assert!(point.x>0. && point.x<0.3 && point.y>0. && point.y<0.2);}
    if orientation=="vertical" {assert_eq!(endpoints[0].x,endpoints[1].x)}else{assert_eq!(endpoints[0].y,endpoints[1].y)}
   }
  }
  let reopened:PolygonPattern=serde_json::from_str(&serde_json::to_string(&p).unwrap()).unwrap();
  assert_eq!(reopened.edges,p.edges);
 }
 #[test]
 fn rejects_invalid_spacing_orientation_and_non_rectangle() {
  let p=rectangle();
  assert!(pleat_guide_points(&p,"vertical",f64::NAN,10.).is_err());
  assert!(pleat_guide_points(&p,"diagonal",20.,10.).is_err());
  assert!(pleat_guide_points(&p,"vertical",101.,10.).is_err());
  let mut narrow=p.clone();for point in &mut narrow.points {point.x*=0.2;}
  assert!(pleat_guide_points(&narrow,"vertical",20.,20.).is_err());
  let mut skew=p.clone();skew.points[1].x+=0.01;
  assert!(pleat_guide_points(&skew,"vertical",20.,10.).is_err());
 }
}
#[cfg(test)]
mod physical_tuck_session_tests {
 use super::*;
 fn session()->Session {
  let avatar=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/makehuman/mannequin.obj");
  Session::new(FittingProject::basic(GarmentKind::Tshirt,2,avatar)).unwrap()
 }
 #[test]
 fn physical_tuck_json_maps_metric_depth_and_boundary_parameters() {
  let value=json!({"kind":"TuckFoldSew","panel":"front","edge":"hem","left_t":0.2,"right_t":0.3,"depth_m":0.02});
  match command(&value).unwrap() {
   Command::TuckFoldSew{panel,edge,left_t,right_t,depth_m}=>{
    assert_eq!(panel,"front");assert_eq!(edge,"hem");
    assert_eq!((left_t,right_t,depth_m),(0.2,0.3,0.02));
   },
   _=>panic!("Physical tuck was decoded as a nonphysical guide"),
  }
  for omitted in ["panel","edge","left_t","right_t","depth_m"] {
   let mut invalid=value.clone();invalid.as_object_mut().unwrap().remove(omitted);
   assert!(command(&invalid).is_err(),"missing {omitted} must be rejected");
  }
 }
 #[test]
 fn batch_rejects_partial_or_unsupported_edits_without_touching_session() {
  let mut session=session();
  let original=serde_json::to_value(&session.project.template).unwrap();
  let state=session.scene.state.clone();
  let panels=session.project.template.panels.clone();
  let panel=panels.iter().find(|p|p.polygon.is_some()).unwrap();
  let edge=panel.polygon.as_ref().unwrap().edges[0].clone();
  let eligible=json!({"kind":"TuckFoldSew","panel":panel.id,"edge":edge,"left_t":0.2,"right_t":0.3,"depth_m":0.01});
  let wrong=json!({"kind":"InternalLine","panel":panel.id,"points":[]});
  for commands in [json!([]),json!([eligible.clone(),wrong]),json!([eligible.clone(),{"kind":"TuckFoldSew","panel":"missing","edge":"missing","left_t":0.2,"right_t":0.3,"depth_m":0.01}])] {
   assert!(session.request(&json!({"op":"tuck-fold-sew-batch","revision":0,"commands":commands})).is_err());
   assert_eq!(serde_json::to_value(&session.project.template).unwrap(),original);
   assert_eq!(session.scene.state.x,state.x);
   assert!(!session.history.can_undo());
   assert_eq!(session.revision,0);
  }
 }
}
struct Session {project:FittingProject,scene:FittingScene,base_grade_scene:Option<FittingScene>,active_grade_size:Option<String>,base_variant_scene:Option<FittingScene>,active_variant_template:Option<marvelous_cloth::garment::GarmentTemplate>,variant_assembly_proof:Option<Value>,solver:Option<VbdSolver>,grab:Option<Grab>,live_grab:bool,history:History,commit_identity:Option<NativeCommitIdentityV1>,bindings_undo:Vec<Option<NativeDraftPointBindings>>,bindings_redo:Vec<Option<NativeDraftPointBindings>>,grade_undo:Vec<Option<PersistedGradeRun>>,grade_redo:Vec<Option<PersistedGradeRun>>,facing_undo:Vec<Option<PersistedFacingDependency>>,facing_redo:Vec<Option<PersistedFacingDependency>>,cross_undo:Vec<Option<NativeCrossPieceLink20261030>>,cross_redo:Vec<Option<NativeCrossPieceLink20261030>>,envelope_undo:Vec<Option<PersistedFabricGradeEnvelope>>,envelope_redo:Vec<Option<PersistedFabricGradeEnvelope>>,variant_undo:Vec<Option<PersistedPieceVariant>>,variant_redo:Vec<Option<PersistedPieceVariant>>,hardware_undo:Vec<Vec<ImportedHardware>>,hardware_redo:Vec<Vec<ImportedHardware>>,graphics_undo:Vec<Vec<PrintGraphic>>,graphics_redo:Vec<Vec<PrintGraphic>>,metadata_undo:Vec<Option<NativePropertyMetadataV1>>,metadata_redo:Vec<Option<NativePropertyMetadataV1>>,hardware_steps_undo:Vec<bool>,hardware_steps_redo:Vec<bool>,revision:u64,metrics:Value,recovery_required:bool, #[cfg(feature="desktop")] gpu:Option<marvelous_cloth::gpu_vbd::GpuVbd>}
impl Session {
 fn export_history(&self,project:&FittingProject)->Result<DurableHistoryV1,String>{
  Ok(DurableHistoryV1{schema_version:1,project_digest:history_digest(project)?,commit:self.commit_identity.clone(),history:self.history.clone(),
   bindings_undo:self.bindings_undo.clone(),bindings_redo:self.bindings_redo.clone(),
   grade_undo:self.grade_undo.clone(),grade_redo:self.grade_redo.clone(),
   facing_undo:self.facing_undo.clone(),facing_redo:self.facing_redo.clone(),
   cross_undo:self.cross_undo.clone(),cross_redo:self.cross_redo.clone(),
   envelope_undo:self.envelope_undo.clone(),envelope_redo:self.envelope_redo.clone(),
   variant_undo:self.variant_undo.clone(),variant_redo:self.variant_redo.clone(),
   hardware_undo:self.hardware_undo.clone(),hardware_redo:self.hardware_redo.clone(),
   graphics_undo:self.graphics_undo.clone(),graphics_redo:self.graphics_redo.clone(),
   metadata_undo:self.metadata_undo.clone(),metadata_redo:self.metadata_redo.clone(),
   hardware_steps_undo:self.hardware_steps_undo.clone(),hardware_steps_redo:self.hardware_steps_redo.clone()})
 }
 fn import_history(&mut self,mut saved:DurableHistoryV1)->Result<(),String>{
  if saved.schema_version!=1 || saved.project_digest!=history_digest(&self.project)? {
   return Err("Native Undo/Redo journal does not match the saved project".into());
  }
  if let Some(commit)=&saved.commit {commit.validate()?;}
  if saved.commit!=self.project.native_commit {
   return Err("Native project and linked history commit identities do not match".into());
  }
  let (u,r)=(saved.history.undo_len(),saved.history.redo_len());
  // Old v1 journals predate print-artwork history. Retain their legitimate
  // geometry/grade Undo stacks without inventing earlier artwork states.
  // Only an entirely absent graphics stack can be migrated this way.
  if saved.graphics_undo.is_empty() && u>0 {
   saved.graphics_undo=vec![self.project.print_graphics.clone();u];
  }
  if saved.graphics_redo.is_empty() && r>0 {
   saved.graphics_redo=vec![self.project.print_graphics.clone();r];
  }
  // Existing v1 journals did not record metadata; preserve historical Undo
  // while binding those older steps to the current validated native notes.
  if saved.metadata_undo.is_empty() && u>0 {
   saved.metadata_undo=vec![self.project.property_metadata.clone();u];
  }
  if saved.metadata_redo.is_empty() && r>0 {
   saved.metadata_redo=vec![self.project.property_metadata.clone();r];
  }
  if saved.cross_undo.is_empty() && u>0 {
   saved.cross_undo=vec![None;u];
  }
  if saved.cross_redo.is_empty() && r>0 {
   saved.cross_redo=vec![None;r];
  }
  if !saved.history.bounded() || [saved.bindings_undo.len(),saved.grade_undo.len(),saved.facing_undo.len(),
   saved.cross_undo.len(),saved.envelope_undo.len(),saved.variant_undo.len(),saved.hardware_undo.len(),saved.graphics_undo.len(),saved.metadata_undo.len(),saved.hardware_steps_undo.len()].iter().any(|len|*len!=u)
   || [saved.bindings_redo.len(),saved.grade_redo.len(),saved.facing_redo.len(),saved.envelope_redo.len(),
    saved.cross_redo.len(),saved.variant_redo.len(),saved.hardware_redo.len(),saved.graphics_redo.len(),saved.metadata_redo.len(),saved.hardware_steps_redo.len()].iter().any(|len|*len!=r) {
   return Err("Native Undo/Redo journal has inconsistent stack lengths".into());
  }
  self.history=saved.history;
  self.commit_identity=saved.commit;
  self.bindings_undo=saved.bindings_undo;self.bindings_redo=saved.bindings_redo;
  self.grade_undo=saved.grade_undo;self.grade_redo=saved.grade_redo;
  self.facing_undo=saved.facing_undo;self.facing_redo=saved.facing_redo;
  self.cross_undo=saved.cross_undo;self.cross_redo=saved.cross_redo;
  self.envelope_undo=saved.envelope_undo;self.envelope_redo=saved.envelope_redo;
  self.variant_undo=saved.variant_undo;self.variant_redo=saved.variant_redo;
  self.hardware_undo=saved.hardware_undo;self.hardware_redo=saved.hardware_redo;
  self.graphics_undo=saved.graphics_undo;self.graphics_redo=saved.graphics_redo;
  self.metadata_undo=saved.metadata_undo;self.metadata_redo=saved.metadata_redo;
  self.hardware_steps_undo=saved.hardware_steps_undo;self.hardware_steps_redo=saved.hardware_steps_redo;
  Ok(())
 }
 fn new(project:FittingProject)->Result<Self,String>{
 let commit_identity=project.native_commit.clone();
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
 Ok(Self{project,scene,base_grade_scene:None,active_grade_size:None,active_variant_template:None,base_variant_scene:None,variant_assembly_proof:None,solver:None,grab:None,live_grab:false,history:History::default(),commit_identity,bindings_undo:Vec::new(),bindings_redo:Vec::new(),grade_undo:Vec::new(),grade_redo:Vec::new(),facing_undo:Vec::new(),facing_redo:Vec::new(),cross_undo:Vec::new(),cross_redo:Vec::new(),envelope_undo:Vec::new(),envelope_redo:Vec::new(),variant_undo:Vec::new(),variant_redo:Vec::new(),hardware_undo:Vec::new(),hardware_redo:Vec::new(),graphics_undo:Vec::new(),graphics_redo:Vec::new(),metadata_undo:Vec::new(),metadata_redo:Vec::new(),hardware_steps_undo:Vec::new(),hardware_steps_redo:Vec::new(),revision:0,metrics:Value::Null,recovery_required:false,#[cfg(feature="desktop")]gpu})
 }
 /// Always record native rule provenance alongside authored template history.
 /// The upstream authoring History has a bounded 32-transaction capacity.
 fn record_linked_history(&mut self) {
   self.history.record(self.project.template.clone());
   if self.bindings_undo.len()==32{self.bindings_undo.remove(0);}
   self.bindings_undo.push(self.project.native_point_bindings.clone());
   self.bindings_redo.clear();
   if self.grade_undo.len()==32{self.grade_undo.remove(0);}
   self.grade_undo.push(self.project.grade_run.clone());
   self.grade_redo.clear();
   if self.facing_undo.len()==32{self.facing_undo.remove(0);}
   self.facing_undo.push(self.project.native_facing_dependency.clone());
   self.facing_redo.clear();
   if self.cross_undo.len()==32{self.cross_undo.remove(0);}
   self.cross_undo.push(self.project.native_cross_piece_link.clone());
   self.cross_redo.clear();
   if self.envelope_undo.len()==32{self.envelope_undo.remove(0);}
   self.envelope_undo.push(self.project.fabric_grade_envelope.clone());
   self.envelope_redo.clear();
   if self.variant_undo.len()==32{self.variant_undo.remove(0);}
   self.variant_undo.push(self.project.piece_variant.clone());
   self.variant_redo.clear();
   // A hardware placement is a real document edit. Record it alongside the
   // exact garment, grade, rules and facing snapshots in the SAME 32-step
   // chronology; never let Cmd+Z undo an unrelated older pattern edit first.
   if self.hardware_undo.len()==32{self.hardware_undo.remove(0);}
   self.hardware_undo.push(self.project.imported_hardware.clone());
   self.hardware_redo.clear();
  if self.graphics_undo.len()==32{self.graphics_undo.remove(0);}
  self.graphics_undo.push(self.project.print_graphics.clone());
  self.graphics_redo.clear();
  if self.metadata_undo.len()==32{self.metadata_undo.remove(0);}
  self.metadata_undo.push(self.project.property_metadata.clone());
  self.metadata_redo.clear();
   if self.hardware_steps_undo.len()==32{self.hardware_steps_undo.remove(0);}
   self.hardware_steps_undo.push(false);
   self.hardware_steps_redo.clear();
 }
 /// Restore both pattern geometry and its corresponding measurement-rule
 /// snapshot as one revision. Compile candidate native geometry before
 /// consuming either history stack; failed Undo/Redo is nonmutating.
 fn restore_linked_history(&mut self,redo:bool)->Result<(),String> {
   let bindings=if redo{self.bindings_redo.last()}else{self.bindings_undo.last()}
      .ok_or("Native linked history is unavailable")?.clone();
   let graded=if redo{self.grade_redo.last()}else{self.grade_undo.last()}
      .ok_or("Native six-size linked history is unavailable")?.clone();
   let facing=if redo{self.facing_redo.last()}else{self.facing_undo.last()}
      .ok_or("Native facing linked history is unavailable")?.clone();
   let cross=if redo{self.cross_redo.last()}else{self.cross_undo.last()}
      .ok_or("Native cross-piece linked history is unavailable")?.clone();
   let variant=if redo{self.variant_redo.last()}else{self.variant_undo.last()}
      .ok_or("Native article variant linked history is unavailable")?.clone();
   let envelope=if redo{self.envelope_redo.last()}else{self.envelope_undo.last()}
      .ok_or("Native fabric envelope history is unavailable")?.clone();
   let hardware=if redo{self.hardware_redo.last()}else{self.hardware_undo.last()}
      .ok_or("Native hardware linked history is unavailable")?.clone();
  let graphics=if redo{self.graphics_redo.last()}else{self.graphics_undo.last()}
     .ok_or("Native artwork linked history is unavailable")?.clone();
   let metadata=if redo{self.metadata_redo.last()}else{self.metadata_undo.last()}
     .ok_or("Native property linked history is unavailable")?.clone();
   let hardware_step=if redo{self.hardware_steps_redo.last()}else{self.hardware_steps_undo.last()};
   let hardware_step=*hardware_step.ok_or("Native hardware step history is unavailable")?;
   // Graded metadata is saved together with the authored base template,
   // rather than restored a turn late after geometric Undo.
   if let Some(run)=&graded {
     let candidate=if redo{self.history.peek_redo()}else{self.history.peek_undo()}
       .ok_or("Missing native template history")?;
     run.validate(candidate)?;
   }
   if let Some(variant)=&variant {
     let candidate=if redo{self.history.peek_redo()}else{self.history.peek_undo()}
       .ok_or("Missing native article variant template history")?;
     variant.validate(candidate)?;
   }
   if facing.is_some(){
     let template=if redo{self.history.peek_redo()}else{self.history.peek_undo()}
       .ok_or("Missing native facing history template")?;
     let mut candidate=self.project.clone();
     candidate.template=template.clone();candidate.grade_run=graded.clone();
     candidate.native_point_bindings=bindings.clone();
     candidate.native_facing_dependency=facing.clone();
     marvelous_cloth::native_facing_dependency_20261027::verify_native_facing_dependency(&candidate)?;
   }
   if let Some(saved)=&envelope {
     let template=if redo{self.history.peek_redo()}else{self.history.peek_undo()}
       .ok_or("Missing native fabric envelope history template")?;
     let mut candidate=self.project.clone();
     candidate.template=template.clone();candidate.grade_run=graded.clone();
     candidate.native_point_bindings=bindings.clone();
     saved.validate(&candidate)?;
   }
   // Validate hardware against the restored template before consuming any
   // history entry, including when an authored panel has since been deleted.
   let mut restored=self.project.clone();
   restored.template=(if redo{self.history.peek_redo()}else{self.history.peek_undo()})
      .ok_or("Missing native hardware history template")?.clone();
   restored.validate_imported_hardware(&hardware)?;
  restored.validate_print_graphics(&graphics)?;
   if let Some(saved)=&metadata {saved.validate(&restored.template)?;}
   if let Some(link)=&cross{link.validate(&restored.template)?;}
   let edit=self.history.restore(&self.project.template,redo)?;
   let active=self.project.native_point_bindings.clone();
   let active_grade=self.project.grade_run.clone();
   let active_facing=self.project.native_facing_dependency.clone();
   let active_cross=self.project.native_cross_piece_link.clone();
   let active_variant=self.project.piece_variant.clone();
   let active_envelope=self.project.fabric_grade_envelope.clone();
   let active_hardware=self.project.imported_hardware.clone();
  let active_graphics=self.project.print_graphics.clone();
   let active_metadata=self.project.property_metadata.clone();
   if redo {
     self.bindings_redo.pop();
     self.bindings_undo.push(active);
     self.grade_redo.pop();
     self.grade_undo.push(active_grade);
     self.facing_redo.pop();self.facing_undo.push(active_facing);
     self.cross_redo.pop();self.cross_undo.push(active_cross);
     self.variant_redo.pop();
     self.variant_undo.push(active_variant);
     self.envelope_redo.pop();self.envelope_undo.push(active_envelope);
     self.hardware_redo.pop();self.hardware_undo.push(active_hardware);
    self.graphics_redo.pop();self.graphics_undo.push(active_graphics);
    self.metadata_redo.pop();self.metadata_undo.push(active_metadata);
     self.hardware_steps_redo.pop();self.hardware_steps_undo.push(hardware_step);
   }else{
     self.bindings_undo.pop();
     self.bindings_redo.push(active);
     self.grade_undo.pop();
     self.grade_redo.push(active_grade);
     self.facing_undo.pop();self.facing_redo.push(active_facing);
     self.cross_undo.pop();self.cross_redo.push(active_cross);
     self.variant_undo.pop();
     self.variant_redo.push(active_variant);
     self.envelope_undo.pop();self.envelope_redo.push(active_envelope);
     self.hardware_undo.pop();self.hardware_redo.push(active_hardware);
    self.graphics_undo.pop();self.graphics_redo.push(active_graphics);
    self.metadata_undo.pop();self.metadata_redo.push(active_metadata);
     self.hardware_steps_undo.pop();self.hardware_steps_redo.push(hardware_step);
   }
   self.apply_edit(edit);
   self.project.native_point_bindings=bindings;
   self.project.grade_run=graded;
   self.project.native_facing_dependency=facing;
   self.project.native_cross_piece_link=cross;
   self.project.piece_variant=variant;
   self.project.fabric_grade_envelope=envelope;
   self.project.imported_hardware=hardware;
  self.project.print_graphics=graphics;
   self.project.property_metadata=metadata;
   Ok(())
 }
 // Same barycentric spring as upstream atelier.rs::pick_and_drag (150 N/m).
 // Control updates never teleport particles or change material rest geometry.
 fn set_live_grab(&mut self,value:&Value)->Result<(),String>{
  if value.is_null(){self.grab=None;self.live_grab=false;return Ok(())}
  let vertices=field::<[usize;3]>(value,"vertices")?;
  let weights=field::<[f64;3]>(value,"weights")?;
  let target=field::<[f64;3]>(value,"target")?;
  if !weights.iter().all(|w|w.is_finite()&&*w>=-1e-6&&*w<=1.000001)
   || (weights.iter().sum::<f64>()-1.).abs()>1e-5
   || !target.iter().all(|n|n.is_finite()&&n.abs()<20.)
   || !self.scene.garment.mesh.triangles.iter().any(|t|t.vertices==vertices){return Err("Invalid surface grab".into())}
  self.grab=Some(Grab{vertices,weights,target:DVec3::from_array(target),stiffness:150.});
  self.live_grab=true;Ok(())
 }
 fn apply_edit(&mut self,edit:authoring::Edit){
  self.grab=None;self.live_grab=false;
  if edit.reset_simulation {
   self.scene.state=edit.state_after(&self.scene.garment,&self.scene.state);
   self.scene.garment=Arc::new(edit.garment);self.solver=None;self.grab=None;self.live_grab=false;self.metrics=Value::Null;
  }
  // A RemovePanel/Boolean source edit can delete a hardware host. The native
  // edit and hardware pruning are ONE linked history entry: Undo restores
  // both and Redo cannot recreate a saved project with orphaned hardware.
  self.project.imported_hardware.retain(|item|
    edit.template.panels.iter().any(|panel|panel.id==item.panel));
  self.project.print_graphics.retain(|item|
    edit.template.panels.iter().any(|panel|panel.id==item.panel));
  // A deleted authored piece/fabric cannot leave an orphaned presentation
  // property in the same strict native document. Existing source IDs retain
  // their metadata across ordinary geometric edits and grading.
  if let Some(metadata)=self.project.property_metadata.as_mut(){
    metadata.panels.retain(|id,_|edit.template.panels.iter().any(|p|p.id==*id));
    metadata.fabrics.retain(|id,_|edit.template.fabrics.iter().any(|f|f.id==*id));
  }
  self.project.template=edit.template;self.project.grade_run=None;
  // A cold-open project carries the mesh signature of its saved source.
  // Once any pattern edit changes that source, the previous persisted pose
  // and signature are no longer admissible. Clear both BEFORE a subsequent
  // direct grade/notch compile or journal save can inspect this candidate.
  self.project.state=None;self.project.mesh_signature=None;
  self.project.native_cross_piece_link=None;
  self.project.fabric_grade_envelope=None;
  // A modified source cannot silently retain an earlier production / 3D
  // article declaration. One Undo restores the exact original declaration.
  self.project.piece_variant=None;self.revision+=1;
 }
 fn snapshot(&self,avatar:bool,graphics:bool)->Value {
  // The base authored garment remains the only persisted source; while a
  // saved size is active, the viewport must describe the mesh actually in use.
  let visible_template=if let Some(candidate)=&self.active_variant_template {candidate} else {match (&self.project.grade_run,&self.active_grade_size) {
   // The compiled native scene resolves external F7 aliases to canonical
   // sizes. The snapshot must use the *same* resolution, or the 2D editor
   // falsely displays the base pattern while the 3D mesh uses the grade.
   (Some(run),Some(size))=>run.resolve_size(size)
    .and_then(|canonical|run.sizes.iter().position(|name|name==canonical))
    .and_then(|index|run.graded_templates.get(index)).unwrap_or(&self.project.template),
   _=>&self.project.template,
  }};
  let g=&self.scene.garment;
  let panels:Vec<_>=g.panels.iter().enumerate().map(|(i,p)|json!({"id":p.id,"vertices":[p.vertices.start,p.vertices.end],"triangles":[p.triangles.start,p.triangles.end],"boundaries":p.boundaries,"layout":authoring::layout(visible_template,i)})).collect();
  let seams:Vec<_>=g.seams.iter().map(|s|{
   let max_gap_m=s.max_gap(&self.scene.state.x);
   let rms_gap_m=s.rms_gap(&self.scene.state.x);
   json!({"id":s.id,"guides":s.guides,"gap_m":max_gap_m,
     "rms_gap_m":rms_gap_m,"lengths_m":s.lengths,
     "kind":if s.id.starts_with("dart_"){"cut_sewn_dart"}else if s.id.starts_with("tuck_"){"sewn_tuck_fold"}else{"sewing"},
     // This tolerance is a measurement gate, NOT proof of good 3D fit,
     // collision-free closure or a production-complete folded dart.
     "within_provisional_2mm":max_gap_m<=0.002})
  }).collect();
  let dart_fit:Vec<_>=g.seams.iter().filter(|s|s.id.starts_with("dart_")).map(|s|{
   let max=s.max_gap(&self.scene.state.x);
   json!({"seamId":s.id,"maxGapMm":max*1000.,"rmsGapMm":s.rms_gap(&self.scene.state.x)*1000.,
     "lengthsMm":s.lengths.map(|n|n*1000.),"withinProvisional2mm":max<=0.002})
  }).collect();
  let tuck_fit:Vec<_>=g.seams.iter().filter(|s|s.id.starts_with("tuck_")).map(|s|{
   let max=s.max_gap(&self.scene.state.x);
   json!({"seamId":s.id,"maxGapMm":max*1000.,"rmsGapMm":s.rms_gap(&self.scene.state.x)*1000.,
     "lengthsMm":s.lengths.map(|n|n*1000.),"withinProvisional2mm":max<=0.002,
     "physicalSewingConstraint":true,"foldContactCertified":false})
  }).collect();
  let graphic_panel_metrics:serde_json::Map<String,Value>=g.panels.iter().filter_map(|p|{
   let points=g.mesh.uv.get(p.vertices.clone())?;
   if points.is_empty(){return None}
   let (mut min_x,mut min_y,mut max_x,mut max_y)=(f64::INFINITY,f64::INFINITY,f64::NEG_INFINITY,f64::NEG_INFINITY);
   for q in points {min_x=min_x.min(q.x);min_y=min_y.min(q.y);max_x=max_x.max(q.x);max_y=max_y.max(q.y);}
   if ![min_x,min_y,max_x,max_y].iter().all(|n|n.is_finite()){return None}
   Some((p.id.clone(),json!({"minX":min_x,"minY":min_y,"maxX":max_x,"maxY":max_y,"width":max_x-min_x,"height":max_y-min_y})))
  }).collect();
  // A graded viewport is a real separately compiled native mesh, but merely
  // activating it does not constitute a 3D fit run. Report evidence for the
  // current size only, and only after a successful native solver step.
  let graded_fit_evidence=self.active_grade_size.as_ref().map(|size|{
   let positions_finite=self.scene.state.x.iter().all(|p|p.to_array().iter().all(|n|n.is_finite()));
   let gaps:Vec<_>=g.seams.iter().map(|s|(s.max_gap(&self.scene.state.x),s.rms_gap(&self.scene.state.x))).collect();
   let measurements_finite=positions_finite && gaps.iter().all(|(max,rms)|max.is_finite()&&rms.is_finite()&&*max>=0.&&*rms>=0.);
   let step_verified=!self.metrics.is_null() && self.scene.state.time.is_finite() && self.scene.state.time>0. && measurements_finite;
   json!({"size":size,"nativeMeshCompiled":true,"nativeStepEvidence":step_verified,
     "simulationTimeSeconds":if step_verified{Some(self.scene.state.time)}else{None},
     "seamCount":gaps.len(),
     "maxSeamGapMm":if step_verified{gaps.iter().map(|(max,_)|*max).reduce(f64::max).map(|n|n*1000.)}else{None},
     "maxRmsSeamGapMm":if step_verified{gaps.iter().map(|(_,rms)|*rms).reduce(f64::max).map(|n|n*1000.)}else{None},
     "measurementsFinite":measurements_finite,"fitCertified":false,"manufacturingApproved":false})
  });
  let mut out=json!({"revision":self.revision,"template":visible_template,"positions":self.scene.state.x,"uv":g.mesh.uv,"triangles":g.mesh.triangles.iter().map(|t|t.vertices).collect::<Vec<_>>(),"panels":panels,"graphicPanelMetrics":graphic_panel_metrics,"seams":seams,"dartFit":dart_fit,"tuckFit":tuck_fit,"time":self.scene.state.time,"metrics":self.metrics,"canUndo":self.base_variant_scene.is_none()&&self.active_grade_size.is_none()&&self.history.can_undo(),"canRedo":self.base_variant_scene.is_none()&&self.active_grade_size.is_none()&&self.history.can_redo(),"activeGradedSize":self.active_grade_size,"gradedSizePreview":self.active_grade_size.is_some(),"nativeGradeActivationSupported":true,"manufacturingApproved":false,"avatar":if avatar {json!({"positions":self.scene.collider.surface.vertices,"triangles":self.scene.collider.surface.triangles})}else{Value::Null},"grabActive":self.grab.is_some(),"grabStiffness":self.grab.as_ref().map(|g|g.stiffness),"backend":if std::env::args().any(|a|a=="--gpu"){"ClothCraft GPU VBD + CPU OGC"}else{"ClothCraft CPU VBD + OGC"},"fitCertified":false});
  out["nativeCommit"]=json!(self.project.native_commit);
  out["propertyMetadata"]=json!(self.project.property_metadata);
  out["variantAssemblyActive"]=json!(self.base_variant_scene.is_some());
  out["variantAssemblyProof"]=json!(self.variant_assembly_proof);
  out["variantAssemblyManufacturingApproved"]=json!(false);
  out["gradedFitEvidence"]=json!(graded_fit_evidence);
  // Ground the measurement inspector's availability in Rust-owned persisted
  // source state, not a browser grade sidecar or a recently cached UI flag.
  out["gradeRunPersisted"]=json!(self.project.grade_run.is_some());
  out["pieceVariant"]=match &self.project.piece_variant {
    Some(variant)=>json!({"persisted":true,"definition":{
        "version":variant.version,"pieces":variant.pieces},
        // Snapshot is emitted on every simulation step. Source compilation
        // already ran at load/store; do not remesh the garment on every frame.
        "review":variant.review_without_compile(&self.project.template).ok(),
        "manufacturerApproved":false}),
    None=>Value::Null,
  };
  out["nativePointBindings"]=match &self.project.native_point_bindings {
    Some(saved)=>json!({"version":saved.version,
      "active":saved.source_matches(&self.project.template),
      "measurements":saved.measurements,"bindings":saved.bindings,
      "manufacturingApproved":false,"automaticRegeneration":false}),
    None=>Value::Null,
  };
  out["fabricGradeEnvelope"]=json!(self.project.fabric_grade_envelope);
  out["nativeFacingDependency"]=json!(self.project.native_facing_dependency);
  out["nativeCrossPieceGradingSupported"]=json!(true);
  out["nativeCrossPieceLink"]=json!(self.project.native_cross_piece_link.as_ref().map(|link|
   json!({"version":link.version,"sourcePanelId":link.source_panel_id,
      "sourcePointIndex":link.source_point_index,"targetPanelId":link.target_panel_id,
      "targetPointIndex":link.target_point_index,"boardOffsetM":link.board_offset_m,
      "active":link.validate(&self.project.template).is_ok(),"manufacturerApproved":false})));
  if graphics {out["printGraphics"]=json!(self.project.print_graphics);}
  out["importedHardware"]=json!(self.project.imported_hardware);
  // The inspector's hardware-specific buttons may act only when the NEXT
  // globally chronological edit is hardware; otherwise use global Undo.
  out["canUndoHardware"]=json!(self.base_variant_scene.is_none()&&self.active_grade_size.is_none()&&self.hardware_steps_undo.last()==Some(&true));
  out["canRedoHardware"]=json!(self.base_variant_scene.is_none()&&self.active_grade_size.is_none()&&self.hardware_steps_redo.last()==Some(&true));
  out
 }
 fn request(&mut self,v:&Value)->Result<Value,String>{
  if self.recovery_required {
   return Err("NATIVE_PROJECT_COMMITTED_HISTORY_RECOVERY_REQUIRED: stop this session and cold-open the exact saved native document with its linked journal".into());
  }
  let op=v["op"].as_str().unwrap_or("snapshot");
  if !["snapshot","save"].contains(&op) && v["revision"].as_u64()!=Some(self.revision){return Err("Stale document revision; reload current snapshot".into())}
  if self.base_variant_scene.is_some() && !["snapshot","save","piece-variant-inspect","piece-variant-instance-restore","grab","step","reset"].contains(&op) {
   return Err("Restore the native base garment before editing or activating a graded size during 3D instance preview".into());
  }
  if self.active_grade_size.is_some() && !["snapshot","save","grade-run-status","grade-run-cutlines","piece-variant-inspect","grade-run-activate","grade-run-restore","grab","step","reset"].contains(&op) {
   return Err("Restore the base size before editing the authored garment or changing its grade catalog".into());
  }
  // Do not allow metadata-only commands to attach a grading/binding/facing
  // graph while an independent source-to-target link is stored. Such a write
  // would otherwise create contradictory persisted state without invoking
  // a full candidate project compile. Ordinary geometry edits explicitly
  // clear the optional relation through apply_edit and one Undo restores it.
  if self.project.native_cross_piece_link.is_some() && ![
    "snapshot","save","property-metadata-store","native-cross-piece-move","native-cross-piece-clear",
    "undo","redo","edit","edit-batch","pattern-audit",
    "grab","step","reset"
  ].contains(&op){
    return Err("Persistent cross-piece link must be cleared before other native graphs or metadata can change".into());
  }
  if self.project.native_facing_dependency.is_some() && ![
    "snapshot","save","property-metadata-store","open","facing-dependency-inspect","bindings-grade-regenerate-preview",
    "bindings-grade-regenerate","undo","redo","hardware-set","hardware-undo","hardware-redo","grade-run-status","grade-run-cutlines",
    "grade-run-industrial-audit","grade-run-pom-audit","grade-run-sewing-balance-audit",
    "grade-run-activate","grade-run-restore","grab","step","reset"
  ].contains(&op) {
    return Err("Native facing dependency requires qualified regeneration; unrelated source edits are unsupported".into());
  }
  if self.project.fabric_grade_envelope.is_some() && ![
    "snapshot","save","property-metadata-store","fabric-grade-envelope-inspect","fabric-grade-envelope-store",
    "fabric-grade-envelope-clear","bindings-grade-regenerate-preview","bindings-grade-regenerate",
    "edit","undo","redo","hardware-set","hardware-undo","hardware-redo","grade-run-status","grade-run-cutlines",
    "grade-run-industrial-audit","grade-run-pom-audit","grade-run-sewing-balance-audit",
    "piece-variant-inspect","facing-dependency-inspect","grab","step","reset"
  ].contains(&op) {
    return Err("Clear the saved fabric grade envelope before changing unrelated native source metadata".into());
  }
  match op {
   "property-metadata-store"=>{
    // A whole-value, Rust-validated metadata replacement. One subsequent
    // native save commits geometry, grade, metadata and the linked journal
    // under the SAME native UUID and generation. Nothing is written to a
    // separate Node property sidecar.
    if !v.as_object().is_some_and(|o|o.len()==3 &&
      ["op","revision","metadata"].iter().all(|key|o.contains_key(*key))) {
      return Err("Unexpected native property metadata fields".into());
    }
    let metadata:NativePropertyMetadataV1=field(v,"metadata")?;
    metadata.validate(&self.project.template)?;
    if let Some(previous)=&self.project.property_metadata {
      if previous.metadata_project_id!=metadata.metadata_project_id ||
          previous.identity!=metadata.identity {
        return Err("Native project property metadata identity cannot be replaced by a property edit".into());
      }
    }
    self.project.property_metadata=Some(metadata);
    return Ok(self.snapshot(false,false));
   },
   "facing-dependency-preview"=>{
     // Build and compile an entirely Rust-owned disposable candidate. The
     // actual installer independently repeats every gate against its own
     // current source revision; no browser-supplied child polygon is trusted.
     if !v.as_object().is_some_and(|o|o.len()==7 &&
       ["op","revision","parentPanelId","parentEdgeId","facingId","depthMm","allowanceMm"]
         .iter().all(|key|o.contains_key(*key))){
       return Err("Unexpected native facing preview fields".into());
     }
     if self.project.native_facing_dependency.is_some(){return Err("Facing dependency already installed".into())}
     if self.project.fabric_grade_envelope.is_some(){return Err("Clear fabric grade envelope before facing review".into())}
     let parent=field::<String>(v,"parentPanelId")?;
     let edge=field::<String>(v,"parentEdgeId")?;
     let child=field::<String>(v,"facingId")?;
     let depth=field::<f64>(v,"depthMm")?;
     let allowance=field::<f64>(v,"allowanceMm")?;
     if !depth.is_finite() || !allowance.is_finite() || !(1.0..=500.0).contains(&depth)
       || !(0.0..=100.0).contains(&allowance){return Err("Invalid native facing preview dimensions".into())}
     let (template,run,relation)=marvelous_cloth::native_facing_dependency_20261027::
       create_native_facing_dependency(&self.project,&parent,&edge,&child,depth/1000.,allowance/1000.)?;
     let mut candidate=self.project.clone();
     candidate.template=template;candidate.grade_run=Some(run.clone());
     candidate.native_facing_dependency=Some(relation.clone());
     if let Some(graph)=candidate.native_point_bindings.as_mut(){graph.source_template=candidate.template.clone();}
     candidate.state=None;candidate.mesh_signature=None;
     marvelous_cloth::native_facing_dependency_20261027::verify_native_facing_dependency(&candidate)?;
     candidate.compile()?;
     let mut rows=Vec::with_capacity(run.sizes.len());
     for (i,size) in run.sizes.iter().enumerate(){
       let grade=&run.graded_templates[i];
       let source=grade.panels.iter().find(|p|p.id==parent).and_then(|p|p.polygon.as_ref())
         .ok_or("Missing facing preview source geometry")?;
       let facing=grade.panels.iter().find(|p|p.id==child).and_then(|p|p.polygon.as_ref())
         .ok_or("Missing facing preview derived geometry")?;
       let source_index=source.edges.iter().position(|name|name==&edge)
         .ok_or("Missing qualified source preview edge")?;
       let length=|points:&Vec<glam::DVec2>| -> f64 {points.windows(2).map(|w|w[0].distance(w[1])).sum()};
       let source_length=length(&source.edge_points(source_index)?);
       let facing_length=length(&facing.edge_points(0)?);
       if !source_length.is_finite() || !facing_length.is_finite()
         || (source_length-facing_length).abs()>1e-8 {
         return Err(format!("Facing size {size} has unequal physical source and child sewing"));
       }
       rows.push(json!({"size":size,"points":facing.points,
         "sourceSewlineLengthM":source_length,"facingSewlineLengthM":facing_length,
         "sourceNotches":source.notches.get(&edge).cloned().unwrap_or_default(),
         "facingNotches":facing.notches.get(&facing.edges[0]).cloned().unwrap_or_default(),
         "sewnEdge":facing.edges[0],"hemEdge":facing.edges[2],
         "curved":facing.curves.contains_key(&facing.edges[0])}));
     }
     return Ok(json!({"format":"exo-native-facing-six-size-preview.v1",
       "nativeAuthoritative":true,"sourceRevision":self.revision,
       "persisted":false,"sourceUnchanged":true,"relationVersion":relation.version,
       "parentPanelId":parent,"parentEdgeId":edge,"derivedPanelId":child,
       "depthMm":depth,"allowanceMm":allowance,
       "pairedSeamId":format!("{}_attach",child),"sizes":rows,
       "factoryApproved":false,"manufacturingApproved":false,
       "cuttingAuthorized":false,"licensedModarisAccepted":false}));
   },
   "facing-dependency-inspect"=>{
     if !v.as_object().is_some_and(|o|o.len()==2 && ["op","revision"].iter().all(|key|o.contains_key(*key))){
       return Err("Unexpected native facing inspection fields".into());
     }
     if self.project.native_facing_dependency.is_some(){
       marvelous_cloth::native_facing_dependency_20261027::verify_native_facing_dependency(&self.project)?;
     }
     return Ok(json!({"sourceRevision":self.revision,"nativeFacingDependency":self.project.native_facing_dependency,
       "factoryApproved":false,"manufacturingApproved":false}));
   },
   "facing-dependency-install"=>{
     if !v.as_object().is_some_and(|o|o.len()==7 &&
       ["op","revision","parentPanelId","parentEdgeId","facingId","depthMm","allowanceMm"]
         .iter().all(|key|o.contains_key(*key))){
       return Err("Unexpected native facing dependency installation fields".into());
     }
     if self.project.native_facing_dependency.is_some(){return Err("Native facing dependency already installed".into())}
     if self.project.fabric_grade_envelope.is_some(){return Err("Clear the physical fabric grade envelope before installing a facing".into())}
     let parent=field::<String>(v,"parentPanelId")?;
     let edge=field::<String>(v,"parentEdgeId")?;
     let child=field::<String>(v,"facingId")?;
     let depth=field::<f64>(v,"depthMm")?;
     let allowance=field::<f64>(v,"allowanceMm")?;
     if !depth.is_finite() || !allowance.is_finite() || !(1.0..=500.0).contains(&depth)
        || !(0.0..=100.0).contains(&allowance){return Err("Invalid finite facing depth or allowance millimetres".into())}
     let (template,run,facing)=marvelous_cloth::native_facing_dependency_20261027::
       create_native_facing_dependency(&self.project,&parent,&edge,&child,depth/1000.,allowance/1000.)?;
     let mut candidate=self.project.clone();
     candidate.template=template.clone();candidate.grade_run=Some(run.clone());
     candidate.native_facing_dependency=Some(facing.clone());
     if let Some(graph)=candidate.native_point_bindings.as_mut(){graph.source_template=template.clone();}
     candidate.state=None;candidate.mesh_signature=None;
     marvelous_cloth::native_facing_dependency_20261027::verify_native_facing_dependency(&candidate)?;
     candidate.compile()?;
     let garment=template.compile()?;
     self.record_linked_history();
     self.apply_edit(authoring::Edit{template,garment,selected:None,reset_simulation:true,new_point:None});
     self.project.grade_run=Some(run);
     self.project.native_facing_dependency=Some(facing);
     if let Some(graph)=self.project.native_point_bindings.as_mut(){graph.source_template=self.project.template.clone();}
     let mut result=self.snapshot(false,false);
     result["facingDependencyInstall"]=json!({"sourceRevision":self.revision,"installed":true,
       "parentPanelId":parent,"parentEdgeId":edge,"facingId":child,
       "factoryApproved":false,"manufacturingApproved":false});
     return Ok(result);
   },
   "fabric-grade-envelope-inspect"=>{
     if !v.as_object().is_some_and(|o|o.len()==2 && o.contains_key("op") && o.contains_key("revision")) {
       return Err("Unexpected fabric grade envelope inspection fields".into());
     }
     if let Some(envelope)=&self.project.fabric_grade_envelope {envelope.validate(&self.project)?;}
     return Ok(json!({"format":"exo-native-fabric-grade-envelope.v1",
       "sourceRevision":self.revision,"envelope":self.project.fabric_grade_envelope,
       "nativeAuthoritative":true,"manufacturerApproved":false}));
   },
   "fabric-grade-envelope-store"=>{
     if !v.as_object().is_some_and(|o|o.len()==3 && ["op","revision","envelope"].iter().all(|key|o.contains_key(*key))) {
       return Err("Unexpected fabric grade envelope store fields".into());
     }
     let envelope:PersistedFabricGradeEnvelope=field(v,"envelope")?;
     envelope.validate(&self.project)?;
     self.record_linked_history();
     self.project.fabric_grade_envelope=Some(envelope);
     self.revision+=1;
     return Ok(self.snapshot(false,false));
   },
   "fabric-grade-envelope-clear"=>{
     if !v.as_object().is_some_and(|o|o.len()==2 && o.contains_key("op") && o.contains_key("revision")) {
       return Err("Unexpected fabric grade envelope clear fields".into());
     }
     if self.project.fabric_grade_envelope.is_some(){
       self.record_linked_history();self.project.fabric_grade_envelope=None;self.revision+=1;
     }
     return Ok(self.snapshot(false,false));
   },
   "piece-variant-instance-preview"|"piece-variant-instance-activate"=>{
     if !v.as_object().is_some_and(|o|o.len()==2 &&
       ["op","revision"].iter().all(|key|o.contains_key(*key))){
       return Err("Unsupported physical 3D article instance request fields".into());
     }
     let (assembled,mut report)=marvelous_cloth::native_variant_instance_20261027::
       compile_native_variant_instances_20261027(&self.project)?;
     // The selected virtual assembly is always a *disposable* native mesh,
     // never a new authored or industrial source. Reset incompatible source
     // metadata and cached mesh before compiling the temporary fitting view.
     let mut candidate=self.project.clone();
     candidate.template=assembled.clone();
     candidate.grade_run=None;
     candidate.native_point_bindings=None;
     candidate.piece_variant=None;
     candidate.state=None;
     candidate.mesh_signature=None;
     let assembled_scene=candidate.compile()?;
     let evidence=report.as_object_mut()
       .ok_or("Invalid Rust physical variant instance receipt")?;
     evidence.insert("sourceRevision".into(),json!(self.revision));
     evidence.insert("actualCompiledPanelCount".into(),json!(assembled_scene.garment.panels.len()));
     evidence.insert("actualCompiledVertexCount".into(),json!(assembled_scene.garment.mesh.uv.len()));
     evidence.insert("actualCompiledTriangleCount".into(),json!(assembled_scene.garment.mesh.triangles.len()));
     evidence.insert("manufacturingApproved".into(),json!(false));
     evidence.insert("mirroredPieceProven".into(),json!(false));
     evidence.insert("sewnDuplicateRemapping".into(),json!(false));
     if op=="piece-variant-instance-preview" {return Ok(report)}
     if self.base_grade_scene.is_some() || self.base_variant_scene.is_some() {
       return Err("Restore the original garment before activating a separate 3D article instance".into());
     }
     self.base_variant_scene=Some(std::mem::replace(&mut self.scene,assembled_scene));
     self.active_variant_template=Some(assembled);
     self.variant_assembly_proof=Some(report.clone());
     self.solver=None;self.grab=None;self.live_grab=false;self.metrics=Value::Null;
     self.revision+=1;
     let mut snapshot=self.snapshot(true,true);
     snapshot["variantInstanceActivation"]=report;
     return Ok(snapshot);
   },
   "piece-variant-instance-restore"=>{
     if !v.as_object().is_some_and(|o|o.len()==2 &&
       ["op","revision"].iter().all(|key|o.contains_key(*key))){
       return Err("Unsupported 3D instance restore request fields".into());
     }
     let original=self.base_variant_scene.take().ok_or("No active 3D instance preview to restore")?;
     self.scene=original;
     self.active_variant_template=None;
     self.variant_assembly_proof=None;
     self.solver=None;self.grab=None;self.live_grab=false;self.metrics=Value::Null;
     self.revision+=1;
     return Ok(self.snapshot(true,true));
   },
   "piece-variant-inspect"=>{
     if !v.as_object().is_some_and(|o|o.len()==2 && o.contains_key("op")&&o.contains_key("revision")) {
       return Err("Unexpected native piece variant inspection fields".into());
     }
     let report=match &self.project.piece_variant {
       Some(variant)=>Some(variant.validate(&self.project.template)?),
       None=>None,
     };
     return Ok(json!({"format":"exo-native-piece-variant.v1",
       "sourceRevision":self.revision,"persisted":self.project.piece_variant.is_some(),
       "review":report,"manufacturingApproved":false,
       "physicalMirrorsGenerated":false,"nativeSewingRemapped":false}));
   },
   "piece-variant-store"=>{
     if !v.as_object().is_some_and(|o|o.len()==3 &&
       ["op","revision","variant"].iter().all(|k|o.contains_key(*k))) {
       return Err("Unexpected native piece variant store fields".into());
     }
     let variant:PersistedPieceVariant=field(v,"variant")?;
     let proof=variant.validate(&self.project.template)?;
     // A strict source review is persisted in the same authoritative
     // FittingProject as the garment and saved grading catalog.
     let mut candidate=self.project.clone();
     candidate.piece_variant=Some(variant.clone());
     candidate.compile()?;
     self.record_linked_history();
     self.project.piece_variant=Some(variant);
     self.revision+=1;
     let mut result=self.snapshot(false,false);
     result["pieceVariantStore"]=json!({"persisted":true,
       "sourceRevision":self.revision,"review":proof,
       "factoryApproved":false,"nativeSewingRemapped":false});
     return Ok(result);
   },
   "piece-variant-clear"=>{
     if !v.as_object().is_some_and(|o|o.len()==2 &&
       ["op","revision"].iter().all(|k|o.contains_key(*k))) {
       return Err("Unexpected native piece variant clear fields".into());
     }
     if self.project.piece_variant.is_some(){
       self.record_linked_history();
       self.project.piece_variant=None;
       self.revision+=1;
     }
     return Ok(self.snapshot(false,false));
   },
   "bindings-grade-regenerate-preview"|"bindings-grade-regenerate"=>{
    // Qualified Rust-owned cross-panel dependent regeneration. Only direct
    // measurement overrides enter; child point positions are derived here,
    // never accepted from a browser caller.
    if !v.as_object().is_some_and(|object|object.len()==3 &&
      ["op","revision","overrides"].iter().all(|key|object.contains_key(*key))){
      return Err("Unexpected fields in six-size regeneration request".into());
    }
    let overrides=field::<std::collections::BTreeMap<String,f64>>(v,"overrides")?;
    if let Some(envelope)=&self.project.fabric_grade_envelope {envelope.preflight(&self.project,&overrides)?;}
    let original_revision=self.revision;
    let source=if self.project.native_facing_dependency.is_some(){
      marvelous_cloth::native_facing_dependency_20261027::strip_native_facing_dependency(&self.project)?
    }else{self.project.clone()};
    let (template,run,graph,mut report)=
      marvelous_cloth::native_six_size_recompute_20261027::recompute_native_six_size_measurement20261027(
        &source,&overrides)?;
    let mut template=template;
    let mut run=run;
    let mut next_facing=None;
    if let Some(relation)=&self.project.native_facing_dependency{
      let mut regenerated=source.clone();
      regenerated.template=template.clone();
      regenerated.grade_run=Some(run.clone());
      regenerated.native_point_bindings=Some(graph.clone());
      let (next_base,next_run,definition)=
        marvelous_cloth::native_facing_dependency_20261027::create_native_facing_dependency(
          &regenerated,&relation.parent_panel_id,&relation.parent_edge_id,
          &relation.facing_id,relation.depth_m,relation.allowance_m)?;
      template=next_base;
      run=next_run;
      next_facing=Some(definition);
    }
    let proof=report.as_object_mut().ok_or("Invalid native six-size report")?;
    proof.insert("sourceRevision".into(),json!(original_revision));
    proof.insert("manufacturerApproved".into(),json!(false));
    proof.insert("factoryApproved".into(),json!(false));
    // Validate the *complete* new project and compile the exact source mesh
    // before recording one Undo step. Failure leaves all six sizes untouched.
    let mut candidate=self.project.clone();
    candidate.template=template.clone();
    candidate.grade_run=Some(run.clone());
    candidate.native_point_bindings=Some(graph.clone());
    candidate.native_point_bindings.as_mut().ok_or("Missing regenerated binding graph")?
      .source_template=template.clone();
    candidate.native_facing_dependency=next_facing;
    if candidate.native_facing_dependency.is_some(){
      marvelous_cloth::native_facing_dependency_20261027::verify_native_facing_dependency(&candidate)?;
    }
    if let Some(envelope)=candidate.fabric_grade_envelope.as_mut(){
      let old_graph=self.project.native_point_bindings.as_ref()
        .ok_or("Missing source graph for per-size chart rebase")?;
      let new_graph=candidate.native_point_bindings.as_ref()
        .ok_or("Missing candidate graph for per-size chart rebase")?;
      envelope.rebase_after_measurement_change(old_graph,new_graph,&template)?;
    }
    candidate.piece_variant=None;
    candidate.state=None;
    candidate.mesh_signature=None;
    candidate.compile()?;
    if let Some(envelope)=&candidate.fabric_grade_envelope {envelope.validate(&candidate)?;}
    if op=="bindings-grade-regenerate-preview" {return Ok(report)}
    let garment=template.compile()?;
    self.record_linked_history();
    self.apply_edit(authoring::Edit{template,garment,selected:None,reset_simulation:true,new_point:None});
    self.project.grade_run=Some(run);
    self.project.native_point_bindings=candidate.native_point_bindings;
    self.project.native_facing_dependency=candidate.native_facing_dependency;
    self.project.fabric_grade_envelope=candidate.fabric_grade_envelope;
    let mut next=self.snapshot(false,false);
    next["regenerationEvidence"]=report;
    return Ok(next);
   },
   "native-cross-piece-install"=>{
    if !v.as_object().is_some_and(|o|o.len()==6 &&
      ["op","revision","sourcePanelId","sourcePointIndex","targetPanelId","targetPointIndex"]
       .iter().all(|k|o.contains_key(*k))){
      return Err("Unexpected native cross-piece install request fields".into());
    }
    if self.project.native_cross_piece_link.is_some()||
       self.project.native_point_bindings.is_some()||
       self.project.native_facing_dependency.is_some()||
       self.project.fabric_grade_envelope.is_some()||
       self.project.piece_variant.is_some()||
       !self.project.print_graphics.is_empty()||
       !self.project.imported_hardware.is_empty(){
      return Err("Native cross-piece install requires detached source without other dependency graphs or attachments".into());
    }
    let source=field::<String>(v,"sourcePanelId")?;
    let target=field::<String>(v,"targetPanelId")?;
    let source_index=field::<usize>(v,"sourcePointIndex")?;
    let target_index=field::<usize>(v,"targetPointIndex")?;
    let link=marvelous_cloth::native_cross_piece_link_20261030::install(
      &self.project.template,&source,source_index,&target,target_index)?;
    if let Some(run)=&self.project.grade_run {marvelous_cloth::native_cross_piece_link_20261030::validate_grade_link(&link,run)?;}
    self.record_linked_history();
    self.project.native_cross_piece_link=Some(link);
    self.revision+=1;
    let mut result=self.snapshot(false,false);
    result["nativeCrossPieceCommit"]=json!({"operation":"install","oneUndoStep":true,
      "nativeAuthoritative":true,"manufacturingApproved":false});
    return Ok(result);
   },
   "native-cross-piece-move"=>{
    if !v.as_object().is_some_and(|o|o.len()==5 &&
      ["op","revision","sourcePanelId","expectedPosition","position"]
       .iter().all(|k|o.contains_key(*k))){
      return Err("Unexpected native cross-piece move request fields; target coordinates are Rust-owned".into());
    }
    if self.project.native_point_bindings.is_some()||
       self.project.native_facing_dependency.is_some()||
       self.project.fabric_grade_envelope.is_some()||
       self.project.piece_variant.is_some()||
       !self.project.print_graphics.is_empty()||
       !self.project.imported_hardware.is_empty(){
      return Err("Native cross-piece move cannot change bound or attached patterns".into());
    }
    let source=field::<String>(v,"sourcePanelId")?;
    let expected=field::<DVec2>(v,"expectedPosition")?;
    let position=field::<DVec2>(v,"position")?;
    let relation=self.project.native_cross_piece_link.as_ref()
      .ok_or("Install a durable cross-piece source relation first")?;
    if source!=relation.source_panel_id {return Err("Wrong native cross-piece source panel".into());}
    let (edit,rebased,next_grade)=if let Some(run)=&self.project.grade_run {
      let (edit,link,run)=marvelous_cloth::native_cross_piece_link_20261030::move_source_with_grades(
        &self.project.template,relation,run,expected,position)?;
      (edit,link,Some(run))
    }else{
      let (edit,link)=marvelous_cloth::native_cross_piece_link_20261030::move_source(
        &self.project.template,relation,expected,position)?;
      (edit,link,None)
    };
    self.record_linked_history();
    self.apply_edit(edit);
    self.project.grade_run=next_grade;
    self.project.native_cross_piece_link=Some(rebased);
    let mut result=self.snapshot(false,false);
    result["nativeCrossPieceCommit"]=json!({"operation":"move","oneUndoStep":true,
      "nativeAuthoritative":true,"manufacturingApproved":false});
    return Ok(result);
   },
   "native-cross-piece-clear"=>{
    if !v.as_object().is_some_and(|o|o.len()==2 &&
      ["op","revision"].iter().all(|k|o.contains_key(*k))){
      return Err("Unexpected native cross-piece clear request fields".into());
    }
    if self.project.native_cross_piece_link.is_some(){
      self.record_linked_history();
      self.project.native_cross_piece_link=None;
      self.revision+=1;
    }
    return Ok(self.snapshot(false,false));
   },
   "bindings-multipanel-measurement-recompute"=>{
    // One direct chart value regenerates two or more qualified independent
    // pattern pieces. The browser supplies no target coordinates. Both
    // updated panels and the saved chart enter one Rust Undo revision.
    if !v.as_object().is_some_and(|fields| fields.len()==5 &&
     ["op","revision","measurement","expectedValueMm","valueMm"]
      .iter().all(|key|fields.contains_key(*key))) {
     return Err("Unsupported multi-panel native request; dependent coordinates are Rust-owned".into());
    }
    if self.project.grade_run.is_some() ||
       self.project.native_facing_dependency.is_some() ||
       self.project.fabric_grade_envelope.is_some() ||
       self.project.piece_variant.is_some() ||
       !self.project.print_graphics.is_empty() ||
       !self.project.imported_hardware.is_empty() {
     return Err("Native multi-panel measurement recompute needs ungraded pieces without derivative/graphics/hardware attachments".into());
    }
    let graph=self.project.native_point_bindings.as_ref()
     .ok_or("Save native bindings before multi-panel recomputation")?;
    let measurement=field::<String>(v,"measurement")?;
    let expected=field::<f64>(v,"expectedValueMm")?;
    let value=field::<f64>(v,"valueMm")?;
    let (edit,rebased,changed,panels)=marvelous_cloth::native_multi_panel_measurement_20261030::
      recompute_native_multi_panel_measurement_20261030(
        &self.project.template,graph,&measurement,expected,value)?;
    self.record_linked_history();
    self.apply_edit(edit);
    self.project.native_point_bindings=Some(rebased);
    let mut response=self.snapshot(false,false);
    response["nativeMeasurementRecompute"]=json!({"measurement":measurement,
      "expectedValueMm":expected,"valueMm":value,"correctedBindingIds":changed,
      "affectedPanels":panels,"panelCount":panels.len(),
      "oneUndoStep":true,"nativeAuthoritative":true,
      "scope":"2–16 detached ungraded panels, named point rules and cubic edges",
      "manufacturingApproved":false});
    return Ok(response);
   },
   "bindings-measurement-recompute"=>{
    if !v.as_object().is_some_and(|fields| fields.len()==5 &&
     ["op","revision","measurement","expectedValueMm","valueMm"]
      .iter().all(|key|fields.contains_key(*key))) {
     return Err("Unsupported native measurement request fields; target coordinates are Rust-owned".into());
    }
    if self.project.grade_run.is_some(){
     return Err("Native measurement recompute cannot change an attached grade catalog".into());
    }
    let graph=self.project.native_point_bindings.as_ref()
     .ok_or("Store native measurement bindings before requesting recompute")?;
    let measurement=field::<String>(v,"measurement")?;
    let expected=field::<f64>(v,"expectedValueMm")?;
    let value=field::<f64>(v,"valueMm")?;
    let (edit,rebased,changed)=marvelous_cloth::native_reference_recompute_20261027::recompute_native_reference_measurement_20261027(
     &self.project.template,graph,&measurement,expected,value)?;
    self.record_linked_history();
    self.apply_edit(edit);
    self.project.native_point_bindings=Some(rebased);
    let mut response=self.snapshot(false,false);
    response["nativeMeasurementRecompute"]=json!({"measurement":measurement,
      "expectedValueMm":expected,"valueMm":value,"correctedBindingIds":changed,
      "oneUndoStep":true,"nativeAuthoritative":true,
      "scope":"single detached straight panel, direct numeric measurements",
      "manufacturingApproved":false});
    return Ok(response);
   },
   "bindings-anchor-recompute"=>{
    // Explicit opt-in, Rust-owned source edit and dependent regeneration.
    // The persisted rule graph must still match the exact authored template.
    // Unlike browser-side proposals, no caller can supply dependent positions.
    if !v.as_object().is_some_and(|fields| fields.len()==6 &&
     ["op","revision","panel","sourcePointIndex","expectedPosition","position"]
      .iter().all(|key|fields.contains_key(*key))) {
     return Err("Unsupported native reactive request fields; dependent coordinates are Rust-owned".into());
    }
    if self.project.grade_run.is_some(){
     return Err("Native reactive source editing cannot change an attached six-size grade catalog".into());
    }
    let graph=self.project.native_point_bindings.as_ref()
     .ok_or("Store native measurement bindings before requesting reference recompute")?;
    let panel=field::<String>(v,"panel")?;
    let source=field::<usize>(v,"sourcePointIndex")?;
    let expected=field::<DVec2>(v,"expectedPosition")?;
    let destination=field::<DVec2>(v,"position")?;
    let (edit,rebased,changed)=marvelous_cloth::native_reference_recompute_20261027::recompute_native_reference_anchor_20261027(
     &self.project.template,graph,&panel,source,expected,destination)?;
    self.record_linked_history();
    self.apply_edit(edit);
    self.project.native_point_bindings=Some(rebased);
    let mut response=self.snapshot(false,false);
    response["nativeReferenceRecompute"]=json!({"sourcePanel":panel,"sourcePointIndex":source,
      "correctedBindingIds":changed,"oneUndoStep":true,"nativeAuthoritative":true,
      "scope":"single unsewn straight panel, direct measurements only",
      "automaticForArbitraryEdits":false,"manufacturingApproved":false});
    return Ok(response);
   },
   "bindings-store"=>{
    if self.project.grade_run.is_some(){return Err("Detach the saved six-size grade catalog before changing native measurement-binding rules".into());}
    let bindings=authored_native_bindings(&self.project.template,&v["nativeBindings"])?;
    self.record_linked_history();
    self.project.native_point_bindings=Some(bindings);
    self.revision+=1;
    return Ok(self.snapshot(false,false));
   },
   "bindings-clear"=>{
    if self.project.grade_run.is_some(){return Err("Detach the saved six-size grade catalog before clearing native measurement-binding rules".into());}
    if self.project.native_point_bindings.is_some(){
      self.record_linked_history();
      self.project.native_point_bindings=None;
      self.revision+=1;
    }
    return Ok(self.snapshot(false,false));
   },
   "grade-run-cutlines"=>{
    // The stored six-size catalog is inspected independently of the active
    // fitted scene. No size activation, document write, or revision increment.
    let sizes=marvelous_cloth::garment::cutline::graded_production_cutlines(&self.project)?;
    return Ok(json!({"format":"exo-native-graded-cutlines.v1",
      "sourceRevision":self.revision,"revision":self.revision,"sizes":sizes,
      "manufacturerReady":false,"cuttingAuthorized":false}));
   },
   "grade-run-status"=>{
    return Ok(json!({"revision":self.revision,"catalog":self.project.grade_run,
      "persistedInProject":self.project.grade_run.is_some(),"sizeActivated":self.active_grade_size.is_some(),
      "activeGradedSize":self.active_grade_size,"manufacturingApproved":false}));
   },
   "grade-run-industrial-audit"=>{
    if !v.as_object().is_some_and(|object|object.len()==3 &&
      ["op","revision","panel"].iter().all(|key|object.contains_key(*key))){
     return Err("Unsupported native industrial audit request fields".into());
    }
    let panel=field::<String>(v,"panel")?;
    let run=self.project.grade_run.as_ref().ok_or("Saved native grade catalog required for industrial audit")?;
    let proof=marvelous_cloth::native_linked_industrial_propagation_20261027::verify_native_linked_industrial_six_size20261027(
     run,&self.project.template,&panel)?;
    let mut report=serde_json::to_value(proof).map_err(|error|error.to_string())?;
    let fields=report.as_object_mut().ok_or("Invalid native industrial proof")?;
    fields.insert("sourceRevision".into(),json!(self.revision));
    fields.insert("manufacturerApproved".into(),json!(false));
    fields.insert("factoryApproved".into(),json!(false));
    return Ok(report);
   },
   "grade-run-pom-audit"=>{
    // Evaluate the six actual Rust-saved graded templates, not a browser
    // preview or caller-supplied measurement chart. Revision validation
    // above must run even though the audit itself cannot edit the project.
    let mut report=marvelous_cloth::grade_pom_audit_20261027::audit_persisted_grade_pom20261027(&self.project)?;
    let fields=report.as_object_mut().ok_or("Invalid native POM audit report shape")?;
    fields.insert("sourceRevision".into(),json!(self.revision));
    fields.insert("activeGradedSize".into(),json!(self.active_grade_size));
    fields.insert("factoryApproved".into(),json!(false));
    return Ok(report);
   },
   "grade-run-sewing-balance-audit"=>{
    if !v.as_object().is_some_and(|object|object.len()==2&&object.contains_key("op")&&object.contains_key("revision")){
     return Err("Unsupported native sewing balance audit request fields".into());
    }
    let run=self.project.grade_run.as_ref().ok_or("Save a native grade catalog before sewn balance audit")?;
    let proof=marvelous_cloth::native_linked_industrial_propagation_20261027::audit_native_six_size_sewn_balance20261027(
     run,&self.project.template)?;
    let mut report=serde_json::to_value(proof).map_err(|error|error.to_string())?;
    let fields=report.as_object_mut().ok_or("Invalid native sewn balance report")?;
    fields.insert("sourceRevision".into(),json!(self.revision));
    fields.insert("factoryApproved".into(),json!(false));
    return Ok(report);
   },
   "grade-run-activate"=>{
    let size=field::<String>(v,"size")?;
    let run=self.project.grade_run.as_ref().ok_or("Save the six-size native grade catalog before activating a size")?;
    // Validate the current authored source before accepting a sized scene.
    // This also rejects a catalog retained by a template-only import.
    run.validate(&self.project.template)?;
    // The dependency is persisted against the authored base, never against a
    // temporary size scene. Verify the complete source graph before compiling
    // a fitted size, then detach that authored-only provenance from the view.
    if self.project.native_facing_dependency.is_some(){
     marvelous_cloth::native_facing_dependency_20261027::verify_native_facing_dependency(&self.project)?;
    }
    // The selected garment compiles atomically below before scene mutation.
    let canonical=run.resolve_size(&size).ok_or("Unknown saved grading size or correspondence")?;
    let index=run.sizes.iter().position(|name|name==canonical).ok_or("Unknown canonical grading size")?;
    if self.active_grade_size.as_deref()!=Some(size.as_str()) {
     let mut candidate=self.project.clone();
     // Widen only the disposable fitted scene's positive drafting envelope;
     // persisted source and graded metadata retain their authored dimensions.
     candidate.template=PersistedGradeRun::compilation_template_for_size(&run.graded_templates[index])?;
     candidate.grade_run=None;
     candidate.native_facing_dependency=None;
     // A fitted size is a disposable compiled view, not a second authored
     // production/3D variant. The persisted variant stays on the base source.
     candidate.piece_variant=None;
     candidate.state=None;
     candidate.mesh_signature=None;
     // Compile the exact native sized cloth and sewing mesh *before* changing
     // the active scene. Any invalid size leaves both viewports untouched.
     let sized_scene=candidate.compile()?;
     if self.base_grade_scene.is_none(){
      self.base_grade_scene=Some(std::mem::replace(&mut self.scene,sized_scene));
     }else{self.scene=sized_scene;}
     self.active_grade_size=Some(size.clone());
     self.solver=None;self.grab=None;self.live_grab=false;self.metrics=Value::Null;
     self.revision+=1;
    }
    return Ok(self.snapshot(true,true));
   },
   "grade-run-restore"=>{
    if self.active_grade_size.is_some()&&self.base_grade_scene.is_none(){
     return Err("Original base scene unavailable; native grade restore refused".into());
    }
    if let Some(base)=self.base_grade_scene.take(){
     self.scene=base;
     self.active_grade_size=None;
     self.solver=None;self.grab=None;self.live_grab=false;self.metrics=Value::Null;
     self.revision+=1;
    }
    return Ok(self.snapshot(true,true));
   },
   "grade-run-commit"=>{
    // The first catalog may bootstrap already-valid native bindings. Later
    // catalog replacement must use qualified native regeneration instead.
    // Reject before candidate construction, history, revision, or disk I/O.
    if self.project.native_facing_dependency.is_some()
      || self.project.fabric_grade_envelope.is_some()
      || self.project.piece_variant.is_some() {
      return Err("Saved native facing, fabric envelope or piece variant requires bindings-grade-regenerate; catalog-only grade-run-commit refused".into());
    }
    if let Some(graph)=self.project.native_point_bindings.as_ref(){
      if self.project.grade_run.is_some(){
        return Err("Existing grade run with native bindings requires bindings-grade-regenerate; catalog replacement refused".into());
      }
      graph.valid_against(&self.project.template)?;
      if !graph.source_matches(&self.project.template){
        return Err("Stale native point bindings refuse initial grade catalog bootstrap".into());
      }
    }
    let run:PersistedGradeRun=field(v,"gradeRun")?;
    // A direct native caller must not bypass the browser's correspondence
    // planner by submitting a complete replacement catalog that silently
    // redirects or removes an already-persisted external size identity.
    // Adding a new, nonconflicting alias remains permitted. Industrial CAD
    // receiving and prior exports depend on stable alias-to-geometry identity.
    if let Some(previous)=self.project.grade_run.as_ref(){
      for (alias,canonical) in &previous.size_correspondence {
        if run.size_correspondence.get(alias)!=Some(canonical) {
          return Err(format!("Existing external size correspondence {} must not be removed or redirected",alias));
        }
      }
      if !previous.size_correspondence.is_empty() || !run.size_correspondence.is_empty() {
        // The browser's F7 correspondence planner changes alias metadata
        // only. A direct IPC client must not use this same operation to
        // reorder graded templates, replace one physical size's geometry,
        // change a POM spec, or rebase the size chart under unchanged aliases.
        // Legitimate graded geometry evolution requires the qualified
        // source-dependent regeneration operation and its full integrity QA.
        let mut old=previous.clone();
        let mut next=run.clone();
        if old.schema_version==1 && next.schema_version==2 {old.schema_version=2;}
        old.size_correspondence.clear();
        next.size_correspondence.clear();
        if serde_json::to_value(&old).map_err(|error|error.to_string())?
          !=serde_json::to_value(&next).map_err(|error|error.to_string())? {
          return Err("External size correspondence commit must preserve the exact canonical size order, graded geometry and metrology".into());
        }
      }
    }
    // A complete immutable candidate is verified before updating the session.
    run.validate(&self.project.template)?;
    let mut candidate=self.project.clone();candidate.grade_run=Some(run);
    // Validate the fitting project and all six source-linked variants.
    candidate.compile()?;
    // Preserve the previous native save on failed validation or disk writes.
    // The Node bridge's canonical workspace JSON still requires its own save RPC.
    let path=PathBuf::from(std::env::args().nth(2).ok_or("save path missing")?);
    let temporary=path.with_extension("grade-run-next.tmp");
    candidate.state=Some(self.scene.state.clone());
    commit_direct_grade_with_history(self,&candidate,&path,&temporary)?;
    self.project.grade_run=candidate.grade_run;
    self.revision+=1;
    return Ok(json!({"revision":self.revision,"gradeRunCommitted":true,
      "sizeActivated":false,"manufacturingApproved":false}));
   },
   "grade-notch-commit"=>{
    if self.project.fabric_grade_envelope.is_some() {
      return Err("Native fabric grade envelope requires dedicated notch dependency regeneration".into());
    }
    if self.project.native_facing_dependency.is_some() {
      return Err("Native facing dependency blocks direct notch changes".into());
    }
    let panel_id:String=field(v,"panelId")?;
    let edge_id:String=field(v,"edgeId")?;
    let t:f64=field(v,"t")?;
    let depth_mm:f64=field(v,"depthMm")?;
    if panel_id.is_empty()||edge_id.is_empty()||!t.is_finite()||t<=0.000001||t>=0.999999
      ||!depth_mm.is_finite()||depth_mm<=0.||depth_mm>25. {
      return Err("Physical grade notch requires valid panel, edge, interior t and depth (0,25] mm".into());
    }
    let mut candidate=self.project.clone();
    let mut run=candidate.grade_run.take().ok_or("Saved native six-size grade catalog required")?;
    run.validate(&candidate.template)?;
    let insert=|template:&mut marvelous_cloth::garment::template::GarmentTemplate|->Result<(),String>{
      let panel=template.panels.iter_mut().find(|p|p.id==panel_id).ok_or("Native notch panel missing")?;
      let poly=panel.polygon.as_mut().ok_or("Native notch polygon missing")?;
      if !poly.edges.iter().any(|edge|edge==&edge_id){return Err("Native notch named edge missing".into())}
      let notch=marvelous_cloth::garment::polygon::EdgeNotch{t,depth_m:depth_mm/1000.};
      poly.notch_segment(&edge_id,&notch)?;
      let marks=poly.notches.entry(edge_id.clone()).or_default();
      if marks.iter().any(|mark|(mark.t-t).abs()<1e-8){return Err("Duplicate physical grade notch station".into())}
      marks.push(notch);
      Ok(())
    };
    insert(&mut candidate.template)?;
    for template in &mut run.graded_templates {insert(template)?;}
    run.base_template=candidate.template.clone();
    candidate.grade_run=Some(run.clone());
    run.validate(&candidate.template)?;
    candidate.compile()?;
    // A graded size may extend beyond the base authored pattern envelope.
    // PersistedGradeRun::validate and graded scene activation both compile a
    // disposable, widened grade-only view while keeping the exact stored
    // source/graded patterns unchanged. Use that SAME verified contract here;
    // compiling the unchanged stored template directly rejects legitimate
    // positive grade growth ("Polygon outside declared pattern bounds") and
    // prevents atomic physical-notch propagation to all six sizes.
    for template in &run.graded_templates {
      PersistedGradeRun::compilation_template_for_size(template)?;
    }
    let garment=candidate.template.compile()?;
    let path=PathBuf::from(std::env::args().nth(2).ok_or("save path missing")?);
    let temporary=path.with_extension("grade-notch-next.tmp");
    candidate.state=None;candidate.mesh_signature=None;
    commit_direct_grade_with_history(self,&candidate,&path,&temporary)?;
    self.apply_edit(authoring::Edit{template:candidate.template.clone(),garment,selected:None,reset_simulation:true,new_point:None});
    self.project.grade_run=Some(run);
    let mut receipt=self.snapshot(true,true);
    receipt["gradeNotchCommitted"]=json!(true);
    receipt["gradeNotchReceipt"]=json!({"panelId":panel_id,"edgeId":edge_id,"t":t,
      "depthMm":depth_mm,"sizes":["XS","S","M","L","XL","XXL"],"manufacturingApproved":false});
    return Ok(receipt);
   },
   "grade-run-clear"=>{
    if self.project.grade_run.is_some(){
      self.record_linked_history();
      self.project.grade_run=None;
      self.revision+=1;
    }
    return Ok(json!({"revision":self.revision,"gradeRunCommitted":false,"manufacturingApproved":false}));
   },
   "production-handoff"=>{
     // All four artifacts are evaluated against one immutable session revision.
     let revision=self.revision;
     let full=self.snapshot(false,false);
     let snapshot=json!({"revision":revision,"template":full["template"],
       "positions":full["positions"],"uv":full["uv"],"triangles":full["triangles"],
       "panels":full["panels"],"seams":full["seams"]});
     let audit=pattern_factory_audit(&self.project.template,revision)?;
     let mut cutlines=native_production_cutlines(&self.project.template,revision,None)?;
     if let Some(panels)=cutlines["panels"].as_array_mut(){for panel in panels {
       if let Some(row)=panel.as_object_mut(){row.remove("svg");row.remove("dxf");}
     }}
     let mut blockers:Vec<String>=Vec::new();
     if let Some(items)=audit["releaseBlockers"].as_array(){for item in items {if let Some(s)=item.as_str(){blockers.push(s.to_owned());}}}
     if cutlines["blockedCount"].as_u64().unwrap_or(0)>0 {blockers.push("One or more native cutlines failed generation".into());}
     blockers.push("3D fit and physical factory proof have not been certified".into());
     // Mesh identifiers and complete snapshot geometry travel together; proofs
     // remain explicitly unapproved even if every cutline is generated.
     return Ok(json!({"format":"exo-native-production-handoff.v1","revision":revision,
       "snapshot":snapshot,"patternAudit":audit,"cutlineProof":cutlines,
       "releaseBlockers":blockers,"manufacturerReady":false,"atomic":true}));
   },
   "pattern-audit"=>return pattern_factory_audit(&self.project.template,self.revision),
   "production-cutlines"=>return native_production_cutlines(&self.project.template,self.revision,v["panel"].as_str()),
   "pleat-guides"=>{
     let panel=field::<String>(v,"panel")?;
     let orientation=field::<String>(v,"orientation")?;
     let spacing=field::<f64>(v,"spacing_mm")?;
     let inset=field::<f64>(v,"inset_mm")?;
     let selected=self.project.template.panels.iter().find(|p|p.id==panel).ok_or("Panel not found")?;
     let polygon=selected.polygon.as_ref().ok_or("Pleat guides require an editable polygon")?;
     let guides=pleat_guide_points(polygon,&orientation,spacing,inset)?;
     let mut template=self.project.template.clone();
     let mut final_edit=None;
     for points in guides {
       let edit=authoring::apply(&template,Command::InternalLine{panel:panel.clone(),points:points.to_vec(),tangents:vec![DVec2::ZERO;2]})?;
       template=edit.template.clone();final_edit=Some(edit);
     }
     let edit=final_edit.ok_or("No pleat guides generated")?;
     let lines=&template.panels.iter().find(|p|p.id==panel).ok_or("Panel missing after pleat edit")?.polygon.as_ref().ok_or("Polygon missing after pleat edit")?.lines;
     let ids:std::collections::HashSet<_>=lines.iter().map(|l|l.id.as_str()).collect();
     if ids.len()!=lines.len() {return Err("Duplicate internal guide identifiers".into())}
     self.record_linked_history();self.apply_edit(edit);
   },
   "tuck-fold-sew-batch"=>{
    let commands=v["commands"].as_array().ok_or("Missing tuck fold commands")?;
    if commands.is_empty()||commands.len()>32{return Err("Batch requires 1 to 32 tuck fold commands".into())}
    let mut template=self.project.template.clone();
    let mut final_edit=None;
    for item in commands {
     if item["kind"]!="TuckFoldSew" {return Err("Only TuckFoldSew is supported in a physical tuck fold batch".into())}
     let edit=authoring::apply(&template,command(item)?)?;
     template=edit.template.clone();final_edit=Some(edit);
    }
    // Validate every intermediate construction before one undo/history commit.
    self.record_linked_history();self.apply_edit(final_edit.unwrap());
   },
   "grade-pattern"=>{
     let panel=field::<String>(v,"panel")?;
     let width=field::<f64>(v,"width_delta_mm")?;
     let height=field::<f64>(v,"height_delta_mm")?;
     let source=self.project.template.panels.iter().find(|p|p.id==panel).ok_or("Panel not found")?;
     let polygon=source.polygon.as_ref().ok_or("Grade requires an editable polygon pattern")?;
     if width!=0. || height!=0. {
       let polygon=graded_polygon(polygon,width,height)?;
       let edit=authoring::apply(&self.project.template,Command::Shape{panel,polygon})?;
       self.record_linked_history();self.apply_edit(edit);
     }
   },
   "graphics-set"=>{
     let records:Vec<PrintGraphic>=field(v,"printGraphics").or_else(|_|field(v,"graphics"))?;
     self.project.validate_print_graphics(&records)?;
     if serde_json::to_value(&records).map_err(|e|e.to_string())?
       !=serde_json::to_value(&self.project.print_graphics).map_err(|e|e.to_string())? {
       self.record_linked_history();
       self.project.print_graphics=records;
       self.revision+=1;
     }
   },
   "hardware-set"=>{
     let placements:Vec<ImportedHardware>=field(v,"importedHardware")?;
     self.project.validate_imported_hardware(&placements)?;
     if placements!=self.project.imported_hardware {
       self.record_linked_history();
       if let Some(kind)=self.hardware_steps_undo.last_mut(){*kind=true;}
       self.project.imported_hardware=placements;
       self.revision+=1;
     }
   },
   "hardware-undo"=>{
     if self.hardware_steps_undo.last()!=Some(&true) {
       return Err("The latest global edit is not imported hardware; use global Undo in chronological order".into());
     }
     self.restore_linked_history(false)?;
   },
   "hardware-redo"=>{
     if self.hardware_steps_redo.last()!=Some(&true) {
       return Err("The next global Redo is not imported hardware; use global Redo in chronological order".into());
     }
     self.restore_linked_history(true)?;
   },
   // CLO information field backed by the real upstream template. IDs remain
   // stable for sewing, history and selection; renaming never remeshes cloth.
   "set-property"=>{
     // Source display names are part of the catalog's exact base-template
     // identity. Renaming only the base would make every saved grade fail its
     // next revision-pinned reload. Preserve the catalog until it is detached.
     if self.project.grade_run.is_some(){return Err("Detach the saved grading catalog before renaming native pattern or fabric metadata".into());}
     let target=field::<String>(v,"target")?;
     let id=field::<String>(v,"id")?;
     let key=field::<String>(v,"field")?;
     let value=field::<String>(v,"value")?;
     if key!="name" {return Err("Only native name is supported; itemNo is workspace metadata".into())}
     if value.trim().is_empty() || value.chars().count()>120 || value.chars().any(|c|c.is_control()) {
       return Err("Name must contain 1–120 printable characters".into())
     }
     let mut template=self.project.template.clone();
     let previous=match target.as_str(){
       "panel"=>{let item=template.panels.iter_mut().find(|p|p.id==id).ok_or("Panel not found")?;std::mem::replace(&mut item.name,value.clone())},
       "fabric"=>{let item=template.fabrics.iter_mut().find(|f|f.id==id).ok_or("Fabric not found")?;std::mem::replace(&mut item.name,value.clone())},
       _=>return Err("Property target must be panel or fabric".into())
     };
     if previous!=value {
       self.record_linked_history();
       self.project.template=template;self.project.piece_variant=None;self.revision+=1;
     }
   },
   // Annotate a selected contour's target dimension without invoking
   // authoring::TargetLength, which actually reshapes the contour and can
   // invalidate existing sewn lengths. This is explicitly a non-physical
   // drafting specification: mesh, seam constraints and solver stay untouched.
   "line-spec"=>{
     if self.project.grade_run.is_some(){return Err("Detach the saved grading catalog before changing source edge specifications".into());}
     let panel=field::<String>(v,"panel")?;
     let edge=field::<String>(v,"edge")?;
     let length=field::<f64>(v,"target_m")?;
     if !length.is_finite() || !(0.0001..=10.0).contains(&length){return Err("Invalid target line length".into())}
     let mut template=self.project.template.clone();
     let p=template.panels.iter_mut().find(|p|p.id==panel).ok_or("Panel not found")?;
     let polygon=p.polygon.as_mut().ok_or("Panel has no editable named edges")?;
     if !polygon.edges.iter().any(|id|id==&edge){return Err("Named boundary not found".into())}
     if polygon.target_lengths.get(&edge).copied()!=Some(length) {
       polygon.target_lengths.insert(edge,length);
       self.record_linked_history();
       self.project.template=template;self.project.piece_variant=None;self.revision+=1;
     }
   },
   // Transactional, solver-backed edit of an existing sewing relationship.
   // Unlike simply drawing seam guides, this changes the compiled native
   // correspondence/orientation, easing and coupling coefficient. A failed
   // compile changes neither the document nor its undo history.
   "edit-seam"=>{
     let id=field::<String>(v,"seam")?;
     let reverse=field::<bool>(v,"reverse")?;
     let ease=field::<bool>(v,"ease")?;
     let stiffness=field::<f64>(v,"stiffness")?;
     if !stiffness.is_finite() || !(1_000.0..=1_000_000.0).contains(&stiffness) {
       return Err("Seam stiffness must be 1,000–1,000,000 N/m²".into())
     }
     let mut template=self.project.template.clone();
     let seam=template.seams.iter_mut().find(|s|s.id==id).ok_or("Sewing relationship not found")?;
     if seam.reverse_b!=reverse || seam.allow_ease!=ease || (seam.stiffness-stiffness).abs()>1e-9 {
       if self.project.grade_run.is_some() || self.project.native_point_bindings.is_some(){
         return Err("Changing a sewn seam with saved grades or native point bindings requires qualified dependency regeneration".into());
       }
       seam.reverse_b=reverse;seam.allow_ease=ease;seam.stiffness=stiffness;
       let garment=template.compile()?;
       self.record_linked_history();
       self.apply_edit(authoring::Edit{
         template,garment,selected:None,reset_simulation:true,new_point:None
       });
     }
   },
   // Endpoint editing operates on the existing native seam identity. Both
   // boundary references are replaced together and compiled before committing
   // a single history entry, so a stale/overlapping/invalid selection cannot
   // leave a partially mutated stitch graph.
   "edit-seam-ends"=>{
     let id=field::<String>(v,"seam")?;
     let a=field::<marvelous_cloth::garment::seam::BoundaryRef>(v,"a")?;
     let b=field::<marvelous_cloth::garment::seam::BoundaryRef>(v,"b")?;
     let mut template=self.project.template.clone();
     if template.seams.iter().filter(|s|s.id==id).count()!=1 {
       return Err("Edit Sewing needs one existing, uniquely identified native seam".into());
     }
     let seam=template.seams.iter_mut().find(|s|s.id==id).ok_or("Sewing relationship not found")?;
     let reverse=if v.get("reverse").is_some(){field::<bool>(v,"reverse")?}else{seam.reverse_b};
     let ease=if v.get("ease").is_some(){field::<bool>(v,"ease")?}else{seam.allow_ease};
     let stiffness=if v.get("stiffness").is_some(){field::<f64>(v,"stiffness")?}else{seam.stiffness};
     if !stiffness.is_finite() || !(1_000.0..=1_000_000.0).contains(&stiffness) {
       return Err("Seam stiffness must be 1,000–1,000,000 N/m²".into());
     }
     for end in [&a,&b] {
       if end.panel.trim().is_empty() || !end.range.iter().all(|n|n.is_finite())
         || end.range[0]<0. || end.range[1]>1. || end.range[1]-end.range[0]<1e-9 {
         return Err("Edit Sewing requires finite boundaries with 0 <= start < end <= 1".into());
       }
     }
     let changed=serde_json::to_value(&seam.a).map_err(|e|e.to_string())?!=serde_json::to_value(&a).map_err(|e|e.to_string())?
       || serde_json::to_value(&seam.b).map_err(|e|e.to_string())?!=serde_json::to_value(&b).map_err(|e|e.to_string())?
       || seam.reverse_b!=reverse || seam.allow_ease!=ease || seam.stiffness!=stiffness;
     if changed {
       if self.project.grade_run.is_some() || self.project.native_point_bindings.is_some(){
         return Err("Changing seam endpoints with saved grades or native point bindings requires qualified dependency regeneration".into());
       }
       seam.a=a;seam.b=b;seam.reverse_b=reverse;seam.allow_ease=ease;seam.stiffness=stiffness;
       // Native compilation validates edge existence, interval ownership,
       // physical lengths and all retained notch correspondences.
       let garment=template.compile()?;
       self.record_linked_history();
       self.apply_edit(authoring::Edit{template,garment,selected:None,reset_simulation:true,new_point:None});
     }
   },
   // Trace a complete straight-edged 2D contour as a NEW, independent native
   // pattern. Reject shapes we cannot reproduce exactly (curves and holes).
   // Rust Polygon validates topology and compiles before history is recorded.
   "trace-contour"=>{
     let source=field::<String>(v,"panel")?;
     if self.project.grade_run.is_some() || self.project.native_point_bindings.is_some(){
       return Err("Trace contour requires qualified dependency regeneration while grades or native point bindings are saved".into());
     }
     let original=self.project.template.panels.iter().find(|p|p.id==source).ok_or("Trace source panel not found")?;
     let polygon=original.polygon.as_ref().ok_or("Trace requires an editable polygon contour")?;
     if !polygon.curves.is_empty() || !polygon.holes.is_empty() {
       return Err("Trace currently supports straight outer contours without holes; edit curves or holes before tracing".into())
     }
     let edit=authoring::apply(&self.project.template,Command::Polygon{
       points:polygon.points.clone(),tangents:Vec::new(),
       meshing:polygon.meshing.clone().unwrap_or_default(),fabric:original.fabric.clone(),replace:false
     })?;
     self.record_linked_history();self.apply_edit(edit);
   },
   "edit-batch"=>{
    let commands=v["commands"].as_array().ok_or("Missing commands")?;
    if commands.is_empty()||commands.len()>256{return Err("Batch requires 1 to 256 commands".into())}
    if self.project.grade_run.is_some(){
      return Err("Saved six-size grade catalog requires qualified regeneration before edit-batch".into());
    }
    // Independent-panel Anchor edits may be committed in one native history
    // transaction. A second Anchor on the same panel would use coordinates
    // from before the first edit's local-origin normalization; reject it.
    let layout=commands.iter().all(|item|item["kind"]=="BoardTransform");
    let anchors=commands.iter().all(|item|item["kind"]=="Anchor"||item["kind"]=="AnchorGroup");
    if !layout && !anchors {return Err("Batch requires homogeneous BoardTransform or Anchor operations".into())}
    if anchors {
     if commands.len()>32{return Err("Atomic point batch exceeds 32 panels".into())}
     let mut seen=std::collections::BTreeSet::new();
     for item in commands {
      let panel=field::<String>(item,"panel")?;
      if !seen.insert(panel){return Err("Atomic Anchor batch requires distinct pattern panels".into())}
     }
    }
    let mut template=self.project.template.clone();let mut final_edit=None;
    for item in commands {let edit=authoring::apply(&template,command(item)?)?;template=edit.template.clone();final_edit=Some(edit);}
    let next_bindings=if v.get("nativeBindings").is_some(){
      Some(authored_native_bindings(&template,&v["nativeBindings"])?)
    }else{None};
    // A caller-provided replacement graph is not proof that the existing
    // dependency graph was regenerated. Its prior rules and dependents must
    // survive through an explicitly qualified native transaction.
    if self.project.native_point_bindings.is_some()
      && serde_json::to_value(&template).map_err(|e|e.to_string())?
        !=serde_json::to_value(&self.project.template).map_err(|e|e.to_string())? {
      return Err("Native point bindings require qualified regeneration before changed edit-batch geometry".into());
    }
    // No document or history mutation until every edit has validated.
    self.record_linked_history();self.apply_edit(final_edit.unwrap());
    if let Some(bindings)=next_bindings{self.project.native_point_bindings=Some(bindings);}
   },
   "edit"=>{
    let requested=command(&v["command"])?;
    if self.project.grade_run.is_some() && self.project.native_point_bindings.is_none(){
      return Err("Saved six-size grade catalog requires qualified regeneration before source edits".into());
    }
    if self.project.fabric_grade_envelope.is_some() && !matches!(requested,Command::Anchor{..}) {
      return Err("Fabric grade envelope permits only qualified bound Anchor regeneration; clear envelope for other edits".into());
    }
    // An ordinary authenticated source Anchor should regenerate the saved
    // native reference graph transparently. The qualification and complete
    // geometry compilation happen before the single history transaction.
    if let Some(graph)=self.project.native_point_bindings.as_ref() {
     if !graph.source_matches(&self.project.template) &&
       matches!(requested,Command::Anchor{..}|Command::AnchorGroup{..}) {
      return Err("Stale native source graph blocks ordinary Anchor edits until bindings are rebased".into());
     }
     if let Command::Anchor{panel,anchor,position}=requested {
      if self.project.fabric_grade_envelope.is_some() &&
         !(self.project.grade_run.is_some() &&
           graph.bindings.iter().any(|rule|rule.panel_id==panel && rule.point_index==anchor)) {
        return Err("Fabric grade envelope rejects unqualified Anchor source edit".into());
      }
      if self.project.grade_run.is_some() &&
       graph.bindings.iter().any(|rule|rule.panel_id==panel && rule.point_index==anchor){
       if self.project.native_facing_dependency.is_some() || self.project.piece_variant.is_some(){
         return Err("Bound Anchor with derived facing or piece variant requires bindings-grade-regenerate".into());
       }
       let (name,mm)=infer_native_bound_polar_measurement_20261027(&self.project,&panel,anchor,position)?;
       let overrides=std::collections::BTreeMap::from([(name,mm)]);
       if let Some(envelope)=&self.project.fabric_grade_envelope {envelope.preflight(&self.project,&overrides)?;}
       let (template,run,rebased,_proof)=marvelous_cloth::native_six_size_recompute_20261027::recompute_native_six_size_measurement20261027(
        &self.project,&overrides)?;
       let mut candidate=self.project.clone();
       candidate.template=template.clone();candidate.grade_run=Some(run.clone());
       candidate.native_point_bindings=Some(rebased.clone());
       if let Some(envelope)=candidate.fabric_grade_envelope.as_mut(){
         envelope.rebase_after_measurement_change(graph,&rebased,&template)?;
       }
       candidate.piece_variant=None;
       candidate.state=None;candidate.mesh_signature=None;
       candidate.compile()?;
       if let Some(envelope)=&candidate.fabric_grade_envelope {envelope.validate(&candidate)?;}
       let garment=template.compile()?;
       self.record_linked_history();
       self.apply_edit(authoring::Edit{template,garment,selected:None,reset_simulation:true,new_point:None});
       self.project.grade_run=Some(run);self.project.native_point_bindings=Some(rebased);
       self.project.fabric_grade_envelope=candidate.fabric_grade_envelope;
      }else if !graph.bindings.iter().any(|rule|rule.panel_id==panel && rule.point_index==anchor) &&
        graph.bindings.iter().any(|rule|rule.panel_id==panel) {
       if self.project.grade_run.is_some(){
        return Err("Automatic native Anchor regeneration with saved six-size grades requires a qualified grade-aware reference solver".into());
       }
       let expected=self.project.template.panels.iter().find(|p|p.id==panel)
         .and_then(|p|p.polygon.as_ref()).and_then(|poly|poly.points.get(anchor))
         .copied().ok_or("Native source Anchor is missing")?;
       let (edit,rebased,_changed)=marvelous_cloth::native_reference_recompute_20261027::recompute_native_reference_anchor_20261027(
         &self.project.template,graph,&panel,anchor,expected,position)?;
       self.record_linked_history();self.apply_edit(edit);
       self.project.native_point_bindings=Some(rebased);
      }else{
       return Err("Native bound point or unrelated Anchor cannot bypass installed reactive graph".into());
      }
     }else{
      if matches!(requested,Command::AnchorGroup{..}){
       return Err("Native AnchorGroup edits require explicit graph-aware recomputation when bindings are active".into());
      }
      // Permit commands whose resulting source template is identical, while
      // refusing any unqualified geometry or topology mutation atomically.
      let edit=authoring::apply(&self.project.template,requested)?;
      if serde_json::to_value(&edit.template).map_err(|e|e.to_string())?
        !=serde_json::to_value(&self.project.template).map_err(|e|e.to_string())? {
        return Err("Native point bindings require qualified regeneration for changed source topology or geometry".into());
      }
      self.record_linked_history();self.apply_edit(edit);
     }
    }else{
     if self.project.fabric_grade_envelope.is_some(){return Err("Fabric envelope requires saved source bindings".into());}
     let edit=authoring::apply(&self.project.template,requested)?;
     self.record_linked_history();self.apply_edit(edit);
    }
   },
   "undo"|"redo"=>{self.restore_linked_history(op=="redo")?;},
   "reset"=>{self.scene.state=self.scene.garment.initial_state.clone();self.solver=None;self.grab=None;self.live_grab=false;self.metrics=Value::Null;self.revision+=1;},
   // CLO-style *post-simulation* rigid reposition of one draped garment panel.
   // Unlike authored Place, this preserves its draped fold geometry and the
   // EXACT coordinates of every other sewn panel while moving the chosen one.
   // Seam constraints stay connected and are resolved on subsequent steps.
   "pose-panel"=>{
     let id=field::<String>(v,"panel")?;
     let delta=field::<[f64;3]>(v,"translation_delta")?;
     let rotate=field::<[f64;3]>(v,"rotation_delta_degrees")?;
     if !delta.iter().all(|n|n.is_finite())||!rotate.iter().all(|n|n.is_finite())
       || DVec3::from_array(delta).length()>1.75 || rotate.iter().any(|n|n.abs()>360.)
       {return Err("Invalid or excessive rigid drape motion".into())}
     let range=self.scene.garment.panels.iter().find(|p|p.id==id).ok_or("Panel not found")?.vertices.clone();
     if range.is_empty(){return Err("Panel has no physics vertices".into())}
     let origin=self.scene.state.x[range.clone()].iter().copied().sum::<DVec3>()/(range.len() as f64);
     let rot=DQuat::from_euler(EulerRot::XYZ,rotate[0].to_radians(),rotate[1].to_radians(),rotate[2].to_radians());
     let move_by=DVec3::from_array(delta);
     for i in range {
       let p=self.scene.state.x[i];
       self.scene.state.x[i]=origin + rot*(p-origin) + move_by;
       self.scene.state.v[i]=DVec3::ZERO;
     }
     self.solver=None;self.grab=None;self.live_grab=false;self.metrics=Value::Null;self.revision+=1;
   },
   // Experimental CLO-style direct grab of simulated cloth. Modify only the
   // specified panel's current positions; keep all OTHER simulated panels
   // numerically untouched. The next physics step rebuilds its contact cache.
   // Never claim the resulting stretched geometry is penetration-free.
   "pull-panel"=>{
    let panel=field::<String>(v,"panel")?;
    let vertex=field::<usize>(v,"vertex")?;
    let target=field::<[f64;3]>(v,"target")?;
    let radius=v["radius_m"].as_f64().unwrap_or(0.16);
    if !target.iter().all(|n|n.is_finite()&&n.abs()<20.0)||!radius.is_finite()||!(0.015..=0.5).contains(&radius){return Err("Invalid grab target or brush radius".into())}
    let range=self.scene.garment.panels.iter().find(|p|p.id==panel).ok_or("Panel not found")?.vertices.clone();
    if !range.contains(&vertex){return Err("Grab vertex must belong to the selected panel".into())}
    let anchor=self.scene.state.x[vertex];
    let desired=DVec3::from_array(target);
    let delta=desired-anchor;
    if delta.length()>2.0{return Err("Grab displacement exceeds safe 2 m limit".into())}
    if self.scene.garment.mesh.pins[vertex].is_some(){return Err("Cannot grab a fixed cloth pin".into())}
    let original=self.scene.state.x[range.clone()].to_vec();
    let mut count=0;
    for (local,index) in range.enumerate(){
      let distance=original[local].distance(anchor);
      // Compact C2 brush: motion ends exactly at the requested radius.
      // This avoids dragging remote vertices on the same panel on every move.
      if distance>=radius || self.scene.garment.mesh.pins[index].is_some(){continue}
      let t=distance/radius;
      let weight=1.0-10.0*t.powi(3)+15.0*t.powi(4)-6.0*t.powi(5);
      self.scene.state.x[index]+=delta*weight;
      self.scene.state.v[index]*=1.0-weight;
      count+=1;
    }
    if count==0{return Err("No cloth vertices in grab radius".into())}
    // Hold the picked vertex through one native VBD solve so membrane,
    // bending, seams and OGC contacts react to the pull. Release after that
    // step to avoid leaving an invisible permanent pin in the simulation.
    self.live_grab=false;self.grab=Some(Grab{vertices:[vertex;3],weights:[1.0,0.0,0.0],target:desired,stiffness:1.0e4});
    self.solver=None;self.metrics=Value::Null;self.revision+=1;
   },
   "grab"=>{self.set_live_grab(&v["grab"])?;},
   "step"=>{
    if let Some(value)=v.get("grab"){self.set_live_grab(value)?;}
    let count=v["steps"].as_u64().unwrap_or(1);if !(1..=4).contains(&count){return Err("Step batch must be 1–4".into())}
    if self.solver.is_none(){self.solver=Some(VbdSolver::new(self.scene.garment.clone(),Some(&self.scene.collider.surface),&self.scene.state)?)}
    let settings=VbdSettings{dt:1.0/60.0,iterations:16,..Default::default()};
    for _ in 0..count {
 // A failed contact solve must never persist partially written cloth
 // particles. Recover the last valid state and recreate solver caches for
 // the next user action (Move/Reset/SIM), rather than saving a broken drape.
 let before_step=self.scene.state.clone();
 #[cfg(feature="desktop")]
 let outcome=if let Some(gpu)=&self.gpu{gpu.step(self.solver.as_mut().unwrap(),&mut self.scene.state,&settings,self.grab.as_ref())}else{self.solver.as_mut().unwrap().step(&mut self.scene.state,&settings,self.grab.as_ref())};
 #[cfg(not(feature="desktop"))]
 let outcome=self.solver.as_mut().unwrap().step(&mut self.scene.state,&settings,self.grab.as_ref());
 let metric=match outcome {
  Ok(metric)=>metric,
  Err(error)=>{
   self.scene.state=before_step;
   self.solver=None;
   self.grab=None;
   self.live_grab=false;
   self.metrics=Value::Null;
   return Err(error.into());
  }
 };
 if !self.live_grab {self.grab=None;}
 self.metrics=serde_json::to_value(metric).map_err(|e|e.to_string())?;self.revision+=1;
 }
   },
   "save"=>{
    let mut p=self.project.clone();
    let next_stamp=NativeCommitIdentityV1::next(self.commit_identity.as_ref())?;
    p.native_commit=Some(next_stamp.clone());
    let persist_scene=self.base_variant_scene.as_ref()
      .or(self.base_grade_scene.as_ref()).unwrap_or(&self.scene);
    p.state=Some(persist_scene.state.clone());
    let file=PathBuf::from(std::env::args().nth(2).ok_or("save path missing")?);
    if let Some(dir)=file.parent(){std::fs::create_dir_all(dir).map_err(|e|e.to_string())?;}
    // An out-of-space write must never truncate the previous native project.
    let temporary=file.with_extension("save-next.tmp");
    if let Err(error)=p.save(&temporary){let _=std::fs::remove_file(&temporary);return Err(error);}
    let saved:Value=serde_json::from_str(&std::fs::read_to_string(&temporary).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    let reopened:FittingProject=serde_json::from_value(saved.clone()).map_err(|e|e.to_string())?;
    let mut journal=self.export_history(&reopened)?;
    journal.commit=Some(next_stamp.clone());
    let sidecar=history_path(&file);
    let pending=history_path(&temporary);
    let bytes=serde_json::to_vec(&journal).map_err(|e|e.to_string())?;
    if let Err(error)=std::fs::write(&pending,bytes){let _=std::fs::remove_file(&pending);let _=std::fs::remove_file(&temporary);return Err(error.to_string());}
    // Both staged files must reach stable storage before either rename. Once
    // the project rename commits, keep pending history on later failures so
    // restart can recover the matching transaction.
    sync_saved_file(&temporary)?;
    sync_saved_file(&pending)?;
    sync_saved_directory(&file)?;
    if let Err(error)=std::fs::rename(&temporary,&file){let _=std::fs::remove_file(&pending);let _=std::fs::remove_file(&temporary);return Err(error.to_string());}
    // The native project has now committed: any following fsync/journal
    // promotion error must retain the pending history AND make this in-memory
    // session read-only until an exact-digest cold reopen. Retrying an edit
    // with stale source ownership would otherwise trample the new project.
    let finish=||->Result<(),String>{
     sync_saved_directory(&file)?;
     std::fs::rename(&pending,&sidecar).map_err(|e|e.to_string())?;
     sync_saved_directory(&file)
    };
    if let Err(error)=finish(){
     self.recovery_required=true;
     return Err(format!("NATIVE_PROJECT_COMMITTED_HISTORY_RECOVERY_REQUIRED: {error}"));
    }
    self.commit_identity=journal.commit.clone();
    self.project.native_commit=journal.commit.clone();
    return Ok(json!({"project":saved,"revision":self.revision,"nativeCommit":self.commit_identity,"activeGradedSize":self.active_grade_size,"manufacturingApproved":false}));
   },
   "snapshot"=>{},_=>return Err("Unknown session operation".into())
  }
  Ok(self.snapshot(v["avatar"].as_bool().unwrap_or(false),v["graphics"].as_bool().unwrap_or(false)))
 }
}
#[cfg(test)]
mod native_saved_measurement_bindings_tests {
 use super::*;
 fn session()->Session {
  let avatar=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/makehuman/mannequin.obj");
  Session::new(FittingProject::basic(GarmentKind::Tshirt,2,avatar)).unwrap()
 }
 fn payload(panel:&str)->Value{
  json!({"measurements":{"chest":{"valueMm":930.0},"frontWidth":{"formula":"chest / 2 - 20"}},
    "bindings":[{"id":"linked_front","panelId":panel,"pointIndex":1,
      "mode":"along","a":0,"b":1,"distanceFormula":"frontWidth","dependsOn":[]}]})
 }
 #[test]
 fn native_binding_graph_stores_real_source_and_rejects_forged_rules(){
  let mut session=session();
  let front=session.project.template.panels[0].id.clone();
  let good=payload(&front);
  let response=session.request(&json!({"op":"bindings-store","revision":0,"nativeBindings":good.clone()})).unwrap();
  assert_eq!(session.revision,1);
  assert_eq!(response["nativePointBindings"]["active"],true);
  assert!(session.project.native_point_bindings.as_ref().unwrap().source_matches(&session.project.template));
  let original=serde_json::to_value(&session.project).unwrap();
  let mut bad=good.clone();bad["bindings"][0]["pointIndex"]=json!(999);
  assert!(session.request(&json!({"op":"bindings-store","revision":1,"nativeBindings":bad})).is_err());
  assert_eq!(serde_json::to_value(&session.project).unwrap(),original);
  let mut cycle=good.clone();
  cycle["bindings"][0]["dependsOn"]=json!(["linked_front"]);
  assert!(session.request(&json!({"op":"bindings-store","revision":1,"nativeBindings":cycle})).is_err());
  let mut forged=good.clone();forged["sourceTemplate"]=json!({"malicious":"source"});
  assert!(session.request(&json!({"op":"bindings-store","revision":1,"nativeBindings":forged})).is_err());
  let mut injection=good.clone();
  injection["measurements"]["frontWidth"]["formula"]=json!("chest; doDangerousThing()");
  assert!(session.request(&json!({"op":"bindings-store","revision":1,"nativeBindings":injection})).is_err());
  let mut unbalanced=good.clone();
  unbalanced["bindings"][0]["distanceFormula"]=json!("(chest / 4");
  assert!(session.request(&json!({"op":"bindings-store","revision":1,"nativeBindings":unbalanced})).is_err());
  let mut reference=good.clone();
  reference["bindings"][0]["pointIndex"]=json!(0);
  assert!(session.request(&json!({"op":"bindings-store","revision":1,"nativeBindings":reference})).is_err());
  assert_eq!(session.revision,1);
 }
 #[test]
 fn native_graph_rejects_unqualified_annotations_and_undo_restores_bindings(){
  let mut session=session();
  let front=session.project.template.panels[0].id.clone();
  session.request(&json!({"op":"bindings-store","revision":0,"nativeBindings":payload(&front)})).unwrap();
  let before=serde_json::to_value(&session.project).unwrap();
  // A text annotation changes the exact source template fingerprint. The
  // current fail-closed contract requires detaching/rebasing saved bindings.
  assert!(session.request(&json!({"op":"edit","revision":1,
    "command":{"kind":"Annotation","panel":front,"id":null,"text":"new mark","position":[0.2,0.3]}})).is_err());
  assert_eq!(session.revision,1);
  assert_eq!(serde_json::to_value(&session.project).unwrap(),before);
  assert_eq!(session.snapshot(false,false)["nativePointBindings"]["active"],true);
  session.request(&json!({"op":"undo","revision":1})).unwrap();
  assert!(session.project.native_point_bindings.is_none());
  session.request(&json!({"op":"redo","revision":2})).unwrap();
  assert_eq!(session.snapshot(false,false)["nativePointBindings"]["active"],true);
 }
 #[test]
 fn grouped_material_edit_and_graph_install_refuse_invalid_graph_atomically(){
  let mut session=session();
  let panel=&session.project.template.panels[0];
  let panel_id=panel.id.clone();
  let old=panel.polygon.as_ref().unwrap().points[1];
  let point=[old.x+0.004,old.y];
  let commands=json!([{"kind":"AnchorGroup","panel":panel_id,
    "edits":[[1,point]]}]);
  let before=serde_json::to_value(&session.project).unwrap();
  let mut invalid=payload(&panel_id);
  invalid["bindings"][0]["panelId"]=json!("deleted-panel");
  assert!(session.request(&json!({"op":"edit-batch","revision":0,
    "commands":commands,"nativeBindings":invalid})).is_err());
  assert_eq!(serde_json::to_value(&session.project).unwrap(),before);
  assert_eq!(session.revision,0);
  let ok=session.request(&json!({"op":"edit-batch","revision":0,
    "commands":commands,"nativeBindings":payload(&panel_id)})).unwrap();
  assert_eq!(ok["nativePointBindings"]["active"],true);
  assert_eq!(session.revision,1);
  assert_ne!(serde_json::to_value(&session.project).unwrap(),before);
 }
 #[test]
 fn rule_only_store_replace_clear_have_consistent_one_step_undo_and_redo(){
  let mut s=session();
  let id=s.project.template.panels[0].id.clone();
  let source=serde_json::to_value(&s.project.template).unwrap();
  assert!(!s.history.can_undo());
  s.request(&json!({"op":"bindings-store","revision":0,"nativeBindings":payload(&id)})).unwrap();
  assert!(s.history.can_undo());
  assert_eq!(s.revision,1);
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["active"],true);
  let mut replacement=payload(&id);
  replacement["measurements"]["chest"]=json!({"valueMm":1010.0});
  s.request(&json!({"op":"bindings-store","revision":1,"nativeBindings":replacement})).unwrap();
  assert_eq!(s.revision,2);
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["measurements"]["chest"]["valueMm"],1010.0);
  s.request(&json!({"op":"bindings-clear","revision":2})).unwrap();
  assert_eq!(s.revision,3);
  assert!(s.project.native_point_bindings.is_none());
  s.request(&json!({"op":"undo","revision":3})).unwrap();
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["measurements"]["chest"]["valueMm"],1010.0);
  s.request(&json!({"op":"undo","revision":4})).unwrap();
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["measurements"]["chest"]["valueMm"],930.0);
  s.request(&json!({"op":"undo","revision":5})).unwrap();
  assert!(s.project.native_point_bindings.is_none());
  assert!(!s.history.can_undo());
  assert_eq!(serde_json::to_value(&s.project.template).unwrap(),source);
  s.request(&json!({"op":"redo","revision":6})).unwrap();
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["measurements"]["chest"]["valueMm"],930.0);
  s.request(&json!({"op":"redo","revision":7})).unwrap();
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["measurements"]["chest"]["valueMm"],1010.0);
  s.request(&json!({"op":"redo","revision":8})).unwrap();
  assert!(s.project.native_point_bindings.is_none());
  assert!(!s.history.can_redo());
  assert_eq!(serde_json::to_value(&s.project.template).unwrap(),source);
 }
 #[test]
 fn unqualified_material_batch_is_rejected_and_rule_only_history_stays_atomic(){
  let mut s=session();
  let id=s.project.template.panels[0].id.clone();
  let original=payload(&id);
  s.request(&json!({"op":"bindings-store","revision":0,"nativeBindings":original})).unwrap();
  let start=s.project.template.clone();
  let old=s.project.template.panels[0].polygon.as_ref().unwrap().points[1];
  let updated=json!([{"kind":"AnchorGroup","panel":id,"edits":[[1,[old.x+0.004,old.y]]]}]);
  let mut new_rule=payload(&id);
  new_rule["measurements"]["chest"]=json!({"valueMm":990.0});
  let before=serde_json::to_value(&s.project).unwrap();
  assert!(s.request(&json!({"op":"edit-batch","revision":1,"commands":updated,"nativeBindings":new_rule.clone()})).is_err(),
    "Caller-supplied replacement graph cannot bypass qualified source regeneration");
  assert_eq!(s.revision,1);
  assert_eq!(serde_json::to_value(&s.project).unwrap(),before);
  // A rule-only edit is allowed and must remain fully chronological.
  s.request(&json!({"op":"bindings-store","revision":1,"nativeBindings":new_rule})).unwrap();
  let latest=s.project.template.clone();
  assert_eq!(serde_json::to_value(&latest).unwrap(),serde_json::to_value(&start).unwrap());
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["measurements"]["chest"]["valueMm"],990.0);
  s.request(&json!({"op":"undo","revision":2})).unwrap();
  assert_eq!(serde_json::to_value(&s.project.template).unwrap(),serde_json::to_value(&start).unwrap());
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["measurements"]["chest"]["valueMm"],930.0);
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["active"],true);
  s.request(&json!({"op":"redo","revision":3})).unwrap();
  assert_eq!(serde_json::to_value(&s.project.template).unwrap(),serde_json::to_value(&latest).unwrap());
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["measurements"]["chest"]["valueMm"],990.0);
  s.request(&json!({"op":"undo","revision":4})).unwrap();
  s.request(&json!({"op":"bindings-clear","revision":5})).unwrap();
  assert!(!s.history.can_redo());
  assert!(s.project.native_point_bindings.is_none());
  assert_eq!(serde_json::to_value(&s.project.template).unwrap(),serde_json::to_value(&start).unwrap());
 }
}
#[cfg(test)]
mod atomic_parametric_anchor_batch_tests {
 use super::*;

 fn setup()->Session {
  let avatar=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/makehuman/mannequin.obj");
  Session::new(FittingProject::basic(GarmentKind::Tshirt,2,avatar))
   .expect("native tshirt with two or more authorable panels")
 }
 fn proposal(s:&Session,index:usize,dx:f64)->Value {
  let panel=&s.project.template.panels[index];
  let polygon=panel.polygon.as_ref().expect("source template polygon");
  let p=polygon.points[1];
  json!({"kind":"Anchor","panel":panel.id,"anchor":1,"position":[p.x+dx,p.y]})
 }

 #[test]
 fn two_distinct_pattern_panels_commit_one_history_revision_and_undo_redo(){
  let mut s=setup();
  assert!(s.project.template.panels.len()>=2);
  let before=serde_json::to_value(&s.project.template).unwrap();
  let commands=vec![proposal(&s,0,0.005),proposal(&s,1,0.006)];
  let snapshot=s.request(&json!({"op":"edit-batch","revision":0,"commands":commands}))
   .expect("atomic independent-panel changes");
  assert_eq!(s.revision,1);
  assert_eq!(snapshot["revision"],1);
  let after=serde_json::to_value(&s.project.template).unwrap();
  assert_ne!(after,before);
  s.request(&json!({"op":"undo","revision":1})).expect("one-step undo");
  assert_eq!(serde_json::to_value(&s.project.template).unwrap(),before);
  s.request(&json!({"op":"redo","revision":2})).expect("one-step redo");
  assert_eq!(serde_json::to_value(&s.project.template).unwrap(),after);
 }

 #[test]
 fn late_invalid_panel_and_same_panel_batch_leave_source_and_history_unchanged(){
  let mut s=setup();
  let before=serde_json::to_value(&s.project.template).unwrap();
  let valid=proposal(&s,0,0.005);
  let mut missing=proposal(&s,1,0.005);
  missing["panel"]=json!("deleted-pattern");
  assert!(s.request(&json!({"op":"edit-batch","revision":0,"commands":[valid.clone(),missing]})).is_err());
  assert_eq!(s.revision,0);
  assert_eq!(serde_json::to_value(&s.project.template).unwrap(),before);
  assert!(s.request(&json!({"op":"edit-batch","revision":0,"commands":[valid.clone(),valid]})).is_err());
  assert_eq!(s.revision,0);
  assert_eq!(serde_json::to_value(&s.project.template).unwrap(),before);
 }

 #[test]
 fn same_panel_anchor_group_updates_two_points_before_one_normalization(){
  let mut s=setup();
  let panel=&s.project.template.panels[0];
  let polygon=panel.polygon.as_ref().unwrap();
  let p1=polygon.points[1];let p2=polygon.points[2];
  let command=json!({"kind":"AnchorGroup","panel":panel.id,"edits":[
    [1,[p1.x+0.004,p1.y]],
    [2,[p2.x,p2.y+0.005]],
  ]});
  let before=serde_json::to_value(&s.project.template).unwrap();
  s.request(&json!({"op":"edit-batch","revision":0,"commands":[command]}))
   .expect("same-panel atomic group");
  let after=serde_json::to_value(&s.project.template).unwrap();
  assert_ne!(before,after);
  assert_eq!(s.revision,1);
  s.request(&json!({"op":"undo","revision":1})).unwrap();
  assert_eq!(serde_json::to_value(&s.project.template).unwrap(),before);
 }

 #[test]
 fn duplicate_and_late_invalid_anchor_group_both_fail_without_mutation(){
  let mut s=setup();
  let panel=&s.project.template.panels[0];
  let polygon=panel.polygon.as_ref().unwrap();
  let p=polygon.points[1];let panel_id=panel.id.clone();
  let before=serde_json::to_value(&s.project.template).unwrap();
  let duplicate=json!({"kind":"AnchorGroup","panel":panel_id,"edits":[
    [1,[p.x+0.004,p.y]],[1,[p.x+0.006,p.y]]
  ]});
  assert!(s.request(&json!({"op":"edit-batch","revision":0,"commands":[duplicate]})).is_err());
  let invalid=json!({"kind":"AnchorGroup","panel":panel_id,"edits":[
    [1,[p.x+0.004,p.y]],[999,[0.4,0.4]]
  ]});
  assert!(s.request(&json!({"op":"edit-batch","revision":0,"commands":[invalid]})).is_err());
  assert_eq!(s.revision,0);
  assert_eq!(serde_json::to_value(&s.project.template).unwrap(),before);
 }
}
#[cfg(test)]
mod native_edit_seam_ends_tests {
 use super::*;
 use marvelous_cloth::garment::{template::GarmentTemplate,seam::BoundaryRef};

 fn setup()->Session {
  let avatar=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/makehuman/mannequin.obj");
  let mut project=FittingProject::basic(GarmentKind::Tshirt,2,avatar);
  project.template=GarmentTemplate::two_panel_demo();
  Session::new(project).expect("two panel native seam fixture")
 }
 fn request(session:&mut Session,a:BoundaryRef,b:BoundaryRef)->Result<Value,String>{
  session.request(&json!({"op":"edit-seam-ends","revision":session.revision,
   "seam":"centre-seam","a":a,"b":b,"reverse":true,"ease":true,"stiffness":5000.0}))
 }

 #[test]
 fn endpoints_commit_once_keep_seam_identity_notches_and_undo_redo(){
  let mut s=setup();
  let original=serde_json::to_value(&s.project.template).unwrap();
  let mut a=s.project.template.seams[0].a.clone();
  let mut b=s.project.template.seams[0].b.clone();
  a.range=[0.1,0.9];b.range=[0.1,0.9];
  request(&mut s,a.clone(),b.clone()).expect("transaction compiles");
  assert_eq!(s.revision,1);
  assert_eq!(s.project.template.seams[0].id,"centre-seam");
  assert_eq!(s.project.template.seams[0].notches,vec![[0.5,0.5]]);
  assert_eq!(s.project.template.seams[0].a.range,a.range);
  assert!(s.history.can_undo());
  assert!(s.request(&json!({"op":"edit-seam-ends","revision":0,"seam":"centre-seam","a":a,"b":b})).is_err());
  s.request(&json!({"op":"undo","revision":1})).unwrap();
  assert_eq!(serde_json::to_value(&s.project.template).unwrap(),original);
  s.request(&json!({"op":"redo","revision":2})).unwrap();
  assert_eq!(s.project.template.seams[0].a.range,[0.1,0.9]);
 }

 #[test]
 fn invalid_reference_and_overlap_leave_document_and_history_untouched(){
  let mut s=setup();
  let original=serde_json::to_value(&s.project.template).unwrap();
  let a=s.project.template.seams[0].a.clone();
  let b=s.project.template.seams[0].b.clone();
  let mut invalid=a.clone();invalid.panel="unknown-panel".into();
  assert!(request(&mut s,invalid,b.clone()).is_err());
  assert!(s.request(&json!({"op":"edit-seam-ends","revision":0,"seam":"centre-seam",
   "a":a,"b":b,"reverse":"not-a-boolean"})).is_err());
  let mut invalid=a.clone();invalid.range=[0.8,0.2];
  assert!(request(&mut s,invalid,b.clone()).is_err());
  assert!(request(&mut s,a.clone(),a.clone()).is_err());
  let mut extra=s.project.template.seams[0].clone();
  extra.id="another-seam".into();extra.a.range=[0.0,0.4];extra.b.range=[0.0,0.4];
  s.project.template.seams.push(extra);
  let before_overlap=serde_json::to_value(&s.project.template).unwrap();
  let mut a2=a.clone();a2.range=[0.2,0.8];
  assert!(request(&mut s,a2,b).is_err());
  assert_eq!(serde_json::to_value(&s.project.template).unwrap(),before_overlap);
  assert!(!s.history.can_undo());assert_eq!(s.revision,0);
  assert_ne!(before_overlap,original);
 }
}
#[cfg(test)]
mod native_grade_activation_tests {
 use super::*;

 #[test]
 fn read_only_six_size_cutline_rpc_preserves_source_and_revision(){
  let avatar=PathBuf::from(env!("CARGO_MANIFEST_DIR"))
   .join("assets/makehuman/mannequin.obj");
  let mut project=FittingProject::basic(GarmentKind::Tshirt,2,avatar);
  for panel in &mut project.template.panels {
   let polygon=panel.polygon.as_mut().unwrap();
   for edge in &polygon.edges {polygon.seam_allowances.insert(edge.clone(),0.01);}
  }
  let source=project.template.clone();
  project.grade_run=Some(PersistedGradeRun{
   schema_version:1,
   sizes:["XS","S","M","L","XL","XXL"].iter().map(|s|s.to_string()).collect(),
   base_size:"M".into(),base_template:source.clone(),
   graded_templates:vec![source;6],size_correspondence: Default::default(), pom_specs:vec![],
  });
  let mut session=Session::new(project).unwrap();
  let before=serde_json::to_value(&session.project).unwrap();
  assert!(session.request(&json!({"op":"grade-run-cutlines","revision":41})).is_err());
  let proof=session.request(&json!({"op":"grade-run-cutlines","revision":0})).unwrap();
  assert_eq!(proof["format"],"exo-native-graded-cutlines.v1");
  assert_eq!(proof["sourceRevision"],0);
  assert_eq!(proof["manufacturerReady"],false);
  assert_eq!(proof["cuttingAuthorized"],false);
  assert_eq!(proof["sizes"].as_array().unwrap().len(),6);
  assert!(proof["sizes"][0]["panels"][0]["cut"]["area_m2"].as_f64().unwrap()>0.);
  assert!(proof["sizes"][0]["seams"][0]["a_length_m"].as_f64().unwrap()>0.);
  assert_eq!(session.revision,0);
  assert_eq!(serde_json::to_value(&session.project).unwrap(),before);
  session.request(&json!({"op":"grade-run-activate","revision":0,"size":"XL"})).unwrap();
  let active=session.request(&json!({"op":"grade-run-cutlines","revision":1})).unwrap();
  assert_eq!(active["sourceRevision"],1);
  assert_eq!(active["sizes"].as_array().unwrap().len(),6);
  assert_eq!(session.revision,1);
 }

 #[test]
 fn oversized_positive_grade_activates_and_restores_legacy_tight_source(){
  let avatar=PathBuf::from(env!("CARGO_MANIFEST_DIR"))
   .join("assets/makehuman/mannequin.obj");
  let mut project=FittingProject::basic(GarmentKind::Tshirt,2,avatar);
  for panel in &mut project.template.panels {
   panel.pattern.width=1.0;panel.pattern.height=0.66;
  }
  let source=project.template.clone();
  let mut sizes=vec![source.clone();6];
  for panel in &mut sizes[5].panels {
   for point in &mut panel.polygon.as_mut().unwrap().points {
    point.x=0.02+(point.x-0.02)*1.15;
    point.y*=1.15;
   }
  }
  project.grade_run=Some(PersistedGradeRun{
   schema_version:1,
   sizes:["XS","S","M","L","XL","XXL"].iter().map(|s|s.to_string()).collect(),
   base_size:"M".into(),base_template:source.clone(),
   graded_templates:sizes,size_correspondence: Default::default(), pom_specs:vec![],
  });
  let mut session=Session::new(project).expect("saved source compiles with positive grade expansion");
  let original=serde_json::to_value(&session.project.template).unwrap();
  let activated=session.request(&json!({"op":"grade-run-activate","revision":0,"size":"XXL"})).unwrap();
  assert_eq!(activated["activeGradedSize"],"XXL");
  assert_eq!(activated["gradedFitEvidence"]["nativeMeshCompiled"],true);
  assert_eq!(activated["template"]["panels"][0]["pattern"]["height"],0.66);
  assert!(session.scene.garment.mesh.uv.iter().any(|p|p.y>0.75));
  assert_eq!(serde_json::to_value(&session.project.template).unwrap(),original);
  assert_eq!(session.project.grade_run.as_ref().unwrap().graded_templates[5].panels[0].pattern.height,0.66);
  let restored=session.request(&json!({"op":"grade-run-restore","revision":1})).unwrap();
  assert!(restored["activeGradedSize"].is_null());
  assert_eq!(serde_json::to_value(&session.project.template).unwrap(),original);
 }

 #[test]
 fn saved_six_size_scene_can_activate_and_restore_without_touching_source(){
  let avatar=PathBuf::from(env!("CARGO_MANIFEST_DIR"))
   .join("assets/makehuman/mannequin.obj");
  let mut project=FittingProject::basic(GarmentKind::Tshirt,2,avatar);
  let source=project.template.clone();
  project.grade_run=Some(PersistedGradeRun{
   schema_version:1,
   sizes:["XS","S","M","L","XL","XXL"].iter().map(|s|s.to_string()).collect(),
   base_size:"M".to_owned(),base_template:source.clone(),
   graded_templates:vec![source.clone();6],size_correspondence: Default::default(), pom_specs:vec![],
  });
  let mut session=Session::new(project).expect("compile source and graded fitting catalog");
  let original=serde_json::to_value(&session.project.template).unwrap();
  let invalid=session.request(&json!({"op":"grade-run-activate","revision":0,"size":"3XL"}));
  assert!(invalid.is_err());
  assert_eq!(session.revision,0);
  assert!(session.base_grade_scene.is_none());

  let active=session.request(&json!({"op":"grade-run-activate","revision":0,"size":"XL"})).unwrap();
  assert_eq!(active["activeGradedSize"],"XL");
  assert!(active["gradedSizePreview"].as_bool().unwrap());
  assert_eq!(active["manufacturingApproved"],false);
  assert_eq!(active["gradedFitEvidence"]["size"],"XL");
  assert_eq!(active["gradedFitEvidence"]["nativeMeshCompiled"],true);
  assert_eq!(active["gradedFitEvidence"]["nativeStepEvidence"],false);
  assert!(active["gradedFitEvidence"]["maxSeamGapMm"].is_null());
  assert_eq!(session.revision,1);
  assert!(session.base_grade_scene.is_some());
  assert_eq!(serde_json::to_value(&session.project.template).unwrap(),original);
  assert!(session.project.grade_run.is_some());
  assert!(session.request(&json!({"op":"edit","revision":1,"command":{}})).is_err());
  assert!(session.request(&json!({"op":"grade-run-restore","revision":0})).is_err());

  let changed=session.request(&json!({"op":"grade-run-activate","revision":1,"size":"XS"})).unwrap();
  assert_eq!(changed["activeGradedSize"],"XS");
  assert_eq!(changed["gradedFitEvidence"]["size"],"XS");
  assert_eq!(changed["gradedFitEvidence"]["nativeStepEvidence"],false);
  let restored=session.request(&json!({"op":"grade-run-restore","revision":2})).unwrap();
  assert!(restored["activeGradedSize"].is_null());
  assert!(restored["gradedFitEvidence"].is_null());
  assert_eq!(serde_json::to_value(&session.project.template).unwrap(),original);
  assert!(session.project.grade_run.is_some());
  assert!(session.base_grade_scene.is_none());
  assert_eq!(session.revision,3);
 }

 #[test]
 fn tampered_catalog_cannot_activate_or_replace_source_scene(){
  let avatar=PathBuf::from(env!("CARGO_MANIFEST_DIR"))
   .join("assets/makehuman/mannequin.obj");
  let mut project=FittingProject::basic(GarmentKind::Tshirt,2,avatar);
  let source=project.template.clone();
  project.grade_run=Some(PersistedGradeRun{
   schema_version:1,
   sizes:["XS","S","M","L","XL","XXL"].iter().map(|s|s.to_string()).collect(),
   base_size:"M".into(),base_template:source.clone(),
   graded_templates:vec![source;6],size_correspondence: Default::default(), pom_specs:vec![],
  });
  let mut session=Session::new(project).unwrap();
  let before_state=session.scene.state.clone();
  session.project.grade_run.as_mut().unwrap().graded_templates[0].name.push_str(" tampered");
  assert!(session.request(&json!({"op":"grade-run-activate","revision":0,"size":"XS"})).is_err());
  assert!(session.active_grade_size.is_none());
  assert!(session.base_grade_scene.is_none());
  assert_eq!(session.revision,0);
  assert_eq!(session.scene.state.x,before_state.x);
 }
}
#[cfg(test)]
mod native_reactive_reference_20261027_tests {
 use super::*;
 fn detached()->(Session,String){
  let avatar=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/makehuman/mannequin.obj");
  let mut project=FittingProject::basic(GarmentKind::Tshirt,2,avatar);
  let fabric=project.template.panels[0].fabric.clone();
  let edit=authoring::apply(&project.template,Command::Polygon{
   points:vec![DVec2::new(0.,0.),DVec2::new(0.4,0.),DVec2::new(0.4,0.4),DVec2::new(0.,0.4)],
   tangents:Vec::new(),meshing:Default::default(),fabric,replace:false
  }).unwrap();
  project.template=edit.template;
  let panel=project.template.panels.last().unwrap().id.clone();
  (Session::new(project).unwrap(),panel)
 }
 fn bindings(panel:&str)->Value {
  json!({"measurements":{"hemWidth":{"valueMm":400.0}},
   "bindings":[{"id":"bottomLeftFromRight","panelId":panel,"pointIndex":3,
    "mode":"polar","a":2,"b":1,"distanceFormula":"hemWidth","angleDeg":180.0}]})
 }
 fn move_source(s:&mut Session,panel:&str,revision:u64,x:f64)->Result<Value,String>{
  let before=s.project.template.panels.iter().find(|p|p.id==panel).unwrap()
   .polygon.as_ref().unwrap().points[2];
  s.request(&json!({"op":"bindings-anchor-recompute","revision":revision,
   "panel":panel,"sourcePointIndex":2,"expectedPosition":before,
   "position":[x,before.y]}))
 }
 #[test]
 fn native_direct_rule_recomputes_twice_with_undo_redo_and_saved_source(){
  let (mut s,panel)=detached();
  let source=serde_json::to_value(&s.project.template).unwrap();
  s.request(&json!({"op":"bindings-store","revision":0,"nativeBindings":bindings(&panel)})).unwrap();
  let first=move_source(&mut s,&panel,1,0.42).unwrap();
  assert_eq!(first["nativePointBindings"]["active"],true);
  assert_eq!(first["nativeReferenceRecompute"]["correctedBindingIds"],json!(["bottomLeftFromRight"]));
  assert_eq!(s.revision,2);
  let points=&s.project.template.panels.last().unwrap().polygon.as_ref().unwrap().points;
  assert!((points[2].x-0.42).abs()<1e-10 && (points[3].x-0.02).abs()<1e-10);
  let second=move_source(&mut s,&panel,2,0.43).unwrap();
  assert_eq!(second["nativePointBindings"]["active"],true);
  let saved=serde_json::to_value(&s.project).unwrap();
  let reloaded:FittingProject=serde_json::from_value(saved).unwrap();
  assert!(reloaded.native_point_bindings.as_ref().unwrap().source_matches(&reloaded.template));
  let reopened=Session::new(reloaded).unwrap();
  assert_eq!(reopened.snapshot(false,false)["nativePointBindings"]["active"],true);
  assert!((reopened.project.template.panels.last().unwrap().polygon.as_ref().unwrap().points[3].x-0.03).abs()<1e-10);
  s.request(&json!({"op":"undo","revision":3})).unwrap();
  assert!((s.project.template.panels.last().unwrap().polygon.as_ref().unwrap().points[3].x-0.02).abs()<1e-10);
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["active"],true);
  s.request(&json!({"op":"undo","revision":4})).unwrap();
  assert_eq!(serde_json::to_value(&s.project.template).unwrap(),source);
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["active"],true);
  s.request(&json!({"op":"redo","revision":5})).unwrap();
  s.request(&json!({"op":"redo","revision":6})).unwrap();
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["active"],true);
  assert!((s.project.template.panels.last().unwrap().polygon.as_ref().unwrap().points[3].x-0.03).abs()<1e-10);
 }
 #[test]
 fn native_reference_recompute_rejects_forgery_computed_measurement_and_attachments_atomically(){
  let (mut s,panel)=detached();
  s.request(&json!({"op":"bindings-store","revision":0,"nativeBindings":bindings(&panel)})).unwrap();
  let baseline=serde_json::to_value(&s.project).unwrap();
  let forged=s.request(&json!({"op":"bindings-anchor-recompute","revision":1,
   "panel":panel,"sourcePointIndex":2,"expectedPosition":[0.4,0.401],"position":[0.42,0.4]}));
  assert!(forged.is_err());
  assert_eq!(serde_json::to_value(&s.project).unwrap(),baseline);
  assert_eq!(s.revision,1);
  let smuggled=s.request(&json!({"op":"bindings-anchor-recompute","revision":1,
   "panel":panel,"sourcePointIndex":2,"expectedPosition":[0.4,0.4],
   "position":[0.42,0.4],"commands":[{"kind":"Anchor","panel":panel,"anchor":3,"position":[9.,9.]}]}));
  assert!(smuggled.unwrap_err().contains("Unsupported native reactive request fields"));
  assert_eq!(serde_json::to_value(&s.project).unwrap(),baseline);
  let wrong=s.request(&json!({"op":"bindings-anchor-recompute","revision":1,
   "panel":panel,"sourcePointIndex":2,"expectedPosition":[0.4,0.4],"position":[0.4,0.0]}));
  assert!(wrong.is_err());
  assert_eq!(serde_json::to_value(&s.project).unwrap(),baseline);
  let mut computed=bindings(&panel);
  computed["measurements"]["hemWidth"]=json!({"formula":"200 + 200"});
  s.request(&json!({"op":"bindings-store","revision":1,"nativeBindings":computed})).unwrap();
  let baseline=serde_json::to_value(&s.project).unwrap();
  assert!(move_source(&mut s,&panel,2,0.42).unwrap_err().contains("Computed measurement"));
  assert_eq!(serde_json::to_value(&s.project).unwrap(),baseline);
  assert_eq!(s.revision,2);
  // A source annotation changes the signed template identity and is refused
  // rather than silently invalidating an installed dependency rule graph.
  assert!(s.request(&json!({"op":"edit","revision":2,"command":{
   "kind":"Annotation","panel":panel,"id":null,"text":"do not regenerate","position":[0.1,0.1]}})).is_err());
  assert!(move_source(&mut s,&panel,3,0.42).is_err());
  assert_eq!(serde_json::to_value(&s.project).unwrap(),baseline);
  assert_eq!(s.revision,2);
 }
 #[test]
 fn native_dependency_chain_is_topological_and_undoes_both_targets_together(){
  let (mut s,panel)=detached();
  let mut graph=bindings(&panel);
  graph["bindings"].as_array_mut().unwrap().push(json!({
   "id":"topLeftFromBottomLeft","panelId":panel,"pointIndex":0,
   "mode":"polar","a":3,"b":1,"distanceFormula":"hemWidth",
   "angleDeg":-90.0,"dependsOn":["reactive_hem"]
  }));
  // The first rule in the fixture has a different ID. Explicit dependencies
  // cannot silently bind to a nonexistent or stale predecessor.
  assert!(s.request(&json!({"op":"bindings-store","revision":0,"nativeBindings":graph.clone()})).is_err());
  graph["bindings"][1]["dependsOn"]=json!(["bottomLeftFromRight"]);
  s.request(&json!({"op":"bindings-store","revision":0,"nativeBindings":graph})).unwrap();
  let before=serde_json::to_value(&s.project.template).unwrap();
  let result=move_source(&mut s,&panel,1,0.42).unwrap();
  assert_eq!(result["nativeReferenceRecompute"]["correctedBindingIds"],
   json!(["bottomLeftFromRight","topLeftFromBottomLeft"]));
  assert_eq!(result["nativePointBindings"]["active"],true);
  let poly=s.project.template.panels.last().unwrap().polygon.as_ref().unwrap();
  assert!((poly.points[2].x-poly.points[3].x-0.4).abs()<1e-9);
  assert!((poly.points[3].x-poly.points[0].x).abs()<1e-9);
  s.request(&json!({"op":"undo","revision":2})).unwrap();
  assert_eq!(serde_json::to_value(&s.project.template).unwrap(),before);
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["active"],true);
 }
 #[test]
 fn active_rule_graph_on_annotated_panel_refuses_native_regeneration(){
  let (mut s,panel)=detached();
  s.request(&json!({"op":"edit","revision":0,"command":{
   "kind":"Annotation","panel":panel,"id":null,"text":"retain mark","position":[0.1,0.1]}})).unwrap();
  s.request(&json!({"op":"bindings-store","revision":1,"nativeBindings":bindings(&panel)})).unwrap();
  let before=serde_json::to_value(&s.project).unwrap();
  let err=move_source(&mut s,&panel,2,0.42).unwrap_err();
  assert!(err.contains("Attached native geometry"),"{err}");
  assert_eq!(serde_json::to_value(&s.project).unwrap(),before);
  assert_eq!(s.revision,2);
 }
}
#[cfg(test)]
mod native_ordinary_edit_regeneration_20261027_tests {
 use super::*;
 fn setup()->(Session,String){
  let avatar=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/makehuman/mannequin.obj");
  let mut project=FittingProject::basic(GarmentKind::Tshirt,2,avatar);
  let fabric=project.template.panels[0].fabric.clone();
  project.template=authoring::apply(&project.template,Command::Polygon{
   points:vec![DVec2::new(0.,0.),DVec2::new(0.4,0.),DVec2::new(0.4,0.4),DVec2::new(0.,0.4)],
   tangents:Vec::new(),meshing:Default::default(),fabric,replace:false,
  }).unwrap().template;
  let id=project.template.panels.last().unwrap().id.clone();
  (Session::new(project).unwrap(),id)
 }
 fn bind(session:&mut Session,panel:&str){
  session.request(&json!({"op":"bindings-store","revision":0,"nativeBindings":{
   "measurements":{"hemWidth":{"valueMm":400.0}},"bindings":[{
    "id":"left","panelId":panel,"pointIndex":3,"mode":"polar","a":2,"b":1,
    "distanceFormula":"hemWidth","angleDeg":180.0
   }]}})).unwrap();
 }
 fn edit(session:&mut Session,panel:&str,revision:u64,x:f64)->Result<Value,String>{
  session.request(&json!({"op":"edit","revision":revision,"command":{
   "kind":"Anchor","panel":panel,"anchor":2,"position":[x,0.4]}}))
 }
 #[test]
 fn ordinary_anchor_regenerates_saved_rules_with_one_undo_and_persistent_source(){
  let (mut s,panel)=setup();bind(&mut s,&panel);
  let before=serde_json::to_value(&s.project).unwrap();
  let response=edit(&mut s,&panel,1,0.42).unwrap();
  assert_eq!(response["nativePointBindings"]["active"],true);
  assert_eq!(s.revision,2);
  let poly=s.project.template.panels.last().unwrap().polygon.as_ref().unwrap();
  assert!((poly.points[2].x-0.42).abs()<1e-9);
  assert!((poly.points[3].x-0.02).abs()<1e-9);
  let persisted:FittingProject=serde_json::from_value(serde_json::to_value(&s.project).unwrap()).unwrap();
  assert!(persisted.native_point_bindings.unwrap().source_matches(&persisted.template));
  s.request(&json!({"op":"undo","revision":2})).unwrap();
  assert_eq!(serde_json::to_value(&s.project).unwrap(),before);
  s.request(&json!({"op":"redo","revision":3})).unwrap();
  assert!((s.project.template.panels.last().unwrap().polygon.as_ref().unwrap().points[3].x-0.02).abs()<1e-9);
 }
 #[test]
 fn ordinary_edit_rejects_invalid_targets_catalog_and_stale_source_without_mutation(){
  let (mut s,panel)=setup();bind(&mut s,&panel);
  let original=serde_json::to_value(&s.project).unwrap();
  assert!(s.request(&json!({"op":"edit","revision":1,"command":{
   "kind":"Anchor","panel":panel,"anchor":3,"position":[0.01,0.4]}})).is_err());
  assert!(s.request(&json!({"op":"edit","revision":1,"command":{
   "kind":"AnchorGroup","panel":panel,"edits":[[2,[0.42,0.4]]]}})).is_err());
  assert!(edit(&mut s,&panel,1,11.0).is_err());
  assert_eq!(serde_json::to_value(&s.project).unwrap(),original);
  assert_eq!(s.revision,1);
  let base=s.project.template.clone();
  s.project.grade_run=Some(PersistedGradeRun{
   schema_version:1,sizes:["XS","S","M","L","XL","XXL"].iter().map(|s|s.to_string()).collect(),
   base_size:"M".into(),base_template:base.clone(),graded_templates:vec![base;6],size_correspondence: Default::default(), pom_specs:vec![]
  });
  let graded=serde_json::to_value(&s.project).unwrap();
  assert!(edit(&mut s,&panel,1,0.42).unwrap_err().contains("six-size"));
  assert_eq!(serde_json::to_value(&s.project).unwrap(),graded);
  s.project.grade_run=None;
  s.project.template.panels.last_mut().unwrap().polygon.as_mut().unwrap().points[3].x+=0.001;
  let stale=serde_json::to_value(&s.project).unwrap();
  assert!(edit(&mut s,&panel,1,0.42).unwrap_err().contains("Stale native source"));
  assert_eq!(s.revision,1);
  assert_eq!(serde_json::to_value(&s.project).unwrap(),stale);
 }
}
#[cfg(test)]
mod native_fabric_grade_envelope_session_20261027_tests {
 use super::*;
 use marvelous_cloth::native_fabric_grade_chart_20261027::FabricGradeBounds;
 use marvelous_cloth::fitting::NativeDraftPointRule;
 use std::collections::BTreeMap;

 fn fixture()->Session{
  let avatar=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/makehuman/mannequin.obj");
  let mut p=FittingProject::basic(GarmentKind::Tshirt,2,avatar);
  p.template.seams.clear();
  let base=p.template.clone();
  p.grade_run=Some(PersistedGradeRun{schema_version:1,
   sizes:["XS","S","M","L","XL","XXL"].iter().map(|s|s.to_string()).collect(),
   base_size:"M".into(),base_template:base.clone(),graded_templates:vec![base.clone();6],size_correspondence: Default::default(), pom_specs:vec![]});
  p.native_point_bindings=Some(NativeDraftPointBindings{version:1,source_template:base,
   measurements:BTreeMap::from([("neck_distance".into(),NativeDraftMeasurement::Number(76.321687612))]),
   bindings:vec![NativeDraftPointRule{id:"neck".into(),panel_id:"front".into(),point_index:1,
    mode:"polar".into(),a:0,b:0,distance_formula:"neck_distance".into(),
    angle_deg:Some((0.065_f64).atan2(0.04).to_degrees()),depends_on:vec![]} ]});
  Session::new(p).unwrap()
 }
 fn envelope(s:&Session)->PersistedFabricGradeEnvelope {
  PersistedFabricGradeEnvelope{schema_version:1,provenance:"Explicit measured source chart".into(),
   fabric_id:s.project.template.fabrics[0].id.clone(),source_template:s.project.template.clone(),
   measurements:BTreeMap::from([("neck_distance".into(),
    ["XS","S","M","L","XL","XXL"].iter().map(|size|(
     size.to_string(),FabricGradeBounds{min_mm:70.,max_mm:95.})).collect())]),
   per_size_chart:None,
   physical_pom_bounds:BTreeMap::new()}
 }
 #[test]
 fn store_inspect_undo_redo_reopen_and_immutable_rejection(){
  let mut s=fixture();
  let e=envelope(&s);
  let source=serde_json::to_value(&s.project).unwrap();
  assert!(s.request(&json!({"op":"fabric-grade-envelope-store","revision":1,"envelope":e})).is_err());
  s.request(&json!({"op":"fabric-grade-envelope-store","revision":0,"envelope":e})).unwrap();
  assert_eq!(s.revision,1);
  assert_eq!(s.request(&json!({"op":"fabric-grade-envelope-inspect","revision":1})).unwrap()["envelope"]["provenance"],"Explicit measured source chart");
  let stored=serde_json::to_value(&s.project).unwrap();
  let reopened=Session::new(serde_json::from_value::<FittingProject>(stored.clone()).unwrap()).unwrap();
  assert!(reopened.project.fabric_grade_envelope.is_some());
  assert!(s.request(&json!({"op":"edit-batch","revision":1,"commands":[]})).is_err());
  assert!(s.request(&json!({"op":"bindings-grade-regenerate","revision":1,"overrides":{"neck_distance":100.}})).is_err());
  assert_eq!(serde_json::to_value(&s.project).unwrap(),stored);
  assert_eq!(s.revision,1);
  s.request(&json!({"op":"undo","revision":1})).unwrap();
  assert_eq!(serde_json::to_value(&s.project).unwrap(),source);
  s.request(&json!({"op":"redo","revision":2})).unwrap();
  assert_eq!(serde_json::to_value(&s.project).unwrap(),stored);
 }
 #[test]
 fn forged_chart_and_unqualified_anchor_rejected(){
  let mut s=fixture();
  let mut e=envelope(&s);
  e.measurements.get_mut("neck_distance").unwrap().remove("XXL");
  assert!(s.request(&json!({"op":"fabric-grade-envelope-store","revision":0,"envelope":e})).is_err());
  assert_eq!(s.revision,0);
  let e=envelope(&s);
  s.request(&json!({"op":"fabric-grade-envelope-store","revision":0,"envelope":e})).unwrap();
  assert!(s.request(&json!({"op":"edit","revision":1,"command":{
   "kind":"Anchor","panel":"front","anchor":2,"position":[0.5,0.1]}})).is_err());
  assert_eq!(s.revision,1);
 }
}
#[cfg(test)]
mod native_ordinary_bound_six_size_inverse_20261027_tests {
 use super::*;
 use marvelous_cloth::fitting::NativeDraftPointRule;
 fn setup()->Session{
  let avatar=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/makehuman/mannequin.obj");
  let mut project=FittingProject::basic(GarmentKind::Tshirt,2,avatar);
  project.template.seams.clear();
  let original=project.template.clone();
  let mut grade=PersistedGradeRun{
   schema_version:1,sizes:["XS","S","M","L","XL","XXL"].iter().map(|s|s.to_string()).collect(),
   base_size:"M".into(),base_template:original.clone(),graded_templates:vec![original;6],size_correspondence: Default::default(), pom_specs:vec![]
  };
  for (index,size) in grade.graded_templates.iter_mut().enumerate(){
   if index==2{continue}
   for panel in &mut size.panels {panel.polygon.as_mut().unwrap().points[1].x+=(index as f64-2.)*0.001;}
  }
  let angle=(0.065_f64).atan2(0.04).to_degrees();
  let graph=NativeDraftPointBindings{
   version:1,source_template:project.template.clone(),
   measurements:std::collections::BTreeMap::from([("neck_distance".into(),NativeDraftMeasurement::Number(76.321687612))]),
   bindings:["front","back"].iter().map(|panel|NativeDraftPointRule{
    id:format!("{panel}_neck"),panel_id:(*panel).into(),point_index:1,mode:"polar".into(),
    a:0,b:0,distance_formula:"neck_distance".into(),angle_deg:Some(angle),depends_on:vec![]
   }).collect(),
  };
  grade.validate(&project.template).unwrap();
  project.grade_run=Some(grade);
  project.native_point_bindings=Some(graph);
  Session::new(project).unwrap()
 }
 #[test]
 fn ordinary_bound_target_infers_single_measurement_and_preserves_all_six_size_offsets(){
  let mut s=setup();
  let before=serde_json::to_value(&s.project).unwrap();
  let old_run=s.project.grade_run.clone().unwrap();
  let original=s.project.template.panels.iter().find(|p|p.id=="front").unwrap().polygon.as_ref().unwrap().points[1];
  let direction=DVec2::new(0.04,0.065).normalize();
  let desired=original+direction*0.004;
  let response=s.request(&json!({"op":"edit","revision":0,"command":{
   "kind":"Anchor","panel":"front","anchor":1,"position":desired}})).unwrap();
  assert_eq!(s.revision,1);
  assert_eq!(response["nativePointBindings"]["active"],true);
  assert_eq!(response["gradeRunPersisted"],true);
  let next=s.project.grade_run.as_ref().unwrap();
  for (index,panel) in s.project.template.panels.iter().enumerate(){
   let prev=old_run.base_template.panels[index].polygon.as_ref().unwrap().points[1];
   let new=panel.polygon.as_ref().unwrap().points[1];
   assert!((new-prev).length()>0.001,"shared measurement must move {}",panel.id);
  }
  for (index,size) in next.graded_templates.iter().enumerate(){
   for (p,panel) in size.panels.iter().enumerate(){
    let prior_size=&old_run.graded_templates[index].panels[p].polygon.as_ref().unwrap().points;
    let next_size=&panel.polygon.as_ref().unwrap().points;
    let prior_base=&old_run.base_template.panels[p].polygon.as_ref().unwrap().points;
    let new_base=&s.project.template.panels[p].polygon.as_ref().unwrap().points;
    for k in 0..next_size.len(){
     assert!(((next_size[k]-new_base[k])-(prior_size[k]-prior_base[k])).length()<1e-8);
    }
   }
  }
  let saved=serde_json::to_value(&s.project).unwrap();
  let reopened:FittingProject=serde_json::from_value(saved.clone()).unwrap();
  reopened.grade_run.as_ref().unwrap().validate(&reopened.template).unwrap();
  s.request(&json!({"op":"undo","revision":1})).unwrap();
  assert_eq!(serde_json::to_value(&s.project).unwrap(),before);
  s.request(&json!({"op":"redo","revision":2})).unwrap();
  assert_eq!(serde_json::to_value(&s.project).unwrap(),saved);
 }
 #[test]
 fn inverse_rejects_off_axis_formula_multiple_measurements_and_stale_source(){
  let mut s=setup();
  let before=serde_json::to_value(&s.project).unwrap();
  let old=s.project.template.panels[0].polygon.as_ref().unwrap().points[1];
  for candidate in [old+DVec2::new(0.005,0.),old] {
   assert!(s.request(&json!({"op":"edit","revision":0,"command":{
    "kind":"Anchor","panel":"front","anchor":1,"position":candidate}})).is_err());
   assert_eq!(serde_json::to_value(&s.project).unwrap(),before);
  }
  let direction=DVec2::new(0.04,0.065).normalize();
  let graph=s.project.native_point_bindings.as_mut().unwrap();
  graph.measurements.insert("other".into(),NativeDraftMeasurement::Number(10.));
  graph.bindings[1].distance_formula="other".into();
  let ambiguous=serde_json::to_value(&s.project).unwrap();
  assert!(s.request(&json!({"op":"edit","revision":0,"command":{
   "kind":"Anchor","panel":"front","anchor":1,"position":old+direction*0.004}})).is_err());
  assert_eq!(serde_json::to_value(&s.project).unwrap(),ambiguous);
  s.project.native_point_bindings.as_mut().unwrap().bindings[1].distance_formula="neck_distance".into();
  s.project.template.panels[0].polygon.as_mut().unwrap().points[1].x+=0.002;
  let stale=serde_json::to_value(&s.project).unwrap();
  assert!(s.request(&json!({"op":"edit","revision":0,"command":{
   "kind":"Anchor","panel":"front","anchor":1,"position":old+direction*0.004}})).is_err());
  assert_eq!(serde_json::to_value(&s.project).unwrap(),stale);
 }
}
#[cfg(test)]
mod native_six_size_industrial_audit_rpc_20261027_tests {
 use super::*;
 #[test]
 fn industrial_audit_is_revision_checked_read_only_and_fail_closed(){
  let avatar=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/makehuman/mannequin.obj");
  let mut project=FittingProject::basic(GarmentKind::Tshirt,2,avatar);
  project.template.seams.clear();
  let source=project.template.clone();
  project.grade_run=Some(PersistedGradeRun{
   schema_version:1,sizes:["XS","S","M","L","XL","XXL"].iter().map(|s|s.to_string()).collect(),
   base_size:"M".into(),base_template:source.clone(),graded_templates:vec![source;6],size_correspondence: Default::default(), pom_specs:vec![]
  });
  let mut s=Session::new(project).unwrap();
  let panel=s.project.template.panels[0].id.clone();
  let initial=serde_json::to_value(&s.project).unwrap();
  let req=json!({"op":"grade-run-industrial-audit","revision":0,"panel":panel});
  assert!(s.request(&req).unwrap_err().contains("No industrial allowance"));
  assert!(s.request(&json!({"op":"grade-run-industrial-audit","revision":1,"panel":panel})).is_err());
  assert!(s.request(&json!({"op":"grade-run-industrial-audit","revision":0,"panel":panel,"extra":true})).is_err());
  assert_eq!(s.revision,0);
  assert!(!s.history.can_undo());
  assert_eq!(serde_json::to_value(&s.project).unwrap(),initial);
  // Add real native allowance metadata to source and every graded size.
  for piece in &mut s.project.template.panels {
   if piece.id==panel {
    let poly=piece.polygon.as_mut().unwrap();
    let edge=poly.edges[0].clone();poly.seam_allowances.insert(edge,0.01);
   }
  }
  let run=s.project.grade_run.as_mut().unwrap();
  run.base_template=s.project.template.clone();
  for size in &mut run.graded_templates {
   let poly=size.panels.iter_mut().find(|piece|piece.id==panel).unwrap().polygon.as_mut().unwrap();
   let edge=poly.edges[0].clone();poly.seam_allowances.insert(edge,0.01);
  }
  let saved=serde_json::to_value(&s.project).unwrap();
  let report=s.request(&req).unwrap();
  assert_eq!(report["format"],"exo-native-linked-industrial-six-size-proof.v1");
  assert_eq!(report["sourceRevision"],0);
  assert_eq!(report["manufacturerApproved"],false);
  assert_eq!(report["factoryApproved"],false);
  assert_eq!(s.revision,0);
  assert_eq!(serde_json::to_value(&s.project).unwrap(),saved);
 }
}
#[cfg(test)]
mod native_measurement_recompute_20261027_tests {
 use super::*;
 fn detached()->(Session,String){
  let avatar=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/makehuman/mannequin.obj");
  let mut project=FittingProject::basic(GarmentKind::Tshirt,2,avatar);
  let fabric=project.template.panels[0].fabric.clone();
  let edit=authoring::apply(&project.template,Command::Polygon{
   points:vec![DVec2::new(0.,0.),DVec2::new(0.4,0.),DVec2::new(0.4,0.4),DVec2::new(0.,0.4)],
   tangents:Vec::new(),meshing:Default::default(),fabric,replace:false
  }).unwrap();
  project.template=edit.template;
  let panel=project.template.panels.last().unwrap().id.clone();
  (Session::new(project).unwrap(),panel)
 }
 fn graph(panel:&str)->Value{
  json!({"measurements":{"hemWidth":{"valueMm":400.0}},"bindings":[
   {"id":"left","panelId":panel,"pointIndex":3,"mode":"polar", "a":2,"b":1,
    "distanceFormula":"hemWidth","angleDeg":180.0}]})
 }
 fn change(s:&mut Session, revision:u64, expected:f64, value:f64)->Result<Value,String>{
  s.request(&json!({"op":"bindings-measurement-recompute","revision":revision,
   "measurement":"hemWidth","expectedValueMm":expected,"valueMm":value}))
 }
 #[test]
 fn sequential_direct_measurements_undo_redo_and_project_reopen(){
  let (mut s,panel)=detached();
  s.request(&json!({"op":"bindings-store","revision":0,"nativeBindings":graph(&panel)})).unwrap();
  let before=serde_json::to_value(&s.project).unwrap();
  let first=change(&mut s,1,400.,390.).unwrap();
  assert_eq!(first["nativeMeasurementRecompute"]["correctedBindingIds"],json!(["left"]));
  assert_eq!(s.revision,2);
  assert!((s.project.template.panels.last().unwrap().polygon.as_ref().unwrap().points[3].x-0.01).abs()<1e-9);
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["measurements"]["hemWidth"]["valueMm"],390.0);
  change(&mut s,2,390.,380.).unwrap();
  let after=serde_json::to_value(&s.project).unwrap();
  assert!((s.project.template.panels.last().unwrap().polygon.as_ref().unwrap().points[3].x-0.02).abs()<1e-9);
  let reloaded:FittingProject=serde_json::from_value(after.clone()).unwrap();
  let reopened=Session::new(reloaded).unwrap();
  assert_eq!(reopened.snapshot(false,false)["nativePointBindings"]["active"],true);
  assert_eq!(reopened.snapshot(false,false)["nativePointBindings"]["measurements"]["hemWidth"]["valueMm"],380.0);
  s.request(&json!({"op":"undo","revision":3})).unwrap();
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["measurements"]["hemWidth"]["valueMm"],390.0);
  s.request(&json!({"op":"undo","revision":4})).unwrap();
  assert_eq!(serde_json::to_value(&s.project).unwrap(),before);
  s.request(&json!({"op":"redo","revision":5})).unwrap();
  s.request(&json!({"op":"redo","revision":6})).unwrap();
  assert_eq!(serde_json::to_value(&s.project).unwrap(),after);
 }
 #[test]
 fn dependent_chain_recomputes_atomically(){
  let (mut s,panel)=detached();
  let mut bindings=graph(&panel);
  // A second rule follows the moved first target. Its independent 400mm
  // offset preserves the straight, ordered rectangular contour.
  bindings["bindings"].as_array_mut().unwrap().push(json!({
   "id":"upper","panelId":panel,"pointIndex":0,"mode":"polar", "a":3,"b":1,
   "distanceFormula":"height","angleDeg":-90.0,"dependsOn":["left"]}));
  bindings["measurements"]["height"]=json!(400.0);
  s.request(&json!({"op":"bindings-store","revision":0,"nativeBindings":bindings})).unwrap();
  let first=change(&mut s,1,400.,390.).unwrap();
  assert_eq!(first["nativeMeasurementRecompute"]["correctedBindingIds"],json!(["left","upper"]));
  let points=&s.project.template.panels.last().unwrap().polygon.as_ref().unwrap().points;
  assert!((points[2].x-points[3].x-0.39).abs()<1e-9);
  assert!((points[3].x-points[0].x).abs()<1e-9);
  s.request(&json!({"op":"undo","revision":2})).unwrap();
  assert_eq!(s.snapshot(false,false)["nativePointBindings"]["active"],true);
  assert!((s.project.template.panels.last().unwrap().polygon.as_ref().unwrap().points[0].x).abs()<1e-9);
 }
 #[test]
 fn invalid_requests_and_geometry_drift_roll_back_entire_transaction(){
  let (mut s,panel)=detached();
  s.request(&json!({"op":"bindings-store","revision":0,"nativeBindings":graph(&panel)})).unwrap();
  let source=serde_json::to_value(&s.project).unwrap();
  assert!(change(&mut s,0,400.,390.).is_err());
  assert!(change(&mut s,1,399.,390.).is_err());
  assert!(change(&mut s,1,400.,400.).is_err());
  assert!(change(&mut s,1,400.,-5001.).is_err());
  assert!(change(&mut s,1,400.,-100.).is_err());
  assert!(s.request(&json!({"op":"bindings-measurement-recompute","revision":1,
   "measurement":"hemWidth","expectedValueMm":400.0,"valueMm":390.0,
   "pointIndex":3})).is_err());
  assert_eq!(serde_json::to_value(&s.project).unwrap(),source);
  assert_eq!(s.revision,1);
  s.project.template.panels.last_mut().unwrap().polygon.as_mut().unwrap().points[3].x+=0.001;
  let tampered=serde_json::to_value(&s.project).unwrap();
  assert!(change(&mut s,1,400.,390.).is_err());
  assert_eq!(serde_json::to_value(&s.project).unwrap(),tampered);
  let (mut computed,panel)=detached();
  let mut definition=graph(&panel);
  definition["measurements"]["hemWidth"]=json!({"formula":"200 + 200"});
  computed.request(&json!({"op":"bindings-store","revision":0,"nativeBindings":definition})).unwrap();
  let baseline=serde_json::to_value(&computed.project).unwrap();
  assert!(change(&mut computed,1,400.,390.).is_err());
  assert_eq!(serde_json::to_value(&computed.project).unwrap(),baseline);
 }
 #[test]
 fn native_formula_chain_updates_bound_geometry_with_one_undo_and_reopen(){
  let (mut s,panel)=detached();
  let mut bindings=graph(&panel);
  bindings["measurements"]=json!({
   "halfWidth":{"valueMm":200.0},
   "allowance":{"valueMm":0.0},
   "intermediate":{"formula":"halfWidth + allowance"},
   "hemWidth":{"formula":"intermediate * 2"}
  });
  s.request(&json!({"op":"bindings-store","revision":0,"nativeBindings":bindings})).unwrap();
  let source=serde_json::to_value(&s.project).unwrap();
  let first=s.request(&json!({"op":"bindings-measurement-recompute","revision":1,
   "measurement":"halfWidth","expectedValueMm":200.0,"valueMm":190.0})).unwrap();
  assert_eq!(first["nativeMeasurementRecompute"]["correctedBindingIds"],json!(["left"]));
  assert_eq!(s.revision,2);
  assert!((s.project.template.panels.last().unwrap().polygon.as_ref().unwrap().points[3].x-0.02).abs()<1e-9);
  s.request(&json!({"op":"bindings-measurement-recompute","revision":2,
   "measurement":"halfWidth","expectedValueMm":190.0,"valueMm":180.0})).unwrap();
  assert!((s.project.template.panels.last().unwrap().polygon.as_ref().unwrap().points[3].x-0.04).abs()<1e-9);
  let final_project=serde_json::to_value(&s.project).unwrap();
  let reopened=Session::new(serde_json::from_value::<FittingProject>(final_project.clone()).unwrap()).unwrap();
  assert_eq!(reopened.snapshot(false,false)["nativePointBindings"]["active"],true);
  assert_eq!(reopened.snapshot(false,false)["nativePointBindings"]["measurements"]["hemWidth"]["formula"],"intermediate * 2");
  s.request(&json!({"op":"undo","revision":3})).unwrap();
  assert!((s.project.template.panels.last().unwrap().polygon.as_ref().unwrap().points[3].x-0.02).abs()<1e-9);
  s.request(&json!({"op":"undo","revision":4})).unwrap();
  assert_eq!(serde_json::to_value(&s.project).unwrap(),source);
  s.request(&json!({"op":"redo","revision":5})).unwrap();
  s.request(&json!({"op":"redo","revision":6})).unwrap();
  assert_eq!(serde_json::to_value(&s.project).unwrap(),final_project);
 }
 #[test]
 fn computed_measurement_errors_refuse_native_mutation_atomically(){
  for expression in ["halfWidth * 2 / zero", "halfWidth + missing", "hemWidth + 1", "halfWidth * 100000000"] {
   let (mut s,panel)=detached();
   let mut bindings=graph(&panel);
   bindings["measurements"]=json!({
    "halfWidth":{"valueMm":200.0},"zero":{"valueMm":0.0},
    "hemWidth":{"formula":expression}
   });
   s.request(&json!({"op":"bindings-store","revision":0,"nativeBindings":bindings})).unwrap();
   let before=serde_json::to_value(&s.project).unwrap();
   let error=s.request(&json!({"op":"bindings-measurement-recompute","revision":1,
    "measurement":"halfWidth","expectedValueMm":200.0,"valueMm":190.0}));
   assert!(error.is_err(),"{expression}");
   assert_eq!(s.revision,1);
   assert_eq!(serde_json::to_value(&s.project).unwrap(),before);
  }
  // The installed graph is valid and geometrically satisfied at 200 mm;
  // changing the direct input to 190 mm creates a division by zero only in
  // the candidate chart. It must not advance native revision or history.
  let (mut s,panel)=detached();
  let mut bindings=graph(&panel);
  bindings["measurements"]=json!({
   "halfWidth":{"valueMm":200.0},
   "hemWidth":{"formula":"4000 / (halfWidth - 190)"}
  });
  s.request(&json!({"op":"bindings-store","revision":0,"nativeBindings":bindings})).unwrap();
  let before=serde_json::to_value(&s.project).unwrap();
  let result=s.request(&json!({"op":"bindings-measurement-recompute","revision":1,
   "measurement":"halfWidth","expectedValueMm":200.0,"valueMm":190.0}));
  assert!(result.unwrap_err().contains("division by zero"));
  assert_eq!(s.revision,1);
  assert_eq!(serde_json::to_value(&s.project).unwrap(),before);
 }
}
#[cfg(test)]
mod native_chronological_imported_hardware_history_tests {
 use super::*;
 fn session()->Session {
  let avatar=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/makehuman/mannequin.obj");
  Session::new(FittingProject::basic(GarmentKind::Tshirt,2,avatar)).unwrap()
 }
 fn hardware(id:&str,panel:&str,x:f64)->ImportedHardware {
  serde_json::from_value(json!({
   "id":id,"assetId":"ykk-verified-source","panel":panel,"kind":"puller",
   "positionMm":[x,40.,1.],"rotationDegrees":[0.,0.,0.],
   "scale":[1.,1.,1.],"visible":true,"color":"#c16f4c",
   "roughness":0.3,"metalness":0.8,"materialType":"metal"
  })).unwrap()
 }
 fn rpc(s:&mut Session,op:Value)->Value {s.request(&op).unwrap()}
 #[test]
 fn mixed_hardware_and_pattern_steps_are_globally_ordered_and_atomic(){
  let mut s=session();
  let panel=s.project.template.panels[0].id.clone();
  let original_name=s.project.template.panels[0].name.clone();
  let a=hardware("a",&panel,50.);
  let b=hardware("b",&panel,65.);
  assert!(!s.history.can_undo());
  rpc(&mut s,json!({"op":"hardware-set","revision":0,"importedHardware":[a]}));
  assert_eq!(s.project.imported_hardware.len(),1);
  assert_eq!(s.snapshot(false,false)["canUndoHardware"],true);
  rpc(&mut s,json!({"op":"set-property","revision":1,"target":"panel",
     "id":panel,"field":"name","value":"Renamed panel"}));
  assert_eq!(s.snapshot(false,false)["canUndoHardware"],false);
  // Specialized hardware Undo can never skip a more recent pattern edit.
  let before=serde_json::to_value(&s.project).unwrap();
  assert!(s.request(&json!({"op":"hardware-undo","revision":2})).is_err());
  assert_eq!(s.revision,2);
  assert_eq!(serde_json::to_value(&s.project).unwrap(),before);
  rpc(&mut s,json!({"op":"hardware-set","revision":2,"importedHardware":[a,b]}));
  assert_eq!(s.snapshot(false,false)["canUndoHardware"],true);
  rpc(&mut s,json!({"op":"undo","revision":3}));
  assert_eq!(s.project.imported_hardware.len(),1);
  assert_eq!(s.project.template.panels[0].name,"Renamed panel");
  assert_eq!(s.snapshot(false,false)["canUndoHardware"],false);
  rpc(&mut s,json!({"op":"undo","revision":4}));
  assert_eq!(s.project.template.panels[0].name,original_name);
  assert_eq!(s.project.imported_hardware.len(),1);
  rpc(&mut s,json!({"op":"hardware-undo","revision":5}));
  assert!(s.project.imported_hardware.is_empty());
  assert_eq!(s.snapshot(false,false)["canRedoHardware"],true);
  rpc(&mut s,json!({"op":"hardware-redo","revision":6}));
  assert_eq!(s.project.imported_hardware.len(),1);
  assert_eq!(s.snapshot(false,false)["canRedoHardware"],false);
  rpc(&mut s,json!({"op":"redo","revision":7}));
  assert_eq!(s.project.template.panels[0].name,"Renamed panel");
  rpc(&mut s,json!({"op":"redo","revision":8}));
  assert_eq!(s.project.imported_hardware.len(),2);
  let second=serde_json::to_value(&s.project).unwrap();
  // New hardware edits clear the SAME linked redo branch as a source edit.
  rpc(&mut s,json!({"op":"undo","revision":9}));
  let mut changed=s.project.imported_hardware.clone();
  changed[0].position_mm[0]+=10.;
  rpc(&mut s,json!({"op":"hardware-set","revision":10,"importedHardware":changed}));
  assert_eq!(s.snapshot(false,false)["canRedo"],false);
  assert_eq!(s.snapshot(false,false)["canRedoHardware"],false);
  let unchanged=serde_json::to_value(&s.project).unwrap();
  let invalid=hardware("orphan","missing",1.);
  assert!(s.request(&json!({"op":"hardware-set","revision":11,"importedHardware":[invalid]})).is_err());
  assert_eq!(s.revision,11);
  assert_eq!(serde_json::to_value(&s.project).unwrap(),unchanged);
  rpc(&mut s,json!({"op":"hardware-undo","revision":11}));
  rpc(&mut s,json!({"op":"hardware-redo","revision":12}));
  assert_eq!(serde_json::to_value(&s.project).unwrap(),unchanged);
  assert_ne!(serde_json::to_value(&s.project).unwrap(),second);
  // Persist the document, but do not fabricate persistent Undo across a
  // newly opened Rust session. That is a separate unimplemented feature.
  let reopened: FittingProject=serde_json::from_value(serde_json::to_value(&s.project).unwrap()).unwrap();
  let fresh=Session::new(reopened).unwrap();
  assert_eq!(fresh.project.imported_hardware,s.project.imported_hardware);
  assert!(!fresh.history.can_undo());
  assert_eq!(fresh.snapshot(false,false)["canUndoHardware"],false);
 }
 #[test]
 fn hardware_history_is_bounded_and_noop_does_not_clear_redo(){
  let mut s=session();
  let panel=s.project.template.panels[0].id.clone();
  for i in 0..35 {
   let a=hardware("bounded",&panel,50.+i as f64);
   let revision=s.revision;
   rpc(&mut s,json!({"op":"hardware-set","revision":revision,"importedHardware":[a]}));
  }
  assert_eq!(s.hardware_undo.len(),32);
  assert_eq!(s.hardware_steps_undo.len(),32);
  assert_eq!(s.grade_undo.len(),32);
  assert_eq!(s.bindings_undo.len(),32);
  let revision=s.revision;
  let same=s.project.imported_hardware.clone();
  rpc(&mut s,json!({"op":"hardware-set","revision":revision,"importedHardware":same}));
  assert_eq!(s.revision,revision);
  rpc(&mut s,json!({"op":"undo","revision":revision}));
  assert_eq!(s.hardware_redo.len(),1);
  let same=s.project.imported_hardware.clone();
  let revision=s.revision;
  rpc(&mut s,json!({"op":"hardware-set","revision":revision,"importedHardware":same}));
  assert_eq!(s.hardware_redo.len(),1,"No-op must not discard available Redo");
 }
 #[test]
 fn deleting_hardware_host_is_one_reversible_document_transaction(){
  let mut s=session();
  let panel=s.project.template.panels[0].id.clone();
  let placed=hardware("mounted",&panel,50.);
  rpc(&mut s,json!({"op":"hardware-set","revision":0,"importedHardware":[placed]}));
  rpc(&mut s,json!({"op":"edit","revision":1,
    "command":{"kind":"RemovePanel","panel":panel}}));
  assert!(!s.project.template.panels.iter().any(|p|p.id==panel));
  assert!(s.project.imported_hardware.is_empty(),
    "Removing a source panel must never persist orphaned hardware");
  assert!(!s.snapshot(false,false)["canUndoHardware"].as_bool().unwrap());
  rpc(&mut s,json!({"op":"undo","revision":2}));
  assert!(s.project.template.panels.iter().any(|p|p.id==panel));
  assert_eq!(s.project.imported_hardware.len(),1);
  assert_eq!(s.project.imported_hardware[0].id,"mounted");
  rpc(&mut s,json!({"op":"redo","revision":3}));
  assert!(!s.project.template.panels.iter().any(|p|p.id==panel));
  assert!(s.project.imported_hardware.is_empty());
 }
}
fn main(){
 // Keep desktop release detection independent of loaded garment files and
 // Metal initialization: the app's Node bridge uses this preflight so a
 // mistakenly bundled CPU-only binary cannot blank the 2D/3D workspace.
 if std::env::args().any(|arg|arg=="--exo-capabilities"){
  println!("{}",json!({"ok":true,"desktopFeature":cfg!(feature="desktop"),"gpuSimulation":cfg!(feature="desktop"),
    "nativePropertyMetadataV1":true,"nativeProjectGenerationV1":true}));
  return;
 }
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
    if let Some(t)=v.get("template"){
     let replacement=serde_json::from_value(t.clone()).map_err(|e|e.to_string())?;
     if let Some(run)=&p.grade_run {run.validate(&replacement)?;}
     p.template=replacement;p.state=None;p.mesh_signature=None;
    }
    p.validate_print_graphics(&p.print_graphics)?;
    p.validate_imported_hardware(&p.imported_hardware)?;
    let mut next=Session::new(p)?;
    if v.get("project").is_some() && v.get("template").is_none() {
     if let Some(path)=std::env::args().nth(2) {
      // The project and journal are separate files. A crash after committing
      // the project but before renaming its staged journal must not erase
      // cross-restart Undo/Redo. Only a digest-matched journal is accepted.
      recover_durable_history_or_reject(&mut next,std::path::Path::new(&path))?;
     }
    }
    let out=next.snapshot(true,true);session=Some(next);return Ok(out)
   }
   session.as_mut().ok_or("Open a garment first")?.request(&v)
  })();
  let response=match result{Ok(data)=>json!({"ok":true,"data":data}),Err(error)=>json!({"ok":false,"error":error,"data":session.as_ref().map(|s|s.snapshot(false,false))})};
  println!("{}",response);let _=io::stdout().flush();
 }
}
