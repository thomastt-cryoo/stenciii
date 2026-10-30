"""Keep qualified CI downloads on a separate branch, never publish a release.

Actions artifacts expire. This retains the exact bytes without modifying the
tested source branch or rebuilding packages for documentation changes.
"""
from pathlib import Path
import os,subprocess,sys,tempfile,time
root=Path(__file__).resolve().parents[2];folder=Path(sys.argv[1]).resolve();platform=sys.argv[2];source=os.environ['GITHUB_SHA'];branch='codex/m7-artifacts'
env={**os.environ,'GIT_AUTHOR_NAME':'Stencil package CI','GIT_AUTHOR_EMAIL':'ci@stencil.invalid','GIT_COMMITTER_NAME':'Stencil package CI','GIT_COMMITTER_EMAIL':'ci@stencil.invalid'}
def git(*args,**kw):return subprocess.check_output(['git',*args],cwd=root,env=env,**kw).decode().strip()
with tempfile.TemporaryDirectory()as temp:
    env['GIT_INDEX_FILE']=str(Path(temp)/'index')
    for attempt in range(4):
        fetch=subprocess.run(['git','fetch','origin',f'{branch}:refs/remotes/origin/{branch}'],cwd=root,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        parent=git('rev-parse',f'refs/remotes/origin/{branch}')if fetch.returncode==0 else None
        git('read-tree',parent if parent else '--empty')
        for file in sorted(folder.rglob('*')):
            if file.is_file() and not any(s in ['profile','profiles']for s in file.relative_to(folder).parts):
                sha=git('hash-object','-w',str(file));path=f'{source}/{platform}/{file.relative_to(folder).as_posix()}';git('update-index','--add','--cacheinfo',f'100644,{sha},{path}')
        tree=git('write-tree');commit=git('commit-tree',tree,*(['-p',parent]if parent else[]),'-m',f'M7 {platform} package evidence for {source}')
        pushed=subprocess.run(['git','push','origin',f'{commit}:refs/heads/{branch}'],cwd=root,env=env)
        if pushed.returncode==0:print(commit);break
        time.sleep(2)
    else:raise RuntimeError('Could not retain package evidence after four fast-forward attempts')
