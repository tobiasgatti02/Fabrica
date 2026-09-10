"""Fetch the pinned CC0 material set. API is used during authoring, never at runtime."""
import json, pathlib, subprocess, concurrent.futures
R=pathlib.Path(__file__).resolve().parents[1];A=R/'assets/casa-patio'; A.mkdir(exist_ok=True,parents=True)
manifest=[]; jobs=[]
for asset in ['concrete_wall_006','wood_table_001','fabric_pattern_07','oak_wood_planks']:
 data=json.loads(subprocess.check_output(['curl','-fsSL',f'https://api.polyhaven.com/files/{asset}']))
 for key,dest in [('Diffuse','Diffuse'),('col_1','Diffuse'),('nor_gl','nor_gl'),('Rough','rough')]:
  entry=data.get(key,{}).get('1k',{}).get('jpg')
  if not entry: continue
  p=A/f'{asset}_{dest}.jpg';jobs.append((entry['url'],str(p)))
  manifest.append({'asset':asset,'map':key,'source':f'https://polyhaven.com/a/{asset}','url':entry['url'],'license':'CC0','path':str(p.relative_to(R))})
data=json.loads(subprocess.check_output(['curl','-fsSL','https://api.polyhaven.com/files/rosendal_plains_2']))['hdri']['1k']['hdr']
p=R/'web/public/environment/rosendal-plains-1k.hdr';jobs.append((data['url'],str(p)))
manifest.append({'asset':'rosendal_plains_2','source':'https://polyhaven.com/a/rosendal_plains_2','url':data['url'],'license':'CC0','path':str(p.relative_to(R))})
def get(job):
 if not pathlib.Path(job[1]).exists():subprocess.run(['curl','-fsSL',job[0],'-o',job[1]],check=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(get,jobs))
(A/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Materials ready:',len(jobs))
