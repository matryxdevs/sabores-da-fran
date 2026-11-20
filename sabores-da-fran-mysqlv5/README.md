# Sabores da Fran — Site + Cardápio Personalizável + CRM + WhatsApp (v5.0)

Projeto completo Node.js 22+ / MySQL para **Sabores da Fran**. Mantém a identidade **branca, vermelha e preta**, usa a logo do projeto, apresenta produtos, aceita pedidos em carrinho, encaminha a mensagem do pedido ao WhatsApp, disponibiliza painel administrativo, vídeo e banners. A versão 3 acrescenta **CRM de clientes, movimentação financeira mensal, exportação Excel, mapa integrado e tentativa automática de notificação de status via API oficial da Meta**.

## Nova função V5: opções de produtos e valores adicionais

No **Painel → Cardápio → Novo produto / Editar**, abra **Personalizações do produto**. Clique em **+ Grupo** para cadastrar conjuntos como **Sabor**, **Tamanho**, **Borda**, **Molho** ou **Adicionais**; ou clique em **Exemplo: sabor + tamanho + borda** para começar com opções editáveis. Em cada grupo, configure:

- **Nome do grupo** (ex.: `Tamanho`);
- **Tipo de seleção**: **Apenas uma** para tamanho/sabor/borda, ou **Várias opções** para adicionais;
- **Escolha obrigatória**: o cliente não poderá concluir a personalização sem escolher;
- **Máximo de opções**: para seleção múltipla (ex.: até 2 adicionais);
- **Nome e valor extra de cada opção**: ex.: `Média +R$ 0,00`, `Grande +R$ 12,00`, `Borda cheddar +R$ 7,00`.

Um produto de R$ 40,00 com tamanho Grande (+R$ 12) e borda cheddar (+R$ 7) passa a R$ 59,00 **por unidade**. Se o cliente selecionar 2 unidades, o valor é R$ 118,00. As escolhas são incluídas no carrinho e detalhadas na mensagem do WhatsApp. O servidor recalcula os valores a partir do MySQL, não aceita preços enviados pelo navegador, e armazena uma cópia das escolhas no histórico do pedido. O CRM contabiliza a receita efetiva somente depois de o administrador confirmar o pagamento.

**Banco de dados:** esta versão adiciona `product_option_groups` e `order_item_customizations`. Para atualizar um banco da V4 sem perder dados, importe no phpMyAdmin o arquivo **`sql/atualizacao_v5.sql`** antes de enviar os novos arquivos Node.js. Esse arquivo usa `CREATE TABLE IF NOT EXISTS` e é seguro reexecutar. Com `DB_SKIP_SCHEMA=true`, a aplicação NÃO cria tabelas automaticamente, portanto a importação manual é obrigatória. Se `DB_SKIP_SCHEMA` não estiver definido como `true`, o aplicativo tenta criar as novas tabelas com as permissões do usuário MySQL. **Faça backup do banco e dos uploads antes de qualquer atualização.**

Os produtos e valores demonstrativos são exemplos que devem ser substituídos antes de divulgar o site comercialmente. Para novas instalações, há um item de teste chamado **Pizza da Fran (exemplo)** com tamanho, sabor e borda. Para quem já tem o banco instalado, configure as opções nos produtos existentes pelo painel.

## 1. Instalação / migração de uma versão anterior

**Se o site V4 já está em produção, não apague o banco MySQL e não importe novamente registros de exemplo.**

1. **Faça backup** do MySQL e dos arquivos de imagens/vídeos antes de atualizar. No phpMyAdmin, selecione o banco e use **Exportar**.
2. No phpMyAdmin, abra o **mesmo banco MySQL do site atual** e importe **`sql/atualizacao_v3.sql`**. Os arquivos criam tabelas adicionais (com `IF NOT EXISTS`), preservando o cardápio, clientes, pedidos e configurações anteriores. É seguro reaplicar. Não é necessário executar `DROP TABLE`.
3. Na Hostinger, substitua os arquivos do projeto Node.js pelo conteúdo desta versão, **preservando a pasta persistente `uploads` e os segredos de produção**. A raiz da aplicação deve conter `server.js` e `package.json`.
4. Execute `npm install` para instalar também a dependência de exportação Excel. Configure o comando de inicialização `npm start`. Node.js 22.9 ou superior.
5. Verifique as variáveis do MySQL. Se você já importou `sql/atualizacao_v5.sql`, pode manter `DB_SKIP_SCHEMA=true`. Caso contrário, deixe `DB_SKIP_SCHEMA=false` para o aplicativo tentar criar as tabelas de `sql/schema.sql` ao iniciar (precisa da permissão `CREATE`).
6. Reinicie/reimplante a aplicação e visite **`/api/health`**; o esperado é `{"status":"ok","database":"connected","version":"5.0.0"}`. Abra **`/admin`**.

