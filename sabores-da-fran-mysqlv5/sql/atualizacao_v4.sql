-- Atualização opcional de marca: Sabores da Fran
UPDATE site_settings
SET payload = JSON_SET(
  COALESCE(payload, JSON_OBJECT()),
  '$.businessName', 'Sabores da Fran',
  '$.videoTitle2', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.videoTitle2')), 'Mais sabor em vídeo'),
  '$.videoDescription2', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.videoDescription2')), 'Assista também a outro vídeo da Sabores da Fran.'),
  '$.videoUrl2', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.videoUrl2')), ''),
  '$.logoUrl', ''
)
WHERE id = 1;
