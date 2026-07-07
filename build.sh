#!/usr/bin/env bash
# ============================================================
# MaintX — reconstruit index.html (le fichier déployé sur GitHub Pages)
# à partir des morceaux dans src/.
#
# On édite les fichiers src/*.jsx, PAS index.html directement.
# Puis : bash build.sh   → régénère index.html
#        git add -A && git commit ... && git push
#
# Ordre = _head.html, puis les fichiers numérotés src/NN-*.jsx (tri
# alphabétique = ordre du code), puis _tail.html.
# ============================================================
set -e
cd "$(dirname "$0")"
cat src/_head.html src/[0-9]*.jsx src/_tail.html > index.html
echo "✅ index.html reconstruit ($(wc -l < index.html) lignes) depuis src/"
