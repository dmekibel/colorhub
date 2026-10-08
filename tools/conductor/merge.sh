#!/bin/bash
# Conductor merge: merge branch $1 into main; resolve index.html as ours + their new tags; commit.
cd "$(dirname "$0")/../.." || exit 1
B=$1
git merge --no-edit "$B" >/tmp/cm.log 2>&1; tail -1 /tmp/cm.log
U=$(git status --short | grep "^UU" | awk '{print $2}')
if echo "$U" | grep -q index.html; then
  git show "$B":index.html > /tmp/theirs.html; git checkout --ours index.html
  python3 - <<'EOF'
import re
ours=open("index.html").read(); theirs=open("/tmp/theirs.html").read()
v=re.search(r'\?v=[0-9a-z]+',ours).group(0)
strip=lambda t: set(re.sub(r'\?v=[0-9a-z]*','',l).strip() for l in t.split("\n") if ('<link' in l or '<script' in l))
for l in strip(theirs)-strip(ours):
    tag=l.replace('.css"',f'.css{v}"').replace('.js"',f'.js{v}"')
    if '<link' in l: ours=ours.replace('</head>',tag+'\n</head>',1)
    else:
        # new scripts go before router.js/boot.js (boot runs the first route; everything must be loaded by then)
        i=ours.find('<script src="js/router.js'); i = i if i>=0 else ours.find('<script src="js/boot.js')
        ours=ours[:i]+tag+'\n'+ours[i:]
    print("added",tag)
open("index.html","w").write(ours)
EOF
  git add index.html
fi
U2=$(git status --short | grep "^UU")
if [ -n "$U2" ]; then echo "UNRESOLVED: $U2"; exit 2; fi
git diff --cached --quiet || git commit -qm "Merge $B

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
echo "merged $B"
