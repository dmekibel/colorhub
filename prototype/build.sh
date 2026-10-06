#!/bin/sh
# Inlines src/data.js into src/index.template.html -> index.html
cd "$(dirname "$0")"
python3 -c "t=open('src/index.template.html').read();d=open('src/data.js').read();open('index.html','w').write(t.replace('/*DATA*/',d))"
echo "built index.html"
