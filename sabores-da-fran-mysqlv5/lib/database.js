'use strict';
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const {selectedOptions, moneyRound} = require('./options');

const required = ['DB_HOST', 'DB_USER', 'DB_NAME'];
const missing = required.filter(k => !String(process.env[k] || '').trim());
if (missing.length) throw new Error(`Variáveis MySQL ausentes: ${missing.join(', ')}. Copie .env.example para .env.`);
const pool = mysql.createPool({
  host: process.env.DB_HOST.trim(),
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER.trim(),
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME.trim(),
  waitForConnections: true,
  connectionLimit: Math.min(12, Math.max(2, Number(process.env.DB_POOL_SIZE || 5))),
  queueLimit: 50,
  charset: 'utf8mb4',
  decimalNumbers: true,
  timezone: 'Z',
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  ...(process.env.DB_SSL === 'true' ? { ssl: { minVersion: 'TLSv1.2' } } : {})
});

function diagnostic(err) {
  switch (err.code) {
    case 'ER_DBACCESS_DENIED_ERROR': return 'Usuário MySQL sem permissão sobre esse banco. No hPanel, associe o usuário ao banco correto e confira DB_NAME e DB_USER (incluindo prefixos).';
    case 'ER_ACCESS_DENIED_ERROR': return 'Usuário ou senha MySQL incorretos. Confira DB_USER e DB_PASSWORD.';
    case 'ER_BAD_DB_ERROR': return 'O banco indicado em DB_NAME não existe ou tem nome incorreto.';
    case 'ENOTFOUND': return 'DB_HOST inválido. Copie o host exibido pelo provedor; não use nomes de exemplo.';
    case 'ECONNREFUSED': return 'A conexão foi recusada. Confira DB_HOST, DB_PORT e se o servidor aceita conexões.';
    case 'ETIMEDOUT': return 'Tempo esgotado ao conectar. Verifique firewall, acesso remoto e DB_HOST.';
    case 'ER_TABLEACCESS_DENIED_ERROR': return 'O usuário não possui permissão para criar ou alterar tabelas. Importe sql/schema.sql via phpMyAdmin e reinicie.';
    default: return err.message || 'Erro de conexão MySQL.';
  }
}

async function initDatabase(seed) {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    // Arquivo igualmente importável no phpMyAdmin, sem criar banco ou usuário.
    const schema = fs.readFileSync(path.join(__dirname, '../sql/schema.sql'), 'utf8');
    if (process.env.DB_SKIP_SCHEMA !== 'true') {
      const queries = schema.replace(/^\s*--.*$/gm, '').split(';').map(q => q.trim()).filter(Boolean);
      for (const sql of queries) await conn.query(sql);
    }
    await conn.beginTransaction();
    const [existing] = await conn.query('SELECT id FROM site_settings WHERE id = 1 FOR UPDATE');
    if (!existing.length) {
      await conn.execute('INSERT INTO site_settings(id, payload) VALUES (1, ?)', [JSON.stringify(seed.settings)]);
      for (const p of seed.products) await insertProduct(p, conn);
      for (const p of seed.promos) await insertPromo(p, conn);
    }
    await conn.commit();
  } catch (err) {
    try { await conn.rollback(); } catch {}
    throw err;
  } finally {
    conn.release();
  }
}
const asJson = (value, fallback=[]) => {
  if (!value) return fallback;
  try { return typeof value === 'string' ? JSON.parse(value) : value; }
  catch { return fallback; }
};
const asProduct = r => ({ id:r.id, name:r.name, category:r.category, description:r.description,
  price:Number(r.price), image:r.image, featured:!!r.featured, available:!!r.available, sort:r.sort_order,
  optionGroups:asJson(r.option_groups_json,[]) });
