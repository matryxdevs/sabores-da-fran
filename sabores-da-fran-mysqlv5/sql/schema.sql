-- Sabores da Fran — MySQL 8.0+ / MariaDB 10.6+
-- Primeiro crie o banco pelo painel da hospedagem; selecione-o antes de importar.
-- Este arquivo não cria o banco, nem cria usuários, nem contém senhas.
CREATE TABLE IF NOT EXISTS site_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  payload JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(90) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description VARCHAR(450) NOT NULL DEFAULT '',
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  image VARCHAR(900) NOT NULL DEFAULT '',
  featured TINYINT(1) NOT NULL DEFAULT 0,
  available TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_products_display (available, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  badge VARCHAR(35) NOT NULL DEFAULT '',
  title VARCHAR(100) NOT NULL,
  text VARCHAR(250) NOT NULL DEFAULT '',
  image VARCHAR(900) NOT NULL DEFAULT '',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'Aguardando envio no WhatsApp',
  customer VARCHAR(90) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  order_type ENUM('delivery','pickup') NOT NULL,
  address VARCHAR(350) NOT NULL DEFAULT '',
  reference_point VARCHAR(150) NOT NULL DEFAULT '',
  payment VARCHAR(50) NOT NULL DEFAULT '',
  note VARCHAR(350) NOT NULL DEFAULT '',
  subtotal DECIMAL(12,2) NOT NULL,
  delivery_fee DECIMAL(12,2) NULL,
  total DECIMAL(12,2) NULL,
  INDEX idx_orders_created (created_at),
  INDEX idx_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id CHAR(36) NOT NULL,
  product_name VARCHAR(90) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  quantity TINYINT UNSIGNED NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_items_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- CRM financeiro 3.0 — as tabelas abaixo NÃO apagam as já existentes.
CREATE TABLE IF NOT EXISTS purchases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  purchase_date DATE NOT NULL,
  supplier VARCHAR(120) NOT NULL DEFAULT '',
  description VARCHAR(250) NOT NULL,
  category VARCHAR(70) NOT NULL DEFAULT 'Mercadorias',
  quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
  unit_cost DECIMAL(12,2) NOT NULL,
  total_cost DECIMAL(12,2) NOT NULL,
  notes VARCHAR(300) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_purchases_date (purchase_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operating_expenses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  expense_date DATE NOT NULL,
  category VARCHAR(70) NOT NULL DEFAULT 'Operacional',
  description VARCHAR(250) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  notes VARCHAR(300) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_operating_expenses_date (expense_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pagamento separado para preservar a estrutura e pedidos de versões anteriores.
CREATE TABLE IF NOT EXISTS order_payments (
  order_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  paid TINYINT(1) NOT NULL DEFAULT 0,
  paid_at DATETIME NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_payment FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_paid_at (paid, paid_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_notification_preferences (
  order_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  opted_in TINYINT(1) NOT NULL DEFAULT 0,
  consent_at DATETIME NULL,
  CONSTRAINT fk_order_optin FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  previous_status VARCHAR(50) NOT NULL DEFAULT '',
  new_status VARCHAR(50) NOT NULL DEFAULT '',
  dispatch_status ENUM('accepted','failed','skipped') NOT NULL,
  external_message_id VARCHAR(160) NOT NULL DEFAULT '',
  details VARCHAR(400) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notification_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_notification_order (order_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- V5: opções personalizáveis por produto e histórico das escolhas por item de pedido.
-- CREATE IF NOT EXISTS permite importar no phpMyAdmin sem apagar os dados existentes.
CREATE TABLE IF NOT EXISTS product_option_groups (
  product_id CHAR(36) NOT NULL PRIMARY KEY,
  payload JSON NOT NULL,
  CONSTRAINT fk_product_option_groups_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_item_customizations (
  order_item_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  details JSON NOT NULL,
  CONSTRAINT fk_customizations_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
