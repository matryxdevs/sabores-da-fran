'use strict';
const database = require('../lib/database');
(async () => {
  try {
    const [rows] = await database.pool.query('SELECT DATABASE() AS database_name, USER() AS connected_user, VERSION() AS mysql_version');
    const [tables] = await database.pool.query('SHOW TABLES');
    console.log('CONEXÃO MYSQL: OK');
    console.log(`Banco: ${rows[0].database_name}`);
    console.log(`Usuário: ${rows[0].connected_user}`);
    console.log(`Versão do servidor: ${rows[0].mysql_version}`);
    console.log(`Tabelas encontradas: ${tables.length} (esperadas: 5)`);
    if (tables.length < 5) console.log('AVISO: importe o arquivo sql/schema.sql ou inicie o site para criar as tabelas.');
  } catch (error) {
    console.error(`FALHA: ${error.code || 'DB_ERROR'}`);
    console.error(database.diagnostic(error));
    process.exitCode = 1;
  } finally { await database.pool.end(); }
})();
