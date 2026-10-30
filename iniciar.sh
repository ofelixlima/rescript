#!/usr/bin/env bash

# Muda para o diretório onde o próprio script está localizado
cd "$(dirname "$0")"

echo "========================================================"
echo "      INICIANDO RESCRIPT - SERVIDOR LOCAL"
echo "========================================================"
echo ""

# Abre o navegador automaticamente em segundo plano após 2 segundos
(
  sleep 2
  if which xdg-open > /dev/null; then
    xdg-open "http://localhost:3000"
  elif which open > /dev/null; then
    open "http://localhost:3000"
  fi
) &

# Inicia o servidor local
npm run dev