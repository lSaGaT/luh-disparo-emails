# Central de Documentos

Sistema de envio de formulários, contratos (Autentique) e cobranças (Asaas).

## Primeira instalação (PC novo)

1. Baixe o código: botão verde **Code** → **Download ZIP**
2. Extraia o ZIP numa pasta qualquer (ex.: `Documentos\Central-de-Documentos`)
3. Dê dois cliques em **`instalar.bat`** — ele instala tudo sozinho (Node.js, dependências, banco de dados) e cria o atalho na área de trabalho. Se o Windows pedir permissão de administrador, confirme
4. Abra o sistema pelo atalho **Central de Documentos** no Desktop
5. No primeiro acesso, cadastre seu usuário (o sistema mostra a tela de cadastro automaticamente)
6. Em **Configurações**, preencha SMTP (e-mail), Autentique e Asaas

> A instalação precisa de internet. Depois disso o sistema funciona offline (só o envio real de e-mails/assinaturas precisa de internet).

## Atualizar o sistema

Quando avisarem que há versão nova:

1. **Feche o sistema** (janela preta do sistema e a aba do navegador)
2. Dê dois cliques em **`atualizar.bat`** — ele baixa a versão nova do GitHub, instala o que faltar e recompila
3. Seus dados **não são afetados** (banco, configurações e contratos ficam intactos)
4. Abra normalmente pelo atalho

> Se der qualquer erro, execute de novo. Se persistir, execute `instalar.bat` de novo — nada é perdido.

## Rodar / Parar

- **Abrir**: atalho do Desktop (ou `iniciar.bat`)
- **Parar**: feche a janela preta do sistema

## Observações técnicas

- Porta padrão: `3000` (para trocar, edite `set "PORT=3000"` dentro de `iniciar.bat`)
- Backup: copie a pasta `data\` — nela vivem o banco de dados e as configurações
- O sistema roda em qualquer pasta/PC — nada é fixo em caminho de usuário
