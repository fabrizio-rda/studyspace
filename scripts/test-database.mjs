import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
const uidA='10000000-0000-4000-8000-000000000001',uidB='20000000-0000-4000-8000-000000000002';
const state={schemaVersion:3,courses:[{id:'course-a',name:'Física',description:'',color:'#83A8EB',icon:'atom',archived:false,order:0}],tasks:[],events:[],units:[],topics:[],plans:[],scheduledSessions:[],studyLogs:[],reviewHistory:[],folders:[],documents:[],classroomLinks:[],classroomItems:[],activeTimer:null,settings:{name:'Usuario',timezone:'America/Lima',compact:false,showArchived:false,sidebarCollapsed:false,taskView:'list'},studyPreferences:{availability:[60,60,60,60,60,90,90],preferredMinutes:25,pomodoroMinutes:25,shortBreakMinutes:5,longBreakMinutes:15,longBreakEvery:4,reviewIntervals:[1,2,5,14],dayStart:'16:00',dayEnd:'22:00',activityReserveMinutes:30,reviewPercent:20},integrationPreferences:{lastClassroomSync:null}};
async function user(id){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])}
async function save(s,rev,mutation){return (await db.query('select public.studyspace_save($1::jsonb,$2::bigint,$3::text) as result',[JSON.stringify(s),rev,mutation])).rows[0].result}
async function read(){return (await db.query('select public.studyspace_read() as result')).rows[0].result}
try{
 await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;");
 await db.query('insert into auth.users values($1),($2)',[uidA,uidB]);
 await db.exec(await readFile(new URL('../supabase/migrations/202610150001_phase3.sql',import.meta.url),'utf8'));
 await db.exec('set role authenticated');await user(uidA);
 assert.equal((await read()).revision,0);const first=await save(state,0,'import-one');assert.deepEqual(first.state,state);assert.equal(first.revision,1);
 assert.equal((await save(state,0,'import-one')).revision,1);assert.equal((await db.query('select * from public.studyspace_courses')).rows.length,1);
 await assert.rejects(()=>save({...state,tasks:[]},0,'stale-mutation'),/REVISION_CONFLICT/);
 const next=structuredClone(state);next.folders=[{id:'f-root',name:'Unidad',parentId:null,courseId:'course-a',icon:'folder',color:'#83A8EB',createdAt:'2026-10-15T12:00:00.000Z'},{id:'f-child',name:'Materiales',parentId:'f-root',courseId:'course-a',icon:'folder',color:'#B3DFF5',createdAt:'2026-10-15T12:00:00.000Z'}];next.documents=[{id:'d-one',name:'Lectura',url:'https://example.com/material',source:'manual',externalId:null,mimeType:'text/uri-list',folderId:'f-child',courseId:'course-a',topicId:null,tags:['Tema A'],createdAt:'2026-10-15T12:00:00.000Z'}];assert.deepEqual((await save(next,1,'second')).state,next);
 const broken=structuredClone(next);broken.folders[0].parentId='f-child';await assert.rejects(()=>save(broken,2,'cycle'),/FOLDER_CYCLE/);assert.equal((await read()).revision,2);
 await user(uidB);assert.equal((await read()).state,null);assert.equal((await db.query('select * from public.studyspace_courses')).rows.length,0);
 await assert.rejects(()=>db.query('insert into public.studyspace_courses(owner_id,id,payload) values($1,$2,$3::jsonb)',[uidA,'attack',JSON.stringify({...state.courses[0],id:'attack'})]),/row-level security/);
 const b=structuredClone(state);b.courses[0].id='course-b';await save(b,0,'b-first');
 const cross=structuredClone(b);cross.documents=[{...next.documents[0],folderId:null,courseId:'course-a'}];await assert.rejects(()=>save(cross,1,'cross-owner-ref'),/foreign key/);assert.equal((await read()).revision,1);
 await user(uidA);assert.deepEqual((await read()).state,next);
 await db.exec('reset role');const policies=await db.query("select relname,relrowsecurity,relforcerowsecurity from pg_class where relname like 'studyspace_%' and relkind='r'");assert.equal(policies.rows.length,16);assert(policies.rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
 await db.exec('set role anon');await user('');await assert.rejects(()=>read(),/permission denied/);await assert.rejects(()=>db.query('select * from public.studyspace_courses'),/permission denied/);
 console.log('SQL/PGlite: 14 comprobaciones: migración ejecutable, roundtrip relacional, revisión, reintento idempotente, orden, ciclos, rollback, aislamiento de dos usuarios, rechazo de escritura ajena y FK cruzada, RLS forzada en 16 tablas y denegación anónima. No sustituye la prueba en tu proyecto Supabase.');
}finally{await db.close()}
