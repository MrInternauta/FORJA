#!/bin/sh
# Aplica las migraciones reales del repo (montadas en /migrations) en orden.
# Solo corre en el PRIMER arranque del volumen (comportamiento estandar de
# /docker-entrypoint-initdb.d). Para re-aplicar: docker compose down -v.
set -e
for f in /migrations/*.sql; do
  echo "== Aplicando $f"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done