**Nova instalação**: use `sql/schema.sql` (cria todas as tabelas de uma vez), configure todas as variáveis e execute `npm install && npm start`. Os produtos iniciais são demonstrativos; configure o cardápio real antes de divulgar.

### Hostinger — variáveis de ambiente

```dotenv
PORT=3000
HOST=0.0.0.0
ADMIN_EMAIL=SEU_EMAIL_DE_ADMIN
ADMIN_PASSWORD=SUA_SENHA_FORTE_COM_12_OU_MAIS_CARACTERES
SESSION_SECRET=CHAVE_ALEATORIA_COM_32_OU_MAIS_CARACTERES
DB_HOST=HOST_REAL_DO_MYSQL
DB_PORT=3306
DB_NAME=NOME_COMPLETO_DO_BANCO
DB_USER=USUARIO_COMPLETO_DO_MYSQL
DB_PASSWORD=SENHA_REAL_DO_MYSQL
DB_POOL_SIZE=5
DB_SKIP_SCHEMA=true
WHATSAPP_NUMBER=55DDDNUMERO
```

Use os valores **exatos** informados no hPanel para `DB_HOST`, `DB_NAME` e `DB_USER`; não use os textos demonstrativos acima. `ADMIN_PASSWORD` não é a senha do MySQL. `SESSION_SECRET` deve ser uma sequência aleatória guardada em segredo; gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

## 2. CRM financeiro

No **Painel administrativo → CRM e financeiro**, selecione um mês (AAAA-MM). Você verá:

- **Receita recebida:** soma dos pedidos que foram marcados manualmente como **Pago** em **Pedidos**. Apenas mudar o status para Entregue NÃO contabiliza receita; marcar o pagamento é uma ação separada.
- **Compras de mercadorias:** lance a data, descrição (carne, pão, queijo, bebidas, embalagens...), fornecedor, categoria, quantidade e custo unitário. O total é calculado no servidor a partir de quantidade × custo.
- **Despesas operacionais:** lance aluguel, energia, água, taxas, logística, internet etc. com data, categoria e valor.
- **Resultado estimado:** receita recebida − compras de mercadorias − despesas operacionais do mês.
- **Retorno sobre gasto (%):** resultado estimado ÷ gastos totais × 100. **Margem estimada (%):** resultado estimado ÷ receita × 100.
- **CRM de clientes:** nome e número de WhatsApp, total de pedidos, total pago, histórico resumido e botão para conversar.
- **Exportar Excel (.xlsx):** relatório do mês com as abas `Resumo`, `Compras`, `Despesas`, `Vendas` e `Clientes`.

**Distinção importante:** resultado estimado **não é lucro contábil**, pois compras podem formar estoque que será vendido em outro mês, e o painel depende de registrar corretamente despesas, compras e pagamentos. O sistema não calcula CMV contábil, depreciação, impostos, folha não cadastrada ou margem unitária real de cada hambúrguer. Despesas de compra de mercadorias não devem ser lançadas novamente como despesas operacionais (evita dupla contagem). Se a taxa de entrega de um pedido estiver “a confirmar”, informe o valor no detalhe do pedido antes de marcá-lo como Pago.

## 3. Localização do estabelecimento

Localização inicial configurada na vitrine e no painel:

- **Latitude:** `-6.5395278`
- **Longitude:** `-49.8771111`
- **Coordenadas originais:** `6°32'22.3\"S 49°52'37.6\"W`

O cliente encontra um **mapa incorporado** e o botão **Abrir rota no Google Maps**. Em **Personalizar site**, o administrador pode alterar latitude, longitude, endereço textual e horário. A coordenada não substitui o endereço postal para cobrança/entrega.

## 4. Aviso automático quando o status do pedido muda

