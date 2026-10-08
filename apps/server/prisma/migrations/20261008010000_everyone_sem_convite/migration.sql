-- Convite passa a ser conferido pelo cargo. Antes só a equipe (dono/admin/mod)
-- criava convites; tira "create_invite" do @everyone para manter isso igual.
UPDATE "roles"
SET "permissions" = COALESCE(
  (SELECT json_agg(x)::text FROM json_array_elements_text("permissions"::json) AS x WHERE x <> 'create_invite'),
  '[]'
)
WHERE "isDefault" = true;
