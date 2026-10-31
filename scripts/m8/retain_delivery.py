"""Commit exact review files/evidence on the existing artifact branch; no release."""
from pathlib import Path
import os,subprocess,sys,tempfile,time
root=Path(__file__).resolve().parents[2];folder=Path(sys.argv[1]).resolve();source=os.environ['GITHUB_SHA'];branch='codex/m7-artifacts'
env={**os.environ,'GIT_AUTHOR_NAME':'Stencil customer QA','GIT_AUTHOR_EMAIL':'ci@stencil.invalid','GIT_COMMITTER_NAME':'Stencil customer QA','GIT_COMMITTER_EMAIL':'ci@stencil.invalid'}
def git(*args):return subprocess.check_output(['git',*args],cwd=root,env=env).decode().strip()
with tempfile.TemporaryDirectory()as t:
 env['GIT_INDEX_FILE']=str(Path(t)/'index')
 for attempt in range(4):
  git('fetch','origin',f'{branch}:refs/remotes/origin/{branch}');parent=git('rev-parse',f'origin/{branch}');git('read-tree',parent)
  for file in sorted(folder.rglob('*')):
   if not file.is_file():continue
   blob=git('hash-object','-w',str(file))
   for prefix in [f'{source}/m8-delivery','m8-current']:
    git('update-index','--add','--cacheinfo',f'100644,{blob},{prefix}/{file.relative_to(folder).as_posix()}')
  tree=git('write-tree');commit=git('commit-tree',tree,'-p',parent,'-m',f'M8 verified customer review files and evidence for {source}; no public release')
  p=subprocess.run(['git','push','origin',f'{commit}:refs/heads/{branch}'],cwd=root,env=env)
  if p.returncode==0:print(commit);break
  time.sleep(2)
 else:raise RuntimeError('Could not retain delivery after four fast-forward attempts')