A automação depende de uma **conta habilitada no WhatsApp Business Platform / Cloud API**, credenciais da Meta e de um **modelo de mensagem de utilidade aprovado**. Não é possível realizar esse envio automático somente com um link `wa.me` ou com o WhatsApp pessoal.

Crie na plataforma da Meta um modelo com nome, por exemplo, `status_pedido_fran`, idioma **Português (Brasil) `pt_BR`**, com corpo equivalente a:

> Olá {{1}}! O status do seu pedido {{2}} na Sabores da Fran foi atualizado para: {{3}}.

Os parâmetros devem existir **exatamente nessa ordem**: `{{1}}` nome do cliente; `{{2}}` identificador do pedido; `{{3}}` novo status. Solicite a **aprovação do modelo como mensagem de utilidade** antes de publicar a automação. Configure na Hostinger:

```dotenv
WA_ACCESS_TOKEN=TOKEN_DE_ACESSO_META
WA_PHONE_NUMBER_ID=ID_DO_NUMERO_NA_CLOUD_API
WA_TEMPLATE_NAME=status_pedido_fran
WA_TEMPLATE_LANG=pt_BR
WA_GRAPH_VERSION=v27.0
```

`WA_PHONE_NUMBER_ID` **não** é o número de telefone, é o identificador do número da conta WhatsApp Business no painel da Meta. O token de acesso precisa das permissões exigidas para enviar mensagens; mantenha o token apenas nas variáveis de ambiente do servidor, nunca dentro de HTML, JavaScript público ou repositório.

**Fluxo**: no checkout, o consumidor pode marcar (desmarcada por padrão) a opção autorizando avisos transacionais do pedido; o site grava essa autorização no MySQL. Quando um administrador altera o status em **Pedidos**, o backend salva o status, tenta enviar um template para o WhatsApp do cliente e registra no banco o resultado (`accepted`, `failed` ou `skipped`). O painel mostra o resultado. Se o status não mudou, não ocorre novo disparo; no detalhe do pedido, existe a opção **Reenviar aviso** para pedidos autorizados.

- **Aceito pela API**: a Meta aceitou a requisição, **não comprova que o usuário recebeu ou leu**. Este projeto não inclui integração de webhooks de entrega.
- **Falha**: mostra a mensagem de diagnóstico sem expor o token. Verifique template aprovado, número habilitado, permissões, saldo/cobrança e conectividade da hospedagem.
- **Não enviado**: cliente não autorizou ou credenciais ainda não foram configuradas. Pedidos antigos da versão 2 não passam a ter autorização automaticamente.

A Meta pode aplicar tarifação de mensagens. O envio deve seguir os requisitos da API, regras vigentes, consentimento e política de privacidade. A mensagem de status é transacional: não use esse template para publicidade.

Referência oficial: https://developers.facebook.com/documentation/business-messaging/whatsapp/overview

## 5. Fluxo do cliente e manutenção

O cliente personaliza produtos com **sabores, tamanhos, bordas e adicionais** antes de adicionar ao **carrinho**, preenche **nome, número de WhatsApp, retirada ou entrega, endereço completo e ponto de referência** (para entrega), forma de pagamento e observações. O servidor grava os dados no MySQL, calcula os valores de acordo com o preço vigente e abre `wa.me` com a mensagem pronta. **O cliente ainda precisa tocar em Enviar no WhatsApp**. Pedido iniciado no site **não comprova pedido confirmado, entregue ou pago**.

- **Painel:** `/admin`
- **Saúde do MySQL:** `/api/health`
- **Arquivos SQL:** `sql/schema.sql` (nova instalação), `sql/atualizacao_v3.sql` (CRM V3) e `sql/atualizacao_v5.sql` (personalizações V5)
- **CRM financeiro e exportação Excel:** acesso somente com login de administrador.

Todas as informações de pagamento são **lançadas manualmente**; não há cobrança Pix integrada neste projeto. A exportação Excel precisa da dependência `exceljs` instalada por `npm install`. A API utiliza `mysql2`. Não coloque tokens Meta, `.env`, backups de clientes ou dumps MySQL em pastas públicas.

Faça backup recorrente do banco e da pasta persistente de uploads; utilize HTTPS e senhas fortes. Antes de publicar, revise o aviso de privacidade e os procedimentos aplicáveis à LGPD (consentimento, retenção, solicitações de exclusão e direitos dos titulares).
