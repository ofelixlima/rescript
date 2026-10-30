cat << 'EOF' > instalar_linux.sh
#!/usr/bin/env bash

# ==============================================================================
# SCRIPT DE INSTALAÇÃO DO ATALHO E ÍCONE DO RESCRIPT NO LINUX
# ==============================================================================

# 1. Identifica a pasta onde este script está localizado
DIR_PROJETO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PASTA_ICONES="$HOME/.local/share/icons"
PASTA_ATALHOS="$HOME/.local/share/applications"

echo "=========================================================="
echo "      INSTALANDO ATALHO E ÍCONE OFICIAL DO RESCRIPT       "
echo "=========================================================="
echo "📁 Diretório do Projeto: $DIR_PROJETO"

# 2. Garante as pastas do sistema
mkdir -p "$PASTA_ICONES"
mkdir -p "$PASTA_ATALHOS"

# 3. Localiza e copia o ícone oficial em alta resolução (PNG)
ICONE_SRC=$(find "$DIR_PROJETO/build" "$DIR_PROJETO/public" "$DIR_PROJETO/app" -name "*icon*512*.png" -o -name "icon.png" -o -name "logo*.png" 2>/dev/null | head -n 1)

if [ -n "$ICONE_SRC" ]; then
  # Salva uma cópia de backup na raiz do projeto
  cp "$ICONE_SRC" "$DIR_PROJETO/rescript-icon.png"
  # Salva na pasta oficial de ícones do Linux
  cp "$ICONE_SRC" "$PASTA_ICONES/rescript.png"
  echo "🎨 Ícone oficial aplicado: $ICONE_SRC"
elif [ -f "$DIR_PROJETO/rescript-icon.png" ]; then
  cp "$DIR_PROJETO/rescript-icon.png" "$PASTA_ICONES/rescript.png"
  echo "🎨 Ícone oficial restaurado do backup local."
else
  echo "⚠️ Aviso: Ícone oficial não encontrado, procurando fallback..."
  find "$DIR_PROJETO" -name "*.png" | grep -i "icon" | head -n 1 | xargs -I {} cp {} "$PASTA_ICONES/rescript.png"
fi

# 4. Cria o executor oficial compatível com NVM / Node moderno
cat << EXEC_EOF > "$DIR_PROJETO/executar.sh"
#!/usr/bin/env bash
cd "$DIR_PROJETO" || exit 1

# Carrega o ambiente do Node / NVM do usuário
[ -s "\$HOME/.nvm/nvm.sh" ] && \. "\$HOME/.nvm/nvm.sh"
[ -s "\$HOME/.profile" ] && source "\$HOME/.profile"
[ -s "\$HOME/.bashrc" ] && source "\$HOME/.bashrc"

export ELECTRON_DISABLE_SANDBOX=1
export PATH="\$PATH:/usr/local/bin:\$HOME/.local/bin"

exec npm run electron:dev
EXEC_EOF

chmod +x "$DIR_PROJETO/executar.sh"

# 5. Cria o atalho .desktop do sistema
cat << DESKTOP_EOF > "$PASTA_ATALHOS/rescript.desktop"
[Desktop Entry]
Name=ReScript
Comment=Editor de Vídeo por Texto
Exec=$DIR_PROJETO/executar.sh
Icon=$PASTA_ICONES/rescript.png
Terminal=false
Type=Application
Categories=AudioVideo;Video;AudioVideoEditing;
StartupNotify=true
DESKTOP_EOF

chmod +x "$PASTA_ATALHOS/rescript.desktop"

# 6. Atualiza o banco de dados de aplicativos do Linux
update-desktop-database "$PASTA_ATALHOS" 2>/dev/null || true

echo "----------------------------------------------------------"
echo "✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!"
echo "🚀 O ReScript já está disponível no seu Menu de Aplicativos!"
echo "=========================================================="
EOF

# Dá permissão de execução ao instalador
chmod +x instalar_linux.sh
echo "🎉 Arquivo 'instalar_linux.sh' criado e pronto para backup!"

## Instructions to run the script
#npm install
#./instalar_linux.sh