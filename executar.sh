#!/usr/bin/env bash
cd "/home/acer/Documentos/GitHub/rescript" || exit 1

# Carrega o ambiente do Node / NVM do usuário
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"
[ -s "$HOME/.profile" ] && source "$HOME/.profile"
[ -s "$HOME/.bashrc" ] && source "$HOME/.bashrc"

export ELECTRON_DISABLE_SANDBOX=1
export PATH="$PATH:/usr/local/bin:$HOME/.local/bin"

exec npm run electron:dev