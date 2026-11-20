# Atualização V4 → V5 — Sabores da Fran

## O que mudou
- O administrador pode criar grupos de **Sabor**, **Tamanho**, **Borda**, **Adicionais** ou qualquer outro nome.
- Cada grupo pode ser **obrigatório** ou opcional e permitir escolha única ou múltipla.
- Cada opção possui preço adicional (pode ser R$ 0).
- Carrinho calcula o preço por unidade com os adicionais, multiplica pela quantidade e soma o pedido.
- As escolhas aparecem no WhatsApp e no histórico do painel.
- O MySQL registra o preço final validado pelo servidor, e os pedidos pagos alimentam o CRM e o Excel.

## Como instalar na Hostinger sem perder dados

1. **Faça backup** do MySQL (phpMyAdmin → Exportar) e da pasta `public/uploads` (ou pasta configurada em `UPLOADS_DIR`).
2. Entre no phpMyAdmin do seu banco **`u426849489_fran`**. Verifique se está selecionado o banco correto.
3. Na aba **Importar**, envie `sql/atualizacao_v5.sql` ou o arquivo SQL separado desta entrega. O script só cria duas tabelas com `IF NOT EXISTS`; não apaga dados.
4. Na sua aplicação Node.js, substitua os arquivos antigos pelos novos. A **raiz do projeto** deve conter `server.js`, `package.json`, `lib/`, `public/` e `sql/`. Preserve seus arquivos personalizados em `public/uploads` e todas as variáveis de ambiente da V4.
5. Execute `npm install`, mantenha o comando `npm start` e reinicie/reimplante na Hostinger.
6. Acesse `https://SEU-DOMINIO/api/health` (status `ok`, versão `5.0.0`) e depois `https://SEU-DOMINIO/admin`.
7. No painel, abra **Cardápio → Editar produto → Personalizações do produto**. Use **Exemplo: sabor + tamanho + borda** ou adicione grupos manualmente e salve.
8. Faça um pedido de teste com diferentes escolhas e quantidades; confira o total, o WhatsApp e o histórico do painel antes de divulgar.

**Importante:** se `DB_SKIP_SCHEMA=true`, a aplicação **não criará automaticamente** as tabelas novas. Nesse caso, o SQL do passo 3 é obrigatório. Se o SQL der erro de permissão, peça à Hostinger permissão `CREATE` ou use o usuário com acesso total ao banco.

## Exemplo de precificação
Produto R$ 40,00 + tamanho Grande R$ 12,00 + borda de cheddar R$ 7,00 = **R$ 59,00/unidade**. Quantidade 2 = **R$ 118,00**. Os valores no arquivo demonstrativo não são preços oficiais.

## Sem necessidade de variáveis novas
As variáveis `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `SESSION_SECRET` da versão anterior permanecem iguais. Nenhuma chave nova é exigida por essa função. As mensagens automáticas de status continuam dependendo das credenciais oficiais do WhatsApp Business Cloud API configuradas anteriormente.
