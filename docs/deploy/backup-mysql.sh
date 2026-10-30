#!/usr/bin/env bash
# Modelo para Linux. Credenciais somente no arquivo protegido, fora do Git.
set -euo pipefail
umask 077
backup_dir=/var/backups/fhdod
credential_file=/etc/fhdod/backup.cnf
database_name=hospital_experiencia
mkdir -p "$backup_dir"
exec 9>"$backup_dir/.backup.lock"
flock -n 9 || { echo 'Já existe um backup em execução.' >&2; exit 1; }
stamp=$(date -u +%Y%m%dT%H%M%SZ)
destination="$backup_dir/$database_name-$stamp.sql.gz"
temporary=$(mktemp "$backup_dir/.backup.XXXXXXXX.sql.gz")
trap 'rm -f -- "$temporary"' EXIT
mysqldump --defaults-extra-file="$credential_file" --single-transaction --quick \
  --routines --events --triggers --hex-blob --no-tablespaces --set-gtid-purged=OFF \
  "$database_name" | gzip -c > "$temporary"
gzip -t "$temporary"
test -s "$temporary"
mv -- "$temporary" "$destination"
(cd "$backup_dir" && sha256sum "$(basename "$destination")" > "$(basename "$destination").sha256")
echo "Backup concluído: $destination"
