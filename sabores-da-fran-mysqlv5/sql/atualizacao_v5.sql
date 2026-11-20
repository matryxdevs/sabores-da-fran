-- Sabores da Fran V5: execução segura no banco existente (MySQL / MariaDB).
-- Não exclui nem altera produtos, pedidos ou dados de versões anteriores.
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
