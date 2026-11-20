-- Upgrade de uma instalação v2 existente. Preserva produtos, pedidos e configurações.
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
