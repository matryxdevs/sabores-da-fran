'use strict';
const { pool } = require('./database');
const round = n => Math.round((Number(n)||0)*100)/100;
const dateISO = d => d instanceof Date ? d.toISOString().slice(0,10) : String(d).slice(0,10);
const monthOk = m => /^20\d{2}-(0[1-9]|1[0-2])$/.test(m);
const normalPurchase = r => ({id:r.id,date:dateISO(r.purchase_date),supplier:r.supplier,description:r.description,category:r.category,quantity:Number(r.quantity),unitCost:Number(r.unit_cost),total:Number(r.total_cost),notes:r.notes});
const normalExpense = r => ({id:r.id,date:dateISO(r.expense_date),description:r.description,category:r.category,amount:Number(r.amount),notes:r.notes});
async function report(month){
 if(!monthOk(month))throw new Error('Mês inválido. Use AAAA-MM.');
 const [purchasesRows,expensesRows,paidRows] = await Promise.all([
   pool.execute(`SELECT * FROM purchases WHERE DATE_FORMAT(purchase_date,'%Y-%m')=? ORDER BY purchase_date DESC,id DESC`,[month]),
   pool.execute(`SELECT * FROM operating_expenses WHERE DATE_FORMAT(expense_date,'%Y-%m')=? ORDER BY expense_date DESC,id DESC`,[month]),
   pool.execute(`SELECT o.id, o.customer, o.phone, o.order_type, o.status, o.payment, o.total, op.paid_at
     FROM orders o JOIN order_payments op ON op.order_id=o.id
     WHERE op.paid=1 AND DATE_FORMAT(op.paid_at - INTERVAL 3 HOUR,'%Y-%m')=? ORDER BY op.paid_at DESC,o.id DESC`,[month])
 ]);
 const purchases=purchasesRows[0].map(normalPurchase),expenses=expensesRows[0].map(normalExpense);
 const sales=paidRows[0].map(r=>({id:`FR-${String(r.id).padStart(5,'0')}`,customer:r.customer,phone:r.phone,type:r.order_type,status:r.status,payment:r.payment,total:Number(r.total),paidAt:new Date(r.paid_at).toISOString()}));
 const revenue=round(sales.reduce((a,x)=>a+x.total,0)),inventory=round(purchases.reduce((a,x)=>a+x.total,0)),operations=round(expenses.reduce((a,x)=>a+x.amount,0));
 const spending=round(inventory+operations),result=round(revenue-spending),margin=revenue?round(result/revenue*100):null,returnOnSpend=spending?round(result/spending*100):null;
 return {month,revenue,inventory,operations,spending,result,margin,returnOnSpend,paidOrders:sales.length,averageTicket:sales.length?round(revenue/sales.length):0,purchases,expenses,sales};
}
async function customers(){
 const [rows]=await pool.query(`SELECT c.phone,c.order_count,c.paid_orders,c.total_paid,c.last_order,l.status AS last_status,l.customer
 FROM (SELECT o.phone,COUNT(*) AS order_count,SUM(IF(COALESCE(p.paid,0)=1,1,0)) AS paid_orders,
 SUM(IF(COALESCE(p.paid,0)=1,COALESCE(o.total,0),0)) AS total_paid,MAX(o.id) AS last_order
 FROM orders o LEFT JOIN order_payments p ON p.order_id=o.id GROUP BY o.phone) c
 JOIN orders l ON l.id=c.last_order ORDER BY c.last_order DESC LIMIT 2000`);
 return rows.map(r=>({name:r.customer,phone:r.phone,orders:Number(r.order_count),paidOrders:Number(r.paid_orders),totalSpent:Number(r.total_paid),lastOrder:`FR-${String(r.last_order).padStart(5,'0')}`,lastStatus:r.last_status}));
}
async function addPurchase(p){const [r]=await pool.execute(`INSERT INTO purchases(purchase_date,supplier,description,category,quantity,unit_cost,total_cost,notes)
 VALUES (?,?,?,?,?,?,?,?)`,[p.date,p.supplier,p.description,p.category,p.quantity,p.unitCost,p.total,p.notes]);return r.insertId;}
async function updatePurchase(id,p){const [r]=await pool.execute(`UPDATE purchases SET purchase_date=?,supplier=?,description=?,category=?,quantity=?,unit_cost=?,total_cost=?,notes=? WHERE id=?`,[p.date,p.supplier,p.description,p.category,p.quantity,p.unitCost,p.total,p.notes,id]);return r.affectedRows>0;}
async function removePurchase(id){const [r]=await pool.execute('DELETE FROM purchases WHERE id=?',[id]);return r.affectedRows>0;}
async function addExpense(p){const [r]=await pool.execute('INSERT INTO operating_expenses(expense_date,category,description,amount,notes) VALUES (?,?,?,?,?)',[p.date,p.category,p.description,p.amount,p.notes]);return r.insertId;}
async function updateExpense(id,p){const [r]=await pool.execute('UPDATE operating_expenses SET expense_date=?,category=?,description=?,amount=?,notes=? WHERE id=?',[p.date,p.category,p.description,p.amount,p.notes,id]);return r.affectedRows>0;}
async function removeExpense(id){const [r]=await pool.execute('DELETE FROM operating_expenses WHERE id=?',[id]);return r.affectedRows>0;}
module.exports={report,customers,addPurchase,updatePurchase,removePurchase,addExpense,updateExpense,removeExpense,monthOk};