const asPromo = r => ({ id:r.id, badge:r.badge, title:r.title, text:r.text, image:r.image, active:!!r.active });
const asOrder = r => ({ id:`FR-${String(r.id).padStart(5,'0')}`, createdAt:new Date(r.created_at).toISOString(),
  status:r.status, customer:r.customer, phone:r.phone, type:r.order_type, address:r.address,
  reference:r.reference_point, payment:r.payment, note:r.note, subtotal:Number(r.subtotal),
  fee:r.delivery_fee === null ? null : Number(r.delivery_fee), total:r.total === null ? null : Number(r.total), paid:!!r.paid,
  paidAt:r.paid_at ? new Date(r.paid_at).toISOString() : null, notifyOptIn:!!r.notify_opt_in,
  notificationStatus:r.notification_status||'', items:[] });

async function getSettings(conn=pool) {
  const [rows] = await conn.query('SELECT payload FROM site_settings WHERE id = 1 LIMIT 1');
  if (!rows.length) throw new Error('Configurações não encontradas no MySQL.');
  const saved=typeof rows[0].payload === 'string' ? JSON.parse(rows[0].payload) : rows[0].payload;
  return {mapLat:-6.5395278,mapLng:-49.8771111,...saved};
}
async function setSettings(settings) {
  await pool.execute('UPDATE site_settings SET payload = ? WHERE id = 1', [JSON.stringify(settings)]);
}
async function getProducts(onlyActive=false) {
  const [rows] = await pool.query(`SELECT p.*, pog.payload AS option_groups_json FROM products p LEFT JOIN product_option_groups pog ON pog.product_id=p.id ${onlyActive?'WHERE p.available = 1':''} ORDER BY p.sort_order ASC, p.created_at ASC`);
  return rows.map(asProduct);
}
async function getPromos(onlyActive=false) {
  const [rows] = await pool.query(`SELECT * FROM promotions ${onlyActive?'WHERE active = 1':''} ORDER BY created_at ASC`);
  return rows.map(asPromo);
}
async function getSite() {
  const [settings, products, promos] = await Promise.all([getSettings(), getProducts(true), getPromos(true)]);
  return {settings, products, promos};
}
async function insertProduct(p,conn=null) {
  const own=!conn;
  if(own){conn=await pool.getConnection();await conn.beginTransaction();}
  try {
    await conn.execute('INSERT INTO products(id,name,category,description,price,image,featured,available,sort_order) VALUES (?,?,?,?,?,?,?,?,?)',
      [p.id,p.name,p.category,p.description,p.price,p.image,p.featured?1:0,p.available?1:0,p.sort]);
    await conn.execute('INSERT INTO product_option_groups(product_id,payload) VALUES (?,?)',[p.id,JSON.stringify(p.optionGroups||[])]);
    if(own)await conn.commit();
  } catch(err){if(own)await conn.rollback();throw err;}
  finally {if(own)conn.release();}
}
async function updateProduct(p) {
  const conn=await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute('UPDATE products SET name=?,category=?,description=?,price=?,image=?,featured=?,available=?,sort_order=? WHERE id=?',
      [p.name,p.category,p.description,p.price,p.image,p.featured?1:0,p.available?1:0,p.sort,p.id]);
    if(result.affectedRows) await conn.execute('INSERT INTO product_option_groups(product_id,payload) VALUES (?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload)',[p.id,JSON.stringify(p.optionGroups||[])]);
    await conn.commit();
    return result.affectedRows>0;
  } catch(err){await conn.rollback();throw err;} finally {conn.release();}
}
async function removeProduct(id) {
  const [r] = await pool.execute('DELETE FROM products WHERE id = ?', [id]); return r.affectedRows > 0;
}
async function insertPromo(p,conn=pool) {
  await conn.execute('INSERT INTO promotions(id,badge,title,text,image,active) VALUES (?,?,?,?,?,?)',
    [p.id,p.badge,p.title,p.text,p.image,p.active?1:0]);
}
async function updatePromo(p) {
  const [r] = await pool.execute('UPDATE promotions SET badge=?,title=?,text=?,image=?,active=? WHERE id=?',
    [p.badge,p.title,p.text,p.image,p.active?1:0,p.id]); return r.affectedRows > 0;
}
async function removePromo(id) {
  const [r] = await pool.execute('DELETE FROM promotions WHERE id=?',[id]); return r.affectedRows > 0;
}
async function getOrders() {
  const [rows] = await pool.query(`SELECT o.*, COALESCE(op.paid, 0) AS paid, op.paid_at,
    COALESCE(pref.opted_in, 0) AS notify_opt_in,
    (SELECT n.dispatch_status FROM whatsapp_notifications n WHERE n.order_id=o.id ORDER BY n.id DESC LIMIT 1) AS notification_status
    FROM orders o LEFT JOIN order_payments op ON op.order_id=o.id
    LEFT JOIN order_notification_preferences pref ON pref.order_id=o.id
    ORDER BY o.id DESC LIMIT 500`);
  if (!rows.length) return [];
  const orders = rows.map(asOrder);
  const ids = rows.map(r=>Number(r.id));
  const marks = ids.map(()=>'?').join(',');
  const [items] = await pool.query(`SELECT oi.*, oic.details AS customization_json FROM order_items oi LEFT JOIN order_item_customizations oic ON oic.order_item_id=oi.id WHERE oi.order_id IN (${marks}) ORDER BY oi.id ASC`, ids);
  const byId = new Map(orders.map((o,i)=>[Number(rows[i].id),o]));
  for (const x of items) byId.get(Number(x.order_id))?.items.push({id:x.product_id,name:x.product_name,price:Number(x.unit_price),quantity:x.quantity,total:Number(x.line_total), options:asJson(x.customization_json,[])});
  return orders;
}
async function getAdminData() {
  const [settings,products,promos,orders] = await Promise.all([getSettings(),getProducts(),getPromos(),getOrders()]);
  return {version:2,settings,products,promos,orders};
}
async function createOrder(payload, inputItems) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [products] = await conn.query('SELECT p.*, pog.payload AS option_groups_json FROM products p LEFT JOIN product_option_groups pog ON pog.product_id=p.id WHERE p.available=1');
    const byId = new Map(products.map(row => [row.id,asProduct(row)]));
    const items = inputItems.map(row => {
      const p = byId.get(row.id), q=Number(row.quantity);
      if (!p || !Number.isInteger(q) || q<1 || q>30) throw Object.assign(new Error('Confira os produtos e quantidades do carrinho.'), { validation:true });
      // Não aceitar preços enviados pelo navegador: validar os IDs e recalcular tudo pelo MySQL.
      const {extraPrice,details} = selectedOptions(p.optionGroups||[],row.selections);
      const price=moneyRound(p.price+extraPrice);
      return {id:p.id,name:p.name,price,basePrice:p.price,quantity:q,total:moneyRound(price*q),options:details};
    });
    const subtotal=moneyRound(items.reduce((n,x)=>n+x.total,0));
    const settings=await getSettings(conn);
    const fee=payload.type==='delivery' ? settings.deliveryFee : 0;
    const total=fee===null ? null : moneyRound(subtotal+fee);
    const [insert] = await conn.execute(`INSERT INTO orders
      (status,customer,phone,order_type,address,reference_point,payment,note,subtotal,delivery_fee,total)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ['Aguardando envio no WhatsApp',payload.customer,payload.phone,payload.type,
        payload.type==='delivery'?payload.address:'',payload.type==='delivery'?payload.reference:'',
        payload.payment,payload.note,subtotal,fee,total]);
    for (const p of items) {
      const [result]=await conn.execute('INSERT INTO order_items(order_id,product_id,product_name,unit_price,quantity,line_total) VALUES (?,?,?,?,?,?)',
        [insert.insertId,p.id,p.name,p.price,p.quantity,p.total]);
      await conn.execute('INSERT INTO order_item_customizations(order_item_id,details) VALUES (?,?)',[result.insertId,JSON.stringify(p.options)]);
    }
    await conn.execute('INSERT INTO order_notification_preferences(order_id,opted_in,consent_at) VALUES (?,?,?)',
      [insert.insertId, payload.notifyOptIn?1:0, payload.notifyOptIn?new Date():null]);
    await conn.commit();
    return {id:`FR-${String(insert.insertId).padStart(5,'0')}`,items,subtotal,fee,total,settings};
  } catch(err) { await conn.rollback(); throw err; }
  finally { conn.release(); }
}
function numFromOrderId(id) {
  if (!/^FR-\d{5,18}$/.test(id)) return null;
  return String(BigInt(id.slice(3)));
}
async function changeOrderStatus(id,status) {
  const num=numFromOrderId(id); if(!num)return null;
  const conn=await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[row]] = await conn.query('SELECT id,status,phone,customer FROM orders WHERE id=? FOR UPDATE',[num]);
    if (!row) {await conn.rollback();return null;}
    if (row.status===status) {await conn.commit();return {changed:false,id, status};}
    const [[pref]] = await conn.query('SELECT opted_in FROM order_notification_preferences WHERE order_id=? LIMIT 1',[num]);
    await conn.execute('UPDATE orders SET status=? WHERE id=?',[status,num]);
    await conn.commit();
    return {changed:true,id,status,previousStatus:row.status,phone:row.phone,customer:row.customer,notifyOptIn:!!pref?.opted_in};
  } catch (e){await conn.rollback();throw e;} finally {conn.release();}
}
async function getOrderNotificationTarget(id) {
  const num=numFromOrderId(id); if(!num)return null;
  const [rows]=await pool.query(`SELECT o.id, o.status, o.phone, o.customer, COALESCE(pref.opted_in,0) AS opted_in
    FROM orders o LEFT JOIN order_notification_preferences pref ON pref.order_id=o.id WHERE o.id=? LIMIT 1`,[num]);
  if(!rows.length)return null;
  return {id,status:rows[0].status,phone:rows[0].phone,customer:rows[0].customer,notifyOptIn:!!rows[0].opted_in};
}
async function logNotification(orderId,previousStatus,newStatus,result) {
  const num=numFromOrderId(orderId);if(!num)return;
  await pool.execute(`INSERT INTO whatsapp_notifications(order_id,previous_status,new_status,dispatch_status,external_message_id,details)
    VALUES (?,?,?,?,?,?)`,[num,previousStatus||'',newStatus,result.status,result.messageId||'',String(result.details||'').slice(0,400)]);
}
async function setOrderPayment(id,paid) {
  const num=numFromOrderId(id);if(!num)return null;
  const [[o]]=await pool.query('SELECT total FROM orders WHERE id=? LIMIT 1',[num]);
  if(!o)return null;
  if(paid && o.total===null)throw Object.assign(new Error('Defina a taxa de entrega antes de registrar o pagamento.'),{validation:true});
  await pool.execute(`INSERT INTO order_payments(order_id,paid,paid_at) VALUES (?, ?, IF(?=1, UTC_TIMESTAMP(), NULL))
    ON DUPLICATE KEY UPDATE paid=VALUES(paid), paid_at=IF(VALUES(paid)=1,COALESCE(IF(paid=1,paid_at,NULL),UTC_TIMESTAMP()),NULL)`,[num,paid?1:0,paid?1:0]);
  return {id,paid};
}
async function setOrderFee(id, fee) {
  const num=numFromOrderId(id);if(!num)return false;
  const [r]=await pool.execute(`UPDATE orders SET delivery_fee=?,total=ROUND(subtotal+?,2)
    WHERE id=? AND order_type='delivery'`,[fee,fee,num]);
  return r.affectedRows>0;
}
async function removeOrder(id) {
  const num=numFromOrderId(id); if(!num)return false;
  const [r]=await pool.execute('DELETE FROM orders WHERE id=?',[num]);return r.affectedRows>0;
}
module.exports = {pool, initDatabase, diagnostic, getSettings, setSettings, getProducts, getPromos, getSite,
  getAdminData, insertProduct, updateProduct, removeProduct, insertPromo, updatePromo, removePromo,
  createOrder, changeOrderStatus, removeOrder, setOrderPayment, setOrderFee, getOrderNotificationTarget, logNotification, numFromOrderId};
